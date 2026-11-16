"""Provider boundaries and coverage evidence for route assessment."""

import pytest
from app.services import assessment_sources as sources
from app.services import ga_data as data


@pytest.fixture(autouse=True)
def fresh_cache():
    data._CACHE.clear()
    yield
    data._CACHE.clear()


def feature(identity=1):
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [-122, 37]},
        "properties": {"OBJECTID": identity, "AMSL": None, "AGL": 200},
    }


def test_obstacle_pagination_preserves_unknown_elevation_and_is_explicitly_truncated(monkeypatch):
    calls = []

    def fetch(url, params):
        calls.append(params)
        return {
            "type": "FeatureCollection",
            "features": [feature(params["resultOffset"] + 1)],
            "properties": {"exceededTransferLimit": True},
        }

    monkeypatch.setattr(data, "fetch", fetch)
    result = sources.obstacles((-123, 36, -121, 38), limit=2)
    assert result["truncated"]
    assert [p["resultOffset"] for p in calls] == [0, 1]
    assert result["records"][0]["properties"]["AMSL"] is None
    assert result["records"][0]["properties"]["AGL"] == 200


def test_obstacle_repeating_page_fails_instead_of_claiming_complete(monkeypatch):
    monkeypatch.setattr(
        data,
        "fetch",
        lambda *a, **kw: {
            "type": "FeatureCollection",
            "features": [feature()],
            "exceededTransferLimit": True,
        },
    )
    with pytest.raises(data.DataUnavailable, match="pagination changed"):
        sources.obstacles((-123, 36, -121, 38), limit=2)


@pytest.mark.parametrize("bounds", [(170, 0, -170, 1), (-181, 0, 0, 1), (0, 0, float("nan"), 1)])
def test_invalid_or_unsplit_bounds_never_reach_transport(bounds, monkeypatch):
    monkeypatch.setattr(
        data, "fetch", lambda *a, **kw: pytest.fail("Invalid query reached transport")
    )
    with pytest.raises(ValueError):
        sources.obstacles(bounds)


def test_tfr_areas_are_grouped_by_identity_and_missing_coverage_survives(monkeypatch):
    monkeypatch.setattr(
        data,
        "temporary_restrictions",
        lambda: {
            "restrictions": [{"notam_id": "6/1234"}, {"notam_id": "6/9999"}],
            "source": {"provider": "FAA", "url": "https://tfr.faa.gov/"},
        },
    )
    areas = []
    for key in ["6/1234-1-FDC-F", "6/1234-2-FDC-F", "5/0000-1-FDC-F"]:
        f = feature()
        f["properties"] = {"NOTAM_KEY": key}
        areas.append(f)
    monkeypatch.setattr(
        data,
        "fetch",
        lambda *a, **kw: {
            "type": "FeatureCollection",
            "features": areas,
            "numberMatched": 3,
            "numberReturned": 3,
        },
    )
    result = sources.tfr_geometry()
    assert len(result["records"][0]["areas"]) == 2
    assert result["missing_geometry_ids"] == ["6/9999"]
    assert len(result["unmatched_geometry"]) == 1
    assert not result["truncated"]
    assert "valid_from" not in result["records"][0]


def test_unknown_tfr_completeness_does_not_become_empty_coverage(monkeypatch):
    monkeypatch.setattr(data, "temporary_restrictions", lambda: {"restrictions": [], "source": {}})
    monkeypatch.setattr(
        data,
        "fetch",
        lambda *a, **kw: {
            "type": "FeatureCollection",
            "features": [],
            "numberMatched": "unknown",
            "numberReturned": 0,
        },
    )
    with pytest.raises(data.DataUnavailable, match="completeness"):
        sources.tfr_geometry()


def test_forecast_snapshot_not_relabelled_as_interval_and_caps_visible(monkeypatch):
    row = {"validTime": "2026-11-16T15:00:00Z", "base": "FZL", "geom": "LINE"}
    monkeypatch.setattr(
        data,
        "aviation_weather",
        lambda *a, **kw: {"reports": [row] * 400, "status": "available", "source": {}},
    )
    result = sources.weather_advisories("cwa")
    assert result["validity_kind"] == "interval"
    assert result["truncated"]
    assert result["reports"][0] == row


def test_full_forecast_cache_preserves_snapshots_and_msl_fields(monkeypatch):
    import gzip

    xml = b'<response><errors/><data num_results="2"><GAIRMET><tag>1W</tag><product>TANGO</product><valid_time>2026-11-16T15:00:00Z</valid_time><hazard type="TURB-LO"/><geometry_type>AREA</geometry_type><altitude min_ft_msl="8000" max_ft_msl="16000"/><area><point><latitude>30</latitude><longitude>-100</longitude></point></area></GAIRMET><GAIRMET><valid_time>2026-11-16T18:00:00Z</valid_time><altitude min_ft_msl="FZL" max_ft_msl="23000"/></GAIRMET></data></response>'
    monkeypatch.setattr(data, "fetch", lambda *a, **kw: gzip.compress(xml))
    result = sources.weather_advisories("gairmet")
    assert len(result["reports"]) == 2
    assert result["reports"][0]["altitude_ft_msl"] == {"min_ft_msl": "8000", "max_ft_msl": "16000"}
    assert result["reports"][1]["altitude_ft_msl"]["min_ft_msl"] == "FZL"
    assert result["validity_kind"] == "forecast_snapshot"
    assert not result["truncated"]


def test_forecast_cache_count_drift_is_unavailable(monkeypatch):
    import gzip

    monkeypatch.setattr(
        data,
        "fetch",
        lambda *a, **kw: gzip.compress(b'<response><data num_results="1"/></response>'),
    )
    with pytest.raises(data.DataUnavailable, match="forecast cache"):
        sources.gairmet_forecasts()
