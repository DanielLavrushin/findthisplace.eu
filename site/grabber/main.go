package grabber

import (
	"context"
	"flag"
	"log"

	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/ftp"
	"github.com/joho/godotenv"
)

var fullRun *bool = flag.Bool("full-run", false, "fetch every page instead of only the newest")
var skipLoad *bool = flag.Bool("skip-load", false, "skip loading the  api data from dirty.ru")

func main() {

	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("No .env file found, proceeding without it")
	}

	flag.Parse()

	ctx := context.Background()

	db, err := db.Connect(ctx, "findthisplace")
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}

	defer db.Client.Disconnect(ctx)

	if *skipLoad {
		log.Println("Skipping loading data from dirty.ru")
	} else {
		_, err := Run(ctx, fullRun, db)
		if err != nil {
			log.Fatalf("failed to run fetcher: %v", err)
		}
	}

	log.Println("Starting processing data")
	if err := ftp.Process(ctx, db); err != nil {
		log.Fatalf("failed to process data: %v", err)
	}
	log.Println("Processing completed successfully")

}
