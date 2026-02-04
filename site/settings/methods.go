package settings

import (
	"context"
	"time"
)

// GET
func (m *Manager) GetLastGrabberTime(ctx context.Context) (time.Time, error) {
	return Get[time.Time](ctx, m, LastGrabberTime)
}
func (m *Manager) GetLastGrabberStatus(ctx context.Context) (string, error) {
	return Get[string](ctx, m, LastGrabberStatus)
}
func (m *Manager) GetHiddenNotFoundPosts(ctx context.Context) ([]int, error) {
	return Get[[]int](ctx, m, HiddenNotFoundPosts)
}

func (m *Manager) GetHiddenTags(ctx context.Context) ([]string, error) {
	return Get[[]string](ctx, m, HiddenTags)
}

func (m *Manager) GetAdminIds(ctx context.Context) ([]int, error) {
	return Get[[]int](ctx, m, AdminIds)
}


// SET
func (m *Manager) SetLastGrabberTime(ctx context.Context, t time.Time) error {
	return Set(ctx, m, LastGrabberTime, t)
}

func (m *Manager) SetLastGrabberStatus(ctx context.Context, status string) error {
	return Set(ctx, m, LastGrabberStatus, status)
}

func (m *Manager) SetHiddenNotFoundPosts(ctx context.Context, ids []int) error {
	return Set(ctx, m, HiddenNotFoundPosts, ids)
}

func (m *Manager) SetHiddenTags(ctx context.Context, tags []string) error {
	return Set(ctx, m, HiddenTags, tags)
}

func (m *Manager) SetAdminIds(ctx context.Context, ids []int) error {
	return Set(ctx, m, AdminIds, ids)
}