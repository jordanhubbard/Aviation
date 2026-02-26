// Package formats handles telemetry data formats.

package formats

import (
	"encoding/json"
	"errors"
	"time"
)

// TelemetryFormat represents telemetry data in a standardized format.
type TelemetryFormat struct {
	Timestamp time.Time `json:"timestamp"`
	Altitude  float64   `json:"altitude"`
	Speed     float64   `json:"speed"`
	Heading   float64   `json:"heading"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
}

// ExportTelemetry exports telemetry data to JSON format.
func ExportTelemetry(t TelemetryFormat) (string, error) {
	jsonData, err := json.Marshal(t)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// ImportTelemetry imports telemetry data from JSON format.
func ImportTelemetry(jsonStr string) (TelemetryFormat, error) {
	var t TelemetryFormat
	if err := json.Unmarshal([]byte(jsonStr), &t); err != nil {
		return TelemetryFormat{}, err
	}
	if t.Timestamp.IsZero() {
		return TelemetryFormat{}, errors.New("invalid telemetry: missing timestamp")
	}
	return t, nil
}
