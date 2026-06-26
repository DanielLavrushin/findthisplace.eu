package grabber

import (
	"context"
	"log"
	"time"

	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/ftp"
	"github.com/findthisplace.eu/settings"
)

const checkInterval = 5 * time.Minute
const runThreshold = 2 * time.Hour

const fullRunThreshold = 24 * time.Hour

func StartBackground(ctx context.Context, store *db.DB, sm *settings.Manager) {
	go func() {
		log.Println("[grabber] background scheduler started")

		runIfNeeded(ctx, store, sm)

		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[grabber] background scheduler stopped")
				return
			case <-ticker.C:
				runIfNeeded(ctx, store, sm)
			}
		}
	}()
}

func runIfNeeded(ctx context.Context, store *db.DB, sm *settings.Manager) {
	fullRun := fullBackfillDue(ctx, sm)

	if !fullRun && incrementalThrottled(ctx, sm) {
		return
	}

	if fullRun {
		log.Println("[grabber] starting full backfill run")
		if err := sm.SetLastFullGrabberTime(ctx, time.Now()); err != nil {
			log.Printf("[grabber] failed to set last_full_grabber_time: %v", err)
		}
	} else {
		log.Println("[grabber] starting incremental run")
	}

	result, err := Run(ctx, &fullRun, store)
	if err != nil {
		log.Printf("[grabber] run failed: %v", err)
		setStatus(ctx, sm, "fail")
		return
	}

	postIDs := make([]int, len(result.Posts))
	for i, p := range result.Posts {
		postIDs[i] = p.Id
	}

	log.Println("[grabber] starting ftp processing")
	if err := ftp.Process(ctx, store, postIDs); err != nil {
		log.Printf("[grabber] ftp processing failed: %v", err)
		setStatus(ctx, sm, "fail")
		return
	}

	log.Println("[grabber] run completed successfully")
	setStatus(ctx, sm, "success")
}

func fullBackfillDue(ctx context.Context, sm *settings.Manager) bool {
	lastFull, err := sm.GetLastFullGrabberTime(ctx)
	if err != nil {
		log.Printf("[grabber] last_full_grabber_time unavailable (%v), full backfill due", err)
		return true
	}
	if d := time.Since(lastFull); d >= fullRunThreshold {
		log.Printf("[grabber] last full backfill was %s ago, due", d.Round(time.Second))
		return true
	}
	return false
}

func incrementalThrottled(ctx context.Context, sm *settings.Manager) bool {
	lastTime, err := sm.GetLastGrabberTime(ctx)
	if err != nil {
		log.Printf("[grabber] could not read last_grabber_time: %v, will run", err)
		return false
	}
	if d := time.Since(lastTime); d < runThreshold {
		log.Printf("[grabber] last run was %s ago, skipping", d.Round(time.Second))
		return true
	}
	return false
}

func setStatus(ctx context.Context, sm *settings.Manager, status string) {
	if err := sm.SetLastGrabberTime(ctx, time.Now()); err != nil {
		log.Printf("[grabber] failed to set last_grabber_time: %v", err)
	}
	if err := sm.SetLastGrabberStatus(ctx, status); err != nil {
		log.Printf("[grabber] failed to set last_grabber_status: %v", err)
	}
}
