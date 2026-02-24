"""Training scenario schemas for pre-recorded training scenarios."""
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
    SYSTEM_ALERT = "system_alert"
    WEATHER_UPDATE = "weather_update"
    ATC_INSTRUCTION = "atc_instruction"


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
    waypoint_type: str  # fix, vor, ndb, airport, user
    target_altitude_ft: Optional[float] = None
    target_airspeed_kts: Optional[float] = None
    hold_pattern: bool = False
    notes: str = ""


@dataclass
class TimedEvent:
    """A timed event during the scenario."""
    time_offset_seconds: float  # seconds from scenario start
    event_type: EventType
    message: str
    audio_file: Optional[str] = None
    requires_acknowledgment: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EmergencyCondition:
    """Emergency condition configuration."""
    trigger_time_seconds: float
    emergency_type: str  # engine_failure, electrical_failure, vacuum_failure, etc.
    severity: str  # partial, complete
    affected_systems: list[str] = field(default_factory=list)
    recovery_possible: bool = True


@dataclass
class TrainingScenario:
    """Complete training scenario definition."""
    id: str
    title: str
    description: str
    scenario_type: ScenarioType
    difficulty: str  # beginner, intermediate, advanced
    estimated_duration_minutes: int
    initial_conditions: InitialConditions
    waypoints: list[Waypoint]
    events: list[TimedEvent]
    emergency_conditions: list[EmergencyCondition] = field(default_factory=list)
    learning_objectives: list[str] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    author: str = "Aviation Training Team"
    version: str = "1.0"


@dataclass
class ScenarioPlaybackState:
    """Current state of scenario playback."""
    scenario_id: str
    elapsed_time_seconds: float
    current_waypoint_index: int
    completed_events: list[int]  # indices of completed events
    triggered_emergencies: list[int]  # indices of triggered emergencies
    is_paused: bool
    is_complete: bool
    score: float = 0.0
    notes: list[str] = field(default_factory=list)
