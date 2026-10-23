// Package api defines REST API types and OpenAPI schema.

package api

// FlightPlan represents a flight plan in the API.
type FlightPlan struct {
	ID          string `json:"id"`
	Departure   string `json:"departure"`
	Destination string `json:"destination"`
	Aircraft    string `json:"aircraft"`
}

// TelemetryData represents telemetry data in the API.
type TelemetryData struct {
	Altitude  float64 `json:"altitude"`
	Speed     float64 `json:"speed"`
	Heading   float64 `json:"heading"`
}
