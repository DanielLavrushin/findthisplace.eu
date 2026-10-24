package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// grabberHeartbeat is the longest the status stream stays quiet, well inside
// the 60s after which nginx drops an idle proxied connection.
const grabberHeartbeat = 15 * time.Second

func (api *API) RegisterGrabberApi() {
	api.mux.HandleFunc("GET /api/admin/grabber/events", api.handleGrabberEvents)
	api.mux.HandleFunc("POST /api/admin/grabber/run", api.handleGrabberRun)
}

// handleGrabberEvents streams the grabber status as server-sent events. The
// admin check runs once per connection, so following a long run costs no
// d3.ru calls.
func (api *API) handleGrabberEvents(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}
	api.streamGrabberStatus(r.Context(), w)
}

// streamGrabberStatus sends the status on connect, then on every change, at
// most once a second, until the client goes away or the server shuts down.
func (api *API) streamGrabberStatus(ctx context.Context, w http.ResponseWriter) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // nginx would hold events back

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	var sentVersion uint64
	var sentAt time.Time
	for {
		if v := api.grabber.Version(); sentAt.IsZero() || v != sentVersion || time.Since(sentAt) >= grabberHeartbeat {
			data, err := json.Marshal(api.grabber.Status(ctx))
			if err != nil {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
			sentVersion, sentAt = v, time.Now()
		}

		// The grabber stops first on shutdown; ending the stream then keeps
		// it from holding up the server's graceful shutdown.
		select {
		case <-ctx.Done():
			return
		case <-api.grabber.Done():
			return
		case <-ticker.C:
		}
	}
}

type grabberRunRequest struct {
	Full bool `json:"full"`
}

func (api *API) handleGrabberRun(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}

	var req grabberRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.grabber.Trigger(req.Full); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}
