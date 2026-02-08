package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type authorResponse struct {
	Id                int     `json:"id"`
	Login             string  `json:"login"`
	AvatarUrl         string  `json:"avatar_url,omitempty"`
	AuthorPostsFound  int     `json:"author_posts_found"`
	AuthorPostsTotal  int     `json:"author_posts_total"`
	AuthorPostsNfound int     `json:"author_posts_nfound"`
	AvgAuthorTime     float64 `json:"avg_author_time"`
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

// countryCodeFromTags extracts the country code from a tags array by matching against countryLookup
func countryCodeFromTags(tags interface{}) string {
	arr, ok := tags.(primitive.A)
	if !ok {
		return ""
	}
	for _, t := range arr {
		if tag, ok := t.(string); ok {
			if info, found := countryLookup[strings.ToLower(tag)]; found {
				return strings.ToLower(info.Code)
			}
		}
	}
	return ""
}

func (api *API) RegisterUsersApi() {
	api.mux.HandleFunc("GET /api/users/searchers", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/searchers/{limit}", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/authors", api.handleAuthors)
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

	hiddenTags, _ := api.settings.GetHiddenTags(r.Context())

	// Build pipeline to compute author stats dynamically, filtering hidden tags
	pipeline := bson.A{
		bson.M{"$match": bson.M{"user_id": bson.M{"$exists": true, "$ne": 0}}},
	}

	if len(hiddenTags) > 0 {
		tagsBson := make(bson.A, len(hiddenTags))
		for i, t := range hiddenTags {
			tagsBson[i] = t
		}
		pipeline = append(pipeline, bson.M{"$match": bson.M{"tags": bson.M{"$nin": tagsBson}}})
	}

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
			"avg_author_time":    bson.M{"$avg": "$author_time"},
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
			"_id":                1,
			"login":              "$user.login",
			"avatar_url":         "$user.avatar_url",
			"author_posts_found": 1,
			"author_posts_total": 1,
			"avg_author_time":    1,
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
		found := intFromBson(doc["author_posts_found"])
		total := intFromBson(doc["author_posts_total"])
		results = append(results, authorResponse{
			Id:                intFromBson(doc["_id"]),
			Login:             strFromBson(doc["login"]),
			AvatarUrl:         strFromBson(doc["avatar_url"]),
			AuthorPostsFound:  found,
			AuthorPostsTotal:  total,
			AuthorPostsNfound: total - found,
			AvgAuthorTime:     floatFromBson(doc["avg_author_time"]),
		})
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func (api *API) handleUserDetail(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid user id", http.StatusBadRequest)
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
	authorFound := intFromBson(doc["author_posts_found"])
	authorTotal := intFromBson(doc["author_posts_total"])

	result := userDetailResponse{
		Id:                intFromBson(doc["_id"]),
		Login:             strFromBson(doc["login"]),
		AvatarUrl:         strFromBson(doc["avatar_url"]),
		AuthorPostsFound:  authorFound,
		AuthorPostsTotal:  authorTotal,
		AuthorPostsNfound: authorTotal - authorFound,
		AvgAuthorTime:     floatFromBson(doc["avg_author_time"]),
		FoundTiersTotal:   intFromBson(doc["found_tiers_total"]),
		FoundTier0:        intFromBson(doc["found_tier0"]),
		FoundTier1:        intFromBson(doc["found_tier1"]),
		FoundTier2:        intFromBson(doc["found_tier2"]),
		FoundTier3:        intFromBson(doc["found_tier3"]),
		FoundTier4:        intFromBson(doc["found_tier4"]),
		AvgSearchTime:     floatFromBson(doc["avg_search_time"]),
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
