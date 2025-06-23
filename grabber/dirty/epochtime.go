package dirty

import (
	"encoding/json"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

type EpochTime struct{ time.Time }

func (et *EpochTime) UnmarshalJSON(b []byte) error {
	var sec int64
	if err := json.Unmarshal(b, &sec); err != nil {
		return err
	}
	et.Time = time.Unix(sec, 0).UTC()
	return nil
}

func (et EpochTime) MarshalBSONValue() (bsontype.Type, []byte, error) {
	return bson.MarshalValue(et.Time)
}
