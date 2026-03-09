"""Training scenario models for pre-recorded flight training."""
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
    INSTRUCTOR_NOTE = "instructor_note"
    SYSTEM_ALERT = "system_alert"
    WEATHER_UPDATE = "weather_update"
    ATC_INSTRUCTION = "atc_instruction"


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
    flaps: int  # degrees
    gear_down: bool
    engine_running: bool
    time_of_day: str  # "day", "night", "dusk", "dawn"
    weather_conditions: str  # "VFR", "MVFR", "IFR", "LIFR"
    wind_direction: float  # degrees
    wind_speed: float  # knots
    visibility: float  # statute miles
    ceiling: Optional[float] = None  # feet AGL, None for clear


@dataclass
class Waypoint:
    """A waypoint in the scenario route."""
    name: str
    position: Position
    waypoint_type: str  # "airport", "navaid", "fix", "user"
    expected_altitude: Optional[float] = None
    expected_airspeed: Optional[float] = None
    notes: Optional[str] = None


@dataclass
class TimedEvent:
    """A timed event during the scenario."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    audio_file: Optional[str] = None
    requires_acknowledgment: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingScenario:
    """A complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # "beginner", "intermediate", "advanced"
    estimated_duration: int  # minutes
    initial_conditions: InitialConditions
    waypoints: List[Waypoint]
    events: List[TimedEvent]
    learning_objectives: List[str]
    prerequisites: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioProgress:
    """Tracks progress through a scenario."""
    scenario_id: str
    current_time: float  # seconds
    current_waypoint_index: int
    completed_events: List[int]  # indices of completed events
    is_paused: bool
    is_complete: bool
    score: Optional[float] = None
    notes: List[str] = field(default_factory=list)
