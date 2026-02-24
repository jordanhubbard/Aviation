"""Training scenario data models."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ScenarioType(str, Enum):
    """Types of training scenarios."""
    PATTERN_WORK = "pattern_work"
    GPS_APPROACH = "gps_approach"
    CROSS_COUNTRY = "cross_country"
    EMERGENCY = "emergency"


class EventType(str, Enum):
    """Types of timed events in scenarios."""
    RADIO_CALL = "radio_call"
    CHECKLIST_REMINDER = "checklist_reminder"
    WEATHER_UPDATE = "weather_update"
    ATC_INSTRUCTION = "atc_instruction"
    SYSTEM_FAILURE = "system_failure"
    ALERT = "alert"
    WAYPOINT_REACHED = "waypoint_reached"


@dataclass
class Position:
    """Geographic position."""
    lat: float
    lon: float
    alt: float  # feet MSL


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    position: Position
    heading: float  # degrees
    airspeed: float  # knots
    altitude: float  # feet MSL
    fuel_level: float  # gallons
    aircraft_type: str = "C172"
    weather: dict[str, Any] = field(default_factory=dict)


@dataclass
class Waypoint:
    """A waypoint in the scenario route."""
    name: str
    position: Position
    altitude_constraint: float | None = None  # feet MSL
    speed_constraint: float | None = None  # knots
    waypoint_type: str = "fly_by"  # fly_by, fly_over
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event during the scenario."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    audio_file: str | None = None


@dataclass
class TrainingScenario:
    """A complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    duration_minutes: int
    initial_conditions: InitialConditions
    waypoints: list[Waypoint]
    events: list[TimedEvent]
    objectives: list[str] = field(default_factory=list)
    success_criteria: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert scenario to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "scenario_type": self.scenario_type.value,
            "difficulty": self.difficulty,
            "duration_minutes": self.duration_minutes,
            "initial_conditions": {
                "position": {
                    "lat": self.initial_conditions.position.lat,
                    "lon": self.initial_conditions.position.lon,
                    "alt": self.initial_conditions.position.alt,
                },
                "heading": self.initial_conditions.heading,
                "airspeed": self.initial_conditions.airspeed,
                "altitude": self.initial_conditions.altitude,
                "fuel_level": self.initial_conditions.fuel_level,
                "aircraft_type": self.initial_conditions.aircraft_type,
                "weather": self.initial_conditions.weather,
            },
            "waypoints": [
                {
                    "name": wp.name,
                    "position": {
                        "lat": wp.position.lat,
                        "lon": wp.position.lon,
                        "alt": wp.position.alt,
                    },
                    "altitude_constraint": wp.altitude_constraint,
                    "speed_constraint": wp.speed_constraint,
                    "waypoint_type": wp.waypoint_type,
                    "notes": wp.notes,
                }
                for wp in self.waypoints
            ],
            "events": [
                {
                    "time_offset": event.time_offset,
                    "event_type": event.event_type.value,
                    "message": event.message,
                    "data": event.data,
                    "audio_file": event.audio_file,
                }
                for event in self.events
            ],
            "objectives": self.objectives,
            "success_criteria": self.success_criteria,
            "metadata": self.metadata,
        }
