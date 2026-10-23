"""
METAR Fetching and Parsing

Fetches METAR data from aviationweather.gov and provides basic parsing.
"""

from __future__ import annotations

import os
import re
from fractions import Fraction
from typing import Any, Dict, Optional, Sequence

import httpx


def fetch_metar_raws(stations: Sequence[str]) -> Dict[str, Optional[str]]:
    """
    Fetch raw METARs for multiple stations.
    
    Args:
        stations: List of ICAO station identifiers
        
    Returns:
        Dict mapping station to raw METAR string (None if unavailable)
        
    Example:
        >>> metars = fetch_metar_raws(['KSFO', 'KJFK'])
        >>> print(metars['KSFO'])
        'KSFO 141356Z 28015KT 10SM FEW020 SCT250 15/09 A3012 RMK AO2'
    """
    if os.environ.get("DISABLE_METAR_FETCH") == "1":
        return {str(s).strip().upper(): None for s in stations if str(s).strip()}

    # Normalize and de-duplicate while preserving order
    stations_u: list[str] = []
    seen: set[str] = set()
    for s in stations:
        su = str(s).strip().upper()
        if not su or su in seen:
            continue
        seen.add(su)
        stations_u.append(su)

    out: Dict[str, Optional[str]] = {s: None for s in stations_u}

    if not stations_u:
        return out

    try:
        resp = httpx.get(
            "https://aviationweather.gov/api/data/metar",
            params={"ids": ",".join(stations_u), "format": "raw"},
            headers={"User-Agent": "aviation-sdk"},
            timeout=20,
        )

        if resp.status_code == 204:
            return out

        resp.raise_for_status()
        lines = [ln.strip() for ln in resp.text.splitlines() if ln.strip()]

        found: Dict[str, str] = {}
        for ln in lines:
            # Expected format: "KSFO 201356Z ..." (station code first)
            code = ln.split(maxsplit=1)[0].strip().upper() if ln else ""
            if code and code in out:
                found[code] = ln

        for s in stations_u:
            raw = found.get(s)
            if raw:
                out[s] = raw

        return out
        
    except Exception as e:
        # Best-effort: return what we have (all None values)
        return out


def fetch_metar_raw(station: str) -> Optional[str]:
    """
    Fetch raw METAR for a single station.
    
    Args:
        station: ICAO station identifier
        
    Returns:
        Raw METAR string or None if unavailable
        
    Example:
        >>> metar = fetch_metar_raw('KSFO')
        >>> print(metar)
        'KSFO 141356Z 28015KT 10SM FEW020 SCT250 15/09 A3012 RMK AO2'
    """
    if os.environ.get("DISABLE_METAR_FETCH") == "1":
        return None

    result = fetch_metar_raws([station])
    return result.get(station.upper())


