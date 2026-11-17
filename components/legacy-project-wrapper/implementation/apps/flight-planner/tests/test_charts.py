"""Chart provenance, rollover, cache pinning and real projection behavior."""

from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
import rasterio
from rasterio.transform import from_bounds, Affine

from app.routers.charts import install
from app.services.charts import Charts, ChartError, lifecycle, faa_url, instant, catalog_verification
from app.services.chart_render import tile, raster_info
from app.services.navigation_cycle import current_catalog, navigation, coordinate
from app.services.aircraft_library.discovery import PublicWeb, AcquisitionError
from app.services.procedures import Procedures


def record(identifier="chart_one", **changes):
    return dict(
        id=identifier,
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
        **changes,
    )


class Web:
    content = b"%PDF-original"

    def get(self, url, **kwargs):
        return dict(url=url, content=self.content)


@pytest.fixture
def store(tmp_path):
    s = Charts(tmp_path)
    s.web = Web()
    s.replace("terminal", [record()])
    s.source("terminal", {"status":"available", "at":instant()})
    return s


def test_exclusive_rollover_and_unknown_dates():
    start, end = "2026-10-29T09:01:00+00:00", "2026-11-26T09:01:00+00:00"
    assert lifecycle(start, end, start) == "current"
    assert lifecycle(start, end, end) == "expired"
    assert lifecycle(end, None, start) == "future"
    assert lifecycle(start, None, start) == "undated"
    with pytest.raises(ChartError):
        lifecycle(start, end, "2026-11-01T00:00:00")


@pytest.mark.parametrize("checked,status,expected", [
    ("2026-11-15T12:00:00Z", "available", "verified"),
    ("2026-11-15T11:59:59Z", "available", "cached-unverified"),
    ("2026-11-16T12:00:01Z", "available", "cached-unverified"),
    ("2026-11-16T11:00:00", "available", "cached-unverified"),
    (None, "available", "cached-unverified"),
    ("invalid", "unavailable", "source-unavailable"),
])
def test_catalog_check_age_is_independent_of_edition(checked, status, expected):
    result = catalog_verification({"status": status, "at": checked}, "2026-11-16T12:00:00Z")
    assert result["verification_state"] == expected


def test_failed_catalog_check_relabels_current_charts_without_losing_original(store):
    at = "2026-11-16T12:00:00Z"
    store.source("terminal", {"status": "available", "at": at})
    store.acquire("chart_one")
    assert store.get("chart_one", at=at)["freshness"] == "current"
    store.source("terminal", {"status": "unavailable", "at": at, "error": "FAA unavailable"})
    result = store.search(freshness="source-unavailable", at=at)
    assert result["total"] == 1
    chart = result["charts"][0]
    assert chart["edition_freshness"] == "current"
    assert chart["source_checked_at"] == at
    assert store.search(freshness="current", at=at)["total"] == 0
    assert store.member("chart_one")[0].read_bytes() == b"%PDF-original"
    store.source("terminal", {"status": "available", "at": "2026-11-14T12:00:00Z"})
    assert store.get("chart_one", at=at)["freshness"] == "cached-unverified"
    assert store.get("chart_one", at="2026-11-26T09:01:00Z")["freshness"] == "expired"


def test_api_exposes_edition_and_verification_separately(store):
    row = record()
    row.update(effective_from="2020-01-01T00:00:00Z", effective_to="2099-01-01T00:00:00Z")
    store.replace("terminal", [row])
    store.source("terminal", {"status": "unavailable", "at": instant()})
    app = FastAPI()
    install(app, store=store)
    result = TestClient(app).get("/api/charts/catalog?freshness=source-unavailable").json()
    assert result["total"] == 1
    assert result["charts"][0]["verification_state"] == "source-unavailable"
    assert result["charts"][0]["edition_freshness"] == "current"


def test_source_update_preserves_pinned_original_and_rejects_unrecorded_hash(store):
    original = store.acquire("chart_one")["cached"]["members"][0]["sha256"]
    store.web.content = b"%PDF-second"
    store.acquire("chart_one", force=True)
    path, member = store.member("chart_one", 0, original)
    assert path.read_bytes() == b"%PDF-original"
    assert member["sha256"] == original
    assert store.member("chart_one")[0].read_bytes() == b"%PDF-second"
    with pytest.raises(ChartError, match="Pinned"):
        store.member("chart_one", 0, "../unknown")
    store.web.content = b"<html>upstream error</html>"
    with pytest.raises(ChartError, match="not a PDF"):
        store.acquire("chart_one", force=True)
    assert store.member("chart_one")[0].read_bytes() == b"%PDF-second"


