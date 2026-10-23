import pytest
from app.models import Aircraft
from datetime import datetime, timezone, timedelta

class DummyAircraft(Aircraft):
    # Allow instantiation without DB
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def test_display_name():
    ac = DummyAircraft(registration="N12345", make="Cessna", model="172S")
    assert ac.display_name == "N12345 (Cessna 172S)"

def test_is_available():
    ac = DummyAircraft(status="available")
    assert ac.is_available is True
    ac.status = "maintenance"
    assert ac.is_available is False

def test_time_to_maintenance_none():
    ac = DummyAircraft(hobbs_time=None, last_maintenance=None)
    assert ac.time_to_maintenance is None

def test_time_to_maintenance_value():
    ac = DummyAircraft(hobbs_time=100.0, last_maintenance=80.0)
    assert ac.time_to_maintenance == 20.0

def test_days_to_maintenance_none():
    ac = DummyAircraft(last_maintenance=None)
    assert ac.days_to_maintenance is None

def test_days_to_maintenance_value():
    last_maint = datetime.now(timezone.utc) - timedelta(days=10)
    ac = DummyAircraft(last_maintenance=last_maint)
    assert ac.days_to_maintenance == 10

# image_url property is more complex due to Flask context and ensure_aircraft_image
# We'll test the logic up to the ensure_aircraft_image call using monkeypatching
from flask import Flask
from app.models import ensure_aircraft_image

def test_image_url_with_image(monkeypatch):
    app = Flask(__name__)
    ac = DummyAircraft(image_filename="test.jpg", make="Cessna", model="172S")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/test.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "images/aircraft/test.jpg" in url

def test_image_url_category(monkeypatch):
    app = Flask(__name__)
    ac = DummyAircraft(image_filename=None, category="single_engine_land", engine_type="piston", make="Cessna", model="172")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/cessna172.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "images/aircraft/cessna172.jpg" in url

    ac = DummyAircraft(image_filename=None, category="multi_engine_land", engine_type="jet", make="Cessna", model="Citation")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/citation.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "images/aircraft/citation.jpg" in url

    ac = DummyAircraft(image_filename=None, category=None, engine_type=None)
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/default.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "images/aircraft/default.jpg" in url

# --- AnonymousUser tests ---
from app.models import AnonymousUser

def test_anonymous_user_properties():
    anon = AnonymousUser()
    assert anon.is_active is False
    assert anon.is_authenticated is False
    assert anon.is_anonymous is True
    assert anon.get_id() is None
    assert repr(anon) == '<AnonymousUser>'

# --- User name fallback logic ---
import types
class DummyUser:
    first_name = None
    last_name = None
    email = None
    def __init__(self, first=None, last=None, email=None):
        self.first_name = first
        self.last_name = last
        self.email = email
    def name(self):
        if self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        return self.email or "Unknown"

def test_user_name_fallback():
    u = DummyUser(first="A", last="B", email="a@b.com")
    assert u.name() == "A"
    u = DummyUser(first=None, last="B", email="a@b.com")
    assert u.name() == "B"
    u = DummyUser(first=None, last=None, email="a@b.com")
    assert u.name() == "a@b.com"
    u = DummyUser(first=None, last=None, email=None)
    assert u.name() == "Unknown"

# --- User.name property (real model) ---
def test_user_name_property():
    from app import create_app, db
    from app.models import User
    app = create_app()
    with app.app_context():
        db.create_all()
        u1 = User(email="a@b.com", first_name="A", last_name="B", role="student", status="active")
        u2 = User(email="b@b.com", first_name=None, last_name="B", role="student", status="active")
        u3 = User(email="c@b.com", first_name=None, last_name=None, role="student", status="active")
        db.session.add_all([u1, u2, u3])
        db.session.commit()
        assert u1.name == "A"
        assert u2.name == "B"
        assert u3.name == "c@b.com"
        db.session.remove()
        db.drop_all()

# --- EquipmentStatus.requires_inspection ---
from app.models import EquipmentStatus
from datetime import datetime, timedelta, timezone

def test_equipment_requires_inspection():
    eq = EquipmentStatus()
    eq.next_inspection = None
    assert eq.requires_inspection is False
    eq.next_inspection = datetime.now(timezone.utc) - timedelta(days=1)
    assert eq.requires_inspection is True
    eq.next_inspection = datetime.now(timezone.utc) + timedelta(days=1)
    assert eq.requires_inspection is False

# --- EquipmentStatus.is_operational property ---
def test_equipment_is_operational():
    from app.models import EquipmentStatus
    eq = EquipmentStatus(status='operational')
    assert eq.is_operational is True
    eq.status = 'inoperative'
    assert eq.is_operational is False

# --- MaintenanceRecord.maintenance_type_obj ---
from app.models import MaintenanceRecord, MaintenanceType
from app import create_app, db
from app.models import User

