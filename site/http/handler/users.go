package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
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
	Username     string  `json:"username"`
	Gender       string  `json:"gender"`
	CreatedDate  string  `json:"created_date"`
	IsFound      bool    `json:"is_found"`
	FoundDate    string  `json:"found_date,omitempty"`
	Longitude    float64 `json:"longitude,omitempty"`
	Latitude     float64 `json:"latitude,omitempty"`
	Tier         int     `json:"tier"`
	Role         string  `json:"role"`
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

	pipeline := bson.A{
		bson.M{"$match": bson.M{
			"found_tiers_total": bson.M{"$gt": 0},
		}},
		bson.M{"$sort": bson.M{"found_tiers_total": -1}},
	}

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

	cursor, err := api.store.FtpUsers.Aggregate(r.Context(), pipeline)
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

	pipeline := bson.A{
		bson.M{"$match": bson.M{
			"author_posts_total": bson.M{"$gt": 0},
		}},
		bson.M{"$sort": bson.M{"author_posts_total": -1}},
	}

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

	cursor, err := api.store.FtpUsers.Aggregate(r.Context(), pipeline)
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
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          1,
			"main_image_url": 1,
			"username":       "$author.login",
			"gender":         "$author.gender",
			"created":        1,
			"is_found":       "$ftp.is_found",
			"found_date":     "$ftp.found_date",
			"longitude":      "$ftp.longitude",
			"latitude":       "$ftp.latitude",
		}},
		bson.M{"$sort": bson.M{"created": -1}},
	}

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
			"preserveNullAndEmptyArrays": true,
		}},
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
			"username":       "$author.login",
			"gender":         "$author.gender",
			"created":        "$post.created",
			"is_found":       1,
			"found_date":     1,
			"longitude":      1,
			"latitude":       1,
		}},
		bson.M{"$sort": bson.M{"found_date": -1}},
	}

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
		post := userPostResponse{
			Id:           intFromBson(p["_id"]),
			Title:        strFromBson(p["title"]),
			MainImageURL: strFromBson(p["main_image_url"]),
			Username:     strFromBson(p["username"]),
			Gender:       strFromBson(p["gender"]),
			Role:         "author",
		}
		if v, ok := p["is_found"].(bool); ok {
			post.IsFound = v
		}
		if created, ok := p["created"].(primitive.DateTime); ok {
			t := created.Time()
			post.CreatedDate = t.UTC().Format(time.RFC3339)
			post.Tier = tierFromAge(now.Sub(t).Seconds())
		}
		if fd, ok := p["found_date"].(primitive.DateTime); ok && !fd.Time().IsZero() {
			post.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		}
		post.Longitude = floatFromBson(p["longitude"])
		post.Latitude = floatFromBson(p["latitude"])
		posts = append(posts, post)
	}

	for _, p := range foundRaw {
		post := userPostResponse{
			Id:           intFromBson(p["_id"]),
			Title:        strFromBson(p["title"]),
			MainImageURL: strFromBson(p["main_image_url"]),
			Username:     strFromBson(p["username"]),
			Gender:       strFromBson(p["gender"]),
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
		posts = append(posts, post)
	}

	result.Posts = posts

	setJsonHeader(w)
	json.NewEncoder(w).Encode(result)
}