def test_missing_chart_withdrawn_without_losing_old_editions(store):
    store.replace("terminal", [record("chart_two")])
    assert store.get("chart_one")["freshness"] == "withdrawn"
    replacement = record("next")
    replacement["cycle"] = "2612"
    store.replace("terminal", [replacement])
    assert store.get("chart_two")["freshness"] != "withdrawn"
    assert store.search(query="%")["total"] == 0


@pytest.mark.parametrize("name", ["../chart.pdf", "/chart.pdf", "a\\chart.pdf"])
def test_unsafe_zip_does_not_replace_receipt(store, name):
    store.acquire("chart_one")
    chart = record("zip")
    chart["format"] = "pdf_zip"
    store.replace("terminal", [chart])
    stream = BytesIO()
    with ZipFile(stream, "w") as archive:
        archive.writestr(name, b"%PDF-test")
    store.web.content = stream.getvalue()
    with pytest.raises(ChartError, match="Unsafe"):
        store.acquire("zip")
    assert store.get("zip")["cached"] is None
    assert store.member("chart_one")[0].read_bytes() == b"%PDF-original"


def test_api_auth_precedes_body_parse_and_pinned_binary_headers(store, monkeypatch):
    monkeypatch.setenv("AVIATION_CHARTS_TOKEN", "x" * 32)
    app = FastAPI()
    install(app, store=store)
    client = TestClient(app)
    assert client.post("/api/charts/chart_one/download", content=b"not-json").status_code == 401
    auth = {"Authorization": "Bearer " + "x" * 32}
    assert (
        client.post(
            "/api/charts/chart_one/download", content=b"x" * 17000, headers=auth
        ).status_code
        == 413
    )
    response = client.post("/api/charts/chart_one/download", json={}, headers=auth)
    assert response.status_code == 200, response.text
    pin = response.json()["cached"]["members"][0]["sha256"]
    response = client.get("/api/charts/chart_one/members/0?sha256=" + pin)
    assert response.content == b"%PDF-original"
    assert response.headers["x-content-sha256"] == pin
    assert (
        client.get("/api/charts/chart_one/offline-manifest").json()["files"][0]["url"].endswith(pin)
    )
    assert client.get("/api/charts/catalog?airport=KSFO").status_code == 200
    assert "sha256" in {
        p["name"]
        for p in app.openapi()["paths"]["/api/charts/{chart_id}/members/{number}/info"]["get"][
            "parameters"
        ]
    }
    assert "sha256" in {
        p["name"]
        for p in app.openapi()["paths"][
            "/api/charts/{chart_id}/members/{number}/tiles/{zoom}/{x}/{y}.png"
        ]["get"]["parameters"]
    }


def test_empty_navigation_never_falls_back_to_samples(store, monkeypatch):
    with pytest.raises(ChartError, match="current FAA"):
        current_catalog(store, "KSFO")
    monkeypatch.setenv("AVIATION_CHARTS_DIR", str(store.root))
    with pytest.raises(ChartError, match="current FAA"):
        Procedures().get_sids("KSFO")


def test_real_fixed_width_arinc_constraint_and_unknown_preservation(store):
    # FAA CIFP 2611: real unchanged procedure record; trailing date is last amendment.
    line = "SUSAP KSFOK2FH10RZ ASTINS 010STINSK2EA0E  A    IF                                             18000                 A FS   147671309"
    assert len(line) == 132
    key = store.save_object((line + "\n").encode())
    cycle = dict(
        cycle="2611",
        effective_from="2020-01-01T09:01:00+00:00",
        effective_to="2099-01-01T09:01:00+00:00",
        retrieved_at="2026-11-16T00:00:00+00:00",
        records_sha256=key,
    )
    with store.connection() as connection:
        connection.execute("INSERT INTO cycles VALUES (?,?)", ("2611", json.dumps(cycle)))
    data = navigation(store, "KSFO")
    assert data["total"] == 1
    assert data["procedures"][0]["provider"]["records"][0]["raw"] == line
    leg = data["procedures"][0]["record"]["legs"][0]
    assert leg["fix"] == "STINS"
    assert leg["course_deg"] is None
    assert not data["parse_receipt"]["rejected"]
    assert coordinate("N37400000") == pytest.approx(37 + 40 / 60)
    assert coordinate("N37990000") is None
    assert data["status"]["effective_until"] == cycle["effective_to"]
    store.source("terminal", {"status": "unavailable", "at": instant()})
    with pytest.raises(ChartError, match="current FAA"):
        current_catalog(store, "KSFO")


def test_robots_redirect_respects_final_policy_and_bounds():
    web = PublicWeb()
    calls = []

    def request(url, **kwargs):
        calls.append(url)
        if len(calls) == 1:
            return 301, {"location": "https://www.example.com/policy"}, b""
        return 200, {}, b"User-agent: *\nDisallow: /private\n"

    web._request = request
    assert not web.allowed("https://example.com/private/manual.pdf")
    assert web.allowed("https://example.com/public/manual.pdf")
    assert len(calls) == 2  # Policy cached under original source origin.
    web = PublicWeb()
    web._request = lambda *a, **kw: (302, {"location": "/robots.txt"}, b"")
    with pytest.raises(AcquisitionError, match="redirect limit"):
        web.allowed("https://example.com/manual.pdf")


