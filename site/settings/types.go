package settings

import "go.mongodb.org/mongo-driver/mongo"

const (
	LastGrabberTime   = "last_grabber_time"
	LastGrabberStatus = "last_grabber_status"

	HiddenNotFoundPosts = "hidden_not_found_posts"
)

type Manager struct {
	coll *mongo.Collection
}

type Setting struct {
	Name  string      `bson:"_id" json:"name"`
	Value interface{} `bson:"value" json:"value"`
}
