package dirty

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type DirtyPost struct {
	Id            int        `json:"id" bson:"_id"`
	Title         string     `json:"title"`
	Text          string     `json:"-" bson:"text"`
	CreatedDate   time.Time  `json:"created_date" bson:"created_date"`
	ChangedDate   time.Time  `json:"changed_date" bson:"changed_date"`
	CommentsCount int        `json:"comments_count" bson:"comments_count"`
	Rating        int        `json:"rating" bson:"rating"`
	IsGolden      bool       `json:"golden" bson:"golden"`
	IsPinned      bool       `json:"pinned" bson:"pinned"`
	Image         string     `json:"main_image_url" bson:"main_image_url"`
	UserId        int        `bson:"user_id"`
	User          *DirtyUser `json:"user" bson:"user"`
	Link          string     `json:"link" bson:"link"`
	UrlSlug       string     `json:"url_slug" bson:"url_slug"`
	Tags          []string   `json:"tags" bson:"tags"`
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

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GetPosts: unexpected status %s", resp.Status)
	}

	var pr PageResponse
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, err
	}
	log.Printf("Fetched page %d with %d posts", pr.Page, len(pr.Posts))
	return &pr, nil
}

func (p *DirtyPost) UnmarshalJSON(data []byte) error {

	var tmp struct {
		DirtyPostAlias
		Text string `json:"text"`
		Data struct {
			Text string `json:"text"`
		} `json:"data"`
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
	return nil
}
