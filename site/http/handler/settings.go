package handler

import (
	"encoding/json"
	"net/http"

	"github.com/findthisplace.eu/settings"
)

func (api *API) RegisterSettingsApi() {
	api.mux.HandleFunc("/api/settings", api.handleSettings)
}

func (api *API) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		api.handleGetSettings(w, r)
	case http.MethodPost:
		api.handleUpdateSetting(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (api *API) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	results, err := api.settings.GetAll(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func (api *API) handleUpdateSetting(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}

	var req settings.Setting
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if err := settings.Set(r.Context(), api.settings, req.Name, req.Value); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
