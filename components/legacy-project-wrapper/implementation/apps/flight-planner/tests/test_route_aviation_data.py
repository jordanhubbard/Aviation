"""Independent route geometry and fixed-origin source contracts."""

import gzip
import json
from datetime import datetime, timezone

import httpx
import pytest

from app.config import settings
from app.routers import aviation_data as api
from app.services import aviation_sources as sources, ga_data, route_briefing as route

SOURCE = {"provider": "NOAA fixture", "retrieved_at_utc": "2026-11-14T12:00:00Z"}


def station(code, lat, lon, taf=True):
    return {
        "id": code,
        "icaoId": code,
        "site": code,
        "lat": lat,
        "lon": lon,
        "siteType": ["METAR", "TAF"] if taf else ["METAR"],
    }


def taf(code, **fields):
    return {
        "icaoId": code,
        "rawTAF": f"TAF {code} ORIGINAL\n TEMPO TEST",
        "validTimeFrom": 1000,
        "validTimeTo": 10000,
        "fcsts": [
            {"timeFrom": 1000, "timeTo": 5000, "wspd": 10},
            {"timeFrom": 2000, "timeTo": 3000, "fcstChange": "TEMPO"},
        ],
        **fields,
    }


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    ga_data._CACHE.clear()
    monkeypatch.setattr(settings, "openaip_api_key", None)

    def blocked(*a, **kw):
        raise AssertionError("Unexpected external request")

    monkeypatch.setattr(ga_data.httpx, "get", blocked)


@pytest.fixture
def providers(monkeypatch):
    rows = [
        station("KAAA", 0, 0, False),
        station("KBBB", 0, 4),
        station("KMID", 0.1, 2),
        station("KOFF", 2, 2),
        station("KMET", 0, 1, False),
    ]
    monkeypatch.setattr(sources, "station_catalog", lambda: (rows, SOURCE))
    airports = {
        "KAAA": {"latitude": 0, "longitude": 0},
        "KBBB": {"latitude": 0, "longitude": 4},
    }
    monkeypatch.setattr(api, "get_airport", airports.get)
    calls = []

    def reports(product, ids):
        calls.append((product, ids))
        return {
            "source": SOURCE,
            "reports": [
                (taf(code) if product == "taf" else {"icaoId": code, "rawOb": "METAR ORIGINAL"})
                for code in ids
                if code != "KAAA"
            ],
        }

    monkeypatch.setattr(sources, "reports", reports)
    return rows, calls


def test_route_midleg_discovery_missing_waypoint_taf_and_batched_products(client, providers):
    r = client.post(
        "/api/aviation-weather/route",
        json={"airports": ["kaaa", "KBBB"], "corridor_nm": 10},
    )
    assert r.status_code == 200, r.text
    value = r.json()
    assert [s["station_id"] for s in value["stations"]] == ["KAAA", "KMID", "KBBB"]
    assert value["route_distance_nm"] == pytest.approx(240.16, abs=0.1)
    middle = value["stations"][1]
    assert middle["distance_from_route_nm"] == pytest.approx(6.004, abs=0.01)
    assert middle["along_route_nm"] == pytest.approx(120.08, abs=0.1)
    assert not middle["requested_airport"]
    assert middle["taf"]["reports"][0]["rawTAF"] == "TAF KMID ORIGINAL\n TEMPO TEST"
    assert middle["metar"]["reports"][0]["rawOb"] == "METAR ORIGINAL"
    assert value["stations"][0]["taf"]["status"] == "no_reports"
    assert all(value["source"][key] == expected for key, expected in SOURCE.items())
    assert not value["truncated"] and not value["partial"]
    assert len(providers[1]) == 2


