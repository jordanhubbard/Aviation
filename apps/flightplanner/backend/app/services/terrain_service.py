from __future__ import annotations

import os
import math
from functools import lru_cache
from typing import Iterable, List, Optional, Sequence, Tuple

import httpx


class TerrainServiceError(RuntimeError):
    pass


def _terrain_provider() -> str:
    # Default to Open-Meteo elevation to avoid OpenTopography quotas/timeouts in production.
    # Set TERRAIN_PROVIDER=opentopography to force the OpenTopography SRTM API.
    raw = (os.environ.get("TERRAIN_PROVIDER") or "open-meteo").strip().lower()
    return raw.replace("_", "-")


def _api_key() -> str:
    key = os.environ.get("OPENTOPOGRAPHY_API_KEY")
    if not key:
        raise TerrainServiceError(
            "Missing OPENTOPOGRAPHY_API_KEY for OpenTopography terrain requests"
        )
    return key


def _fetch_open_meteo_elevations_m(points: Sequence[Tuple[float, float]]) -> List[Optional[float]]:
    if not points:
        return []

    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/elevation",
            params={
                "latitude": ",".join(str(float(lat)) for lat, _ in points),
                "longitude": ",".join(str(float(lon)) for _, lon in points),
            },
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
        elev = payload.get("elevation")
        if not isinstance(elev, list):
            raise TerrainServiceError("Unexpected Open-Meteo elevation schema")
        out: List[Optional[float]] = []
        for v in elev[: len(points)]:
            if v is None:
                out.append(None)
            else:
                try:
                    out.append(float(v))
                except Exception:
                    out.append(None)

        # If the API returns fewer entries than requested, pad with Nones.
        while len(out) < len(points):
            out.append(None)

        return out
    except httpx.HTTPStatusError as e:
        raise TerrainServiceError(
            f"Open-Meteo elevation request failed (HTTP {e.response.status_code})"
        ) from e
    except httpx.RequestError as e:
        raise TerrainServiceError(f"Open-Meteo elevation request error: {e}") from e


def _parse_aai_grid_elevation_m(text: str) -> Optional[float]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None

    nodata = None
    data_start = 0
    for idx, line in enumerate(lines):
        parts = line.split()
        if len(parts) >= 2 and parts[0].lower() == "nodata_value":
            try:
                nodata = float(parts[1])
            except Exception:
                nodata = None

        if len(parts) >= 2 and parts[0].lower() in {
            "ncols",
            "nrows",
            "xllcorner",
            "yllcorner",
            "xllcenter",
            "yllcenter",
            "cellsize",
            "nodata_value",
        }:
            data_start = idx + 1
            continue

        break

    for line in lines[data_start:]:
        for token in line.split():
            try:
                v = float(token)
            except Exception:
                continue
            if nodata is not None and v == nodata:
                continue
            return v

    return None


def _parse_aai_grid_elevation_at_point_m(text: str, *, lat: float, lon: float) -> Optional[float]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None

    header: dict[str, float] = {}
    data_start = 0
    for idx, line in enumerate(lines):
        parts = line.split()
        if len(parts) >= 2 and parts[0].lower() in {
            "ncols",
            "nrows",
            "xllcorner",
            "yllcorner",
            "xllcenter",
            "yllcenter",
            "cellsize",
            "nodata_value",
        }:
            try:
                header[parts[0].lower()] = float(parts[1])
            except Exception:
                pass
            data_start = idx + 1
            continue
        break

    ncols = int(header.get("ncols") or 0)
    nrows = int(header.get("nrows") or 0)
    cellsize = float(header.get("cellsize") or 0.0)
    nodata = header.get("nodata_value")

    if ncols <= 0 or nrows <= 0 or cellsize <= 0:
        return _parse_aai_grid_elevation_m(text)

    if "xllcorner" in header:
        xll = float(header["xllcorner"])
        x_is_corner = True
    elif "xllcenter" in header:
        xll = float(header["xllcenter"])
        x_is_corner = False
    else:
        return _parse_aai_grid_elevation_m(text)

    if "yllcorner" in header:
        yll = float(header["yllcorner"])
        y_is_corner = True
    elif "yllcenter" in header:
        yll = float(header["yllcenter"])
        y_is_corner = False
    else:
        return _parse_aai_grid_elevation_m(text)

    # Compute grid indices for the requested point.
    if x_is_corner:
        col = int(math.floor((lon - xll) / cellsize))
    else:
        col = int(round((lon - xll) / cellsize))
    col = max(0, min(ncols - 1, col))

    # AAIGrid rows are ordered from north to south; y0 is south edge/center.
    if y_is_corner:
        row_from_south = int(math.floor((lat - yll) / cellsize))
    else:
        row_from_south = int(round((lat - yll) / cellsize))
    row_from_south = max(0, min(nrows - 1, row_from_south))
    row = (nrows - 1) - row_from_south

    # Parse the value at (row, col).
    data_row = 0
    for line in lines[data_start:]:
        if data_row >= nrows:
            break
        tokens = line.split()
        if len(tokens) < ncols:
            continue
        if data_row == row:
            try:
                v = float(tokens[col])
            except Exception:
                return None
            if nodata is not None and v == float(nodata):
                return None
            return v
        data_row += 1

    return None


