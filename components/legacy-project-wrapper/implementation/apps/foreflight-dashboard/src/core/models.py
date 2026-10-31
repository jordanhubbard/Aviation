"""Data models for the ForeFlight Logbook Manager."""

from datetime import datetime, time, timezone, timedelta
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, validator
from dataclasses import dataclass
from aviation.logbook import LogbookTimeInput, validate_logbook_time
from .icao_validator import is_valid_icao_code, get_icao_info, suggest_similar_codes, get_validation_error_message

class Airport(BaseModel):
    """Airport information."""
    identifier: Optional[str] = None
    name: Optional[str] = None
    
    class Config:
        title = "Airport"
        description = "Airport information"

    def __bool__(self):
        """Return True if the airport has an identifier."""
        return bool(self.identifier)
    
    def to_dict(self) -> dict:
        """Convert the airport to a dictionary for JSON serialization."""
        return {
            'identifier': self.identifier,
            'name': self.name
        }

class Aircraft(BaseModel):
    """Aircraft information."""
    registration: str
    type: str
    icao_type_code: Optional[str] = None  # ICAO aircraft type designator (e.g., CH7A, C172)
    category_class: str
    gear_type: str = "tricycle"  # Default to tricycle gear since it's more common
    complex_aircraft: bool = False
    high_performance: bool = False
    
    class Config:
        title = "Aircraft"
        description = "Aircraft information"
    
    def to_dict(self) -> dict:
        """Convert the aircraft to a dictionary for JSON serialization."""
        return {
            'registration': self.registration,
            'type': self.type,
            'icao_type_code': self.icao_type_code,
            'category_class': self.category_class,
            'gear_type': self.gear_type,
            'complex_aircraft': self.complex_aircraft,
            'high_performance': self.high_performance
        }
    
class FlightConditions(BaseModel):
    """Flight conditions information."""
    day: float = 0.0
    night: float = 0.0
    actual_instrument: float = 0.0
    simulated_instrument: float = 0.0
    cross_country: float = 0.0
    
    class Config:
        title = "FlightConditions"
        description = "Flight conditions information"
    
    def to_dict(self) -> dict:
        """Convert the flight conditions to a dictionary for JSON serialization."""
        return {
            'day': self.day,
            'night': self.night,
            'actual_instrument': self.actual_instrument,
            'simulated_instrument': self.simulated_instrument,
            'cross_country': self.cross_country
        }
    
@dataclass
class RunningTotals:
    """Running totals for various flight metrics."""
    total_time: float = 0.0
    ground_training: float = 0.0
    asel_time: float = 0.0
    day_time: float = 0.0
    night_time: float = 0.0
    sim_instrument: float = 0.0
    dual_received: float = 0.0
    pic_time: float = 0.0
    cross_country: float = 0.0