def test_caps_keep_requested_airports_and_report_truncation(client, providers):
    value = client.post(
        "/api/aviation-weather/route",
        json={"airports": ["KAAA", "KBBB"], "max_stations": 2, "include_metars": False},
    ).json()
    assert value["total_matching_stations"] == 3 and value["truncated"]
    assert [s["station_id"] for s in value["stations"]] == ["KAAA", "KBBB"]
    assert all(s["metar"] is None for s in value["stations"])
    assert len(providers[1]) == 1


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"points": [[0, 0]]},
        {"points": [[91, 0], [0, 0]]},
        {"points": [[0, 181], [0, 0]]},
        {"points": [[0, "NaN"], [0, 0]]},
        {"points": [[0, 0], [0, 180]]},
        {"points": [[0, 0], [1, 1]], "corridor_nm": 101},
        {"airports": ["KAAA", "KBBB"], "max_stations": 1},
        {"airports": ["KAAA", "KBBB"], "points": [[0, 0], [1, 1]]},
        {"airports": ["KAAA", "KBBB"], "valid_at": "2026-11-14T12:00:00"},
        {"airports": ["KAAA", "KBBB"], "unknown": True},
    ],
)
def test_bad_route_422(client, providers, body):
    assert client.post("/api/aviation-weather/route", json=body).status_code == 422


def test_unknown_airport_404(client, providers):
    assert (
        client.post("/api/aviation-weather/route", json={"airports": ["KAAA", "NOPE"]}).status_code
        == 404
    )


def test_dateline_polar_bent_and_zero_length_legs():
    legs, length = route.route_legs([(0, 179), (0, -179)])
    hit = route.nearest_route(0.1, 180, legs)
    assert length == pytest.approx(120.08, abs=0.1)
    assert hit["distance_from_route_nm"] == pytest.approx(6.004, abs=0.01)
    assert hit["along_route_nm"] == pytest.approx(60.04, abs=0.1)
    assert route.nearest_route(0, 0, legs)["distance_from_route_nm"] > 10000
    legs, _ = route.route_legs([(89, 0), (89, 180)])
    assert route.nearest_route(90, 0, legs)["distance_from_route_nm"] < 0.01
    legs, _ = route.route_legs([(0, 0), (0, 0), (0, 2), (2, 2)])
    hit = route.nearest_route(1, 2.1, legs)
    assert hit["closest_leg"] == 2
    assert hit["along_route_nm"] == pytest.approx(180.12, abs=0.2)
    assert hit["distance_from_route_nm"] == pytest.approx(6.003, abs=0.02)


def test_partial_failure_is_not_no_reports(client, providers, monkeypatch):
    def reports(product, ids):
        if product == "taf":
            raise ga_data.DataUnavailable("Provider unavailable")
        return {"source": SOURCE, "reports": [{"icaoId": code} for code in ids]}

    monkeypatch.setattr(sources, "reports", reports)
    value = client.post("/api/aviation-weather/route", json={"points": [[0, 0], [0, 4]]}).json()
    assert value["partial"]
    for s in value["stations"]:
        assert s["taf"]["status"] == "unavailable" and s["metar"]["status"] == "available"
        assert s["taf"]["source"].get("retrieved_at_utc") is None


def test_catalog_failure_503(client, monkeypatch):
    def fail():
        raise ga_data.DataUnavailable("Catalog unavailable")

    monkeypatch.setattr(sources, "station_catalog", fail)
    assert (
        client.post("/api/aviation-weather/route", json={"points": [[0, 0], [0, 4]]}).status_code
        == 503
    )


def test_batch_sizes_and_missing_provider_station_id(monkeypatch):
    calls = []

    def reports(product, ids):
        calls.append(ids)
        return {"source": SOURCE, "reports": [taf(code) for code in ids]}

    monkeypatch.setattr(sources, "reports", reports)
    assert len(route.batch_reports("taf", [f"{i:04d}" for i in range(85)])) == 85
    assert [len(x) for x in calls] == [40, 40, 5]
    monkeypatch.setattr(
        sources,
        "reports",
        lambda *a: {"source": SOURCE, "reports": [{"rawTAF": "missing station"}]},
    )
    assert route.batch_reports("taf", ["KAAA"])["KAAA"]["status"] == "unavailable"


