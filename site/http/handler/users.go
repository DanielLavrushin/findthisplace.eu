package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type authorResponse struct {
	Id                int     `json:"id"`
	Login             string  `json:"login"`
	AvatarUrl         string  `json:"avatar_url,omitempty"`
	AuthorPostsFound  int     `json:"author_posts_found"`
	AuthorPostsTotal  int     `json:"author_posts_total"`
	AuthorPostsNfound int     `json:"author_posts_nfound"`
	AvgAuthorTime     float64 `json:"avg_author_time"`
	FirstPost         string  `json:"first_post,omitempty"`
	LastPost          string  `json:"last_post,omitempty"`
}

type searcherResponse struct {
	Id              int     `json:"id"`
	Login           string  `json:"login"`
	AvatarUrl       string  `json:"avatar_url,omitempty"`
	FoundTiersTotal int     `json:"found_tiers_total"`
	FoundTier0      int     `json:"found_tier0"`
	FoundTier1      int     `json:"found_tier1"`
	FoundTier2      int     `json:"found_tier2"`
	FoundTier3      int     `json:"found_tier3"`
	FoundTier4      int     `json:"found_tier4"`
	AvgSearchTime   float64 `json:"avg_search_time"`
	FirstFound      string  `json:"first_found,omitempty"`
	LastFound       string  `json:"last_found,omitempty"`
}

// yearLeadersLimit is how many of each year's best make its line
const yearLeadersLimit = 3

// yearLeaderResponse is a searcher or author among a year's best.
type yearLeaderResponse struct {
	Id        int    `json:"id"`
	Login     string `json:"login"`
	AvatarUrl string `json:"avatar_url,omitempty"`
	Count     int    `json:"count"`
}

// yearResponse is a year of the game: how many places were found, or set
// as puzzles, and by whom the most.
type yearResponse struct {
	Year  int `json:"year"`
	Count int `json:"count"`
	// the searchers' year: its finds by tier
	Tiers []int `json:"tiers,omitempty"`
	// the authors' year: how many of its puzzles were found, and how many no
	// one has found yet; the two can fall short of Count, see waitingExpr
	Found  int `json:"found,omitempty"`
	Nfound int `json:"nfound,omitempty"`
	// how many searchers found anything that year, or authors set anything
	Users int `json:"users"`
	// the most first; of equals, the one who got there first
	Top []yearLeaderResponse `json:"top"`
}

type userPostResponse struct {
	Id           int     `json:"id"`
	Title        string  `json:"title"`
	MainImageURL string  `json:"main_image_url"`
	UserID       int     `json:"user_id,omitempty"`
	Username     string  `json:"username"`
	Gender       string  `json:"gender"`
	CreatedDate  string  `json:"created_date"`
	IsFound      bool    `json:"is_found"`
	Waiting      bool    `json:"waiting,omitempty"` // an author's puzzle /not-found lists
	FoundDate    string  `json:"found_date,omitempty"`
	FoundByID    int     `json:"found_by_id,omitempty"`
	FoundBy      string  `json:"found_by,omitempty"`
	Longitude    float64 `json:"longitude,omitempty"`
	Latitude     float64 `json:"latitude,omitempty"`
	Tier         int     `json:"tier"`
	Role         string  `json:"role"`
	CountryCode  string  `json:"country_code,omitempty"`
}

type userDetailResponse struct {
	Id                int                `json:"id"`
	Login             string             `json:"login"`
	AvatarUrl         string             `json:"avatar_url,omitempty"`
	AuthorPostsFound  int                `json:"author_posts_found"`
	AuthorPostsTotal  int                `json:"author_posts_total"`
	AuthorPostsNfound int                `json:"author_posts_nfound"`
	AvgAuthorTime     float64            `json:"avg_author_time"`
	FoundTiersTotal   int                `json:"found_tiers_total"`
	FoundTier0        int                `json:"found_tier0"`
	FoundTier1        int                `json:"found_tier1"`
	FoundTier2        int                `json:"found_tier2"`
	FoundTier3        int                `json:"found_tier3"`
	FoundTier4        int                `json:"found_tier4"`
	AvgSearchTime     float64            `json:"avg_search_time"`
	Posts             []userPostResponse `json:"posts"`
}