@pytest.mark.parametrize(
    "url",
    ["http://aeronav.faa.gov/a", "https://example.com/a", "https://aeronav.faa.gov/a?token=x"],
)
def test_faa_transport_restriction(url):
    with pytest.raises(ChartError):
        faa_url(url)


def test_rotated_chart_projected_tile_and_outside_transparency(tmp_path):
    path = tmp_path / "rotated.tif"
    transform = (
        Affine.translation(-15000000, 7000000) * Affine.rotation(20) * Affine.scale(5000, -5000)
    )
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=128,
        height=128,
        count=3,
        dtype="uint8",
        crs="EPSG:3857",
        transform=transform,
    ) as dataset:
        data = np.zeros((3, 128, 128), dtype="uint8")
        data[0, :, :] = 230
        dataset.write(data)
    assert raster_info(path)["crs"] == "EPSG:3857"
    outside = np.asarray(Image.open(BytesIO(tile(path, 3, 7, 7))))
    assert outside.shape == (256, 256, 4)
    assert not outside[:, :, 3].any()
    # Project the real rotated center into its exact Web Mercator tile/pixel.
    x, y = transform * (64, 64)
    edge = 20037508.342789244
    span = 2 * edge / 8
    tx, ty = int((x + edge) / span), int((edge - y) / span)
    rendered = np.asarray(Image.open(BytesIO(tile(path, 3, tx, ty))))
    px, py = int((x + edge) / span * 256) % 256, int((edge - y) / span * 256) % 256
    assert rendered[py, px].tolist() == [230, 0, 0, 255]
    with pytest.raises(ChartError):
        tile(path, 17, 0, 0)


def test_paletted_colors_survive_reprojection(tmp_path):
    path = tmp_path / "palette.tif"
    edge = 20037508.342789244
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=1,
        dtype="uint8",
        crs="EPSG:3857",
        transform=from_bounds(-edge, 0, 0, edge, 64, 64),
    ) as dataset:
        dataset.write(np.ones((1, 64, 64), dtype="uint8"))
        dataset.write_colormap(1, {0: (0, 0, 0, 255), 1: (20, 110, 220, 255)})
    pixels = np.asarray(Image.open(BytesIO(tile(path, 1, 0, 0))))
    assert pixels[128, 128].tolist() == [20, 110, 220, 255]


def test_terminal_identifiers_and_cycle_validation():
    from app.services.charts import terminal_catalog

    xml = b"""<digital_tpp cycle="2611" from_edate="0901Z 10/29/26" to_edate="0901Z 11/26/26"><state_code ID="CA"><city_name ID="TEST"><airport_name ID="SMALL FIELD" apt_ident="1Q5" icao_ident=""><record><chartseq>1</chartseq><chart_code>APD</chart_code><chart_name>AIRPORT DIAGRAM</chart_name><pdf_name>00123AD.PDF</pdf_name></record></airport_name></city_name></state_code></digital_tpp>"""
    rows = terminal_catalog(xml, "2611")
    assert len(rows) == 1
    assert rows[0]["airport"] == "1Q5"
    assert rows[0]["icao"] is None
    assert rows[0]["effective_to"] == "2026-11-26T09:01:00+00:00"
    with pytest.raises(ChartError):
        terminal_catalog(xml, "2612")


def test_raster_page_keeps_next_date_as_current_end_and_unknown_future_end():
    from app.services.charts import raster_catalog

    html = """<table><tr><td>Example</td><td>Oct 29, 2026 <a href="https://aeronav.faa.gov/visual/current/sectional-files/Example.zip">GeoTIFF</a></td><td>Dec 24, 2026 <a href="https://aeronav.faa.gov/visual/next/sectional-files/Example.zip">GeoTIFF</a></td></tr></table>"""
    current, future = raster_catalog(html, "vfr")
    assert current["effective_to"] == future["effective_from"]
    assert future["effective_to"] is None
    assert current["id"] != future["id"]


def test_refresh_failure_retains_previous_catalog_and_originals(store):
    store.acquire("chart_one")

    def fail(*args, **kwargs):
        raise AcquisitionError("FAA source unavailable")

    store.web.get = fail
    result = store.refresh()
    assert result["partial"]
    assert len(result["results"]) == 3
    assert store.member("chart_one")[0].read_bytes() == b"%PDF-original"
    assert store.search()["total"] == 1
    assert all(v["status"] == "unavailable" for v in store.status()["sources"].values())