def test_shared_acquisition_retains_mixed_batch_failures_and_raw_tafs(monkeypatch):
    calls = []

    def fetch(url, params):
        calls.append((url, params))
        ids = params["ids"].split(",")
        if ids[0] == "0040":
            raise ga_data.DataUnavailable("Bounded transport failure")
        return [
            taf(code, providerExtension={"unchanged": [None, False]}) for code in ids
        ]

    monkeypatch.setattr(ga_data, "fetch", fetch)
    result = route.batch_reports("taf", [f"{i:04d}" for i in range(85)])
    assert len(calls) == 3
    assert [len(params["ids"].split(",")) for _, params in calls] == [40, 40, 5]
    assert all(
        url == "https://aviationweather.gov/api/data/taf" and params["format"] == "json"
        for url, params in calls
    )
    assert result["0000"]["status"] == "available"
    assert result["0040"]["status"] == "unavailable"
    assert result["0084"]["status"] == "available"
    assert result["0084"]["reports"][0]["rawTAF"] == taf("0084")["rawTAF"]
    assert result["0084"]["reports"][0]["providerExtension"] == {
        "unchanged": [None, False]
    }
    assert result["0040"]["source"].get("retrieved_at_utc") is None


def test_validity_concurrent_tempo_and_half_open_window():
    def at(n):
        return datetime.fromtimestamp(n, timezone.utc)

    value = route.validity([taf("KAAA")], at(2500))
    assert value["valid_at_status"] == "valid" and len(value["periods_at_time"]) == 2
    assert value["periods_at_time"][1]["period"]["fcstChange"] == "TEMPO"
    assert route.validity([taf("KAAA")], at(10000))["valid_at_status"] == "outside_validity"
    assert (
        route.validity([taf("KAAA", validTimeFrom=None)], at(10000))["valid_at_status"] == "unknown"
    )
    assert route.validity([], at(10000))["valid_at_status"] == "unknown"


def test_station_discovery_filter_and_limit(client, providers):
    value = client.get("/api/aviation-weather/stations?lat=0&lon=0&radius_nm=200&limit=1").json()
    assert value["stations"][0]["station_id"] == "KMID" and value["truncated"]
    assert (
        client.get("/api/aviation-weather/stations?lat=0&lon=0&taf_only=false").json()["stations"][
            0
        ]["station_id"]
        == "KAAA"
    )


