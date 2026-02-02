package ftp

import "github.com/findthisplace.eu/dirty"

type FtpComment struct {
	Id        int     `json:"id" bson:"_id"`
	Extracted bool    `bson:"extracted"`
	Longitude float64 `bson:"longitude,omitempty"`
	Latitude  float64 `bson:"latitude,omitempty"`
}

type FtpPost struct {
	Id             int             `json:"id" bson:"_id"`
	IsFound        bool            `bson:"is_found"`
	Longitude      float64         `bson:"longitude,omitempty"`
	Latitude       float64         `bson:"latitude,omitempty"`
	FoundById      int             `bson:"found_by_id,omitempty"`
	FoundDate      dirty.EpochTime `bson:"found_date,omitempty"`
	ManualOverride bool            `bson:"manual_override,omitempty"`
}

type FtpUser struct {
	Id               int     `json:"id" bson:"_id"`
	AuthorPostsFound int     `bson:"author_posts_found"`
	AuthorPostsTotal int     `bson:"author_posts_total"`
	FoundTiersTotal  int     `bson:"found_tiers_total"`
	FoundTier0       int     `bson:"found_tier0"`
	FoundTier1       int     `bson:"found_tier1"`
	FoundTier2       int     `bson:"found_tier2"`
	FoundTier3       int     `bson:"found_tier3"`
	FoundTier4       int     `bson:"found_tier4"`
	AvgSearchTime    float64 `bson:"avg_search_time"`
	AvgAuthorTime    float64 `bson:"avg_author_time"`
}
