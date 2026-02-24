"""Training Scenarios Schema Definitions."""
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
    """A timed event that occurs during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    duration: Optional[float] = None  # how long to display (seconds)
    audio_file: Optional[str] = None  # path to audio file for radio calls
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    lat: float
    lon: float
    alt: float  # feet MSL
    heading: float  # degrees
    speed: float  # knots
    fuel_level: float  # gallons
    aircraft_type: str = "C172"
    weather_conditions: str = "VFR"
    time_of_day: str = "day"  # day, night, dusk, dawn
    wind_direction: Optional[float] = None  # degrees
    wind_speed: Optional[float] = None  # knots
    visibility: Optional[float] = None  # statute miles
    ceiling: Optional[float] = None  # feet AGL


@dataclass
class TrainingScenario:
    """A complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    estimated_duration: float  # minutes
    initial_conditions: InitialConditions
    waypoints: List[Waypoint]
    events: List[TimedEvent]
    learning_objectives: List[str] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)
    emergency_type: Optional[EmergencyType] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScenarioPlaybackState:
    """Current state during scenario playback."""
    scenario_id: str
    current_time: float  # seconds from start
    is_paused: bool
    current_waypoint_index: int
    completed_events: List[int]  # indices of completed events
    current_position: Dict[str, float]  # lat, lon, alt
    current_speed: float
    current_heading: float
    fuel_remaining: float
    alerts_active: List[str]
