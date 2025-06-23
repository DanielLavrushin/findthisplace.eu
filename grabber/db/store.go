package db

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	Client   *mongo.Client
	Posts    *mongo.Collection
	Comments *mongo.Collection
	Users    *mongo.Collection
}

func Connect(ctx context.Context, uri, dbName string) (*DB, error) {

	log.Printf("Connecting to MongoDB at %s, database %s", uri, dbName)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	cl, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	db := cl.Database(dbName)
	return &DB{
		Client:   cl,
		Posts:    db.Collection("dirty_posts"),
		Comments: db.Collection("dirty_comments"),
		Users:    db.Collection("dirty_users"),
	}, nil
}
