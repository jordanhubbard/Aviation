from pathlib import Path

from aviation.aircraft import AircraftOperatingProfile, C182T_OPERATING_PROFILE

from ..aircraft_model import AircraftConfig
from ._profile_linked import load_profile_linked_config

MODEL_PATH = Path(__file__).with_suffix(".yaml")


def load_c182_config(
    profile: AircraftOperatingProfile = C182T_OPERATING_PROFILE,
) -> AircraftConfig:
    return load_profile_linked_config(
        MODEL_PATH, profile, C182T_OPERATING_PROFILE.profile_id
    )


C182_CONFIG = load_c182_config()