def test_gzip_catalog_validation_cache_and_expansion_limit(monkeypatch):
    rows, calls = [station("KAAA", 0, 0)], []

    def get(url, **kw):
        calls.append(1)
        assert url == sources.STATIONS and kw["timeout"] == 20
        return httpx.Response(
            200,
            content=gzip.compress(json.dumps(rows).encode()),
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(ga_data.httpx, "get", get)
    assert sources.station_catalog()[0] == rows
    sources.station_catalog()
    assert len(calls) == 1
    ga_data._CACHE.clear()
    rows[0]["lat"] = None
    with pytest.raises(ga_data.DataUnavailable):
        sources.station_catalog()
    ga_data._CACHE.clear()
    monkeypatch.setattr(
        ga_data.httpx,
        "get",
        lambda url, **kw: httpx.Response(
            200,
            content=gzip.compress(b" " * (16 * 1024 * 1024 + 1)),
            request=httpx.Request("GET", url),
        ),
    )
    with pytest.raises(ga_data.DataUnavailable):
        sources.station_catalog()


def test_openaip_config_pagination_license_and_secret_redaction(client, monkeypatch):
    url = "/api/aviation-data/openaip/airports?country=DE&limit=1"
    assert client.get(url).status_code == 503
    monkeypatch.setattr(settings, "openaip_api_key", "fixture-secret")

    def fetch(url, params=None, **kw):
        if url.endswith("schema.json"):
            return {"info": {"license": {"name": sources.LICENSE, "url": sources.LICENSE_URL}}}
        assert kw["headers"]["x-openaip-api-key"] == "fixture-secret"
        assert "apiKey" not in params and "fixture-secret" not in url
        return {
            "items": [{"_id": "original", "elevation": {"value": 42, "unit": 0}}],
            "totalCount": 3,
            "totalPages": 3,
            "page": 1,
        }

    monkeypatch.setattr(ga_data, "fetch", fetch)
    result = client.get(url)
    value = result.json()
    assert result.status_code == 200 and value["next_page"] == 2 and value["truncated"]
    assert value["records"][0]["elevation"] == {"value": 42, "unit": 0}
    assert value["source"]["license"] == sources.LICENSE
    catalog = client.get("/api/aviation-data/sources")
    assert "fixture-secret" not in result.text + catalog.text
    assert next(s for s in catalog.json()["sources"] if s["id"] == "openaip")["configured"]
    ga_data._CACHE.clear()
    monkeypatch.setattr(
        ga_data, "fetch", lambda *a, **k: {"info": {"license": {"name": "changed"}}}
    )
    assert client.get(url).status_code == 503


def test_authenticated_fetch_no_redirect_and_no_error_body_leak(monkeypatch):
    def get(url, **kw):
        assert not kw["follow_redirects"]
        return httpx.Response(403, request=httpx.Request("GET", url), text="private-key-in-body")

    monkeypatch.setattr(ga_data.httpx, "get", get)
    with pytest.raises(ga_data.DataUnavailable) as e:
        ga_data.fetch(sources.OPENAIP + "airports", headers={"x-openaip-api-key": "private-key"})
    assert "private-key" not in str(e.value)


def test_nws_alert_null_geometry_and_limit(client, monkeypatch):
    row = {
        "type": "Feature",
        "geometry": None,
        "properties": {"event": "Warning", "sent": "original"},
    }
    monkeypatch.setattr(
        ga_data,
        "fetch",
        lambda *a, **k: {"type": "FeatureCollection", "features": [row, row]},
    )
    value = client.get("/api/aviation-data/nws/alerts?lat=37&lon=-122&limit=1").json()
    assert value["records"] == [row] and value["truncated"]
    assert client.get("/api/aviation-data/nws/alerts?lat=37").status_code == 422
    assert client.get("/api/aviation-data/nws/alerts?lat=37&lon=-122&area=CA").status_code == 422


def test_nws_forecast_ignores_untrusted_link_and_retains_units(client, monkeypatch):
    calls = []

    def fetch(url, *a, **kw):
        calls.append(url)
        if "/points/" in url:
            return {
                "properties": {
                    "gridId": "MTR",
                    "gridX": 84,
                    "gridY": 100,
                    "forecastHourly": "http://untrusted.invalid",
                }
            }
        return {"properties": {"periods": [{"temperature": 17, "temperatureUnit": "C"}]}}

    monkeypatch.setattr(ga_data, "fetch", fetch)
    value = client.get("/api/aviation-data/nws/forecast?lat=37&lon=-122").json()
    assert calls[-1] == "https://api.weather.gov/gridpoints/MTR/84,100/forecast/hourly"
    assert value["data"]["properties"]["periods"][0]["temperatureUnit"] == "C"


def test_faa_events_and_no_record_state(client, monkeypatch):
    rows = [{"airportId": "JFK", "groundStop": {"startTime": "original"}}]
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: rows)
    assert (
        client.get("/api/aviation-data/faa/airport-events?airport_id=JFK").json()["records"] == rows
    )
    value = client.get("/api/aviation-data/faa/airport-events?airport_id=LAX").json()
    assert value["status"] == "no_reports" and value["records"] == []
    assert "NOTAM" in value["limitations"]


