package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// mapPostResponse carries everything the post card needs, so a marker can
// open onto the same collectible card as the post grids.
type mapPostResponse struct {
	Id           int     `json:"id"`
	Title        string  `json:"title"`
	Longitude    float64 `json:"longitude"`
	Latitude     float64 `json:"latitude"`
	UserID       int     `json:"user_id,omitempty"`
	Username     string  `json:"username"`
	Gender       string  `json:"gender"`
	MainImageURL string  `json:"main_image_url"`
	CreatedDate  string  `json:"created_date"`
	IsFound      bool    `json:"is_found"`
	FoundDate    string  `json:"found_date"`
	FoundByID    int     `json:"found_by_id,omitempty"`
	FoundBy      string  `json:"found_by,omitempty"`
	Tier         int     `json:"tier"`
	CountryCode  string  `json:"country_code,omitempty"`
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
		bson.M{"$lookup": bson.M{
			"from":         "dirty_users",
			"localField":   "found_by_id",
			"foreignField": "_id",
			"as":           "finder",
		}},
		bson.M{"$unwind": bson.M{
			"path":                       "$finder",
			"preserveNullAndEmptyArrays": true,
		}},
		bson.M{"$project": bson.M{
			"_id":            1,
			"title":          "$post.title",
			"longitude":      1,
			"latitude":       1,
			"user_id":        "$post.user_id",
			"username":       "$user.login",
			"gender":         "$user.gender",
			"main_image_url": "$post.main_image_url",
			"is_found":       1,
			"found_date":     1,
			"found_by_id":    1,
			"found_by":       "$finder.login",
			"created":        "$post.created",
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

	results := make([]mapPostResponse, 0, len(raw))
	for _, doc := range raw {
		resp := mapPostResponse{
			Id:           intFromBson(doc["_id"]),
			Title:        strFromBson(doc["title"]),
			Longitude:    floatFromBson(doc["longitude"]),
			Latitude:     floatFromBson(doc["latitude"]),
			UserID:       intFromBson(doc["user_id"]),
			Username:     strFromBson(doc["username"]),
			Gender:       strFromBson(doc["gender"]),
			MainImageURL: strFromBson(doc["main_image_url"]),
			IsFound:      boolFromBson(doc["is_found"]),
			FoundByID:    intFromBson(doc["found_by_id"]),
			FoundBy:      strFromBson(doc["found_by"]),
			CountryCode:  countryCodeFromTags(doc["tags"]),
		}
		fd, fdOk := doc["found_date"].(primitive.DateTime)
		cd, cdOk := doc["created"].(primitive.DateTime)
		if fdOk {
			resp.FoundDate = fd.Time().UTC().Format(time.RFC3339)
		}
		if cdOk {
			resp.CreatedDate = cd.Time().UTC().Format(time.RFC3339)
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
	case int:
		return n
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

func strsFromBson(v interface{}) []string {
	arr, ok := v.(primitive.A)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func floatFromBson(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case int32:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}
