package ftp

import (
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"
)

type coords struct {
	Lat, Lng float64
}

var extractors = []func(string) *coords{
	extractGoogle,
	extractYandex,
	extractBing,
	extractOSM,
}

var reShortGoogleURL = regexp.MustCompile(`https?://(?:maps\.app\.goo\.gl|goo\.gl/maps)/[^\s"'<>]+`)

var shortURLClient = &http.Client{
	Timeout: 10 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// ExtractCoords finds the first map URL in text and returns its coordinates.
func ExtractCoords(text string) *coords {
	for _, fn := range extractors {
		if c := fn(text); c != nil {
			return c
		}
	}
	return resolveShortURL(text)
}

func resolveShortURL(text string) *coords {
	shortURL := reShortGoogleURL.FindString(text)
	if shortURL == "" {
		return nil
	}

	resp, err := shortURLClient.Get(shortURL)
	if err != nil {
		log.Printf("geo: failed to resolve short URL %s: %v", shortURL, err)
		return nil
	}
	resp.Body.Close()

	location := resp.Header.Get("Location")
	if location == "" {
		return nil
	}

	// Try extracting coords directly from the redirect URL
	for _, fn := range extractors {
		if c := fn(location); c != nil {
			return c
		}
	}

	// Consent page: coords are inside the ?continue= parameter
	parsed, err := url.Parse(location)
	if err != nil {
		return nil
	}
	continueURL := parsed.Query().Get("continue")
	if continueURL == "" {
		return nil
	}
	for _, fn := range extractors {
		if c := fn(continueURL); c != nil {
			return c
		}
	}
	return nil
}

// Google Maps: /@lat,lng  or  ?ll=lat,lng  or  ?q=lat,lng  or  ?query=lat,lng
var (
	reGoogleAt    = regexp.MustCompile(`google\.[a-z.]+/maps[^"'\s]*@(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleLL    = regexp.MustCompile(`google\.[a-z.]+/maps[^"'\s]*[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleQ     = regexp.MustCompile(`google\.[a-z.]+/maps[^"'\s]*[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleQuery = regexp.MustCompile(`google\.[a-z.]+/maps[^"'\s]*[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
)

func extractGoogle(text string) *coords {
	for _, re := range []*regexp.Regexp{reGoogleAt, reGoogleLL, reGoogleQ, reGoogleQuery} {
		if m := re.FindStringSubmatch(text); m != nil {
			return parseLatLng(m[1], m[2])
		}
	}
	return nil
}

// Yandex Maps: ?ll=lng,lat (note: longitude first!) or ?pt=lng,lat
var (
	reYandexLL = regexp.MustCompile(`yandex\.[a-z.]+/maps[^"'\s]*[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reYandexPT = regexp.MustCompile(`yandex\.[a-z.]+/maps[^"'\s]*[?&]pt=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
)

func extractYandex(text string) *coords {
	for _, re := range []*regexp.Regexp{reYandexLL, reYandexPT} {
		if m := re.FindStringSubmatch(text); m != nil {
			// Yandex uses lng,lat order
			return parseLatLng(m[2], m[1])
		}
	}
	return nil
}

// Bing Maps: ?cp=lat~lng  or  ?sp=point.lat_lng
var (
	reBingCP = regexp.MustCompile(`bing\.com/maps[^"'\s]*[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)`)
	reBingSP = regexp.MustCompile(`bing\.com/maps[^"'\s]*[?&]sp=point\.(-?\d+\.?\d*)_(-?\d+\.?\d*)`)
)

func extractBing(text string) *coords {
	for _, re := range []*regexp.Regexp{reBingCP, reBingSP} {
		if m := re.FindStringSubmatch(text); m != nil {
			return parseLatLng(m[1], m[2])
		}
	}
	return nil
}

// OpenStreetMap: #map=zoom/lat/lng  or  ?mlat=lat&mlon=lng
var (
	reOSMHash = regexp.MustCompile(`openstreetmap\.org[^"'\s]*#map=\d+/(-?\d+\.?\d*)/(-?\d+\.?\d*)`)
	reOSMMLat = regexp.MustCompile(`openstreetmap\.org[^"'\s]*[?&]mlat=(-?\d+\.?\d*)`)
	reOSMMLon = regexp.MustCompile(`openstreetmap\.org[^"'\s]*[?&]mlon=(-?\d+\.?\d*)`)
)

func extractOSM(text string) *coords {
	if m := reOSMHash.FindStringSubmatch(text); m != nil {
		return parseLatLng(m[1], m[2])
	}
	mLat := reOSMMLat.FindStringSubmatch(text)
	mLon := reOSMMLon.FindStringSubmatch(text)
	if mLat != nil && mLon != nil {
		return parseLatLng(mLat[1], mLon[1])
	}
	return nil
}

func parseLatLng(latStr, lngStr string) *coords {
	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)
	if err1 != nil || err2 != nil {
		return nil
	}
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return nil
	}
	return &coords{Lat: lat, Lng: lng}
}
