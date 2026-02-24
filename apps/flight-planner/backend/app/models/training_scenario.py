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
    flaps: int  # degrees
    gear_down: bool
    engine_running: bool
    autopilot_engaged: bool
    nav_source: str  # GPS, VOR, LOC
    weather: dict[str, Any] = field(default_factory=dict)


@dataclass
class Waypoint:
    """A waypoint in the scenario route."""
    name: str
    position: Position
    altitude_constraint: float | None = None  # feet MSL
    speed_constraint: float | None = None  # knots
    waypoint_type: str = "flyover"  # flyover, flyby
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event that occurs during the scenario."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    audio_file: str | None = None
    requires_acknowledgment: bool = False


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
    success_criteria: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)
    author: str = "Aviation Team"
    version: str = "1.0"

    def get_event_at_time(self, elapsed_seconds: float) -> list[TimedEvent]:
        """Get events that should trigger at the given elapsed time."""
        return [
            event for event in self.events
            if abs(event.time_offset - elapsed_seconds) < 0.5
        ]

    def get_next_waypoint(self, current_index: int) -> Waypoint | None:
        """Get the next waypoint after the current index."""
        if current_index + 1 < len(self.waypoints):
            return self.waypoints[current_index + 1]
        return None
