package main

import (
	"context"
	"log"

	"github.com/findthisplace.eu/grabber/dirty"
)

type Result struct {
	Posts    []dirty.DirtyPost
	Comments []dirty.DirtyComment
	Users    map[int]*dirty.DirtyUser
}

func Run(ctx context.Context, fullRun *bool) (*Result, error) {

	log.Printf("Starting Dirty API fetcher...")

	var postsEndpoint string
	if *fullRun {
		postsEndpoint = dirty.ApiPostsFullEndpoint
	} else {
		postsEndpoint = dirty.ApiPostsLatestEndpoint
	}

	postApi := dirty.New(postsEndpoint)
	const perPage = 42

	log.Printf("Fetching page %d", 1)
	first, err := postApi.GetPosts(ctx, 1, perPage)

	totalPages := first.PageCount
	log.Printf("Total pages: %d", totalPages)

	if err != nil {
		return nil, err
	}

	res := &Result{
		Posts:    make([]dirty.DirtyPost, 0, first.PostsTotal),
		Comments: make([]dirty.DirtyComment, 0, 10000),
		Users:    make(map[int]*dirty.DirtyUser, 1000),
	}

	processBatch(ctx, first.Posts, res)

	for page := 2; page <= totalPages; page++ {
		log.Printf("Fetching page %d/%d", page, totalPages)

		batch, err := postApi.GetPosts(ctx, page, perPage)
		if err != nil {
			return nil, err
		}
		if len(batch.Posts) == 0 {
			break
		}
		processBatch(ctx, batch.Posts, res)
	}

	return res, nil
}

func processBatch(ctx context.Context, posts []dirty.DirtyPost, res *Result) {
	total := len(posts)
	commentApi := dirty.New(dirty.ApiCommentsEndpoint) // one per batch, not per post

	for i, post := range posts {
		log.Printf("Processing post %d/%d (%s)", i+1, total, post.Title)

		// ----- user handling -----
		if post.User != nil {
			res.Users[post.User.Id] = cloneUser(post.User)
			post.UserId = post.User.Id
			post.User = nil
		}

		// ----- comments -----
		cr, err := commentApi.GetComments(ctx, post)
		if err != nil {
			log.Printf("Comments failed for post %d: %v", post.Id, err)
			continue
		}

		for j := range cr.Comments {
			c := &cr.Comments[j]

			if c.User != nil {
				res.Users[c.User.Id] = cloneUser(c.User)
				c.UserId = c.User.Id
				c.User = nil
			}

			c.PostId = post.Id
		}

		res.Comments = append(res.Comments, cr.Comments...)
		res.Posts = append(res.Posts, post)
	}
}

func cloneUser(u *dirty.DirtyUser) *dirty.DirtyUser {
	if u == nil {
		return nil
	}
	cp := *u
	return &cp
}
