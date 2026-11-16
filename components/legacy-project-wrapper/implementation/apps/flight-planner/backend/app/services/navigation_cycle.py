"""FAA fixed-width adapter into the existing shared navigation catalog."""

from collections import defaultdict
from functools import lru_cache
import json
import re

from arinc424 import Record
from aviation.nav_data import NavDataCatalog

from .charts import ChartError, digest


def coordinate(value):
    value = value.strip()
    match = re.fullmatch(r"([NS])(\d{2})(\d{2})(\d{4})|([EW])(\d{3})(\d{2})(\d{4})", value)
    if not match:
        return None
    sign, degrees, minutes, seconds = match.groups()[:4] if match[1] else match.groups()[4:]
    minutes, seconds = int(minutes), int(seconds) / 100
    if minutes >= 60 or seconds >= 60:
        return None
    return (int(degrees) + minutes / 60 + seconds / 3600) * (-1 if sign in {"S", "W"} else 1)


def altitude(value):
    value = value.strip()
    if value.startswith("FL") and value[2:].isdigit():
        return None  # Pressure flight levels are not silently relabeled MSL feet.
    return int(value) if re.fullmatch(r"-?\d+", value) else None


@lru_cache(maxsize=2)
def catalog_snapshot(path, source_sha, cycle_json, airport):
    cycle = json.loads(cycle_json)
    groups, navaids, rejected = defaultdict(list), [], []
    counts = defaultdict(int)
    with open(path, encoding="ascii") as source:
        for line in source:
            line = line.rstrip("\r\n")
            if len(line) != 132 or not line.startswith(("S", "T")):
                counts["other_records"] += 1
                continue
            section = line[4:6]
            terminal = line[4] + line[12]
            relevant_procedure = (
                terminal in {"PD", "PE", "PF", "HF"} and line[6:10].strip() == airport
            )
            relevant_navaid = section in {"D ", "DB", "EA"} or (
                terminal in {"PC", "HC"} and line[6:10].strip() == airport
            )
            if not relevant_procedure and not relevant_navaid:
                continue
            record = Record()
            try:
                valid = record.read(line)
                if not valid:
                    raise ValueError("Unsupported ARINC record")
                fields = {f.name: f.value.strip() for f in record.fields}
            except (ValueError, KeyError, IndexError, TypeError):
                rejected.append({"raw": line, "reason": "ARINC parser could not translate record"})
                continue
            if relevant_procedure:
                key = (
                    fields.get("Airport Identifier", airport),
                    terminal,
                    fields.get("SID/STAR/Approach Identifier", ""),
                    fields.get("Route Type", ""),
                    fields.get("Transition Identifier", ""),
                )
                groups[key].append({"fields": fields, "raw": line, "primary": record.primary()})
                counts["procedure_records"] += 1
            elif record.primary():
                name = (
                    fields.get("VOR Identifier")
                    or fields.get("NDB Identifier")
                    or fields.get("Waypoint Identifier")
                )
                lat = coordinate(
                    fields.get("VOR Latitude")
                    or fields.get("DME Latitude")
                    or fields.get("NDB Latitude")
                    or fields.get("Waypoint Latitude")
                    or ""
                )
                lon = coordinate(
                    fields.get("VOR Longitude")
                    or fields.get("DME Longitude")
                    or fields.get("NDB Longitude")
                    or fields.get("Waypoint Longitude")
                    or ""
                )
                if name and lat is not None and lon is not None:
                    navaids.append(
                        {
                            "identifier": name,
                            "name": fields.get("VOR Name")
                            or fields.get("Waypoint Name / Desc")
                            or name,
                            "type": (
                                "WAYPOINT"
                                if section == "EA" or terminal in {"PC", "HC"}
                                else "NDB" if section == "DB" else "VHF"
                            ),
                            "latitude": lat,
                            "longitude": lon,
                        }
                    )
    procedures, details = [], []
    for key, rows in sorted(groups.items()):
        identifier, section, name, route_type, transition = key
        if not name:
            rejected.extend({"raw": r["raw"], "reason": "Procedure identity missing"} for r in rows)
            continue
        primary = sorted(
            (r for r in rows if r["primary"]), key=lambda r: r["fields"].get("Sequence Number", "")
        )
        legs, omitted = [], []
        for row in primary:
            f = row["fields"]
            fix = f.get("Fix Identifier", "")
            if not fix:
                omitted.append(row)
                continue
            course = f.get("Magnetic Course", "")
            constraint = " ".join(
                v
                for v in [f.get("Altitude Description"), f.get("Altitude"), f.get("Altitude (2)")]
                if v
            )
            legs.append(
                {
                    "fix": fix,
                    "path_type": f.get("Path and Termination") or None,
                    "altitude_constraint": constraint or None,
                    "altitude_ft": altitude(f.get("Altitude", "")),
                    "speed_constraint": f.get("Speed Limit") or None,
                    "course_deg": int(course) / 10 if re.fullmatch(r"\d{4}", course) else None,
                }
            )
        procedures.append(
            {
                "identifier": name,
                "airport_icao": identifier,
                "procedure_type": {"PD": "SID", "PE": "STAR", "PF": "APPROACH", "HF": "APPROACH"}[
                    section
                ],
                "runway": transition[2:] if transition.startswith("RW") else None,
                "transitions": [transition] if transition else [],
                "legs": legs,
            }
        )
        details.append(
            {
                "id": digest("|".join(key).encode())[:24],
                "route_type": route_type,
                "records": rows,
                "omitted_from_common_legs": len(omitted),
                "usage": "Reference/simulation only. Raw special legs and constraints require interpretation; not certified navigation guidance.",
            }
        )
    catalog = NavDataCatalog(
        {
            "metadata": {
                "source": "FAA CIFP ARINC 424-18",
                "cycle": cycle["cycle"],
                "retrieved_at": cycle["retrieved_at"],
                "effective_from": cycle["effective_from"],
                "effective_until": cycle["effective_to"],
            },
            "navaids": navaids,
            "procedures": procedures,
            "airspace": {"type": "FeatureCollection", "features": []},
        }
    )
    sidecars = {id(record): details[index] for index, record in enumerate(catalog.procedures)}
    return (
        catalog,
        sidecars,
        {"counts": dict(counts), "rejected": rejected, "records_sha256": source_sha},
    )


