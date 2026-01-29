package settings

import (
	"context"
	"time"
)

func (m *Manager) GetLastGrabberTime(ctx context.Context) (time.Time, error) {
	return Get[time.Time](ctx, m, LastGrabberTime)
}

func (m *Manager) SetLastGrabberTime(ctx context.Context, t time.Time) error {
	return Set(ctx, m, LastGrabberTime, t)
}

func (m *Manager) GetLastGrabberStatus(ctx context.Context) (string, error) {
	return Get[string](ctx, m, LastGrabberStatus)
}

func (m *Manager) SetLastGrabberStatus(ctx context.Context, status string) error {
	return Set(ctx, m, LastGrabberStatus, status)
}
