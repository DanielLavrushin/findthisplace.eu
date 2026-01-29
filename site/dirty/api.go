package dirty

import (
	"net/http"
	"time"
)

type DirtyApiClient struct {
	HTTP *http.Client
	Base string
}

func New(endpoint string) *DirtyApiClient {
	return &DirtyApiClient{
		HTTP: &http.Client{
			Timeout: 10 * time.Second,
		},
		Base: endpoint,
	}
}
