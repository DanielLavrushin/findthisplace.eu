package settings

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func NewManager(coll *mongo.Collection) *Manager {
	return &Manager{coll: coll}
}

func (m *Manager) GetAll(ctx context.Context) ([]Setting, error) {
	cursor, err := m.coll.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("settings: %w", err)
	}
	var results []Setting
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("settings: %w", err)
	}
	return results, nil
}

func Get[T any](ctx context.Context, m *Manager, name string) (T, error) {
	var setting Setting
	var zero T

	err := m.coll.FindOne(ctx, bson.M{"_id": name}).Decode(&setting)
	if err != nil {
		return zero, fmt.Errorf("setting %q: %w", name, err)
	}

	if dt, ok := setting.Value.(primitive.DateTime); ok {
		var converted interface{} = dt.Time()
		if val, ok := converted.(T); ok {
			return val, nil
		}
	}

	val, ok := setting.Value.(T)
	if !ok {
		return zero, fmt.Errorf("setting %q: expected %T, got %T", name, zero, setting.Value)
	}
	return val, nil
}

func Set(ctx context.Context, m *Manager, name string, value interface{}) error {
	filter := bson.M{"_id": name}
	update := bson.M{"$set": bson.M{"value": value}}
	opts := options.Update().SetUpsert(true)

	_, err := m.coll.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return fmt.Errorf("setting %q: %w", name, err)
	}
	return nil
}