@lru_cache(maxsize=4096)
def _get_elevation_m_opentopography(
    lat: float, lon: float, demtype: str = "SRTMGL1"
) -> Optional[float]:
    key = _api_key()
    # OpenTopography rejects extremely tiny bounding boxes; keep this small
    # but large enough to satisfy their minimum area constraints.
    eps = 0.005

    params = {
        "demtype": demtype,
        "south": lat - eps,
        "north": lat + eps,
        "west": lon - eps,
        "east": lon + eps,
        "outputFormat": "AAIGrid",
        "API_Key": key,
    }

    try:
        resp = httpx.get(
            "https://portal.opentopography.org/API/globaldem", params=params, timeout=30
        )
        resp.raise_for_status()
        return _parse_aai_grid_elevation_at_point_m(resp.text, lat=lat, lon=lon)
    except httpx.HTTPStatusError as e:
        body = (e.response.text or "").strip()
        if len(body) > 300:
            body = body[:300] + "..."
        raise TerrainServiceError(
            f"OpenTopography request failed (HTTP {e.response.status_code}): {body or 'no response body'}"
        ) from e
    except httpx.RequestError as e:
        raise TerrainServiceError(f"OpenTopography request error: {e}") from e


@lru_cache(maxsize=4096)
def _get_elevation_m_open_meteo(lat: float, lon: float) -> Optional[float]:
    out = _fetch_open_meteo_elevations_m([(lat, lon)])
    return out[0] if out else None


def get_elevation_m(lat: float, lon: float, demtype: str = "SRTMGL1") -> Optional[float]:
    provider = _terrain_provider()
    if provider == "opentopography":
        try:
            return _get_elevation_m_opentopography(lat, lon, demtype=demtype)
        except TerrainServiceError:
            # Fallback to Open-Meteo on quota/timeouts.
            return _get_elevation_m_open_meteo(lat, lon)

    return _get_elevation_m_open_meteo(lat, lon)


def get_elevation_ft(lat: float, lon: float, demtype: str = "SRTMGL1") -> Optional[float]:
    elev_m = get_elevation_m(lat, lon, demtype=demtype)
    if elev_m is None:
        return None
    return elev_m * 3.28084


def max_elevation_ft_along_points(
    points: Iterable[Tuple[float, float]], demtype: str = "SRTMGL1"
) -> Optional[float]:
    pts = list(points)
    if not pts:
        return None

    provider = _terrain_provider()
    if provider != "opentopography":
        elev_m = _fetch_open_meteo_elevations_m(pts)
        max_m = None
        for v in elev_m:
            if v is None:
                continue
            if max_m is None or v > max_m:
                max_m = v
        return (max_m * 3.28084) if max_m is not None else None

    max_ft: Optional[float] = None
    for lat, lon in pts:
        elev_ft = get_elevation_ft(lat, lon, demtype=demtype)
        if elev_ft is None:
            continue
        if max_ft is None or elev_ft > max_ft:
            max_ft = elev_ft
    return max_ft


def elevation_profile(
    points: List[Tuple[float, float]],
    demtype: str = "SRTMGL1",
) -> List[Tuple[float, float, Optional[float]]]:
    provider = _terrain_provider()
    out: List[Tuple[float, float, Optional[float]]] = []
    if provider != "opentopography":
        elev_m = _fetch_open_meteo_elevations_m(points)
        for (lat, lon), em in zip(points, elev_m, strict=False):
            out.append((lat, lon, (em * 3.28084) if em is not None else None))
        return out

    for lat, lon in points:
        out.append((lat, lon, get_elevation_ft(lat, lon, demtype=demtype)))
    return out