def current_catalog(charts, airport):
    airport = airport.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{3,4}", airport):
        raise ChartError("Invalid airport identifier")
    cycles = [c for c in charts.status()["cycles"] if c["freshness"] == "current"]
    if len(cycles) != 1:
        raise ChartError("No unique current FAA navigation cycle; refresh sources")
    cycle = cycles[0]
    catalog, sidecars, receipt = catalog_snapshot(
        str(charts.objects / cycle["records_sha256"]),
        cycle["records_sha256"],
        json.dumps(cycle, sort_keys=True),
        airport,
    )
    return catalog, sidecars, {**receipt, "source": cycle}


def navigation(charts, airport, *, procedure_type=None, runway=None, page=1, limit=25, query=None):
    airport = airport.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{3,4}", airport) or not 1 <= page <= 1000 or not 1 <= limit <= 50:
        raise ChartError("Invalid navigation query")
    catalog, sidecars, receipt = current_catalog(charts, airport)
    cycle = receipt["source"]
    selected = catalog.procedures_for_airport(airport, procedure_type, runway)
    return {
        "airport": airport,
        "procedures": [
            {"record": record, "provider": sidecars[id(record)]}
            for record in selected[(page - 1) * limit : page * limit]
        ],
        "total": len(selected),
        "page": page,
        "limit": limit,
        "status": catalog.status(),
        "source": cycle,
        "parse_receipt": receipt,
        "navaids": catalog.search_navaids(query)[:100] if query else [],
        "limitations": "Raw source and continuation records are preserved. Common leg records do not encode every ARINC constraint or guidance behavior. Flight levels remain pressure-level constraints; missing values are not zero.",
    }
