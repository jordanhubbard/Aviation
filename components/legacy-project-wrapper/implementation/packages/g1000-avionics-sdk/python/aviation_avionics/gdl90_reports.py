"""Portable decoded-report records; host transport metadata stays separate."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ReportHeader:
    message_id: int
    payload_hex: str


@dataclass(frozen=True)
class HeartbeatReport(ReportHeader):
    kind: Literal["heartbeat"]
    gps_position_valid: bool
    utc_valid: bool
    seconds_since_midnight: int | None
    status_byte_1: int
    status_byte_2: int
    message_counts_raw: int


@dataclass(frozen=True)
class TrafficReport(ReportHeader):
    kind: Literal["traffic", "ownship"]
    participant_address: str
    address_type: int
    alert_status: int
    position_valid: bool
    latitude_deg: float | None
    longitude_deg: float | None
    pressure_altitude_ft: int | None
    horizontal_speed_kt: int | None
    horizontal_speed_at_least_kt: int | None
    horizontal_speed_saturated: bool
    vertical_speed_fpm: int | None
    vertical_speed_bound_fpm: int | None
    vertical_speed_saturated: bool
    angle_deg: float | None
    angle_reference: Literal["true_track", "magnetic_heading", "true_heading"] | None
    nic: int
    nacp: int
    airborne: bool
    extrapolated: bool
    emitter_category: int
    callsign: str
    emergency_code: int


@dataclass(frozen=True)
class GeometricAltitudeReport(ReportHeader):
    kind: Literal["geometric_altitude"]
    geometric_altitude_ft: int
    datum: Literal["WGS84_ellipsoid", "MSL"] | None
    datum_source: Literal["gdl90_standard", "foreflight_device_id", "unknown_receiver_profile"]
    vertical_warning: bool
    vertical_figure_of_merit_m: int | None
    vertical_figure_of_merit_lower_bound: bool


@dataclass(frozen=True)
class DeviceIdReport(ReportHeader):
    kind: Literal["device_id"]
    version: Literal[1]
    serial_number_hex: str | None
    device_name: str
    device_long_name: str
    capabilities_mask: int
    geometric_altitude_datum: Literal["WGS84_ellipsoid", "MSL"]
    internet_policy: Literal["unrestricted", "expensive", "disallowed"] | None
    reserved_capabilities_mask: int


@dataclass(frozen=True)
class FisbTextRecord:
    product_id: Literal[413]
    raw_text: str
    report_type: str
    location_id: str
    report_time: str
    body: str


@dataclass(frozen=True)
class UplinkReport(ReportHeader):
    kind: Literal["uplink"]
    time_of_reception_ns: int | None
    application_data_valid: bool
    records: list[FisbTextRecord]
    unsupported_frames: int
    unsupported_products: list[int]
    errors: list[str]


@dataclass(frozen=True)
class FisbTextReport(ReportHeader, FisbTextRecord):
    kind: Literal["fisb_text"]
    product_age_seconds: None
    validity: Literal["unassessed"]


@dataclass(frozen=True)
class UnsupportedReport(ReportHeader):
    kind: Literal["unsupported"]
    supported: Literal[False]


Gdl90Report = (
    HeartbeatReport
    | TrafficReport
    | GeometricAltitudeReport
    | DeviceIdReport
    | UnsupportedReport
    | UplinkReport
    | FisbTextReport
)
