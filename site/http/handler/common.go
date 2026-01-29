package handler

import (
	"net/http"

	"github.com/findthisplace.eu/config"
)

func NewAPIHandler(cfg *config.Config) *API {

	return &API{
		cfg: cfg,
	}
}

func setJsonHeader(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
}

func (api *API) RegisterEndpoints(mux *http.ServeMux, cfg *config.Config) {

	api.cfg = cfg
	api.mux = mux

}
