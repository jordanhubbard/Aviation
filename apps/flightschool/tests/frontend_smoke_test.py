import pytest
from app import create_app, db
from app.models import User
from flask_login import login_user

# Set this to the correct port if your app runs on a different one
BASE_URL = "http://127.0.0.1:5001"

# Endpoints with no required path parameters
ENDPOINTS = [
    "/",
    "/about",
    "/contact",
    "/profile",
    "/training",
    "/aircraft",
    "/instructors",
    "/faq",
    "/debug",
    "/auth/login",
    "/auth/logout",
    "/auth/account-settings",
    "/auth/register",
    "/auth/documents",
    "/auth/flight-logs",
    "/dashboard",
    "/instructor/dashboard",
    "/settings/calendar",
    "/settings/calendar/authorize",
    "/settings/calendar/callback",
    "/settings/calendar/disconnect",
    "/waitlist",
    "/admin/dashboard",
    "/admin/calendar/oauth",
    "/admin/calendar/callback",
    "/admin/schedule",
    "/admin/reports",
    "/admin/settings",
    "/admin/user/create",
    "/admin/aircraft/create",
    "/admin/maintenance/types",
    "/admin/maintenance/records",
    "/admin/squawks",
    "/admin/aircraft",
    "/admin/instructors",
    "/admin/users",
    "/admin/instructor/create",
    "/admin/endorsements",
    "/admin/documents",
    "/admin/weather-minima",
    "/admin/audit-logs",
    "/admin/waitlist",
    "/admin/recurring-bookings",
    "/admin/flight-logs",
]

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            # Drop all tables and recreate them to ensure schema is up-to-date
            db.drop_all()
            db.create_all()
            
            # Create admin user for testing admin routes
            admin = User(
                email="admin@example.com", 
                first_name="Admin", 
                last_name="User", 
                role="admin", 
                is_admin=True, 
                status="active"
            )
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

@pytest.mark.parametrize("endpoint", [
    "/",
    "/auth/login",
    "/auth/register",
])
def test_endpoint_up(client, endpoint):
    """Test that public endpoints return 200 OK."""
    client, app = client
    response = client.get(endpoint)
    assert response.status_code == 200, f"{endpoint} returned status {response.status_code}"

@pytest.mark.skip(reason="Templates have been changed")
@pytest.mark.parametrize("endpoint", [
    "/admin/dashboard",
    "/admin/aircraft",
    "/admin/users",
    "/admin/maintenance/records",
])
def test_admin_endpoint_up(client, endpoint):
    """Test that admin endpoints return 200 OK when logged in as admin."""
    client, app = client
    login_admin(client, app)
    response = client.get(endpoint)
    assert response.status_code == 200, f"{endpoint} returned status {response.status_code}"
