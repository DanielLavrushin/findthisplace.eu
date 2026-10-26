package grabber

import (
	"context"
	"errors"
	"fmt"
	"log"
	"runtime/debug"
	"time"

	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/ftp"
	"github.com/findthisplace.eu/settings"
)

const checkInterval = 5 * time.Minute
const runThreshold = 2 * time.Hour

const fullRunThreshold = 24 * time.Hour

// ErrBusy is what Trigger returns while a run is going or already queued.
var ErrBusy = errors.New("grabber is already running")

// Grabber is the background scheduler, which the admin panel can follow and
// ask for a run.
type Grabber struct {
	store    *db.DB
	sm       *settings.Manager
	requests chan bool // a manual run waiting to start; true asks for a full backfill
	done     <-chan struct{}
	progress Progress
}

// Status is the grabber as the admin panel shows it: the run in progress, or
// the last one since the server started, and the schedule.
type Status struct {
	Running       bool       `json:"running"`
	Queued        bool       `json:"queued"`
	Run           *RunState  `json:"run,omitempty"`
	LastRunAt     *time.Time `json:"last_run_at,omitempty"`
	LastResult    string     `json:"last_result,omitempty"`
	LastFullRunAt *time.Time `json:"last_full_run_at,omitempty"`
	NextRunAt     time.Time  `json:"next_run_at"`
	NextRunFull   bool       `json:"next_run_full"`
	// The nightly database backup, which the admin panel shows beside the runs.
	LastBackupAt   *time.Time `json:"last_backup_at,omitempty"`
	LastBackupSize int64      `json:"last_backup_size,omitempty"`
}

func StartBackground(ctx context.Context, store *db.DB, sm *settings.Manager) *Grabber {
	g := &Grabber{store: store, sm: sm, requests: make(chan bool, 1), done: ctx.Done()}

	go func() {
		log.Println("[grabber] background scheduler started")

		g.safeRunIfNeeded(ctx, nil)

		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("[grabber] background scheduler stopped")
				return
			case <-ticker.C:
				g.safeRunIfNeeded(ctx, nil)
			case full := <-g.requests:
				g.safeRunIfNeeded(ctx, &full)
			}
		}
	}()

	return g
}

// Trigger starts a run now rather than on schedule; full makes it a full
// backfill instead of the latest posts.
func (g *Grabber) Trigger(full bool) error {
	if g.progress.running() {
		return ErrBusy
	}
	select {
	case g.requests <- full:
		g.progress.touch()
		return nil
	default:
		return ErrBusy
	}
}

// Version changes whenever Status may have changed.
func (g *Grabber) Version() uint64 {
	return g.progress.currentVersion()
}

// Done is closed once the scheduler stops, when the server shuts down.
func (g *Grabber) Done() <-chan struct{} {
	return g.done
}

func (g *Grabber) Status(ctx context.Context) Status {
	s := Status{Queued: len(g.requests) > 0, Run: g.progress.snapshot()}
	s.Running = s.Run != nil && s.Run.FinishedAt == nil

	// Approximate: the scheduler looks every checkInterval.
	now := time.Now()
	s.NextRunAt = now
	if t, err := g.sm.GetLastGrabberTime(ctx); err == nil {
		s.LastRunAt = &t
		if next := t.Add(runThreshold); next.After(now) {
			s.NextRunAt = next
		}
	}
	s.LastResult, _ = g.sm.GetLastGrabberStatus(ctx)

	s.NextRunFull = true
	if t, err := g.sm.GetLastFullGrabberTime(ctx); err == nil {
		s.LastFullRunAt = &t
		s.NextRunFull = s.NextRunAt.Sub(t) >= fullRunThreshold
	}

	if t, err := g.sm.GetLastBackupTime(ctx); err == nil {
		s.LastBackupAt = &t
		s.LastBackupSize, _ = g.sm.GetLastBackupSize(ctx)
	}
	return s
}

func (g *Grabber) safeRunIfNeeded(ctx context.Context, manual *bool) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[grabber] run panicked: %v\n%s", r, debug.Stack())
			setStatus(ctx, g.sm, "fail")
			g.progress.finish(fmt.Errorf("panic: %v", r))
		}
	}()

	g.runIfNeeded(ctx, manual)
}

// runIfNeeded runs on schedule when manual is nil: throttled, with a full
// backfill once a day. A manual run starts right away, full if *manual.
func (g *Grabber) runIfNeeded(ctx context.Context, manual *bool) {
	var fullRun bool
	if manual != nil {
		fullRun = *manual
	} else {
		if runThrottled(ctx, g.sm) {
			return
		}
		fullRun = fullBackfillDue(ctx, g.sm)
	}

	if fullRun {
		log.Println("[grabber] starting full backfill run")
	} else {
		log.Println("[grabber] starting incremental run")
	}
	g.progress.start(fullRun, manual != nil)

	result, err := Run(ctx, &fullRun, g.store, &g.progress)
	if err != nil {
		log.Printf("[grabber] run failed: %v", err)
		setStatus(ctx, g.sm, "fail")
		g.progress.finish(err)
		return
	}

	postIDs := make([]int, len(result.Posts))
	for i, p := range result.Posts {
		postIDs[i] = p.Id
	}

	log.Println("[grabber] starting ftp processing")
	if err := ftp.Process(ctx, g.store, postIDs, &g.progress); err != nil {
		log.Printf("[grabber] ftp processing failed: %v", err)
		setStatus(ctx, g.sm, "fail")
		g.progress.finish(err)
		return
	}

	log.Println("[grabber] run completed successfully")
	setStatus(ctx, g.sm, "success")

	if fullRun {
		if err := g.sm.SetLastFullGrabberTime(ctx, time.Now()); err != nil {
			log.Printf("[grabber] failed to set last_full_grabber_time: %v", err)
		}
	}
	g.progress.finish(nil)
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

func runThrottled(ctx context.Context, sm *settings.Manager) bool {
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