def test_modeled_pressure_level_winds_units_nulls_and_center_advisories(client, monkeypatch):
    original = {
        "utc_offset_seconds": 0,
        "hourly": {
            "time": ["2026-11-15T12:00", "2026-11-15T13:00"],
            "wind_speed_850hPa": [12, None],
            "wind_direction_850hPa": [270, None],
            "temperature_850hPa": [-5, None],
            "geopotential_height_850hPa": [1500, None],
        },
        "hourly_units": {
            "wind_speed_850hPa": "kn",
            "wind_direction_850hPa": "°",
            "temperature_850hPa": "°C",
            "geopotential_height_850hPa": "m",
        },
    }

    def fetch(url, params=None, **kw):
        if "open-meteo.com" in url:
            assert params["timezone"] == "UTC" and params["wind_speed_unit"] == "kn"
            assert params["forecast_hours"] == 2
            return original
        return [{"cwsu": "ZOA", "rawCWA": "ORIGINAL"}]

    monkeypatch.setattr(ga_data, "fetch", fetch)
    value = client.get(
        "/api/aviation-weather/winds-aloft?lat=37&lon=-122&levels_hpa=850&hours=2"
    ).json()
    assert value["data"] == original
    assert value["levels_hpa"] == [850]
    assert value["source"]["provider"].startswith("Open-Meteo")
    assert "not fixed flight altitudes" in value["limitations"]
    assert client.get("/api/aviation-weather/cwa").json()["reports"][0]["rawCWA"] == "ORIGINAL"


def pressure_fixture():
    value = {
        "utc_offset_seconds": 0,
        "hourly": {"time": ["2026-11-16T12:00", "2026-11-16T13:00"]},
        "hourly_units": {},
        "providerExtension": {"retained": [None, False, {"original": "yes"}]},
    }
    for level in [850, 700]:
        for field, unit, amount in [
            ("wind_speed", "kn", 12),
            ("wind_direction", "°", 270),
            ("temperature", "°C", -5),
            ("geopotential_height", "m", 1500),
        ]:
            variable = f"{field}_{level}hPa"
            value["hourly"][variable] = [amount, None]
            value["hourly_units"][variable] = unit
    return value


def test_shared_pressure_planning_preserves_enum_and_cache_equivalence(
    client, monkeypatch
):
    calls, original = [], pressure_fixture()

    def fetch(url, params):
        calls.append((url, params))
        return original

    monkeypatch.setattr(ga_data, "fetch", fetch)
    supplied = [
        api.PressureLevel.HPA850,
        api.PressureLevel.HPA700,
        api.PressureLevel.HPA850,
    ]
    first = sources.winds_aloft(37, -122, supplied, 2)
    second = sources.winds_aloft(37, -122, [850, 700], 2)
    response = client.get(
        "/api/aviation-weather/winds-aloft?lat=37&lon=-122&levels_hpa=850&levels_hpa=700&hours=2"
    )
    assert response.status_code == 200 and first == second
    assert response.json()["data"] == original and response.json()["levels_hpa"] == [
        850,
        700,
    ]
    assert response.json()["source"] == {**first["source"], "effective_date": None}
    assert first["source"]["license"] == "CC BY 4.0; provider API usage terms apply"
    assert "not fixed flight altitudes" in first["limitations"]
    assert all(isinstance(level, api.PressureLevel) for level in supplied)
    assert len(supplied) == 3 and len(calls) == 1
    assert calls[0] == (
        "https://api.open-meteo.com/v1/forecast",
        {
            "latitude": 37,
            "longitude": -122,
            "hourly": "wind_speed_850hPa,wind_direction_850hPa,temperature_850hPa,geopotential_height_850hPa,wind_speed_700hPa,wind_direction_700hPa,temperature_700hPa,geopotential_height_700hPa",
            "wind_speed_unit": "kn",
            "temperature_unit": "celsius",
            "timezone": "UTC",
            "forecast_hours": 2,
        },
    )


