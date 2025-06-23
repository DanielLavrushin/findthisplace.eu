package dirty

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"
)

type DirtyComment struct {
	Id          int        `json:"id" bson:"_id"`
	CreatedDate time.Time  `json:"created_date" bson:"created_date"`
	Text        string     `json:"body" bson:"body"`
	Rating      int        `json:"rating" bson:"rating"`
	UserId      int        `bson:"user_id"`
	User        *DirtyUser `json:"user" bson:"user"`
	PostId      int        `bson:"post_id"`
	IsDeleted   bool       `json:"deleted" bson:"deleted"`
	ParentId    *int       `json:"parent_id,omitempty" bson:"parent_id,omitempty"`
}

type CommentsResponse struct {
	Comments []DirtyComment `json:"comments"`
}

func (c *DirtyApiClient) GetComments(ctx context.Context, post DirtyPost) (*CommentsResponse, error) {
	endpoint := fmt.Sprintf(c.Base, post.Id)
	u, err := url.Parse(endpoint)

	if err != nil {
		return nil, err
	}
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
		return nil, fmt.Errorf("GetComments: unexpected status %s", resp.Status)
	}

	var pr CommentsResponse

	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, err
	}

	log.Printf("Fetched %d comments for post %d", len(pr.Comments), post.Id)
	return &pr, nil
}
