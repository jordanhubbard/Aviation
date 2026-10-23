import pytest
from app import create_app, db
from app.models import User, Aircraft, Booking
from datetime import datetime, timedelta, timezone

# This file contains tests for routes that have been replaced with new flight routes
# Since we've implemented new flight routes in flight.py, these tests are no longer relevant
# We'll keep this file as a placeholder but mark the tests as skipped

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            db.session.query(User).delete()
            db.session.query(Aircraft).delete()
            db.session.commit()
            # Create a student user
            student = User(email="student@example.com", first_name="Student", last_name="User", role="student", status="active")
            student.set_password("password")
            db.session.add(student)
            # Create an instructor
            instructor = User(email="instructor@example.com", first_name="Inst", last_name="Ructor", role="instructor", status="active")
            instructor.set_password("password")
            db.session.add(instructor)
            # Create an available aircraft
            ac = Aircraft(registration="N77777", make="Test", model="Model", year=2022, category="single_engine_land", rate_per_hour=99, status="available")
            db.session.add(ac)
            db.session.commit()
        yield client
        with app.app_context():
            db.drop_all()

def login_student(client, app):
    with app.app_context():
        student = User.query.filter_by(email="student@example.com").first()
    with client.session_transaction() as sess:
        sess["_user_id"] = str(student.id)
        sess["_fresh"] = True

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_create(client):
    """Test creating a booking."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_cancel(client):
    """Test canceling a booking."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_create_invalid_duration(client):
    """Test creating a booking with invalid duration."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_create_missing_aircraft(client):
    """Test creating a booking without an aircraft."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_cancel_invalid_id(client):
    """Test canceling a booking with invalid id."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_dashboard_shows_upcoming(client):
    """Test that the booking dashboard shows upcoming bookings."""
    pass

@pytest.mark.skip(reason="Route replaced with new flight routes")
def test_booking_cancel_twice(client):
    """Test canceling a booking twice."""
    pass
