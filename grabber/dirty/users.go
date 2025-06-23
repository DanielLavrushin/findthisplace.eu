package dirty

type DirtyUser struct {
	Id        int    `json:"id" bson:"_id"`
	Login     string `json:"login" bson:"login"`
	AvatarUrl string `json:"avatar_url" bson:"avatar_url"`
	IsDeleted bool   `json:"deleted" bson:"deleted"`
	IsGolden  bool   `json:"is_golden" bson:"is_golden"`
	Karma     int    `json:"karma" bson:"karma"`
	Gender    string `json:"gender" bson:"gender"`
}
