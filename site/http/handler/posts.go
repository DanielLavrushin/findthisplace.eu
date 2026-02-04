package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var tierBounds = []float64{
	6 * 30 * 24 * 3600,
	12 * 30 * 24 * 3600,
	2 * 365 * 24 * 3600,
	5 * 365 * 24 * 3600,
}

type notFoundPostResponse struct {
	Id           int     `json:"id"`
	Title        string  `json:"title"`
	MainImageURL string  `json:"main_image_url"`
	Username     string  `json:"username"`
	Gender       string  `json:"gender"`
	CreatedDate  string  `json:"created_date"`
	IsFound      bool    `json:"is_found"`
	Tier         int     `json:"tier"`
	Latitude     float64 `json:"latitude,omitempty"`
	Longitude    float64 `json:"longitude,omitempty"`
	FoundByID    int     `json:"found_by_id,omitempty"`
	FoundBy      string  `json:"found_by,omitempty"`
	FoundDate    string  `json:"found_date,omitempty"`
}

func (api *API) RegisterPostsApi() {
	api.mux.HandleFunc("GET /api/posts/not-found", api.handleNotFoundPosts)
	api.mux.HandleFunc("GET /api/posts/{id}", api.handleGetPost)
	api.mux.HandleFunc("GET /api/admin/problematic-posts", api.handleProblematicPosts)
	api.mux.HandleFunc("PATCH /api/admin/posts/{id}/edit", api.handleAdminPostEdit)
}

func (api *API) handleNotFoundPosts(w http.ResponseWriter, r *http.Request) {
	hiddenTags, _ := api.settings.GetHiddenTags(r.Context())

	pipeline := bson.A{
		bson.M{"$match": bson.M{"$or": bson.A{
			bson.M{"is_found": false},
			bson.M{"$and": bson.A{
				bson.M{"is_found": true},
				bson.M{"$or": bson.A{
					bson.M{"longitude": bson.M{"$exists": false}},
					bson.M{"latitude": bson.M{"$exists": false}},
					bson.M{"longitude": 0},
					bson.M{"latitude": 0},
				}},
			}},
		}}},
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
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "post.user_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          "$post.title",
			"main_image_url": "$post.main_image_url",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"created":        "$post.created",
			"is_found":       1,
		}},
		bson.M{"$sort": bson.M{"created": -1}},
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

	hidden, _ := api.settings.GetHiddenNotFoundPosts(r.Context())
	hiddenSet := make(map[int]bool, len(hidden))
	for _, id := range hidden {
		hiddenSet[id] = true
	}

	now := time.Now()
	results := make([]notFoundPostResponse, 0, len(raw))
	for _, doc := range raw {
		id := intFromBson(doc["_id"])
		if hiddenSet[id] {
			continue
		}
		resp := notFoundPostResponse{
			Id:           id,
			Title:        strFromBson(doc["title"]),
			MainImageURL: strFromBson(doc["main_image_url"]),
			Username:     strFromBson(doc["username"]),
			Gender:       strFromBson(doc["gender"]),
		}
		if v, ok := doc["is_found"].(bool); ok {
			resp.IsFound = v
		}
		if created, ok := doc["created"].(primitive.DateTime); ok {
			t := created.Time()
			resp.CreatedDate = t.UTC().Format(time.RFC3339)
			ageSec := now.Sub(t).Seconds()
			resp.Tier = tierFromAge(ageSec)
		}
		results = append(results, resp)
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func tierFromAge(ageSec float64) int {
	for i, bound := range tierBounds {
		if ageSec < bound {
			return i
		}
	}
	return len(tierBounds)
}

func (api *API) handleGetPost(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	pipeline := bson.A{
		bson.M{"$match": bson.M{"_id": id}},
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
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "post.user_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "found_by_id",
			"foreignField": "_id",
			"as":           "foundby",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$foundby",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          "$post.title",
			"main_image_url": "$post.main_image_url",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"created":        "$post.created",
			"is_found":       1,
			"latitude":       1,
			"longitude":      1,
			"found_by_id":    1,
			"found_by":       "$foundby.login",
			"found_date":     1,
		}},
	}

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

	if len(raw) == 0 {
		http.Error(w, "post not found", http.StatusNotFound)
		return
	}

	doc := raw[0]
	now := time.Now()
	resp := notFoundPostResponse{
		Id:           intFromBson(doc["_id"]),
		Title:        strFromBson(doc["title"]),
		MainImageURL: strFromBson(doc["main_image_url"]),
		Username:     strFromBson(doc["username"]),
		Gender:       strFromBson(doc["gender"]),
		Latitude:     floatFromBson(doc["latitude"]),
		Longitude:    floatFromBson(doc["longitude"]),
		FoundByID:    intFromBson(doc["found_by_id"]),
		FoundBy:      strFromBson(doc["found_by"]),
		FoundDate:    strFromBson(doc["found_date"]),
	}

	var foundDate time.Time
	if fd, ok := doc["found_date"].(primitive.DateTime); ok && !fd.Time().IsZero() {
		resp.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		if !foundDate.IsZero() {
			resp.Tier = tierFromAge(fd.Time().Sub(foundDate).Seconds())
		}
	}
	if v, ok := doc["is_found"].(bool); ok {
		resp.IsFound = v
	}
	if created, ok := doc["created"].(primitive.DateTime); ok {
		t := created.Time()
		resp.CreatedDate = t.UTC().Format(time.RFC3339)
		ageSec := now.Sub(t).Seconds()
		resp.Tier = tierFromAge(ageSec)
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(resp)
}

