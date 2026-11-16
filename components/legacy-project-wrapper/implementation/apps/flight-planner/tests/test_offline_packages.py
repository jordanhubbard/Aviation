"""Original and derived identities, bounded preparation and private snapshot isolation."""

import hashlib
from io import BytesIO
import json
from zipfile import ZipFile

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfWriter
import pytest
import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds

from app.routers.charts import install
from app.routers import offline
from app.services.charts import Charts, instant


def pdf():
    output = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=300)
    writer.add_blank_page(width=300, height=300)
    writer.write(output)
    return output.getvalue()


@pytest.fixture
def prepared(tmp_path, monkeypatch):
    class Web:
        content = pdf()

        def get(self, url, **kw):
            return {"url": url, "content": self.content}

    store = Charts(tmp_path, web=Web())
    row = dict(
        id="chart_one",
        name="Airport diagram",
        family="terminal",
        kind="APD",
        format="pdf",
        url="https://aeronav.faa.gov/example.pdf",
        airport="KSFO",
        cycle="2611",
        effective_from="2026-10-29T09:01:00+00:00",
        effective_to="2026-11-26T09:01:00+00:00",
        source="FAA",
        record={},
    )
    store.replace("terminal", [row])
    store.source("terminal", {"status": "available", "at": instant()})
    chart = store.acquire("chart_one")
    monkeypatch.setattr(
        offline,
        "get_airport",
        lambda code: {
            "icao": code,
            "name": "Reference " + code,
            "latitude": 37.6 if code == "KSFO" else 37.5,
            "longitude": -122.4,
        },
    )
    monkeypatch.setattr(
        offline,
        "route_weather",
        lambda req: {
            "stations": [
                {
                    "station_id": "KSFO",
                    "taf": {
                        "status": "available",
                        "reports": [{"rawTAF": "TAF KSFO 161720Z 1618/1724 27010KT P6SM SKC"}],
                        "source": {
                            "url": "https://aviationweather.gov/api/data/taf",
                            "fetched_at": "2026-11-16T17:20:00Z",
                        },
                    },
                }
            ],
            "partial": False,
        },
    )
    app = FastAPI()
    install(app, store=store)
    selection = dict(chart_id="chart_one", member=0, sha256=chart["cached"]["members"][0]["sha256"])
    return (
        TestClient(app),
        store,
        dict(name="Bay route", airports=["KSFO", "KSQL"], charts=[selection]),
    )


