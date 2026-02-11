# Integration Test Scenarios for Flight Planner

## WebSocket Telemetry Flows

### Scenario 1: Real-time Telemetry Data Transmission
- **Description**: Verify that real-time telemetry data is transmitted correctly from the backend to the frontend.
- **Steps**:
  1. Start the backend server.
  2. Connect the frontend to the backend using WebSocket.
  3. Simulate sending telemetry data from the backend.
  4. Verify that the frontend receives the telemetry data correctly.
- **Expected Outcome**: Frontend displays the correct telemetry data received from the backend.

### Scenario 2: Disconnection Handling
- **Description**: Verify that the system handles WebSocket disconnections gracefully.
- **Steps**:
  1. Start the backend server.
  2. Connect the frontend to the backend using WebSocket.
  3. Simulate a WebSocket disconnection.
  4. Verify that the frontend handles the disconnection without crashing.
- **Expected Outcome**: Frontend gracefully handles the disconnection and attempts to reconnect.

## Flight Plan CRUD Operations

### Scenario 3: Create a New Flight Plan
- **Description**: Verify that a new flight plan can be created successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to create a new flight plan.
  3. Verify that the flight plan is stored correctly in the database.
- **Expected Outcome**: New flight plan is created and stored in the database.

### Scenario 4: Retrieve a Flight Plan
- **Description**: Verify that an existing flight plan can be retrieved successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to retrieve a specific flight plan.
  3. Verify that the correct flight plan data is returned.
- **Expected Outcome**: Correct flight plan data is returned.

### Scenario 5: Update a Flight Plan
- **Description**: Verify that an existing flight plan can be updated successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to update a specific flight plan.
  3. Verify that the flight plan is updated correctly in the database.
- **Expected Outcome**: Flight plan is updated and stored in the database.

### Scenario 6: Delete a Flight Plan
- **Description**: Verify that an existing flight plan can be deleted successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to delete a specific flight plan.
  3. Verify that the flight plan is removed from the database.
- **Expected Outcome**: Flight plan is deleted from the database.

## Navigation Queries

### Scenario 7: Query for Nearby Airports
- **Description**: Verify that nearby airports can be queried successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to query for nearby airports based on a given location.
  3. Verify that the correct list of nearby airports is returned.
- **Expected Outcome**: Correct list of nearby airports is returned.

### Scenario 8: Query for Weather Information
- **Description**: Verify that weather information can be queried successfully.
- **Steps**:
  1. Start the backend server.
  2. Send a request to query for weather information based on a given location.
  3. Verify that the correct weather information is returned.
- **Expected Outcome**: Correct weather information is returned.
