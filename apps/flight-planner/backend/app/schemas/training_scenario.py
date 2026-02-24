"""Training scenario schemas for pre-recorded training scenarios."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any


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
    engine_running: bool = True
    flaps_position: int = 0  # degrees
    gear_down: bool = True
    autopilot_engaged: bool = False
    nav_source: str = "GPS"
    weather_conditions: Optional[Dict[str, Any]] = None


@dataclass
class Waypoint:
    """Waypoint in a training scenario."""
    name: str
    position: Position
    waypoint_type: str = "FIX"  # FIX, VOR, NDB, AIRPORT, USER
    altitude_constraint: Optional[float] = None  # feet MSL
    speed_constraint: Optional[float] = None  # knots
    hold_pattern: bool = False
    hold_direction: Optional[str] = None  # LEFT, RIGHT
    notes: Optional[str] = None


@dataclass
class TimedEvent:
    """Timed event during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: Optional[Dict[str, Any]] = None
    audio_file: Optional[str] = None
    requires_acknowledgment: bool = False


@dataclass
class TrainingScenario:
    """Complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    estimated_duration: int  # minutes
    initial_conditions: InitialConditions
    waypoints: List[Waypoint] = field(default_factory=list)
    events: List[TimedEvent] = field(default_factory=list)
    success_criteria: Optional[Dict[str, Any]] = None
    tags: List[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioPlaybackState:
    """Current state of scenario playback."""
    scenario_id: str
    is_playing: bool
    is_paused: bool
    elapsed_time: float  # seconds
    current_waypoint_index: int
    completed_events: List[str]
    pending_events: List[TimedEvent]
    current_position: Position
    current_heading: float
    current_airspeed: float
    current_altitude: float
    score: Optional[float] = None
    notes: List[str] = field(default_factory=list)
