from aviation_avionics import (
    AudioPanelState,
    MarkerBeaconSite,
    MarkerBeaconStatus,
    compute_marker_beacons as compute_sdk_marker_beacons,
)


MARKER_MAX_ALTITUDE_FT = 2500.0

# The portable SDK owns marker geometry. This simulator-owned catalog remains an
# explicit input so applications can supply current or scenario-specific sites.
DEFAULT_MARKER_SITES: tuple[MarkerBeaconSite, ...] = (
    MarkerBeaconSite(
        name="SFO",
        latitude_deg=37.6190,
        longitude_deg=-122.3738,
        outer_radius_nm=4.0,
        middle_radius_nm=1.0,
        inner_radius_nm=0.35,
        altitude_limit_ft=MARKER_MAX_ALTITUDE_FT,
    ),
    MarkerBeaconSite(
        name="SJC",
        latitude_deg=37.3626,
        longitude_deg=-121.9290,
        outer_radius_nm=4.0,
        middle_radius_nm=1.0,
        inner_radius_nm=0.35,
        altitude_limit_ft=MARKER_MAX_ALTITUDE_FT,
    ),
)


def compute_marker_beacons(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    sites: tuple[MarkerBeaconSite, ...] = DEFAULT_MARKER_SITES,
) -> MarkerBeaconStatus:
    return compute_sdk_marker_beacons(latitude_deg, longitude_deg, altitude_ft, sites)
