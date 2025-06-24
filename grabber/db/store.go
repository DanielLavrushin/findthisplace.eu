package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	Client        *mongo.Client
	DirtyPosts    *mongo.Collection
	DirtyComments *mongo.Collection
	DirtyUsers    *mongo.Collection
	FtpPosts      *mongo.Collection
	FtpComments   *mongo.Collection
	FtpUsers      *mongo.Collection
}

func Connect(ctx context.Context, dbName string) (*DB, error) {

	uri := fmt.Sprintf("mongodb://%s:%s@%s:%s",
		os.Getenv("FTP_DB_USERNAME"),
		os.Getenv("FTP_DB_PASSWORD"),
		os.Getenv("FTP_DB_ADDRESS"),
		os.Getenv("FTP_DB_PORT"))

	log.Printf("Connecting to MongoDB database %s", dbName)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	cl, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	db := cl.Database(dbName)
	return &DB{
		Client:        cl,
		DirtyPosts:    db.Collection("dirty_posts"),
		DirtyComments: db.Collection("dirty_comments"),
		DirtyUsers:    db.Collection("dirty_users"),
		FtpPosts:      db.Collection("ftp_posts"),
		FtpComments:   db.Collection("ftp_comments"),
		FtpUsers:      db.Collection("ftp_users"),
	}, nil
}
