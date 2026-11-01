"""Guard Flight Planner's simulated nav instruments at the common SDK boundary."""

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.gps_simulation import simulate_groundspeed_and_track
from app.services.hsi_integration import (
    CDIMode,
    calculate_bearing_pointer,
    calculate_cdi_deviation,
    calculate_to_from_flag,
)
from app.services.nav_radio_simulation import (
    NavRadioSimulationService,
    NavRadioState,
    calculate_adf_bearing,
    calculate_dme_range,
    calculate_vor_radial,
)
from aviation_avionics import MarkerBeaconSite, RadioState

BACKEND = Path(__file__).resolve().parents[1]
INSTRUMENT_MODULES = (
    "app/services/nav_radio_simulation.py",
    "app/services/hsi_integration.py",
    "app/services/gps_simulation.py",
)


def test_radio_geometry_uses_wgs84_sdk_semantics() -> None:
    aircraft = (0.0, 0.0)
    station = (1.0, 0.0)

    assert calculate_adf_bearing(station, aircraft) == pytest.approx(0.0)
    assert calculate_dme_range(station, aircraft) == pytest.approx(60.0404607326)
    assert calculate_vor_radial(1.0, 359.0) == pytest.approx(2.0)
    assert calculate_vor_radial(359.0, 1.0) == pytest.approx(-2.0)

    with pytest.raises(ValueError, match="latitude_deg out of range"):
        calculate_adf_bearing(station, (91.0, 0.0))


def test_radio_stack_composes_sdk_tuning_ptt_and_host_atc_hook() -> None:
    transmitted = []
    service = NavRadioSimulationService(
        clock=lambda: 0.0, on_transmit=lambda *event: transmitted.append(event)
    )
    service.tune_com(1, 126.025)
    service.flip_com(1)
    service.ptt(1, True)
    service.set_com_volume(1, 0.4)
    service.tune_nav(2, 117.95, standby=False)
    service.set_nav_volume(2, 0.2)
    service.flip_nav(2)
    assert isinstance(service.com1, RadioState)
    assert service.com1.active_frequency_mhz == 126.025
    assert service.com1.transmit is True
    assert service.com1.volume == 0.4
    assert service.com2.active_frequency_mhz == 121.5
    assert service.com2.transmit is False
    assert service.nav2.standby_frequency_mhz == 117.95
    assert service.nav2.volume == 0.2
    assert transmitted[0][:2] == (1, True)
    assert transmitted[0][2].active_frequency_mhz == 126.025
    for action in (
        lambda: service.tune_com(3, 121.5),
        lambda: service.tune_com(True, 121.5),
        lambda: service.tune_com(1, 137.0),
        lambda: service.tune_com(1, 126.0125),
        lambda: service.tune_nav(2, 118.0),
        lambda: service.set_com_volume(1, float("nan")),
        lambda: service.ptt(1, "yes"),
    ):
        previous = service.full_status()
        with pytest.raises(ValueError):
            action()
        assert service.full_status() == previous
    assert len(transmitted) == 1


def test_transponder_uses_sdk_timing_and_retains_legacy_state_object() -> None:
    clock = [0.0]
    state = NavRadioState()
    service = NavRadioSimulationService(state, clock=lambda: clock[0])
    service.set_squawk("4321")
    service.set_transponder_mode("alt")
    service.transponder_ident()
    clock[0] = 17.0
    assert service.full_status()["transponder"]["ident_active"] is True
    clock[0] = 18.0
    service.update_state(359, 1, 0, 0, (1, 0), (0, 0))
    assert service.get_state() is state
    assert state.vor_radial == -2
    assert state.dme_range == pytest.approx(60.0404607326)
    status = service.full_status()["transponder"]
    assert status["mode"] == "C"
    assert status["squawk_code"] == "4321"
    assert status["ident_active"] is False
    for bad in ("8888", "-1", "12345"):
        with pytest.raises(ValueError):
            service.set_squawk(bad)
    with pytest.raises(ValueError):
        service.set_transponder_mode("invalid")
    clock[0] = 17.0
    with pytest.raises(ValueError):
        service.tick()


