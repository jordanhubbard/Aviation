"""Provider-neutral aviation hazard semantics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import isfinite
import re
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class LatLon:
    lat: float
    lon: float


@dataclass(frozen=True)
class Hazard:
    id: str
    kind: str
    sub_type: str
    summary: str
    geometry: dict[str, Any]
    altitude_floor_ft: float | None
    altitude_ceiling_ft: float | None
    valid_from: datetime
    valid_to: datetime
    severity: str
    raw_text: str | None = None
    source_url: str | None = None


@dataclass(frozen=True)
class RouteHazardResult:
    hazard: Hazard
    leg_start_index: int


class HazardValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


_ISO_INSTANT = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$",
    re.IGNORECASE,
)
_EPSILON = 1e-10


def derive_severity(kind: str, sub_type: str) -> str:
    kind = kind.upper()
    upper = sub_type.upper()
    if kind == "SIGMET":
        return "warning" if "CONVECTIVE" in upper and "NON-CONVECTIVE" not in upper else "watch"
    if kind == "TFR":
        return "emergency" if "SECURITY" in upper or "SFRA" in upper else "advisory"
    return "watch"


def _instant(value: object, field: str) -> datetime:
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, str) and _ISO_INSTANT.fullmatch(value):
        try:
            result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise HazardValidationError(
                f"hazard-valid-{field}-invalid", "invalid instant"
            ) from error
    else:
        raise HazardValidationError(f"hazard-valid-{field}-invalid", "invalid instant")
    if result.tzinfo is None or result.utcoffset() is None:
        raise HazardValidationError(f"hazard-valid-{field}-invalid", "instant requires timezone")
    return result.astimezone(timezone.utc)


def _coordinate(value: Mapping[str, object]) -> LatLon:
    try:
        lat = float(value["lat"])
        lon = float(value["lon"])
    except (KeyError, TypeError, ValueError) as error:
        raise HazardValidationError("hazard-coordinate-invalid", "invalid coordinate") from error
    if not isfinite(lat) or not isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise HazardValidationError("hazard-coordinate-invalid", "invalid coordinate")
    return LatLon(lat, lon)


def _number_or_none(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise HazardValidationError("hazard-altitude-band-invalid", "invalid altitude")
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise HazardValidationError("hazard-altitude-band-invalid", "invalid altitude") from error
    if not isfinite(result) or result < 0:
        raise HazardValidationError("hazard-altitude-band-invalid", "invalid altitude")
    return result


def normalize_hazard_record(input_record: Mapping[str, object]) -> Hazard:
    identifier = str(input_record.get("id", "")).strip().upper()
    if not identifier:
        raise HazardValidationError("hazard-id-required", "hazard id is required")
    kind = str(input_record.get("kind", "")).strip().upper()
    if kind not in {"SIGMET", "AIRMET", "TFR"}:
        raise HazardValidationError("hazard-kind-invalid", "hazard kind is invalid")
    sub_type = str(input_record.get("subType", input_record.get("sub_type", ""))).strip().upper()
    if not sub_type:
        raise HazardValidationError("hazard-subtype-required", "hazard subtype is required")
    summary = str(input_record.get("summary", "")).strip()
    if not summary:
        raise HazardValidationError("hazard-summary-required", "hazard summary is required")

    raw_geometry = input_record.get("geometry")
    if not isinstance(raw_geometry, Mapping):
        raise HazardValidationError("hazard-geometry-invalid", "invalid geometry")
    geometry_type = raw_geometry.get("type")
    if geometry_type == "Point":
        raw_coordinate = raw_geometry.get("coordinate")
        if not isinstance(raw_coordinate, Mapping):
            raise HazardValidationError("hazard-geometry-invalid", "invalid point geometry")
        point = _coordinate(raw_coordinate)
        geometry: dict[str, Any] = {"type": "Point", "coordinate": point}
    elif geometry_type == "Polygon":
        raw_coordinates = raw_geometry.get("coordinates")
        if not isinstance(raw_coordinates, Sequence) or isinstance(raw_coordinates, (str, bytes)):
            raise HazardValidationError("hazard-geometry-invalid", "invalid polygon geometry")
        points = [_coordinate(value) for value in raw_coordinates if isinstance(value, Mapping)]
        if len(points) != len(raw_coordinates):
            raise HazardValidationError("hazard-coordinate-invalid", "invalid polygon coordinate")
        if len(points) > 1 and points[0] == points[-1]:
            points.pop()
        if len(points) < 3 or len(set(points)) < 3:
            raise HazardValidationError(
                "hazard-polygon-invalid", "polygon requires three distinct vertices"
            )
        geometry = {"type": "Polygon", "coordinates": tuple(points)}
    else:
        raise HazardValidationError("hazard-geometry-invalid", "invalid geometry")

    raw_band = input_record.get("altitudeBandFt", input_record.get("altitude_band_ft"))
    if not isinstance(raw_band, Mapping):
        raise HazardValidationError("hazard-altitude-band-invalid", "invalid altitude band")
    floor = _number_or_none(raw_band.get("floor"))
    ceiling = _number_or_none(raw_band.get("ceiling"))
    if floor is not None and ceiling is not None and floor > ceiling:
        raise HazardValidationError("hazard-altitude-band-invalid", "inverted altitude band")
    valid_from = _instant(input_record.get("validFrom", input_record.get("valid_from")), "from")
    valid_to = _instant(input_record.get("validTo", input_record.get("valid_to")), "to")
    if valid_from > valid_to:
        raise HazardValidationError("hazard-effective-window-invalid", "inverted effective window")
    raw_text = input_record.get("rawText", input_record.get("raw_text"))
    source_url = input_record.get("sourceUrl", input_record.get("source_url"))
    return Hazard(
        identifier,
        kind,
        sub_type,
        summary,
        geometry,
        floor,
        ceiling,
        valid_from,
        valid_to,
        derive_severity(kind, sub_type),
        None if raw_text is None else str(raw_text).strip(),
        None if source_url is None else str(source_url).strip(),
    )


def is_hazard_active(hazard: Hazard, at: datetime) -> bool:
    instant = _instant(at, "from")
    return hazard.valid_from <= instant <= hazard.valid_to


def altitude_overlaps(hazard: Hazard, route_floor_ft: float, route_ceiling_ft: float) -> bool:
    if route_floor_ft > route_ceiling_ft:
        return False
    floor = hazard.altitude_floor_ft if hazard.altitude_floor_ft is not None else 0
    ceiling = hazard.altitude_ceiling_ft if hazard.altitude_ceiling_ft is not None else 60_000
    return floor <= route_ceiling_ft and ceiling >= route_floor_ft


def _orientation(a: LatLon, b: LatLon, c: LatLon) -> float:
    return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon)


def _point_on_segment(point: LatLon, start: LatLon, end: LatLon) -> bool:
    return abs(_orientation(start, end, point)) <= _EPSILON and (
        min(start.lon, end.lon) - _EPSILON <= point.lon <= max(start.lon, end.lon) + _EPSILON
        and min(start.lat, end.lat) - _EPSILON <= point.lat <= max(start.lat, end.lat) + _EPSILON
    )


def _segments_intersect(a: LatLon, b: LatLon, c: LatLon, d: LatLon) -> bool:
    if any(
        (
            _point_on_segment(a, c, d),
            _point_on_segment(b, c, d),
            _point_on_segment(c, a, b),
            _point_on_segment(d, a, b),
        )
    ):
        return True
    o1, o2, o3, o4 = (
        _orientation(a, b, c),
        _orientation(a, b, d),
        _orientation(c, d, a),
        _orientation(c, d, b),
    )
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)


def point_in_polygon(point: LatLon, polygon: Sequence[LatLon]) -> bool:
    return _polygon_contains(point, polygon, _point_on_segment)


def _polygon_contains(point: LatLon, polygon: Sequence[LatLon], on_segment) -> bool:
    for index, start in enumerate(polygon):
        if on_segment(point, start, polygon[(index + 1) % len(polygon)]):
            return True
    inside = False
    previous = polygon[-1]
    for current in polygon:
        if (current.lat > point.lat) != (previous.lat > point.lat) and point.lon < (
            previous.lon - current.lon
        ) * (point.lat - current.lat) / (previous.lat - current.lat) + current.lon:
            inside = not inside
        previous = current
    return inside


def hazard_intersects_leg(
    hazard: Hazard,
    leg_start: LatLon,
    leg_end: LatLon,
    route_floor_ft: float,
    route_ceiling_ft: float,
    at: datetime,
) -> bool:
    if not altitude_overlaps(hazard, route_floor_ft, route_ceiling_ft) or not is_hazard_active(
        hazard, at
    ):
        return False
    if hazard.geometry["type"] == "Point":
        return _point_on_segment(hazard.geometry["coordinate"], leg_start, leg_end)
    polygon = hazard.geometry["coordinates"]
    if point_in_polygon(leg_start, polygon) or point_in_polygon(leg_end, polygon):
        return True
    return any(
        _segments_intersect(leg_start, leg_end, point, polygon[(index + 1) % len(polygon)])
        for index, point in enumerate(polygon)
    )


def find_route_hazards_in_band(
    waypoints: Sequence[LatLon],
    route_floor_ft: float,
    route_ceiling_ft: float,
    hazards: Sequence[Hazard],
    at: datetime,
) -> list[RouteHazardResult]:
    return [
        RouteHazardResult(hazard, index)
        for index in range(len(waypoints) - 1)
        for hazard in hazards
        if hazard_intersects_leg(
            hazard, waypoints[index], waypoints[index + 1], route_floor_ft, route_ceiling_ft, at
        )
    ]


def find_route_hazards(
    waypoints: Sequence[LatLon], cruise_alt_ft: float, hazards: Sequence[Hazard], at: datetime
) -> list[RouteHazardResult]:
    return find_route_hazards_in_band(
        waypoints, cruise_alt_ft - 500, cruise_alt_ft + 500, hazards, at
    )


def linear_constraint_interval(
    start: float, end: float, lower: float | None, upper: float | None
) -> list[float] | None:
    """Inclusive fractions where a finite linear value satisfies explicit limits."""
    values = [start, end, *([] if lower is None else [lower]), *([] if upper is None else [upper])]
    if any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not isfinite(v) for v in values
    ) or (lower is not None and upper is not None and lower > upper):
        raise HazardValidationError("hazard-constraint-invalid", "Invalid linear constraint")
    if start == end:
        return (
            [0.0, 1.0]
            if (lower is None or start >= lower) and (upper is None or start <= upper)
            else None
        )
    lo, hi = 0.0, 1.0
    for bound, minimum in [(lower, True), (upper, False)]:
        if bound is None:
            continue
        delta = end - start
        fraction = (
            (bound - start) / delta
            if isfinite(delta)
            else (bound / 2 - start / 2) / (end / 2 - start / 2)
        )
        if minimum == (end > start):
            lo = max(lo, fraction)
        else:
            hi = min(hi, fraction)
    return [lo, hi] if lo <= hi else None


def segment_geometry_intervals(
    start: LatLon, end: LatLon, geometry: Mapping[str, Any]
) -> list[list[float]]:
    """Planar GeoJSON clipping, preserving holes and shortest-longitude unwrapping."""
    if any(
        isinstance(v, bool) or not isinstance(v, (int, float))
        for p in (start, end)
        for v in (p.lat, p.lon)
    ):
        raise HazardValidationError("hazard-coordinate-invalid", "Invalid endpoint coordinate")
    start = _coordinate({"lat": start.lat, "lon": start.lon})
    end = _coordinate({"lat": end.lat, "lon": end.lon})
    raw_delta = end.lon - start.lon
    delta = raw_delta if -180 <= raw_delta < 180 else (raw_delta + 180) % 360 - 180
    invalid = lambda: HazardValidationError(
        "hazard-geometry-invalid", "Invalid or excessive interval geometry"
    )
    if abs(delta) == 180:
        raise invalid()
    a, b = start, LatLon(end.lat, start.lon + delta)
    anchor = (a.lon + b.lon) / 2
    budget = [50000]
    node_budget = [50000]

    def position(raw, near=anchor):
        if (
            not isinstance(raw, (list, tuple))
            or len(raw) < 2
            or any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in raw[:2])
        ):
            raise invalid()
        try:
            p = _coordinate({"lat": raw[1], "lon": raw[0]})
        except HazardValidationError:
            raise invalid() from None
        budget[0] -= 1
        if budget[0] < 0:
            raise invalid()
        return LatLon(
            p.lat, p.lon if -180 <= p.lon - near < 180 else near + (p.lon - near + 180) % 360 - 180
        )

    def points(raw, ring=False):
        if not isinstance(raw, (list, tuple)) or not raw:
            raise invalid()
        result, near = [], anchor
        for value in raw:
            p = position(value, near)
            result.append(p)
            near = p.lon
        if ring:
            if (
                abs(result[0].lat - result[-1].lat) > _EPSILON
                or abs(result[0].lon - result[-1].lon) > _EPSILON
            ):
                raise invalid()
            result.pop()
            if len(set(result)) < 3:
                raise invalid()
        elif len(result) < 2:
            raise invalid()
        return result

    def on_segment(p, c, d):
        length = ((d.lon - c.lon) ** 2 + (d.lat - c.lat) ** 2) ** 0.5
        if length == 0:
            return abs(p.lon - c.lon) <= _EPSILON and abs(p.lat - c.lat) <= _EPSILON
        return (
            abs(_orientation(c, d, p)) <= _EPSILON * length
            and min(c.lon, d.lon) - _EPSILON <= p.lon <= max(c.lon, d.lon) + _EPSILON
            and min(c.lat, d.lat) - _EPSILON <= p.lat <= max(c.lat, d.lat) + _EPSILON
        )

    def parameter(p):
        dx, dy = b.lon - a.lon, b.lat - a.lat
        length2 = dx * dx + dy * dy
        if length2 == 0:
            return (
                0.0 if abs(p.lon - a.lon) <= _EPSILON and abs(p.lat - a.lat) <= _EPSILON else None
            )
        t = ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / length2
        if -_EPSILON <= t <= 1 + _EPSILON and on_segment(p, a, b):
            return min(1.0, max(0.0, t))
        return None

    def edge(c, d):
        rx, ry, sx, sy = b.lon - a.lon, b.lat - a.lat, d.lon - c.lon, d.lat - c.lat
        denominator = rx * sy - ry * sx
        if abs(denominator) <= 1e-14 * (rx * rx + ry * ry) ** 0.5 * (sx * sx + sy * sy) ** 0.5:
            if (
                abs(_orientation(a, b, c)) > _EPSILON * (rx * rx + ry * ry) ** 0.5
                or abs(_orientation(a, b, d)) > _EPSILON * (rx * rx + ry * ry) ** 0.5
            ):
                return []
            if rx == 0 and ry == 0:
                return [[0.0, 1.0]] if on_segment(a, c, d) else []
            length2 = rx * rx + ry * ry
            ts = [((p.lon - a.lon) * rx + (p.lat - a.lat) * ry) / length2 for p in (c, d)]
            lo, hi = max(0.0, min(ts)), min(1.0, max(ts))
            return [[lo, hi]] if lo <= hi else []
        qx, qy = c.lon - a.lon, c.lat - a.lat
        t, u = (qx * sy - qy * sx) / denominator, (qx * ry - qy * rx) / denominator
        if -_EPSILON <= t <= 1 + _EPSILON and -_EPSILON <= u <= 1 + _EPSILON:
            t = min(1.0, max(0.0, t))
            return [[t, t]]
        return []

    def polygon(raw):
        if not isinstance(raw, (list, tuple)) or not raw:
            raise invalid()
        rings = [points(r, True) for r in raw]
        contacts = [
            interval
            for ring in rings
            for c, d in zip(ring, ring[1:] + ring[:1])
            for interval in edge(c, d)
        ]
        cuts = sorted({0.0, 1.0, *(v for interval in contacts for v in interval)})
        intervals = contacts[:]
        for lo, hi in zip(cuts, cuts[1:]):
            t = (lo + hi) / 2
            p = LatLon(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t)
            boundary = any(
                on_segment(p, c, d) for ring in rings for c, d in zip(ring, ring[1:] + ring[:1])
            )
            if boundary or (
                _polygon_contains(p, rings[0], on_segment)
                and not any(_polygon_contains(p, hole, on_segment) for hole in rings[1:])
            ):
                intervals.append([lo, hi])
        return intervals

    def visit(value, depth=0):
        node_budget[0] -= 1
        if depth > 16 or node_budget[0] < 0 or not isinstance(value, Mapping):
            raise invalid()
        kind, raw = value.get("type"), value.get("coordinates")
        if kind == "Point":
            t = parameter(position(raw))
            return [] if t is None else [[0.0, 1.0] if a == b else [t, t]]
        if kind == "LineString":
            line = points(raw)
            return [i for c, d in zip(line, line[1:]) for i in edge(c, d)]
        if kind == "Polygon":
            return polygon(raw)
        subtype = {
            "MultiPoint": "Point",
            "MultiLineString": "LineString",
            "MultiPolygon": "Polygon",
        }.get(kind)
        if subtype:
            if not isinstance(raw, (list, tuple)):
                raise invalid()
            return [
                i for item in raw for i in visit({"type": subtype, "coordinates": item}, depth + 1)
            ]
        if kind == "GeometryCollection":
            items = value.get("geometries")
            if not isinstance(items, (list, tuple)):
                raise invalid()
            return [i for item in items for i in visit(item, depth + 1)]
        raise invalid()

    intervals = sorted(visit(geometry))
    result = []
    for lo, hi in intervals:
        if result and lo <= result[-1][1] + _EPSILON:
            result[-1][1] = max(result[-1][1], hi)
        else:
            result.append([lo, hi])
    return result
