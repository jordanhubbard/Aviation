"""
Airport database and search functionality

Provides fast, in-memory airport lookups and searches with:
- ICAO/IATA code lookups
- Text search (fuzzy matching)
- Proximity search (haversine distance)
- US airport K-prefix handling

@module aviation.airports
"""

from __future__ import annotations

import difflib
import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# In-memory cache of all airports
_airport_cache: List[Dict[str, Any]] | None = None


def load_airport_cache() -> List[Dict[str, Any]]:
    """
    Load airports from data file (lazy loading)
    
    Returns:
        Array of normalized airport records
    """
    global _airport_cache
    
    if _airport_cache is not None:
        return _airport_cache
    
    try:
        # Load from airports_cache.json
        data_path = Path(__file__).parent.parent.parent / "data" / "airports_cache.json"
        with open(data_path, 'r', encoding='utf-8') as f:
            raw_airports = json.load(f)
        
        # Normalize all airports on load
        normalized = []
        for entry in raw_airports:
            lat, lon = _extract_lat_lon(entry)
            if lat is not None and lon is not None:
                normalized.append(_normalize_airport(entry, lat, lon))
        
        _airport_cache = normalized
        print(f"Loaded {len(_airport_cache)} airports")
        
    except Exception as e:
        print(f"Failed to load airport cache: {e}")
        _airport_cache = []
    
    return _airport_cache


def _normalize_airport_code(value: str) -> str:
    """
    Normalize airport code by extracting leading code from strings like "KPAO - Palo Alto Airport"
    
    Args:
        value: Raw airport code string
    
    Returns:
        Normalized uppercase airport code
    
    Examples:
        >>> _normalize_airport_code("KPAO - Palo Alto Airport")
        'KPAO'
        >>> _normalize_airport_code("sfo")
        'SFO'
        >>> _normalize_airport_code("  SJC  ")
        'SJC'
    """
    if not value:
        return ""
    
    # Extract part before dash/hyphen
    before_dash = re.split(r"\s*[-–—]\s*", value.strip(), maxsplit=1)[0]
    token = before_dash.strip().split()[0] if before_dash.strip() else ""
    token_upper = token.upper()
    
    # Valid airport code: 3-5 alphanumeric characters
    if re.fullmatch(r"[A-Z0-9]{3,5}", token_upper):
        return token_upper
    
    return value.strip().upper()


def _candidate_codes(code: str) -> Set[str]:
    """
    Generate candidate codes for airport lookup
    
    Handles US airport K-prefix convention where FAA identifiers are stored
    as ICAO codes with K prefix (e.g., "7S5" → "K7S5")
    
    Args:
        code: Normalized airport code
    
    Returns:
        Set of candidate codes to try
    
    Examples:
        >>> _candidate_codes("PAO")
        {'PAO', 'KPAO'}
        >>> _candidate_codes("KPAO")
        {'KPAO', 'PAO'}
        >>> _candidate_codes("KSFO")
        {'KSFO', 'SFO'}
    """
    codes = {code}
    
    # Add K-prefixed version for short US codes
    if (
        code
        and not code.startswith("K")
        and (len(code) == 3 or (3 <= len(code) <= 4 and any(ch.isdigit() for ch in code)))
    ):
        codes.add(f"K{code}")
    
    # Add version without K prefix
    if code.startswith("K") and 4 <= len(code) <= 5:
        codes.add(code[1:])
    
    return codes


