# User Manual

## Introduction
This user manual provides detailed instructions on using the Primary Flight Display (PFD) and Multi-Function Display (MFD) systems, as well as setup and configuration guidance.

## Table of Contents
1. [Setup and Configuration](#setup-and-configuration)
2. [PFD Usage and Controls](#pfd-usage-and-controls)
3. [MFD Usage and Controls](#mfd-usage-and-controls)
4. [Training Scenarios](#training-scenarios)

## Setup and Configuration

Follow the steps outlined in the [Getting Started Guide](GETTING_STARTED.md) to set up and configure your environment.

### Prerequisites
- Node.js 20 or higher
- npm 9 or higher

### Installation
1. Clone the repository:
   ```bash
git clone https://github.com/jordanhubbard/Aviation.git
cd Aviation
```
2. Install dependencies:
   ```bash
npm install
```
3. Build all packages:
   ```bash
npm run build
```

### Running Your First Application
Navigate to the desired application directory and run it using npm:
```bash
cd apps/flight-tracker
npm start
```

### Setting Up API Keys
Refer to the [Getting Started Guide](GETTING_STARTED.md#setting-up-api-keys) for instructions on setting up API keys.

## PFD Usage and Controls

### Overview
The Primary Flight Display (PFD) provides essential flight information such as airspeed, altitude, heading, and attitude.

### Controls
- **Airspeed Indicator**: Displays the current airspeed of the aircraft.
- **Altitude Indicator**: Shows the current altitude above sea level.
- **Heading Indicator**: Indicates the magnetic heading of the aircraft.
- **Attitude Indicator**: Provides a visual representation of the aircraft's pitch and roll.

## MFD Usage and Controls

### Overview
The Multi-Function Display (MFD) offers additional flight information and control functions, including navigation, communication, and weather data.

### Controls
- **Navigation Page**: Allows users to input and view waypoints and flight plans.
- **Communication Page**: Facilitates radio communications with air traffic control and other aircraft.
- **Weather Page**: Displays real-time weather data and forecasts.

## Training Scenarios

Refer to the [Training Scenarios](TRAINING_SCENARIOS.md) document for detailed scenarios and exercises to enhance your skills in using the aviation applications.

### Scenario 1: Basic Takeoff and Landing
- **Objectives**: Understand pre-flight checks, perform a safe takeoff, and execute a stable landing.
- **Steps**: Conduct pre-flight checks, start the engine, taxi to the runway, perform a takeoff procedure, navigate to the practice area, and execute a stable landing.
- **Expected Outcomes**: Ability to perform a safe takeoff and landing, understanding of pre-flight procedures.

### Scenario 2: Navigation and Waypoint Planning
- **Objectives**: Learn to use navigation tools and plan and follow waypoints.
- **Steps**: Familiarize with the navigation interface, plan a route using waypoints, and follow the planned route in the simulator.
- **Expected Outcomes**: Proficiency in using navigation tools, ability to plan and follow waypoints accurately.

### Scenario 3: Emergency Procedures
- **Objectives**: Understand emergency procedures and practice responding to emergency situations.
- **Steps**: Identify potential emergency scenarios and practice responding to each scenario in the simulator.
- **Expected Outcomes**: Preparedness to handle emergency situations, quick and effective responses.
