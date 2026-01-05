import os
import tempfile
import pytest
from datetime import datetime, timedelta, timezone
from app import create_app, db
from app.models import (
    User, Aircraft, Booking, CheckIn, CheckOut, Invoice,
    WeatherMinima, FlightLog, Endorsement, Document, AuditLog,
    WaitlistEntry, RecurringBooking, MaintenanceType, MaintenanceRecord, Squawk
)


@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    app = create_app('testing')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def session(app):
    """Create a new database session for a test (SQLAlchemy 2.x compatible)."""
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()
        session = db.session  # Use the global Flask-SQLAlchemy session
        yield session
        transaction.rollback()
        connection.close()
        session.remove()


@pytest.fixture
def test_user(session):
    """Create a test user."""
    user = User(
        email='student@example.com',
        first_name='Test',
        last_name='Student',
        role='student',
        status='active',
        student_id='S12345',
        certificates='PPL',
        phone='555-0124'
    )
    user.set_password('password123')
    session.add(user)
    session.commit()
    return user


@pytest.fixture
def test_instructor(session):
    """Create a test instructor."""
    instructor = User(
        email='instructor@example.com',
        first_name='Test',
        last_name='Instructor',
        role='instructor',
        is_instructor=True,
        status='active',
        certificates='CFI, CFII, MEI',
        instructor_rate_per_hour=75.0,
        phone='555-0123'
    )
    instructor.set_password('password123')
    session.add(instructor)
    session.commit()
    return instructor


@pytest.fixture
def admin_user(session):
    """Create an admin user."""
    admin = User(
        email='admin@example.com',
        first_name='Admin',
        last_name='User',
        role='admin',
        is_admin=True,
        status='active'
    )
    admin.set_password('password123')
    session.add(admin)
    session.commit()
    return admin


@pytest.fixture
def test_aircraft(session):
    """Create a test aircraft."""
    aircraft = Aircraft(
        registration='N12345',
        make='Cessna',
        model='172S',
        year=2020,
        status='available',
        category='single_engine_land',
        engine_type='piston',
        num_engines=1,
        ifr_equipped=True,
        gps=True,
        autopilot=True,
        rate_per_hour=150.0,
        hobbs_time=2345.6,
        tach_time=2300.4,
        description='Well-maintained Skyhawk with G1000 avionics',
        last_maintenance=datetime.now(timezone.utc) + timedelta(days=30)
    )
    session.add(aircraft)
    session.commit()
    return aircraft


@pytest.fixture
def test_booking(session, test_user, test_aircraft):
    """Create a test booking."""
    booking = Booking(
        student_id=test_user.id,
        instructor_id=None,
        aircraft_id=test_aircraft.id,
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc) + timedelta(hours=2),
        status='confirmed'
    )
    session.add(booking)
    session.commit()
    return booking


@pytest.fixture
def test_check_in(session, test_booking, test_aircraft):
    """Create a test check-in."""
    check_in = CheckIn(
        booking_id=test_booking.id,
        aircraft_id=test_aircraft.id,
        instructor_id=None,
        hobbs_start=1234.5,
        tach_start=2345.6,
        notes='Pre-flight inspection completed'
    )
    session.add(check_in)
    session.commit()
    return check_in


@pytest.fixture
def test_check_out(session, test_booking, test_aircraft, test_check_in):
    """Create a test check-out."""
    check_out = CheckOut(
        booking_id=test_booking.id,
        aircraft_id=test_aircraft.id,
        instructor_id=None,
        hobbs_end=1236.2,
        tach_end=2347.1,
        total_aircraft_time=1.7,
        notes='Flight completed successfully'
    )
    session.add(check_out)
    session.commit()
    return check_out


@pytest.fixture
def test_weather_minima(session):
    """Create test weather minima."""
    minima = WeatherMinima(
        category='VFR',
        ceiling_min=3000,
        visibility_min=5.0,
        wind_max=25,
        crosswind_max=15
    )
    session.add(minima)
    session.commit()
    return minima


@pytest.fixture
def test_flight_log(session, test_booking, test_instructor, test_user):
    """Create a test flight log."""
    log = FlightLog(
        booking_id=test_booking.id,
        pic_id=test_instructor.id,
        sic_id=test_user.id,
        flight_date=datetime.now(timezone.utc),
        route='KPAO KHWD KPAO',
        remarks='Pattern work and landings',
        weather_conditions='VFR',
        ground_instruction=0.5,
        dual_received=2.0,
        pic_time=2.0,
        sic_time=0.0,
        cross_country=0.0,
        night=0.0,
        actual_instrument=0.0,
        simulated_instrument=0.0,
        landings_day=8,
        landings_night=0
    )
    session.add(log)
    session.commit()
    return log


