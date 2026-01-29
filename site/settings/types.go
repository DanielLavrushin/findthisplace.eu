package settings

import "go.mongodb.org/mongo-driver/mongo"

type Manager struct {
	coll *mongo.Collection
}

type Setting struct {
	Name  string      `bson:"name" json:"name"`
	Value interface{} `bson:"value" json:"value"`
}
