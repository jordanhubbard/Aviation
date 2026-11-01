"""G1000 compatibility adapter for the common Aviation radio models."""

from __future__ import annotations

from aviation.nav_data import sample_nav_data_catalog
from aviation_avionics import (
    AdfSolution,
    AdfStation,
    DmeSolution,
    DmeStation,
    compute_adf as compute_common_adf,
    compute_dme as compute_common_dme,
    great_circle_distance_nm,
    initial_bearing_deg,
    normalize_signed_angle,
)


def calculate_vor_radial(course: float, radial: float) -> float:
    """Compatibility course deviation, using the SDK's signed-angle convention."""
    return normalize_signed_angle(course - radial)


def calculate_ils_localizer(localizer_course: float, aircraft_track: float) -> float:
    """Legacy track/course difference; this is not a positional ILS beam solution."""
    return normalize_signed_angle(aircraft_track - localizer_course)


def calculate_adf_bearing(
    navaid_lat: float, navaid_lon: float, aircraft_lat: float, aircraft_lon: float
) -> float:
    return initial_bearing_deg(aircraft_lat, aircraft_lon, navaid_lat, navaid_lon)


def calculate_dme_range(
    navaid_lat: float, navaid_lon: float, aircraft_lat: float, aircraft_lon: float
) -> float:
    """Legacy ground range in NM; compute_dme supplies the actual slant-range model."""
    return great_circle_distance_nm(aircraft_lat, aircraft_lon, navaid_lat, navaid_lon)


# Synthetic training beacon paired with the SDK sample catalog. It is deliberately
# not presented as current operational navigation data.
DEFAULT_ADF_STATIONS = (
    AdfStation(
        station_ident="SDK",
        station_name="SDK Bay Area Training NDB",
        frequency_khz=350.0,
        latitude_deg=37.6190,
        longitude_deg=-122.3750,
        max_range_nm=75.0,
    ),
)


def _sample_dme_stations() -> tuple[DmeStation, ...]:
    stations = []
    for record in sample_nav_data_catalog().navaids:
        frequency = record.get("frequency")
        if frequency is None or record["type"] not in {"DME", "VORDME", "VORTAC"}:
            continue
        stations.append(
            DmeStation(
                station_ident=record["identifier"],
                station_name=record.get("name") or record["identifier"],
                frequency_mhz=frequency,
                latitude_deg=record["latitude"],
                longitude_deg=record["longitude"],
                elevation_ft=0.0,
                max_range_nm=130.0,
            )
        )
    return tuple(stations)


DEFAULT_DME_STATIONS = _sample_dme_stations()
DEFAULT_ADF_FREQUENCY_KHZ = DEFAULT_ADF_STATIONS[0].frequency_khz
DEFAULT_DME_FREQUENCY_MHZ = DEFAULT_DME_STATIONS[0].frequency_mhz


def compute_adf(
    latitude_deg: float,
    longitude_deg: float,
    heading_deg: float,
    tuned_frequency_khz: float,
) -> AdfSolution:
    return compute_common_adf(
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        heading_deg=heading_deg,
        tuned_frequency_khz=tuned_frequency_khz,
        stations=DEFAULT_ADF_STATIONS,
    )


def compute_dme(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    track_deg: float,
    ground_speed_kt: float,
    tuned_frequency_mhz: float,
) -> DmeSolution:
    return compute_common_dme(
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        altitude_ft=altitude_ft,
        track_deg=track_deg,
        ground_speed_kt=ground_speed_kt,
        tuned_frequency_mhz=tuned_frequency_mhz,
        stations=DEFAULT_DME_STATIONS,
    )
