#!/usr/bin/env python3
"""Fail closed when a retained-wrapper top-level path lacks an owner."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
IMPLEMENTATION = ROOT / "components" / "legacy-project-wrapper" / "implementation"
INVENTORY = ROOT / "docs" / "roadmap" / "retained-wrapper-remainder-inventory.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def tracked_paths() -> list[str]:
    prefix = IMPLEMENTATION.relative_to(ROOT).as_posix() + "/"
    result = subprocess.run(
        ["git", "ls-files", prefix], cwd=ROOT, check=True, capture_output=True, text=True
    )
    paths = [line.removeprefix(prefix) for line in result.stdout.splitlines() if line]
    return [path for path in paths if (IMPLEMENTATION / path).exists()]


def path_manifest(paths: list[str], directory: str) -> tuple[int, str]:
    members = sorted(path for path in paths if path.startswith(directory + "/"))
    digest = hashlib.sha256(("\n".join(members) + "\n").encode()).hexdigest()
    return len(members), digest


def main() -> None:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    require(
        data.get("$schema") == "aviation/retained-wrapper-remainder-inventory@1",
        "unexpected retained-wrapper remainder schema",
    )
    require(
        data.get("authority") == "retained-wrapper-remainder-inventory",
        "remainder inventory must not claim Component authority",
    )

    paths = tracked_paths()
    actual_files = sorted(path for path in paths if "/" not in path)
    actual_directories = sorted({path.split("/", 1)[0] for path in paths if "/" in path})

    file_entries = data.get("topLevelFiles")
    directory_entries = data.get("topLevelDirectories")
    require(isinstance(file_entries, list), "top-level file classifications required")
    require(isinstance(directory_entries, list), "top-level directory classifications required")
    classified_files = [entry.get("path") for entry in file_entries]
    classified_directories = [entry.get("path") for entry in directory_entries]
    require(len(classified_files) == len(set(classified_files)), "duplicate top-level file")
    require(len(classified_directories) == len(set(classified_directories)), "duplicate top-level directory")
    require(classified_files == actual_files,
            f"top-level file coverage mismatch: inventory={classified_files} actual={actual_files}")
    require(classified_directories == actual_directories,
            f"top-level directory coverage mismatch: inventory={classified_directories} actual={actual_directories}")

    for entry in directory_entries:
        require(entry.get("classification"), f"{entry.get('path')}: classification required")
        coverage = entry.get("coverage")
        require(coverage, f"{entry.get('path')}: coverage authority required")
        if coverage == "path-manifest":
            count, digest = path_manifest(paths, entry["path"])
            require(entry.get("fileCount") == count,
                    f"{entry['path']}: file count drifted ({count})")
            require(entry.get("pathsSha256") == digest,
                    f"{entry['path']}: path manifest drifted ({digest})")

    for entry in file_entries:
        require(entry.get("classification"), f"{entry.get('path')}: classification required")

    removed = data.get("removedResidue")
    require(isinstance(removed, list) and removed, "removed residue evidence required")
    for path in removed:
        require(path not in paths and not (IMPLEMENTATION / path).exists(),
                f"removed residue returned: {path}")

    vector_path = "conformance/aviation-avionics.json"
    for consumer in data.get("conformanceConsumers", []):
        text = (IMPLEMENTATION / consumer).read_text(encoding="utf-8")
        require("aviation-avionics.json" in text,
                f"conformance consumer no longer reads {vector_path}: {consumer}")

    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    require("python scripts/check_retained_wrapper_remainder_inventory.py" in ci,
            "remainder inventory is not enforced by Monorepo CI")
    print(
        f"retained wrapper classified: {len(actual_directories)} top-level directories, "
        f"{len(actual_files)} top-level files"
    )


if __name__ == "__main__":
    main()
