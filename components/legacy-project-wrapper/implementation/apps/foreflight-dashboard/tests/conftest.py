"""Test configuration and fixtures."""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock
import shutil
from pathlib import Path

# Import applications
from src.main import app as fastapi_app

@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def sample_csv_content():
    """Sample ForeFlight CSV content for testing."""
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

@pytest.fixture
def sample_csv_file(temp_dir, sample_csv_content):
    """Create a temporary CSV file with sample data."""
    csv_path = os.path.join(temp_dir, "test_logbook.csv")
    with open(csv_path, 'w') as f:
        f.write(sample_csv_content)
    return csv_path

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(fastapi_app)

@pytest.fixture
def fastapi_client():
    """FastAPI test client (alias for compatibility)."""
    return TestClient(fastapi_app)

@pytest.fixture
def mock_upload_folder(temp_dir, monkeypatch):
    """Mock the upload folder to use temporary directory."""
    upload_dir = os.path.join(temp_dir, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir
