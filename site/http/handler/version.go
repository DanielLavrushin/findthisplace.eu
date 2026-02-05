package handler

import (
	"encoding/json"
	"net/http"
)

func (api *API) RegisterVersionApi() {
	api.mux.HandleFunc("/api/version", api.handleVersion)
}

func (api *API) handleVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(map[string]string{
		"version": api.cfg.Version,
	})
}
