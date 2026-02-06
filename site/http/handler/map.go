package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type mapPostResponse struct {
	Id           int     `json:"id"`
	Title        string  `json:"title"`
	Longitude    float64 `json:"longitude"`
	Latitude     float64 `json:"latitude"`
	Username     string  `json:"username"`
	MainImageURL string  `json:"main_image_url"`
	FoundDate    string  `json:"found_date"`
	Tier         int     `json:"tier"`
}

func (api *API) RegisterMapApi() {
	api.mux.HandleFunc("GET /api/map/posts/{period}", api.handleMapPosts)
}

func (api *API) handleMapPosts(w http.ResponseWriter, r *http.Request) {
	period := r.PathValue("period")
	cutoff := periodToCutoff(period)

	pipeline := bson.A{
		bson.M{"$match": bson.M{
			"is_found":   true,
			"found_date": bson.M{"$gte": primitive.NewDateTimeFromTime(cutoff)},
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
			"longitude":      1,
			"latitude":       1,
			"username":       "$user.login",
			"main_image_url": "$post.main_image_url",
			"found_date":     1,
			"created":        "$post.created",
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

	results := make([]mapPostResponse, 0, len(raw))
	for _, doc := range raw {
		resp := mapPostResponse{
			Id:           intFromBson(doc["_id"]),
			Title:        strFromBson(doc["title"]),
			Longitude:    floatFromBson(doc["longitude"]),
			Latitude:     floatFromBson(doc["latitude"]),
			Username:     strFromBson(doc["username"]),
			MainImageURL: strFromBson(doc["main_image_url"]),
		}
		fd, fdOk := doc["found_date"].(primitive.DateTime)
		cd, cdOk := doc["created"].(primitive.DateTime)
		if fdOk {
			resp.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		}
		if fdOk && cdOk {
			ageSec := fd.Time().Sub(cd.Time()).Seconds()
			resp.Tier = tierFromAge(ageSec)
		}
		results = append(results, resp)
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func periodToCutoff(period string) time.Time {
	now := time.Now().UTC()
	switch period {
	case "7d":
		return now.AddDate(0, 0, -7)
	case "1y":
		return now.AddDate(-1, 0, 0)
	default:
		return now.AddDate(0, 0, -30)
	}
}

func intFromBson(v interface{}) int {
	switch n := v.(type) {
	case int32:
		return int(n)
	case int64:
		return int(n)
	case float64:
		return int(n)
	default:
		return 0
	}
}

func boolFromBson(v interface{}) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}

func strFromBson(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func floatFromBson(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int32:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}
