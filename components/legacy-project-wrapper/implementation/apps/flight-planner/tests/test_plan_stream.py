from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_plan_stream_route_mode_emits_done(monkeypatch) -> None:
    import app.routers.route as route_router
    from app.services.xctry_route_planner import RouteSegment

    monkeypatch.setattr(
        route_router,
        "get_airport_coordinates",
        lambda code: {
            "icao": code.upper(),
            "iata": "",
            "latitude": 40.0,
            "longitude": -75.0 if code.upper() == "AAA" else -76.0,
        },
    )

    monkeypatch.setattr(
        route_router,
        "plan_route",
        lambda **_: (
            [(40.0, -75.0), (40.0, -76.0)],
            [
                RouteSegment(
                    start=(40.0, -75.0),
                    end=(40.0, -76.0),
                    segment_type="cruise",
                    vfr_altitude_ft=5500,
                )
            ],
        ),
    )

    client = TestClient(app)
    with client.stream(
        "POST",
        "/api/plan/stream",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "BBB",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "apply_wind": False,
            "include_alternates": False,
        },
    ) as resp:
        assert resp.status_code == 200
        body = "".join(resp.iter_text())

    assert "event: progress" in body
    assert "event: done" in body
