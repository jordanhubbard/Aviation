# E2E Test Flows for G1000 Simulator

## Startup Flow
1. **Start the Simulator**: Launch the G1000 simulator application.
2. **Verify Initial State**: Ensure the PFD and MFD display default values and states.
3. **Load Configuration**: Load the default configuration settings.
4. **Verify Configuration**: Confirm that the configuration settings are correctly applied.

## Flight Plan Flow
1. **Create Flight Plan**: Input a new flight plan with waypoints.
2. **Verify Waypoints**: Ensure the waypoints are correctly displayed on the MFD.
3. **Activate Flight Plan**: Activate the flight plan.
4. **Verify Activation**: Confirm that the flight plan is active and the PFD/MFD reflect the planned route.

## Approach Flow
1. **Initiate Approach**: Select an approach procedure from the MFD.
2. **Verify Approach Data**: Ensure the approach data is correctly displayed on the PFD and MFD.
3. **Execute Approach**: Follow the approach procedure as guided by the PFD/MFD.
4. **Verify Completion**: Confirm successful completion of the approach procedure.

## Expected UI States
- **PFD/MFD Display**: Ensure that the Primary Flight Display (PFD) and Multi-Function Display (MFD) show correct information at each step.
- **User Interaction**: Verify that user interactions with the PFD/MFD are responsive and accurate.
- **Error Handling**: Ensure that the simulator handles errors gracefully and provides appropriate feedback to the user.
