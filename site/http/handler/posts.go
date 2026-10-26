package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/findthisplace.eu/dirty"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var tierBounds = []float64{
	6 * 30 * 24 * 3600,
	12 * 30 * 24 * 3600,
	2 * 365 * 24 * 3600,
	5 * 365 * 24 * 3600,
}

// d3.ru tags a puzzle with it until someone finds the place
const notFoundTag = "не найдено"

// a puzzle settled without a precise find: no one's to find, nothing to fix
const conditionallyFoundTag = "условно найдено"

// why a post is on the admin's problematic list
const (
	reasonNoCoords      = "no_coords"       // found, but not on the map
	reasonNoPlaceTags   = "no_place_tags"   // found, but no country or town tag
	reasonStaleNotFound = "stale_not_found" // found, yet still tagged не найдено
	reasonNoStatusTag   = "no_status_tag"   // unfound, and not tagged не найдено
)

// waitingExpr is whether a dirty post, with its ftp_posts row unwound at
// "ftp", is a puzzle /not-found lists: tagged as not found, and not found or
// found with no place on the map. The pipeline drops the hidden posts itself.
// Not a missing tag alone: "условно найдено", posts that set no puzzle and
// posts gone from d3.ru are no one's to find.
var waitingExpr = bson.M{"$and": bson.A{
	bson.M{"$in": bson.A{notFoundTag, bson.M{"$ifNull": bson.A{"$tags", bson.A{}}}}},
	bson.M{"$or": bson.A{
		bson.M{"$eq": bson.A{"$ftp.is_found", false}},
		bson.M{"$and": bson.A{
			bson.M{"$eq": bson.A{"$ftp.is_found", true}},
			bson.M{"$or": bson.A{
				bson.M{"$eq": bson.A{bson.M{"$ifNull": bson.A{"$ftp.longitude", 0}}, 0}},
				bson.M{"$eq": bson.A{bson.M{"$ifNull": bson.A{"$ftp.latitude", 0}}, 0}},
			}},
		}},
	}},
}}

type notFoundPostResponse struct {
	Id           int     `json:"id"`
	Title        string  `json:"title"`
	MainImageURL string  `json:"main_image_url"`
	UserID       int     `json:"user_id,omitempty"`
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
	// only the admin endpoints fill these in
	Tags    []string `json:"tags,omitempty"`
	Reasons []string `json:"reasons,omitempty"`
}

func (api *API) RegisterPostsApi() {
	api.mux.HandleFunc("GET /api/posts/not-found", api.handleNotFoundPosts)
	api.mux.HandleFunc("GET /api/posts/{id}", api.handleGetPost)
	api.mux.HandleFunc("GET /api/admin/problematic-posts", api.handleProblematicPosts)
	api.mux.HandleFunc("PATCH /api/admin/posts/{id}/edit", api.handleAdminPostEdit)
}

