from pathlib import Path

from aviation.aircraft import AircraftOperatingProfile, C172S_OPERATING_PROFILE

from ..aircraft_model import AircraftConfig
from ._profile_linked import load_profile_linked_config

MODEL_PATH = Path(__file__).with_suffix(".yaml")


def load_c172_config(
    profile: AircraftOperatingProfile = C172S_OPERATING_PROFILE,
) -> AircraftConfig:
    return load_profile_linked_config(
        MODEL_PATH, profile, C172S_OPERATING_PROFILE.profile_id
    )


C172_CONFIG = load_c172_config()