def test_preparation_pins_originals_and_derived_bytes_without_storing_private_snapshots(prepared):
    client, store, body = prepared
    response = client.post("/api/offline/prepare", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    manifest = response.json()
    assert manifest["total_bytes"] == sum(a["byte_length"] for a in manifest["assets"])
    assert manifest["private_documents_included"] is False
    assert manifest["charts"][0]["pages"] == [1, 2]
    original = next(a for a in manifest["assets"] if a["role"] == "chart_original")
    previews = [a for a in manifest["assets"] if a["role"] == "chart_preview"]
    assert original["sha256"] == body["charts"][0]["sha256"]
    assert original["source_url"] == "https://aeronav.faa.gov/example.pdf"
    assert manifest["charts"][0]["source_url"] == original["source_url"]
    for a in manifest["assets"]:
        content = (
            a["inline_text"].encode()
            if a["inline_text"] is not None
            else client.get(a["url"]).content
        )
        assert len(content) == a["byte_length"]
        assert hashlib.sha256(content).hexdigest() == a["sha256"]
        if a["inline_text"] is not None:
            assert not (store.objects / a["sha256"]).exists()
    assert all(
        p["sha256"] != original["sha256"] and p["source_sha256"] == original["sha256"]
        for p in previews
    )
    preview = client.get(
        f"/api/charts/chart_one/members/0/preview/1.png?sha256={original['sha256']}"
    )
    assert preview.headers["x-content-sha256"] == hashlib.sha256(preview.content).hexdigest()
    assert preview.headers["x-source-sha256"] == original["sha256"]
    assert client.get("/api/offline/assets/" + original["sha256"]).status_code == 422
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/offline/prepare"]["post"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]["$ref"].endswith("/Manifest")
    assert "private_documents_included" in schema["components"]["schemas"]["Manifest"]["properties"]


def test_revisions_are_new_identities_and_source_weather_failure_is_explicit(prepared, monkeypatch):
    client, _, body = prepared
    body["charts"] = []
    first = client.post("/api/offline/prepare", json=body).json()
    body["revision_of"] = first["id"]
    from fastapi import HTTPException

    def unavailable(_):
        raise HTTPException(503, "NOAA unavailable")

    monkeypatch.setattr(offline, "route_weather", unavailable)
    second = client.post("/api/offline/prepare", json=body).json()
    assert second["revision_of"] == first["id"] and second["id"] != first["id"]
    weather = json.loads(next(a["inline_text"] for a in second["assets"] if a["role"] == "weather"))
    assert weather["status"] == "unavailable" and weather["stations"] == []
    assert any("unavailable" in w for w in second["warnings"])


@pytest.mark.parametrize(
    "changes",
    [
        dict(airports=["KSFO"]),
        dict(saved_plan_id="other"),
        dict(charts=[dict(chart_id="../escape", member=0, sha256="a" * 64)]),
        dict(airports=["KSFO", "KSQL"], unknown=True),
    ],
)
def test_input_contract_rejects_ambiguous_malformed_or_extra_values(prepared, changes):
    client, _, body = prepared
    body.update(changes)
    assert client.post("/api/offline/prepare", json=body).status_code == 422


def test_corrupt_original_missing_pages_bounds_and_request_concurrency_fail_closed(prepared):
    client, store, body = prepared
    body["charts"][0]["pdf_pages"] = [3]
    assert client.post("/api/offline/prepare", json=body).status_code == 422
    body["charts"][0]["pdf_pages"] = [1]
    offline.PREPARING.acquire()
    try:
        assert client.post("/api/offline/prepare", json=body).status_code == 429
    finally:
        offline.PREPARING.release()
    assert client.post("/api/offline/prepare", content=b" " * (128 * 1024 + 1)).status_code == 413
    path = store.objects / body["charts"][0]["sha256"]
    path.write_bytes(b"changed")
    assert "integrity" in client.post("/api/offline/prepare", json=body).json()["detail"]
    assert client.get("/api/offline/assets/" + "a" * 64).status_code == 404
    with pytest.raises(ValueError, match="non-wrapping"):
        offline.tile_rectangle([170, 0, -170, 1], 5)


def test_selected_saved_plan_round_trips_privately_without_public_storage(prepared, monkeypatch):
    client, store, body = prepared
    from app.schemas.flight_plan import SavedFlightPlan, FlightPlanMetadata, FlightPlanWaypoint

    plan = SavedFlightPlan(
        metadata=FlightPlanMetadata(
            name="Saved route",
            description="PRIVATE DESCRIPTION",
            pilot_name="PRIVATE PILOT",
            aircraft_type="C172",
            origin="KSFO",
            destination="KSQL",
            created_at="2026-11-15T12:00:00Z",
            updated_at="2026-11-16T12:00:00Z",
        ),
        notes="PRIVATE NOTES: retain timing and contingency instructions.",
        route=["KSFO", "KSQL"],
        distance_nm=15.5,
        estimated_time_hr=0.25,
        cruise_altitude_ft=2500,
        cruise_speed_kt=110,
        fuel_required_gal=4.5,
        waypoints=[
            FlightPlanWaypoint(name="KSFO", latitude=37.6, longitude=-122.4),
            FlightPlanWaypoint(name="KSQL", latitude=37.5, longitude=-122.3),
        ],
    )
    monkeypatch.setattr(offline, "get_flight_plan", lambda _: plan)
    del body["airports"]
    body["saved_plan_id"] = "saved"
    result = client.post("/api/offline/prepare", json=body)
    assert result.status_code == 200, result.text
    assert result.headers["cache-control"] == "private, no-store"
    manifest = result.json()
    expected = {
        **plan.model_dump(mode="json"),
        "saved_plan_id": "saved",
        "name": plan.metadata.name,
    }
    assert manifest["route"] == expected
    snapshot = next(a for a in manifest["assets"] if a["role"] == "route")
    assert json.loads(snapshot["inline_text"]) == expected
    assert snapshot["url"] is None
    assert not (store.objects / snapshot["sha256"]).exists()
    assert client.get("/api/offline/assets/" + snapshot["sha256"]).status_code == 404
    assert manifest["private_documents_included"] is False
    assert not any(b"PRIVATE" in p.read_bytes() for p in store.objects.iterdir())


def test_raster_packages_have_explicit_tile_coverage_and_correct_png_identity(prepared):
    client, store, body = prepared
    with MemoryFile() as memory:
        with memory.open(
            driver="GTiff",
            height=16,
            width=16,
            count=3,
            dtype="uint8",
            crs="EPSG:4326",
            transform=from_bounds(-125, 35, -120, 40, 16, 16),
        ) as dataset:
            dataset.write(np.full((3, 16, 16), 160, dtype="uint8"))
        content = memory.read()
    archive = BytesIO()
    with ZipFile(archive, "w") as zipped:
        zipped.writestr("map.tif", content)
    store.web.content = archive.getvalue()
    from app.services.charts import instant

    row = dict(
        id="raster",
        name="TAC",
        family="vfr",
        kind="TAC",
        format="geotiff",
        url="https://aeronav.faa.gov/tac.zip",
        cycle="2611",
        effective_from="2026-10-29T09:01:00Z",
        effective_to="2026-11-26T09:01:00Z",
        source="FAA",
        record={},
    )
    store.replace("vfr", [row])
    store.source("vfr", {"status": "available", "at": instant()})
    member = store.acquire("raster")["cached"]["members"][0]
    body["charts"] = [
        dict(chart_id="raster", member=0, sha256=member["sha256"], coverage="route-area", zoom=6)
    ]
    response = client.post("/api/offline/prepare", json=body)
    assert response.status_code == 200, response.text
    manifest = response.json()
    chart = manifest["charts"][0]
    assert chart["coverage"] == "route-area" and chart["zoom"] == 6 and chart["tile_count"] > 0
    asset = next(a for a in manifest["assets"] if a["role"] == "chart_tile")
    response = client.get(
        f"/api/charts/raster/members/0/tiles/6/{asset['x']}/{asset['y']}.png?sha256={member['sha256']}"
    )
    assert response.headers["x-content-sha256"] == hashlib.sha256(response.content).hexdigest()
    assert response.headers["x-source-sha256"] == member["sha256"]
    body["charts"][0]["zoom"] = 12
    body["charts"][0]["coverage"] = "full-chart"
    assert client.post("/api/offline/prepare", json=body).status_code == 422


def test_package_quota_failure_never_persists_inline_snapshots(prepared, monkeypatch):
    client, store, body = prepared
    before = set(store.objects.iterdir())
    monkeypatch.setattr(offline, "MAX_PACKAGE", 1)
    response = client.post("/api/offline/prepare", json=body)
    assert response.status_code == 422 and "exceeds" in response.json()["detail"]
    assert set(store.objects.iterdir()) == before


def test_invalid_saved_route_coordinates_fail_as_input_errors(prepared, monkeypatch):
    client, _, body = prepared
    from app.schemas.flight_plan import SavedFlightPlan, FlightPlanMetadata, FlightPlanWaypoint

    plan = SavedFlightPlan(
        metadata=FlightPlanMetadata(name="Bad route"),
        waypoints=[
            FlightPlanWaypoint(name="A", latitude=100, longitude=0),
            FlightPlanWaypoint(name="B", latitude=0, longitude=0),
        ],
    )
    monkeypatch.setattr(offline, "get_flight_plan", lambda _: plan)
    del body["airports"]
    body["saved_plan_id"] = "invalid"
    response = client.post("/api/offline/prepare", json=body)
    assert response.status_code == 422 and "coordinates" in response.json()["detail"]


def test_historical_pin_keeps_matching_acquisition_provenance(prepared):
    client, store, body = prepared
    old_pin = body["charts"][0]["sha256"]
    with store.connection() as connection:
        connection.execute(
            "UPDATE receipts SET at=? WHERE chart_id=?", ("2026-11-15T12:00:00Z", "chart_one")
        )
    # Same catalog identity, different original bytes and a later acquisition.
    writer = PdfWriter()
    writer.add_blank_page(width=400, height=400)
    output = BytesIO()
    writer.write(output)
    store.web.content = output.getvalue()
    latest = store.acquire("chart_one", force=True)
    assert latest["cached"]["members"][0]["sha256"] != old_pin
    result = client.post("/api/offline/prepare", json=body)
    assert result.status_code == 200, result.text
    original = next(a for a in result.json()["assets"] if a["role"] == "chart_original")
    assert original["sha256"] == old_pin
    assert original["retrieved_at"] == "2026-11-15T12:00:00Z"
    assert original["source_url"] == "https://aeronav.faa.gov/example.pdf"
