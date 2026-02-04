package handler

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"time"
)

type loginRequest struct {
	UID      string `json:"uid"`
	SID      string `json:"sid"`
	Username string `json:"username"`
}

type authResponse struct {
	Valid    bool   `json:"valid"`
	IsAdmin  bool   `json:"isAdmin"`
	UID      string `json:"uid,omitempty"`
	Username string `json:"username,omitempty"`
}

const (
	cookieUID      = "d3_uid"
	cookieSID      = "d3_sid"
	cookieUsername = "d3_username"
	cookieMaxAge   = 30 * 24 * 60 * 60 // 30 days
)

func (api *API) RegisterAuthApi() {
	api.mux.HandleFunc("POST /api/auth/session", api.handleAuthSession)
	api.mux.HandleFunc("GET /api/auth/me", api.handleAuthMe)
	api.mux.HandleFunc("POST /api/auth/logout", api.handleAuthLogout)
}

// handleAuthSession - creates a session after frontend authenticates with d3.ru
func (api *API) handleAuthSession(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UID == "" || req.SID == "" {
		setJsonHeader(w)
		json.NewEncoder(w).Encode(authResponse{Valid: false})
		return
	}

	// Verify session with d3.ru
	valid := verifyD3Session(req.UID, req.SID)
	if !valid {
		setJsonHeader(w)
		json.NewEncoder(w).Encode(authResponse{Valid: false})
		return
	}

	// Set httpOnly secure cookies
	secure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"

	http.SetCookie(w, &http.Cookie{
		Name:     cookieUID,
		Value:    req.UID,
		Path:     "/",
		MaxAge:   cookieMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     cookieSID,
		Value:    req.SID,
		Path:     "/",
		MaxAge:   cookieMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})

	// Username is not sensitive, can be read by JS for display
	http.SetCookie(w, &http.Cookie{
		Name:     cookieUsername,
		Value:    req.Username,
		Path:     "/",
		MaxAge:   cookieMaxAge,
		HttpOnly: false, // JS can read this for display
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})

	// Check if user is admin
	isAdmin := api.checkIsAdmin(r, req.UID)

	setJsonHeader(w)
	json.NewEncoder(w).Encode(authResponse{
		Valid:    true,
		IsAdmin:  isAdmin,
		Username: req.Username,
	})
}

// handleAuthMe - returns current session status from cookies
func (api *API) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	uid, sid, username := getAuthCookies(r)

	if uid == "" || sid == "" {
		setJsonHeader(w)
		json.NewEncoder(w).Encode(authResponse{Valid: false})
		return
	}

	// Verify session is still valid with d3.ru
	valid := verifyD3Session(uid, sid)
	if !valid {
		// Clear invalid cookies
		clearAuthCookies(w, r)
		setJsonHeader(w)
		json.NewEncoder(w).Encode(authResponse{Valid: false})
		return
	}

	isAdmin := api.checkIsAdmin(r, uid)

	setJsonHeader(w)
	json.NewEncoder(w).Encode(authResponse{
		Valid:    true,
		IsAdmin:  isAdmin,
		UID:      uid,
		Username: username,
	})
}

// handleAuthLogout - clears auth cookies
func (api *API) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	clearAuthCookies(w, r)
	setJsonHeader(w)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (api *API) checkIsAdmin(r *http.Request, uid string) bool {
	adminIds, err := api.settings.GetAdminIds(r.Context())
	if err != nil {
		return false
	}
	uidInt, _ := strconv.Atoi(uid)
	return slices.Contains(adminIds, uidInt)
}

// requireAdmin validates that the request is from an authenticated admin.
// Returns true if authorized, false if not (and writes appropriate HTTP error).
func (api *API) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	uid, sid, _ := getAuthCookies(r)
	if uid == "" || sid == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}

	if !verifyD3Session(uid, sid) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}

	if !api.checkIsAdmin(r, uid) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}

	return true
}

func getAuthCookies(r *http.Request) (uid, sid, username string) {
	if c, err := r.Cookie(cookieUID); err == nil {
		uid = c.Value
	}
	if c, err := r.Cookie(cookieSID); err == nil {
		sid = c.Value
	}
	if c, err := r.Cookie(cookieUsername); err == nil {
		username = c.Value
	}
	return
}

func clearAuthCookies(w http.ResponseWriter, r *http.Request) {
	secure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"

	for _, name := range []string{cookieUID, cookieSID, cookieUsername} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   secure,
			SameSite: http.SameSiteLaxMode,
		})
	}
}

func verifyD3Session(uid, sid string) bool {
	client := &http.Client{Timeout: 5 * time.Second}

	req, err := http.NewRequest("GET", "https://d3.ru/api/posts/subscriptions/", nil)
	if err != nil {
		return false
	}

	req.Header.Set("X-Futuware-UID", uid)
	req.Header.Set("X-Futuware-SID", sid)

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
