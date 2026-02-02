package handler

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
)

//go:embed countries.json
var countriesJSON []byte

type countryInfo struct {
	Name string
	Code string
}

var countryLookup map[string]countryInfo

func init() {
	var raw map[string]string
	if err := json.Unmarshal(countriesJSON, &raw); err != nil {
		panic("handler: bad countries.json: " + err.Error())
	}
	countryLookup = make(map[string]countryInfo, len(raw))
	for code, name := range raw {
		countryLookup[strings.ToLower(name)] = countryInfo{Name: name, Code: code}
	}
}

type tagResponse struct {
	Country string `json:"country"`
	Code    string `json:"code"`
	Count   int    `json:"count"`
}

func (api *API) RegisterTagsApi() {
	api.mux.HandleFunc("GET /api/tags", api.handleTags)
}

func (api *API) handleTags(w http.ResponseWriter, r *http.Request) {
	pipeline := bson.A{
		bson.M{"$lookup": bson.M{
			"from":         "ftp_posts",
			"localField":   "_id",
			"foreignField": "_id",
			"as":           "ftp",
		}},
		bson.M{"$unwind": "$ftp"},
		bson.M{"$match": bson.M{"ftp.is_found": true}},
		bson.M{"$unwind": "$tags"},
		bson.M{"$group": bson.M{
			"_id":   "$tags",
			"count": bson.M{"$sum": 1},
		}},
		bson.M{"$sort": bson.M{"count": -1}},
	}

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
		tag := strFromBson(doc["_id"])
		key := strings.ToLower(tag)

		info, ok := countryLookup[key]
		if !ok {
			continue
		}
		results = append(results, tagResponse{
			Country: info.Name,
			Code:    strings.ToLower(info.Code),
			Count:   intFromBson(doc["count"]),
		})
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}
