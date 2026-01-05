from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, timedelta, timezone
import logging
import math
import time
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, HTTPException

from app.models.airport import get_airport_coordinates, load_airport_cache
from app.schemas.route import RouteLeg, RouteRequest, RouteResponse, Segment
from app.services import a_star
from app.services.alternates import recommend_alternates
from app.services import open_meteo
from app.services.planning_runtime import (
    PlanningCancelled,
    PlanningCapacityError,
    PlanningContext,
    PlanningTimeout,
    planning_capacity,
    planning_external_workers,
    planning_phase_timeout_s,
    planning_total_timeout_s,
)
from app.services import terrain_service
from app.services import wind
from app.services.xctry_route_planner import (
    RouteSegment,
    get_leg_sample_points,
    haversine_nm,
    plan_route,
)


router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/route",
    response_model=RouteResponse,
    summary="Plan a route",
    description="Direct route planning endpoint. For a unified entrypoint, use `POST /api/plan`.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "origin": "KSFO",
                        "destination": "KLAX",
                        "speed": 110,
                        "speed_unit": "knots",
                        "altitude": 5500,
                        "avoid_airspaces": False,
                        "avoid_terrain": False,
                        "apply_wind": True,
                    }
                }
            }
        }
    },
)
def calculate_route(req: RouteRequest) -> RouteResponse:
    """Plan a route between two airports."""
    ctx = PlanningContext(deadline_s=time.perf_counter() + planning_total_timeout_s())
    try:
        with planning_capacity():
            return calculate_route_internal(req, ctx=ctx)
    except PlanningCapacityError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PlanningTimeout as e:
        raise HTTPException(status_code=504, detail=str(e))
    except PlanningCancelled:
        raise HTTPException(status_code=499, detail="Client disconnected")


def _build_segments(planned_segments) -> List[Segment]:
    segments: List[Segment] = []
    prev_alt: Optional[int] = None
    for idx, seg in enumerate(planned_segments):
        seg_type: Literal["climb", "cruise", "descent"] = "cruise"
        if idx == 0:
            seg_type = "climb"
        if idx == len(planned_segments) - 1:
            seg_type = "descent" if len(planned_segments) > 1 else seg_type

        # When terrain avoidance adjusts altitudes mid-route, reflect those steps as climb/descent segments.
        if 0 < idx < (len(planned_segments) - 1) and prev_alt is not None:
            if seg.vfr_altitude_ft > prev_alt:
                seg_type = "climb"
            elif seg.vfr_altitude_ft < prev_alt:
                seg_type = "descent"

        prev_alt = int(seg.vfr_altitude_ft)

        segments.append(
            Segment(
                start=seg.start,
                end=seg.end,
                type=seg_type,
                vfr_altitude=seg.vfr_altitude_ft,
            )
        )
    return segments


