from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, replace
from pathlib import Path

import pytest

from aviation_flight_dynamics.aircraft import C172_CONFIG, validate_aircraft_config
from aviation_flight_dynamics.aircraft.models import C182_CONFIG, SR22_CONFIG
from aviation_flight_dynamics.autopilot import (
    AltitudeHoldController,
    AutopilotModeController,
    AutopilotState,
    AutotrimController,
    EnvelopeLimits,
    EnvelopeProtection,
    HeadingHoldController,
    LateralMode,
    PIDController,
    PIDGains,
    PitchController,
    RollController,
    VerticalMode,
)
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
AIRCRAFT_PACKAGE_VECTOR_PATH = (
    Path(__file__).resolve().parents[1] / "conformance" / "aircraft.json"
)
AIRCRAFT_AUTHORITY_VECTOR_PATH = (
    Path(__file__).resolve().parents[6]
    / "components"
    / "aviation-aircraft"
    / "acceptance"
    / "vectors.json"
)
AIRCRAFT_VECTORS = json.loads(
    AIRCRAFT_PACKAGE_VECTOR_PATH.read_text(encoding="utf-8")
)


def test_packaged_vectors_match_component_authority() -> None:
    if AUTHORITY_VECTOR_PATH.exists():
        assert json.loads(AUTHORITY_VECTOR_PATH.read_text(encoding="utf-8")) == VECTORS


def test_packaged_aircraft_vectors_match_component_authority() -> None:
    if AIRCRAFT_AUTHORITY_VECTOR_PATH.exists():
        assert (
            json.loads(AIRCRAFT_AUTHORITY_VECTOR_PATH.read_text(encoding="utf-8"))
            == AIRCRAFT_VECTORS
        )


def _c172s_operating_profile() -> dict[str, object]:
    limits = C172_CONFIG.limits
    return {
        "profileId": "cessna-172s",
        "manufacturer": C172_CONFIG.manufacturer,
        "model": "172S",
        "displayName": "Cessna 172S Skyhawk",
        "airspeedLimits": {
            "vsoKias": limits.stall_speed_landing_kt,
            "vsKias": limits.stall_speed_clean_kt,
            "vfeKias": limits.max_flap_extended_speed_kt,
            "vaKias": limits.maneuvering_speed_kt,
            "vnoKias": limits.max_operating_speed_kt,
            "vneKias": limits.never_exceed_speed_kt,
        },
    }


def test_c172s_operating_profile_matches_aircraft_component() -> None:
    assert _c172s_operating_profile() == AIRCRAFT_VECTORS["profiles"]["cessna-172s"]


def test_invalid_aircraft_operating_profiles_fail_closed() -> None:
    field_names = {
        "vsoKias": "stall_speed_landing_kt",
        "vsKias": "stall_speed_clean_kt",
        "vfeKias": "max_flap_extended_speed_kt",
        "vaKias": "maneuvering_speed_kt",
        "vnoKias": "max_operating_speed_kt",
        "vneKias": "never_exceed_speed_kt",
    }
    for mutation in AIRCRAFT_VECTORS["invalidMutations"]:
        value = mutation["value"]
        if value == "non-finite":
            value = math.nan
        with pytest.raises(ValueError):
            replace(C172_CONFIG.limits, **{field_names[mutation["field"]]: value})


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


def test_bounded_pid_vector_clamps_integral_and_output() -> None:
    case = VECTORS["pid_bounded"]
    controller = PIDController(PIDGains(**case["config"]))
    outputs = [controller.update(error, dt) for error, dt in case["samples"]]
    assert outputs == pytest.approx(case["expected_outputs"])
    assert controller.integral == pytest.approx(-1.0)


def test_axis_controller_vectors() -> None:
    controller_types = {
        "pitch": PitchController,
        "roll": RollController,
        "altitude": AltitudeHoldController,
        "heading": HeadingHoldController,
    }
    for case in VECTORS["axis_controllers"]:
        controller = controller_types[case["axis"]](PIDGains(**case["gains"]))
        outputs = [controller.update(error, dt) for error, dt in case["samples"]]
        assert outputs == pytest.approx(case["expected_outputs"])

        controller.reset()
        reset_outputs = [
            controller.update(error, dt) for error, dt in case["samples"]
        ]
        assert reset_outputs == pytest.approx(case["expected_outputs"])


def _mode_state(controller: AutopilotModeController) -> dict[str, object]:
    state = controller.state
    return {
        "master_on": state.master_on,
        "lateral_mode": state.lateral_mode.value,
        "vertical_mode": state.vertical_mode.value,
        "approach_armed": state.approach_armed,
    }


def test_autopilot_mode_transition_vector() -> None:
    case = VECTORS["autopilot_modes"]
    controller = AutopilotModeController()
    assert _mode_state(controller) == case["initial"]

    for transition in case["transitions"]:
        action = transition["action"]
        if action == "engage":
            controller.engage()
            accepted = True
        elif action == "disengage":
            controller.disengage()
            accepted = True
        elif action == "set_lateral":
            accepted = controller.set_lateral_mode(LateralMode(transition["mode"]))
        elif action == "set_vertical":
            accepted = controller.set_vertical_mode(VerticalMode(transition["mode"]))
        else:  # pragma: no cover - vector schema guard
            raise AssertionError(f"Unsupported mode action: {action}")
        assert accepted is transition["accepted"]
        assert _mode_state(controller) == transition["expected"]


