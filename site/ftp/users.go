package ftp

import (
	"context"
	"log"
	"time"

	"github.com/findthisplace.eu/db"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// tier boundaries in seconds
var tierBounds = []float64{
	(6 * 30 * 24 * 3600),          // tier0: < 6 months
	(12 * 30 * 24 * 3600),         // tier1: 6 months – 1 year
	(2 * 365 * 24 * 3600),         // tier2: 1 – 2 years
	(5 * 365 * 24 * 3600),         // tier3: 2 – 5 years
}

func processUsers(ctx context.Context, store *db.DB) error {
	users, err := loadAllUserIDs(ctx, store)
	if err != nil {
		return err
	}
	log.Printf("ftp.processUsers: loaded %d users from dirty_users", len(users))

	if err := calcAuthorStats(ctx, store, users); err != nil {
		return err
	}
	if err := calcFinderStats(ctx, store, users); err != nil {
		return err
	}

	if len(users) == 0 {
		return nil
	}

	models := make([]mongo.WriteModel, 0, len(users))
	for _, u := range users {
		models = append(models,
			mongo.NewReplaceOneModel().
				SetFilter(bson.M{"_id": u.Id}).
				SetReplacement(u).
				SetUpsert(true))
	}

	_, err = store.FtpUsers.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	if err != nil {
		return err
	}

	log.Printf("ftp.processUsers: updated %d users", len(users))
	return nil
}

// loadAllUserIDs seeds the users map with every user from dirty_users.
func loadAllUserIDs(ctx context.Context, store *db.DB) (map[int]*FtpUser, error) {
	cur, err := store.DirtyUsers.Find(ctx, bson.M{},
		options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	users := make(map[int]*FtpUser)
	for cur.Next(ctx) {
		var row struct {
			Id int `bson:"_id"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		users[row.Id] = &FtpUser{Id: row.Id}
	}
	return users, cur.Err()
}

func getOrCreate(users map[int]*FtpUser, id int) *FtpUser {
	if u, ok := users[id]; ok {
		return u
	}
	u := &FtpUser{Id: id}
	users[id] = u
	return u
}

// calcAuthorStats computes per-author totals and average time-to-find.
// Joins dirty_posts with ftp_posts to get found status and found_date.
func calcAuthorStats(ctx context.Context, store *db.DB, users map[int]*FtpUser) error {
	pipeline := mongo.Pipeline{
		// join with ftp_posts to get is_found and found_date
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "ftp_posts"},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "ftp"},
		}}},
		{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$ftp"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$user_id"},
			{Key: "total", Value: bson.M{"$sum": 1}},
			{Key: "found", Value: bson.M{"$sum": bson.M{
				"$cond": bson.A{
					bson.M{"$ifNull": bson.A{"$ftp.is_found", false}},
					1, 0,
				},
			}}},
			{Key: "avg_author_time", Value: bson.M{"$avg": bson.M{
				"$cond": bson.A{
					bson.M{"$and": bson.A{
						bson.M{"$ifNull": bson.A{"$ftp.is_found", false}},
						bson.M{"$gt": bson.A{"$ftp.found_date", nil}},
					}},
					bson.M{"$divide": bson.A{
						bson.M{"$subtract": bson.A{"$ftp.found_date", "$created"}},
						1000, // ms to seconds
					}},
					"$$REMOVE",
				},
			}}},
		}}},
	}

	cur, err := store.DirtyPosts.Aggregate(ctx, pipeline)
	if err != nil {
		return err
	}
	defer cur.Close(ctx)

	for cur.Next(ctx) {
		var row struct {
			UserId       int      `bson:"_id"`
			Total        int      `bson:"total"`
			Found        int      `bson:"found"`
			AvgAuthorTime *float64 `bson:"avg_author_time"`
		}
		if err := cur.Decode(&row); err != nil {
			return err
		}
		u := getOrCreate(users, row.UserId)
		u.AuthorPostsTotal = row.Total
		u.AuthorPostsFound = row.Found
		if row.AvgAuthorTime != nil {
			u.AvgAuthorTime = *row.AvgAuthorTime
		}
	}
	return cur.Err()
}

// calcFinderStats computes per-finder tier counts and average search time.
// Uses ftp_posts joined with dirty_posts to get creation time for tier calculation.
func calcFinderStats(ctx context.Context, store *db.DB, users map[int]*FtpUser) error {
	pipeline := mongo.Pipeline{
		// only found posts with a finder
		{{Key: "$match", Value: bson.M{
			"is_found":    true,
			"found_by_id": bson.M{"$gt": 0},
			"found_date":  bson.M{"$ne": nil},
		}}},
		// join with dirty_posts to get created date
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "dirty_posts"},
			{Key: "localField", Value: "_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "dp"},
		}}},
		{{Key: "$unwind", Value: "$dp"}},
		// compute search_time in seconds
		{{Key: "$addFields", Value: bson.M{
			"search_time": bson.M{"$divide": bson.A{
				bson.M{"$subtract": bson.A{"$found_date", "$dp.created"}},
				1000,
			}},
		}}},
	}

	cur, err := store.FtpPosts.Aggregate(ctx, pipeline)
	if err != nil {
		return err
	}
	defer cur.Close(ctx)

	type finderAcc struct {
		totalTime float64
		count     int
		tiers     [5]int
	}
	accs := make(map[int]*finderAcc)

	for cur.Next(ctx) {
		var row struct {
			FoundById  int       `bson:"found_by_id"`
			FoundDate  time.Time `bson:"found_date"`
			SearchTime float64   `bson:"search_time"`
			Dp         struct {
				Created time.Time `bson:"created"`
			} `bson:"dp"`
		}
		if err := cur.Decode(&row); err != nil {
			return err
		}

		acc, ok := accs[row.FoundById]
		if !ok {
			acc = &finderAcc{}
			accs[row.FoundById] = acc
		}

		acc.count++
		acc.totalTime += row.SearchTime

		// determine tier based on search time (creation to found)
		tier := tierFromAge(row.SearchTime)
		acc.tiers[tier]++
	}
	if err := cur.Err(); err != nil {
		return err
	}

	for uid, acc := range accs {
		u := getOrCreate(users, uid)
		u.FoundTiersTotal = acc.count
		u.FoundTier0 = acc.tiers[0]
		u.FoundTier1 = acc.tiers[1]
		u.FoundTier2 = acc.tiers[2]
		u.FoundTier3 = acc.tiers[3]
		u.FoundTier4 = acc.tiers[4]
		if acc.count > 0 {
			u.AvgSearchTime = acc.totalTime / float64(acc.count)
		}
	}
	return nil
}

func tierFromAge(ageSeconds float64) int {
	for i, bound := range tierBounds {
		if ageSeconds < bound {
			return i
		}
	}
	return 4
}
