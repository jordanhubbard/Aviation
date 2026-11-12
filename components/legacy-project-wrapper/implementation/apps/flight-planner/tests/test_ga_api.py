"""API contracts use independent numeric examples and explicit provider fixtures."""

import math

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app
from app.routers import ga
from app.services import ga_data

client = TestClient(app)
PERFORMANCE = {
    "distance_nm": 200,
    "true_airspeed_kt": 120,
    "true_course_deg": 0,
    "wind_from_deg": 0,
    "wind_speed_kt": 20,
    "fuel_burn_gph": 10,
    "fuel_on_board_gal": 30,
    "reserve_minutes": 45,
    "indicated_altitude_ft": 5000,
    "altimeter_inhg": 29.92,
    "temperature_c": 25,
}


@pytest.fixture(autouse=True)
def isolate_providers(monkeypatch):
    ga_data._CACHE.clear()

    def no_network(*a, **kw):
        raise AssertionError("Unexpected provider network request")

    monkeypatch.setattr(ga_data.httpx, "get", no_network)


def test_performance_headwind_fuel_reserve_density():
    response = client.post("/api/performance", json=PERFORMANCE)
    assert response.status_code == 200
    value = response.json()
    assert value["groundspeed_kt"] == 100
    assert value["ete_minutes"] == 120
    assert value["trip_fuel_gal"] == 20
    assert value["reserve_fuel_gal"] == 7.5
    assert value["total_required_gal"] == 27.5
    assert value["remaining_fuel_gal"] == 10
    assert value["reserve_satisfied"] is True
    assert value["range_with_reserve_nm"] == 225
    assert value["density_altitude_ft"] == pytest.approx(7400, abs=20)


def test_crosswind_solution_and_insufficient_fuel():
    r = client.post(
        "/api/performance",
        json={**PERFORMANCE, "wind_from_deg": 90, "wind_speed_kt": 60, "fuel_on_board_gal": 5},
    ).json()
    assert r["wind_correction_deg"] == pytest.approx(30)
    assert r["true_heading_deg"] == pytest.approx(30)
    assert r["groundspeed_kt"] == pytest.approx(math.sqrt(120**2 - 60**2))
    assert r["reserve_satisfied"] is False
    assert r["range_with_reserve_nm"] == 0


@pytest.mark.parametrize(
    "change",
    [
        {"wind_speed_kt": 150},
        {"fuel_burn_gph": 0},
        {"distance_nm": -1},
        {"true_course_deg": 360},
        {"temperature_c": None},
        {"indicated_altitude_ft": "NaN"},
        {"unknown": 1},
    ],
)
def test_invalid_performance_rejected(change):
    assert client.post("/api/performance", json={**PERFORMANCE, **change}).status_code == 422


def test_aircraft_reference_is_bounded_and_unknown_is_not_guessed():
    r = client.get("/api/aircraft/C172").json()
    assert r["operating_profile"]["fuel_limits"]["usable_capacity_gal"] == 53
    assert r["source"]["reference_url"].startswith("https://cessna.")
    assert "not predicted" in r["limitations"]
    assert client.get("/api/aircraft/NO_SUCH_PLANE").status_code == 404
    r = client.get("/api/aircraft?q=Cessna&limit=2").json()
    assert len(r["aircraft"]) == 2
    assert r["total_matches"] > 2


@pytest.fixture
def airports(monkeypatch):
    rows = [
        {"icao": "KAAA", "latitude": 0, "longitude": 0, "country": "US", "type": "small_airport"},
        {"icao": "KBBB", "latitude": 1, "longitude": 0, "country": "US", "type": "small_airport"},
        {"icao": "KOLD", "latitude": 0.5, "longitude": 0.5, "country": "US", "type": "closed"},
    ]
    monkeypatch.setattr(
        ga, "get_airport", lambda code: next((a for a in rows if a["icao"] == code.upper()), None)
    )
    monkeypatch.setattr(ga, "load_airport_cache", lambda: rows)
    return rows


def test_navlog_and_geojson_lon_lat_order(airports):
    r = client.post(
        "/api/navlog",
        json={"airports": ["KAAA", "KBBB"], "true_airspeed_kt": 100, "fuel_burn_gph": 10},
    ).json()
    assert r["distance_nm"] == pytest.approx(60.04046)
    assert r["legs"][0]["true_course_deg"] == 0
    assert r["trip_fuel_gal"] == pytest.approx(6.004046)
    assert r["reserve_fuel_gal"] == 7.5
    assert r["geometry"]["coordinates"] == [[0, 0], [0, 1]]
    assert (
        client.post(
            "/api/navlog",
            json={"airports": ["KAAA", "KAAA"], "true_airspeed_kt": 100, "fuel_burn_gph": 10},
        ).status_code
        == 422
    )


