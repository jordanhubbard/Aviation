"""
Smoke integration tests — run in CI without a live server.

These tests validate inter-package contracts and configuration without
requiring the full docker-compose stack to be running.  Tests that need
a live service are marked @pytest.mark.live and skipped unless
RUN_LIVE_TESTS=1 is set.
"""
import os
import pytest


SKIP_LIVE = not os.getenv("RUN_LIVE_TESTS")


def test_requirements_parseable():
    """Root requirements.txt can be parsed as plain text."""
    req_path = os.path.join(os.path.dirname(__file__), "..", "..", "requirements.txt")
    with open(req_path) as f:
        lines = f.readlines()
    packages = [l.strip() for l in lines if l.strip() and not l.startswith("#")]
    assert len(packages) > 0


def test_flight_planner_app_module_structure():
    """flight-planner app directory has expected structure."""
    base = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "flight-planner")
    assert os.path.isfile(os.path.join(base, "main.py")), "main.py missing"
    assert os.path.isfile(os.path.join(base, "requirements.txt")), "requirements.txt missing"


@pytest.mark.skipif(SKIP_LIVE, reason="live server not available in CI; set RUN_LIVE_TESTS=1")
def test_flight_plan_api_live():
    """Live: flight plan API returns 200."""
    import requests  # noqa: PLC0415
    r = requests.get("http://localhost:8000/api/flight-plan", timeout=5)
    assert r.status_code == 200


@pytest.mark.skipif(SKIP_LIVE, reason="live server not available in CI; set RUN_LIVE_TESTS=1")
def test_nav_data_api_live():
    """Live: nav-data API returns 200."""
    import requests  # noqa: PLC0415
    r = requests.get("http://localhost:8000/api/nav-data", timeout=5)
    assert r.status_code == 200
