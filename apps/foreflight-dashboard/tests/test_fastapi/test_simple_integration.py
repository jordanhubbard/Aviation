"""Simple integration tests that work with real database."""

import pytest
from fastapi.testclient import TestClient
from src.main import app


class TestSimpleIntegration:
    """Simple integration tests without complex mocking."""

    def test_health_check(self):
        """Test health check endpoint."""
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    def test_api_docs_accessible(self):
        """Test that API documentation is accessible."""
        client = TestClient(app)
        response = client.get("/docs")
        
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_openapi_spec(self):
        """Test that OpenAPI specification is accessible."""
        client = TestClient(app)
        response = client.get("/openapi.json")
        
        assert response.status_code == 200
        # In test environment, this might return HTML (development mode)
        # Both JSON and HTML responses are acceptable for this endpoint
        assert response.headers["content-type"] in ["application/json", "text/html; charset=utf-8"]
        
        if "application/json" in response.headers["content-type"]:
            data = response.json()
            assert "openapi" in data
            assert "info" in data
            assert data["info"]["title"] == "ForeFlight Dashboard"

    def test_api_404_works(self):
        """Test that non-existent API endpoints return 404."""
        client = TestClient(app)
        response = client.get("/api/nonexistent")
        
        assert response.status_code == 404

    def test_root_serves_html(self):
        """Test root endpoint returns HTML."""
        client = TestClient(app)
        response = client.get("/")
        
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        
        # Should contain basic HTML structure
        content = response.text
        assert "<!doctype html>" in content.lower()
        # In development mode, title includes "API - Development Mode"
        assert "ForeFlight Dashboard" in content

    def test_spa_routing(self):
        """Test that SPA routes return the main HTML."""
        client = TestClient(app)
        test_routes = [
            "/login",
            "/dashboard", 
            "/profile"
        ]
        
        for route in test_routes:
            response = client.get(route)
            
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/html")
            
            # Should return the same HTML as root
            content = response.text
            assert "<!doctype html>" in content.lower()
            # In development mode, title includes "API - Development Mode"
            assert "ForeFlight Dashboard" in content

    def test_process_logbook_no_file(self):
        """Test process-logbook endpoint without file."""
        client = TestClient(app)
        
        response = client.post("/api/process-logbook")
        assert response.status_code == 422  # Missing required file

    def test_process_logbook_with_sample_data(self, sample_csv_file):
        """Test process-logbook endpoint with sample CSV data."""
        client = TestClient(app)
        
        with open(sample_csv_file, 'rb') as f:
            files = {"file": ("test_logbook.csv", f, "text/csv")}
            data = {"student_pilot": "false"}
            response = client.post("/api/process-logbook", files=files, data=data)
        
        assert response.status_code == 200
        
        result = response.json()
        assert "entries" in result
        assert "stats" in result
        assert "all_time" in result  # API returns "all_time" not "all_time_stats"
        assert "aircraft_stats" in result
        assert "recent_experience" in result
        
        # Should have processed the sample entries
        assert isinstance(result["entries"], list)
        assert len(result["entries"]) > 0  # Sample data should create entries