@pytest.mark.parametrize(
    "change",
    [
        "wind_speed",
        "wind_direction",
        "temperature",
        "geopotential_height",
        "boolean-offset",
        "nonzero-offset",
        "misaligned",
    ],
)
def test_shared_pressure_invalid_provider_is_unavailable(client, monkeypatch, change):
    value = pressure_fixture()
    if change == "boolean-offset":
        value["utc_offset_seconds"] = False
    elif change == "nonzero-offset":
        value["utc_offset_seconds"] = 3600
    elif change == "misaligned":
        value["hourly"]["wind_speed_850hPa"] = [12]
    else:
        value["hourly_units"][f"{change}_850hPa"] = "unexpected"
    monkeypatch.setattr(ga_data, "fetch", lambda *args: value)
    response = client.get(
        "/api/aviation-weather/winds-aloft?lat=37&lon=-122&levels_hpa=850&hours=2"
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Open-Meteo pressure-level forecast unavailable"


def test_pressure_actual_transport_timeout_and_post_download_limit(client, monkeypatch):
    calls = []

    def fetch(url, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return httpx.Response(
                200, json=pressure_fixture(), request=httpx.Request("GET", url)
            )
        return httpx.Response(
            200,
            content=b" " * (20 * 1024 * 1024 + 1),
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(ga_data.httpx, "get", fetch)
    endpoint = (
        "/api/aviation-weather/winds-aloft?lat=37&lon=-122&levels_hpa=850&hours=2"
    )
    assert client.get(endpoint).status_code == 200
    ga_data._CACHE.clear()
    response = client.get(endpoint)
    assert response.status_code == 503
    assert response.json()["detail"] == "Open-Meteo pressure-level forecast unavailable"
    assert len(calls) == 2 and all(call["timeout"] == 20 for call in calls)


def test_pressure_expired_cache_failure_never_returns_stale_success(monkeypatch):
    monkeypatch.setattr(ga_data, "fetch", lambda *args: pressure_fixture())
    assert sources.winds_aloft(37, -122, [850], 2)["data"] == pressure_fixture()
    clock = ga_data.monotonic
    monkeypatch.setattr(ga_data, "monotonic", lambda: clock() + 1900)

    def fail(*args):
        raise RuntimeError("private-provider-url?credential=private")

    monkeypatch.setattr(ga_data, "fetch", fail)
    with pytest.raises(ga_data.DataUnavailable) as raised:
        sources.winds_aloft(37, -122, [850], 2)
    assert str(raised.value) == "Open-Meteo pressure-level forecast unavailable"


def test_source_operations_exist_in_openapi(client):
    catalog = client.get("/api/aviation-data/sources").json()
    schema = client.get("/api/openapi.json").json()
    assert len(catalog["sources"]) >= 9
    for source in catalog["sources"]:
        for operation in source["operations"]:
            method, path = operation.split(" ")
            assert method.lower() in schema["paths"][path], operation
    assert schema["paths"]["/api/aviation-weather/route"]["post"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]["$ref"].endswith("RouteBriefingResponse")


def test_iata_resolves_to_canonical_station_without_borrowing_forecast(
    client, providers, monkeypatch
):
    monkeypatch.setattr(
        api,
        "get_airport",
        lambda code: {
            "icao": "KAAA" if code == "AAA" else "KBBB",
            "latitude": 0,
            "longitude": 0 if code == "AAA" else 4,
        },
    )
    value = client.post("/api/aviation-weather/route", json={"airports": ["AAA", "BBB"]}).json()
    assert value["resolved_airports"][0]["requested_code"] == "AAA"
    assert value["resolved_airports"][0]["station_id"] == "KAAA"
    assert value["stations"][0]["taf"]["status"] == "no_reports"


def test_no_nearby_stations_is_explicit_empty_not_network_error(client, monkeypatch):
    monkeypatch.setattr(sources, "station_catalog", lambda: ([station("KFAR", 60, 10)], SOURCE))
    value = client.post("/api/aviation-weather/route", json={"points": [[0, 0], [0, 1]]}).json()
    assert value["stations"] == [] and value["total_matching_stations"] == 0
    assert not value["partial"] and not value["truncated"]


def test_validity_http_preserves_original_and_filters_matching_periods(client, providers):
    value = client.post(
        "/api/aviation-weather/route",
        json={"airports": ["KAAA", "KBBB"], "valid_at": "1970-01-01T00:41:40Z"},
    ).json()
    last = next(s for s in value["stations"] if s["station_id"] == "KBBB")
    assert last["valid_at_status"] == "valid" and len(last["periods_at_time"]) == 2
    assert last["taf"]["reports"][0]["validTimeTo"] == 10000


def test_provider_result_cap_is_exposed(monkeypatch):
    monkeypatch.setattr(
        sources,
        "reports",
        lambda *a: {"source": SOURCE, "reports": [taf("KAAA")] * 400},
    )
    assert route.batch_reports("taf", ["KAAA"])["KAAA"]["truncated"] is True


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"items": []},
        {"items": ["bad"], "totalCount": 1, "totalPages": 1, "page": 1},
    ],
)
def test_bad_openaip_envelope_is_503(client, monkeypatch, value):
    monkeypatch.setattr(settings, "openaip_api_key", "fixture-key")
    monkeypatch.setattr(
        ga_data,
        "fetch",
        lambda url, *a, **k: (
            {"info": {"license": {"name": sources.LICENSE, "url": sources.LICENSE_URL}}}
            if url.endswith("schema.json")
            else value
        ),
    )
    assert client.get("/api/aviation-data/openaip/navaids?country=DE").status_code == 503


