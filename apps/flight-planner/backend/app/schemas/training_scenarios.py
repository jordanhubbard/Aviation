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
    SYSTEM_FAILURE = "system_failure"
    WEATHER_CHANGE = "weather_change"
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
    """A timed event that occurs during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    data: Optional[Dict[str, Any]] = None
    audio_file: Optional[str] = None  # path to audio file for radio calls


@dataclass
class InitialConditions:
    """Initial conditions for a training scenario."""
    lat: float
    lon: float
    alt: float  # feet MSL
    heading: float  # degrees
    speed: float  # knots
    fuel_level: float  # gallons
    weather: Optional[Dict[str, Any]] = None
    time_of_day: Optional[str] = None  # "day", "night", "dusk", "dawn"
    aircraft_type: Optional[str] = None


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
    waypoints: List[Waypoint] = field(default_factory=list)
    events: List[TimedEvent] = field(default_factory=list)
    learning_objectives: List[str] = field(default_factory=list)
    prerequisites: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    author: Optional[str] = None
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
    current_position: Dict[str, float]  # lat, lon, alt
    current_heading: float
    current_speed: float
    score: Optional[float] = None
    notes: List[str] = field(default_factory=list)
