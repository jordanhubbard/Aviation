from aviation_avionics import (
    AudioPanelState as SdkAudioPanelState,
    TransponderState as SdkTransponderState,
)

from app.services.audio_panel import AudioPanelState, compute_marker_beacons
from app.services.flight_dynamics import FlightDynamicsSimulator
from app.services.transponder import TransponderState


def test_g1000_uses_shared_audio_and_transponder_models() -> None:
    assert AudioPanelState is SdkAudioPanelState
    assert TransponderState is SdkTransponderState


def test_g1000_marker_catalog_is_an_explicit_sdk_input() -> None:
    marker = compute_marker_beacons(37.6190, -122.3738, 1000.0)
    assert marker.to_dict() == {
        "outer_active": False,
        "middle_active": False,
        "inner_active": True,
    }


def test_g1000_transponder_adapter_preserves_command_behavior() -> None:
    simulator = FlightDynamicsSimulator()
    simulator.set_transponder(mode="S", squawk_code=7500, ident=True)
    assert simulator.transponder.to_dict() == {
        "mode": "S",
        "squawk_code": "7500",
        "ident_active": True,
        "ident_remaining_sec": 18.0,
    }
    simulator.set_transponder(mode="ALT", squawk_code="1280")
    assert simulator.transponder.mode == "S"
    assert simulator.transponder.squawk_code == "7500"
    simulator.transponder.update(18.0)
    assert simulator.transponder.ident_active is False
