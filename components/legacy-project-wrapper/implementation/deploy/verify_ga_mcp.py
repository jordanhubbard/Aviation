#!/usr/bin/env python3
"""Read-only domain qualification of the public Aviation MCP and HTTP API.

No application records are saved. Provider data remains external; calculation
inputs are explicitly synthetic. Exits nonzero on any required capability gap.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://meta-app.jordanhubbard.net")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--expected-revision")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    checks = []

    def http(path, body=None, headers=None):
        request = Request(base + path, data=body, headers=headers or {})
        try:
            response = urlopen(request, timeout=90)
        except HTTPError as exc:
            response = exc
        with response:
            raw = response.read(8 * 1024 * 1024 + 1)
            assert len(raw) <= 8 * 1024 * 1024, "Response exceeds audit limit"
            return response.status, dict(response.headers), raw

    def rpc(method, params=None):
        status, headers, raw = http(
            "/mcp",
            json.dumps(
                {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}
            ).encode(),
            {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        )
        assert status == 200, (method, status)
        text = raw.decode()
        if not text.lstrip().startswith("{"):
            text = "\n".join(line[6:] for line in text.splitlines() if line.startswith("data: "))
        result = json.loads(text)
        assert "error" not in result, result
        return result["result"]

    def planning(path, body=None, expected=200):
        call_args = {"path": path, "method": "GET" if body is None else "POST"}
        if body is not None:
            call_args.update(body=json.dumps(body), headers={"Content-Type": "application/json"})
        result = rpc("tools/call", {"name": "v1.planning.request", "arguments": call_args})
        value = result.get("structuredContent") or json.loads(result["content"][0]["text"])
        assert value["status"] == expected, (path, value["status"], value["body"][:400])
        assert bool(result.get("isError")) == (expected >= 400)
        raw = (
            value["body"].encode()
            if value["bodyEncoding"] == "utf8"
            else base64.b64decode(value["body"])
        )
        if value["headers"].get("content-encoding") == "gzip":
            raw = gzip.decompress(raw)
        return json.loads(raw)

    def check(name, operation, validate):
        try:
            value = operation()
            validate(value)
            raw = json.dumps(value, sort_keys=True).encode()
            checks.append(
                {
                    "name": name,
                    "passed": True,
                    "bytes": len(raw),
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "source": value.get("source") if isinstance(value, dict) else None,
                }
            )
            print("PASS", name, flush=True)
            return value
        except Exception as exc:
            checks.append({"name": name, "passed": False, "error": str(exc)})
            print("FAIL", name, str(exc), flush=True)
            return None

    def require(condition, message):
        assert condition, message

    check(
        "MCP initialize",
        lambda: rpc(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "aviation-ga-domain-audit", "version": "1.0"},
            },
        ),
        lambda r: require(r["serverInfo"]["name"] == "aviation-edge", "Unexpected server"),
    )
    check(
        "Discover domain schema tool",
        lambda: rpc("tools/list"),
        lambda r: require(
            "v1.planning.describe" in {t["name"] for t in r["tools"]}, "Describe tool missing"
        ),
    )
    schema = check(
        "Discover complete planner operation schemas",
        lambda: json.loads(
            rpc("tools/call", {"name": "v1.planning.describe", "arguments": {}})["content"][0][
                "text"
            ]
        ),
        lambda r: require(
            all(
                p in r["paths"]
                for p in [
                    "/api/aircraft",
                    "/api/performance",
                    "/api/performance/weight-balance",
                    "/api/navlog",
                    "/api/map/{layer}",
                    "/api/airports/{code}/details",
                    "/api/airports/{code}/services",
                    "/api/aviation-weather/{product}",
                    "/api/terrain/profile",
                ]
            ),
            "Missing domain operation schemas",
        ),
    )
    check(
        "MCP schema resource matches describe tool",
        lambda: json.loads(
            rpc("resources/read", {"uri": "aviation://v1/planning/openapi"})["contents"][0]["text"]
        ),
        lambda r: require(r == schema, "Resource/tool schema mismatch"),
    )
    check(
        "HTTP and MCP schemas match",
        lambda: json.loads(http("/api/v1/planning/api/openapi.json")[2]),
        lambda r: require(r == schema, "HTTP/MCP schema mismatch"),
    )
    if args.expected_revision:
        check(
            "Planner exact deployed revision",
            lambda: planning("/api/meta"),
            lambda r: require(
                r["revision"] == args.expected_revision, "Deployed revision mismatch"
            ),
        )
    check(
        "Airport identity/coordinates",
        lambda: planning("/api/airports/KPAO"),
        lambda r: require(
            r["icao"] == "KPAO" and 37 < r["latitude"] < 38 and -123 < r["longitude"] < -122,
            "Wrong airport",
        ),
    )
    check(
        "Nearby airports",
        lambda: planning("/api/airports/search?lat=37.46&lon=-122.11&radius_nm=20&limit=5"),
        lambda r: require(len(r) > 0 and r[0]["icao"] == "KPAO", "Proximity query failed"),
    )
    check(
        "Airport runways/frequencies",
        lambda: planning("/api/airports/KPAO/details"),
        lambda r: require(
            any(w["length_ft"] and w["length_ft"] > 2000 for w in r["runways"])
            and len(r["frequencies"]) > 0,
            "Facilities missing",
        ),
    )

    def validate_services(r):
        require(
            r["status"] == "available" and r["record"]["FUEL_TYPES"], "Fuel facility record missing"
        )
        effective = datetime.strptime(r["source"]["effective_date"], "%Y/%m/%d").replace(
            tzinfo=timezone.utc
        )
        require(
            0 <= (datetime.now(timezone.utc) - effective).days <= 90,
            "Facility source date outside 90-day audit window",
        )
        require(r["fuel_prices"] is None and r["fbo_hours"] is None, "Unknown data misrepresented")

    check(
        "Current dated airport fuel/services",
        lambda: planning("/api/airports/KPAO/services"),
        validate_services,
    )
    for product in ["metar", "taf"]:
        check(
            "NOAA " + product,
            lambda p=product: planning(f"/api/aviation-weather/{p}?airport=KSFO"),
            lambda r: require(
                r["status"] == "available" and len(r["reports"]) > 0, "Weather reports missing"
            ),
        )
    for product in ["pirep", "gairmet", "airsigmet"]:
        check(
            "NOAA " + product,
            lambda p=product: planning(f"/api/aviation-weather/{p}?airport=KSFO"),
            lambda r: require(
                r["status"] in {"available", "no_reports"} and isinstance(r["reports"], list),
                "Weather product failed",
            ),
        )
    check(
        "Airport forecast",
        lambda: planning("/api/weather/KSFO/forecast?days=2"),
        lambda r: require(
            len(r["daily"]) == 2 and r["daily"][0]["temp_max_f"] is not None, "Forecast missing"
        ),
    )
    check(
        "Terrain point elevation",
        lambda: planning("/api/terrain/point?lat=37.46&lon=-122.11"),
        lambda r: require(
            isinstance(r["elevation_ft"], (int, float)) and r["source"]["provider"],
            "Terrain elevation/source missing",
        ),
    )
    check(
        "Terrain elevation profile",
        lambda: planning("/api/terrain/profile", {"points": [[37.46, -122.11], [37.75, -122.42]]}),
        lambda r: require(
            len(r["points"]) == 2
            and all(isinstance(p["elevation_ft"], (int, float)) for p in r["points"]),
            "Terrain samples missing",
        ),
    )
    for layer in ["airports", "navaids", "airspace"]:
        check(
            "Geographic map " + layer,
            lambda l=layer: planning(f"/api/map/{l}?west=-122.5&south=37.3&east=-122&north=37.7"),
            lambda r: require(
                r["type"] == "FeatureCollection" and len(r["features"]) > 0, "Map features missing"
            ),
        )
    check(
        "Aircraft catalog",
        lambda: planning("/api/aircraft?q=Cessna"),
        lambda r: require(
            len(r["aircraft"]) > 0 and len(r["profiles"]) >= 3, "Aircraft catalog missing"
        ),
    )
    check(
        "Aircraft operating/reference performance",
        lambda: planning("/api/aircraft/C172"),
        lambda r: require(
            r["operating_profile"]["fuel_limits"]["usable_capacity_gal"] == 53,
            "Aircraft data mismatch",
        ),
    )
    check(
        "Wind/fuel/density-altitude calculations",
        lambda: planning(
            "/api/performance",
            {
                "distance_nm": 200,
                "true_airspeed_kt": 120,
                "true_course_deg": 0,
                "wind_from_deg": 0,
                "wind_speed_kt": 20,
                "fuel_burn_gph": 10,
                "fuel_on_board_gal": 30,
                "indicated_altitude_ft": 5000,
                "altimeter_inhg": 29.92,
                "temperature_c": 25,
            },
        ),
        lambda r: require(
            r["groundspeed_kt"] == 100
            and r["trip_fuel_gal"] == 20
            and r["reserve_satisfied"] is True
            and 7300 < r["density_altitude_ft"] < 7500,
            "Calculation mismatch",
        ),
    )
    check(
        "Cross-country multi-leg navlog",
        lambda: planning(
            "/api/navlog",
            {"airports": ["KPAO", "KSAC", "KRNO"], "true_airspeed_kt": 110, "fuel_burn_gph": 9},
        ),
        lambda r: require(
            len(r["legs"]) == 2 and r["trip_fuel_gal"] > 0 and r["distance_nm"] > 100,
            "Navlog invalid",
        ),
    )
    check(
        "Terrain-aware route planning",
        lambda: planning(
            "/api/plan",
            {
                "mode": "route",
                "origin": "KPAO",
                "destination": "KSAC",
                "speed": 110,
                "speed_unit": "knots",
                "altitude": 5500,
                "avoid_terrain": True,
                "avoid_airspaces": False,
                "include_alternates": False,
            },
        ),
        lambda r: require(
            r["route"][0] == "KPAO" and r["route"][-1] == "KSAC" and r["distance_nm"] > 0,
            "Route missing",
        ),
    )
    check(
        "Missing aircraft remains explicit 404",
        lambda: planning("/api/aircraft/ZZZZ", expected=404),
        lambda r: require("detail" in r, "Missing-aircraft error lost"),
    )
    check(
        "Invalid terrain input remains 422",
        lambda: planning("/api/terrain/point?lat=91&lon=0", expected=422),
        lambda r: require("detail" in r, "Input error lost"),
    )
    check(
        "FAA TFR summaries",
        lambda: planning("/api/restrictions/tfr"),
        lambda r: require(
            isinstance(r["restrictions"], list) and r["source"]["provider"], "TFR list unavailable"
        ),
    )
    check(
        "Aircraft-specific weight and balance",
        lambda: planning(
            "/api/performance/weight-balance",
            {
                "profile": {
                    "profileId": "qualification-caller",
                    "aircraftProfileId": "caller-type",
                    "displayName": "Synthetic caller input",
                    "emptyWeight": 1500,
                    "emptyMoment": 60000,
                    "maxGross": 2500,
                    "usableFuelCapacity": 50,
                    "fuelArm": 48,
                    "fuelDensity": 6,
                    "stations": [{"stationId": "front", "name": "Front", "arm": 40}],
                    "envelope": [
                        {"weight": 1500, "forward": 35, "aft": 47},
                        {"weight": 2500, "forward": 35, "aft": 47},
                    ],
                },
                "station_weights_lb": [300],
                "fuel_gal": 30,
                "fuel_burn_gal": 10,
            },
        ),
        lambda r: require(
            r["takeoff"]["weight"] == 1980 and r["landing"]["weight"] == 1920,
            "Weight and balance mismatch",
        ),
    )
    check(
        "POH performance table interpolation",
        lambda: planning(
            "/api/performance/table",
            {
                "metric": "takeoff_ground_roll_ft",
                "weight_lb": 2500,
                "source_reference": "Synthetic qualification grid, not an aircraft POH",
                "pressure_altitude_ft": 1000,
                "temperature_c": 10,
                "points": [
                    {"pressure_altitude_ft": a, "temperature_c": t, "value": v}
                    for a, t, v in [(0, 0, 1000), (0, 20, 1200), (2000, 0, 1400), (2000, 20, 1600)]
                ],
            },
        ),
        lambda r: require(
            r["value"] == 1300 and "Caller-supplied" in r["input_authority"],
            "Performance table interpolation mismatch",
        ),
    )
    report = {
        "schema": "aviation/ga-mcp-observation@1",
        "base_url": base,
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "expected_revision": args.expected_revision,
        "passed": all(c["passed"] for c in checks),
        "checks": checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(f'{sum(c["passed"] for c in checks)}/{len(checks)} passed; {args.report}')
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
