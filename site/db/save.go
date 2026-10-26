package db

import (
	"context"
	"fmt"
	"log"

	"github.com/findthisplace.eu/dirty"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func (db *DB) Save(ctx context.Context, posts []dirty.DirtyPost, comments []dirty.DirtyComment, users map[int]*dirty.DirtyUser) error {
	log.Printf("Mongo: saving %d posts, %d comments, %d users", len(posts), len(comments), len(users))

	if err := db.upsertUsers(ctx, users); err != nil {
		return err
	}
	if err := db.keepKnownTags(ctx, posts); err != nil {
		return err
	}
	if err := db.upsertMany(ctx, db.DirtyPosts, anySlice(posts)); err != nil {
		return err
	}
	if err := db.upsertMany(ctx, db.DirtyComments, anySlice(comments)); err != nil {
		return err
	}
	log.Printf("Mongo: wrote %d posts, %d comments, %d users",
		len(posts), len(comments), len(users))
	return nil
}

func (db *DB) upsertUsers(ctx context.Context, users map[int]*dirty.DirtyUser) error {
	if len(users) == 0 {
		return nil
	}

	models := make([]mongo.WriteModel, 0, len(users))
	for _, u := range users {
		filter := bson.M{"_id": u.Id}
		update := bson.M{"$set": u}
		models = append(models,
			mongo.NewUpdateOneModel().
				SetFilter(filter).
				SetUpdate(update).
				SetUpsert(true))
	}
	_, err := db.DirtyUsers.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	return err
}

// keepKnownTags gives posts that d3 serves without tags the tags already stored
// for them. Moderators only ever swap tags (не найдено for a country and town once
// found, a corrected town), but d3 dropped every tag of a restored account's posts
// once, and mirroring that wiped them here too. A found post whose не найдено was
// removed with no place added doesn't get its status tags back.
func (db *DB) keepKnownTags(ctx context.Context, posts []dirty.DirtyPost) error {
	untagged := make(map[int]int)
	ids := make([]int, 0)
	for i, p := range posts {
		if len(p.Tags) == 0 {
			untagged[p.Id] = i
			ids = append(ids, p.Id)
		}
	}
	if len(ids) == 0 {
		return nil
	}

	cur, err := db.DirtyPosts.Find(ctx,
		bson.M{"_id": bson.M{"$in": ids}, "tags.0": bson.M{"$exists": true}},
		options.Find().SetProjection(bson.M{"tags": 1}))
	if err != nil {
		return err
	}
	var stored []struct {
		Id   int      `bson:"_id"`
		Tags []string `bson:"tags"`
	}
	if err := cur.All(ctx, &stored); err != nil {
		return err
	}
	for _, s := range stored {
		p := &posts[untagged[s.Id]]
		for _, t := range s.Tags {
			if !p.IsFound() || !dirty.StatusTags[t] {
				p.Tags = append(p.Tags, t)
			}
		}
	}
	return nil
}

func (db *DB) upsertMany(ctx context.Context, coll *mongo.Collection, docs []interface{}) error {
	models := make([]mongo.WriteModel, len(docs))

	for i, v := range docs {
		bs, err := bson.Marshal(v)
		if err != nil {
			return err
		}
		var m bson.M
		if err := bson.Unmarshal(bs, &m); err != nil {
			return err
		}
		id, ok := m["_id"]
		if !ok {
			return fmt.Errorf("document missing _id field")
		}

		models[i] = mongo.NewReplaceOneModel().SetFilter(bson.M{"_id": id}).SetReplacement(v).SetUpsert(true)
	}

	_, err := coll.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	return err
}

func anySlice[T any](in []T) []interface{} {
	out := make([]interface{}, len(in))
	for i, v := range in {
		out[i] = v
	}
	return out
}
