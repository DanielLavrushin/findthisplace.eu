package dirty

const (
	ApiBaseEndpoint        = "https://findthisplace.d3.ru"
	ApiPostsFullEndpoint   = ApiBaseEndpoint + "/api/posts2"
	ApiPostsLatestEndpoint = ApiBaseEndpoint + "/api/domains/findthisplace/feed"
	ApiCommentsEndpoint    = ApiBaseEndpoint + "/api/posts/%d/comments"
)
