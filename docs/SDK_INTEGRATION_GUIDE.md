# SDK Integration Guide

## Overview
Welcome to the Aviation SDK Integration Guide. This document will help you integrate the shared SDK into your aviation application.

## SDK Modules and Usage
The SDK is modular and includes the following components:

- **Airport Database**: Comprehensive airport database with search and geospatial capabilities.
- **Navigation Utilities**: Tools for flight planning and navigation calculations.

### Airport Database
#### Description
The Airport Database provides comprehensive airport data with search and geospatial capabilities.

#### Usage
**TypeScript:*
```typescript
import { searchAirports, getAirportByCode, findNearbyAirports } from '@aviation/shared-sdk';

// Search by code, name, or city
const results = searchAirports('SFO', 20);

// Get specific airport
const airport = getAirportByCode('KSFO');

// Find nearby airports
const nearby = findNearbyAirports(37.6213, -122.3790, 50, 20);
```

**Python:*
```python
from aviation import search_airports, get_airport_by_code, find_nearby_airports

# Search by code, name, or city
results = search_airports('SFO', limit=20)

# Get specific airport
airport = get_airport_by_code('KSFO')

# Find nearby airports
nearby = find_nearby_airports(37.6213, -122.3790, radius_nm=50, limit=20)
```

### Navigation Utilities
#### Description
The Navigation Utilities provide comprehensive navigation calculations for flight planning.

#### Usage
**TypeScript:*
```typescript
import { distanceNM, initialBearing, fuelRequired, groundSpeed } from '@aviation/shared-sdk';

// Calculate distance and bearing from KSFO to KJFK
const distance = distanceNM(37.6213, -122.3790, 40.6413, -73.7781);
const bearing = initialBearing(37.6213, -122.3790, 40.6413, -73.7781);

// Calculate fuel required (450 kts GS, 12 GPH)
const fuel = fuelRequired(distance, 450, 12);
console.log(`${distance.toFixed(0)} NM at ${bearing.toFixed(0)}°`);
console.log(`Fuel: ${fuel.gallons.toFixed(1)} gal, Time: ${fuel.hours.toFixed(2)} hrs`);

// Wind correction
const gs = groundSpeed(450, 90, 270, 25); // TAS 450, course 90°, wind 270@25
```

**Python:*
```python
from aviation.navigation import distance_nm, initial_bearing, fuel_required, ground_speed

# Calculate distance and bearing
距离 = distance_nm(37.6213, -122.3790, 40.6413, -73.7781)
bearing = initial_bearing(37.6213, -122.3790, 40.6413, -73.7781)

# Calculate fuel required
fuel = fuel_required(distance, 450, 12)
print(f"{distance:.0f} NM at {bearing:.0f}°")
print(f"Fuel: {fuel['gallons']:.1f} gal, Time: {fuel['hours']:.2f} hrs")

# Wind correction
gs = ground_speed(450, 90, 270, 25)
```

## Initialization Examples
Here are some examples of how to initialize and use the SDK in different scenarios.

### Example 1: Basic Initialization
```python
from shared_sdk import initialize_sdk

sdk = initialize_sdk(api_key='your_api_key', base_url='https://api.aviation.com')
```

### Example 2: Initialization with Custom Configuration
```python
from shared_sdk import initialize_sdk
from shared_sdk.config import Config

custom_config = Config(api_key='your_api_key', base_url='https://api.aviation.com', timeout=30)
sdk = initialize_sdk(config=custom_config)
```

## Extension Points
The SDK provides several extension points for customization and enhancement.

### Extension Point A
#### Description
Extension Point A allows you to add custom mission validation logic.

#### Usage
```python
def custom_function(data):
    # Custom logic here
    pass

sdk.register_extension('extension_a', custom_function)
```

### Extension Point B
#### Description
Extension Point B enables you to customize flight tracking behavior.

#### Usage
```python
def another_custom_function(data):
    # Custom logic here
    pass

sdk.register_extension('extension_b', another_custom_function)
```

## Conclusion
This guide provides a basic overview of integrating the Aviation SDK into your application. For more detailed information, refer to the API documentation and source code.