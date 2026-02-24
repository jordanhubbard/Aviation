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
    SYSTEM_ALERT = "system_alert"
    WEATHER_UPDATE = "weather_update"
    ATC_INSTRUCTION = "atc_instruction"


@dataclass
class Waypoint:
    """A waypoint in a training scenario."""
    name: str
    lat: float
    lon: float
    alt: float  # feet MSL
    speed: Optional[float] = None  # knots
    heading: Optional[float] = None  # degrees
    hold_time: Optional[float] = None  # seconds to hold at waypoint
    notes: Optional[str] = None


@dataclass
class TimedEvent:
    """A timed event during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    audio_file: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    lat: float
    lon: float
    alt: float  # feet MSL
    heading: float  # degrees
    airspeed: float  # knots
    fuel_level: float  # gallons
    weather: Dict[str, Any] = field(default_factory=dict)
    aircraft_config: Dict[str, Any] = field(default_factory=dict)


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
    waypoints: List[Waypoint]
    events: List[TimedEvent]
    objectives: List[str] = field(default_factory=list)
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
