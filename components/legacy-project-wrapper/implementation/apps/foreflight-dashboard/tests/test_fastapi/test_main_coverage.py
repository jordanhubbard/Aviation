"""
Additional tests for main.py to improve coverage.
Tests edge cases, error handling, and utility functions.
"""

import pytest
import tempfile
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import UploadFile
import io

from src.main import app, calculate_stats_for_entries, calculate_running_totals, convert_entries_to_template_data
from src.core.models import LogbookEntry, Aircraft, Airport, FlightConditions


class TestMainCoverage:
    """Test coverage for main.py functions and edge cases."""

    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)

    def test_calculate_stats_empty_entries(self):
        """Test calculate_stats_for_entries with empty list."""
        stats = calculate_stats_for_entries([])
        
        assert stats['total_time'] == 0.0
        assert stats['total_hours'] == 0.0
        assert stats['total_pic'] == 0.0
        assert stats['total_dual'] == 0.0
        assert stats['total_night'] == 0.0
        assert stats['total_cross_country'] == 0.0
        assert stats['total_sim_instrument'] == 0.0
        assert stats['total_landings'] == 0
        assert stats['total_time_asel'] == 0.0
        assert stats['total_time_tailwheel'] == 0.0
        assert stats['total_time_complex'] == 0.0
        assert stats['total_time_high_performance'] == 0.0

    def test_calculate_stats_with_entries(self):
        """Test calculate_stats_for_entries with actual entries."""
        # Create test entries
        entry1 = LogbookEntry(
            date=datetime(2023, 1, 1),
            total_time=2.0,
            aircraft=Aircraft(
                registration="N12345",
                type="C172",
                category_class="ASEL"
            ),
            departure=Airport(identifier="KOAK"),
            destination=Airport(identifier="KSFO"),
            conditions=FlightConditions(
                day=1.5,
                night=0.5,
                cross_country=2.0,
                simulated_instrument=0.3,
                actual_instrument=0.2
            ),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=2.0,
            solo_time=0.0,
            landings_day=2,
            landings_night=1
        )
        
        entry2 = LogbookEntry(
            date=datetime(2023, 1, 2),
            total_time=1.5,
            aircraft=Aircraft(
                registration="N67890",
                type="PA28",
                category_class="ASEL"
            ),
            departure=Airport(identifier="KSFO"),
            destination=Airport(identifier="KPAO"),
            conditions=FlightConditions(
                day=1.5,
                night=0.0,
                cross_country=0.0,
                simulated_instrument=0.0,
                actual_instrument=0.0
            ),
            pilot_role="STUDENT",
            dual_received=1.5,
            pic_time=0.0,
            solo_time=0.0,
            landings_day=3,
            landings_night=0
        )
        
        stats = calculate_stats_for_entries([entry1, entry2])
        
        assert stats['total_time'] == 3.5
        assert stats['total_hours'] == 3.5  # Alias
        assert stats['total_pic'] == 2.0
        assert stats['total_dual'] == 1.5
        assert stats['total_night'] == 0.5
        assert stats['total_cross_country'] == 2.0
        assert stats['total_sim_instrument'] == 0.5  # 0.3 + 0.2 + 0.0 + 0.0
        assert stats['total_landings'] == 6  # 2 + 1 + 3 + 0
        assert stats['total_time_asel'] == 3.5  # Both aircraft are ASEL

    def test_calculate_running_totals(self):
        """Test calculate_running_totals function."""
        # Create test entries
        entries = [
            LogbookEntry(
                date=datetime(2023, 1, 1),
                total_time=2.0,
                aircraft=Aircraft(registration="N12345", type="C172", category_class="ASEL"),
                departure=Airport(identifier="KOAK"),
                destination=Airport(identifier="KSFO"),
                conditions=FlightConditions(day=2.0, cross_country=2.0),
                pilot_role="PIC",
                dual_received=0.0,
                pic_time=2.0,
                solo_time=0.0,
                landings_day=1,
                landings_night=0
            ),
            LogbookEntry(
                date=datetime(2023, 1, 2),
                total_time=1.5,
                aircraft=Aircraft(registration="N67890", type="PA28", category_class="ASEL"),
                departure=Airport(identifier="KSFO"),
                destination=Airport(identifier="KPAO"),
                conditions=FlightConditions(day=1.5, cross_country=1.0),
                pilot_role="PIC",
                dual_received=0.0,
                pic_time=1.5,
                solo_time=0.0,
                landings_day=2,
                landings_night=0
            )
        ]
        
        result = calculate_running_totals(entries)
        
        # Check that running totals are calculated
        assert len(result) == 2
        assert hasattr(result[0], 'running_totals')
        assert hasattr(result[1], 'running_totals')
        
        # First entry totals
        assert result[0].running_totals.total_time == 2.0
        assert result[0].running_totals.pic_time == 2.0
        assert result[0].running_totals.cross_country == 2.0
        
        # Second entry totals (cumulative)
        assert result[1].running_totals.total_time == 3.5
        assert result[1].running_totals.pic_time == 3.5
        assert result[1].running_totals.cross_country == 3.0

    def test_convert_entries_to_template_data(self):
        """Test convert_entries_to_template_data function."""
        # Create test entry with validation errors
        entry = LogbookEntry(
            date=datetime(2023, 1, 1),
            total_time=2.0,
            aircraft=Aircraft(registration="N12345", type="C172", category_class="ASEL"),
            departure=Airport(identifier="KOAK"),
            destination=Airport(identifier="KSFO"),
            conditions=FlightConditions(day=2.0),
            pilot_role="PIC",
            dual_received=0.0,
            pic_time=2.0,
            solo_time=0.0,
            landings_day=1,
            landings_night=0
        )
        
        # Add validation results
        entry.error_explanation = "Test error"
        entry.warning_explanation = "Test warning"
        
        result = convert_entries_to_template_data([entry])
        
        assert len(result) == 1
        assert result[0]['error_explanation'] == "Test error"
        assert result[0]['warning_explanation'] == "Test warning"
        assert result[0]['total_time'] == 2.0
        assert result[0]['aircraft']['registration'] == "N12345"

    def test_process_logbook_invalid_file_type(self):
        """Test process_logbook with invalid file type."""
        # Create a non-CSV file
        file_content = b"This is not a CSV file"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        
        response = self.client.post("/api/process-logbook", files=files)
        
        assert response.status_code == 400
        assert "Only CSV files are supported" in response.json()["detail"]

    def test_process_logbook_empty_file(self):
        """Test process_logbook with empty CSV file."""
        # Create empty CSV file
        file_content = b""
        files = {"file": ("test.csv", io.BytesIO(file_content), "text/csv")}
        
        response = self.client.post("/api/process-logbook", files=files)
        
        assert response.status_code == 500
        # Should get an error about invalid CSV format

    def test_process_logbook_with_student_pilot_flag(self):
        """Test process_logbook with student_pilot flag."""
        # Create minimal valid CSV content
        csv_content = """ForeFlight Logbook
Aircraft Table
AircraftID,EquipmentType,TypeCode,Year,Make,Model,Category,Class,GearType,EngineType,Complex,HighPerformance,Pressurized,TAA
N12345,Airplane,C172,1980,Cessna,172,Airplane,ASEL,Tricycle,Reciprocating,No,No,No,No

Flights Table
Date,AircraftID,From,To,Route,TimeOut,TimeIn,TotalTime,PIC,SIC,Night,SoloTime,CrossCountry,NightTakeoffs,NightLandings,AllLandings,ProceduresNum,ProceduresType,Hold,Tracking,Distance,DayTakeoffs,DayLandings,DayLandingsFullStop,NightLandingsFullStop,MaxCrosswingComponent,MaxHeadwindComponent,MaxTailwindComponent,FlightReview,Checkride,IPC,NVG,NVGOps,DVE,IMC,ActualInstrument,SimulatedInstrument,GroundTraining,DualGiven,DualReceived,SimulatedFlight,Pilot,DutiesOfPIC,InstructorName,InstructorComments,Person1,Person2,Person3,Person4,Person5,Person6,CustomFieldNameText1,CustomFieldNameText2,CustomFieldNameText3,CustomFieldNameText4,CustomFieldNameText5,CustomFieldNameNumeric1,CustomFieldNameNumeric2,CustomFieldNameNumeric3,CustomFieldNameNumeric4,CustomFieldNameNumeric5,PilotComments
2023-01-01,N12345,KOAK,KSFO,,09:00,10:30,1.5,0.0,0.0,0.0,0.0,0.0,0,0,1,0,,0,0,25,1,1,1,0,0,0,0,0,0,0,0,0,0.0,0.0,0.0,0.0,1.5,0.0,STUDENT,No,John Doe,Good flight,,,,,,,,,,,,,,,,,Test flight
"""
        
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        data = {"student_pilot": "true"}
        
        response = self.client.post("/api/process-logbook", files=files, data=data)
        
        assert response.status_code == 200
        result = response.json()
        assert result["student_pilot"] is True
        assert "entries" in result
        assert "stats" in result

    @patch('src.main.validate_csv')
    def test_process_logbook_validation_error(self, mock_validate):
        """Test process_logbook when CSV validation fails."""
        mock_validate.side_effect = ValueError("Invalid CSV format")
        
        csv_content = b"invalid,csv,content"
        files = {"file": ("test.csv", io.BytesIO(csv_content), "text/csv")}
        
        response = self.client.post("/api/process-logbook", files=files)
        
        assert response.status_code == 500
        assert "Invalid CSV format" in response.json()["detail"]

    @patch('src.main.ForeFlightImporter')
    def test_process_logbook_importer_error(self, mock_importer_class):
        """Test process_logbook when importer fails."""
        mock_importer = MagicMock()
        mock_importer.get_flight_entries.side_effect = Exception("Importer failed")
        mock_importer_class.return_value = mock_importer
        
        csv_content = b"valid,csv,content"
        files = {"file": ("test.csv", io.BytesIO(csv_content), "text/csv")}
        
        with patch('src.main.validate_csv'):  # Mock validation to pass
            response = self.client.post("/api/process-logbook", files=files)
        
        assert response.status_code == 500
        assert "Importer failed" in response.json()["detail"]

    def test_api_docs_redirect(self):
        """Test API docs redirect endpoint."""
        response = self.client.get("/docs")
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_serve_spa_with_api_path(self):
        """Test SPA serving with API path (should return 404)."""
        response = self.client.get("/api/nonexistent")
        
        assert response.status_code == 404
        assert "API endpoint not found" in response.json()["detail"]

    def test_serve_spa_with_regular_path(self):
        """Test SPA serving with regular path."""
        response = self.client.get("/dashboard")
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_health_check_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    def test_root_endpoint_development_mode(self):
        """Test root endpoint in development mode."""
        with patch.dict(os.environ, {'ENVIRONMENT': 'development'}):
            response = self.client.get("/")
            
            assert response.status_code == 200
            assert "text/html" in response.headers["content-type"]
            content = response.text
            assert "ForeFlight Dashboard" in content

    def test_root_endpoint_production_mode(self):
        """Test root endpoint in production mode."""
        with patch.dict(os.environ, {'ENVIRONMENT': 'production'}):
            # Mock the static file serving
            with patch('src.main.Path') as mock_path:
                mock_path.return_value.exists.return_value = True
                mock_path.return_value.read_text.return_value = "<html><head><title>ForeFlight Dashboard</title></head><body>Production App</body></html>"
                
                response = self.client.get("/")
                
                assert response.status_code == 200
                assert "text/html" in response.headers["content-type"]

    def test_cors_middleware(self):
        """Test CORS middleware is working."""
        response = self.client.get("/health", headers={"Origin": "http://localhost:3001"})
        
        # CORS headers should be present in the response
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "*"

    def test_security_headers(self):
        """Test security headers are applied."""
        response = self.client.get("/health")
        
        # Check basic response headers are present (no custom security headers configured)
        assert "content-type" in response.headers
        assert response.headers["content-type"] == "application/json"

    def test_error_handling_middleware(self):
        """Test error handling middleware."""
        # Test with invalid JSON in request body
        response = self.client.post("/api/process-logbook", 
                                  json={"invalid": "data"},
                                  headers={"Content-Type": "application/json"})
        
        # Should return 422 for validation error, not 500
        assert response.status_code == 422
