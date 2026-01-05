"""Tests for CSV validation functionality."""

import pytest
import tempfile
import os
from unittest.mock import Mock, patch
from src.core.validation import validate_csv


class TestCSVValidation:
    """Test CSV validation functionality."""

    def test_validate_valid_csv(self, sample_csv_content):
        """Test validation of valid CSV file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(sample_csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            assert result['success'] is True
            assert result['error'] is None  # Error should be None, not absent
            assert 'details' in result
        finally:
            os.unlink(temp_path)

    def test_validate_nonexistent_file(self):
        """Test validation of non-existent file."""
        result = validate_csv('nonexistent_file.csv')
        
        assert result['success'] is False
        assert 'error' in result
        assert 'file not found' in result['error'].lower()

    def test_validate_empty_file(self):
        """Test validation of empty file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write('')  # Empty file
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            assert result['success'] is False
            assert 'error' in result
        finally:
            os.unlink(temp_path)

    def test_validate_invalid_format(self):
        """Test validation of file with invalid format."""
        invalid_csv = "This is not a valid ForeFlight CSV file\nJust some random text"
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(invalid_csv)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            assert result['success'] is False
            assert 'error' in result
        finally:
            os.unlink(temp_path)

    def test_validate_missing_required_headers(self):
        """Test validation of CSV missing required headers."""
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model\n'  # Missing some required columns
            'N125CM,CH7A,,Bellanca,7ECA\n'
            'Flights Table\n'
            'Date,AircraftID,From,To\n'  # Missing many required columns
            '2023-01-01,N125CM,KOAK,KSFO\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should either fail validation or succeed with warnings
            if not result['success']:
                assert 'error' in result
            else:
                assert 'warnings' in result
        finally:
            os.unlink(temp_path)

    def test_validate_missing_aircraft_table(self):
        """Test validation of CSV missing aircraft table."""
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            '2023-01-01,N125CM,KOAK,KSFO,2.0,0.0,0.0,0.0,0.0,0.0,2.0,0.0,0.0,2.0,1,0,First solo,,10\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            assert result['success'] is False
            assert 'error' in result
            assert 'aircraft' in result['error'].lower()
        finally:
            os.unlink(temp_path)

    def test_validate_missing_flights_table(self):
        """Test validation of CSV missing flights table."""
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            assert result['success'] is False
            assert 'error' in result
            assert 'flights' in result['error'].lower()
        finally:
            os.unlink(temp_path)

    def test_validate_invalid_date_format(self):
        """Test validation of CSV with invalid date format."""
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            'invalid-date,N125CM,KOAK,KSFO,2.0,0.0,0.0,0.0,0.0,0.0,2.0,0.0,0.0,2.0,1,0,First solo,,10\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should either fail or succeed with warnings about date format
            if result['success']:
                assert 'warnings' in result
            else:
                assert 'error' in result
        finally:
            os.unlink(temp_path)

    def test_validate_invalid_numeric_values(self):
        """Test validation of CSV with invalid numeric values."""
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            '2023-01-01,N125CM,KOAK,KSFO,invalid,0.0,0.0,0.0,0.0,0.0,2.0,0.0,0.0,2.0,1,0,First solo,,10\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should either fail or succeed with warnings about numeric values
            if result['success']:
                assert 'warnings' in result
            else:
                assert 'error' in result
        finally:
            os.unlink(temp_path)

    def test_validate_missing_foreflight_header(self):
        """Test validation of CSV missing ForeFlight header."""
        csv_content = (
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            '2023-01-01,N125CM,KOAK,KSFO,2.0,0.0,0.0,0.0,0.0,0.0,2.0,0.0,0.0,2.0,1,0,First solo,,10\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should succeed but with warnings about missing ForeFlight header
            assert result['success'] is True
            assert 'warnings' in result
            assert len(result['warnings']) > 0
            assert any('ForeFlight' in warning for warning in result['warnings'])
        finally:
            os.unlink(temp_path)

    def test_validate_with_warnings(self, sample_csv_content):
        """Test validation that succeeds but returns warnings."""
        # Modify sample to have potential warning conditions
        modified_csv = sample_csv_content.replace('2.0', '0.1')  # Very short flight time
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(modified_csv)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should succeed but may have warnings
            assert result['success'] is True
            if 'warnings' in result:
                assert isinstance(result['warnings'], list)
        finally:
            os.unlink(temp_path)

    def test_validate_large_file(self):
        """Test validation of large CSV file."""
        # Create a CSV with many entries
        header = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
        )
        
        # Add many flight entries
        flights = []
        for i in range(1000):  # 1000 flights
            flights.append(f'2023-01-{(i % 28) + 1:02d},N125CM,KOAK,KSFO,1.5,0.0,0.0,0.0,0.0,0.0,1.5,0.0,0.0,1.5,1,0,Flight {i},,10\n')
        
        large_csv = header + ''.join(flights)
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            f.write(large_csv)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should handle large files gracefully
            assert 'success' in result
        finally:
            os.unlink(temp_path)

    def test_validate_encoding_issues(self):
        """Test validation of CSV with encoding issues."""
        # Create CSV with special characters
        csv_content = (
            'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
            'Aircraft Table\n'
            'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
            'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
            'Flights Table\n'
            'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            '2023-01-01,N125CM,KOAK,KSFO,1.5,0.0,0.0,0.0,0.0,0.0,1.5,0.0,0.0,1.5,1,0,Flügzeug test with special chars ñáéíóú,,10\n'
        )
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8') as f:
            f.write(csv_content)
            f.flush()
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            
            # Should handle encoding gracefully
            assert 'success' in result
        finally:
            os.unlink(temp_path)

    def test_validate_performance(self):
        """Test validation performance with reasonable file."""
        import time
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            # Write a moderately sized file
            f.write((
                'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.\n'
                'Aircraft Table\n'
                'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA)\n'
                'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,\n'
                'Flights Table\n'
                'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance\n'
            ))
            
            # Add 100 flights
            for i in range(100):
                f.write(f'2023-01-{(i % 28) + 1:02d},N125CM,KOAK,KSFO,1.5,0.0,0.0,0.0,0.0,0.0,1.5,0.0,0.0,1.5,1,0,Flight {i},,10\n')
            
            f.flush()
            temp_path = f.name
        
        try:
            start_time = time.time()
            result = validate_csv(temp_path)
            end_time = time.time()
            
            # Validation should complete in reasonable time (< 5 seconds)
            assert (end_time - start_time) < 5.0
            assert 'success' in result
        finally:
            os.unlink(temp_path)
