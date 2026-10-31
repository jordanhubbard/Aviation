"""Guard Flight Planner's aircraft defaults at the common Aviation SDK."""

from pathlib import Path

from aviation.aircraft import C172S_OPERATING_PROFILE

BACKEND = Path(__file__).resolve().parents[1]
APP_ROOT = BACKEND.parent


def test_private_aircraft_profile_file_stays_removed() -> None:
    assert not (BACKEND / "config/aircraft_profiles.yaml").exists()
    config_source = (BACKEND / "app/config.py").read_text(encoding="utf-8")
    assert "aircraft_profiles" not in config_source


def test_frontend_defaults_import_the_common_aircraft_profile() -> None:
    defaults = (APP_ROOT / "frontend/src/aircraftDefaults.ts").read_text(
        encoding="utf-8"
    )
    form = (APP_ROOT / "frontend/src/components/FlightPlanningForm.tsx").read_text(
        encoding="utf-8"
    )
    assert "@aviation/shared-sdk/aviation/aircraft" in defaults
    assert "DEFAULT_AIRCRAFT_CRUISE_SPEED_KT" in form
    assert "DEFAULT_AIRCRAFT_USABLE_FUEL_GAL" in form
    assert "useState<number>(110)" not in form
    assert "useState<number>(40)" not in form
    assert C172S_OPERATING_PROFILE.icao_type_designator == "C172"
