package main

import (
	"context"
	"flag"
	"log"
)

var fullRun *bool = flag.Bool("full-run", false, "fetch every page instead of only the newest")

func main() {

	flag.Parse()

	log.Printf("Starting Dirty API fetcher...")
	result, err := Run(context.Background(), fullRun)
	if err != nil {
		log.Fatalf("failed to run fetcher: %v", err)
	}

	log.Printf("Fetched %d posts, %d comments, and %d users", len(result.Posts), len(result.Comments), len(result.Users))
}
