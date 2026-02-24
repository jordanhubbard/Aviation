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
    SYSTEM_ALERT = "system_alert"
    INSTRUCTOR_NOTE = "instructor_note"


@dataclass
class Position:
    """Geographic position."""
    latitude: float
    longitude: float
    altitude_ft: float


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    position: Position
    heading: float  # degrees
    airspeed_kts: float
    vertical_speed_fpm: float = 0.0
    fuel_gallons: float = 40.0
    weight_lbs: float = 2400.0
    flaps_position: int = 0
    gear_down: bool = True
    engine_running: bool = True
    time_of_day: str = "day"  # day, night, dawn, dusk
    weather_preset: str = "vfr"  # vfr, mvfr, ifr, lifr


@dataclass
class Waypoint:
    """A waypoint in the scenario route."""
    name: str
    position: Position
    waypoint_type: str  # airport, navaid, fix, user
    target_altitude_ft: float | None = None
    target_airspeed_kts: float | None = None
    hold_pattern: bool = False
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event during the scenario."""
    time_offset_seconds: float
    event_type: EventType
    message: str
    audio_file: str | None = None
    requires_acknowledgment: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingScenario:
    """A complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    estimated_duration_minutes: int
    initial_conditions: InitialConditions
    waypoints: list[Waypoint]
    events: list[TimedEvent]
    learning_objectives: list[str] = field(default_factory=list)
    prerequisites: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioPlaybackState:
    """Current state of scenario playback."""
    scenario_id: str
    is_playing: bool = False
    is_paused: bool = False
    elapsed_seconds: float = 0.0
    current_waypoint_index: int = 0
    completed_events: list[int] = field(default_factory=list)
    current_position: Position | None = None
    score: float = 100.0
    notes: list[str] = field(default_factory=list)
