package handler

import (
	"net/http"

	"github.com/findthisplace.eu/config"
	"github.com/findthisplace.eu/db"
	"github.com/findthisplace.eu/settings"
)

type API struct {
	cfg      *config.Config
	mux      *http.ServeMux
	settings *settings.Manager
	store    *db.DB
}