def calculate_route_internal(
    req: RouteRequest, *, ctx: Optional[PlanningContext] = None
) -> RouteResponse:
    """Internal route planning implementation with optional progress/cancellation support."""
    t_total = time.perf_counter()
    timings: dict[str, float] = {}

    if ctx is None:
        ctx = PlanningContext(deadline_s=time.perf_counter() + planning_total_timeout_s())

    planned_at_utc = datetime.now(timezone.utc)
    departure_time_utc = planned_at_utc

    phase_timeout_s = planning_phase_timeout_s()

    def _mark(key: str, t0: float) -> None:
        timings[key] = round(time.perf_counter() - t0, 4)

    def _round_up_ft(value_ft: float, *, step_ft: int = 500) -> int:
        if step_ft <= 0:
            return int(round(value_ft))
        return int(math.ceil(float(value_ft) / float(step_ft)) * step_ft)

    ctx.emit_progress(phase="start", message="Starting route planning", percent=0.0)
    ctx.check_deadline()

    t0 = time.perf_counter()
    origin = get_airport_coordinates(req.origin)
    dest = get_airport_coordinates(req.destination)
    _mark("airport_lookup", t0)
    if not origin or not dest:
        raise HTTPException(status_code=400, detail="Invalid origin or destination code")

    ctx.emit_progress(phase="airport_lookup", message="Airports resolved", percent=0.05)
    ctx.check_deadline()
    ctx.check_cancelled()

    o_lat = origin["latitude"]
    o_lon = origin["longitude"]
    d_lat = dest["latitude"]
    d_lon = dest["longitude"]

    speed_kt = req.speed if req.speed_unit == "knots" else req.speed * 0.868976

    route_codes = [req.origin.upper(), req.destination.upper()]
    if req.plan_fuel_stops or req.aircraft_range_nm is not None:
        t0 = time.perf_counter()
        ctx.emit_progress(phase="fuel_stops", message="Searching fuel stops", percent=0.12)
        ctx.check_deadline()
        ctx.check_cancelled()

        max_leg = None
        if req.aircraft_range_nm is not None:
            max_leg = float(req.aircraft_range_nm)
        elif req.plan_fuel_stops:
            if req.fuel_on_board_gal is None or req.fuel_burn_gph is None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Fuel stop planning requires fuel_on_board_gal and fuel_burn_gph (or aircraft_range_nm)"
                    ),
                )

            gph = float(req.fuel_burn_gph)
            reserve_fuel = gph * (float(req.reserve_minutes) / 60.0)
            usable = float(req.fuel_on_board_gal) - reserve_fuel
            if usable <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Fuel on board ({req.fuel_on_board_gal} gal) must exceed reserve fuel ({reserve_fuel:.1f} gal)"
                    ),
                )

            # Still-air max distance for a leg.
            max_leg = usable * (speed_kt / gph)

        if max_leg is None or max_leg <= 0:
            raise HTTPException(status_code=400, detail="max leg distance must be > 0")

        max_leg = min(float(max_leg), float(req.max_leg_distance))

        candidates = []
        for ap in load_airport_cache():
            icao = str(ap.get("icao") or "").upper()
            iata = str(ap.get("iata") or "").upper()
            code = icao or iata
            if not code:
                continue
            lat = ap.get("latitude")
            lon = ap.get("longitude")
            if lat is None or lon is None:
                continue
            candidates.append(a_star.AirportNode(code=code, lat=float(lat), lon=float(lon)))

        try:
            per_leg_penalty = 0.0
            if req.fuel_strategy == "economy":
                per_leg_penalty = 25.0

            route_codes = a_star.find_route(
                origin=a_star.AirportNode(
                    code=req.origin.upper(), lat=float(o_lat), lon=float(o_lon)
                ),
                destination=a_star.AirportNode(
                    code=req.destination.upper(), lat=float(d_lat), lon=float(d_lon)
                ),
                candidates=candidates,
                max_leg_distance_nm=max_leg,
                per_leg_penalty_nm=per_leg_penalty,
            )
        except a_star.AStarError as e:
            raise HTTPException(status_code=400, detail=str(e))

        _mark("fuel_stop_search", t0)
        ctx.emit_progress(phase="fuel_stops", message="Fuel stop search complete", percent=0.18)
        ctx.check_deadline()
        ctx.check_cancelled()

    planned_legs: List[dict[str, Any]] = []

    try:
        t0 = time.perf_counter()
        points: List[tuple[float, float]] = []
        planned_segments: List[Any] = []
        fuel_stop_codes = {c.upper() for c in (route_codes[1:-1] or [])}

        total_legs = max(1, len(route_codes) - 1)
        for i in range(total_legs):
            ctx.check_deadline()
            ctx.check_cancelled()
            ctx.emit_progress(
                phase="route_geometry",
                message=f"Planning leg {i + 1}/{total_legs}",
                percent=0.2 + (0.4 * ((i + 1) / total_legs)),
            )

            a_code = route_codes[i]
            b_code = route_codes[i + 1]
            a_ap = get_airport_coordinates(a_code)
            b_ap = get_airport_coordinates(b_code)
            if not a_ap or not b_ap:
                raise HTTPException(status_code=400, detail="Invalid waypoint code")

            leg_points, leg_segments = plan_route(
                origin=(float(a_ap["latitude"]), float(a_ap["longitude"])),
                destination=(float(b_ap["latitude"]), float(b_ap["longitude"])),
                cruising_altitude_ft=req.altitude,
                avoid_airspaces_enabled=req.avoid_airspaces,
            )

            leg_dist_nm = 0.0
            for j in range(len(leg_points) - 1):
                leg_dist_nm += haversine_nm(
                    leg_points[j][0],
                    leg_points[j][1],
                    leg_points[j + 1][0],
                    leg_points[j + 1][1],
                )

            planned_legs.append(
                {
                    "from_code": a_code,
                    "to_code": b_code,
                    "distance_nm": leg_dist_nm,
                    "track_deg": wind.bearing_deg(
                        (float(a_ap["latitude"]), float(a_ap["longitude"])),
                        (float(b_ap["latitude"]), float(b_ap["longitude"])),
                    ),
                    "fuel_stop": b_code.upper() in fuel_stop_codes,
                }
            )

            if not points:
                points = list(leg_points)
            else:
                points.extend(list(leg_points)[1:])

            planned_segments.extend(list(leg_segments))

            # Emit partial plan so the UI can draw the route incrementally.
            if total_legs > 1:
                dist_nm = 0.0
                for j in range(len(points) - 1):
                    dist_nm += haversine_nm(
                        points[j][0], points[j][1], points[j + 1][0], points[j + 1][1]
                    )

                time_hr = round(dist_nm / speed_kt, 2) if speed_kt else 0.0
                partial = RouteResponse(
                    planned_at_utc=planned_at_utc,
                    departure_time_utc=departure_time_utc,
                    arrival_time_utc=departure_time_utc + timedelta(hours=float(time_hr)),
                    route=route_codes,
                    distance_nm=round(dist_nm, 1),
                    time_hr=time_hr,
                    origin_coords=(o_lat, o_lon),
                    destination_coords=(d_lat, d_lon),
                    segments=_build_segments(planned_segments),
                    alternates=None,
                    fuel_stops=route_codes[1:-1] or None,
                )
                ctx.emit_partial_plan(phase="route_geometry", plan=partial.model_dump(mode="json"))
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Airspace data file not found ({e}). Populate backend/data/airspaces_us.json or set AIRSPACES_FILE."
            ),
        )

    _mark("route_geometry", t0)
    ctx.emit_progress(phase="route_geometry", message="Route geometry complete", percent=0.6)
    ctx.check_deadline()
    ctx.check_cancelled()

    total_dist = 0.0
    for i in range(len(points) - 1):
        total_dist += haversine_nm(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    segments = _build_segments(planned_segments)
    time_hr = round(total_dist / speed_kt, 2) if speed_kt else 0.0
    ctx.emit_partial_plan(
        phase="route_geometry",
        plan=RouteResponse(
            planned_at_utc=planned_at_utc,
            departure_time_utc=departure_time_utc,
            arrival_time_utc=departure_time_utc + timedelta(hours=float(time_hr)),
            route=route_codes,
            distance_nm=round(total_dist, 1),
            time_hr=time_hr,
            origin_coords=(o_lat, o_lon),
            destination_coords=(d_lat, d_lon),
            segments=segments,
            alternates=None,
            fuel_stops=route_codes[1:-1] or None,
        ).model_dump(mode="json"),
    )

    wind_speed_kt = None
    wind_direction_deg = None
    headwind_kt = None
    crosswind_kt = None
    groundspeed_kt = None

    effective_speed_kt = speed_kt

    alternates = None

    legs: Optional[List[RouteLeg]] = None

    def _terrain_check() -> None:
        nonlocal planned_segments, segments
        if not req.avoid_terrain:
            return

        if not planned_segments:
            return

        # Sample each segment and ensure we stay 1000 ft above the highest terrain on that segment.
        # We treat req.altitude as the baseline "cruise" altitude and only increase it when necessary.
        flat_points: List[tuple[float, float]] = []
        seg_slices: List[tuple[int, int]] = []

        for seg in planned_segments:
            pts = get_leg_sample_points(
                seg.start[0], seg.start[1], seg.end[0], seg.end[1], interval_nm=10
            )
            seg_slices.append((len(flat_points), len(pts)))
            flat_points.extend(pts)

        prof = terrain_service.elevation_profile(flat_points)
        elevs = [elev_ft for _lat, _lon, elev_ft in prof]
        if len(elevs) < len(flat_points):
            elevs.extend([None] * (len(flat_points) - len(elevs)))

        adjusted: List[RouteSegment] = []
        for seg, (start, n) in zip(planned_segments, seg_slices, strict=False):
            max_elev_ft: Optional[float] = None
            for elev_ft in elevs[start : start + n]:
                if elev_ft is None:
                    continue
                if max_elev_ft is None or elev_ft > max_elev_ft:
                    max_elev_ft = float(elev_ft)

            min_safe_alt_ft = (max_elev_ft + 1000.0) if max_elev_ft is not None else None
            target_alt_ft = float(req.altitude)
            if min_safe_alt_ft is not None:
                target_alt_ft = max(target_alt_ft, float(min_safe_alt_ft))

            target_alt_rounded = _round_up_ft(target_alt_ft, step_ft=500)
            adjusted.append(
                RouteSegment(
                    start=seg.start,
                    end=seg.end,
                    segment_type=seg.segment_type,
                    vfr_altitude_ft=target_alt_rounded,
                )
            )

        planned_segments = adjusted
        segments = _build_segments(planned_segments)

    def _wind_fetch() -> None:
        nonlocal wind_speed_kt, wind_direction_deg, headwind_kt, crosswind_kt, groundspeed_kt, effective_speed_kt
        if not req.apply_wind or not points:
            return
        mid = points[len(points) // 2]
        cw = open_meteo.get_current_weather(lat=float(mid[0]), lon=float(mid[1]))
        w_speed = cw.get("windspeed")
        w_dir = cw.get("winddirection")
        if w_speed is None or w_dir is None:
            return
        wind_speed_kt = float(w_speed)
        wind_direction_deg = int(w_dir)
        track = wind.bearing_deg((float(o_lat), float(o_lon)), (float(d_lat), float(d_lon)))
        head, cross = wind.wind_components_kt(
            track_deg=track,
            wind_from_deg=float(wind_direction_deg),
            wind_speed_kt=wind_speed_kt,
        )
        headwind_kt = round(head, 1)
        crosswind_kt = round(cross, 1)
        effective_speed_kt = max(30.0, speed_kt - head)
        groundspeed_kt = round(effective_speed_kt, 1)

    def _alternates() -> None:
        nonlocal alternates
        if not req.include_alternates:
            return
        out = recommend_alternates(
            destination_lat=float(d_lat),
            destination_lon=float(d_lon),
            exclude_codes=route_codes,
        )
        alternates = out or None

    if req.avoid_terrain or req.apply_wind or req.include_alternates:
        ctx.emit_progress(
            phase="enrichment", message="Computing terrain/wind/alternates", percent=0.65
        )

    with ThreadPoolExecutor(max_workers=planning_external_workers()) as ex:
        futures = {}
        if req.avoid_terrain:
            t0 = time.perf_counter()
            futures["terrain"] = (t0, ex.submit(_terrain_check))
        if req.apply_wind:
            t0 = time.perf_counter()
            futures["wind"] = (t0, ex.submit(_wind_fetch))
        if req.include_alternates:
            t0 = time.perf_counter()
            futures["alternates"] = (t0, ex.submit(_alternates))

        for name, (t0, fut) in futures.items():
            ctx.check_deadline()
            ctx.check_cancelled()

            remaining = None
            if ctx.deadline_s is not None:
                remaining = max(0.0, ctx.deadline_s - time.perf_counter())
            timeout = phase_timeout_s
            if remaining is not None:
                timeout = min(timeout, remaining)

            ok = True
            try:
                fut.result(timeout=timeout)
            except TimeoutError:
                ok = False
                fut.cancel()
                if name == "terrain":
                    raise PlanningTimeout("Planning step timed out")
            except HTTPException:
                raise
            except terrain_service.TerrainServiceError as e:
                ok = False
                if name == "terrain":
                    raise HTTPException(status_code=503, detail=str(e))
            except PlanningTimeout:
                raise
            except Exception:
                ok = False
                if name == "terrain":
                    raise HTTPException(status_code=503, detail="Terrain service error")
            finally:
                _mark(f"{name}_fetch", t0)

            if name == "terrain":
                ctx.emit_progress(
                    phase="terrain",
                    message="Terrain check complete" if ok else "Terrain check skipped",
                    percent=0.75,
                )
            elif name == "wind":
                ctx.emit_progress(
                    phase="wind",
                    message="Wind fetch complete" if ok else "Wind fetch skipped",
                    percent=0.8,
                )
            elif name == "alternates":
                ctx.emit_progress(
                    phase="alternates",
                    message="Alternates computed" if ok else "Alternates skipped",
                    percent=0.9,
                )

    total_time = total_dist / effective_speed_kt if effective_speed_kt else 0.0
    arrival_time_utc = departure_time_utc + timedelta(hours=float(total_time))

    if planned_legs:
        REFUEL_MINUTES = 30
        elapsed = 0.0
        legs_out: List[RouteLeg] = []

        has_wind = (
            req.apply_wind
            and wind_speed_kt is not None
            and wind_direction_deg is not None
            and float(wind_speed_kt) >= 0
        )

        use_segment_legs = bool(req.avoid_terrain) and (len(route_codes) == 2) and bool(segments)

        if use_segment_legs:
            point_labels: List[str] = [route_codes[0].upper()]
            for i in range(1, len(segments)):
                point_labels.append(f"WP{i}")
            point_labels.append(route_codes[-1].upper())

            for idx, seg in enumerate(segments):
                dist_nm = float(haversine_nm(seg.start[0], seg.start[1], seg.end[0], seg.end[1]))
                track_deg = float(wind.bearing_deg(seg.start, seg.end))

                gs = float(speed_kt)
                if has_wind:
                    head, _cross = wind.wind_components_kt(
                        track_deg=track_deg,
                        wind_from_deg=float(wind_direction_deg),
                        wind_speed_kt=float(wind_speed_kt),
                    )
                    gs = max(30.0, float(speed_kt) - head)

                ete_min = (dist_nm / gs) * 60.0 if gs > 0 else 0.0
                elapsed += ete_min

                arrive_leg_time_utc = departure_time_utc + timedelta(minutes=float(elapsed))
                depart_leg_time_utc = arrive_leg_time_utc - timedelta(minutes=float(ete_min))

                legs_out.append(
                    RouteLeg(
                        from_code=point_labels[idx],
                        to_code=point_labels[idx + 1],
                        distance_nm=round(dist_nm, 1),
                        groundspeed_kt=round(gs, 1),
                        ete_minutes=round(ete_min, 1),
                        depart_time_utc=depart_leg_time_utc,
                        arrive_time_utc=arrive_leg_time_utc,
                        type=seg.type,
                        vfr_altitude=seg.vfr_altitude,
                        refuel_minutes=0,
                        elapsed_minutes=round(elapsed, 1),
                        fuel_stop=False,
                    )
                )
        else:
            for leg in planned_legs:
                dist_nm = float(leg.get("distance_nm") or 0.0)
                track_deg = float(leg.get("track_deg") or 0.0)

                gs = float(speed_kt)
                if has_wind:
                    head, _cross = wind.wind_components_kt(
                        track_deg=track_deg,
                        wind_from_deg=float(wind_direction_deg),
                        wind_speed_kt=float(wind_speed_kt),
                    )
                    gs = max(30.0, float(speed_kt) - head)

                ete_min = (dist_nm / gs) * 60.0 if gs > 0 else 0.0
                elapsed += ete_min

                arrive_leg_time_utc = departure_time_utc + timedelta(minutes=float(elapsed))
                depart_leg_time_utc = arrive_leg_time_utc - timedelta(minutes=float(ete_min))

                fuel_stop = bool(leg.get("fuel_stop"))
                refuel = REFUEL_MINUTES if fuel_stop else 0

                legs_out.append(
                    RouteLeg(
                        from_code=str(leg.get("from_code") or ""),
                        to_code=str(leg.get("to_code") or ""),
                        distance_nm=round(dist_nm, 1),
                        groundspeed_kt=round(gs, 1),
                        ete_minutes=round(ete_min, 1),
                        depart_time_utc=depart_leg_time_utc,
                        arrive_time_utc=arrive_leg_time_utc,
                        refuel_minutes=refuel,
                        elapsed_minutes=round(elapsed, 1),
                        fuel_stop=fuel_stop,
                    )
                )

                if fuel_stop:
                    elapsed += float(REFUEL_MINUTES)

        legs = legs_out
        if legs_out:
            arrival_time_utc = departure_time_utc + timedelta(
                minutes=float(legs_out[-1].elapsed_minutes)
            )

    fuel_burn = None
    reserve_minutes = None
    fuel_required = None
    fuel_required_with_reserve = None

    if req.plan_fuel_stops or req.fuel_burn_gph is not None:
        fuel_burn = float(req.fuel_burn_gph) if req.fuel_burn_gph is not None else 10.0
        reserve_minutes = int(req.reserve_minutes)
        fuel_required = total_time * fuel_burn
        fuel_required_with_reserve = fuel_required + fuel_burn * (reserve_minutes / 60.0)

    timings["total"] = round(time.perf_counter() - t_total, 4)
    logger.info(
        "route.calculate_route timing origin=%s destination=%s points=%s segments=%s avoid_airspaces=%s avoid_terrain=%s include_alternates=%s timings=%s",
        req.origin,
        req.destination,
        len(points),
        len(planned_segments),
        bool(req.avoid_airspaces),
        bool(req.avoid_terrain),
        bool(req.include_alternates),
        timings,
    )

    resp = RouteResponse(
        planned_at_utc=planned_at_utc,
        departure_time_utc=departure_time_utc,
        arrival_time_utc=arrival_time_utc,
        route=route_codes,
        distance_nm=round(total_dist, 1),
        time_hr=round(total_time, 2),
        origin_coords=(o_lat, o_lon),
        destination_coords=(d_lat, d_lon),
        segments=segments,
        legs=legs,
        alternates=alternates,
        fuel_stops=route_codes[1:-1] or None,
        fuel_burn_gph=fuel_burn,
        reserve_minutes=reserve_minutes,
        fuel_required_gal=round(fuel_required, 2) if fuel_required is not None else None,
        fuel_required_with_reserve_gal=(
            round(fuel_required_with_reserve, 2) if fuel_required_with_reserve is not None else None
        ),
        wind_speed_kt=wind_speed_kt,
        wind_direction_deg=wind_direction_deg,
        headwind_kt=headwind_kt,
        crosswind_kt=crosswind_kt,
        groundspeed_kt=groundspeed_kt,
    )

    ctx.emit_partial_plan(phase="complete", plan=resp.model_dump(mode="json"))
    ctx.emit_progress(phase="complete", message="Planning complete", percent=1.0)
    return resp