def parse_metar(raw: str) -> Dict[str, Any]:
    """
    Parse a METAR string into structured data.
    
    This is a basic parser that extracts common elements. For more advanced
    parsing, consider using a specialized METAR parsing library like metar-python.
    
    Args:
        raw: Raw METAR string
        
    Returns:
        Dict with parsed elements:
            - station: Station identifier
            - time: Observation time (DDHHMMZ format)
            - wind_dir: Wind direction in degrees (None if variable)
            - wind_speed_kt: Wind speed in knots
            - wind_gust_kt: Wind gust in knots (if present)
            - visibility_sm: Visibility in statute miles
            - temperature_c: Temperature in Celsius
            - dewpoint_c: Dewpoint in Celsius
            - altimeter_inhg: Altimeter setting in inHg
            - ceiling_ft: Ceiling in feet AGL (if present)
            - clouds: List of cloud layers
            - weather: List of weather phenomena
            - raw: Original METAR string
            
    Example:
        >>> metar = parse_metar('KSFO 141356Z 28015KT 10SM FEW020 SCT250 15/09 A3012 RMK AO2')
        >>> print(metar['visibility_sm'])
        10.0
        >>> print(metar['temperature_c'])
        15
    """
    if not raw:
        return {"raw": raw}

    result: Dict[str, Any] = {
        "raw": raw,
        "station": None,
        "time": None,
        "wind_dir": None,
        "wind_speed_kt": None,
        "wind_gust_kt": None,
        "visibility_sm": None,
        "temperature_c": None,
        "dewpoint_c": None,
        "altimeter_inhg": None,
        "ceiling_ft": None,
        "clouds": [],
        "weather": [],
    }

    tokens = raw.split()
    if not tokens:
        return result

    idx = 0

    # Station (e.g., "KSFO")
    if idx < len(tokens) and re.match(r'^[A-Z]{4}$', tokens[idx]):
        result["station"] = tokens[idx]
        idx += 1

    # Time (e.g., "141356Z")
    if idx < len(tokens) and re.match(r'^\d{6}Z$', tokens[idx]):
        result["time"] = tokens[idx]
        idx += 1

    # Wind (e.g., "28015KT", "28015G25KT", "VRB05KT")
    if idx < len(tokens):
        wind_match = re.match(r'^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$', tokens[idx])
        if wind_match:
            wind_dir_str = wind_match.group(1)
            result["wind_dir"] = int(wind_dir_str) if wind_dir_str != "VRB" else None
            result["wind_speed_kt"] = int(wind_match.group(2))
            if wind_match.group(3):
                result["wind_gust_kt"] = int(wind_match.group(3))
            idx += 1

    # Visibility (e.g., "10SM", "1/2SM", "1 1/2SM")
    if idx < len(tokens):
        vis_str = tokens[idx]
        
        # Handle fractional visibility (e.g., "1/2SM")
        if "SM" in vis_str:
            vis_str = vis_str.replace("SM", "")
            
            # Check if next token is also part of visibility (e.g., "1" "1/2SM")
            if idx + 1 < len(tokens) and "/" in tokens[idx + 1] and "SM" in tokens[idx + 1]:
                vis_str = vis_str + " " + tokens[idx + 1].replace("SM", "")
                idx += 1
            
            try:
                # Handle fractions and whole numbers
                if "/" in vis_str:
                    parts = vis_str.split()
                    if len(parts) == 2:  # e.g., "1 1/2"
                        result["visibility_sm"] = float(parts[0]) + float(Fraction(parts[1]))
                    else:  # e.g., "1/2"
                        result["visibility_sm"] = float(Fraction(vis_str))
                else:
                    result["visibility_sm"] = float(vis_str)
            except Exception:
                pass
            idx += 1

    # Weather phenomena (e.g., "-RA", "BR", "FG")
    while idx < len(tokens):
        tok = tokens[idx]
        if re.match(r'^[\+\-]?(VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)$', tok):
            result["weather"].append(tok)
            idx += 1
        else:
            break

    # Clouds (e.g., "FEW020", "SCT250", "BKN010", "OVC005")
    while idx < len(tokens):
        tok = tokens[idx]
        cloud_match = re.match(r'^(FEW|SCT|BKN|OVC)(\d{3})$', tok)
        if cloud_match:
            coverage = cloud_match.group(1)
            altitude_hundreds = int(cloud_match.group(2))
            altitude_ft = altitude_hundreds * 100
            
            result["clouds"].append({
                "coverage": coverage,
                "altitude_ft": altitude_ft,
            })
            
            # Determine ceiling (BKN or OVC)
            if coverage in ["BKN", "OVC"]:
                if result["ceiling_ft"] is None or altitude_ft < result["ceiling_ft"]:
                    result["ceiling_ft"] = altitude_ft
            
            idx += 1
        else:
            break

    # Temperature/Dewpoint (e.g., "15/09", "M05/M10")
    if idx < len(tokens):
        temp_match = re.match(r'^(M?\d{2})/(M?\d{2})$', tokens[idx])
        if temp_match:
            temp_str = temp_match.group(1)
            dewpoint_str = temp_match.group(2)
            
            result["temperature_c"] = -int(temp_str[1:]) if temp_str.startswith("M") else int(temp_str)
            result["dewpoint_c"] = -int(dewpoint_str[1:]) if dewpoint_str.startswith("M") else int(dewpoint_str)
            idx += 1

    # Altimeter (e.g., "A3012")
    if idx < len(tokens):
        alt_match = re.match(r'^A(\d{4})$', tokens[idx])
        if alt_match:
            result["altimeter_inhg"] = int(alt_match.group(1)) / 100.0
            idx += 1

    return result
