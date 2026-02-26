// Package formats handles various data formats including flight plan import/export.

package formats

import (
	"encoding/json"
	"errors"
)

// FlightPlanFormat represents a flight plan in a standardized format.
type FlightPlanFormat struct {
	ID          string   `json:"id"`
	Departure   string   `json:"departure"`
	Destination string   `json:"destination"`
	Waypoints   []string `json:"waypoints"`
	Aircraft    string   `json:"aircraft"`
}

// ExportFlightPlan exports a flight plan to JSON format.
func ExportFlightPlan(fp FlightPlanFormat) (string, error) {
	jsonData, err := json.Marshal(fp)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// ImportFlightPlan imports a flight plan from JSON format.
func ImportFlightPlan(jsonStr string) (FlightPlanFormat, error) {
	var fp FlightPlanFormat
	if err := json.Unmarshal([]byte(jsonStr), &fp); err != nil {
		return FlightPlanFormat{}, err
	}
	if fp.ID == "" || fp.Departure == "" || fp.Destination == "" {
		return FlightPlanFormat{}, errors.New("invalid flight plan: missing required fields")
	}
	return fp, nil
}
