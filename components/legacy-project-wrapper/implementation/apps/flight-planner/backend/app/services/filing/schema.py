"""ICAO fields accepted by the published Leidos Flight Service contract."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Literal
import re

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StrictFloat,
    field_validator,
)

Action = Literal["file", "amend", "activate", "cancel", "close"]
State = Literal["PROPOSED", "ACTIVE", "OVERDUE", "CLOSED", "CANCELLED", "UNDEFINED"]
SCHEMA_SHA256 = "1adb3b5b1c25124ac7e868db09700d121164f898d68bac0bd7645cc34ae57c4b"
VERSION = "20240724"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Plan(Strict):
    flight_rules: Literal["VFR", "IFR"] | None = None
    aircraft_identifier: str | None = Field(default=None, pattern=r"^[A-Z0-9]{2,7}$")
    aircraft_type: str | None = Field(default=None, pattern=r"^[A-Z][A-Z0-9]{1,3}$")
    departure: str | None = Field(default=None, pattern=r"^[A-Z0-9]{2,12}$")
    destination: str | None = Field(default=None, pattern=r"^[A-Z0-9]{2,12}$")
    departure_lat_long: str | None = None
    destination_lat_long: str | None = None
    departure_instant: AwareDatetime | None = None
    flight_duration_minutes: StrictInt | None = Field(default=None, ge=0, le=5999)
    estimated_arrival: AwareDatetime | None = None
    route: str | None = Field(default=None, min_length=2, max_length=558)
    alternate1: str | None = Field(default=None, pattern=r"^[A-Z0-9]{2,12}$")
    alternate2: str | None = Field(default=None, pattern=r"^[A-Z0-9]{2,12}$")
    other_info: str | None = Field(default=None, max_length=600, pattern=r"^[a-zA-Z0-9/\s.]*$")
    aircraft_equipment: str | None = Field(default=None, pattern=r"^[A-Z1-9]{1,64}$")
    surveillance_equipment: str | None = Field(default=None, pattern=r"^[A-Z1-9]{1,25}$")
    number_of_aircraft: StrictInt | None = Field(default=None, ge=1, le=99)
    wake_turbulence: Literal["LIGHT", "MEDIUM", "HEAVY"] | None = None
    speed_knots: StrictInt | None = Field(default=None, ge=1, le=3700)
    speed_mach: StrictFloat | None = Field(default=None, gt=0, le=5, multiple_of=0.01)
    altitude_type: Literal["F", "S", "A", "M", "VFR", "VFRFL"] | None = None
    altitude_value: StrictInt | None = Field(default=None, ge=0, le=9999)
    fuel_minutes: StrictInt | None = Field(default=None, ge=1, le=5999)
    people_on_board: str | None = Field(default=None, pattern=r"^[0-9a-zA-Z\\ ]{1,30}$")
    people_unknown: StrictBool = False
    aircraft_color: str | None = Field(default=None, max_length=500, pattern=r"^[0-9a-zA-Z: ]*$")
    pilot_data: str | None = Field(default=None, max_length=200)
    pilot_in_command: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9: ]{1,201}$")
    type_of_flight: Literal["S", "N", "G", "M", "X"] | None = None
    radios: str | None = Field(default=None, pattern=r"^[A-Z]{1,3}$")
    survival: str | None = Field(default=None, pattern=r"^[A-Z]{1,4}$")
    jackets: str | None = Field(default=None, pattern=r"^[A-Z]{1,4}$")
    number_of_dinghies: StrictInt | None = Field(default=None, ge=0, le=99)
    capacity_of_dinghies: StrictInt | None = Field(default=None, ge=0, le=999)
    color_of_dinghies: str | None = Field(default=None, pattern=r"^[A-Z ]{1,20}$")
    covered_dinghies: StrictBool | None = None
    supplemental_remarks: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9: ]{1,500}$")

    @field_validator("departure_lat_long", "destination_lat_long")
    @classmethod
    def coordinates(cls, value):
        if value is None:
            return value
        match = re.fullmatch(r"(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])", value)
        if not match:
            raise ValueError("Use DDMMNDDDMME coordinates")
        lat, lm, _, lon, om, _ = match.groups()
        lat, lm, lon, om = map(int, [lat, lm, lon, om])
        if lat > 90 or lon > 180 or lm > 59 or om > 59 or lat == 90 and lm or lon == 180 and om:
            raise ValueError("Coordinates outside geographic bounds")
        return value

    @field_validator(
        "route",
        "pilot_data",
        "other_info",
        "aircraft_color",
        "color_of_dinghies",
        "supplemental_remarks",
    )
    @classmethod
    def text(cls, value):
        if value is not None and any(ord(c) < 32 and c not in "\n\r\t" for c in value):
            raise ValueError("Unsupported control character")
        return value


class Issue(Strict):
    field: str
    message: str


class Validation(Strict):
    format_valid: bool
    issues: list[Issue]
    warnings: list[str]
    provider_eligibility: Literal["not_checked"] = "not_checked"


REQUIRED = [
    "flight_rules",
    "aircraft_identifier",
    "aircraft_type",
    "departure",
    "destination",
    "departure_instant",
    "flight_duration_minutes",
    "route",
    "aircraft_equipment",
    "surveillance_equipment",
    "fuel_minutes",
    "pilot_data",
]


def validate(plan: Plan, *, now: datetime | None = None) -> Validation:
    issues = []

    def problem(field, message):
        issues.append(Issue(field=field, message=message))

    for field in REQUIRED:
        if (
            getattr(plan, field) is None
            or isinstance(getattr(plan, field), str)
            and not getattr(plan, field).strip()
        ):
            problem(field, "Required for an ICAO filing")
    if (plan.speed_knots is None) == (plan.speed_mach is None):
        problem("speed", "Provide exactly one speed in knots or Mach")
    if plan.altitude_type is None:
        problem("altitude_type", "Select an altitude type and units")
    elif plan.altitude_type == "VFR":
        if plan.altitude_value is not None:
            problem("altitude_value", "Non-specific VFR altitude has no numeric value")
    elif plan.altitude_value is None:
        problem("altitude_value", "An altitude value is required")
    elif plan.altitude_type in {"A", "F", "VFRFL"} and not 1 <= plan.altitude_value <= 999:
        problem("altitude_value", "Use 1–999 hundreds of feet for this altitude type")
    if plan.flight_rules == "IFR" and plan.altitude_type in {"VFR", "VFRFL"}:
        problem("altitude_type", "An IFR plan requires an explicit IFR altitude type")
    if not plan.people_unknown and not (plan.people_on_board or "").strip():
        problem("people_on_board", "Provide persons on board or explicitly select to be notified")
    if plan.people_unknown and plan.people_on_board is not None:
        problem("people_on_board", "Choose an explicit value or to-be-notified, not both")
    if plan.flight_duration_minutes == 0:
        if plan.flight_rules != "VFR" or not plan.estimated_arrival or not plan.departure_instant:
            problem(
                "flight_duration_minutes",
                "Zero duration requires a VFR extended-ETA plan and explicit arrival time",
            )
        elif (
            not timedelta(hours=100)
            <= plan.estimated_arrival - plan.departure_instant
            <= timedelta(days=27)
        ):
            problem(
                "estimated_arrival", "Extended ETA must be 100 hours to 27 days after departure"
            )
    elif plan.estimated_arrival is not None:
        problem(
            "estimated_arrival",
            "Explicit arrival time is reserved for a zero-duration extended-ETA plan",
        )
    return Validation(
        format_valid=not issues,
        issues=issues,
        warnings=[
            "Format validation does not establish provider acceptance, pilot authorization, aircraft suitability or a complete briefing.",
            "Verify aircraft equipment, current fuel, pilot details and applicable rules before confirming an action.",
        ],
    )


WIRE = {
    "flight_rules": "flightRules",
    "aircraft_identifier": "aircraftIdentifier",
    "aircraft_type": "aircraftType",
    "departure": "departure",
    "destination": "destination",
    "departure_lat_long": "departureLatLong",
    "destination_lat_long": "destinationLatLong",
    "departure_instant": "departureInstant",
    "flight_duration_minutes": "flightDuration",
    "estimated_arrival": "estimatedTimeOfArrival",
    "route": "route",
    "alternate1": "altDestination1",
    "alternate2": "altDestination2",
    "other_info": "otherInfo",
    "aircraft_equipment": "aircraftEquipment",
    "surveillance_equipment": "surveillanceEquipment",
    "number_of_aircraft": "numberOfAircraft",
    "wake_turbulence": "wakeTurbulence",
    "speed_knots": "speedKnots",
    "speed_mach": "speedMach",
    "fuel_minutes": "fuelOnBoard",
    "people_on_board": "peopleOnBoardExtended",
    "people_unknown": "peopleOnBoardIsTBN",
    "aircraft_color": "aircraftColorExtended",
    "pilot_data": "pilotData",
    "pilot_in_command": "pilotInCommandExtended",
    "type_of_flight": "typeOfFlight",
    "radios": "radios",
    "survival": "survival",
    "jackets": "jackets",
    "number_of_dinghies": "numberOfDinghies",
    "capacity_of_dinghies": "capacityOfDinghies",
    "color_of_dinghies": "colorOfDinghies",
    "covered_dinghies": "coveredDinghies",
    "supplemental_remarks": "suppRemarksExtended",
}


def instant(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def form(plan: Plan) -> dict[str, str]:
    result = {"type": "ICAO", "versionRequested": VERSION, "includeCodedMessages": "true"}
    for key, name in WIRE.items():
        value = getattr(plan, key)
        if value is None:
            continue
        if isinstance(value, datetime):
            value = instant(value)
        elif key in {"flight_duration_minutes", "fuel_minutes"}:
            value = f"PT{value//60}H{value%60}M"
        elif isinstance(value, bool):
            value = str(value).lower()
        elif key == "speed_mach":
            value = f"{value:.2f}"
        else:
            value = str(value)
        result[name] = value
    if plan.altitude_type:
        name = (
            "altitudeVFRFL"
            if plan.altitude_type == "VFRFL"
            else (
                "altitudeVFR"
                if plan.altitude_type == "VFR"
                else "altitudeType" + plan.altitude_type
            )
        )
        result[name] = (
            ""
            if plan.altitude_type == "VFR"
            else str(plan.altitude_value) if plan.altitude_value is not None else ""
        )
    return result


def amendment(before: Plan, after: Plan) -> dict[str, str]:
    old, new = form(before), form(after)
    result = {"type": "ICAO", "versionRequested": VERSION, "includeCodedMessages": "true"}
    changed = {k: v for k, v in new.items() if old.get(k) != v and k not in result}
    choices = {
        "speedKnots",
        "speedMach",
        "altitudeTypeF",
        "altitudeTypeS",
        "altitudeTypeA",
        "altitudeTypeM",
        "altitudeVFR",
        "altitudeVFRFL",
    }
    for key in old.keys() - new.keys():
        if key not in result and key not in choices:
            changed[key] = ""
    result.update(changed)
    return result
