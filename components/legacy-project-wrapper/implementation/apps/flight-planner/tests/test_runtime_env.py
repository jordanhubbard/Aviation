import json

from fastapi.testclient import TestClient

import app as application
from app.config import settings


def environment_payload(response):
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/javascript")
    assert response.headers["cache-control"] == "no-store"
    return json.loads(response.text.removeprefix("window.__ENV__ = ").removesuffix(";\n"))


def test_hosted_runtime_overrides_empty_static_configuration(monkeypatch, tmp_path):
    backend = tmp_path / "backend"
    static = backend / "static"
    static.mkdir(parents=True)
    (static / "index.html").write_text("<html>Planner</html>")
    (static / "env.js").write_text("window.__ENV__ = {}")
    monkeypatch.setattr(application, "__file__", str(backend / "app" / "__init__.py"))
    monkeypatch.setenv("VITE_OPENWEATHERMAP_API_KEY", "browser-weather-key")
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "private-server-weather-key")
    monkeypatch.setenv("OPENCLAW_API_KEY", "private-chat-key")
    client = TestClient(application.create_app(settings))

    assert client.get("/").status_code == 200
    response = client.get("/env.js")
    assert environment_payload(response) == {"VITE_OPENWEATHERMAP_API_KEY": "browser-weather-key"}
    assert "private-" not in response.text


def test_server_credentials_are_not_automatically_published(monkeypatch, client):
    monkeypatch.delenv("VITE_OPENWEATHERMAP_API_KEY", raising=False)
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "server-only-key")
    assert environment_payload(client.get("/env.js")) == {"VITE_OPENWEATHERMAP_API_KEY": ""}


def test_runtime_values_are_encoded_as_javascript_data(monkeypatch, client):
    value = 'quotes"\\\n;window.injected=true; //'
    monkeypatch.setenv("VITE_OPENWEATHERMAP_API_KEY", value)
    response = client.get("/env.js")
    assert environment_payload(response)["VITE_OPENWEATHERMAP_API_KEY"] == value
    assert len(response.text.splitlines()) == 1
