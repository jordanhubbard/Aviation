from fastapi.testclient import TestClient

from main import app


def test_plan_route_mode_ok(monkeypatch) -> None:
    def fake_get_airport_coordinates(code: str):
        code_u = code.upper()
        if code_u == "AAA":
            return {"latitude": 40.0, "longitude": -75.0}
        if code_u == "BBB":
            return {"latitude": 41.0, "longitude": -76.0}
        return None

    import app.routers.route as route_router

    monkeypatch.setattr(route_router, "get_airport_coordinates", fake_get_airport_coordinates)
    monkeypatch.setattr(
        route_router,
        "recommend_alternates",
        lambda **_: [
            {
                "code": "CCC",
                "name": "Alt",
                "type": "small_airport",
                "distance_nm": 12.3,
                "weather": {"visibility_sm": 10.0, "ceiling_ft": 5000},
            }
        ],
    )

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "BBB",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "include_alternates": True,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["route"] == ["AAA", "BBB"]
    assert body["origin_coords"] == [40.0, -75.0]
    assert body["destination_coords"] == [41.0, -76.0]
    assert "distance_nm" in body
    assert "time_hr" in body
    assert "segments" in body
    assert body["alternates"][0]["code"] == "CCC"


def test_plan_route_mode_terrain_does_not_require_opentopo_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENTOPOGRAPHY_API_KEY", raising=False)
    monkeypatch.delenv("TERRAIN_PROVIDER", raising=False)

    def fake_get_airport_coordinates(code: str):
        code_u = code.upper()
        if code_u == "AAA":
            return {"latitude": 40.0, "longitude": -75.0}
        if code_u == "BBB":
            return {"latitude": 41.0, "longitude": -76.0}
        return None

    import app.routers.route as route_router

    monkeypatch.setattr(route_router, "get_airport_coordinates", fake_get_airport_coordinates)
    monkeypatch.setattr(
        route_router.terrain_service, "_fetch_open_meteo_elevations_m", lambda _pts: [0.0, 0.0]
    )

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "BBB",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": True,
        },
    )

    assert resp.status_code == 200


def test_plan_route_mode_avoid_terrain_increases_altitude_and_splits_legs(monkeypatch) -> None:
    def fake_get_airport_coordinates(code: str):
        code_u = code.upper()
        if code_u == "AAA":
            return {"latitude": 0.0, "longitude": 0.0}
        if code_u == "BBB":
            return {"latitude": 0.0, "longitude": 0.15}
        return None

    import app.routers.route as route_router
    from app.services.xctry_route_planner import RouteSegment

    monkeypatch.setattr(route_router, "get_airport_coordinates", fake_get_airport_coordinates)

    pts = [(0.0, 0.0), (0.0, 0.05), (0.0, 0.1), (0.0, 0.15)]
    segs = [
        RouteSegment(start=pts[0], end=pts[1], segment_type="cruise", vfr_altitude_ft=5500),
        RouteSegment(start=pts[1], end=pts[2], segment_type="cruise", vfr_altitude_ft=5500),
        RouteSegment(start=pts[2], end=pts[3], segment_type="cruise", vfr_altitude_ft=5500),
    ]

    monkeypatch.setattr(route_router, "plan_route", lambda **_: (pts, segs))

    # Open-Meteo elevations are meters; the middle segment should force an 8000 ft flight level
    # (max terrain ~6560 ft + 1000 ft clearance rounded up to nearest 500).
    monkeypatch.setattr(
        route_router.terrain_service,
        "_fetch_open_meteo_elevations_m",
        lambda _pts: [0.0, 0.0, 2000.0, 2000.0, 0.0, 0.0],
    )

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "BBB",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": True,
            "apply_wind": False,
            "include_alternates": False,
        },
    )

    assert resp.status_code == 200
    body = resp.json()

    assert len(body["segments"]) == 3
    assert body["segments"][1]["vfr_altitude"] == 8000
    assert body["segments"][1]["type"] == "climb"
    assert body["segments"][2]["vfr_altitude"] == 5500
    assert body["segments"][2]["type"] == "descent"

    legs = body.get("legs")
    assert legs is not None
    assert len(legs) == 3
    assert legs[0]["from_code"] == "AAA"
    assert legs[0]["to_code"] == "WP1"
    assert legs[1]["type"] == "climb"
    assert legs[1]["vfr_altitude"] == 8000
    assert legs[2]["to_code"] == "BBB"


def test_plan_route_mode_astar_multi_leg(monkeypatch) -> None:
    import app.routers.route as route_router

    monkeypatch.setattr(
        route_router,
        "load_airport_cache",
        lambda: [
            {"icao": "AAA", "latitude": 40.0, "longitude": -75.0, "name": "A"},
            {"icao": "BBB", "latitude": 41.0, "longitude": -75.0, "name": "B"},
            {"icao": "CCC", "latitude": 42.0, "longitude": -75.0, "name": "C"},
        ],
    )

    def fake_get_airport_coordinates(code: str):
        code_u = code.upper()
        if code_u == "AAA":
            return {"icao": "AAA", "iata": "", "latitude": 40.0, "longitude": -75.0}
        if code_u == "BBB":
            return {"icao": "BBB", "iata": "", "latitude": 41.0, "longitude": -75.0}
        if code_u == "CCC":
            return {"icao": "CCC", "iata": "", "latitude": 42.0, "longitude": -75.0}
        return None

    monkeypatch.setattr(route_router, "get_airport_coordinates", fake_get_airport_coordinates)

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "CCC",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "plan_fuel_stops": True,
            "aircraft_range_nm": 80,
            "max_leg_distance": 80,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["route"] == ["AAA", "BBB", "CCC"]
    assert body["fuel_stops"] == ["BBB"]
    assert body["fuel_required_with_reserve_gal"] is not None

    legs = body.get("legs")
    assert legs is not None
    assert len(legs) == 2
    assert legs[0]["from_code"] == "AAA"
    assert legs[0]["to_code"] == "BBB"
    assert legs[0]["fuel_stop"] is True
    assert legs[0]["refuel_minutes"] == 30
    assert legs[1]["from_code"] == "BBB"
    assert legs[1]["to_code"] == "CCC"
    assert legs[1]["fuel_stop"] is False
    assert legs[1]["refuel_minutes"] == 0
    assert legs[1]["elapsed_minutes"] >= legs[0]["elapsed_minutes"] + 30