@pytest.mark.parametrize(
    "payload",
    [
        [],
        "<html>error</html>",
        {"hourly": {"time": []}},
        {"utc_offset_seconds": 0, "hourly_units": {}, "hourly": {"time": ["time"]}},
    ],
)
def test_missing_or_malformed_winds_are_not_invented(client, monkeypatch, payload):
    monkeypatch.setattr(ga_data, "fetch", lambda *a, **k: payload)
    assert client.get("/api/aviation-weather/winds-aloft?lat=37&lon=-122").status_code == 503


def test_noaa_unknown_coordinate_sentinel_is_reported_not_used(monkeypatch):
    rows = [
        station("KAAA", 0, -99.99),
        station("KUNK", -99.99, -99.99),
        station("KUN2", -99.999, -99.999),
    ]
    monkeypatch.setattr(
        ga_data.httpx,
        "get",
        lambda url, **kw: httpx.Response(
            200,
            content=gzip.compress(json.dumps(rows).encode()),
            request=httpx.Request("GET", url),
        ),
    )
    located, source = sources.station_catalog()
    assert [s["icaoId"] for s in located] == ["KAAA"]
    assert source["excluded_unlocated_count"] == 2
    assert source["unlocated_taf_station_ids"] == ["KUNK", "KUN2"]


def test_route_exposes_catalog_discovery_limitation(client, providers, monkeypatch):
    monkeypatch.setattr(
        sources,
        "station_catalog",
        lambda: (providers[0], {**SOURCE, "unlocated_taf_station_ids": ["KUNK"]}),
    )
    value = client.post("/api/aviation-weather/route", json={"points": [[0, 0], [0, 4]]}).json()
    assert value["discovery_limited"] is True
    assert value["source"]["unlocated_taf_station_ids"] == ["KUNK"]


