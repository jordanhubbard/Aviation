import pytest
from fastapi.testclient import TestClient

from app.utils.ttl_cache import weather_cache
from main import app


@pytest.fixture(autouse=True)
def _clear_weather_cache() -> None:
    weather_cache.clear()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