def test_plan_route_mode_astar_multi_leg_from_fuel_on_board(monkeypatch) -> None:
    import app.routers.route as route_router

    monkeypatch.setattr(
        route_router,
        "load_airport_cache",
        lambda: [
            {"icao": "AAA", "latitude": 40.0, "longitude": -75.0, "name": "A"},
            {"icao": "BBB", "latitude": 41.0, "longitude": -75.0, "name": "B"},
            {"icao": "CCC", "latitude": 42.0, "longitude": -75.0, "name": "C"},
        ],
    )

    def fake_get_airport_coordinates(code: str):
        code_u = code.upper()
        if code_u == "AAA":
            return {"icao": "AAA", "iata": "", "latitude": 40.0, "longitude": -75.0}
        if code_u == "BBB":
            return {"icao": "BBB", "iata": "", "latitude": 41.0, "longitude": -75.0}
        if code_u == "CCC":
            return {"icao": "CCC", "iata": "", "latitude": 42.0, "longitude": -75.0}
        return None

    monkeypatch.setattr(route_router, "get_airport_coordinates", fake_get_airport_coordinates)

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "CCC",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "plan_fuel_stops": True,
            "fuel_burn_gph": 10.0,
            "fuel_on_board_gal": 14.5,
            "reserve_minutes": 45,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["route"] == ["AAA", "BBB", "CCC"]
    assert body["fuel_stops"] == ["BBB"]


def test_plan_route_mode_fuel_calculation(monkeypatch) -> None:
    import app.routers.route as route_router

    monkeypatch.setattr(
        route_router,
        "load_airport_cache",
        lambda: [
            {"icao": "AAA", "latitude": 40.0, "longitude": -75.0, "name": "A"},
            {"icao": "CCC", "latitude": 41.0, "longitude": -75.0, "name": "C"},
        ],
    )

    monkeypatch.setattr(
        route_router,
        "get_airport_coordinates",
        lambda code: {
            "icao": code.upper(),
            "iata": "",
            "latitude": 40.0 if code.upper() == "AAA" else 41.0,
            "longitude": -75.0,
        },
    )

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "CCC",
            "speed": 60.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "fuel_burn_gph": 10.0,
            "reserve_minutes": 60,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    # Roughly ~60nm between 1 degree latitude, at 60kt ~= 1hr, so ~10gal + 10gal reserve.
    assert body["fuel_required_gal"] is not None
    assert body["fuel_required_with_reserve_gal"] is not None
    assert body["fuel_required_with_reserve_gal"] >= body["fuel_required_gal"]


def test_plan_route_mode_apply_wind_adjusts_groundspeed(monkeypatch) -> None:
    import app.routers.route as route_router

    monkeypatch.setattr(
        route_router,
        "get_airport_coordinates",
        lambda code: {
            "icao": code.upper(),
            "iata": "",
            "latitude": 0.0,
            "longitude": 0.0 if code.upper() == "AAA" else 1.0,
        },
    )

    monkeypatch.setattr(
        route_router.open_meteo,
        "get_current_weather",
        lambda lat, lon: {"windspeed": 20.0, "winddirection": 90},
    )

    client = TestClient(app)
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "AAA",
            "destination": "BBB",
            "speed": 100.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "apply_wind": True,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["groundspeed_kt"] is not None
    assert body["groundspeed_kt"] < 100.0


def test_plan_local_mode_ok(monkeypatch) -> None:
    import app.routers.local as local_router

    monkeypatch.setattr(
        local_router,
        "get_airport_coordinates",
        lambda code: {
            "icao": code.upper(),
            "iata": "",
            "name": "Center",
            "city": "City",
            "country": "US",
            "latitude": 40.0,
            "longitude": -75.0,
            "elevation": 0,
            "type": "small_airport",
        },
    )

    monkeypatch.setattr(
        local_router,
        "load_airport_cache",
        lambda: [
            {
                "icao": "AAA",
                "latitude": 40.0,
                "longitude": -75.0,
                "name": "Center",
                "city": "City",
                "country": "US",
            },
            {
                "icao": "BBB",
                "latitude": 40.1,
                "longitude": -75.0,
                "name": "Nearby",
                "city": "Town",
                "country": "US",
            },
            {
                "icao": "CCC",
                "latitude": 42.0,
                "longitude": -75.0,
                "name": "Far",
                "city": "Far Town",
                "country": "US",
            },
        ],
    )

    client = TestClient(app)
    resp = client.post("/api/plan", json={"mode": "local", "airport": "AAA", "radius_nm": 25})
    assert resp.status_code == 200

    body = resp.json()
    assert body["airport"] == "AAA"
    assert body["center"]["icao"] == "AAA"
    assert len(body["nearby_airports"]) == 1
    assert body["nearby_airports"][0]["icao"] == "BBB"
