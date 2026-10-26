package handler

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/findthisplace.eu/dirty"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

//go:embed countries.json
var countriesJSON []byte

type countryInfo struct {
	Name string
	Code string
	Slug string
}

// by slug, so a tag finds its country however it is spelled:
// "czech republic" with a no-break space, "sri–lanka" with an en dash
var countryBySlug map[string]countryInfo

func init() {
	var raw map[string]string
	if err := json.Unmarshal(countriesJSON, &raw); err != nil {
		panic("handler: bad countries.json: " + err.Error())
	}
	countryBySlug = make(map[string]countryInfo, len(raw))
	for code, name := range raw {
		info := countryInfo{Name: name, Code: code, Slug: tagSlug(name)}
		countryBySlug[info.Slug] = info
	}
}

// tags on a puzzle's state, not its place: never related to anything
var statusTags = dirty.StatusTags

// tagSlug turns a tag into its URL segment: "saint petersburg" →
// "saint-petersburg", "Cote D"Ivoire" → "cote-d-ivoire"; Cyrillic stays.
func tagSlug(tag string) string {
	var b strings.Builder
	gap := false
	for _, r := range strings.ToLower(tag) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if gap && b.Len() > 0 {
				b.WriteByte('-')
			}
			b.WriteRune(r)
			gap = false
		} else {
			gap = true
		}
	}
	return b.String()
}

// tierExpr is tierFromAge as an aggregation expression over a wait in seconds.
func tierExpr(seconds string) bson.M {
	branches := make(bson.A, len(tierBounds))
	for i, bound := range tierBounds {
		branches[i] = bson.M{"case": bson.M{"$lt": bson.A{seconds, bound}}, "then": i}
	}
	return bson.M{"$switch": bson.M{"branches": branches, "default": len(tierBounds)}}
}

// hiddenPostStages drop the posts an admin has hidden, by tag or by id, from
// a pipeline over dirty_posts, so a country's count matches its page.
func (api *API) hiddenPostStages(ctx context.Context) bson.A {
	var stages bson.A
	if tags, _ := api.settings.GetHiddenTags(ctx); len(tags) > 0 {
		stages = append(stages, bson.M{"$match": bson.M{"tags": bson.M{"$nin": tags}}})
	}
	if ids, _ := api.settings.GetHiddenNotFoundPosts(ctx); len(ids) > 0 {
		stages = append(stages, bson.M{"$match": bson.M{"_id": bson.M{"$nin": ids}}})
	}
	return stages
}

type tagResponse struct {
	Country string `json:"country"`
	Code    string `json:"code"`
	Slug    string `json:"slug"`
	Count   int    `json:"count"`
	// finds by how long the puzzle waited for its searcher, as the tiers
	Tiers         []int   `json:"tiers"`
	Authors       int     `json:"authors"`
	Searchers     int     `json:"searchers"`
	AvgSearchTime float64 `json:"avg_search_time"`
	FirstFound    string  `json:"first_found,omitempty"`
	LastFound     string  `json:"last_found,omitempty"`
	FoundLastYear int     `json:"found_last_year"`
}

// tagUserResponse is an author or searcher on a country's leaderboard.
type tagUserResponse struct {
	Id            int     `json:"id"`
	Login         string  `json:"login"`
	AvatarUrl     string  `json:"avatar_url,omitempty"`
	Count         int     `json:"count"`
	Tiers         []int   `json:"tiers"`
	AvgSearchTime float64 `json:"avg_search_time"`

	waited float64 // seconds, summed over the timed posts
	timed  int
}

// tagRefResponse points at another tag's page.
type tagRefResponse struct {
	Tag   string `json:"tag"`
	Slug  string `json:"slug"`
	Code  string `json:"code,omitempty"` // a country's, for its flag
	Count int    `json:"count"`
}

type tagDetailResponse struct {
	Tag  string `json:"tag"`
	Slug string `json:"slug"`
	// set when the tag is a country
	Country string `json:"country,omitempty"`
	Code    string `json:"code,omitempty"`
	// the country nearly all the posts are in, when the tag is a place in one
	Parent *tagRefResponse `json:"parent,omitempty"`
	// the posts' other tags, the most used first
	Related   []tagRefResponse  `json:"related"`
	Posts     []mapPostResponse `json:"posts"`
	Searchers []tagUserResponse `json:"searchers"`
	Authors   []tagUserResponse `json:"authors"`
}

