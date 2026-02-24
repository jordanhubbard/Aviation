"""Training Scenarios Schema Definitions."""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum


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
    ALERT = "alert"
    WEATHER_CHANGE = "weather_change"
    SYSTEM_FAILURE = "system_failure"


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
    weather: Optional[Dict[str, Any]] = None


@dataclass
class Waypoint:
    """Waypoint in a training scenario."""
    name: str
    position: Position
    altitude_constraint: Optional[float] = None  # feet MSL
    speed_constraint: Optional[float] = None  # knots
    waypoint_type: str = "flyover"  # flyover, flyby
    notes: Optional[str] = None


@dataclass
class TimedEvent:
    """Timed event during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    severity: str = "info"  # info, warning, caution, emergency
    data: Optional[Dict[str, Any]] = None


@dataclass
class TrainingScenario:
    """Complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    duration_minutes: int
    initial_conditions: InitialConditions
    waypoints: List[Waypoint] = field(default_factory=list)
    events: List[TimedEvent] = field(default_factory=list)
    learning_objectives: List[str] = field(default_factory=list)
    success_criteria: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioPlaybackState:
    """Current state during scenario playback."""
    scenario_id: str
    elapsed_time: float  # seconds
    current_waypoint_index: int
    completed_events: List[int]  # indices of completed events
    is_paused: bool
    is_complete: bool
    score: Optional[float] = None
    feedback: List[str] = field(default_factory=list)
