from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from shapely.geometry import Polygon

from app.services import xctry_route_planner


@dataclass
class _FakeRow:
    geometry: object


class _FakeILoc:
    def __init__(self, rows: List[_FakeRow]):
        self._rows = rows

    def __getitem__(self, idx: int) -> _FakeRow:
        return self._rows[idx]


class _FakeGDF:
    def __init__(self, rows: List[_FakeRow]):
        self._rows = rows

    @property
    def empty(self) -> bool:
        return len(self._rows) == 0

    @property
    def iloc(self) -> _FakeILoc:
        return _FakeILoc(self._rows)

    def intersects(self, seg) -> List[bool]:
        # Only return an intersection for the initial direct leg. This simulates
        # a detour insertion without requiring geopandas.
        coords = list(seg.coords)
        is_initial_leg = coords == [(0.0, 0.0), (2.0, 0.0)]
        return [bool(is_initial_leg and r.geometry.intersects(seg)) for r in self._rows]

    def __getitem__(self, mask: Iterable[bool]):
        filtered = [r for r, m in zip(self._rows, mask) if m]
        return _FakeGDF(filtered)


def test_avoid_airspaces_preserves_destination(monkeypatch) -> None:
    origin = (0.0, 0.0)
    destination = (0.0, 2.0)

    # A small polygon intersecting the direct line from (lon=0,lat=0) to (lon=2,lat=0).
    poly = Polygon([(0.9, -0.1), (1.1, -0.1), (1.1, 0.1), (0.9, 0.1)])

    monkeypatch.setattr(
        xctry_route_planner,
        "load_airspaces_gdf",
        lambda: _FakeGDF([_FakeRow(poly)]),
    )

    out = xctry_route_planner.avoid_airspaces([origin, destination], buffer_nm=5.0)

    assert out[0] == origin
    assert out[-1] == destination
    assert len(out) >= 3

    # No consecutive duplicates (avoids zero-length legs).
    assert all(out[i] != out[i + 1] for i in range(len(out) - 1))
