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

func Process(ctx context.Context, store *db.DB, postIDs []int) error {
	topCommentByPost, err := loadTopComments(ctx, store, postIDs)
	if err != nil {
		return err
	}

	cur, err := store.DirtyPosts.Find(ctx, bson.M{"_id": bson.M{"$in": postIDs}}, options.Find().
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

		if fp.IsFound {
			if userId, ok := topCommentByPost[dp.Id]; ok {
				fp.FoundById = userId
			}
		}

		model := mongo.NewReplaceOneModel().
			SetFilter(bson.M{"_id": fp.Id, "manual_override": bson.M{"$ne": true}}).
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
	log.Println("ftp.Process: posts completed")

	if err := processComments(ctx, store, postIDs); err != nil {
		return err
	}

	log.Println("ftp.Process: completed")
	return cur.Err()
}

func processComments(ctx context.Context, store *db.DB, postIDs []int) error {
	// Load IDs of ftp_comments that already have coordinates extracted
	existing, err := loadExtractedCommentIDs(ctx, store, postIDs)
	if err != nil {
		return err
	}

	cur, err := store.DirtyComments.Find(ctx, bson.M{"post_id": bson.M{"$in": postIDs}},
		options.Find().SetBatchSize(500))
	if err != nil {
		return err
	}
	defer cur.Close(ctx)

	bulk := make([]mongo.WriteModel, 0, 500)
	for cur.Next(ctx) {
		var dc dirty.DirtyComment
		if err := cur.Decode(&dc); err != nil {
			return err
		}

		if existing[dc.Id] {
			continue
		}

		fc := &FtpComment{
			Id:     dc.Id,
			PostId: dc.PostId,
		}

		if c := ExtractCoords(dc.Text); c != nil {
			fc.Extracted = true
			fc.Latitude = c.Lat
			fc.Longitude = c.Lng
		}

		model := mongo.NewReplaceOneModel().
			SetFilter(bson.M{"_id": fc.Id}).
			SetReplacement(fc).
			SetUpsert(true)

		bulk = append(bulk, model)

		if len(bulk) == cap(bulk) {
			if err := writeCommentBulk(ctx, store, bulk); err != nil {
				return err
			}
			bulk = bulk[:0]
		}
	}
	if len(bulk) > 0 {
		if err := writeCommentBulk(ctx, store, bulk); err != nil {
			return err
		}
		log.Printf("Updated %d comments to the database", len(bulk))
	}
	return cur.Err()
}

func loadExtractedCommentIDs(ctx context.Context, store *db.DB, postIDs []int) (map[int]bool, error) {
	cur, err := store.FtpComments.Find(ctx,
		bson.M{"post_id": bson.M{"$in": postIDs}, "extracted": true},
		options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	result := make(map[int]bool)
	for cur.Next(ctx) {
		var row struct {
			Id int `bson:"_id"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		result[row.Id] = true
	}
	return result, cur.Err()
}

func writeCommentBulk(ctx context.Context, store *db.DB, ops []mongo.WriteModel) error {
	_, err := store.FtpComments.BulkWrite(ctx, ops, options.BulkWrite().SetOrdered(false))
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

func loadTopComments(ctx context.Context, store *db.DB, postIDs []int) (map[int]int, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"post_id": bson.M{"$in": postIDs}}}},
		{{Key: "$sort", Value: bson.D{{Key: "rating", Value: -1}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$post_id"},
			{Key: "user_id", Value: bson.M{"$first": "$user_id"}},
		}}},
	}

	cur, err := store.DirtyComments.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	result := make(map[int]int)
	for cur.Next(ctx) {
		var row struct {
			PostId int `bson:"_id"`
			UserId int `bson:"user_id"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		result[row.PostId] = row.UserId
	}
	return result, cur.Err()
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
