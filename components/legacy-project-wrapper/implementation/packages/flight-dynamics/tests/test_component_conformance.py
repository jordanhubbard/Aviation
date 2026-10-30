from __future__ import annotations

import json
from pathlib import Path

import pytest

from aviation_flight_dynamics.aircraft import C172_CONFIG, validate_aircraft_config
from aviation_flight_dynamics.aircraft.models import C182_CONFIG, SR22_CONFIG
from aviation_flight_dynamics.autopilot import PIDController, PIDGains
from aviation_flight_dynamics.compat import (
    apply_turbulence_effect,
    apply_wind_effect,
    calculate_drag,
    calculate_fuel_consumption,
    calculate_lift,
    calculate_thrust,
)
from aviation_flight_dynamics.performance import (
    compute_cruise_performance,
    compute_takeoff_climb_performance,
)
from aviation_flight_dynamics.physics import (
    AircraftState,
    ControlInputs,
    ForceMoment,
    IntegratorConfig,
    IntegratorMethod,
    IsaAtmosphereModel,
    Quaternion,
    RigidBodyState,
    SixDofIntegrator,
    Vector3,
    WindModel,
    WindModelConfig,
)


PACKAGE_VECTOR_PATH = Path(__file__).resolve().parents[1] / "conformance" / "vectors.json"
AUTHORITY_VECTOR_PATH = (
    Path(__file__).resolve().parents[6]
    / "components"
    / "aviation-flight-dynamics"
    / "acceptance"
    / "vectors.json"
)
VECTORS = json.loads(PACKAGE_VECTOR_PATH.read_text(encoding="utf-8"))


def test_packaged_vectors_match_component_authority() -> None:
    if AUTHORITY_VECTOR_PATH.exists():
        assert json.loads(AUTHORITY_VECTOR_PATH.read_text(encoding="utf-8")) == VECTORS


def test_isa_atmosphere_vector() -> None:
    case = VECTORS["atmosphere"]
    actual = IsaAtmosphereModel().compute_state(case["altitude_m"])
    expected = case["expected"]
    assert actual.density_kg_m3 == pytest.approx(expected["density_kg_m3"])
    assert actual.pressure_pa == pytest.approx(expected["pressure_pa"])
    assert actual.temperature_c == pytest.approx(expected["temperature_c"])


def test_deterministic_wind_vector() -> None:
    case = VECTORS["wind"]
    model = WindModel(
        WindModelConfig(
            steady_wind_mps=Vector3(*case["steady_mps"]),
            gust_amplitude_mps=case["gust_amplitude_mps"],
            gust_frequency_hz=case["gust_frequency_hz"],
        )
    )
    actual = model.wind_velocity_mps(case["time_s"])
    assert [actual.x, actual.y, actual.z] == pytest.approx(case["expected_total_mps"])


def test_pid_vector_has_no_first_sample_derivative_kick() -> None:
    case = VECTORS["pid"]
    controller = PIDController(PIDGains(*case["gains"]))
    outputs = [controller.update(error, dt) for error, dt in case["samples"]]
    assert outputs == pytest.approx(case["expected_outputs"])


def test_bundled_aircraft_models_validate() -> None:
    models = [C172_CONFIG, C182_CONFIG, SR22_CONFIG]
    actual = []
    for model in models:
        report = validate_aircraft_config(model)
        actual.append(
            {
                "identifier": model.aircraft_id,
                "errors": len(report.errors),
                "warnings": len(report.warnings),
            }
        )
    assert actual == VECTORS["models"]


def test_c172_performance_vectors() -> None:
    case = VECTORS["c172_performance"]
    atmosphere = IsaAtmosphereModel().compute_state(0.0)
    cruise = compute_cruise_performance(C172_CONFIG, case["power_setting"])
    takeoff = compute_takeoff_climb_performance(C172_CONFIG, atmosphere)
    for key, expected in case["expected_cruise"].items():
        assert getattr(cruise, key) == pytest.approx(expected)
    for key, expected in case["expected_takeoff_climb"].items():
        assert getattr(takeoff, key) == pytest.approx(expected)


def test_compatibility_formulas_match_vectors() -> None:
    case = VECTORS["compatibility"]
    value = case["input"]
    expected = case["expected"]
    assert calculate_lift(
        value["speed"],
        value["wing_area"],
        value["lift_coefficient"],
        value["air_density"],
    ) == pytest.approx(expected["lift"])
    assert calculate_drag(
        value["speed"],
        value["wing_area"],
        value["drag_coefficient"],
        value["air_density"],
    ) == pytest.approx(expected["drag"])
    thrust = calculate_thrust(value["power"], value["efficiency"], value["engine_factor"])
    assert thrust == pytest.approx(expected["thrust"])
    assert calculate_fuel_consumption(
        thrust, value["fuel_efficiency"]
    ) == pytest.approx(expected["fuel_consumption"])
    assert apply_wind_effect(
        value["speed"], value["wind_speed"], value["wind_angle_rad"]
    ) == pytest.approx(expected["wind_adjusted_velocity"])
    assert apply_turbulence_effect(
        value["speed"], value["turbulence_intensity"]
    ) == pytest.approx(expected["turbulence_adjusted_velocity"])


def test_invalid_controls_and_time_step_fail_closed() -> None:
    with pytest.raises(ValueError, match="throttle"):
        ControlInputs(1.1, 1.0, 1.0, 0.0, 0.0, 0.0)

    state = AircraftState(
        rigid_body=RigidBodyState(
            position_ned_m=Vector3(0.0, 0.0, 0.0),
            velocity_body_mps=Vector3(0.0, 0.0, 0.0),
            orientation=Quaternion(1.0, 0.0, 0.0, 0.0),
            angular_rates_body_rps=Vector3(0.0, 0.0, 0.0),
        ),
        mass_kg=1000.0,
    )
    integrator = SixDofIntegrator(IntegratorConfig(method=IntegratorMethod.EULER))
    forces = ForceMoment(Vector3(0.0, 0.0, 0.0), Vector3(0.0, 0.0, 0.0))
    with pytest.raises(ValueError, match="dt_s"):
        integrator.step(state, forces, C172_CONFIG, 0.0)
