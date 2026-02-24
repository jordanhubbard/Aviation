"""Training scenario data models."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


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
    INSTRUCTOR_NOTE = "instructor_note"
    WEATHER_UPDATE = "weather_update"
    SYSTEM_FAILURE = "system_failure"
    ATC_INSTRUCTION = "atc_instruction"


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
    fuel_gallons: float
    weight_lbs: float
    flaps_position: int  # 0-40 degrees
    gear_down: bool
    engine_running: bool
    time_of_day: str  # "day", "night", "dusk", "dawn"
    weather_preset: str  # "vmc", "mvfr", "ifr", "lifr"


@dataclass
class Waypoint:
    """A waypoint in the scenario route."""
    name: str
    position: Position
    waypoint_type: str  # "airport", "vor", "ndb", "fix", "gps"
    altitude_constraint: Optional[float] = None  # feet MSL
    speed_constraint: Optional[float] = None  # knots
    hold_pattern: bool = False
    hold_direction: Optional[str] = None  # "left", "right"
    notes: Optional[str] = None


@dataclass
class TimedEvent:
    """A timed event during the scenario."""
    time_offset_seconds: int  # seconds from scenario start
    event_type: EventType
    title: str
    message: str
    audio_file: Optional[str] = None
    requires_acknowledgment: bool = False
    trigger_condition: Optional[str] = None  # e.g., "altitude < 1000"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingScenario:
    """A complete training scenario."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # "beginner", "intermediate", "advanced"
    estimated_duration_minutes: int
    aircraft_type: str
    initial_conditions: InitialConditions
    waypoints: list[Waypoint]
    events: list[TimedEvent]
    learning_objectives: list[str]
    success_criteria: list[str]
    tags: list[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioPlaybackState:
    """Current state of scenario playback."""
    scenario_id: str
    elapsed_seconds: int
    current_waypoint_index: int
    completed_events: list[int]  # indices of completed events
    is_paused: bool
    is_complete: bool
    score: Optional[float] = None
    notes: list[str] = field(default_factory=list)
