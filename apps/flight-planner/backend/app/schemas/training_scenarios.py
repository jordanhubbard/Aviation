"""Training Scenarios Schema Definitions."""
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
class Waypoint:
    """A waypoint in a training scenario."""
    name: str
    lat: float
    lon: float
    alt: float  # feet MSL
    speed: float = 0.0  # knots
    heading: float = 0.0  # degrees
    hold_time: float = 0.0  # seconds to hold at waypoint
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: dict[str, Any] = field(default_factory=dict)
    duration: float = 0.0  # how long the event lasts (for alerts)


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    lat: float
    lon: float
    alt: float  # feet MSL
    heading: float  # degrees
    airspeed: float  # knots
    fuel_level: float  # gallons
    engine_running: bool = True
    flaps: int = 0  # degrees
    gear_down: bool = True
    autopilot_engaged: bool = False
    weather: dict[str, Any] = field(default_factory=dict)


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
    completed_events: list[int]  # indices of completed events
    is_paused: bool
    is_complete: bool
    score: float = 0.0
    deviations: list[dict[str, Any]] = field(default_factory=list)
