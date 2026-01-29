package ftp

import (
	"regexp"
	"strconv"
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

// ExtractCoords finds the first map URL in text and returns its coordinates.
func ExtractCoords(text string) *coords {
	for _, fn := range extractors {
		if c := fn(text); c != nil {
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
