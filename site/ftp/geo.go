package ftp

import (
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
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
var reShortYandexURL = regexp.MustCompile(`https?://yandex\.[a-z.]+/maps/\p{Pd}/[^\s"'<>]+`)

var shortURLClient = &http.Client{
	Timeout: 10 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

func init() {
	jar, _ := cookiejar.New(nil)
	shortURLClient.Jar = jar
}

func ExtractCoords(text string) *coords {
	for _, fn := range extractors {
		if c := fn(text); c != nil {
			return c
		}
	}
	return resolveShortURL(text)
}

var reAbsoluteURL = regexp.MustCompile(`^https?://`)

const shortURLUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

func resolveShortURL(text string) *coords {
	shortURL := reShortGoogleURL.FindString(text)
	if shortURL == "" {
		shortURL = reShortYandexURL.FindString(text)
	}
	if shortURL == "" {
		return nil
	}

	log.Printf("geo: resolving short URL %s", shortURL)

	current := shortURL
	for range 10 {
		req, err := http.NewRequest("GET", current, nil)
		if err != nil {
			log.Printf("geo: failed to build request for %s: %v", current, err)
			return nil
		}
		req.Header.Set("User-Agent", shortURLUserAgent)
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9,en;q=0.8")

		resp, err := shortURLClient.Do(req)
		if err != nil {
			log.Printf("geo: failed to resolve short URL %s: %v", current, err)
			return nil
		}
		resp.Body.Close()

		location := resp.Header.Get("Location")
		if location == "" {
			log.Printf("geo: short URL %s ended at HTTP %d (no Location)", shortURL, resp.StatusCode)
			return nil
		}

		if !reAbsoluteURL.MatchString(location) {
			base, _ := url.Parse(current)
			ref, err := url.Parse(location)
			if err == nil {
				location = base.ResolveReference(ref).String()
			}
		}

		log.Printf("geo: %s -> HTTP %d -> %s", current, resp.StatusCode, location)

		for _, fn := range extractors {
			if c := fn(location); c != nil {
				log.Printf("geo: short URL %s resolved to %.6f, %.6f", shortURL, c.Lat, c.Lng)
				return c
			}
		}

		if c := extractFromQuery(location); c != nil {
			log.Printf("geo: short URL %s resolved to %.6f, %.6f (via query params)", shortURL, c.Lat, c.Lng)
			return c
		}

		if parsed, err := url.Parse(location); err == nil {
			if continueURL := parsed.Query().Get("continue"); continueURL != "" {
				for _, fn := range extractors {
					if c := fn(continueURL); c != nil {
						log.Printf("geo: short URL %s resolved to %.6f, %.6f (via consent)", shortURL, c.Lat, c.Lng)
						return c
					}
				}
				if c := extractFromQuery(continueURL); c != nil {
					log.Printf("geo: short URL %s resolved to %.6f, %.6f (via consent query params)", shortURL, c.Lat, c.Lng)
					return c
				}
			}
		}

		current = location
	}

	log.Printf("geo: short URL %s: max redirects reached, no coords found", shortURL)
	return nil
}

func extractFromQuery(rawURL string) *coords {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil
	}
	q := parsed.Query()
	isYandex := strings.Contains(parsed.Host, "yandex")

	if isYandex {
		for _, key := range []string{"ll", "pt", "sll"} {
			if val := q.Get(key); val != "" {
				parts := strings.SplitN(val, ",", 2)
				if len(parts) == 2 {
					return parseLatLng(parts[1], parts[0])
				}
			}
		}
	}

	for _, key := range []string{"ll", "q", "query"} {
		if val := q.Get(key); val != "" {
			parts := strings.SplitN(val, ",", 2)
			if len(parts) == 2 {
				return parseLatLng(parts[0], parts[1])
			}
		}
	}

	return nil
}

var (
	reGoogleAt     = regexp.MustCompile(`google\.[a-z.]+/maps[^"<>\s]*@(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleLL     = regexp.MustCompile(`google\.[a-z.]+/maps[^"<>\s]*[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleQ      = regexp.MustCompile(`google\.[a-z.]+/maps[^"<>\s]*[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleQuery  = regexp.MustCompile(`google\.[a-z.]+/maps[^"<>\s]*[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reGoogleSearch = regexp.MustCompile(`google\.[a-z.]+/maps/search/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)`)
	reGoogleData   = regexp.MustCompile(`google\.[a-z.]+/maps[^"<>\s]*!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)`)
)

func extractGoogle(text string) *coords {
	for _, re := range []*regexp.Regexp{reGoogleAt, reGoogleLL, reGoogleQ, reGoogleQuery, reGoogleSearch, reGoogleData} {
		if m := re.FindStringSubmatch(text); m != nil {
			return parseLatLng(m[1], m[2])
		}
	}
	return nil
}

var (
	reYandexLL = regexp.MustCompile(`yandex\.[a-z.]+/maps[^"<>\s]*[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
	reYandexPT = regexp.MustCompile(`yandex\.[a-z.]+/maps[^"<>\s]*[?&]pt=(-?\d+\.?\d*),(-?\d+\.?\d*)`)
)

func extractYandex(text string) *coords {
	for _, re := range []*regexp.Regexp{reYandexLL, reYandexPT} {
		if m := re.FindStringSubmatch(text); m != nil {
			return parseLatLng(m[2], m[1])
		}
	}
	return nil
}

var (
	reBingCP = regexp.MustCompile(`bing\.com/maps[^"<>\s]*[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)`)
	reBingSP = regexp.MustCompile(`bing\.com/maps[^"<>\s]*[?&]sp=point\.(-?\d+\.?\d*)_(-?\d+\.?\d*)`)
)

func extractBing(text string) *coords {
	for _, re := range []*regexp.Regexp{reBingCP, reBingSP} {
		if m := re.FindStringSubmatch(text); m != nil {
			return parseLatLng(m[1], m[2])
		}
	}
	return nil
}

var (
	reOSMHash = regexp.MustCompile(`openstreetmap\.org[^"<>\s]*#map=\d+/(-?\d+\.?\d*)/(-?\d+\.?\d*)`)
	reOSMMLat = regexp.MustCompile(`openstreetmap\.org[^"<>\s]*[?&]mlat=(-?\d+\.?\d*)`)
	reOSMMLon = regexp.MustCompile(`openstreetmap\.org[^"<>\s]*[?&]mlon=(-?\d+\.?\d*)`)
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
