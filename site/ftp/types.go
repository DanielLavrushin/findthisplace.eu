package ftp

import "github.com/findthisplace.eu/dirty"

type FtpComment struct {
	Id        int     `json:"id" bson:"_id"`
	PostId    int     `bson:"post_id"`
	Extracted bool    `bson:"extracted"`
	Longitude float64 `bson:"longitude,omitempty"`
	Latitude  float64 `bson:"latitude,omitempty"`
}

type FtpPost struct {
	Id        int             `json:"id" bson:"_id"`
	IsFound   bool            `bson:"is_found"`
	Longitude float64         `bson:"longitude,omitempty"`
	Latitude  float64         `bson:"latitude,omitempty"`
	FoundById      int             `bson:"found_by_id,omitempty"`
	FoundDate      dirty.EpochTime `bson:"found_date,omitempty"`
	ManualOverride bool            `bson:"manual_override,omitempty"`
}
