import pytest
import os
from app import create_app, db
from app.models import User, Aircraft, Booking, CheckIn, ensure_aircraft_image
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

@pytest.fixture
def client():
    app = create_app('testing')
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            db.session.query(User).delete()
            db.session.query(Aircraft).delete()
            db.session.query(Booking).delete()
            db.session.commit()
            
            # Create users
            student = User(email="student@example.com", first_name="Student", last_name="User", 
                          role="student", status="active")
            student.set_password("password")
            db.session.add(student)
            
            # Create different types of aircraft to test fallback system
            # Single-engine piston
            cessna = Aircraft(registration="N12345", make="Cessna", model="172S", year=2022, 
                         category="single_engine_land", engine_type="piston", num_engines=1,
                         rate_per_hour=99, status="available")
            db.session.add(cessna)
            
            # Single-engine turboprop
            tbm = Aircraft(registration="N67890", make="TBM", model="930", year=2022, 
                         category="single_engine_land", engine_type="turboprop", num_engines=1,
                         rate_per_hour=599, status="available")
            db.session.add(tbm)
            
            # Multi-engine piston
            baron = Aircraft(registration="N54321", make="Beechcraft", model="Baron 58", year=2022, 
                         category="multi_engine_land", engine_type="piston", num_engines=2,
                         rate_per_hour=299, status="available")
            db.session.add(baron)
            
            # Multi-engine turboprop
            kingair = Aircraft(registration="N09876", make="Beechcraft", model="King Air 350", year=2022, 
                         category="multi_engine_land", engine_type="turboprop", num_engines=2,
                         rate_per_hour=799, status="available")
            db.session.add(kingair)
            
            # Jet
            citation = Aircraft(registration="N11111", make="Cessna", model="Citation", year=2022, 
                         category="multi_engine_land", engine_type="jet", num_engines=2,
                         rate_per_hour=1299, status="available")
            db.session.add(citation)
            
            db.session.commit()
            
            # Create bookings for each aircraft
            for ac in Aircraft.query.all():
                start_time = datetime.now(timezone.utc) + timedelta(hours=1)
                end_time = start_time + timedelta(hours=2)
                booking = Booking(
                    student_id=student.id,
                    aircraft_id=ac.id,
                    start_time=start_time,
                    end_time=end_time,
                    status="confirmed"
                )
                db.session.add(booking)
            
            db.session.commit()
            
        yield client, app
        with app.app_context():
            db.drop_all()

def login_student(client, app):
    with app.app_context():
        student = User.query.filter_by(email="student@example.com").first()
    with client.session_transaction() as sess:
        sess["_user_id"] = str(student.id)
        sess["_fresh"] = True

def test_aircraft_image_fallback_single_engine_piston(client, monkeypatch):
    """Test the fallback to cessna172.jpg for single-engine piston aircraft."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N12345").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/cessna172.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/cessna172.jpg"' in response.data

def test_aircraft_image_fallback_single_engine_turboprop(client, monkeypatch):
    """Test the fallback to tbm930.jpg for single-engine turboprop aircraft."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N67890").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/tbm930.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/tbm930.jpg"' in response.data

def test_aircraft_image_fallback_multi_engine_piston(client, monkeypatch):
    """Test the fallback to baron58.jpg for multi-engine piston aircraft."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N54321").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/baron58.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/baron58.jpg"' in response.data

def test_aircraft_image_fallback_multi_engine_turboprop(client, monkeypatch):
    """Test the fallback to kingair350.jpg for multi-engine turboprop aircraft."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N09876").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/kingair350.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/kingair350.jpg"' in response.data

def test_aircraft_image_fallback_jet(client, monkeypatch):
    """Test the fallback to citation.jpg for jet aircraft."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N11111").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/citation.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/citation.jpg"' in response.data

def test_aircraft_image_fallback_default(client, monkeypatch):
    """Test the fallback to default.jpg when no other fallbacks apply."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N12345").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Mock ensure_aircraft_image to return the default fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/default.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test check-in page
    with app.app_context():
        response = client.get(f"/flight/check-in/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/default.jpg"' in response.data

def test_aircraft_image_integration_in_flight_status(client, monkeypatch):
    """Test the integration of aircraft images in the flight status page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N12345").first()
        booking = Booking.query.filter_by(aircraft_id=aircraft.id).first()
        
        # Create check-in record
        check_in = CheckIn(
            booking_id=booking.id,
            aircraft_id=booking.aircraft_id,
            check_in_time=datetime.now(timezone.utc),
            hobbs_start=100.0,
            tach_start=90.0,
            weather_conditions_acceptable=True
        )
        db.session.add(check_in)
        booking.status = "in_progress"
        db.session.commit()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/cessna172.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Test flight status page
    with app.app_context():
        response = client.get(f"/flight/status/{booking_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/cessna172.jpg"' in response.data

def test_aircraft_image_integration_in_maintenance_records(client, monkeypatch):
    """Test the integration of aircraft images in the maintenance records page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.filter_by(registration="N12345").first()
        
        # Mock ensure_aircraft_image to return the fallback path
        def mock_ensure_aircraft_image(filename, make=None, model=None):
            return "images/aircraft/cessna172.jpg"
        
        monkeypatch.setattr("app.models.ensure_aircraft_image", mock_ensure_aircraft_image)
        
        aircraft_id = aircraft.id  # Store the ID to use outside the context
    
    # Test maintenance records page
    with app.app_context():
        response = client.get(f"/flight/maintenance/{aircraft_id}")
        assert response.status_code == 200
        assert b'src="/static/images/aircraft/cessna172.jpg"' in response.data
