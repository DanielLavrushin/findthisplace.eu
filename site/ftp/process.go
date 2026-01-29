package ftp

import (
	"context"
	"log"
	"regexp"

	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/dirty"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var foundTag = regexp.MustCompile(`(?i)\[НАЙДЕНО]`)

func Process(ctx context.Context, store *db.DB) error {
	cur, err := store.DirtyPosts.Find(ctx, bson.M{}, options.Find().
		SetBatchSize(500))
	if err != nil {
		return err
	}
	defer cur.Close(ctx)

	bulk := make([]mongo.WriteModel, 0, 500)
	for cur.Next(ctx) {

		var dp dirty.DirtyPost
		if err := cur.Decode(&dp); err != nil {
			return err
		}

		fp := &FtpPost{
			Id:      dp.Id,
			IsFound: foundTag.MatchString(dp.Text),
		}

		model := mongo.NewReplaceOneModel().
			SetFilter(bson.M{"_id": fp.Id, "is_found": bson.M{"$ne": true}}).
			SetReplacement(fp).
			SetUpsert(true)

		bulk = append(bulk, model)

		if len(bulk) == cap(bulk) {
			if err := writeBulk(ctx, store, bulk); err != nil {
				return err
			}
			bulk = bulk[:0]
		}
	}
	if len(bulk) > 0 {
		if err := writeBulk(ctx, store, bulk); err != nil {
			return err
		}
		log.Printf("Updated %d posts to the database", len(bulk))
	}
	log.Println("ftp.Process: completed")
	return cur.Err()
}

func writeBulk(ctx context.Context, store *db.DB, ops []mongo.WriteModel) error {
	coll := store.Client.Database(store.FtpPosts.Database().Name()).
		Collection("ftp_posts")

	_, err := coll.BulkWrite(ctx, ops, options.BulkWrite().SetOrdered(false))
	if bwe, ok := err.(mongo.BulkWriteException); ok {
		for _, we := range bwe.WriteErrors {
			if we.Code != 11000 {
				return err
			}
		}
		return nil
	}
	return err
}
