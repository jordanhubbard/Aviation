"""Flight School boundary tests for qualified common aircraft profiles."""

from __future__ import annotations

import inspect

from app.models import Aircraft


def test_exact_fleet_identity_resolves_common_profile() -> None:
    aircraft = Aircraft(make="  cessna ", model=" 172s ")

    profile = aircraft.operating_profile

    assert profile is not None
    assert profile.profile_id == "cessna-172s"
    assert profile.weight_limits.maximum_takeoff_weight_lb == 2550
    assert profile.fuel_limits.usable_capacity_gal == 53


def test_unqualified_fleet_identity_fails_closed() -> None:
    aircraft = Aircraft(make="Piper", model="PA-28-181")

    assert aircraft.operating_profile is None


def test_fleet_page_renders_qualified_sdk_reference_data(
    client,
    test_aircraft,
) -> None:
    response = client.get("/aircraft")

    assert response.status_code == 200
    assert b'data-aircraft-profile="cessna-172s"' in response.data
    assert b"Cessna 172S Skyhawk" in response.data
    assert b"ICAO type: C172" in response.data
    assert b"Maximum takeoff weight: 2550 lb" in response.data
    assert b"Usable fuel: 53.0 gal" in response.data
    assert b"Maximum cruise: 124 KTAS" in response.data


def test_aircraft_model_delegates_profile_identity_to_sdk() -> None:
    source = inspect.getsource(Aircraft.operating_profile.fget)

    assert "match_aircraft_operating_profile(self.make, self.model)" in source
    assert "C172" not in source
    assert "2550" not in source
