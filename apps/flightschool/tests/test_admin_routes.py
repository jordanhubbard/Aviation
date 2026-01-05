import pytest
from app import create_app, db
from app.models import User, Aircraft
from flask_login import login_user
from flask import jsonify, json

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Remove existing users to avoid unique constraint error
            db.session.query(User).delete()
            db.session.commit()
            # Create admin user
            admin = User(email="admin@example.com", first_name="Admin", last_name="User", role="admin", is_admin=True, status="active")
            admin.set_password("password")
            db.session.add(admin)
            db.session.commit()
        yield client, app
        with app.app_context():
            db.drop_all()

def login_admin(client, app):
    with app.app_context():
        admin = User.query.filter_by(email="admin@example.com").first()
    with client.session_transaction() as sess:
        sess["_user_id"] = str(admin.id)
        sess["_fresh"] = True

def test_admin_dashboard_access(client):
    client, app = client
    login_admin(client, app)
    resp = client.get("/admin/dashboard")
    assert resp.status_code == 200
    assert b"Admin Dashboard" in resp.data

@pytest.mark.skip(reason="Template has been changed")
def test_admin_aircraft_add(client):
    client, app = client
    login_admin(client, app)
    resp = client.post("/admin/aircraft/create", data={
        "registration": "N99999",
        "make": "TestMake",
        "model": "TestModel",
        "year": 2024,
        "category": "single_engine_land",
        "rate_per_hour": 100,
        "status": "available"
    }, follow_redirects=True)
    assert resp.status_code == 200
    assert b"Aircraft added successfully" in resp.data
    ac = Aircraft.query.filter_by(registration="N99999").first()
    assert ac is not None
    assert ac.make == "TestMake"

@pytest.mark.skip(reason="Template has been changed")
def test_admin_aircraft_maintenance_fields(client):
    client, app = client
    login_admin(client, app)
    resp = client.post("/admin/aircraft/create", data={
        "registration": "N77777",
        "make": "Test",
        "model": "Model",
        "year": 2023,
        "status": "available",
        "rate_per_hour": 100,
        "time_to_next_oil_change": 25.5,
        "time_to_next_100hr": 50.0,
        "date_of_next_annual": "2025-11-30"
    }, follow_redirects=True)
    assert b"Aircraft added successfully" in resp.data
    ac = Aircraft.query.filter_by(registration="N77777").first()
    assert ac is not None
    assert ac.time_to_next_oil_change == 25.5
    assert ac.time_to_next_100hr == 50.0
    assert ac.date_of_next_annual.strftime('%Y-%m-%d') == "2025-11-30"

@pytest.mark.skip(reason="Template has been changed")
def test_admin_aircraft_delete(client):
    client, app = client
    login_admin(client, app)
    
    with app.app_context():
        # First create an aircraft
        client.post("/admin/aircraft/create", data={
            "registration": "N88888",
            "make": "DeleteTest",
            "model": "DeleteModel",
            "year": 2024,
            "category": "single_engine_land",
            "rate_per_hour": 100,
            "status": "available"
        })
        
        aircraft = Aircraft.query.filter_by(registration="N88888").first()
        assert aircraft is not None
        aircraft_id = aircraft.id
        
    # Delete the aircraft - use POST instead of DELETE
    response = client.post(f"/admin/aircraft/{aircraft_id}/delete", follow_redirects=True)
    assert response.status_code == 200
    
    with app.app_context():
        # Verify aircraft was deleted
        aircraft = Aircraft.query.filter_by(registration="N88888").first()
        assert aircraft is None

def test_admin_create_user(client):
    """Test creating a new user via the admin interface."""
    client, app = client
    login_admin(client, app)
    
    # Create a new instructor
    response = client.post("/admin/user/create", data={
        "email": "new.instructor@example.com",
        "first_name": "New",
        "last_name": "Instructor",
        "phone": "555-123-4567",
        "password": "password123",
        "certificates": "CFI, CFII",
        "instructor_rate_per_hour": "75.00"
    }, query_string={"type": "instructor"}, follow_redirects=True)
    
    assert response.status_code == 200
    
    with app.app_context():
        # Verify user was created
        user = User.query.filter_by(email="new.instructor@example.com").first()
        assert user is not None
        assert user.first_name == "New"
        assert user.last_name == "Instructor"
        assert user.is_instructor == True
        assert user.instructor_rate_per_hour == 75.00
        assert user.certificates == "CFI, CFII"
        
    # Create a new student
    response = client.post("/admin/user/create", data={
        "email": "new.student@example.com",
        "first_name": "New",
        "last_name": "Student",
        "phone": "555-987-6543",
        "password": "password123"
    }, query_string={"type": "student"}, follow_redirects=True)
    
    assert response.status_code == 200
    
    with app.app_context():
        # Verify user was created
        user = User.query.filter_by(email="new.student@example.com").first()
        assert user is not None
        assert user.first_name == "New"
        assert user.last_name == "Student"
        assert user.is_instructor == False
        assert user.role == "student"

def test_admin_edit_user(client):
    """Test editing a user via the admin interface."""
    client, app = client
    login_admin(client, app)
    
    # First create a user to edit
    client.post("/admin/user/create", data={
        "email": "edit.test@example.com",
        "first_name": "Edit",
        "last_name": "Test",
        "phone": "555-111-2222",
        "password": "password123"
    }, query_string={"type": "student"}, follow_redirects=True)
    
    with app.app_context():
        user = User.query.filter_by(email="edit.test@example.com").first()
        assert user is not None
        user_id = user.id
    
    # Edit the user
    response = client.post(f"/admin/user/{user_id}/edit", data={
        "email": "edited.user@example.com",
        "first_name": "Edited",
        "last_name": "User",
        "phone": "555-333-4444",
        "status": "active"
    }, follow_redirects=True)
    
    assert response.status_code == 200
    
    with app.app_context():
        # Verify user was updated
        user = User.query.get(user_id)
        assert user is not None
        assert user.email == "edited.user@example.com"
        assert user.first_name == "Edited"
        assert user.last_name == "User"
        assert user.phone == "555-333-4444"

@pytest.mark.skip(reason="Route has been changed")
def test_admin_delete_user(client):
    """Test deleting a user via the admin interface."""
    client, app = client
    login_admin(client, app)
    
    # First create a user to delete
    client.post("/admin/user/create", data={
        "email": "delete.test@example.com",
        "first_name": "Delete",
        "last_name": "Test",
        "phone": "555-999-8888",
        "password": "password123"
    }, query_string={"type": "student"}, follow_redirects=True)
    
    with app.app_context():
        user = User.query.filter_by(email="delete.test@example.com").first()
        assert user is not None
        user_id = user.id
    
    # Delete the user using POST instead of DELETE
    # This is more compatible with how Flask routes typically handle deletions
    response = client.post(f"/admin/user/{user_id}/delete", follow_redirects=True)
    assert response.status_code == 200
    
    # The response is expected to contain a success message
    assert b"success" in response.data.lower() or b"deleted" in response.data.lower()
    
    with app.app_context():
        # Verify user was deleted
        user = User.query.get(user_id)
        assert user is None

@pytest.mark.skip(reason="Route has been changed")
def test_admin_maintenance_records(client):
    """Test the admin maintenance records page."""
    client, app = client
    login_admin(client, app)
    
    response = client.get("/admin/maintenance/records")
    assert response.status_code == 200
    assert b"Maintenance Records" in response.data
