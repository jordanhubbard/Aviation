"""Explainable NOAA observation comparisons; never diagnose or replace a METAR."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import math
import re
from aviation.navigation import distance_nm, initial_bearing
from aviation.weather import flight_category
from app.services import aviation_sources as sources, ga_data

LIMITATIONS = [
    "Disagreement is a reason to investigate, not proof of a broken sensor or a replacement METAR.",
    "Local weather, fronts, terrain and coastal effects can cause legitimate differences.",
    "No conflict detected does not validate a report or establish safe flight conditions.",
    "Forecasts are context, not independent observed-station votes. Radar, satellite and sensor-health telemetry are not assessed.",
]
POLICY = dict(max_age_minutes=90, max_time_difference_minutes=45, future_tolerance_minutes=5,
              minimum_neighbors=3, minimum_ifr_neighbors=3, minimum_ifr_fraction=.75,
              nearest_ifr_within_nm=50, minimum_bearing_quadrants=2,
              maximum_elevation_difference_ft=1500, minimum_independent_distance_nm=2)
RANK = {"VFR": 0, "MVFR": 1, "IFR": 2, "LIFR": 3}


def number(value):
    if isinstance(value, bool): return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError): return None


def observation(row):
    """Normalize explicit AWC fields without filling missing observation facts."""
    visibility = row.get("visib")
    if isinstance(visibility, str):
        visibility = visibility.strip()
        match = re.fullmatch(r"((?:\d+(?:\.\d+)?|\.\d+))(\+)?", visibility)
        visibility = number(match[1]) if match else None
    else: visibility = number(visibility)
    if visibility is not None and visibility < 0: visibility = None
    clouds = row.get("clouds")
    ceilings = []
    if isinstance(clouds, list):
        for cloud in clouds:
            if not isinstance(cloud, dict): continue
            base = number(cloud.get("base"))
            if cloud.get("cover") in {"BKN", "OVC", "OVX", "VV"} and base is not None and base >= 0:
                ceilings.append(base)
    vv = number(row.get("vertVis"))
    if vv is not None and vv >= 0: ceilings.append(vv)
    ceiling = min(ceilings) if ceilings else None
    clear = row.get("cover") in {"CLR", "SKC", "CAVOK", "NSC"}
    if isinstance(clouds, list) and clouds:
        clear = all(isinstance(c, dict) and c.get("cover") in {"CLR", "SKC", "FEW", "SCT", "CAVOK", "NSC"} for c in clouds)
    # Common classification stays in aviation.weather. Missing inputs stay unknown;
    # an explicit provider category remains a source fact, not an invented ceiling.
    value = flight_category(visibility_sm=visibility, ceiling_ft=ceiling)
    derived = None if value == "UNKNOWN" else value
    reported = row.get("fltCat") if row.get("fltCat") in RANK else None
    category = reported or derived
    return dict(station_id=row.get("icaoId"), observed_at_epoch=number(row.get("obsTime")),
                category=category, reported_category=reported, category_from_fields=derived,
                visibility_sm=visibility, ceiling_ft=ceiling, no_ceiling_layer_reported=clear, elevation_m=number(row.get("elev")), original=row)


def evaluate(target, candidates, *, now=None, forecast=None, sources_metadata=None,
             errors=None, truncated=False, radius_nm=100):
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    errors = list(errors or [])
    result = dict(status="insufficient_evidence", station_id=target.get("icaoId") if target else None,
                  checked_at_utc=datetime.fromtimestamp(now, timezone.utc).isoformat(),
                  target=observation(target) if target else None, neighbors=[], flags=[], forecast_context=[],
                  qualifying_neighbors=0, ifr_neighbors=0, policy={**POLICY, "radius_nm": radius_nm},
                  source=sources_metadata or {}, errors=errors, truncated=truncated, limitations=LIMITATIONS)
    if not target:
        result["errors"].append("Target METAR is unavailable or absent")
        result["status"] = "unavailable"
        return result
    t = result["target"]
    def temporal(obs):
        stamp = obs["observed_at_epoch"]
        if stamp is None: return "observation_time_missing"
        if stamp > now + 300: return "observation_time_in_future"
        if now - stamp > 5400: return "observation_stale"
        return None
    invalid = temporal(t)
    if invalid:
        result["errors"].append("Target " + invalid)
        return result
    if t["category"] is None:
        result["errors"].append("Target flight category and sufficient ceiling/visibility evidence are missing")
        return result
    if t["reported_category"] and t["category_from_fields"] and t["category_from_fields"] != t["reported_category"]:
        result["flags"].append(dict(code="internally_inconsistent", explanation="Explicit ceiling/visibility fields contradict the reported flight category."))
    raw = target.get("rawOb") or ""
    # Markers are evidence to inspect, not a diagnosis of the affected equipment.
    remarks = raw.partition(" RMK ")[2]
    markers = re.findall(r"(?<!\S)(?:\$|VISNO|CHINO|CIGNO)(?!\S)", remarks)
    if markers:
        result["flags"].append(dict(code="maintenance_or_sensor_indicator", indicators=markers,
                                    explanation="Original METAR includes maintenance or ceiling/visibility sensor remarks; inspect the source."))
    seen = {t["station_id"]}; qualifying = []
    for candidate in candidates:
        row, station = candidate["report"], candidate["station"]
        obs = observation(row) if row else dict(station_id=station["station_id"], observed_at_epoch=None, category=None, original=None)
        obs.update(distance_nm=candidate["distance_nm"], bearing_degrees=candidate["bearing_degrees"], exclusion=None)
        if station["station_id"] in seen: obs["exclusion"] = "duplicate_station"
        elif obs["distance_nm"] < 2: obs["exclusion"] = "co_located_station"
        elif obs["distance_nm"] > radius_nm: obs["exclusion"] = "outside_radius"
        elif not row: obs["exclusion"] = "report_missing_or_unavailable"
        else:
            obs["exclusion"] = temporal(obs)
            if not obs["exclusion"] and abs(obs["observed_at_epoch"]-t["observed_at_epoch"]) > 2700: obs["exclusion"] = "observation_time_mismatch"
            if not obs["exclusion"] and obs.get("reported_category") and obs.get("category_from_fields") and obs["reported_category"] != obs["category_from_fields"]: obs["exclusion"] = "internally_inconsistent_report"
            if not obs["exclusion"] and obs["category"] is None: obs["exclusion"] = "category_unknown"
            elev = obs.get("elevation_m")
            if not obs["exclusion"] and (elev is None or t["elevation_m"] is None): obs["exclusion"] = "elevation_unknown"
            if not obs["exclusion"] and abs(elev-t["elevation_m"])*3.280839895 > 1500: obs["exclusion"] = "elevation_difference"
        seen.add(station["station_id"])
        result["neighbors"].append(obs)
        if not obs["exclusion"]: qualifying.append(obs)
    ifr = [o for o in qualifying if o["category"] in {"IFR", "LIFR"}]
    result.update(qualifying_neighbors=len(qualifying), ifr_neighbors=len(ifr))
    quadrants = {int(o["bearing_degrees"] // 90) % 4 for o in ifr}
    if (t["category"] == "VFR" and len(ifr) >= 3 and len(ifr)/len(qualifying) >= .75
        and min(o["distance_nm"] for o in ifr) <= 50 and len(quadrants) >= 2):
        result["flags"].append(dict(code="regional_disagreement", station_ids=[o["station_id"] for o in ifr],
                                    explanation="VFR target conflicts with at least three contemporaneous nearby IFR/LIFR observations across multiple directions."))
    if not isinstance(forecast, (list, type(None))):
        errors.append("Malformed TAF context")
        forecast = []
    for report in forecast or []:
        if not isinstance(report, dict) or not isinstance(report.get("fcsts", []), list):
            errors.append("Malformed TAF context")
            continue
        for period in report.get("fcsts") or []:
            if not isinstance(period, dict):
                errors.append("Malformed TAF period")
                continue
            start, end = number(period.get("timeFrom")), number(period.get("timeTo"))
            if start is None or end is None or not start <= t["observed_at_epoch"] < end: continue
            result["forecast_context"].append(dict(original_forecast=report.get("rawTAF"), period=period,
                                                   observed_votes=0, interpretation="Forecast context only; conditional/change periods are not observed facts."))
    if result["flags"]: result["status"] = "suspicious"
    elif len(qualifying) >= 3 and not errors: result["status"] = "no_conflict_detected"
    return result


def assessment(airport, radius_nm=100, max_neighbors=12):
    code = airport.upper()
    try:
        catalog, catalog_source = sources.station_catalog()
        by_id = {s.get("icaoId") or s["id"]: s for s in catalog}
        station = by_id.get(code)
        if not station:
            result = evaluate(None, [], errors=["Station is absent from the NOAA location catalog"])
            result["station_id"] = code
            return result
        lat, lon = float(station["lat"]), float(station["lon"])
        neighbors = []
        for key, other in by_id.items():
            if key == code or "METAR" not in other.get("siteType", []): continue
            dist = distance_nm(lat, lon, float(other["lat"]), float(other["lon"]))
            if dist <= radius_nm:
                neighbors.append(dict(station_id=key, distance_nm=dist,
                                      bearing_degrees=initial_bearing(lat, lon, float(other["lat"]), float(other["lon"]))))
        neighbors.sort(key=lambda n: (n["distance_nm"], n["station_id"]))
        count = len(neighbors); neighbors = neighbors[:max_neighbors]
        with ThreadPoolExecutor(max_workers=2) as pool:
            metar_future = pool.submit(sources.reports, "metar", [code]+[n["station_id"] for n in neighbors])
            taf_future = pool.submit(sources.reports, "taf", [code])
            metars = metar_future.result()
            errors = []
            try: tafs = taf_future.result()
            except ga_data.DataUnavailable:
                tafs = dict(reports=[], source=None); errors.append("Target TAF context unavailable")
        rows = {}; conflicts = set()
        for row in metars["reports"]:
            if not isinstance(row, dict): raise ga_data.DataUnavailable("Malformed METAR response")
            key = row.get("icaoId")
            if key not in {code, *(n["station_id"] for n in neighbors)}: raise ga_data.DataUnavailable("Unrequested station in METAR response")
            old = rows.get(key)
            stamp = number(row.get("obsTime")) or 0
            previous = (number(old.get("obsTime")) or 0) if old else -1
            if old is None or stamp > previous:
                rows[key] = row; conflicts.discard(key)
            elif stamp == previous and row != old:
                conflicts.add(key)
        for key in conflicts:
            rows.pop(key, None)
            errors.append("Conflicting duplicate METARs at the same observation time: " + key)
        result = evaluate(rows.get(code), [dict(station=n, report=rows.get(n["station_id"]),
                        distance_nm=n["distance_nm"], bearing_degrees=n["bearing_degrees"]) for n in neighbors],
                        forecast=tafs["reports"], errors=errors, truncated=count>max_neighbors,
                        radius_nm=radius_nm, sources_metadata=dict(metar=metars["source"], taf=tafs["source"], catalog=catalog_source))
        result["station_id"] = code
        return result
    except ga_data.DataUnavailable as exc:
        result = evaluate(None, [], errors=[str(exc)]); result["station_id"] = code
        return result
