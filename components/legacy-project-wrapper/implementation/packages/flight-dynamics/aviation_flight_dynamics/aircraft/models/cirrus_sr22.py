from pathlib import Path

from aviation.aircraft import (
    AircraftOperatingProfile,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
)

from ..aircraft_model import AircraftConfig
from ._profile_linked import load_profile_linked_config

MODEL_PATH = Path(__file__).with_suffix(".yaml")


def load_sr22_config(
    profile: AircraftOperatingProfile = SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
) -> AircraftConfig:
    return load_profile_linked_config(
        MODEL_PATH, profile, SR22_PERSPECTIVE_3600_OPERATING_PROFILE.profile_id
    )


SR22_CONFIG = load_sr22_config()