// how many authors and searchers a tag's leaderboards show
const tagLeadersLimit = 10

func (api *API) RegisterTagsApi() {
	api.mux.HandleFunc("GET /api/tags", api.handleTags)
	api.mux.HandleFunc("GET /api/tags/{slug}", api.handleTagDetail)
}

func (api *API) handleTags(w http.ResponseWriter, r *http.Request) {
	bySlug, err := api.tagSpellings(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// every way each country is tagged, to be counted as that country
	countryTags := bson.A{}
	asCountry := bson.A{}
	for slug, tags := range bySlug {
		if _, ok := countryBySlug[slug]; !ok {
			continue
		}
		for _, t := range tags {
			countryTags = append(countryTags, t)
		}
		asCountry = append(asCountry, bson.M{
			"case": bson.M{"$in": bson.A{"$tags", bson.M{"$literal": tags}}},
			"then": slug,
		})
	}
	if len(asCountry) == 0 {
		setJsonHeader(w)
		json.NewEncoder(w).Encode([]tagResponse{})
		return
	}

	yearAgo := primitive.NewDateTimeFromTime(time.Now().AddDate(-1, 0, 0))

	group := bson.M{
		"_id":   "$tag",
		"count": bson.M{"$sum": 1},
		// no one, rather than a user 0
		"authors": bson.M{"$addToSet": bson.M{"$cond": bson.A{
			bson.M{"$gt": bson.A{"$user_id", 0}}, "$user_id", "$$REMOVE",
		}}},
		"searchers": bson.M{"$addToSet": bson.M{"$cond": bson.A{
			bson.M{"$gt": bson.A{"$ftp.found_by_id", 0}}, "$ftp.found_by_id", "$$REMOVE",
		}}},
		"avg_search_time": bson.M{"$avg": "$search_time"},
		"first_found":     bson.M{"$min": "$ftp.found_date"},
		"last_found":      bson.M{"$max": "$ftp.found_date"},
		"found_last_year": bson.M{"$sum": bson.M{"$cond": bson.A{
			bson.M{"$gte": bson.A{"$ftp.found_date", yearAgo}}, 1, 0,
		}}},
	}
	for t := 0; t <= len(tierBounds); t++ {
		group[fmt.Sprintf("tier%d", t)] = bson.M{"$sum": bson.M{"$cond": bson.A{
			bson.M{"$eq": bson.A{"$tier", t}}, 1, 0,
		}}}
	}

	pipeline := api.hiddenPostStages(r.Context())
	pipeline = append(pipeline,
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": "$ftp"},
		bson.M{"$match": bson.M{"ftp.is_found": true}},
		bson.M{"$unwind": "$tags"},
		bson.M{"$match": bson.M{"tags": bson.M{"$in": countryTags}}},
		bson.M{"$addFields": bson.M{"tag": bson.M{"$switch": bson.M{"branches": asCountry}}}},
		bson.M{"$addFields": bson.M{"search_time": bson.M{"$divide": bson.A{
			bson.M{"$subtract": bson.A{"$ftp.found_date", "$created"}},
			1000,
		}}}},
		bson.M{"$addFields": bson.M{"tier": tierExpr("$search_time")}},
		bson.M{"$group": group},
		bson.M{"$addFields": bson.M{
			"authors":   bson.M{"$size": "$authors"},
			"searchers": bson.M{"$size": "$searchers"},
		}},
		// ties by name, so a country keeps its place from one load to the next
		bson.M{"$sort": bson.D{{Key: "count", Value: -1}, {Key: "_id", Value: 1}}},
	)

	cursor, err := api.store.DirtyPosts.Aggregate(r.Context(), pipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cursor.Close(r.Context())

	var raw []bson.M
	if err := cursor.All(r.Context(), &raw); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	results := make([]tagResponse, 0, len(raw))
	for _, doc := range raw {
		info, ok := countryBySlug[strFromBson(doc["_id"])]
		if !ok {
			continue
		}
		resp := tagResponse{
			Country:       info.Name,
			Code:          strings.ToLower(info.Code),
			Slug:          info.Slug,
			Count:         intFromBson(doc["count"]),
			Tiers:         make([]int, len(tierBounds)+1),
			Authors:       intFromBson(doc["authors"]),
			Searchers:     intFromBson(doc["searchers"]),
			AvgSearchTime: floatFromBson(doc["avg_search_time"]),
			FoundLastYear: intFromBson(doc["found_last_year"]),
		}
		for t := range resp.Tiers {
			resp.Tiers[t] = intFromBson(doc[fmt.Sprintf("tier%d", t)])
		}
		if d, ok := doc["first_found"].(primitive.DateTime); ok {
			resp.FirstFound = d.Time().UTC().Format(time.RFC3339)
		}
		if d, ok := doc["last_found"].(primitive.DateTime); ok {
			resp.LastFound = d.Time().UTC().Format(time.RFC3339)
		}
		results = append(results, resp)
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

// tagSpellings groups every tag on the posts by its slug: d3.ru keeps tags
// lowercase, but they can still differ in spacing and dashes.
func (api *API) tagSpellings(ctx context.Context) (map[string][]string, error) {
	values, err := api.store.DirtyPosts.Distinct(ctx, "tags", bson.M{})
	if err != nil {
		return nil, err
	}
	bySlug := map[string][]string{}
	for _, v := range values {
		if tag, ok := v.(string); ok {
			if s := tagSlug(tag); s != "" {
				bySlug[s] = append(bySlug[s], tag)
			}
		}
	}
	for _, tags := range bySlug {
		sort.Strings(tags)
	}
	return bySlug, nil
}

func (api *API) handleTagDetail(w http.ResponseWriter, r *http.Request) {
	slug := tagSlug(r.PathValue("slug"))
	bySlug, err := api.tagSpellings(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	spellings := bySlug[slug]
	if spellings == nil {
		spellings = []string{}
	}
	country, isCountry := countryBySlug[slug]
	// a country no one has found anything in yet still has a page to say so
	if len(spellings) == 0 && !isCountry {
		http.Error(w, "tag not found", http.StatusNotFound)
		return
	}

	pipeline := bson.A{
		bson.M{"$match": bson.M{"tags": bson.M{"$in": spellings}}},
	}
	pipeline = append(pipeline, api.hiddenPostStages(r.Context())...)
	pipeline = append(pipeline,
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": "$ftp"},
		bson.M{"$match": bson.M{"ftp.is_found": true}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "user_id",
			"foreignField": "_id",
			"as":           "author",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$author",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "ftp.found_by_id",
			"foreignField": "_id",
			"as":           "finder",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$finder",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          1,
			"main_image_url": 1,
			"user_id":        1,
			"username":       "$author.login",
			"gender":         "$author.gender",
			"author_avatar":  "$author.avatar_url",
			"created":        1,
			"found_date":     "$ftp.found_date",
			"found_by_id":    "$ftp.found_by_id",
			"found_by":       "$finder.login",
			"finder_avatar":  "$finder.avatar_url",
			"longitude":      "$ftp.longitude",
			"latitude":       "$ftp.latitude",
			"tags":           1,
		}},
		bson.M{"$sort": bson.D{{Key: "found_date", Value: -1}, {Key: "_id", Value: -1}}},
	)

	cursor, err := api.store.DirtyPosts.Aggregate(r.Context(), pipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cursor.Close(r.Context())

	var raw []bson.M
	if err := cursor.All(r.Context(), &raw); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	posts := make([]mapPostResponse, 0, len(raw))
	searchers := map[int]*tagUserResponse{}
	authors := map[int]*tagUserResponse{}
	related := map[string]*tagRefResponse{}

	for _, doc := range raw {
		post := mapPostResponse{
			Id:           intFromBson(doc["_id"]),
			Title:        strFromBson(doc["title"]),
			Longitude:    floatFromBson(doc["longitude"]),
			Latitude:     floatFromBson(doc["latitude"]),
			UserID:       intFromBson(doc["user_id"]),
			Username:     strFromBson(doc["username"]),
			Gender:       strFromBson(doc["gender"]),
			MainImageURL: strFromBson(doc["main_image_url"]),
			IsFound:      true,
			FoundByID:    intFromBson(doc["found_by_id"]),
			FoundBy:      strFromBson(doc["found_by"]),
			CountryCode:  countryCodeFromTags(doc["tags"]),
		}
		fd, fdOk := doc["found_date"].(primitive.DateTime)
		cd, cdOk := doc["created"].(primitive.DateTime)
		if fdOk {
			post.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		}
		if cdOk {
			post.CreatedDate = cd.Time().UTC().Format(time.RFC3339)
		}
		waited := -1.0
		if fdOk && cdOk {
			waited = fd.Time().Sub(cd.Time()).Seconds()
			post.Tier = tierFromAge(waited)
		}
		posts = append(posts, post)

		countTagUser(searchers, post.FoundByID, post.FoundBy, strFromBson(doc["finder_avatar"]), post.Tier, waited)
		countTagUser(authors, post.UserID, post.Username, strFromBson(doc["author_avatar"]), post.Tier, waited)
		countRelated(related, slug, doc["tags"])
	}

	resp := tagDetailResponse{
		Slug:      slug,
		Related:   sortedTagRefs(related),
		Posts:     posts,
		Searchers: topTagUsers(searchers),
		Authors:   topTagUsers(authors),
	}
	if len(spellings) > 0 {
		resp.Tag = spellings[0]
	}
	if isCountry {
		resp.Country = country.Name
		resp.Code = strings.ToLower(country.Code)
		if resp.Tag == "" {
			resp.Tag = country.Name
		}
	} else {
		// the most used country among the related tags, if nearly every post
		// is in it: a city is, a theme like "film locations" spans several
		for i := range resp.Related {
			if resp.Related[i].Code == "" {
				continue
			}
			if resp.Related[i].Count*4 >= len(posts)*3 {
				resp.Parent = &resp.Related[i]
			}
			break
		}
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(resp)
}

// countRelated adds a post's other tags to those related to slug's.
func countRelated(related map[string]*tagRefResponse, slug string, tags interface{}) {
	arr, _ := tags.(primitive.A)
	seen := make(map[string]bool, len(arr))
	for _, t := range arr {
		tag, ok := t.(string)
		if !ok || statusTags[strings.ToLower(tag)] {
			continue
		}
		s := tagSlug(tag)
		if s == "" || s == slug || seen[s] {
			continue
		}
		seen[s] = true
		ref, ok := related[s]
		if !ok {
			ref = &tagRefResponse{Tag: tag, Slug: s}
			if info, ok := countryBySlug[s]; ok {
				ref.Code = strings.ToLower(info.Code)
			}
			related[s] = ref
		}
		ref.Count++
	}
}

func sortedTagRefs(refs map[string]*tagRefResponse) []tagRefResponse {
	list := make([]tagRefResponse, 0, len(refs))
	for _, ref := range refs {
		list = append(list, *ref)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Count != list[j].Count {
			return list[i].Count > list[j].Count
		}
		return list[i].Slug < list[j].Slug
	})
	return list
}

// countTagUser adds a post to its author's or searcher's line on the board;
// waited is how long it took to find, negative if unknown.
func countTagUser(users map[int]*tagUserResponse, id int, login, avatar string, tier int, waited float64) {
	if id == 0 {
		return
	}
	u, ok := users[id]
	if !ok {
		u = &tagUserResponse{Id: id, Login: login, AvatarUrl: avatar, Tiers: make([]int, len(tierBounds)+1)}
		users[id] = u
	}
	u.Count++
	u.Tiers[tier]++
	if waited >= 0 {
		u.waited += waited
		u.timed++
	}
}

func topTagUsers(users map[int]*tagUserResponse) []tagUserResponse {
	top := make([]tagUserResponse, 0, len(users))
	for _, u := range users {
		if u.timed > 0 {
			u.AvgSearchTime = u.waited / float64(u.timed)
		}
		top = append(top, *u)
	}
	sort.Slice(top, func(i, j int) bool {
		if top[i].Count != top[j].Count {
			return top[i].Count > top[j].Count
		}
		return top[i].Id < top[j].Id
	})
	if len(top) > tagLeadersLimit {
		top = top[:tagLeadersLimit]
	}
	return top
}
