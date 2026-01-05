"""Importer for ForeFlight logbook CSV exports."""

import pandas as pd
from datetime import datetime, time
from typing import List, Dict, Any
from ..core.models import LogbookEntry, Aircraft, Airport, FlightConditions

class ForeFlightImporter:
    """Importer for ForeFlight logbook CSV exports."""
    
    def __init__(self, csv_path: str):
        """Initialize importer with CSV file path and parse both Aircraft and Flights tables."""
        self.csv_path = csv_path
        self.aircraft_df, self.flights_df = self._parse_foreflight_csv(csv_path)

    def _parse_foreflight_csv(self, csv_path: str):
        """Parse ForeFlight CSV and return (aircraft_df, flights_df)."""
        import csv
        import io
        aircraft_lines = []
        flights_lines = []
        section = None
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            for line in f:
                if 'Aircraft Table' in line:
                    section = 'aircraft'
                    continue
                if 'Flights Table' in line:
                    section = 'flights'
                    continue
                if section == 'aircraft':
                    aircraft_lines.append(line)
                elif section == 'flights':
                    flights_lines.append(line)
        # Remove empty lines
        aircraft_lines = [l for l in aircraft_lines if l.strip()]
        flights_lines = [l for l in flights_lines if l.strip()]
        # Parse as CSV
        aircraft_df = pd.read_csv(io.StringIO(''.join(aircraft_lines))) if aircraft_lines else pd.DataFrame()
        flights_df = pd.read_csv(io.StringIO(''.join(flights_lines))) if flights_lines else pd.DataFrame()
        return aircraft_df, flights_df

    def get_aircraft_list(self):
        """Return list of Aircraft model objects from aircraft_df."""
        aircraft_list = []
        for _, row in self.aircraft_df.iterrows():
            if pd.isna(row['AircraftID']) or not str(row['AircraftID']).strip():
                continue
            # Check complex and high performance flags
            complex_aircraft = False
            high_performance = False
            
            if 'complexAircraft (FAA)' in row and pd.notna(row['complexAircraft (FAA)']):
                complex_aircraft = str(row['complexAircraft (FAA)']).strip().upper() == 'TRUE'
            
            if 'highPerformance (FAA)' in row and pd.notna(row['highPerformance (FAA)']):
                high_performance = str(row['highPerformance (FAA)']).strip().upper() == 'TRUE'
            
            aircraft_list.append(Aircraft(
                registration=str(row['AircraftID']).strip(),
                type=str(row['Model']) if pd.notna(row['Model']) else 'UNKNOWN',
                category_class=str(row['aircraftClass (FAA)']) if 'aircraftClass (FAA)' in row and pd.notna(row['aircraftClass (FAA)']) else 'airplane_single_engine_land',
                gear_type=str(row['GearType']) if 'GearType' in row and pd.notna(row['GearType']) else 'tricycle',
                complex_aircraft=complex_aircraft,
                high_performance=high_performance
            ))
        return aircraft_list

    def get_flight_entries(self):
        """Return list of LogbookEntry model objects from flights_df."""
        return self.import_entries()

    def _clean_numeric(self, value) -> int:
        """Clean and convert a value to integer, handling invalid values."""
        if pd.isna(value) or value == '':
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            # Remove any non-numeric characters
            cleaned = ''.join(c for c in value if c.isdigit())
            try:
                return int(cleaned) if cleaned else 0
            except (ValueError, TypeError):
                return 0
        return 0

    def _clean_float(self, value, default: float = 0.0) -> float:
        """Clean and convert a value to float, handling invalid values."""
        if pd.isna(value) or value == '':
            return default
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Remove any non-numeric characters except . and -
            cleaned = ''.join(c for c in value if c.isdigit() or c in '.-')
            try:
                return float(cleaned) if cleaned else default
            except (ValueError, TypeError):
                return default
        return default

    def _parse_time(self, value):
        """Parse a string time (HH:MM or HH:MM:SS) into a time object."""
        if not value or str(value).lower() in ('nan', 'none', ''):
            return None
        try:
            parts = [int(p) for p in str(value).strip().split(':')]
            if len(parts) == 2:
                return time(parts[0], parts[1])
            elif len(parts) == 3:
                return time(parts[0], parts[1], parts[2])
        except Exception:
            return None
        return None

    def _create_aircraft_dict(self) -> Dict[str, Aircraft]:
        """Create a dictionary of aircraft from the aircraft_df."""
        aircraft_dict = {}
        for _, row in self.aircraft_df.iterrows():
            if pd.notna(row['AircraftID']):
                aircraft_id = str(row['AircraftID']).strip()
                if aircraft_id not in aircraft_dict:
                    # Check complex and high performance flags
                    complex_aircraft = False
                    high_performance = False
                    
                    if 'complexAircraft (FAA)' in row and pd.notna(row['complexAircraft (FAA)']):
                        complex_aircraft = str(row['complexAircraft (FAA)']).strip().upper() == 'TRUE'
                    
                    if 'highPerformance (FAA)' in row and pd.notna(row['highPerformance (FAA)']):
                        high_performance = str(row['highPerformance (FAA)']).strip().upper() == 'TRUE'
                    
                    # Get ICAO type code if available
                    icao_type_code = None
                    if 'TypeCode' in row and pd.notna(row['TypeCode']):
                        icao_type_code = str(row['TypeCode']).strip()
                    
                    aircraft_dict[aircraft_id] = Aircraft(
                        registration=aircraft_id,
                        type=str(row['Model']) if pd.notna(row['Model']) else 'UNKNOWN',
                        icao_type_code=icao_type_code,
                        category_class=str(row['aircraftClass (FAA)']) if 'aircraftClass (FAA)' in row and pd.notna(row['aircraftClass (FAA)']) else 'airplane_single_engine_land',
                        gear_type=str(row['GearType']) if 'GearType' in row and pd.notna(row['GearType']) else 'tricycle',
                        complex_aircraft=complex_aircraft,
                        high_performance=high_performance
                    )
        return aircraft_dict

    def import_entries(self) -> List[LogbookEntry]:
        """Import all logbook entries from the CSV."""
        try:
            entries = []
            aircraft_dict = self._create_aircraft_dict()
            
            for idx, row in self.flights_df.iterrows():
                try:
                    # Validate required fields
                    if pd.isna(row['Date']):
                        raise ValueError(f"Missing date in flight {idx + 1}")
                    
                    # Create airports
                    departure = Airport(identifier=row['From'].strip() if isinstance(row['From'], str) else None) if pd.notna(row['From']) else None
                    destination = Airport(identifier=row['To'].strip() if isinstance(row['To'], str) else None) if pd.notna(row['To']) else None
                    
                    # No TimeOut/TimeIn in ForeFlight CSV: set times to None
                    departure_time = None
                    arrival_time = None
                    
                    # Clean numeric values with better error handling
                    total_time = self._clean_float(row['TotalTime'])
                    night_time = self._clean_float(row['Night'])
                    actual_inst = self._clean_float(row['ActualInstrument'])
                    sim_inst = self._clean_float(row['SimulatedInstrument'])
                    cross_country = self._clean_float(row['CrossCountry'])
                    dual_given = self._clean_float(row['DualGiven'])
                    pic_time = self._clean_float(row['PIC'])
                    sic_time = self._clean_float(row['SIC'])
                    dual_received = self._clean_float(row.get('DualReceived', 0.0))
                    solo_time = self._clean_float(row.get('Solo', 0.0))
                    
                    # Determine pilot role
                    if dual_given > 0:
                        pilot_role = "INSTRUCTOR"
                    elif dual_received > 0:
                        pilot_role = "STUDENT"
                    elif pic_time > 0:
                        pilot_role = "PIC"
                    elif sic_time > 0:
                        pilot_role = "SIC"
                    else:
                        pilot_role = "PIC"  # Default to PIC
                    
                    # Create flight conditions
                    conditions = FlightConditions(
                        night=night_time,
                        day=total_time - night_time,
                        actual_instrument=actual_inst,
                        simulated_instrument=sim_inst,
                        cross_country=cross_country
                    )
                    
                    # Aircraft mapping (robust):
                    aircraft_id = str(row['AircraftID']).strip() if pd.notna(row['AircraftID']) else ''
                    if aircraft_id in aircraft_dict:
                        aircraft_obj = aircraft_dict[aircraft_id]
                    else:
                        aircraft_obj = Aircraft(registration=aircraft_id or 'UNKNOWN', type='UNKNOWN', category_class='UNKNOWN', gear_type='UNKNOWN')

                    entry = LogbookEntry(
                        date=datetime.strptime(str(row['Date']).strip(), "%Y-%m-%d"),
                        departure_time=departure_time,
                        arrival_time=arrival_time,
                        total_time=total_time,
                        aircraft=aircraft_obj,
                        departure=departure,
                        destination=destination,
                        conditions=conditions,
                        pilot_role=pilot_role,
                        landings_day=self._clean_numeric(row['DayLandingsFullStop']),
                        landings_night=self._clean_numeric(row['NightLandingsFullStop']),
                        remarks=f"Distance: {self._clean_float(row.get('Distance', 0.0))}nm\n{str(row['PilotComments']) if pd.notna(row['PilotComments']) else None or str(row['InstructorComments']) if pd.notna(row['InstructorComments']) else None or 'No remarks'}",
                        instructor_comments=str(row['InstructorComments']) if pd.notna(row['InstructorComments']) else None,
                        dual_received=dual_received,
                        pic_time=pic_time,
                        solo_time=solo_time
                    )
                    
                    entries.append(entry)
                    
                except Exception as e:
                    raise ValueError(f"Error processing flight {idx + 1}: {str(e)}")
                
            if not entries:
                raise ValueError("No valid entries found in the logbook")
            
            return entries
            
        except Exception as e:
            raise ValueError(f"Error importing entries: {str(e)}")