def test_airport_map_excludes_closed_and_reports_truncation(airports):
    r = client.get("/api/map/airports?west=-1&south=-1&east=2&north=2&limit=1").json()
    assert r["truncated"] is True
    assert r["total_matches"] == 2
    assert r["features"][0]["geometry"]["coordinates"] == [0, 0]
    assert client.get("/api/map/airports?west=2&south=0&east=1&north=1").status_code == 422
    assert client.get("/api/map/airports?west=-180&south=-90&east=180&north=90").status_code == 422


def test_facility_data_and_provider_cache_keep_date_and_unknowns(monkeypatch):
    calls = []

    def fetch(url, params=None, **kw):
        calls.append(params)
        return {
            "features": [
                {
                    "attributes": {
                        "ICAO_ID": "KAAA",
                        "EFF_DATE": "2026/10/29",
                        "FUEL_TYPES": "100LL",
                        "OTHER_SERVICES": "INSTR,RNTL",
                    }
                }
            ]
        }

    monkeypatch.setattr(ga_data, "fetch", fetch)
    first = ga_data.airport_facilities("KAAA")
    second = ga_data.airport_facilities("KAAA")
    assert len(calls) == 1
    assert first == second
    assert first["source"]["effective_date"] == "2026/10/29"
    assert first["record"]["FUEL_TYPES"] == "100LL"
    assert first["fuel_prices"] is None
    assert first["fbo_hours"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"error": {"code": 400}},
        {},
        {"features": {}},
        {"features": [], "exceededTransferLimit": True},
    ],
)
def test_invalid_facility_provider_is_failure_not_empty_success(monkeypatch, payload):
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: payload)
    with pytest.raises(ga_data.DataUnavailable):
        ga_data.airport_facilities("KAAA")


def test_airport_details_preserve_runway_and_frequency_data(monkeypatch, airports):
    def fetch(url, *args, **kwargs):
        if "runways.csv" in url:
            return "airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,he_ident\nKAAA,2400,50,ASP,1,0,18,36\n"
        if "airport-frequencies.csv" in url:
            return "airport_ident,type,description,frequency_mhz\nKAAA,CTAF,Traffic,122.8\n"
        return {"features": []}

    monkeypatch.setattr(ga_data, "fetch", fetch)
    r = client.get("/api/airports/KAAA/details")
    assert r.status_code == 200
    data = r.json()
    assert data["runways"][0]["length_ft"] == 2400
    assert data["frequencies"][0]["frequency_mhz"] == 122.8
    assert data["services"]["status"] == "no_record"
    assert data["sources"][0]["retrieved_at_utc"]


def test_weather_empty_reports_and_bad_provider_are_distinct(monkeypatch):
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: [])
    assert client.get("/api/aviation-weather/metar?airport=KSFO").json()["status"] == "no_reports"
    ga_data._CACHE.clear()
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: {"error": "broken"})
    assert client.get("/api/aviation-weather/metar?airport=KSFO").status_code == 503
    assert client.get("/api/aviation-weather/pirep").status_code == 422


def test_terrain_inputs_are_bounded():
    assert client.get("/api/terrain/point?lat=91&lon=0").status_code == 422
    for points in ([], [[91, 0]], [[0, 0]] * 501):
        assert client.post("/api/terrain/profile", json={"points": points}).status_code == 422


def test_domain_schema_exposes_models_and_unique_operations():
    schema = client.get("/api/openapi.json").json()
    for path in [
        "/api/performance",
        "/api/aircraft/{identifier}",
        "/api/navlog",
        "/api/map/{layer}",
        "/api/airports/{code}/details",
        "/api/airports/{code}/services",
    ]:
        assert path in schema["paths"]
    assert "PerformanceRequest" in schema["components"]["schemas"]
    assert "/api/state/flight" not in schema["paths"]
    ids = [
        op["operationId"]
        for path in schema["paths"].values()
        for op in path.values()
        if isinstance(op, dict) and "operationId" in op
    ]
    assert len(ids) == len(set(ids))


