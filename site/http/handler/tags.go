package handler

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

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

var (
	countryLookup map[string]countryInfo // by lowercased tag
	countryBySlug map[string]countryInfo
	// every country tag, lowercased, to pick them out of a post's tags
	countryTags bson.A
)

func init() {
	var raw map[string]string
	if err := json.Unmarshal(countriesJSON, &raw); err != nil {
		panic("handler: bad countries.json: " + err.Error())
	}
	countryLookup = make(map[string]countryInfo, len(raw))
	countryBySlug = make(map[string]countryInfo, len(raw))
	for code, name := range raw {
		info := countryInfo{Name: name, Code: code, Slug: countrySlug(name)}
		countryLookup[strings.ToLower(name)] = info
		countryBySlug[info.Slug] = info
		countryTags = append(countryTags, strings.ToLower(name))
	}
}

// countrySlug turns a country tag into its URL segment:
// "Czech Republic" → "czech-republic", "Cote D"Ivoire" → "cote-d-ivoire".
func countrySlug(name string) string {
	var b strings.Builder
	gap := false
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
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

type tagDetailResponse struct {
	Country   string            `json:"country"`
	Code      string            `json:"code"`
	Slug      string            `json:"slug"`
	Posts     []mapPostResponse `json:"posts"`
	Searchers []tagUserResponse `json:"searchers"`
	Authors   []tagUserResponse `json:"authors"`
}

// how many authors and searchers a country's leaderboards show
const tagLeadersLimit = 10

func (api *API) RegisterTagsApi() {
	api.mux.HandleFunc("GET /api/tags", api.handleTags)
	api.mux.HandleFunc("GET /api/tags/{slug}", api.handleTagDetail)
}

func (api *API) handleTags(w http.ResponseWriter, r *http.Request) {
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
		// d3.ru tags come in either case: "France" and "france" are one country
		bson.M{"$addFields": bson.M{"tag": bson.M{"$toLower": "$tags"}}},
		bson.M{"$match": bson.M{"tag": bson.M{"$in": countryTags}}},
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
		info, ok := countryLookup[strFromBson(doc["_id"])]
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

func (api *API) handleTagDetail(w http.ResponseWriter, r *http.Request) {
	info, ok := countryBySlug[strings.ToLower(r.PathValue("slug"))]
	if !ok {
		http.Error(w, "country not found", http.StatusNotFound)
		return
	}

	pipeline := bson.A{
		bson.M{"$match": bson.M{"tags": primitive.Regex{
			Pattern: "^" + regexp.QuoteMeta(info.Name) + "$",
			Options: "i",
		}}},
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
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(tagDetailResponse{
		Country:   info.Name,
		Code:      strings.ToLower(info.Code),
		Slug:      info.Slug,
		Posts:     posts,
		Searchers: topTagUsers(searchers),
		Authors:   topTagUsers(authors),
	})
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
