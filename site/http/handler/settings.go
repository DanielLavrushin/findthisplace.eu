package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/findthisplace.eu/settings"
)

// publicSettings are the ones anyone may read: the footer shows when the
// grabber last ran and how it went. Admin ids and the hidden posts and tags
// are for admins only.
var publicSettings = []string{settings.LastGrabberTime, settings.LastGrabberStatus}

func (api *API) RegisterSettingsApi() {
	api.mux.HandleFunc("GET /api/settings", api.handlePublicSettings)
	api.mux.HandleFunc("GET /api/admin/settings", api.handleGetSettings)
	api.mux.HandleFunc("POST /api/admin/settings", api.handleUpdateSetting)
}

func (api *API) handlePublicSettings(w http.ResponseWriter, r *http.Request) {
	results, err := api.settings.GetAll(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	results = slices.DeleteFunc(results, func(s settings.Setting) bool {
		return !slices.Contains(publicSettings, s.Name)
	})

	setJsonHeader(w)
	json.NewEncoder(w).Encode(results)
}

func (api *API) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	if !api.requireAdmin(w, r) {
		return
	}

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

	if err := checkSetting(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := settings.Set(r.Context(), api.settings, req.Name, req.Value); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// checkSetting refuses an admin_ids value that would lock admins out: it
// must be a list of user ids, and the super admin has to stay on it. A value
// the admin check can't read would leave the site with no admins at all.
func checkSetting(s *settings.Setting) error {
	if s.Name != settings.AdminIds {
		return nil
	}

	raw, err := json.Marshal(s.Value)
	if err != nil {
		return err
	}
	var ids []int
	if err := json.Unmarshal(raw, &ids); err != nil {
		return errors.New("admin_ids must be a list of user ids")
	}
	if !slices.Contains(ids, settings.SuperAdminId) {
		return fmt.Errorf("admin %d can't be removed", settings.SuperAdminId)
	}

	s.Value = ids
	return nil
}