func (api *API) handleProblematicPosts(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}

	pipeline := bson.A{
		bson.M{"$match": bson.M{
			"is_found": true,
			"$or": bson.A{
				bson.M{"longitude": bson.M{"$exists": false}},
				bson.M{"latitude": bson.M{"$exists": false}},
				bson.M{"longitude": 0},
				bson.M{"latitude": 0},
			},
		}},
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
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "post.user_id",
			"foreignField": "_id",
			"as":           "user",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$user",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          "$post.title",
			"main_image_url": "$post.main_image_url",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"created":        "$post.created",
			"is_found":       1,
		}},
		bson.M{"$sort": bson.M{"created": -1}},
	}

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

	now := time.Now()
	results := make([]notFoundPostResponse, 0, len(raw))
	for _, doc := range raw {
		resp := notFoundPostResponse{
			Id:           intFromBson(doc["_id"]),
			Title:        strFromBson(doc["title"]),
			MainImageURL: strFromBson(doc["main_image_url"]),
			Username:     strFromBson(doc["username"]),
			Gender:       strFromBson(doc["gender"]),
			IsFound:      true,
		}
		if created, ok := doc["created"].(primitive.DateTime); ok {
			t := created.Time()
			resp.CreatedDate = t.UTC().Format(time.RFC3339)
			ageSec := now.Sub(t).Seconds()
			resp.Tier = tierFromAge(ageSec)
		}
		results = append(results, resp)
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

type adminPostEditRequest struct {
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	FoundByID *int     `json:"found_by_id,omitempty"`
	FoundDate *int64   `json:"found_date,omitempty"`
}

func (api *API) handleAdminPostEdit(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	var req adminPostEditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	update := bson.M{}
	if req.Latitude != nil && req.Longitude != nil {
		if *req.Latitude == 0 && *req.Longitude == 0 {
			http.Error(w, "coordinates cannot both be zero", http.StatusBadRequest)
			return
		}
		update["latitude"] = *req.Latitude
		update["longitude"] = *req.Longitude
	}
	if req.FoundByID != nil {
		update["found_by_id"] = *req.FoundByID
	}
	if req.FoundDate != nil {
		update["found_date"] = primitive.DateTime(*req.FoundDate * 1000)
	}

	if len(update) == 0 {
		http.Error(w, "no fields to update", http.StatusBadRequest)
		return
	}

	update["manual_override"] = true

	result, err := api.store.FtpPosts.UpdateOne(
		r.Context(),
		bson.M{"_id": id},
		bson.M{"$set": update},
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		http.Error(w, "post not found", http.StatusNotFound)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      id,
		"updated": update,
	})
}