def test_autopilot_state_snapshots_are_immutable_copies() -> None:
    controller = AutopilotModeController()
    controller.engage()
    before = controller.state
    controller.set_lateral_mode(LateralMode.HDG)
    assert before.lateral_mode == LateralMode.ROL
    assert controller.state.lateral_mode == LateralMode.HDG


def _flight_director_state(controller: AutopilotModeController) -> dict[str, object]:
    state = controller.state
    return {
        "master_on": state.master_on,
        "lateral_mode": state.lateral_mode.value,
        "vertical_mode": state.vertical_mode.value,
        "approach_armed": state.approach_armed,
        "lateral_armed": state.lateral_armed.value if state.lateral_armed else None,
        "vertical_armed": state.vertical_armed.value if state.vertical_armed else None,
        "target_vertical_speed_fpm": state.target_vertical_speed_fpm,
        "disconnect_reason": state.disconnect_reason,
    }


def test_flight_director_transition_vector() -> None:
    case = VECTORS["flight_director"]
    controller = AutopilotModeController()
    assert _flight_director_state(controller) == case["initial"]

    for transition in case["transitions"]:
        action = transition["action"]
        if action == "engage":
            controller.engage()
            accepted = True
        elif action == "disengage":
            controller.disengage(transition.get("reason", ""))
            accepted = True
        elif action == "set_lateral":
            accepted = controller.set_lateral_mode(LateralMode(transition["mode"]))
        elif action == "arm_lateral":
            accepted = controller.arm_lateral_mode(LateralMode(transition["mode"]))
        elif action == "capture_lateral":
            accepted = controller.capture_lateral_mode(LateralMode(transition["mode"]))
        elif action == "set_vertical":
            accepted = controller.set_vertical_mode(VerticalMode(transition["mode"]))
        elif action == "arm_vertical":
            accepted = controller.arm_vertical_mode(VerticalMode(transition["mode"]))
        elif action == "capture_vertical":
            accepted = controller.capture_vertical_mode(VerticalMode(transition["mode"]))
        elif action == "set_target_vertical_speed":
            controller.set_target_vertical_speed(transition["target_fpm"])
            accepted = True
        else:  # pragma: no cover - vector schema guard
            raise AssertionError(f"Unsupported flight-director action: {action}")
        assert accepted is transition["accepted"]
        assert _flight_director_state(controller) == transition["expected"]

    assert _flight_director_state(controller) == case["expected"]


def test_flight_director_adapts_application_owned_state() -> None:
    @dataclass
    class ApplicationStatus(AutopilotState):
        annunciation: str = "AP"

    status = ApplicationStatus()
    controller = AutopilotModeController(status)
    controller.engage()
    controller.set_lateral_mode(LateralMode.HDG)

    snapshot = controller.state
    assert status.master_on is True
    assert status.lateral_mode == LateralMode.HDG
    assert snapshot == status
    assert snapshot is not status
    assert snapshot.annunciation == "AP"


def test_autotrim_vector() -> None:
    case = VECTORS["autotrim"]
    controller = AutotrimController(
        trim_rate=case["trim_rate"], deadband=case["deadband"]
    )
    for sample in case["samples"]:
        assert asdict(controller.update(*sample["inputs"])) == pytest.approx(
            sample["expected"]
        )

    controller.reset()
    assert asdict(controller.trim_state) == {
        "elevator_trim": 0.0,
        "aileron_trim": 0.0,
        "rudder_trim": 0.0,
    }


def test_envelope_protection_vectors() -> None:
    case = VECTORS["envelope"]
    protection = EnvelopeProtection(EnvelopeLimits(**case["limits"]))
    for sample in case["samples"]:
        status = protection.check(*sample["state"])
        assert asdict(status) == sample["expected"]
        assert status.any_exceeded is any(sample["expected"].values())


def test_invalid_autopilot_configuration_fails_closed() -> None:
    with pytest.raises(ValueError, match="max_bank_deg"):
        EnvelopeLimits(max_bank_deg=0.0)
    with pytest.raises(ValueError, match="max_speed_kt"):
        EnvelopeLimits(min_speed_kt=100.0, max_speed_kt=100.0)
    with pytest.raises(ValueError, match="trim_rate"):
        AutotrimController(trim_rate=-0.1)
    with pytest.raises(ValueError, match="deadband"):
        AutotrimController(deadband=-0.1)


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
    with pytest.raises(ValueError, match="PID gains and bounds"):
        PIDController(PIDGains(1.0, 0.0, 0.0, output_min=1.0, output_max=-1.0))

    with pytest.raises(ValueError, match="throttle"):
        ControlInputs(1.1, 1.0, 1.0, 0.0, 0.0, 0.0)

    controller = PIDController(PIDGains(1.0, 0.0, 0.0))
    with pytest.raises(ValueError, match="dt"):
        controller.update(1.0, 0.0)

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
