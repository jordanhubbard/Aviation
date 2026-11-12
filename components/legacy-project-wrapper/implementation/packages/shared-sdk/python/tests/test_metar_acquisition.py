"""Current NOAA raw products include optional report-type prefixes."""

import httpx
import pytest

from aviation.weather import metar


@pytest.mark.parametrize("prefix", ["", "METAR ", "SPECI "])
def test_station_matching_preserves_prefixed_reports(monkeypatch, prefix):
    raw = prefix + "KSFO 120556Z 29005KT 10SM CLR 16/10 A2994"
    monkeypatch.delenv("DISABLE_METAR_FETCH", raising=False)
    monkeypatch.setattr(metar.weather_cache, "get", lambda key: None)
    monkeypatch.setattr(metar.weather_cache, "get_stale", lambda key: None)
    monkeypatch.setattr(metar.weather_cache, "set", lambda *a, **k: None)
    monkeypatch.setattr(
        metar.httpx,
        "get",
        lambda *a, **k: httpx.Response(
            200,
            request=httpx.Request("GET", metar.__name__),
            text=raw + "\nMETAR KPAO 120556Z 00000KT 10SM CLR 16/10 A2994",
        ),
    )
    result = metar.fetch_metar_raws(["ksfo", "KSFO", "KZZZ"])
    assert result == {"KSFO": raw, "KZZZ": None}