class LogbookEntry(BaseModel):
    """Main logbook entry model."""
    id: Optional[str] = None
    date: datetime
    departure_time: Optional[time] = None
    arrival_time: Optional[time] = None
    total_time: float = Field(ge=0.0, description="Total flight time must be non-negative")
    
    # Aircraft information
    aircraft: Aircraft
    
    # Airport information
    departure: Optional[Airport] = None
    destination: Optional[Airport] = None
    alternate: Optional[Airport] = None
    
    # Flight conditions
    conditions: FlightConditions
    
    # Additional fields
    remarks: Optional[str] = None
    pilot_role: str = "PIC"
    is_student_pilot: bool = Field(default=False, exclude=True)
    dual_received: float = Field(ge=0.0, description="Dual received time must be non-negative")
    pic_time: float = Field(ge=0.0, description="PIC time must be non-negative")
    solo_time: float = Field(ge=0.0, description="Solo time must be non-negative")
    ground_training: float = Field(default=0.0, ge=0.0, description="Ground training time must be non-negative")
    landings_day: int = Field(ge=0, description="Day landings must be non-negative")
    landings_night: int = Field(ge=0, description="Night landings must be non-negative")
    instructor_name: Optional[str] = None
    instructor_comments: Optional[str] = None
    
    @validator('date')
    def validate_date_not_future(cls, v):
        """Validate that the flight date is not in the future."""
        current_utc = datetime.now(timezone.utc)
        # Ensure the date has timezone info for comparison
        date_to_check = v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v
        if date_to_check > current_utc:
            raise ValueError("Flight date cannot be in the future")
        return v
    
    @validator('pic_time', 'dual_received', 'solo_time')
    def validate_flight_times(cls, v, values):
        """Allow flight times to be validated in validate_entry."""
        return v
    
    @validator('pilot_role')
    def validate_pilot_role(cls, v):
        """Normalize pilot role without raising validation errors."""
        if isinstance(v, str):
            return v.upper()
        return v
    
    # Running totals
    running_totals: Optional[RunningTotals] = None
    
    # Validation error explanation
    error_explanation: Optional[str] = None
    
    # Validation warning explanation
    warning_explanation: Optional[str] = None
    
    def to_dict(self) -> dict:
        """Convert the entry to a dictionary for JSON serialization."""
        running_totals_dict = None
        if self.running_totals:
            running_totals_dict = {
                'ground_training': self.running_totals.ground_training,
                'asel_time': self.running_totals.asel_time,
                'day_time': self.running_totals.day_time,
                'night_time': self.running_totals.night_time,
                'sim_instrument': self.running_totals.sim_instrument,
                'dual_received': self.running_totals.dual_received,
                'pic_time': self.running_totals.pic_time,
                'cross_country': self.running_totals.cross_country
            }
        
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'departure_time': self.departure_time.isoformat() if self.departure_time else None,
            'arrival_time': self.arrival_time.isoformat() if self.arrival_time else None,
            'total_time': self.total_time,
            'aircraft': {
                'registration': self.aircraft.registration,
                'type': self.aircraft.type,
                'category_class': self.aircraft.category_class,
                'gear_type': self.aircraft.gear_type
            },
            'departure': {'identifier': self.departure.identifier} if self.departure else None,
            'destination': {'identifier': self.destination.identifier} if self.destination else None,
            'alternate': {'identifier': self.alternate.identifier} if self.alternate else None,
            'conditions': {
                'day': self.conditions.day,
                'night': self.conditions.night,
                'actual_instrument': self.conditions.actual_instrument,
                'simulated_instrument': self.conditions.simulated_instrument,
                'cross_country': self.conditions.cross_country
            },
            'remarks': self.remarks,
            'pilot_role': self.pilot_role,
            'dual_received': self.dual_received,
            'pic_time': self.pic_time,
            'solo_time': self.solo_time,
            'ground_training': self.ground_training,
            'landings_day': self.landings_day,
            'landings_night': self.landings_night,
            'instructor_name': self.instructor_name,
            'instructor_comments': self.instructor_comments,
            'running_totals': running_totals_dict,
            'error_explanation': self.error_explanation,
            'warning_explanation': self.warning_explanation
        }
    
    class Config:
        title = "LogbookEntry"
        description = "Main logbook entry model"
        schema_extra = {
            "example": {
                "date": "2023-11-01T14:00:00Z",
                "departure_time": "14:00:00",
                "arrival_time": "16:30:00",
                "total_time": 2.5,
                "aircraft": {
                    "registration": "N12345",
                    "type": "C172",
                    "category_class": "ASEL"
                },
                "departure": {
                    "identifier": "KBOS",
                    "name": "Boston Logan International"
                },
                "destination": {
                    "identifier": "KJFK",
                    "name": "John F Kennedy International"
                },
                "conditions": {
                    "day": 2.5,
                    "night": 0.0,
                    "actual_instrument": 0.5,
                    "simulated_instrument": 0.0,
                    "cross_country": 2.5
                },
                "pilot_role": "PIC",
                "landings_day": 1,
                "landings_night": 0,
                "dual_received": 0.0,
                "remarks": "Cross country flight BOS-JFK",
                "error_explanation": None,
                "warning_explanation": None
            }
        }

    def validate_entry(self) -> None:
        """Validate the entry and set error explanation if issues are found."""
        issues = []
        warnings = []

        if self.error_explanation:
            issues.extend([
                issue.strip()
                for issue in self.error_explanation.split(";")
                if issue.strip()
            ])

        current_utc = datetime.now(timezone.utc)
        if self.date.replace(tzinfo=timezone.utc) > current_utc:
            issues.append("Flight date cannot be in the future")
        
        # Check for missing airports (only for actual flights, not ground training)
        if self.total_time > 0:  # Only validate airports if there's flight time
            if not self.departure or not self.departure.identifier:
                issues.append("Missing departure airport")
            if not self.destination or not self.destination.identifier:
                issues.append("Missing destination airport")
            
        # Validate aircraft registration (tail number) - only for flights, not ground training
        if self.total_time > 0:  # Only validate aircraft for actual flights
            if not self.aircraft or not self.aircraft.registration:
                issues.append("Missing aircraft registration")
            elif not self.aircraft.registration.startswith(('N', 'C-', 'G-')):  # US, Canadian, or UK registrations
                issues.append(f"Invalid aircraft registration format: {self.aircraft.registration}")
        
        # Validate ICAO aircraft type code - only for flights, not ground training
        if self.total_time > 0 and self.aircraft and self.aircraft.icao_type_code:
            if not is_valid_icao_code(self.aircraft.icao_type_code):
                issues.append(get_validation_error_message(self.aircraft.icao_type_code))
            
        # Common duration accounting and consistency belong to aviation.logbook.
        common_validation = validate_logbook_time(
            LogbookTimeInput(
                total_time=self.total_time,
                pic_time=self.pic_time,
                dual_received_time=self.dual_received,
                solo_time=self.solo_time,
                day_time=self.conditions.day,
                night_time=self.conditions.night,
                actual_instrument_time=self.conditions.actual_instrument,
                simulated_instrument_time=self.conditions.simulated_instrument,
                cross_country_time=self.conditions.cross_country,
                night_landings=self.landings_night or 0,
                pilot_role=self.pilot_role,
                student_pilot=self.is_student_pilot,
            )
        )
        self.pilot_role = common_validation.normalized_pilot_role
        self.pic_time = common_validation.normalized_pic_time
        issues.extend(
            issue.message
            for issue in common_validation.issues
            if issue.severity == "error"
        )
        warnings.extend(
            issue.message
            for issue in common_validation.issues
            if issue.severity == "warning"
        )

        # Check cross-country time validity
        if self.conditions.cross_country > 0:
            # Cross-country flights with same departure and destination are valid if there are intermediate stops
            # or if the route indicates multiple airports were visited
            if (self.departure and self.destination and 
                self.departure.identifier and self.destination.identifier and
                self.departure.identifier == self.destination.identifier):
                
                # Check if remarks indicate intermediate airports or route details
                has_route_info = False
                if self.remarks:
                    # Look for indicators of intermediate stops or route planning
                    route_indicators = ['-', '→', 'via', 'VIA', 'stop', 'STOP', 'fuel', 'FUEL']
                    has_route_info = any(indicator in self.remarks for indicator in route_indicators)
                    
                    # Also look for airport identifier patterns (3-4 character codes)
                    import re
                    # Pattern for airport identifiers: K followed by 3 letters, or 3-4 alphanumeric codes
                    airport_pattern = r'\b([K][A-Z]{3}|[A-Z0-9]{3,4})\b'
                    airport_matches = re.findall(airport_pattern, self.remarks.upper())
                    
                    # Remove departure and destination from matches to find intermediate airports
                    departure_id = self.departure.identifier.upper() if self.departure and self.departure.identifier else ""
                    destination_id = self.destination.identifier.upper() if self.destination and self.destination.identifier else ""
                    
                    intermediate_airports = [apt for apt in airport_matches 
                                           if apt != departure_id and apt != destination_id]
                    
                    # If we found intermediate airports, it's a valid route
                    if intermediate_airports:
                        has_route_info = True
                    
                    # Also check distance - if >25nm, likely not pattern work even without explicit route info
                    if 'Distance:' in self.remarks:
                        try:
                            distance_str = self.remarks.split('Distance:')[1].split('nm')[0].strip()
                            distance = float(distance_str)
                            if distance > 25:  # Reasonable threshold for non-pattern work
                                has_route_info = True
                        except Exception:
                            pass
                
                # Only flag as error if no route information suggests intermediate stops
                if not has_route_info:
                    issues.append("Cross-country time logged for flight with same departure and destination airport and no intermediate stops indicated")
        
        # Check distance requirement for certificate requirements (>50nm for private/instrument/commercial)
        if self.conditions.cross_country > 0 and 'Distance:' in (self.remarks or ''):
            try:
                distance_str = self.remarks.split('Distance:')[1].split('nm')[0].strip()
                distance = float(distance_str)
                if distance < 50:
                    warnings.append(f"Cross-country flight under 50nm ({distance}nm) - valid for logbook but may not count toward private/instrument/commercial certificate requirements")
            except Exception:
                pass

        # Set error explanation if issues were found
        if issues:
            self.error_explanation = "; ".join(issues)
        else:
            self.error_explanation = None
            
        # Set warning explanation if warnings were found
        if warnings:
            self.warning_explanation = "; ".join(warnings)
        else:
            self.warning_explanation = None 

# InstructorEndorsement is now defined as a SQLAlchemy model in src.core.database
