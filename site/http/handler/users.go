package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"go.mongodb.org/mongo-driver/bson"
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

func (api *API) RegisterUsersApi() {
	api.mux.HandleFunc("GET /api/users/searchers", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/searchers/{limit}", api.handleSearchers)
	api.mux.HandleFunc("GET /api/users/authors", api.handleAuthors)
	api.mux.HandleFunc("GET /api/users/authors/{limit}", api.handleAuthors)
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
