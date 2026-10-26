package dirty

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
)

var foundMarker = regexp.MustCompile(`(?i)\[НАЙДЕНО]`)

// StatusTags describe where a puzzle stands rather than where it is.
var StatusTags = map[string]bool{
	"не найдено":      true,
	"условно найдено": true,
	"найдено":         true,
}

type DirtyPostAlias DirtyPost

type PageResponse struct {
	Page       int         `json:"page"`
	PageCount  int         `json:"page_count"`
	PerPage    int         `json:"per_page"`
	Posts      []DirtyPost `json:"posts"`
	PostsTotal int         `json:"item_count"`
}

func (c *DirtyApiClient) GetPosts(ctx context.Context, page int, perPage int) (*PageResponse, error) {
	if page < 1 {
		page = 1
	}

	if perPage == 0 {
		perPage = 42
	}
	u, err := url.Parse(c.Base)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("page", strconv.Itoa(page))
	q.Set("per_page", strconv.Itoa(perPage))
	q.Set("domain_prefix", "findthisplace")
	u.RawQuery = q.Encode()

	pr, err := getJSON[PageResponse](ctx, c.HTTP, u.String())
	if err != nil {
		return nil, err
	}
	log.Printf("Fetched page %d with %d posts", pr.Page, len(pr.Posts))
	return pr, nil
}

func (p *DirtyPost) UnmarshalJSON(data []byte) error {

	var tmp struct {
		DirtyPostAlias
		Text string `json:"text"`
		Data struct {
			Text     string `json:"text"`
			Subtitle string `json:"subtitle"`
		} `json:"data"`
		Links []struct {
			Href string `json:"href"`
			Rel  string `json:"rel"`
		} `json:"_links"`
	}

	if err := json.Unmarshal(data, &tmp); err != nil {
		return err
	}

	*p = DirtyPost(tmp.DirtyPostAlias)

	if tmp.Text != "" {
		p.Text = tmp.Text
	} else {
		p.Text = tmp.Data.Text
	}

	// Gallery posts carry their description, [НАЙДЕНО] included, in the
	// subtitle; the old grabber kept it as part of the text.
	if s := tmp.Data.Subtitle; s != "" {
		if p.Text != "" {
			p.Text += "<br>"
		}
		p.Text += s
	}

	for _, l := range tmp.Links {
		if l.Rel == "html" {
			p.Link = l.Href
			break
		}
	}

	return nil
}

// IsFound reports whether moderators marked the post found with [НАЙДЕНО].
func (p *DirtyPost) IsFound() bool {
	return foundMarker.MatchString(p.Text)
}

// PostGone reports whether d3.ru answers 404 for the post, as it does once the
// post or its author's account is deleted. Any answer but 404 or 200 is an
// error, so an outage is never taken for a deletion.
func PostGone(ctx context.Context, id int) (bool, error) {
	u := fmt.Sprintf(ApiPostEndpoint, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return false, err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusNotFound:
		return true, nil
	case http.StatusOK:
		return false, nil
	}
	return false, fmt.Errorf("Get %q: unexpected status %s", u, resp.Status)
}
