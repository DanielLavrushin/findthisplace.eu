package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

const updateTriggerFile = "/run/findthisplace-update/trigger"

func (api *API) RegisterWebhookApi() {
	api.mux.HandleFunc("POST /api/webhook/update", api.handleWebhookUpdate)
}

func (api *API) handleWebhookUpdate(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret == "" {
		http.Error(w, "webhook not configured", http.StatusInternalServerError)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	sig := r.Header.Get("X-Hub-Signature-256")
	if !verifyGitHubSignature(secret, body, sig) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	if err := os.WriteFile(updateTriggerFile, body, 0644); err != nil {
		log.Printf("webhook: failed to write trigger file: %v", err)
		http.Error(w, "failed to trigger update", http.StatusInternalServerError)
		return
	}

	log.Println("webhook: update triggered")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "update triggered")
}

func verifyGitHubSignature(secret string, payload []byte, signature string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}
