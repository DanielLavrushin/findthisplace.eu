package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/findthisplace.eu/config"
	"github.com/findthisplace.eu/db"
	ftphttp "github.com/findthisplace.eu/http"
	"github.com/findthisplace.eu/settings"
)

var port int

func main() {

	flag.IntVar(&port, "port", 8080, "HTTP server port")
	flag.Parse()

	ctx := context.Background()

	store, err := db.Connect(ctx, "findthisplace")
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer store.Client.Disconnect(ctx)

	sm := settings.NewManager(store.FtpSettings)

	cfg := &config.Config{
		Port: port,
	}

	srv, err := ftphttp.StartServer(cfg, sm)
	if err != nil {
		log.Fatalf("failed to start server: %v", err)
	}

	fmt.Printf("server listening on :%d\n", port)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}

	fmt.Println("server stopped")
}
