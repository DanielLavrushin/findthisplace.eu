package handler

import (
	"net/http"

	"github.com/findthisplace.eu/config"
	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/grabber"
	"github.com/findthisplace.eu/settings"
)

func NewAPIHandler(cfg *config.Config, sm *settings.Manager, store *db.DB, g *grabber.Grabber) *API {

	return &API{
		cfg:      cfg,
		settings: sm,
		store:    store,
		grabber:  g,
	}
}

func setJsonHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
}

func (api *API) RegisterEndpoints(mux *http.ServeMux, cfg *config.Config) {

	api.cfg = cfg
	api.mux = mux

	api.RegisterAuthApi()
	api.RegisterSettingsApi()
	api.RegisterVersionApi()
	api.RegisterMapApi()
	api.RegisterUsersApi()
	api.RegisterTagsApi()
	api.RegisterPostsApi()
	api.RegisterWebhookApi()
	api.RegisterGrabberApi()

}
