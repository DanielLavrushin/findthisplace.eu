package ftp

import "github.com/findthisplace.eu/grabber/dirty"

type FtpPost struct {
	Id        int             `bson:"_id"`
	IsFound   bool            `bson:"is_found"`
	Longitude float64         `bson:"longitude,omitempty"`
	Latitude  float64         `bson:"latitude,omitempty"`
	FoundById int             `bson:"found_by_id,omitempty"`
	FoundDate dirty.EpochTime `bson:"found_date,omitempty"`
}
