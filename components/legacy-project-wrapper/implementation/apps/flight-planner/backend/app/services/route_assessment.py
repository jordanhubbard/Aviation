"""Sourced route assessment; common SDK owns geometry and linear applicability clipping."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import math
import json
import hashlib

from aviation import navigation as nav
from aviation.hazards import LatLon, segment_geometry_intervals, segments_geometry_intervals, linear_constraint_interval
from pyproj import CRS, Transformer
from pyproj.exceptions import ProjError
from shapely.errors import ShapelyError
from shapely.geometry import LineString, shape, mapping, box
from shapely import segmentize, get_coordinates
from shapely.ops import transform
from shapely.strtree import STRtree

from . import assessment_sources as sources, ga_data as data, terrain_service


class AssessmentError(ValueError):
    pass


def utc(value):
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value):
        result = datetime.fromtimestamp(value, timezone.utc)
    elif isinstance(value, str):
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("Unrecognized source time")
    if result.tzinfo is None:
        raise ValueError("UTC time requires a timezone")
    return result.astimezone(timezone.utc)


def numeric(value):
    if isinstance(value, bool) or value in (None, ""):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def route_samples(waypoints):
    if not 2 <= len(waypoints) <= 50:
        raise AssessmentError("Provide 2–50 timed waypoints")
    dense, distance = [], 0.0
    for index, point in enumerate(waypoints):
        try:
            at = utc(point["at"]).timestamp()
            lat, lon, altitude = point["lat"], point["lon"], point["altitude_ft_msl"]
            if (
                any(
                    isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v)
                    for v in [lat, lon, altitude]
                )
                or not -90 <= lat <= 90
                or not -180 <= lon <= 180
                or not -2000 <= altitude <= 60000
            ):
                raise ValueError()
            if index:
                previous = waypoints[index - 1]
                start_at = utc(previous["at"]).timestamp()
                duration = at - start_at
                if duration <= 0 or duration > 24 * 3600:
                    raise ValueError()
                a = (previous["lat"], previous["lon"])
                length = nav.distance_nm(*a, lat, lon)
                nav.project_point_to_segment_nm(*a, *a, lat, lon)
                if length < 0.001 or distance + length > 800:
                    raise ValueError()
                bearing, count = nav.initial_bearing(*a, lat, lon), math.ceil(length)
                for step in range(count):
                    fraction = step / count
                    p = nav.destination(*a, length * fraction, bearing)
                    dense.append(
                        {
                            "lat": p[0],
                            "lon": nav.normalize_longitude(p[1]),
                            "at": start_at + duration * fraction,
                            "altitude_ft_msl": previous["altitude_ft_msl"]
                            + (altitude - previous["altitude_ft_msl"]) * fraction,
                            "leg": index - 1,
                            "along_route_nm": distance + length * fraction,
                        }
                    )
                distance += length
        except (ValueError, TypeError, KeyError, OverflowError):
            raise AssessmentError(
                "Invalid route: use bounded coordinates/altitudes, increasing timezone-qualified times and distinct waypoints; maximum total distance is 800 NM"
            ) from None
    dense.append(
        {
            **waypoints[-1],
            "at": utc(waypoints[-1]["at"]).timestamp(),
            "leg": len(waypoints) - 2,
            "along_route_nm": distance,
        }
    )
    if dense[-1]["at"] - dense[0]["at"] > 24 * 3600:
        raise AssessmentError("Assessment duration exceeds 24 hours")
    return dense, distance


def bounds_for_route(dense, corridor_nm):
    # Provider envelopes include requested proximity; split the dateline explicitly.
    south, north = min(p["lat"] for p in dense), max(p["lat"] for p in dense)
    latitude_pad = (corridor_nm + 2) / 60
    south, north = max(-90, south - latitude_pad), min(90, north + latitude_pad)
    cos_lat = min(abs(math.cos(math.radians(south))), abs(math.cos(math.radians(north))))
    longitude_pad = min(180, (corridor_nm + 2) / (60 * max(0.001, cos_lat)))
    lons = [p["lon"] for p in dense]
    reference = lons[0]
    unwrapped = [reference + (lon - reference + 180) % 360 - 180 for lon in lons]
    west, east = min(unwrapped) - longitude_pad, max(unwrapped) + longitude_pad
    if east - west >= 360:
        return [(-180, south, 180, north)]
    while west < -180:
        west += 360
        east += 360
    while west >= 180:
        west -= 360
        east -= 360
    if east > 180:
        return [(west, south, 180, north), (-180, south, east - 360, north)]
    return [(west, south, east, north)]


def weather_candidate(row, product, source):
    notes, geometry = [], None
    coordinates = row.get("coords")
    if isinstance(coordinates, list):
        coords = [
            [numeric(p.get("lon")), numeric(p.get("lat"))]
            for p in coordinates
            if isinstance(p, dict)
        ]
        if (
            len(coords) == len(coordinates)
            and len(coords) >= 2
            and all(
                x is not None and y is not None and -180 <= x <= 180 and -90 <= y <= 90
                for x, y in coords
            )
        ):
            kind = row.get("geom") or row.get("geometryType")
            if product in {"airsigmet", "cwa"} and not kind and len(coords) >= 3:
                kind = "AREA"
                notes.append(
                    "Area inferred from the ordered advisory boundary; source geometry type was absent"
                )
            if row.get("geom") and row.get("geometryType") and row["geom"] != row["geometryType"]:
                notes.append("Provider geometry type fields disagree")
            if kind == "AREA" and len(coords) >= 3:
                geometry = {
                    "type": "Polygon",
                    "coordinates": [coords + ([] if coords[0] == coords[-1] else [coords[0]])],
                }
            elif kind == "LINE":
                geometry = {"type": "LineString", "coordinates": coords}
                notes.append("Source line has no verified affected-area width")
    window = None
    try:
        if product == "gairmet":
            t = utc(row["validTime"]).timestamp()
            window = (t, t)
            notes.append("G-AIRMET is a forecast snapshot, not a continuous validity interval")
        else:
            window = (utc(row["validTimeFrom"]).timestamp(), utc(row["validTimeTo"]).timestamp())
            if window[0] > window[1]:
                window = None
    except (KeyError, ValueError, TypeError, OverflowError):
        pass
    floor, ceiling = None, None
    explicit_msl = row.get("altitude_ft_msl")
    if isinstance(explicit_msl, dict):
        floor, ceiling = numeric(explicit_msl.get("min_ft_msl")), numeric(
            explicit_msl.get("max_ft_msl")
        )
        if floor is not None and floor < 0:
            floor = None
        if ceiling is not None and ceiling < 0:
            ceiling = None
        if floor is None or ceiling is None:
            notes.append(
                "Surface or variable freezing-level altitude bounds require interpretation"
            )
    else:
        notes.append(
            "Vertical applicability requires interpretation of original altitude references"
        )
    return {
        "id": f"{product}:{row.get('icaoId') or row.get('cwsu') or row.get('product','')}:{row.get('seriesId') or row.get('tag','')}:{row.get('validTime') or row.get('validTimeFrom','')}",
        "kind": product,
        "name": str(row.get("hazard") or product),
        "geometry": geometry,
        "window": window,
        "floor": floor,
        "ceiling": ceiling,
        "notes": notes,
        "source": source,
        "raw": row,
    }


def airspace_candidate(feature, source):
    p = feature["properties"]
    notes = []

    def bound(prefix):
        value = numeric(p.get(prefix + "_VAL"))
        if (
            p.get(prefix + "_UOM") == "FT"
            and p.get(prefix + "_CODE") == "MSL"
            and value is not None
        ):
            return value
        notes.append(prefix.lower() + " vertical reference requires interpretation")
        return None

    floor, ceiling = bound("LOWER"), bound("UPPER")
    if p.get("WKHR_CODE") not in {None, "", "H24"} or p.get("WKHR_RMK"):
        notes.append("Published operating hours require interpretation")
    if p.get("EXCLUSION") not in {None, "", "0", 0, False}:
        notes.append("Published airspace exclusion requires interpretation")
    return {
        "id": "airspace:" + str(p.get("GLOBAL_ID") or p.get("OBJECTID")),
        "kind": "airspace",
        "name": str(p.get("NAME") or p.get("IDENT") or "Class airspace"),
        "geometry": feature.get("geometry"),
        "window": None,
        "floor": floor,
        "ceiling": ceiling,
        "notes": notes,
        "source": source,
        "raw": p,
    }


def build_candidates(bundles, margin):
    candidates, unassessed = [], []
    for key, bundle in bundles.items():
        if bundle.get("status") == "unavailable":
            continue
        if key in {"gairmet", "airsigmet", "cwa"}:
            candidates.extend(
                weather_candidate(r, key, bundle["source"]) for r in bundle["reports"]
            )
        elif key.startswith("airspace:"):
            candidates.extend(airspace_candidate(f, bundle["source"]) for f in bundle["features"])
        elif key == "tfr":
            for item in bundle["records"]:
                summary = item["summary"]
                for i, feature in enumerate(item["areas"]):
                    candidates.append(
                        {
                            "id": f"tfr:{summary['notam_id']}:{i}",
                            "kind": "tfr",
                            "name": summary.get("description") or summary["notam_id"],
                            "geometry": feature.get("geometry"),
                            "window": None,
                            "floor": None,
                            "ceiling": None,
                            "notes": [
                                "Published TFR schedule and vertical limits require the complete source text"
                            ],
                            "source": bundle["sources"][0],
                            "raw": {
                                "summary": summary,
                                "geometry_properties": feature["properties"],
                            },
                        }
                    )
                if not item["areas"]:
                    unassessed.append(
                        {
                            "id": "tfr:" + summary["notam_id"],
                            "kind": "tfr",
                            "name": summary.get("description") or summary["notam_id"],
                            "reason": "No published geometry matched this listed restriction",
                            "source": bundle["sources"][0],
                        }
                    )
        elif key.startswith("obstacles:"):
            for feature in bundle["records"]:
                p = feature["properties"]
                elevation = numeric(p.get("AMSL"))
                notes = (
                    []
                    if elevation is not None
                    else ["Obstacle AMSL elevation is unknown; AGL is not substituted"]
                )
                candidates.append(
                    {
                        "id": "obstacle:" + str(p.get("OAS_Number") or p.get("OBJECTID")),
                        "kind": "obstacle",
                        "name": str(p.get("Type_Code") or "Obstacle").strip(),
                        "geometry": feature.get("geometry"),
                        "window": None,
                        "floor": None,
                        "ceiling": None if elevation is None else elevation + margin,
                        "notes": notes,
                        "source": bundle["source"],
                        "raw": p,
                    }
                )
    # The same object can occur in overlapping provider envelopes.
    return list({c["id"]: c for c in candidates}.values()), unassessed


def evaluate(dense, candidates, corridor_nm, *, limit=250):
    center = nav.midpoint(dense[0]["lat"], dense[0]["lon"], dense[-1]["lat"], dense[-1]["lon"])
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={center[0]} +lon_0={center[1]} +datum=WGS84 +units=m")
    forward = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    inverse = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
    lines = [
        LineString([forward(a["lon"], a["lat"]), forward(b["lon"], b["lat"])])
        for a, b in zip(dense, dense[1:])
    ]
    index = STRtree(lines)
    geographic_lines = []
    for a, b in zip(dense, dense[1:]):
        x = center[1] + nav.normalize_longitude(a["lon"] - center[1])
        y = center[1] + nav.normalize_longitude(b["lon"] - center[1])
        geographic_lines.append(
            box(-1e9, min(a["lat"], b["lat"]), 1e9, max(a["lat"], b["lat"]))
            if abs(x - y) >= 180
            else LineString([(x, a["lat"]), (y, b["lat"])])
        )
    geographic_index = STRtree(geographic_lines)
    findings, unassessed, total = [], [], 0
    route_floor = min(p["altitude_ft_msl"] for p in dense)
    route_ceiling = max(p["altitude_ft_msl"] for p in dense)
    for candidate in candidates:
        try:
            if candidate["geometry"] is None:
                raise ValueError("Source geometry is missing or unsupported")
            original = shape(candidate["geometry"])
            # Rebase longitudes for projection/topology validation; the common
            # interval operation still clips the preserved original geometry.
            normalized = transform(
                lambda x, y, z=None: (center[1] + nav.normalize_longitude(x - center[1]), y),
                original,
            )
            if normalized.is_empty or not normalized.is_valid:
                raise ValueError("Source geometry is empty or invalid")
            # Validate all source coordinates/rings once even if geographically
            # disjoint. Keep malformed sources explicit rather than pruning them.
            first = segment_geometry_intervals(
                LatLon(dense[0]["lat"], dense[0]["lon"]),
                LatLon(dense[1]["lat"], dense[1]["lon"]), candidate["geometry"],
            )
            if linear_constraint_interval(route_floor, route_ceiling, candidate["floor"], candidate["ceiling"]) is None:
                continue
            if candidate["window"] and candidate["kind"] != "gairmet" and linear_constraint_interval(
                dense[0]["at"], dense[-1]["at"], *candidate["window"]
            ) is None:
                continue
            min_x, min_y, max_x, max_y = normalized.bounds
            coordinates = get_coordinates(normalized)
            if any(abs(b - a) >= 180 for a, b in zip(coordinates[:-1, 0], coordinates[1:, 0])):
                min_x, max_x = -1e9, 1e9
            # Bounding boxes only: no projected or polygon-interior predicate.
            # This allowance exceeds the SDK's coordinate/edge roundoff tolerance.
            padding = 1e-6
            central_segments = set(int(i) for i in geographic_index.query(
                box(min_x - padding, min_y - padding, max_x + padding, max_y + padding)
            ))
            projected = transform(forward, segmentize(normalized, 0.1))
            if not all(math.isfinite(v) for v in projected.bounds):
                raise ValueError("Source geometry cannot be projected for this route")
            # Local AEQD corridor estimate with a visible conservative allowance.
            expanded = (
                projected.buffer((corridor_nm * 1.02 + 0.02) * 1852, quad_segs=12)
                if corridor_nm
                else projected
            )
            proximity = expanded.difference(projected) if corridor_nm else None
            proximity_geo = (
                mapping(transform(inverse, proximity))
                if proximity is not None and not proximity.is_empty
                else None
            )
            hits = []
            proximity_segments = (
                set(int(i) for i in index.query(expanded, predicate="intersects"))
                if corridor_nm
                else set()
            )
            def clip_segments(indices, geometry):
                ordered = sorted(indices)
                if not ordered:
                    return {}
                pairs = [(LatLon(dense[i]["lat"], dense[i]["lon"]),
                          LatLon(dense[i + 1]["lat"], dense[i + 1]["lon"])) for i in ordered]
                return dict(zip(ordered, segments_geometry_intervals(pairs, geometry), strict=True))

            central_results = clip_segments(central_segments - {0}, candidate["geometry"])
            if 0 in central_segments:
                central_results[0] = first
            proximity_results = clip_segments(proximity_segments, proximity_geo) if proximity_geo else {}
            # Projection is used only for the explicitly estimated corridor.
            # Every admitted centerline segment still uses exact SDK clipping.
            for segment_index in sorted(central_segments | proximity_segments):
                a, b = dense[segment_index], dense[segment_index + 1]
                central = central_results.get(segment_index, [])
                modes = [("centerline", central)]
                if segment_index in proximity_results:
                    modes.append(("proximity", proximity_results[segment_index]))
                for mode, intervals in modes:
                    for lo, hi in intervals:
                        notes = list(candidate["notes"])
                        if candidate["window"]:
                            t = linear_constraint_interval(a["at"], b["at"], *candidate["window"])
                            if t is None or max(lo, t[0]) > min(hi, t[1]):
                                if candidate["kind"] == "gairmet":
                                    notes.append(
                                        "Forecast snapshot does not establish conditions at encounter time"
                                    )
                                else:
                                    continue
                            else:
                                lo, hi = max(lo, t[0]), min(hi, t[1])
                        elif candidate["kind"] in {"airsigmet", "cwa"}:
                            notes.append("Valid time window is unknown")
                        vertical = linear_constraint_interval(
                            a["altitude_ft_msl"],
                            b["altitude_ft_msl"],
                            candidate["floor"],
                            candidate["ceiling"],
                        )
                        if vertical is None or max(lo, vertical[0]) > min(hi, vertical[1]):
                            continue
                        lo, hi = max(lo, vertical[0]), min(hi, vertical[1])

                        def at(t):
                            point = nav.destination(
                                a["lat"],
                                a["lon"],
                                nav.distance_nm(a["lat"], a["lon"], b["lat"], b["lon"]) * t,
                                nav.initial_bearing(a["lat"], a["lon"], b["lat"], b["lon"]),
                            )
                            return {
                                "lat": point[0],
                                "lon": nav.normalize_longitude(point[1]),
                                "at": datetime.fromtimestamp(
                                    a["at"] + (b["at"] - a["at"]) * t, timezone.utc
                                ).isoformat(),
                                "altitude_ft_msl": a["altitude_ft_msl"]
                                + (b["altitude_ft_msl"] - a["altitude_ft_msl"]) * t,
                                "along_route_nm": a["along_route_nm"]
                                + (b["along_route_nm"] - a["along_route_nm"]) * t,
                                "leg": a["leg"],
                            }

                        hit = {
                            "entry": at(lo),
                            "exit": at(hi),
                            "mode": mode,
                            "applicability": "possible" if notes else "intersects",
                            "uncertainties": notes,
                        }
                        if (
                            hits
                            and hits[-1]["mode"] == mode
                            and hits[-1]["applicability"] == hit["applicability"]
                            and hits[-1]["uncertainties"] == notes
                            and abs(
                                hits[-1]["exit"]["along_route_nm"] - hit["entry"]["along_route_nm"]
                            )
                            < 1e-6
                        ):
                            hits[-1]["exit"] = hit["exit"]
                        else:
                            hits.append(hit)
            merged = []
            for hit in sorted(
                hits,
                key=lambda h: (
                    h["mode"],
                    h["applicability"],
                    tuple(h["uncertainties"]),
                    h["entry"]["along_route_nm"],
                ),
            ):
                if (
                    merged
                    and all(
                        merged[-1][k] == hit[k] for k in ["mode", "applicability", "uncertainties"]
                    )
                    and abs(merged[-1]["exit"]["along_route_nm"] - hit["entry"]["along_route_nm"])
                    < 1e-6
                ):
                    merged[-1]["exit"] = hit["exit"]
                else:
                    merged.append(hit)
            for hit in merged:
                total += 1
                if len(findings) < limit or (hit["entry"]["along_route_nm"], candidate["id"]) < (
                    findings[-1]["entry"]["along_route_nm"],
                    findings[-1]["id"],
                ):
                    findings.append({**candidate, **hit})
                    findings.sort(key=lambda f: (f["entry"]["along_route_nm"], f["id"]))
                    del findings[limit:]
        except (
            ValueError,
            TypeError,
            KeyError,
            IndexError,
            OverflowError,
            ShapelyError,
            ProjError,
        ) as exc:
            unassessed.append(
                {
                    "id": candidate["id"],
                    "kind": candidate["kind"],
                    "name": candidate["name"],
                    "reason": str(exc),
                    "source": candidate["source"],
                }
            )
    findings.sort(key=lambda f: (f["entry"]["along_route_nm"], f["id"]))
    return findings, unassessed, total


def assess(waypoints, *, corridor_nm=5.0, clearance_margin_ft=1000.0):
    if (
        not math.isfinite(corridor_nm)
        or not 0 <= corridor_nm <= 25
        or not math.isfinite(clearance_margin_ft)
        or not 0 <= clearance_margin_ft <= 5000
    ):
        raise AssessmentError("Invalid corridor or terrain/obstacle clearance margin")
    dense, distance = route_samples(waypoints)
    bounds = bounds_for_route(dense, corridor_nm)
    operations = {
        p: (lambda p=p: sources.weather_advisories(p)) for p in ["gairmet", "airsigmet", "cwa"]
    }
    operations["tfr"] = sources.tfr_geometry
    for i, box in enumerate(bounds):
        operations[f"airspace:{i}"] = lambda box=box: data.airspace(*box)
        operations[f"obstacles:{i}"] = lambda box=box: sources.obstacles(box)
    stride = max(1, math.ceil((len(dense) - 1) / 200))
    terrain_route = dense[::stride]
    if terrain_route[-1] is not dense[-1]:
        terrain_route.append(dense[-1])

    def terrain():
        rows, source = terrain_service.profile_with_source(
            [(p["lat"], p["lon"]) for p in terrain_route]
        )
        return {"status": "available", "records": rows, "source": source}

    operations["terrain"] = terrain
    bundles = {}

    def run(name, op):
        try:
            return name, op()
        except (
            data.DataUnavailable,
            terrain_service.TerrainServiceError,
            ValueError,
            TypeError,
            KeyError,
        ) as error:
            return name, {"status": "unavailable", "error": str(error), "truncated": False}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run, k, op) for k, op in operations.items()]
        for future in as_completed(futures):
            name, result = future.result()
            bundles[name] = result
    # Stable provider order survives concurrent request completion.
    bundles = {k: bundles[k] for k in operations}
    candidates, unassessed = build_candidates(bundles, clearance_margin_ft)
    findings, geometry_failures, total = evaluate(dense, candidates, corridor_nm)
    unassessed.extend(geometry_failures)
    geometries, delivered, size = {}, [], 0
    for finding in findings:
        geometry_json = json.dumps(finding["geometry"], sort_keys=True, separators=(",", ":"))
        key = hashlib.sha256(geometry_json.encode()).hexdigest()
        record = {k: v for k, v in finding.items() if k != "geometry"}
        record["geometry_id"] = key
        added = len(json.dumps(record).encode()) + (
            len(geometry_json.encode()) if key not in geometries else 0
        )
        if size + added > 2_500_000:
            continue
        geometries[key] = finding["geometry"]
        delivered.append(record)
        size += added
    findings = delivered
    profile = []
    terrain_bundle = bundles["terrain"]
    if terrain_bundle.get("status") == "available":
        for point, row in zip(terrain_route, terrain_bundle["records"], strict=True):
            elevation = numeric(row[2])
            clearance = None if elevation is None else point["altitude_ft_msl"] - elevation
            profile.append(
                {
                    **point,
                    "at": datetime.fromtimestamp(point["at"], timezone.utc).isoformat(),
                    "elevation_ft_msl": elevation,
                    "clearance_ft": clearance,
                    "below_margin": None if clearance is None else clearance < clearance_margin_ft,
                }
            )
    coverage = []
    for name, bundle in bundles.items():
        status = bundle.get("status") or ("available" if bundle.get("features") else "no_records")
        coverage.append(
            {
                "name": name,
                "status": status,
                "sources": bundle.get("sources")
                or ([bundle["source"]] if bundle.get("source") else []),
                "truncated": bundle.get("truncated", False),
                "error": bundle.get("error"),
                "missing_geometry_ids": bundle.get("missing_geometry_ids", []),
                "limitations": bundle.get("limitations"),
            }
        )
    gaps = [
        "Full FAA NOTAM access is pending; this is not a complete NOTAM briefing.",
        "FAA class-airspace and DOF coverage is primarily US; neither is a complete worldwide airspace/obstacle inventory.",
        "Terrain is sampled; peaks and obstacles between samples are not bounded.",
        "Weather evidence covers only published validity windows or forecast snapshots; other planned times remain unknown.",
    ]
    if any(p["elevation_ft_msl"] is None for p in profile):
        gaps.append("Some terrain elevations are unknown.")
    return {
        "assessed_at_utc": datetime.now(timezone.utc).isoformat(),
        "route": waypoints,
        "route_geometry": {
            "type": "LineString",
            "coordinates": [[p["lon"], p["lat"]] for p in dense],
        },
        "distance_nm": distance,
        "corridor_nm": corridor_nm,
        "clearance_margin_ft": clearance_margin_ft,
        "findings": findings,
        "geometries": geometries,
        "total_findings": total,
        "findings_truncated": total > len(findings),
        "unassessed": unassessed[:250],
        "unassessed_count": len(unassessed),
        "terrain": profile,
        "terrain_source": terrain_bundle.get("source"),
        "sources": coverage,
        "coverage_gaps": gaps,
        "geometry_method": {
            "route_max_spacing_nm": 1,
            "terrain_max_spacing_nm": max(
                (
                    b["along_route_nm"] - a["along_route_nm"]
                    for a, b in zip(terrain_route, terrain_route[1:])
                ),
                default=0,
            ),
            "corridor": "Local azimuthal-equidistant buffer estimate, with 2% plus 0.02 NM conservative allowance; proximity differs from centerline contact.",
        },
        "limitations": "Planning reference only. Intersections describe supplied route assumptions and available source coverage; they do not establish clearance, legal authorization or safe flight.",
    }
