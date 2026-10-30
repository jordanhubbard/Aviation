import pytest

from app.services.ahrs_adc_simulation import compute_adc, compute_ahrs


def test_flight_planner_uses_common_ahrs_model():
    solution = compute_ahrs(
        heading_deg=370,
        pitch_deg=190,
        roll_deg=-190,
        turn_rate_dps=0,
        airspeed_kt=100,
        latitude_deg=37.6,
        longitude_deg=-122.4,
    )
    assert solution.pitch_deg == -170
    assert solution.roll_deg == 170
    assert solution.true_heading_deg == 10
    assert solution.magnetic_heading_deg == pytest.approx(22.24)


def test_flight_planner_uses_common_adc_model():
    solution = compute_adc(
        altitude_ft=5000,
        airspeed_kt=100,
        vertical_speed_fpm=500,
        altimeter_setting_inhg=30.12,
        temperature_offset_c=10,
    )
    assert solution.pressure_altitude_ft == pytest.approx(4800)
    assert solution.density_altitude_ft == pytest.approx(6000)
    assert solution.tas_kt > solution.ias_kt
