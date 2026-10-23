from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple


class AStarError(RuntimeError):
    pass


def haversine_nm(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    (lat1, lon1), (lat2, lon2) = a, b
    r_nm = 3440.065
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    aa = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(aa), math.sqrt(1 - aa))
    return r_nm * c


@dataclass(frozen=True)
class AirportNode:
    code: str
    lat: float
    lon: float


def _cell_key(lat: float, lon: float, cell_deg: float) -> Tuple[int, int]:
    return (int(math.floor(lat / cell_deg)), int(math.floor(lon / cell_deg)))


def _build_spatial_index(
    nodes: Sequence[AirportNode], cell_deg: float
) -> Dict[Tuple[int, int], List[int]]:
    buckets: Dict[Tuple[int, int], List[int]] = {}
    for idx, n in enumerate(nodes):
        k = _cell_key(n.lat, n.lon, cell_deg)
        buckets.setdefault(k, []).append(idx)
    return buckets


def find_route(
    *,
    origin: AirportNode,
    destination: AirportNode,
    candidates: Sequence[AirportNode],
    max_leg_distance_nm: float,
    per_leg_penalty_nm: float = 0.0,
    max_expansions: int = 20000,
) -> List[str]:
    if max_leg_distance_nm <= 0:
        raise AStarError("max_leg_distance_nm must be > 0")

    # If the direct leg is feasible, prefer direct.
    if (
        haversine_nm((origin.lat, origin.lon), (destination.lat, destination.lon))
        <= max_leg_distance_nm
    ):
        return [origin.code, destination.code]

    # Include endpoints in the node list.
    nodes: List[AirportNode] = [origin]
    seen = {origin.code}

    for n in candidates:
        if n.code in seen:
            continue
        nodes.append(n)
        seen.add(n.code)

    if destination.code not in seen:
        nodes.append(destination)
    dest_idx = len(nodes) - 1

    cell_deg = max(0.25, max_leg_distance_nm / 60.0)
    buckets = _build_spatial_index(nodes, cell_deg)

    def neighbors(i: int) -> Iterable[Tuple[int, float]]:
        n = nodes[i]
        ck = _cell_key(n.lat, n.lon, cell_deg)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for j in buckets.get((ck[0] + dy, ck[1] + dx), []):
                    if j == i:
                        continue
                    d = haversine_nm((n.lat, n.lon), (nodes[j].lat, nodes[j].lon))
                    if d <= max_leg_distance_nm:
                        yield j, d + per_leg_penalty_nm

    open_heap: List[Tuple[float, int]] = []
    heapq.heappush(open_heap, (0.0, 0))

    came_from: Dict[int, int] = {}
    g_score: Dict[int, float] = {0: 0.0}

    expansions = 0
    while open_heap:
        _, current = heapq.heappop(open_heap)
        expansions += 1
        if expansions > max_expansions:
            raise AStarError("Search exceeded max expansions")

        if current == dest_idx:
            # Reconstruct
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()
            return [nodes[i].code for i in path]

        for nxt, edge_cost in neighbors(current):
            tentative = g_score[current] + edge_cost
            if tentative >= g_score.get(nxt, float("inf")):
                continue
            came_from[nxt] = current
            g_score[nxt] = tentative
            h = haversine_nm(
                (nodes[nxt].lat, nodes[nxt].lon), (nodes[dest_idx].lat, nodes[dest_idx].lon)
            )
            heapq.heappush(open_heap, (tentative + h, nxt))

    raise AStarError("No route found")
