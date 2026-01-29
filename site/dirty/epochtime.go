package dirty

import (
	"encoding/json"
	"fmt"
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

func (et *EpochTime) UnmarshalBSONValue(t bsontype.Type, data []byte) error {
	switch t {
	case bson.TypeDateTime:
		var tm time.Time
		if err := bson.UnmarshalValue(t, data, &tm); err != nil {
			return err
		}
		et.Time = tm.UTC()
		return nil

	case bson.TypeInt64:
		var secs int64
		if err := bson.UnmarshalValue(t, data, &secs); err != nil {
			return err
		}
		et.Time = time.Unix(secs, 0).UTC()
		return nil
	}
	return fmt.Errorf("unsupported BSON type %s for EpochTime", t)
}
