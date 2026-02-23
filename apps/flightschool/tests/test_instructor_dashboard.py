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
            # Create an instructor user for login
            user = User(email='instructor@example.com', first_name='John', last_name='Doe', role='instructor', status='active')
            user.set_password('instructor123')
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


def test_instructor_dashboard(client):
    """Test that the instructor dashboard loads correctly with new features."""
    login(client, 'instructor@example.com', 'instructor123')
    response = client.get('/instructor/dashboard')
    assert response.status_code == 200
    assert b'Scenario Builder' in response.data
    assert b'Performance Tracking' in response.data