func (api *API) handleNotFoundPosts(w http.ResponseWriter, r *http.Request) {
	hiddenTags, _ := api.settings.GetHiddenTags(r.Context())

	// waitingExpr as queries, the found and the place matched before the join;
	// keep the two saying the same
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
		bson.M{"$match": bson.M{"post.tags": notFoundTag}},
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
			"user_id":        "$post.user_id",
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
			UserID:       intFromBson(doc["user_id"]),
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
			"user_id":        "$post.user_id",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"created":        "$post.created",
			"is_found":       1,
			"latitude":       1,
			"longitude":      1,
			"found_by_id":    1,
			"found_by":       "$foundby.login",
			"found_date":     1,
			"tags":           "$post.tags",
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
		UserID:       intFromBson(doc["user_id"]),
		Username:     strFromBson(doc["username"]),
		Gender:       strFromBson(doc["gender"]),
		Latitude:     floatFromBson(doc["latitude"]),
		Longitude:    floatFromBson(doc["longitude"]),
		FoundByID:    intFromBson(doc["found_by_id"]),
		FoundBy:      strFromBson(doc["found_by"]),
		FoundDate:    strFromBson(doc["found_date"]),
		Tags:         strsFromBson(doc["tags"]),
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

	results, err := api.problematicPosts(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

// reasonIf is a one-reason array when cond holds, an empty one otherwise, for
// $concatArrays to collect.
func reasonIf(cond interface{}, reason string) bson.M {
	return bson.M{"$cond": bson.A{cond, bson.A{reason}, bson.A{}}}
}

// problematicPosts lists the posts an admin should look at, each with why.
func (api *API) problematicPosts(ctx context.Context) ([]notFoundPostResponse, error) {
	hiddenTags, _ := api.settings.GetHiddenTags(ctx)

	statusTags := make(bson.A, 0, len(dirty.StatusTags))
	for t := range dirty.StatusTags {
		statusTags = append(statusTags, t)
	}
	tags := bson.M{"$ifNull": bson.A{"$post.tags", bson.A{}}}
	found := bson.M{"$eq": bson.A{"$is_found", true}}
	notFound := bson.M{"$ne": bson.A{"$is_found", true}}
	noCoords := bson.M{"$or": bson.A{
		bson.M{"$eq": bson.A{bson.M{"$ifNull": bson.A{"$longitude", 0}}, 0}},
		bson.M{"$eq": bson.A{bson.M{"$ifNull": bson.A{"$latitude", 0}}, 0}},
	}}
	noPlaceTags := bson.M{"$eq": bson.A{0, bson.M{"$size": bson.M{"$filter": bson.M{
		"input": tags,
		"cond":  bson.M{"$not": bson.A{bson.M{"$in": bson.A{"$$this", statusTags}}}},
	}}}}}
	taggedNotFound := bson.M{"$in": bson.A{notFoundTag, tags}}
	taggedSettled := bson.M{"$or": bson.A{
		taggedNotFound,
		bson.M{"$in": bson.A{conditionallyFoundTag, tags}},
	}}

	pipeline := bson.A{
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
		bson.M{"$addFields": bson.M{"reasons": bson.M{"$concatArrays": bson.A{
			reasonIf(bson.M{"$and": bson.A{found, noCoords}}, reasonNoCoords),
			reasonIf(bson.M{"$and": bson.A{found, noPlaceTags}}, reasonNoPlaceTags),
			reasonIf(bson.M{"$and": bson.A{found, taggedNotFound}}, reasonStaleNotFound),
			reasonIf(bson.M{"$and": bson.A{notFound, bson.M{"$not": bson.A{taggedSettled}}}}, reasonNoStatusTag),
		}}}},
		bson.M{"$match": bson.M{"reasons.0": bson.M{"$exists": true}}},
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
			"user_id":        "$post.user_id",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"created":        "$post.created",
			"is_found":       1,
			"found_by_id":    1,
			"found_by":       "$foundby.login",
			"found_date":     1,
			"tags":           "$post.tags",
			"reasons":        1,
		}},
		bson.M{"$sort": bson.M{"created": -1}},
	)

	cursor, err := api.store.FtpPosts.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var raw []bson.M
	if err := cursor.All(ctx, &raw); err != nil {
		return nil, err
	}

	hidden, _ := api.settings.GetHiddenNotFoundPosts(ctx)
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
			UserID:       intFromBson(doc["user_id"]),
			Username:     strFromBson(doc["username"]),
			Gender:       strFromBson(doc["gender"]),
			IsFound:      boolFromBson(doc["is_found"]),
			FoundByID:    intFromBson(doc["found_by_id"]),
			FoundBy:      strFromBson(doc["found_by"]),
			Tags:         strsFromBson(doc["tags"]),
			Reasons:      strsFromBson(doc["reasons"]),
		}
		if fd, ok := doc["found_date"].(primitive.DateTime); ok && !fd.Time().IsZero() {
			resp.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		}
		if created, ok := doc["created"].(primitive.DateTime); ok {
			t := created.Time()
			resp.CreatedDate = t.UTC().Format(time.RFC3339)
			ageSec := now.Sub(t).Seconds()
			resp.Tier = tierFromAge(ageSec)
		}
		results = append(results, resp)
	}
	return results, nil
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

	var current bson.M
	if err := api.store.FtpPosts.FindOne(r.Context(), bson.M{"_id": id}).Decode(&current); err == nil {
		merged := bson.M{}
		for k, v := range current {
			merged[k] = v
		}
		for k, v := range update {
			merged[k] = v
		}
		lat := floatFromBson(merged["latitude"])
		lng := floatFromBson(merged["longitude"])
		foundByID := intFromBson(merged["found_by_id"])
		_, hasFoundDate := merged["found_date"]
		if lat != 0 && lng != 0 && foundByID != 0 && hasFoundDate {
			update["is_found"] = true
		}
	}

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
