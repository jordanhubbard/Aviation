"""E2E test fixtures for flight-planner application.

Provides seeded flight plans, navigation data, and demo scenarios for testing.
"""

import json
from datetime import datetime
from typing import Dict, List, Any


class FlightPlanFixture:
    """Fixture for seeded flight plans."""

    @staticmethod
    def simple_vfr_flight() -> Dict[str, Any]:
        """Simple VFR flight plan: KORD to KJFK."""
        return {
            "id": "fp-001",
            "name": "Chicago to New York VFR",
            "origin": {
                "icao": "KORD",
                "name": "Chicago O'Hare International",
                "latitude": 41.9742,
                "longitude": -87.9073,
                "elevation_ft": 682,
            },
            "destination": {
                "icao": "KJFK",
                "name": "John F. Kennedy International",
                "latitude": 40.6413,
                "longitude": -73.7781,
                "elevation_ft": 13,
            },
            "waypoints": [
                {
                    "sequence": 1,
                    "identifier": "KORD",
                    "type": "airport",
                    "latitude": 41.9742,
                    "longitude": -87.9073,
                },
                {
                    "sequence": 2,
                    "identifier": "FOE",
                    "type": "vor",
                    "latitude": 41.4611,
                    "longitude": -88.2486,
                    "frequency": 114.1,
                },
            ],
            "total_distance_nm": 336.1,
            "total_time_min": 268,
            "aircraft_type": "C172",
            "cruise_speed_kts": 90,
            "fuel_required_gal": 32.0,
            "created_at": "2024-01-15T10:30:00Z",
        }

    @staticmethod
    def cross_country_flight() -> Dict[str, Any]:
        """Cross-country flight plan: KSFO to KLAX."""
        return {
            "id": "fp-002",
            "name": "San Francisco to Los Angeles",
            "origin": {
                "icao": "KSFO",
                "name": "San Francisco International",
                "latitude": 37.6213,
                "longitude": -122.3790,
                "elevation_ft": 8,
            },
            "destination": {
                "icao": "KLAX",
                "name": "Los Angeles International",
                "latitude": 33.9425,
                "longitude": -118.4081,
                "elevation_ft": 125,
            },
            "total_distance_nm": 305.0,
            "total_time_min": 244,
            "aircraft_type": "C182",
            "cruise_speed_kts": 120,
            "fuel_required_gal": 48.0,
            "created_at": "2024-01-16T08:00:00Z",
        }
