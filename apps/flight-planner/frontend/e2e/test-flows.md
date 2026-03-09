# E2E Test Flows for Simulator Scenarios

## Startup Flow
1. Navigate to the simulator page.
2. Verify the initial UI state displays 'Simulator Startup'.
3. Click 'Start Simulator'.
4. Confirm the simulator is running by checking for 'Simulator Running'.

## Flight Plan Flow
1. Navigate to the flight planner page.
2. Fill in the 'Origin' with 'KSFO' and 'Destination' with 'KLAX'.
3. Click 'Create Flight Plan'.
4. Verify the flight plan details are displayed with the route 'KSFO to KLAX'.

## Approach Flow
1. Navigate to the simulator page.
2. Click 'Start Approach'.
3. Confirm 'Approach in Progress' is visible.
4. Click 'Complete Approach'.
5. Verify 'Approach Completed' is visible.

## PFD/MFD Interactions
1. Navigate to the simulator page.
2. Click 'Toggle PFD' and verify 'PFD Active' is visible.
3. Click 'Toggle MFD' and verify 'MFD Active' is visible.

## Expected UI States
- Simulator Startup: 'Simulator Startup' heading visible.
- Simulator Running: 'Simulator Running' text visible.
- Flight Plan Details: 'Flight Plan Details' heading and route text visible.
- Approach in Progress: 'Approach in Progress' text visible.
- Approach Completed: 'Approach Completed' text visible.
- PFD Active: 'PFD Active' text visible.
- MFD Active: 'MFD Active' text visible.
