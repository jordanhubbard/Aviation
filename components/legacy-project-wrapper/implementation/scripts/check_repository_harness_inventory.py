#!/usr/bin/env python3
"""Validate classification of retained repository and deployment harness paths."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
IMPLEMENTATION = ROOT / "components" / "legacy-project-wrapper" / "implementation"
INVENTORY = ROOT / "docs" / "roadmap" / "repository-harness-inventory.json"

CLASSIFICATIONS = {
    "architecture-contract-validator",
    "deployment-manifest",
    "deployment-operator-tool",
    "deployment-orchestrator",
    "deployment-test-harness",
    "dormant-deployment-policy",
    "immutable-test-fixture",
    "observability-policy",
    "performance-test-harness",
    "release-orchestrator",
    "repository-documentation",
    "repository-operator-tool",
    "repository-test-harness",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def actual_files(roots: list[str]) -> set[str]:
    paths: set[str] = set()
    for root in roots:
        directory = IMPLEMENTATION / root
        require(directory.exists(), f"classified root does not exist: {root}")
        for path in directory.rglob("*"):
            if not path.is_file() or "__pycache__" in path.parts:
                continue
            paths.add(path.relative_to(IMPLEMENTATION).as_posix())
    return paths


def main() -> None:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    require(data.get("$schema") == "aviation/repository-harness-inventory@1", "unexpected schema")
    require(data.get("authority") == "retained-repository-inventory",
            "repository harness must not claim Component authority")
    roots = data.get("roots")
    require(isinstance(roots, list) and len(roots) == len(set(roots)), "unique roots required")
    entries = data.get("files")
    require(isinstance(entries, list) and entries, "classified files required")
    paths = [entry.get("path") for entry in entries]
    require(len(paths) == len(set(paths)), "duplicate classified path")
    require(set(paths) == actual_files(roots),
            f"repository harness coverage mismatch: inventory={sorted(paths)} actual={sorted(actual_files(roots))}")
    for entry in entries:
        require(entry.get("classification") in CLASSIFICATIONS,
                f"{entry.get('path')}: invalid classification")

    removed = data.get("removedResidue")
    require(isinstance(removed, list) and removed, "removed residue evidence required")
    for relative in removed:
        require(not (IMPLEMENTATION / relative).exists(), f"removed residue returned: {relative}")

    manifest = json.loads((IMPLEMENTATION / "package.json").read_text(encoding="utf-8"))
    scripts = manifest.get("scripts", {})
    require(data.get("rootScripts") == {name: scripts.get(name) for name in data["rootScripts"]},
            "root operator scripts drifted")

    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    deploy_ci = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")
    require("python scripts/check_repository_harness_inventory.py" in ci,
            "repository inventory is not enforced by Monorepo CI")
    require("python3 -m unittest discover -s components/legacy-project-wrapper/implementation/deploy" in deploy_ci,
            "deployment orchestration tests are not enforced by deployment CI")
    require(isinstance(data.get("knownGaps"), list) and data["knownGaps"],
            "known repository harness gaps must remain explicit")
    print(f"repository harness inventory: {len(entries)} files across {len(roots)} roots validated")


if __name__ == "__main__":
    main()