def _extract_lat_lon(airport: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """
    Extract latitude and longitude from airport cache entry
    
    Handles various data formats:
    - GeoJSON geometry { coordinates: [lon, lat] }
    - Direct fields: lat/latitude, lon/longitude
    - String or number values
    
    Args:
        airport: Raw airport cache entry
    
    Returns:
        Tuple of (latitude, longitude) or (None, None) if not found
    """
    # Try GeoJSON format first
    if "geometry" in airport and isinstance(airport["geometry"], dict):
        coords = airport["geometry"].get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            lon, lat = coords
            return _to_float(lat), _to_float(lon)
    
    # Try direct fields
    lat = _to_float(airport.get("lat") or airport.get("latitude"))
    lon = _to_float(airport.get("lon") or airport.get("longitude"))
    return lat, lon


def _to_float(value: Any) -> Optional[float]:
    """
    Convert value to float, handling strings and null
    
    Args:
        value: Value to convert
    
    Returns:
        Float value or None if invalid
    """
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _normalize_airport(entry: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
    """
    Normalize raw airport cache entry to standard format
    
    Args:
        entry: Raw airport data
        lat: Latitude (already extracted)
        lon: Longitude (already extracted)
    
    Returns:
        Normalized airport dictionary
    """
    return {
        "icao": (entry.get("icao") or entry.get("icaoCode") or "").upper(),
        "iata": (entry.get("iata") or entry.get("iataCode") or "").upper(),
        "name": entry.get("name"),
        "city": entry.get("city") or "",
        "country": entry.get("country") or "",
        "latitude": float(lat),
        "longitude": float(lon),
        "elevation": _to_float(entry.get("elevation")),
        "type": entry.get("type") or ""
    }


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate haversine distance between two points on Earth
    
    Args:
        lat1: Starting latitude in decimal degrees
        lon1: Starting longitude in decimal degrees
        lat2: Ending latitude in decimal degrees
        lon2: Ending longitude in decimal degrees
    
    Returns:
        Distance in nautical miles
    
    Examples:
        >>> # Distance from KSFO to KLAX
        >>> distance_nm = haversine_distance(37.619, -122.375, 33.942, -118.408)
        >>> print(round(distance_nm))  # ~337 nm
        337
    """
    R_NM = 3440.065  # Earth radius in nautical miles
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R_NM * c


def get_airport(code: str) -> Optional[Dict[str, Any]]:
    """
    Look up an airport by ICAO or IATA code
    
    Supports:
    - ICAO codes (4 letters, e.g., "KSFO")
    - IATA codes (3 letters, e.g., "SFO")
    - US FAA codes with automatic K-prefix handling (e.g., "PAO" → tries "KPAO")
    - Codes with descriptions (e.g., "KPAO - Palo Alto Airport")
    
    Args:
        code: Airport code (ICAO, IATA, or FAA)
    
    Returns:
        Airport dict or None if not found
    
    Examples:
        >>> sfo = get_airport("KSFO")
        >>> print(sfo['name'])
        San Francisco International Airport
        
        >>> pao = get_airport("PAO")  # Automatically tries "KPAO"
        >>> print(pao['icao'])
        KPAO
        
        >>> lax = get_airport("LAX")  # IATA code
        >>> print(lax['icao'])
        KLAX
    """
    code_upper = _normalize_airport_code(code)
    candidates = _candidate_codes(code_upper)
    
    airports = load_airport_cache()
    
    for airport in airports:
        icao = airport["icao"].upper()
        iata = airport["iata"].upper()
        
        # Check if any candidate matches ICAO or IATA
        if icao in candidates or iata in candidates:
            return airport
    
    return None


def search_airports(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search airports by text query
    
    Performs fuzzy search across:
    - ICAO codes
    - IATA codes
    - Airport names
    - City names
    - Country names
    
    Results are scored and sorted by relevance:
    - Exact code match: score 1.0
    - ICAO starts with query: score 0.95
    - IATA starts with query: score 0.9
    - Code contains query: score 0.85
    - Text contains query: score 0.65
    - Fuzzy match (SequenceMatcher): score 0.5-0.7
    
    Args:
        query: Search query (case-insensitive)
        limit: Maximum number of results (default: 10)
    
    Returns:
        List of airports sorted by relevance
    
    Examples:
        >>> results = search_airports("San Francisco", 5)
        >>> for airport in results:
        ...     print(f"{airport['icao']} - {airport['name']}")
        KSFO - San Francisco International Airport
        KHAF - Half Moon Bay Airport
        KOAK - Oakland International Airport
    """
    return search_airports_advanced(query=query, limit=limit)


def search_airports_advanced(
    *,
    query: Optional[str] = None,
    limit: int = 20,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_nm: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Advanced airport search with text query and/or proximity filtering
    
    Supports:
    - Text search (fuzzy matching across codes and names)
    - Proximity search (find airports near a point)
    - Radius filtering (limit to airports within X nm)
    - Combined text + proximity search
    
    Args:
        query: Search query (optional)
        limit: Maximum number of results (default: 20)
        lat: Reference latitude for proximity search (optional)
        lon: Reference longitude for proximity search (optional)
        radius_nm: Search radius in nautical miles (only with lat/lon, optional)
    
    Returns:
        List of airports sorted by relevance or proximity
    
    Examples:
        >>> # Text search
        >>> results = search_airports_advanced(query="San Francisco", limit=5)
        
        >>> # Proximity search (all airports within 50nm of SFO)
        >>> nearby = search_airports_advanced(
        ...     lat=37.619, lon=-122.375, radius_nm=50, limit=10
        ... )
        
        >>> # Combined search (airports matching "tower" within 30nm)
        >>> combined = search_airports_advanced(
        ...     query="tower", lat=37.62, lon=-122.38, radius_nm=30, limit=5
        ... )
        >>> print(combined[0].get('distance_nm'))  # Distance included in results
        12.34
    """
    q = (query or "").strip().lower()
    has_geo = lat is not None and lon is not None
    
    # Require either query or geo search
    if not q and not has_geo:
        return []
    
    airports = load_airport_cache()
    candidates: List[Tuple[float, float, Dict[str, Any]]] = []  # [score, distance, airport]
    seen: Set[str] = set()
    
    for airport in airports:
        icao = airport["icao"].upper()
        iata = airport["iata"].upper()
        alt_codes = _candidate_codes(icao)
        name = airport["name"] or ""
        city = airport["city"]
        country = airport["country"]
        
        # Calculate distance if geo search
        dist_nm: Optional[float] = None
        if has_geo:
            dist_nm = haversine_distance(lat, lon, airport["latitude"], airport["longitude"])
            
            # Filter by radius if specified
            if radius_nm is not None and dist_nm > radius_nm:
                continue
        
        # Deduplicate by key
        key = icao or iata or f"{airport['latitude']},{airport['longitude']}"
        if key in seen:
            continue
        seen.add(key)
        
        # Calculate text search score
        score = 0.0
        if q:
            # Build searchable strings
            all_codes = sorted({icao, iata, *alt_codes})
            code_hay = " ".join(all_codes).lower()
            text_hay = f"{code_hay} {name} {city} {country}".lower()
            
            # Exact code match
            if q in {c.lower() for c in {icao, iata, *alt_codes} if c}:
                score = 1.0
            # ICAO starts with query
            elif icao.lower().startswith(q):
                score = 0.95
            # IATA starts with query
            elif iata.lower().startswith(q):
                score = 0.9
            # Code contains query
            elif q in code_hay:
                score = 0.85
            # Text contains query
            elif q in text_hay:
                score = 0.65
            # Fuzzy match
            else:
                ratio = max(
                    difflib.SequenceMatcher(None, q, icao.lower()).ratio(),
                    difflib.SequenceMatcher(None, q, iata.lower()).ratio(),
                    difflib.SequenceMatcher(None, q, name.lower()).ratio()
                )
                
                if ratio < 0.6:
                    continue  # Skip low matches
                
                score = 0.5 + (ratio - 0.6) * 0.5
        
        # Clone airport and add distance if geo search
        result = dict(airport)
        if dist_nm is not None:
            result["distance_nm"] = round(dist_nm, 2)
        
        candidates.append((score, dist_nm if dist_nm is not None else float("inf"), result))
    
    # Sort by score (desc) then distance (asc)
    if has_geo and not q:
        # Proximity search only: sort by distance
        candidates.sort(key=lambda t: t[1])
    else:
        # Text search or combined: sort by score then distance
        candidates.sort(key=lambda t: (-t[0], t[1]))
    
    # Return top results
    return [item[2] for item in candidates[:limit]]