// countryCodeFromTags extracts the country code from a tags array by matching against countryBySlug
func countryCodeFromTags(tags interface{}) string {
	arr, ok := tags.(primitive.A)
	if !ok {
		return ""
	}
	for _, t := range arr {
		if tag, ok := t.(string); ok {
			if info, found := countryBySlug[tagSlug(tag)]; found {
				return strings.ToLower(info.Code)
			}
		}
	}
	return ""
}

func (api *API) RegisterUsersApi() {
	api.mux.HandleFunc("GET /api/users/searchers", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/searchers/years", api.handleSearcherYears)
	api.mux.HandleFunc("GET /api/users/searchers/{limit}", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/authors", api.handleAuthors)
	api.mux.HandleFunc("GET /api/users/authors/years", api.handleAuthorYears)
	api.mux.HandleFunc("GET /api/users/authors/{limit}", api.handleAuthors)
	api.mux.HandleFunc("GET /api/users/{id}", api.handleUserDetail)
}

func (api *API) handleSearchers(w http.ResponseWriter, r *http.Request) {
	var limit int
	if v := r.PathValue("limit"); v != "" {
		limit, _ = strconv.Atoi(v)
	}

	hiddenTags, _ := api.settings.GetHiddenTags(r.Context())

	// Build pipeline to compute searcher stats dynamically, filtering hidden tags
	pipeline := bson.A{
		bson.M{"$match": bson.M{"is_found": true, "found_by_id": bson.M{"$exists": true, "$ne": 0}}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "post",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$post",
			"preserveNullAndEmptyArrays": false,
		}},
	}

	if len(hiddenTags) > 0 {
		tagsBson := make(bson.A, len(hiddenTags))
		for i, t := range hiddenTags {
			tagsBson[i] = t
		}
		pipeline = append(pipeline, bson.M{"$match": bson.M{"post.tags": bson.M{"$nin": tagsBson}}})
	}

	pipeline = append(pipeline,
		// Calculate tier based on time difference
		bson.M{"$addFields": bson.M{
			"search_time": bson.M{"$divide": bson.A{
				bson.M{"$subtract": bson.A{"$found_date", "$post.created"}},
				1000,
			}},
		}},
		bson.M{"$addFields": bson.M{
			"tier": bson.M{"$switch": bson.M{
				"branches": bson.A{
					bson.M{"case": bson.M{"$lt": bson.A{"$search_time", 6 * 30 * 24 * 3600}}, "then": 0},
					bson.M{"case": bson.M{"$lt": bson.A{"$search_time", 12 * 30 * 24 * 3600}}, "then": 1},
					bson.M{"case": bson.M{"$lt": bson.A{"$search_time", 2 * 365 * 24 * 3600}}, "then": 2},
					bson.M{"case": bson.M{"$lt": bson.A{"$search_time", 5 * 365 * 24 * 3600}}, "then": 3},
				},
				"default": 4,
			}},
		}},
		bson.M{"$group": bson.M{
			"_id":             "$found_by_id",
			"found_tier0":     bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", 0}}, 1, 0}}},
			"found_tier1":     bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", 1}}, 1, 0}}},
			"found_tier2":     bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", 2}}, 1, 0}}},
			"found_tier3":     bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", 3}}, 1, 0}}},
			"found_tier4":     bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", 4}}, 1, 0}}},
			"avg_search_time": bson.M{"$avg": "$search_time"},
			"first_found":     bson.M{"$min": "$found_date"},
			"last_found":      bson.M{"$max": "$found_date"},
		}},
		bson.M{"$addFields": bson.M{
			"found_tiers_total": bson.M{"$add": bson.A{"$found_tier0", "$found_tier1", "$found_tier2", "$found_tier3", "$found_tier4"}},
		}},
		bson.M{"$match": bson.M{"found_tiers_total": bson.M{"$gt": 0}}},
		bson.M{"$sort": bson.M{"found_tiers_total": -1}},
	)

	if limit > 0 {
		pipeline = append(pipeline, bson.M{"$limit": limit})
	}

	pipeline = append(pipeline,
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":               1,
			"login":             "$user.login",
			"avatar_url":        "$user.avatar_url",
			"found_tiers_total": 1,
			"found_tier0":       1,
			"found_tier1":       1,
			"found_tier2":       1,
			"found_tier3":       1,
			"found_tier4":       1,
			"avg_search_time":   1,
			"first_found":       1,
			"last_found":        1,
		}},
	)

	cursor, err := api.store.FtpPosts.Aggregate(r.Context(), pipeline)
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

	results := make([]searcherResponse, 0, len(raw))
	for _, doc := range raw {
		results = append(results, searcherResponse{
			Id:              intFromBson(doc["_id"]),
			Login:           strFromBson(doc["login"]),
			AvatarUrl:       strFromBson(doc["avatar_url"]),
			FoundTiersTotal: intFromBson(doc["found_tiers_total"]),
			FoundTier0:      intFromBson(doc["found_tier0"]),
			FoundTier1:      intFromBson(doc["found_tier1"]),
			FoundTier2:      intFromBson(doc["found_tier2"]),
			FoundTier3:      intFromBson(doc["found_tier3"]),
			FoundTier4:      intFromBson(doc["found_tier4"]),
			AvgSearchTime:   floatFromBson(doc["avg_search_time"]),
			FirstFound:      dateFromBson(doc["first_found"]),
			LastFound:       dateFromBson(doc["last_found"]),
		})
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func (api *API) handleAuthors(w http.ResponseWriter, r *http.Request) {
	var limit int
	if v := r.PathValue("limit"); v != "" {
		limit, _ = strconv.Atoi(v)
	}

	// Build pipeline to compute author stats dynamically, without the posts an
	// admin has hidden, so an author's unsolved count matches /not-found and the profile
	pipeline := bson.A{
		bson.M{"$match": bson.M{"user_id": bson.M{"$exists": true, "$ne": 0}}},
	}
	pipeline = append(pipeline, api.hiddenPostStages(r.Context())...)

	pipeline = append(pipeline,
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$ftp",
			"preserveNullAndEmptyArrays": true,
		}},
		// Calculate author time for found posts
		bson.M{"$addFields": bson.M{
			"author_time": bson.M{"$cond": bson.M{
				"if":   bson.M{"$eq": bson.A{"$ftp.is_found", true}},
				"then": bson.M{"$divide": bson.A{bson.M{"$subtract": bson.A{"$ftp.found_date", "$created"}}, 1000}},
				"else": nil,
			}},
		}},
		bson.M{"$group": bson.M{
			"_id":                "$user_id",
			"author_posts_total": bson.M{"$sum": 1},
			"author_posts_found": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$ftp.is_found", true}}, 1, 0}}},
			// not total - found: a post neither found nor waiting sets no one a puzzle
			"author_posts_nfound": bson.M{"$sum": bson.M{"$cond": bson.A{waitingExpr, 1, 0}}},
			"avg_author_time":     bson.M{"$avg": "$author_time"},
			"first_post":          bson.M{"$min": "$created"},
			"last_post":           bson.M{"$max": "$created"},
		}},
		bson.M{"$match": bson.M{"author_posts_total": bson.M{"$gt": 0}}},
		bson.M{"$sort": bson.M{"author_posts_total": -1}},
	)

	if limit > 0 {
		pipeline = append(pipeline, bson.M{"$limit": limit})
	}

	pipeline = append(pipeline,
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":                 1,
			"login":               "$user.login",
			"avatar_url":          "$user.avatar_url",
			"author_posts_found":  1,
			"author_posts_total":  1,
			"author_posts_nfound": 1,
			"avg_author_time":     1,
			"first_post":          1,
			"last_post":           1,
		}},
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

	results := make([]authorResponse, 0, len(raw))
	for _, doc := range raw {
		results = append(results, authorResponse{
			Id:                intFromBson(doc["_id"]),
			Login:             strFromBson(doc["login"]),
			AvatarUrl:         strFromBson(doc["avatar_url"]),
			AuthorPostsFound:  intFromBson(doc["author_posts_found"]),
			AuthorPostsTotal:  intFromBson(doc["author_posts_total"]),
			AuthorPostsNfound: intFromBson(doc["author_posts_nfound"]),
			AvgAuthorTime:     floatFromBson(doc["avg_author_time"]),
			FirstPost:         dateFromBson(doc["first_post"]),
			LastPost:          dateFromBson(doc["last_post"]),
		})
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

// yearStart is when the year under way began. The year boards end there:
// a year still running would be measured against whole ones.
func yearStart() time.Time {
	return time.Date(time.Now().UTC().Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
}

// topOfYear picks a year's best out of its {year, user} groups.
var topOfYear = bson.M{"$topN": bson.M{
	"n":      yearLeadersLimit,
	"sortBy": bson.D{{Key: "count", Value: -1}, {Key: "last", Value: 1}},
	"output": bson.M{"id": "$_id.user", "count": "$count"},
}}

func (api *API) handleSearcherYears(w http.ResponseWriter, r *http.Request) {
	userGroup := bson.M{
		"_id":   bson.M{"year": bson.M{"$year": "$ftp.found_date"}, "user": "$ftp.found_by_id"},
		"count": bson.M{"$sum": 1},
		"last":  bson.M{"$max": "$ftp.found_date"},
	}
	yearGroup := bson.M{
		"_id":   "$_id.year",
		"count": bson.M{"$sum": "$count"},
		"users": bson.M{"$sum": 1},
		"top":   topOfYear,
	}
	for t := 0; t <= len(tierBounds); t++ {
		tier := fmt.Sprintf("tier%d", t)
		userGroup[tier] = bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$tier", t}}, 1, 0}}}
		yearGroup[tier] = bson.M{"$sum": "$" + tier}
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
		bson.M{"$match": bson.M{
			"ftp.is_found":    true,
			"ftp.found_by_id": bson.M{"$gt": 0},
			"ftp.found_date":  bson.M{"$type": "date", "$lt": yearStart()},
		}},
		bson.M{"$addFields": bson.M{"search_time": bson.M{"$divide": bson.A{
			bson.M{"$subtract": bson.A{"$ftp.found_date", "$created"}},
			1000,
		}}}},
		bson.M{"$addFields": bson.M{"tier": tierExpr("$search_time")}},
		bson.M{"$group": userGroup},
		bson.M{"$group": yearGroup},
		bson.M{"$sort": bson.M{"_id": -1}},
	)

	years, err := api.aggregateYears(r.Context(), pipeline, func(doc bson.M, y *yearResponse) {
		y.Tiers = make([]int, len(tierBounds)+1)
		for t := range y.Tiers {
			y.Tiers[t] = intFromBson(doc[fmt.Sprintf("tier%d", t)])
		}
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(years)
}

func (api *API) handleAuthorYears(w http.ResponseWriter, r *http.Request) {
	pipeline := api.hiddenPostStages(r.Context())
	pipeline = append(pipeline,
		bson.M{"$match": bson.M{
			"user_id": bson.M{"$gt": 0},
			"created": bson.M{"$type": "date", "$lt": yearStart()},
		}},
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$ftp",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$group": bson.M{
			"_id":   bson.M{"year": bson.M{"$year": "$created"}, "user": "$user_id"},
			"count": bson.M{"$sum": 1},
			"last":  bson.M{"$max": "$created"},
			"found": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$eq": bson.A{"$ftp.is_found", true}}, 1, 0,
			}}},
			"nfound": bson.M{"$sum": bson.M{"$cond": bson.A{waitingExpr, 1, 0}}},
		}},
		bson.M{"$group": bson.M{
			"_id":    "$_id.year",
			"count":  bson.M{"$sum": "$count"},
			"found":  bson.M{"$sum": "$found"},
			"nfound": bson.M{"$sum": "$nfound"},
			"users":  bson.M{"$sum": 1},
			"top":    topOfYear,
		}},
		bson.M{"$sort": bson.M{"_id": -1}},
	)

	years, err := api.aggregateYears(r.Context(), pipeline, func(doc bson.M, y *yearResponse) {
		y.Found = intFromBson(doc["found"])
		y.Nfound = intFromBson(doc["nfound"])
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(years)
}

// aggregateYears runs a pipeline that groups by year, with each year's top,
// and names the leaders; fill reads what else a year's line carries.
func (api *API) aggregateYears(ctx context.Context, pipeline bson.A, fill func(bson.M, *yearResponse)) ([]yearResponse, error) {
	cursor, err := api.store.DirtyPosts.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var raw []bson.M
	if err := cursor.All(ctx, &raw); err != nil {
		return nil, err
	}

	years := make([]yearResponse, 0, len(raw))
	ids := bson.A{}
	for _, doc := range raw {
		y := yearResponse{
			Year:  intFromBson(doc["_id"]),
			Count: intFromBson(doc["count"]),
			Users: intFromBson(doc["users"]),
		}
		top, _ := doc["top"].(bson.A)
		for _, t := range top {
			leader, _ := t.(bson.M)
			y.Top = append(y.Top, yearLeaderResponse{
				Id:    intFromBson(leader["id"]),
				Count: intFromBson(leader["count"]),
			})
			ids = append(ids, leader["id"])
		}
		fill(doc, &y)
		years = append(years, y)
	}

	if len(ids) == 0 {
		return years, nil
	}
	users, err := api.store.DirtyUsers.Find(ctx, bson.M{"_id": bson.M{"$in": ids}},
		options.Find().SetProjection(bson.M{"login": 1, "avatar_url": 1}))
	if err != nil {
		return nil, err
	}
	defer users.Close(ctx)

	var profiles []bson.M
	if err := users.All(ctx, &profiles); err != nil {
		return nil, err
	}
	byId := make(map[int]bson.M, len(profiles))
	for _, p := range profiles {
		byId[intFromBson(p["_id"])] = p
	}
	for i := range years {
		for j := range years[i].Top {
			leader := &years[i].Top[j]
			leader.Login = strFromBson(byId[leader.Id]["login"])
			leader.AvatarUrl = strFromBson(byId[leader.Id]["avatar_url"])
		}
	}
	return years, nil
}

func dateFromBson(v interface{}) string {
	if d, ok := v.(primitive.DateTime); ok {
		return d.Time().UTC().Format(time.RFC3339)
	}
	return ""
}

// userIdFrom reads whose profile a path asks for: an id, or a nickname in
// any case, so /searchers/25377 and /searchers/via_lactea are the same page.
// Zero for no such user.
func (api *API) userIdFrom(ctx context.Context, ref string) (int, error) {
	if id, err := strconv.Atoi(ref); err == nil {
		// a nickname can be all digits too: the number is an id only if one is taken
		n, err := api.store.DirtyUsers.CountDocuments(ctx, bson.M{"_id": id})
		if err != nil || n > 0 {
			return id, err
		}
	}

	var user struct {
		Id int `bson:"_id"`
	}
	err := api.store.DirtyUsers.FindOne(ctx, bson.M{"login": ref}, options.FindOne().
		SetProjection(bson.M{"_id": 1}).
		SetCollation(&options.Collation{Locale: "en", Strength: 2})).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return 0, nil
	}
	return user.Id, err
}

func (api *API) handleUserDetail(w http.ResponseWriter, r *http.Request) {
	id, err := api.userIdFrom(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if id == 0 {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	hiddenTags, _ := api.settings.GetHiddenTags(r.Context())
	var hiddenTagsBson bson.A
	if len(hiddenTags) > 0 {
		hiddenTagsBson = make(bson.A, len(hiddenTags))
		for i, t := range hiddenTags {
			hiddenTagsBson[i] = t
		}
	}

	hiddenPosts, _ := api.settings.GetHiddenNotFoundPosts(r.Context())
	hiddenPostsSet := make(map[int]bool, len(hiddenPosts))
	for _, pid := range hiddenPosts {
		hiddenPostsSet[pid] = true
	}

	// Fetch user stats + profile (both author and searcher fields)
	pipeline := bson.A{
		bson.M{"$match": bson.M{"_id": id}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":                1,
			"login":              "$user.login",
			"avatar_url":         "$user.avatar_url",
			"author_posts_found": 1,
			"author_posts_total": 1,
			"avg_author_time":    1,
			"found_tiers_total":  1,
			"found_tier0":        1,
			"found_tier1":        1,
			"found_tier2":        1,
			"found_tier3":        1,
			"found_tier4":        1,
			"avg_search_time":    1,
		}},
	}

	cursor, err := api.store.FtpUsers.Aggregate(r.Context(), pipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cursor.Close(r.Context())

	var docs []bson.M
	if err := cursor.All(r.Context(), &docs); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if len(docs) == 0 {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	doc := docs[0]

	// AuthorPostsNfound is counted off the posts below, as the authors list counts it
	result := userDetailResponse{
		Id:               intFromBson(doc["_id"]),
		Login:            strFromBson(doc["login"]),
		AvatarUrl:        strFromBson(doc["avatar_url"]),
		AuthorPostsFound: intFromBson(doc["author_posts_found"]),
		AuthorPostsTotal: intFromBson(doc["author_posts_total"]),
		AvgAuthorTime:    floatFromBson(doc["avg_author_time"]),
		FoundTiersTotal:  intFromBson(doc["found_tiers_total"]),
		FoundTier0:       intFromBson(doc["found_tier0"]),
		FoundTier1:       intFromBson(doc["found_tier1"]),
		FoundTier2:       intFromBson(doc["found_tier2"]),
		FoundTier3:       intFromBson(doc["found_tier3"]),
		FoundTier4:       intFromBson(doc["found_tier4"]),
		AvgSearchTime:    floatFromBson(doc["avg_search_time"]),
	}

	// Fetch posts created by this user
	authoredPipeline := bson.A{
		bson.M{"$match": bson.M{"user_id": id}},
	}
	if len(hiddenTagsBson) > 0 {
		authoredPipeline = append(authoredPipeline, bson.M{"$match": bson.M{"tags": bson.M{"$nin": hiddenTagsBson}}})
	}
	authoredPipeline = append(authoredPipeline,
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$ftp",
			"preserveNullAndEmptyArrays": true,
		}},
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
			"created":        1,
			"is_found":       "$ftp.is_found",
			"found_date":     "$ftp.found_date",
			"found_by_id":    "$ftp.found_by_id",
			"found_by":       "$finder.login",
			"longitude":      "$ftp.longitude",
			"latitude":       "$ftp.latitude",
			"tags":           1,
			"waiting":        waitingExpr,
		}},
		bson.M{"$sort": bson.M{"created": -1}},
	)

	authoredCursor, err := api.store.DirtyPosts.Aggregate(r.Context(), authoredPipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer authoredCursor.Close(r.Context())

	var authoredRaw []bson.M
	if err := authoredCursor.All(r.Context(), &authoredRaw); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch posts found by this user
	foundPipeline := bson.A{
		bson.M{"$match": bson.M{"found_by_id": id, "is_found": true}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "post",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$post",
			"preserveNullAndEmptyArrays": false,
		}},
	}
	if len(hiddenTagsBson) > 0 {
		foundPipeline = append(foundPipeline, bson.M{"$match": bson.M{"post.tags": bson.M{"$nin": hiddenTagsBson}}})
	}
	foundPipeline = append(foundPipeline,
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "post.user_id",
			"foreignField": "_id",
			"as":           "author",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$author",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          "$post.title",
			"main_image_url": "$post.main_image_url",
			"user_id":        "$post.user_id",
			"username":       "$author.login",
			"gender":         "$author.gender",
			"created":        "$post.created",
			"is_found":       1,
			"found_by_id":    1,
			"found_date":     1,
			"longitude":      1,
			"latitude":       1,
			"tags":           "$post.tags",
		}},
		bson.M{"$sort": bson.M{"found_date": -1}},
	)

	foundCursor, err := api.store.FtpPosts.Aggregate(r.Context(), foundPipeline)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer foundCursor.Close(r.Context())

	var foundRaw []bson.M
	if err := foundCursor.All(r.Context(), &foundRaw); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	posts := make([]userPostResponse, 0, len(authoredRaw)+len(foundRaw))

	now := time.Now()

	for _, p := range authoredRaw {
		postId := intFromBson(p["_id"])
		if hiddenPostsSet[postId] {
			continue
		}
		post := userPostResponse{
			Id:           postId,
			Title:        strFromBson(p["title"]),
			MainImageURL: strFromBson(p["main_image_url"]),
			UserID:       intFromBson(p["user_id"]),
			Username:     strFromBson(p["username"]),
			Gender:       strFromBson(p["gender"]),
			Role:         "author",
		}
		if v, ok := p["is_found"].(bool); ok {
			post.IsFound = v
		}
		post.Waiting, _ = p["waiting"].(bool)
		if post.Waiting {
			result.AuthorPostsNfound++
		}
		var createdTime time.Time
		if created, ok := p["created"].(primitive.DateTime); ok {
			createdTime = created.Time()
			post.CreatedDate = createdTime.UTC().Format(time.RFC3339)
			post.Tier = tierFromAge(now.Sub(createdTime).Seconds())
		}
		if fd, ok := p["found_date"].(primitive.DateTime); ok && !fd.Time().IsZero() {
			post.FoundDate = fd.Time().UTC().Format(time.RFC3339)
			if !createdTime.IsZero() {
				post.Tier = tierFromAge(fd.Time().Sub(createdTime).Seconds())
			}
		}
		post.Longitude = floatFromBson(p["longitude"])
		post.Latitude = floatFromBson(p["latitude"])
		post.FoundByID = intFromBson(p["found_by_id"])
		post.FoundBy = strFromBson(p["found_by"])
		if post.IsFound {
			post.CountryCode = countryCodeFromTags(p["tags"])
		}
		posts = append(posts, post)
	}

	for _, p := range foundRaw {
		postId := intFromBson(p["_id"])
		if hiddenPostsSet[postId] {
			continue
		}
		post := userPostResponse{
			Id:           postId,
			Title:        strFromBson(p["title"]),
			MainImageURL: strFromBson(p["main_image_url"]),
			UserID:       intFromBson(p["user_id"]),
			Username:     strFromBson(p["username"]),
			Gender:       strFromBson(p["gender"]),
			FoundByID:    intFromBson(p["found_by_id"]),
			Role:         "finder",
		}
		if v, ok := p["is_found"].(bool); ok {
			post.IsFound = v
		}
		var createdTime time.Time
		if created, ok := p["created"].(primitive.DateTime); ok {
			createdTime = created.Time()
			post.CreatedDate = createdTime.UTC().Format(time.RFC3339)
			post.Tier = tierFromAge(now.Sub(createdTime).Seconds())
		}
		if fd, ok := p["found_date"].(primitive.DateTime); ok && !fd.Time().IsZero() {
			post.FoundDate = fd.Time().UTC().Format(time.RFC3339)
			if !createdTime.IsZero() {
				post.Tier = tierFromAge(fd.Time().Sub(createdTime).Seconds())
			}
		}
		post.Longitude = floatFromBson(p["longitude"])
		post.Latitude = floatFromBson(p["latitude"])
		post.CountryCode = countryCodeFromTags(p["tags"])
		posts = append(posts, post)
	}

	result.Posts = posts

	setJsonHeader(w)
	json.NewEncoder(w).Encode(result)
}
