"""Training scenario schemas for pre-recorded training scenarios."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


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
    ENGINE_FAILURE = "engine_failure"
    ELECTRICAL_FAILURE = "electrical_failure"
    NAVIGATION_FAILURE = "navigation_failure"


class WaypointType(str, Enum):
    """Types of waypoints."""
    AIRPORT = "airport"
    VOR = "vor"
    NDB = "ndb"
    FIX = "fix"
    GPS = "gps"
    PATTERN_POINT = "pattern_point"


class Waypoint(BaseModel):
    """A waypoint in the scenario route."""
    name: str
    lat: float
    lon: float
    alt: float  # feet MSL
    waypoint_type: WaypointType = WaypointType.GPS
    speed: Optional[float] = None  # knots
    heading: Optional[float] = None  # degrees
    notes: Optional[str] = None


class TimedEvent(BaseModel):
    """A timed event that occurs during scenario playback."""
    time_offset: float  # seconds from scenario start
    event_type: EventType
    message: str
    audio_file: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None  # seconds


class InitialConditions(BaseModel):
    """Initial conditions for the scenario."""
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
    weather: Optional[Dict[str, Any]] = None


class TrainingScenario(BaseModel):
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
    objectives: List[str]
    success_criteria: Optional[Dict[str, Any]] = None
    tags: List[str] = []
    author: str = "Aviation Training Team"
    version: str = "1.0"


class ScenarioPlaybackState(BaseModel):
    """Current state of scenario playback."""
    scenario_id: str
    is_playing: bool = False
    is_paused: bool = False
    current_time: float = 0.0  # seconds
    current_waypoint_index: int = 0
    completed_events: List[int] = []
    score: float = 0.0
    notes: List[str] = []


class ScenarioListItem(BaseModel):
    """Summary of a scenario for listing."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str
    duration_minutes: int
    tags: List[str]
