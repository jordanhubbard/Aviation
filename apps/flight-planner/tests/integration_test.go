// Integration tests for Flight Planner

package tests

import (
	"testing"
	"github.com/stretchr/testify/assert"
	"net/http"
	"net/http/httptest"
	"encoding/json"
	"flight-planner/app"
)

func TestCreateFlightPlan(t *testing.T) {
	// Setup
	server := httptest.NewServer(app.SetupRouter())
	defer server.Close()

	// Test data
	flightPlan := map[string]interface{}{
		"origin": "JFK",
		"destination": "LAX",
		"waypoints": []string{"ORD", "DEN"},
	}

	// Convert to JSON
	jsonData, err := json.Marshal(flightPlan)
	assert.NoError(t, err)

	// Make request
	resp, err := http.Post(server.URL+"/api/flightplans", "application/json", bytes.NewBuffer(jsonData))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Cleanup
	resp.Body.Close()
}

func TestReadFlightPlan(t *testing.T) {
	// Setup
	server := httptest.NewServer(app.SetupRouter())
	defer server.Close()

	// Test data
	flightPlanID := "12345"

	// Make request
	resp, err := http.Get(server.URL + "/api/flightplans/" + flightPlanID)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Parse response
	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	assert.NoError(t, err)
	assert.Equal(t, flightPlanID, result["id"])

	// Cleanup
	resp.Body.Close()
}

// Additional tests for update, delete, and other scenarios can be added similarly.