def test_audio_marker_geometry_and_auxiliary_inputs_use_common_controls() -> None:
    service = NavRadioSimulationService(clock=lambda: 0.0)
    service.set_adf_volume(0.4)
    service.set_audio_volume("com1", 0.2)
    service.toggle_audio_monitor("nav2", True)
    service.set_audio_volume("intercom", 0.6)
    service.toggle_audio_monitor("music", True)
    service.set_audio_volume("music", 0.1)
    service.set_audio_output("speaker", True)
    service.update_marker_geometry(
        (0, 0), 1000, [MarkerBeaconSite("training", 0, 0, 3, 2, 1, 2000)]
    )
    assert service.marker_status.inner_active is True
    service.update_marker_lights(True, True, False)
    status = service.full_status()
    assert status["marker_receiver"] == {
        "outer_active": False,
        "middle_active": True,
        "inner_active": False,
    }
    assert status["audio_panel"]["intercom_volume"] == 0.6
    assert status["audio_panel"]["music_enabled"] is True
    assert status["audio_panel"]["music_volume"] == 0.1
    assert status["audio_panel"]["speaker_enabled"] is True
    assert status["audio_panel"]["nav2_enabled"] is True
    assert status["adf_volume"] == 0.4
    for action in (
        lambda: service.set_audio_volume("unknown", 0.5),
        lambda: service.set_audio_volume("music", 2),
        lambda: service.toggle_audio_monitor("music", 1),
        lambda: service.set_audio_output("speaker", "yes"),
        lambda: service.update_marker_lights(1, False, False),
    ):
        with pytest.raises(ValueError):
            action()
        assert service.full_status() == status


def test_hsi_preserves_display_policy_over_sdk_angles() -> None:
    aircraft = (0.0, 0.0)
    station = (1.0, 0.0)

    assert calculate_bearing_pointer(station, aircraft, 90.0) == pytest.approx(270.0)
    assert calculate_cdi_deviation(1.0, 359.0, CDIMode.GPS) == pytest.approx(2.0)
    assert calculate_cdi_deviation(20.0, 0.0, CDIMode.LOC) == pytest.approx(2.5)
    assert calculate_cdi_deviation(-20.0, 0.0, CDIMode.VOR) == pytest.approx(-10.0)
    assert calculate_to_from_flag(90.0, 0.0) == "TO"
    assert calculate_to_from_flag(91.0, 0.0) == "FROM"


def test_gps_error_injection_retains_sdk_track_normalization() -> None:
    with patch("app.services.gps_simulation.random.uniform", side_effect=[0.25, 0.5]):
        speed, track = simulate_groundspeed_and_track(100.0, 359.75)

    assert speed == pytest.approx(100.25)
    assert track == pytest.approx(0.25)


def test_instrument_adapters_do_not_reimplement_common_geometry() -> None:
    for relative_path in INSTRUMENT_MODULES:
        source = (BACKEND / relative_path).read_text(encoding="utf-8")
        assert "import math" not in source, relative_path
        assert "math.atan2" not in source, relative_path
        assert "math.sqrt" not in source, relative_path
        assert "% 360" not in source, relative_path

    radio_source = (BACKEND / INSTRUMENT_MODULES[0]).read_text(encoding="utf-8")
    assert "initial_bearing_deg" in radio_source
    assert "great_circle_distance_nm" in radio_source

    hsi_source = (BACKEND / INSTRUMENT_MODULES[1]).read_text(encoding="utf-8")
    assert "normalize_signed_angle" in hsi_source
    assert "initial_bearing_deg" in hsi_source

    gps_source = (BACKEND / INSTRUMENT_MODULES[2]).read_text(encoding="utf-8")
    assert "normalize_heading" in gps_source
