# Flight Dynamics API Layer

This package provides the backend API layer for flight dynamics services in the aviation monorepo.

## Overview

The Flight Dynamics API exposes endpoints for managing flight state, including initialization, updates, and reset functionality.

## Endpoints

### POST /init
Initialize flight dynamics state with provided data.

**Request Body:**
```json
{
  "data": {
    "altitude": 5000,
    "airspeed": 120,
    "heading": 180
  }
}
```

**Response:**
```json
{
  "status": "initialized",
  "data": {
    "altitude": 5000,
    "airspeed": 120,
    "heading": 180
  }
}
```

### POST /update
Update the current flight dynamics state.

**Request Body:**
```json
{
  "data": {
    "altitude": 5500,
    "airspeed": 125,
    "heading": 185
  }
}
```

**Response:**
```json
{
  "status": "updated",
  "data": {
    "altitude": 5500,
    "airspeed": 125,
    "heading": 185
  }
}
```

### POST /reset
Reset the flight dynamics state to initial values.

**Response:**
```json
{
  "status": "reset"
}
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the API

```bash
uvicorn api:app --reload
```

The API will be available at `http://localhost:8000`.

## Testing

```bash
pytest
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200 OK`: Successful request
- `400 Bad Request`: Invalid payload or missing required fields
- `500 Internal Server Error`: Server-side error

## Integration

This package is designed to be integrated with other aviation applications in the monorepo. Import and use the FastAPI app instance:

```python
from flight_dynamics.api import app
```