def test_maintenance_type_obj():
    app = create_app()
    with app.app_context():
        db.create_all()
        admin = User(email="admin@example.com", first_name="Admin", last_name="User", role="admin", is_admin=True, status="active")
        admin.set_password("password")
        db.session.add(admin)
        db.session.commit()
        mt = MaintenanceType(id=123, name="Oil Change", created_by_id=admin.id)
        db.session.add(mt)
        db.session.commit()
        rec = MaintenanceRecord(maintenance_type_id=123)
        assert rec.maintenance_type_obj == mt
        db.session.remove()
        db.drop_all()

# --- Aircraft.image_url branches (turboprop, piston, jet) ---
from flask import Flask

def test_aircraft_image_url_all_branches(monkeypatch):
    app = Flask(__name__)
    # single_engine_land, turboprop
    ac = DummyAircraft(image_filename=None, category="single_engine_land", engine_type="turboprop")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/tbm930.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "tbm930.jpg" in url
    # multi_engine_land, piston
    ac = DummyAircraft(image_filename=None, category="multi_engine_land", engine_type="piston")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/baron58.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "baron58.jpg" in url
    # multi_engine_land, turboprop
    ac = DummyAircraft(image_filename=None, category="multi_engine_land", engine_type="turboprop")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/kingair350.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "kingair350.jpg" in url
    # multi_engine_land, jet
    ac = DummyAircraft(image_filename=None, category="multi_engine_land", engine_type="jet")
    monkeypatch.setattr("app.models.ensure_aircraft_image", lambda *a, **kw: "images/aircraft/citation.jpg")
    with app.test_request_context():
        url = ac.image_url
        assert "citation.jpg" in url

# --- CheckIn.timestamp property ---
from app.models import CheckIn

def test_checkin_timestamp():
    ci = CheckIn(check_in_time=12345)
    assert ci.timestamp == 12345

# --- ensure_default_aircraft_image ---
from app.models import ensure_default_aircraft_image
import tempfile
import os

def test_ensure_default_aircraft_image_creates_file(monkeypatch):
    with tempfile.TemporaryDirectory() as tmpdir:
        fake_dir = os.path.join(tmpdir, "static", "images", "aircraft")
        fake_file = os.path.join(fake_dir, "default.jpg")
        monkeypatch.setattr("os.path.dirname", lambda path=None: fake_dir)
        monkeypatch.setattr("os.path.exists", lambda path: False)
        monkeypatch.setattr("os.makedirs", lambda path, exist_ok: True)
        written = {}
        def fake_open(path, mode):
            written['called'] = True
            class DummyFile:
                def write(self, data):
                    written['data'] = data
                def __enter__(self): return self
                def __exit__(self, exc_type, exc_val, exc_tb): return False
            return DummyFile()
        monkeypatch.setattr("builtins.open", fake_open)
        ensure_default_aircraft_image()
        assert written['called']

# --- ensure_aircraft_image fallback branches ---
from app.models import ensure_aircraft_image

def test_ensure_aircraft_image_fallback(monkeypatch):
    # Simulate error in fetching image
    monkeypatch.setattr("os.path.exists", lambda path: False)
    monkeypatch.setattr("os.path.getsize", lambda path: 0)
    monkeypatch.setattr("app.models.logger", type("DummyLogger", (), {"warning": lambda *a, **k: None, "error": lambda *a, **k: None, "info": lambda *a, **k: None})())
    monkeypatch.setattr("builtins.open", lambda *a, **k: type("DummyFile", (), {"__enter__": lambda s: s, "__exit__": lambda s, e, v, t: False, "write": lambda s, d: None})())
    monkeypatch.setattr("os.makedirs", lambda path, exist_ok: True)
    def fake_requests_get(url, timeout=None):
        raise Exception("fail")
    monkeypatch.setattr("requests.get", fake_requests_get)
    result = ensure_aircraft_image("fail.jpg", make="fail", model="fail")
    assert result == 'images/aircraft/default.jpg'

# --- ensure_aircraft_image fallback logging/error path ---
def test_ensure_aircraft_image_error_branch(monkeypatch):
    from app.models import ensure_aircraft_image
    import builtins
    called = {}
    monkeypatch.setattr("os.path.exists", lambda path: False)
    monkeypatch.setattr("os.path.getsize", lambda path: 0)
    class DummyLogger:
        def warning(self, *a, **k): called['warning'] = True
        def error(self, *a, **k): called['error'] = True
        def info(self, *a, **k): called['info'] = True
    monkeypatch.setattr("app.models.logger", DummyLogger())
    monkeypatch.setattr("builtins.open", lambda *a, **k: type("DummyFile", (), {"__enter__": lambda s: s, "__exit__": lambda s, e, v, t: False, "write": lambda s, d: None})())
    monkeypatch.setattr("os.makedirs", lambda path, exist_ok: True)
    def fake_requests_get(url, timeout=None):
        raise Exception("fail")
    monkeypatch.setattr("requests.get", fake_requests_get)
    result = ensure_aircraft_image("fail2.jpg", make="fail", model="fail")
    assert result == 'images/aircraft/default.jpg'
    assert 'error' in called and 'info' in called
