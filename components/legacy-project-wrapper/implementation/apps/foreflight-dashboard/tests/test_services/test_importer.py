import os
import tempfile
import pandas as pd
from src.services.importer import ForeFlightImporter
from src.core.models import Aircraft, LogbookEntry

def sample_foreflight_csv():
    return (
        'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Aircraft Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA),,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'N198JJ,8KCAB,,American Champion,8KCAB,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Flights Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
        '2023-01-01,N125CM,KOAK,KSFO,2.0,0.0,0.0,0.0,0.0,0.0,2.0,0.0,0.0,2.0,1,0,First solo,,10\n'
        '2023-01-02,N198JJ,KSFO,KOAK,1.5,0.0,0.0,0.0,0.0,0.0,1.5,0.0,0.0,1.5,1,0,,Instructor comment,8\n'
    )

def sample_foreflight_csv_dual_received():
    return (
        'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Aircraft Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA),,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'N12345,C172,1980,Cessna,172,fixed_tricycle,Piston,aircraft,airplane_single_engine_land,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Flights Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n'
        'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
        '2023-01-03,N12345,KOAK,KSFO,1.5,0.0,0.0,0.0,0.0,0.0,1.5,0.0,1.5,0.0,1,0,Training flight,,12\n'
    )

def test_importer_parses_both_tables():
    # Write sample CSV to temp file
    with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.csv') as f:
        f.write(sample_foreflight_csv())
        f.flush()
        path = f.name
    try:
        importer = ForeFlightImporter(path)
        # Check aircraft_df
        aircraft = importer.get_aircraft_list()
        assert len(aircraft) == 2
        assert any(a.registration == 'N125CM' for a in aircraft)
        assert any(a.registration == 'N198JJ' for a in aircraft)
        # Check flights_df
        flights = importer.get_flight_entries()
        assert len(flights) == 2
        assert isinstance(flights[0], LogbookEntry)
        assert flights[0].aircraft.registration == 'N125CM'
        assert flights[1].aircraft.registration == 'N198JJ'
    finally:
        os.unlink(path)

def test_importer_dual_received_role_for_certificated_pilot():
    with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.csv') as f:
        f.write(sample_foreflight_csv_dual_received())
        f.flush()
        path = f.name
    try:
        importer = ForeFlightImporter(path, student_pilot=False)
        flights = importer.get_flight_entries()
        assert len(flights) == 1
        assert flights[0].pilot_role == 'DUAL'
    finally:
        os.unlink(path)

def test_importer_dual_received_role_for_student_pilot():
    with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.csv') as f:
        f.write(sample_foreflight_csv_dual_received())
        f.flush()
        path = f.name
    try:
        importer = ForeFlightImporter(path, student_pilot=True)
        flights = importer.get_flight_entries()
        assert len(flights) == 1
        assert flights[0].pilot_role == 'STUDENT'
    finally:
        os.unlink(path)


def test_importer_flags_invalid_numeric_values():
    csv_content = sample_foreflight_csv().replace(
        '2023-01-01,N125CM,KOAK,KSFO,2.0,',
        '2023-01-01,N125CM,KOAK,KSFO,not-a-number,',
    )
    with tempfile.NamedTemporaryFile('w+', delete=False, suffix='.csv') as f:
        f.write(csv_content)
        f.flush()
        path = f.name

    try:
        entry = ForeFlightImporter(path).get_flight_entries()[0]

        assert entry.total_time == 0.0
        assert entry.error_explanation == 'Invalid numeric value for TotalTime: not-a-number'
    finally:
        os.unlink(path)
