package http

import (
	"embed"
	"fmt"
	stdhttp "net/http"
	"strings"
	"time"

	"github.com/findthisplace.eu/config"
	"github.com/findthisplace.eu/http/handler"
)

//go:embed ui/dist/*
var uiDist embed.FS

func StartServer(cfg *config.Config) (*stdhttp.Server, error) {

	mux := stdhttp.NewServeMux()

	registerWebSocketEndpoints(mux)
	registerAPIEndpoints(mux, cfg)

	handler.RegisterSpa(mux, uiDist)

	var httpHandler stdhttp.Handler = mux
	httpHandler = cors(httpHandler)

	bindAddr := "0.0.0.0"

	var addr string
	if strings.Contains(bindAddr, ":") {
		addr = fmt.Sprintf("[%s]:%d", bindAddr, cfg.Port)
	} else {
		addr = fmt.Sprintf("%s:%d", bindAddr, cfg.Port)
	}

	srv := &stdhttp.Server{
		Addr:              addr,
		Handler:           httpHandler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		srv.ListenAndServe()
	}()

	return srv, nil
}

func registerWebSocketEndpoints(mux *stdhttp.ServeMux) {
}

func registerAPIEndpoints(mux *stdhttp.ServeMux, cfg *config.Config) {

	api := handler.NewAPIHandler(cfg)
	api.RegisterEndpoints(mux, cfg)

}
