package dirty

import (
	"context"
	"fmt"
	"log"
)

type CommentsResponse struct {
	Comments []DirtyComment `json:"comments"`
}

func (c *DirtyApiClient) GetComments(ctx context.Context, post DirtyPost) (*CommentsResponse, error) {
	pr, err := getJSON[CommentsResponse](ctx, c.HTTP, fmt.Sprintf(c.Base, post.Id))
	if err != nil {
		return nil, err
	}

	log.Printf("Fetched %d comments for post %d", len(pr.Comments), post.Id)
	return pr, nil
}
