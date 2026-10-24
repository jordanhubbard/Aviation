"""Convert a public NTSB weekly MDB archive on stdin to recent event JSON."""

import csv
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def export_table(database: Path, table: str):
    result = subprocess.run(
        ["mdb-export", str(database), table],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(csv.DictReader(io.StringIO(result.stdout)))


def number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def coordinate(value, low, high):
    try:
        result = float(value)
        return result if low <= result <= high else None
    except (TypeError, ValueError):
        return None


def convert(events, aircraft, source_url, cutoff, fetched_at, narratives=(), findings=(), sequences=()):
    aircraft_by_event = {}
    for row in aircraft:
        aircraft_by_event.setdefault(row["ev_id"], row)

    causes_by_event = {}
    for row in narratives:
        if row.get("narr_cause", "").strip():
            causes_by_event.setdefault(row["ev_id"], []).append(row["narr_cause"].strip())
    for row in findings:
        if row.get("cm_inPc", "").upper() == "T" and row.get("finding_description", "").strip():
            causes_by_event.setdefault(row["ev_id"], []).append(row["finding_description"].strip())
    occurrences_by_event = {}
    for row in sequences:
        if row.get("Occurrence_Description", "").strip():
            occurrences_by_event.setdefault(row["ev_id"], []).append(row["Occurrence_Description"].strip())

    output = []
    for row in events:
        if row.get("ev_type") not in ("ACC", "INC") or not row.get("ev_id"):
            continue
        try:
            event_date = datetime.strptime(row["ev_date"], "%m/%d/%y %H:%M:%S").replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            continue
        if event_date < cutoff:
            continue
        plane = aircraft_by_event.get(row["ev_id"], {})
        case = row.get("ntsb_no") or row["ev_id"]
        place = ", ".join(filter(None, (row.get("ev_city"), row.get("ev_state"))))
        make_model = " ".join(filter(None, (plane.get("acft_make"), plane.get("acft_model")))).strip()
        summary = f"NTSB {case}: {place}" if place else f"NTSB {case}"
        raw = {
            "source": "ntsb",
            "id": row["ev_id"],
            "url": source_url,
            "fetchedAt": fetched_at,
            "dateZ": event_date.isoformat().replace("+00:00", "Z"),
            "registration": plane.get("regis_no") or f"NTSB-{case}",
            "country": row.get("ev_country") or None,
            "region": row.get("ev_state") or None,
            "summary": summary,
            "status": "reported",
        }
        if make_model:
            raw["aircraftType"] = make_model
        if causes_by_event.get(row["ev_id"]):
            raw["causeText"] = ". ".join(causes_by_event[row["ev_id"]])
        if occurrences_by_event.get(row["ev_id"]):
            raw["occurrenceText"] = ". ".join(occurrences_by_event[row["ev_id"]])
        airport = row.get("ev_nr_apt_id") or ""
        if len(airport) == 4 and airport.isalpha():
            raw["airportIcao"] = airport
        latitude = coordinate(row.get("dec_latitude"), -90, 90)
        longitude = coordinate(row.get("dec_longitude"), -180, 180)
        if latitude is not None and longitude is not None:
            raw["lat"], raw["lon"] = latitude, longitude
        fatalities = number(row.get("inj_tot_f"))
        serious = number(row.get("inj_tot_s"))
        minor = number(row.get("inj_tot_m"))
        if fatalities is not None:
            raw["fatalities"] = fatalities
        if serious is not None or minor is not None:
            raw["injuries"] = (serious or 0) + (minor or 0)
        output.append(raw)
    return output


def main():
    source_url, cutoff_text = sys.argv[1:3]
    cutoff = datetime.fromisoformat(cutoff_text.replace("Z", "+00:00"))
    fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with tempfile.TemporaryDirectory(prefix="aviation-ntsb-") as directory:
        with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
            members = [member for member in archive.infolist() if member.filename.lower().endswith(".mdb")]
            if len(members) != 1 or members[0].file_size > 150_000_000:
                raise ValueError("expected one NTSB MDB under size limit")
            database = Path(directory) / "update.mdb"
            with archive.open(members[0]) as source, database.open("wb") as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
        result = convert(
            export_table(database, "events"),
            export_table(database, "aircraft"),
            source_url,
            cutoff,
            fetched_at,
            export_table(database, "narratives"),
            export_table(database, "Findings"),
            export_table(database, "Events_Sequence"),
        )
        json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
