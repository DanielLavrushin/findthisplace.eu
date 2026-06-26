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

// fullRunThreshold controls how often we re-scan the entire post archive
// (ApiPostsFullEndpoint) rather than just the latest feed. Old posts that get
// marked [НАЙДЕНО] or gain a geo comment after they drop off the latest feed are
// only picked up by these full backfill runs.
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
	lastTime, err := sm.GetLastGrabberTime(ctx)
	if err != nil {
		log.Printf("[grabber] could not read last_grabber_time: %v, will run", err)
	} else if time.Since(lastTime) < runThreshold {
		log.Printf("[grabber] last run was %s ago, skipping", time.Since(lastTime).Round(time.Second))
		return
	}

	// Periodically re-scan the whole archive so old posts that only later get
	// marked [НАЙДЕНО] or gain a geo comment are picked up; otherwise we only
	// ever process the latest feed. On failure last_full stays unset, so the
	// backfill is retried on the next eligible run rather than every 24h.
	fullRun := false
	if lastFull, err := sm.GetLastFullGrabberTime(ctx); err != nil {
		log.Printf("[grabber] could not read last_full_grabber_time: %v, will run full backfill", err)
		fullRun = true
	} else if time.Since(lastFull) >= fullRunThreshold {
		log.Printf("[grabber] last full backfill was %s ago, running full backfill", time.Since(lastFull).Round(time.Second))
		fullRun = true
	}

	if fullRun {
		log.Println("[grabber] starting full backfill run")
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
	if fullRun {
		if err := sm.SetLastFullGrabberTime(ctx, time.Now()); err != nil {
			log.Printf("[grabber] failed to set last_full_grabber_time: %v", err)
		}
	}
}

func setStatus(ctx context.Context, sm *settings.Manager, status string) {
	if err := sm.SetLastGrabberTime(ctx, time.Now()); err != nil {
		log.Printf("[grabber] failed to set last_grabber_time: %v", err)
	}
	if err := sm.SetLastGrabberStatus(ctx, status); err != nil {
		log.Printf("[grabber] failed to set last_grabber_status: %v", err)
	}
}