@pytest.mark.parametrize("fault", ["truncated", "crc", "trailing", "concatenated", "oversized-compressed", "malformed-json", "empty-204"])
def test_station_gzip_transport_rejects_incomplete_or_oversized_stream(
    monkeypatch, fault
):
    blob = gzip.compress(json.dumps([station("KAAA", 0, 0)]).encode())
    if fault == "truncated":
        blob = blob[:-1]
    if fault == "crc":
        blob = blob[:-8] + bytes([blob[-8] ^ 1]) + blob[-7:]
    if fault == "trailing":
        blob += b"trailing"
    if fault == "concatenated":
        blob += gzip.compress(b"[]")
    if fault == "oversized-compressed":
        blob = b"x" * (20 * 1024 * 1024 + 1)
    if fault == "malformed-json":
        blob = gzip.compress(b"not JSON")
    if fault == "empty-204":
        blob = b""
    calls = []

    def get(url, **kwargs):
        calls.append(kwargs)
        return httpx.Response(
            204 if fault == "empty-204" else 200,
            content=blob,
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(ga_data.httpx, "get", get)
    with pytest.raises(ga_data.DataUnavailable):
        sources.station_catalog()
    assert len(calls) == 1 and calls[0]["timeout"] == 20
    assert ("awc-station-catalog",) not in ga_data._CACHE


def test_station_catalog_expired_cache_does_not_mask_transport_failure(monkeypatch):
    def get(url, **kwargs):
        return httpx.Response(
            200,
            content=gzip.compress(json.dumps([station("KAAA", 0, 0)]).encode()),
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(ga_data.httpx, "get", get)
    rows, source = sources.station_catalog()
    assert rows == [station("KAAA", 0, 0)]
    assert source["url"] == sources.STATIONS and source["total_catalog_records"] == 1
    assert source["retrieved_at_utc"] and source["excluded_unlocated_count"] == 0
    assert source["unlocated_taf_station_ids"] == []
    key = ("awc-station-catalog",)
    _, value, weight = ga_data._CACHE[key]
    ga_data._CACHE[key] = (0, value, weight)

    def fail(url, **kwargs):
        raise httpx.TimeoutException("private upstream")

    monkeypatch.setattr(ga_data.httpx, "get", fail)
    with pytest.raises(
        ga_data.DataUnavailable, match="AWC station catalog unavailable"
    ):
        sources.station_catalog()
    assert key not in ga_data._CACHE


def test_generic_gzip_json_accepts_exact_expansion_ceiling(monkeypatch):
    raw = b"[" + b" " * (16 * 1024 * 1024 - 2) + b"]"
    blob = gzip.compress(raw)
    monkeypatch.setattr(
        ga_data.httpx,
        "get",
        lambda url, **kw: httpx.Response(
            200, content=blob, request=httpx.Request("GET", url)
        ),
    )
    assert ga_data.fetch(sources.STATIONS, gzip_json=True) == []


@pytest.mark.parametrize(
    "environment,configured",
    [(None, False), ("invalid", False), ("production", True), ("staging", True), ("fit", True)],
)
def test_nms_catalog_describes_reader_configuration_without_credentials_or_feed_creation(
    client, monkeypatch, tmp_path, environment, configured
):
    if environment is None:
        monkeypatch.delenv("FAA_NMS_ENVIRONMENT", raising=False)
    else:
        monkeypatch.setenv("FAA_NMS_ENVIRONMENT", environment)
    cache = tmp_path / "not-created"
    monkeypatch.setenv("FAA_NMS_CACHE_DIR", str(cache))
    monkeypatch.delenv("FAA_NMS_CLIENT_ID", raising=False)
    monkeypatch.delenv("FAA_NMS_CLIENT_SECRET", raising=False)
    result = client.get("/api/aviation-data/sources")
    assert result.status_code == 200
    entry = next(s for s in result.json()["sources"] if s["id"] == "faa-nms")
    assert entry["configured"] is configured
    assert entry["operations"] == [
        "GET /api/notams/capabilities",
        "GET /api/notams",
        "GET /api/notams/detail",
    ]
    assert "only to the ingestion worker" in entry["authentication"]
    assert "not live availability" in entry["limitations"]
    assert not cache.exists()
    monkeypatch.setenv("FAA_NMS_CLIENT_ID", "fixture-client-private-never-exposed")
    monkeypatch.setenv("FAA_NMS_CLIENT_SECRET", "fixture-secret-private-never-exposed")
    again = client.get("/api/aviation-data/sources")
    assert again.json() == result.json()
    assert "fixture-client-private" not in again.text and "fixture-secret-private" not in again.text
