from __future__ import annotations

import sys
from pathlib import Path


def resolve_packages_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "packages"
        if candidate.exists():
            return candidate
    return Path("/packages")


def add_package_path(relative_path: str) -> Path:
    packages_root = resolve_packages_root()
    package_path = packages_root / relative_path
    if str(package_path) not in sys.path:
        sys.path.insert(0, str(package_path))
    return package_path