def test_weight_balance_computes_cg_and_reports_out_of_limits():
    profile = {
        "profileId": "caller-aircraft",
        "aircraftProfileId": "caller-type",
        "displayName": "Caller test record",
        "emptyWeight": 1500,
        "emptyMoment": 60000,
        "maxGross": 2500,
        "usableFuelCapacity": 50,
        "fuelArm": 48,
        "fuelDensity": 6,
        "stations": [{"stationId": "front", "name": "Front seats", "arm": 40}],
        "envelope": [
            {"weight": 1500, "forward": 35, "aft": 47},
            {"weight": 2500, "forward": 35, "aft": 47},
        ],
    }
    request = {"profile": profile, "station_weights_lb": [300], "fuel_gal": 30, "fuel_burn_gal": 10}
    response = client.post("/api/performance/weight-balance", json=request)
    assert response.status_code == 200
    value = response.json()
    assert value["takeoff"]["weight"] == 1980
    assert value["takeoff"]["cg"] == pytest.approx((60000 + 300 * 40 + 180 * 48) / 1980)
    assert value["landing"]["weight"] == 1920
    assert value["takeoff"]["within_limits"] is True
    value = client.post(
        "/api/performance/weight-balance", json={**request, "station_weights_lb": [1000]}
    ).json()
    assert value["takeoff"]["within_limits"] is False
    assert (
        client.post(
            "/api/performance/weight-balance", json={**request, "fuel_burn_gal": 40}
        ).status_code
        == 422
    )


def test_terrain_provenance_names_fallback_provider(monkeypatch):
    from app.services import terrain_service

    monkeypatch.setenv("TERRAIN_PROVIDER", "opentopography")

    def unavailable(*a, **kw):
        raise terrain_service.TerrainServiceError("quota")

    monkeypatch.setattr(terrain_service, "_get_elevation_m_opentopography", unavailable)
    monkeypatch.setattr(
        terrain_service, "_fetch_open_meteo_elevations_m", lambda points: [100, None]
    )
    response = client.post("/api/terrain/profile", json={"points": [[37, -122], [38, -121]]})
    assert response.status_code == 200
    value = response.json()
    assert value["source"]["provider"] == "Open-Meteo"
    assert value["points"][0]["elevation_ft"] == pytest.approx(328.084)
    assert value["points"][1]["elevation_ft"] is None


def test_tfr_list_state_filter_and_no_full_notam_claim(monkeypatch):
    monkeypatch.setattr(
        ga_data,
        "fetch",
        lambda *a, **k: [
            {"notam_id": "6/1234", "state": "CA", "type": "HAZARDS"},
            {"notam_id": "6/5678", "state": "NV", "type": "SECURITY"},
        ],
    )
    r = client.get("/api/restrictions/tfr?state=ca")
    assert r.status_code == 200
    assert [x["notam_id"] for x in r.json()["restrictions"]] == ["6/1234"]
    assert "not a complete NOTAM briefing" in r.json()["limitations"]


def test_provider_transport_failure_and_malformed_csv_are_not_empty_success(monkeypatch):
    def fail(url, *a, **k):
        raise httpx.ConnectError("network unavailable")

    monkeypatch.setattr(ga_data.httpx, "get", fail)
    with pytest.raises(ga_data.DataUnavailable, match="unavailable"):
        ga_data.fetch(ga_data.AWC + "metar")
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: "<html>not CSV</html>")
    with pytest.raises(ga_data.DataUnavailable, match="schema"):
        ga_data.airport_csv("runways.csv")


def test_poh_table_interpolation_endpoints_and_no_extrapolation():
    request = {
        "metric": "takeoff_ground_roll_ft",
        "weight_lb": 2500,
        "source_reference": "Synthetic test grid, not an aircraft POH",
        "pressure_altitude_ft": 1000,
        "temperature_c": 10,
        "points": [
            {"pressure_altitude_ft": a, "temperature_c": t, "value": v}
            for a, t, v in [(0, 0, 1000), (0, 20, 1200), (2000, 0, 1400), (2000, 20, 1600)]
        ],
    }
    r = client.post("/api/performance/table", json=request)
    assert r.status_code == 200
    assert r.json()["value"] == 1300
    assert "Caller-supplied" in r.json()["input_authority"]
    r = client.post(
        "/api/performance/table",
        json={**request, "pressure_altitude_ft": 2000, "temperature_c": 20},
    )
    assert r.json()["value"] == 1600
    assert (
        client.post("/api/performance/table", json={**request, "temperature_c": 21}).status_code
        == 422
    )
    bad_grid = request["points"][:3] + [request["points"][0]]
    assert (
        client.post("/api/performance/table", json={**request, "points": bad_grid}).status_code
        == 422
    )