@pytest.fixture
def test_endorsement(session, test_user, test_instructor):
    """Create a test endorsement."""
    endorsement = Endorsement(
        student_id=test_user.id,
        instructor_id=test_instructor.id,
        type='solo',
        description='Solo endorsement for pattern work',
        expiration=datetime.now(timezone.utc) + timedelta(days=90)
    )
    session.add(endorsement)
    session.commit()
    return endorsement


@pytest.fixture
def test_document(session, test_user):
    """Create a test document."""
    document = Document(
        user_id=test_user.id,
        type='medical',
        filename='medical_certificate.pdf',
        url='https://example.com/documents/medical.pdf',
        expiration=datetime.now(timezone.utc) + timedelta(days=365)
    )
    session.add(document)
    session.commit()
    return document


@pytest.fixture
def test_waitlist_entry(session, test_user, test_aircraft):
    """Create a test waitlist entry."""
    entry = WaitlistEntry(
        student_id=test_user.id,
        aircraft_id=test_aircraft.id,
        requested_date=datetime.now(timezone.utc) + timedelta(days=7),
        time_preference='afternoon',
        duration_hours=2.0,
        status='active'
    )
    session.add(entry)
    session.commit()
    return entry


@pytest.fixture
def test_recurring_booking(session, test_user, test_aircraft):
    """Create a test recurring booking."""
    booking = RecurringBooking(
        student_id=test_user.id,
        aircraft_id=test_aircraft.id,
        day_of_week=2,  # Wednesday
        start_time=datetime.now(timezone.utc).time(),
        duration_hours=2.0,
        start_date=datetime.now(timezone.utc).date(),
        end_date=datetime.now(timezone.utc).date() + timedelta(days=90),
        status='active'
    )
    session.add(booking)
    session.commit()
    return booking


@pytest.fixture
def test_audit_log(session, admin_user):
    """Create a test audit log."""
    log = AuditLog(
        user_id=admin_user.id,
        action='update',
        table_name='aircraft',
        record_id=1,
        changes={
            'status': ['available', 'maintenance'],
            'maintenance_status': ['airworthy', 'maintenance_due']
        }
    )
    session.add(log)
    session.commit()
    return log


@pytest.fixture
def auth_client(client, test_user):
    """Create a test client with a logged-in user."""
    with client.session_transaction() as sess:
        sess['_user_id'] = test_user.id
        sess['_fresh'] = True
    return client


@pytest.fixture
def admin_client(client, admin_user):
    """Create a test client with a logged-in admin."""
    with client.session_transaction() as sess:
        sess['_user_id'] = admin_user.id
        sess['_fresh'] = True
    return client


@pytest.fixture
def logged_in_user(app, client, test_user):
    """A test client with a logged-in regular user."""
    with app.test_request_context():
        with client.session_transaction() as sess:
            sess['_user_id'] = test_user.id
            sess['_fresh'] = True
    return client


@pytest.fixture
def logged_in_admin(app, client, admin_user):
    """A test client with a logged-in admin user."""
    with app.test_request_context():
        with client.session_transaction() as sess:
            sess['_user_id'] = admin_user.id
            sess['_fresh'] = True
    return client


@pytest.fixture
def logged_in_instructor(app, client, test_instructor):
    """A test client with a logged-in instructor."""
    with app.test_request_context():
        with client.session_transaction() as sess:
            sess['_user_id'] = test_instructor.id
            sess['_fresh'] = True
    return client


@pytest.fixture
def test_maintenance_type(session):
    """Create a test maintenance type."""
    maintenance_type = MaintenanceType(
        name='Oil Change',
        description='Regular oil change'
    )
    session.add(maintenance_type)
    session.commit()
    return maintenance_type


@pytest.fixture
def test_maintenance_record(session, test_aircraft, test_maintenance_type):
    """Create a test maintenance record."""
    record = MaintenanceRecord(
        aircraft_id=test_aircraft.id,
        maintenance_type_id=test_maintenance_type.id,
        date=datetime.now(timezone.utc),
        notes='Oil changed'
    )
    session.add(record)
    session.commit()
    return record


@pytest.fixture
def test_squawk(session, test_aircraft):
    """Create a test squawk."""
    squawk = Squawk(
        aircraft_id=test_aircraft.id,
        description='Oil leak',
        status='open'
    )
    session.add(squawk)
    session.commit()
    return squawk
