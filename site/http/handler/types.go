package handler

import (
	"net/http"

	"github.com/findthisplace.eu/config"
)

type API struct {
	cfg *config.Config
	mux *http.ServeMux
}
