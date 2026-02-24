"""Training scenario schemas and data models."""
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


class EmergencyType(str, Enum):
    """Types of emergency scenarios."""
    ENGINE_FAILURE = "engine_failure"
    ELECTRICAL_FAILURE = "electrical_failure"
    LOST_PROCEDURES = "lost_procedures"
    DIVERSION = "diversion"


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
    time_of_day: str = "day"  # day, night, dawn, dusk


@dataclass
class Waypoint:
    """Navigation waypoint in a scenario."""
    name: str
    position: Position
    waypoint_type: str = "fix"  # fix, vor, ndb, airport, intersection
    altitude_constraint: float | None = None  # feet MSL
    speed_constraint: float | None = None  # knots
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event that occurs during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    duration: float = 0.0  # seconds, for events with duration


@dataclass
class TrainingScenario:
    """Complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    estimated_duration: float  # minutes
    initial_conditions: InitialConditions
    waypoints: list[Waypoint] = field(default_factory=list)
    events: list[TimedEvent] = field(default_factory=list)
    objectives: list[str] = field(default_factory=list)
    success_criteria: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ScenarioPlaybackState:
    """Current state during scenario playback."""
    scenario_id: str
    elapsed_time: float  # seconds
    current_waypoint_index: int
    completed_events: list[str]
    is_paused: bool
    is_complete: bool
    score: float = 0.0
    notes: list[str] = field(default_factory=list)
