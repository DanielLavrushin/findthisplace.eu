package dirty

type DirtyPost struct {
	Id            int        `json:"id" bson:"_id"`
	Title         string     `json:"title"`
	Text          string     `json:"-" bson:"text"`
	CreatedDate   EpochTime  `json:"created" bson:"created"`
	ChangedDate   EpochTime  `json:"changed" bson:"changed"`
	CommentsCount int        `json:"comments_count" bson:"comments_count"`
	Rating        int        `json:"rating" bson:"rating"`
	IsGolden      bool       `json:"golden" bson:"golden"`
	IsPinned      bool       `json:"pinned" bson:"pinned"`
	Image         string     `json:"main_image_url" bson:"main_image_url"`
	UserId        int        `bson:"user_id"`
	User          *DirtyUser `json:"user" bson:"-,omitempty"`
	Link          string     `bson:"link"`
	UrlSlug       string     `json:"url_slug" bson:"url_slug,omitempty"`
	Tags          []string   `json:"tags" bson:"tags"`
}

type DirtyUser struct {
	Id        int    `json:"id" bson:"_id"`
	Login     string `json:"login" bson:"login"`
	AvatarUrl string `json:"avatar_url" bson:"avatar_url,omitempty"`
	IsDeleted bool   `json:"deleted" bson:"deleted"`
	IsActive  bool   `json:"active" bson:"active"`
	IsGolden  bool   `json:"is_golden" bson:"is_golden"`
	Karma     int    `json:"karma" bson:"karma"`
	Gender    string `json:"gender" bson:"gender"`
}

type DirtyComment struct {
	Id          int        `json:"id" bson:"_id"`
	CreatedDate EpochTime  `json:"created" bson:"created"`
	Text        string     `json:"body" bson:"body"`
	Rating      int        `json:"rating" bson:"rating"`
	PostId      int        `bson:"post_id"`
	UserId      int        `bson:"user_id"`
	User        *DirtyUser `json:"user" bson:"-,omitempty"`
	IsDeleted   bool       `json:"deleted" bson:"deleted"`
	ParentId    int        `json:"parent_id,omitempty" bson:"parent_id,omitempty"`
	TreeLevel   int        `json:"tree_level" bson:"tree_level"`
	DateOrder   int        `json:"date_order" bson:"date_order"`
	RatingOrder int        `json:"rating_order" bson:"rating_order"`
}
