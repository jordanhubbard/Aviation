import pytest
from app import create_app, db
from app.models import User, Aircraft, Booking, CheckIn, CheckOut, MaintenanceRecord, Squawk, MaintenanceType
from datetime import datetime, timedelta, timezone

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
            db.session.query(CheckIn).delete()
            db.session.query(CheckOut).delete()
            db.session.query(MaintenanceRecord).delete()
            db.session.query(Squawk).delete()
            db.session.commit()
            
            # Create users
            student = User(email="student@example.com", first_name="Student", last_name="User", 
                          role="student", status="active")
            student.set_password("password")
            db.session.add(student)
            
            instructor = User(email="instructor@example.com", first_name="Inst", last_name="Ructor", 
                             role="instructor", status="active", is_instructor=True)
            instructor.set_password("password")
            db.session.add(instructor)
            
            admin = User(email="admin@example.com", first_name="Admin", last_name="User", 
                        role="admin", status="active", is_admin=True)
            admin.set_password("password")
            db.session.add(admin)
            
            # Create aircraft
            ac = Aircraft(registration="N55555", make="Test", model="Model", year=2022, 
                         category="single_engine_land", engine_type="piston", num_engines=1,
                         rate_per_hour=99, status="available",
                         hobbs_time=100.0, tach_time=90.0,
                         time_to_next_oil_change=40.0,
                         time_to_next_100hr=80.0)
            db.session.add(ac)
            
            # Create maintenance type
            maint_type = MaintenanceType(
                name="Oil Change",
                description="Regular oil change",
                interval_hours=50.0,
                created_by_id=3  # Admin user
            )
            db.session.add(maint_type)
            
            db.session.commit()
            
            # Create a booking
            start_time = datetime.now(timezone.utc) + timedelta(hours=1)
            end_time = start_time + timedelta(hours=2)
            booking = Booking(
                student_id=1,
                instructor_id=2,
                aircraft_id=1,
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

def login_instructor(client, app):
    with app.app_context():
        instructor = User.query.filter_by(email="instructor@example.com").first()
    with client.session_transaction() as sess:
        sess["_user_id"] = str(instructor.id)
        sess["_fresh"] = True

def login_admin(client, app):
    with app.app_context():
        admin = User.query.filter_by(email="admin@example.com").first()
    with client.session_transaction() as sess:
        sess["_user_id"] = str(admin.id)
        sess["_fresh"] = True

def test_flight_check_in_access(client):
    """Test access to the flight check-in page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
    # Test access to check-in page
    response = client.get(f"/flight/check-in/{booking.id}")
    assert response.status_code == 200
    assert b"Flight Check-In" in response.data
    assert b"Start Flight" in response.data
    
    # Verify aircraft image integration
    assert b'src="/static/images/aircraft/' in response.data

def test_flight_check_in_submission(client):
    """Test submitting the flight check-in form."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
    # Submit check-in form
    response = client.post(f"/flight/check-in/{booking.id}", data={
        "hobbs_start": 100.0,
        "tach_start": 90.0,
        "weather_conditions_acceptable": "on",
        "notes": "Test check-in notes"
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert b"Flight Status" in response.data
    
    with app.app_context():
        # Verify check-in record was created
        check_in = CheckIn.query.filter_by(booking_id=booking.id).first()
        assert check_in is not None
        assert check_in.hobbs_start == 100.0
        assert check_in.tach_start == 90.0
        assert check_in.notes == "Test check-in notes"
        
        # Verify booking status was updated
        booking = Booking.query.get(booking.id)
        assert booking.status == "in_progress"

def test_flight_status(client):
    """Test the flight status page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
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
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Access flight status page
    response = client.get(f"/flight/status/{booking_id}")
    assert response.status_code == 200
    assert b"Flight in Progress" in response.data
    assert b"End Flight" in response.data
    
    # Verify aircraft image integration
    assert b'src="/static/images/aircraft/' in response.data

def test_flight_check_out(client):
    """Test the flight check-out process."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
        # Create check-in record
        check_in = CheckIn(
            booking_id=booking.id,
            aircraft_id=booking.aircraft_id,
            check_in_time=datetime.now(timezone.utc) - timedelta(hours=1),
            hobbs_start=100.0,
            tach_start=90.0,
            weather_conditions_acceptable=True
        )
        db.session.add(check_in)
        booking.status = "in_progress"
        db.session.commit()
        
        booking_id = booking.id  # Store the ID to use outside the context
        aircraft_id = booking.aircraft_id  # Store the ID to use outside the context
    
    # Access check-out page
    response = client.get(f"/flight/check-out/{booking_id}")
    assert response.status_code == 200
    assert b"Flight Check-Out" in response.data
    assert b"Complete Flight" in response.data
    
    # Submit check-out form
    response = client.post(f"/flight/check-out/{booking_id}", data={
        "hobbs_end": 101.5,
        "tach_end": 91.2,
        "notes": "Test check-out notes"
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert b"Flight Summary" in response.data
    
    with app.app_context():
        # Verify check-out record was created
        check_out = CheckOut.query.filter_by(booking_id=booking_id).first()
        assert check_out is not None
        assert check_out.hobbs_end == 101.5
        assert check_out.tach_end == 91.2
        assert check_out.notes == "Test check-out notes"
        
        # Verify booking status was updated
        booking = Booking.query.get(booking_id)
        assert booking.status == "completed"
        
        # Verify aircraft times were updated
        aircraft = Aircraft.query.get(aircraft_id)
        assert aircraft.hobbs_time == 101.5
        assert aircraft.tach_time == 91.2

def test_flight_check_out_with_squawk(client):
    """Test the flight check-out process with squawk reporting."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
        # Create check-in record
        check_in = CheckIn(
            booking_id=booking.id,
            aircraft_id=booking.aircraft_id,
            check_in_time=datetime.now(timezone.utc) - timedelta(hours=1),
            hobbs_start=100.0,
            tach_start=90.0,
            weather_conditions_acceptable=True
        )
        db.session.add(check_in)
        booking.status = "in_progress"
        db.session.commit()
        
        booking_id = booking.id  # Store the ID to use outside the context
        aircraft_id = booking.aircraft_id  # Store the ID to use outside the context
    
    # Submit check-out form with squawk
    response = client.post(f"/flight/check-out/{booking_id}", data={
        "hobbs_end": 101.5,
        "tach_end": 91.2,
        "has_squawk": "on",
        "squawk_description": "Test squawk description",
        "notes": "Test check-out notes"
    }, follow_redirects=True)
    
    assert response.status_code == 200
    assert b"Flight Summary" in response.data
    
    with app.app_context():
        # Verify squawk was created
        squawk = Squawk.query.filter_by(aircraft_id=aircraft_id).first()
        assert squawk is not None
        assert squawk.description == "Test squawk description"
        assert squawk.status == "open"

def test_flight_summary(client):
    """Test the flight summary page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        booking = Booking.query.first()
        
        # Create check-in record
        check_in = CheckIn(
            booking_id=booking.id,
            aircraft_id=booking.aircraft_id,
            check_in_time=datetime.now(timezone.utc) - timedelta(hours=2),
            hobbs_start=100.0,
            tach_start=90.0,
            weather_conditions_acceptable=True
        )
        db.session.add(check_in)
        
        # Create check-out record
        check_out = CheckOut(
            booking_id=booking.id,
            aircraft_id=booking.aircraft_id,
            check_out_time=datetime.now(timezone.utc) - timedelta(hours=1),
            hobbs_end=101.5,
            tach_end=91.2,
            notes="Test check-out notes"
        )
        db.session.add(check_out)
        
        booking.status = "completed"
        db.session.commit()
        
        booking_id = booking.id  # Store the ID to use outside the context
    
    # Access flight summary page
    response = client.get(f"/flight/summary/{booking_id}")
    assert response.status_code == 200
    assert b"Flight Summary" in response.data
    assert b"1.5 hours" in response.data  # Hobbs time difference
    
    # Verify aircraft image integration
    assert b'src="/static/images/aircraft/' in response.data

def test_maintenance_records(client):
    """Test the maintenance records page."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.first()
        maintenance_type = MaintenanceType.query.first()
        admin = User.query.filter_by(email="admin@example.com").first()
        
        # Create maintenance record
        maint_record = MaintenanceRecord(
            aircraft_id=aircraft.id,
            maintenance_type_id=maintenance_type.id,
            performed_at=datetime.now(timezone.utc) - timedelta(days=7),
            performed_by_id=admin.id,
            notes="Test maintenance notes",
            hobbs_hours=95.0,
            status="completed"
        )
        db.session.add(maint_record)
        
        # Create squawk
        squawk = Squawk(
            aircraft_id=aircraft.id,
            description="Test squawk description",
            reported_by_id=admin.id,
            status="open",
            created_at=datetime.now(timezone.utc) - timedelta(days=3)
        )
        db.session.add(squawk)
        db.session.commit()
        
        aircraft_id = aircraft.id  # Store the ID to use outside the context
    
    # Access maintenance records page
    response = client.get(f"/flight/maintenance/{aircraft_id}")
    assert response.status_code == 200
    assert b"Maintenance Records" in response.data
    assert b"Oil Change" in response.data
    assert b"Test maintenance notes" in response.data
    assert b"Test squawk description" in response.data
    
    # Verify aircraft image integration
    assert b'src="/static/images/aircraft/' in response.data

def test_add_squawk(client):
    """Test adding a squawk."""
    client, app = client
    login_student(client, app)
    
    with app.app_context():
        aircraft = Aircraft.query.first()
    
    # Submit squawk form
    response = client.post(f"/flight/squawk/add/{aircraft.id}", data={
        "description": "New squawk description"
    }, follow_redirects=True)
    
    assert response.status_code == 200
    
    with app.app_context():
        # Verify squawk was created
        squawk = Squawk.query.filter_by(description="New squawk description").first()
        assert squawk is not None
        assert squawk.status == "open"
        assert squawk.aircraft_id == aircraft.id

def test_unauthorized_access(client):
    """Test unauthorized access to flight routes."""
    client, app = client
    # Not logged in
    
    with app.app_context():
        booking = Booking.query.first()
        aircraft = Aircraft.query.first()
    
    # Try to access check-in page
    response = client.get(f"/flight/check-in/{booking.id}")
    assert response.status_code == 302  # Redirect to login
    
    # Try to access check-out page
    response = client.get(f"/flight/check-out/{booking.id}")
    assert response.status_code == 302  # Redirect to login
    
    # Try to access flight status page
    response = client.get(f"/flight/status/{booking.id}")
    assert response.status_code == 302  # Redirect to login
    
    # Try to access maintenance records page
    response = client.get(f"/flight/maintenance/{aircraft.id}")
    assert response.status_code == 302  # Redirect to login
