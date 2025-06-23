package main

import (
	"context"
	"flag"
	"log"

	"github.com/findthisplace.eu/grabber/db"
)

var fullRun *bool = flag.Bool("full-run", false, "fetch every page instead of only the newest")

func main() {

	flag.Parse()
	ctx := context.Background()

	result, err := Run(ctx, fullRun)
	if err != nil {
		log.Fatalf("failed to run fetcher: %v", err)
	}

	db, err := db.Connect(ctx,
		"mongodb://grabber_admin:superSecret123@localhost:27017",
		"findthisplace.eu",
	)

	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer db.Client.Disconnect(ctx)

	if err := db.Save(ctx, result.Posts, result.Comments, result.Users); err != nil {
		log.Fatalf("mongo save: %v", err)
	}
}
