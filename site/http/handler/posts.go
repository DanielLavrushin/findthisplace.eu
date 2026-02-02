package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var tierBounds = []float64{
	6 * 30 * 24 * 3600,  // tier0: < 6 months
	12 * 30 * 24 * 3600, // tier1: 6 months – 1 year
	2 * 365 * 24 * 3600, // tier2: 1 – 2 years
	5 * 365 * 24 * 3600, // tier3: 2 – 5 years
}

type notFoundPostResponse struct {
	Id           int    `json:"id"`
	Title        string `json:"title"`
	MainImageURL string `json:"main_image_url"`
	Username     string `json:"username"`
	Gender       string `json:"gender"`
	CreatedDate  string `json:"created_date"`
	IsFound      bool   `json:"is_found"`
	Tier         int    `json:"tier"`
}

func (api *API) RegisterPostsApi() {
	api.mux.HandleFunc("GET /api/posts/not-found", api.handleNotFoundPosts)
}

func (api *API) handleNotFoundPosts(w http.ResponseWriter, r *http.Request) {
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
