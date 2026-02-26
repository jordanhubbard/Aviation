"""Navigation data fixtures for E2E tests.

Provides seeded airport, VOR, and waypoint data.
"""

from typing import Dict, List, Any


class AirportFixture:
    """Fixture for airport data."""

    @staticmethod
    def get_airports() -> List[Dict[str, Any]]:
        """Return list of test airports."""
        return [
            {
                "icao": "KORD",
                "iata": "ORD",
                "name": "Chicago O'Hare International",
                "latitude": 41.9742,
                "longitude": -87.9073,
                "elevation_ft": 682,
                "runways": [
                    {"name": "04L", "length_ft": 10000, "surface": "asphalt"},
                    {"name": "04R", "length_ft": 10000, "surface": "asphalt"},
                    {"name": "10L", "length_ft": 9000, "surface": "asphalt"},
                ],
                "frequencies": {
                    "atis": 118.625,
                    "ground": 121.9,
                    "tower": 120.7,
                },
            },
            {
                "icao": "KJFK",
                "iata": "JFK",
                "name": "John F. Kennedy International",
                "latitude": 40.6413,
                "longitude": -73.7781,
                "elevation_ft": 13,
                "runways": [
                    {"name": "04L", "length_ft": 14572, "surface": "asphalt"},
                    {"name": "04R", "length_ft": 14511, "surface": "asphalt"},
                ],
                "frequencies": {
                    "atis": 118.025,
                    "ground": 121.75,
                    "tower": 120.05,
                },
            },
            {
                "icao": "KSFO",
                "iata": "SFO",
                "name": "San Francisco International",
                "latitude": 37.6213,
                "longitude": -122.3790,
                "elevation_ft": 8,
                "runways": [
                    {"name": "01L", "length_ft": 11065, "surface": "asphalt"},
                    {"name": "01R", "length_ft": 10601, "surface": "asphalt"},
                ],
                "frequencies": {
                    "atis": 118.625,
                    "ground": 121.8,
                    "tower": 120.5,
                },
            },
            {
                "icao": "KLAX",
                "iata": "LAX",
                "name": "Los Angeles International",
                "latitude": 33.9425,
                "longitude": -118.4081,
                "elevation_ft": 125,
                "runways": [
                    {"name": "24L", "length_ft": 12923, "surface": "asphalt"},
                    {"name": "24R", "length_ft": 12923, "surface": "asphalt"},
                ],
                "frequencies": {
                    "atis": 119.025,
                    "ground": 121.7,
                    "tower": 120.3,
                },
            },
        ]


class VORFixture:
    """Fixture for VOR navigation data."""

    @staticmethod
    def get_vors() -> List[Dict[str, Any]]:
        """Return list of test VORs."""
        return [
            {
                "identifier": "FOE",
                "name": "Foresee VOR",
                "latitude": 41.4611,
                "longitude": -88.2486,
                "frequency": 114.1,
                "magnetic_variation": 0.5,
            },
            {
                "identifier": "JFK",
                "name": "Kennedy VOR",
                "latitude": 40.7769,
                "longitude": -73.8740,
                "frequency": 115.9,
                "magnetic_variation": -12.0,
            },
            {
                "identifier": "SFO",
                "name": "San Francisco VOR",
                "latitude": 37.6213,
                "longitude": -122.3790,
                "frequency": 115.8,
                "magnetic_variation": 14.5,
            },
        ]


class WaypointFixture:
    """Fixture for waypoint data."""

    @staticmethod
    def get_waypoints() -> List[Dict[str, Any]]:
        """Return list of test waypoints."""
        return [
            {
                "identifier": "KORD",
                "type": "airport",
                "latitude": 41.9742,
                "longitude": -87.9073,
            },
            {
                "identifier": "KJFK",
                "type": "airport",
                "latitude": 40.6413,
                "longitude": -73.7781,
            },
            {
                "identifier": "KSFO",
                "type": "airport",
                "latitude": 37.6213,
                "longitude": -122.3790,
            },
            {
                "identifier": "KLAX",
                "type": "airport",
                "latitude": 33.9425,
                "longitude": -118.4081,
            },
        ]
