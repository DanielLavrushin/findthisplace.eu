package dirty

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// d3.ru sits behind QRATOR, and now and then a connection to it stops
// answering without being closed. Over HTTP/2 every request shares that one
// connection, and Go keeps sending new ones into it until the requests it gave
// up on fill all 16 of the server's stream slots: 16 timeouts in a row, and a
// failed run whenever a page fetch lands among them. Over HTTP/1.1 a request
// that times out takes only its own connection down, and the retry goes out on
// a fresh one.
var httpClient = &http.Client{
	Timeout:   10 * time.Second,
	Transport: newTransport(),
}

func newTransport() *http.Transport {
	var protocols http.Protocols
	protocols.SetHTTP1(true)
	return &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		Protocols:           &protocols,
		TLSHandshakeTimeout: 10 * time.Second,
		IdleConnTimeout:     90 * time.Second,
	}
}

// retryDelays are the waits before each retry of a request d3.ru didn't
// answer, or failed on its side.
var retryDelays = []time.Duration{2 * time.Second, 10 * time.Second, 30 * time.Second}

type DirtyApiClient struct {
	HTTP *http.Client
	Base string
}

func New(endpoint string) *DirtyApiClient {
	return &DirtyApiClient{
		HTTP: httpClient,
		Base: endpoint,
	}
}

// transientError is a failure another attempt may get past.
type transientError struct{ error }

func (e transientError) Unwrap() error { return e.error }

// getJSON fetches u and decodes its JSON, retrying transient failures.
func getJSON[T any](ctx context.Context, client *http.Client, u string) (*T, error) {
	for attempt := 0; ; attempt++ {
		out, err := getJSONOnce[T](ctx, client, u)
		var transient transientError
		if err == nil || !errors.As(err, &transient) || attempt == len(retryDelays) || ctx.Err() != nil {
			return out, err
		}

		log.Printf("d3.ru: %v, retrying in %s", err, retryDelays[attempt])
		select {
		case <-ctx.Done():
			return nil, err
		case <-time.After(retryDelays[attempt]):
		}
	}
}

func getJSONOnce[T any](ctx context.Context, client *http.Client, u string) (*T, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, transientError{err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		err := fmt.Errorf("Get %q: unexpected status %s", u, resp.Status)
		if resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests {
			return nil, transientError{err}
		}
		return nil, err
	}

	// Read it all first, so a connection that drops mid-body is told apart
	// from JSON that doesn't fit.
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, transientError{fmt.Errorf("Get %q: %w", u, err)}
	}
	var out T
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("Get %q: %w", u, err)
	}
	return &out, nil
}
