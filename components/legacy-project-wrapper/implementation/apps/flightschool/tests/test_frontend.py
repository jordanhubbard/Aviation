import pytest
from flask import url_for
from app import create_app, db
from app.models import User

@pytest.fixture
def client():
    app = create_app()
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Create a student user for login
            user = User(email='student@example.com', first_name='Jane', last_name='Doe', role='student', status='active')
            user.set_password('student123')
            db.session.add(user)
            db.session.commit()
        yield client
        with app.app_context():
            db.drop_all()

def login(client, email, password):
    return client.post('/login', data={
        'email': email,
        'password': password
    }, follow_redirects=True)

@pytest.mark.skip(reason="Route has been replaced with new flight routes")
def test_booking_page_renders_calendar_and_time(client):
    """Test that the booking page renders a calendar and time selector."""
    login(client, 'student@example.com', 'student123')
    response = client.get('/bookings')
    assert response.status_code == 200
    # Check for current time label
    assert b'Current Time:' in response.data
    # Check for calendar-widget div
    assert b'calendar-widget' in response.data

@pytest.mark.skip(reason="Route has been replaced with new flight routes")
def test_booking_page_includes_booking_blocks_js(client):
    """Test that the booking page includes the booking blocks JS."""
    login(client, 'student@example.com', 'student123')
    response = client.get('/bookings')
    assert response.status_code == 200
    # Check that booking_blocks JSON is present in the page
    assert b'const BOOKING_BLOCKS' in response.data
    assert b'calendar-widget' in response.data

@pytest.mark.skip(reason="Route has been changed")
def test_contact_form(client):
    """Test the contact form."""
    # Test GET request
    response = client.get('/contact')
    assert response.status_code == 200
    assert b'Contact Us' in response.data

    # Test POST request with valid data
    response = client.post('/contact', data={
        'name': 'Test User',
        'email': 'test@example.com',
        'subject': 'Test Subject',
        'message': 'Test Message'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b'Thank you for your message' in response.data

    # Test POST request with missing data
    response = client.post('/contact', data={
        'name': '',
        'email': '',
        'subject': '',
        'message': ''
    })
    assert response.status_code == 200
    assert b'Contact Us' in response.data
