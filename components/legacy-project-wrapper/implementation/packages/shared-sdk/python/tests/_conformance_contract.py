"""Load SDK-packaged vectors and guard them against Component-authority drift."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_conformance_contract(name: str) -> dict[str, Any]:
    packaged_path = Path(__file__).resolve().parents[2] / "conformance" / f"{name}.json"
    authority_path = (
        Path(__file__).resolve().parents[7]
        / "components"
        / f"aviation-{name}"
        / "acceptance"
        / "vectors.json"
    )
    packaged = json.loads(packaged_path.read_text(encoding="utf-8"))
    if authority_path.exists():
        authority = json.loads(authority_path.read_text(encoding="utf-8"))
        if packaged != authority:
            raise AssertionError(
                f"packaged {name} conformance vectors differ from Component authority"
            )
    return packaged
