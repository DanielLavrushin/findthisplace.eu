package settings

import "go.mongodb.org/mongo-driver/mongo"

const (
	LastGrabberTime     = "last_grabber_time"
	LastFullGrabberTime = "last_full_grabber_time"
	LastGrabberStatus   = "last_grabber_status"

	// written by the nightly backup script (deploy/backup.sh)
	LastBackupTime = "last_backup_time"
	LastBackupSize = "last_backup_size"

	HiddenNotFoundPosts = "hidden_not_found_posts"
	HiddenTags          = "hidden_tags"
	AdminIds            = "admin_ids"
)

// SuperAdminId is the site owner's d3.ru account. It can't be removed from
// admin_ids, so there is always an admin who can put the others back.
const SuperAdminId = 25377

type Manager struct {
	coll *mongo.Collection
}

type Setting struct {
	Name  string      `bson:"_id" json:"name"`
	Value interface{} `bson:"value" json:"value"`
}
