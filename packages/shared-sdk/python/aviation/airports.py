"""
Airport Database and Search

Provides airport lookup, search, and geospatial queries for aviation applications.
Extracted from flightplanner for shared use across the monorepo.
"""

import difflib
import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


class Airport(Dict[str, Any]):
    """Airport data structure (dictionary with typed access)."""
    
    @property
    def icao(self) -> str:
        return self.get('icao', '')
    
    @property
    def iata(self) -> str:
        return self.get('iata', '')
    
    @property
    def name(self) -> str:
        return self.get('name', '')
    
    @property
    def city(self) -> str:
        return self.get('city', '')
    
    @property
    def country(self) -> str:
        return self.get('country', '')
    
    @property
    def latitude(self) -> float:
        return self.get('latitude', 0.0)
    
    @property
    def longitude(self) -> float:
        return self.get('longitude', 0.0)
    
    @property
    def elevation(self) -> Optional[float]:
        return self.get('elevation')
    
    @property
    def type(self) -> str:
        return self.get('type', '')
    
    @property
    def distance_nm(self) -> Optional[float]:
        return self.get('distance_nm')


class AirportDatabase:
    """Airport database for loading, caching, and searching airports."""
    
    def __init__(self, data_path: Optional[str] = None):
        """
        Initialize airport database.
        
        Args:
            data_path: Path to airports_cache.json file. If None, uses default location.
        """
        if data_path:
            self.data_path = Path(data_path)
        else:
            # Default: packages/shared-sdk/data/airports_cache.json
            self.data_path = Path(__file__).parent.parent.parent / 'data' / 'airports_cache.json'
        
        self.airports: List[Dict[str, Any]] = []
        self.loaded = False
    
    def _load_airports(self) -> None:
        """Load airport data from JSON file."""
        if self.loaded:
            return
        
        try:
            with open(self.data_path, 'r', encoding='utf-8') as f:
                self.airports = json.load(f)
            self.loaded = True
        except Exception as e:
            print(f"Failed to load airport data: {e}")
            self.airports = []
    
    @staticmethod
    def _normalize_airport_code(value: str) -> str:
        """
        Extract leading airport code from user-provided strings.
        
        Accepts inputs like "KPAO - Palo Alto Airport" and returns "KPAO".
        """
        if not value:
            return ""
        
        before_dash = re.split(r"\s*[-–—]\s*", value.strip(), maxsplit=1)[0]
        token = before_dash.strip().split()[0] if before_dash.strip() else ""
        token_u = token.upper()
        
        if re.fullmatch(r"[A-Z0-9]{3,5}", token_u):
            return token_u
        
        return value.strip().upper()
    
    @staticmethod
    def _candidate_codes(code_u: str) -> Set[str]:
        """
        Generate candidate codes for lookup.
        
        Handles K-prefix for US airports (e.g., 7S5 -> K7S5).
        """
        codes = {code_u}
        
        # US local identifiers as pseudo-ICAO codes prefixed with 'K'
        if (
            code_u
            and not code_u.startswith("K")
            and (len(code_u) == 3 or (3 <= len(code_u) <= 4 and any(ch.isdigit() for ch in code_u)))
        ):
            codes.add(f"K{code_u}")
        
        # Also try without K prefix
        if code_u.startswith("K") and 4 <= len(code_u) <= 5:
            codes.add(code_u[1:])
        
        return codes
    
    @staticmethod
    def _extract_lat_lon(airport: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
        """Extract latitude and longitude from airport data."""
        # Try geometry.coordinates first (GeoJSON format)
        if "geometry" in airport and isinstance(airport["geometry"], dict):
            coords = airport["geometry"].get("coordinates")
            if isinstance(coords, list) and len(coords) == 2:
                lon, lat = coords
                return AirportDatabase._to_float(lat), AirportDatabase._to_float(lon)
        
        # Try direct latitude/longitude fields
        return (
            AirportDatabase._to_float(airport.get("lat") or airport.get("latitude")),
            AirportDatabase._to_float(airport.get("lon") or airport.get("longitude"))
        )
    
    @staticmethod
    def _to_float(v: Any) -> Optional[float]:
        """Convert value to float, returning None if invalid."""
        if v is None:
            return None
        try:
            return float(v)
        except Exception:
            return None
    
    @staticmethod
    def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate haversine distance in nautical miles."""
        R_NM = 3440.065  # Earth radius in nautical miles
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R_NM * c
    
    def get_airport_coordinates(self, code: str) -> Optional[Airport]:
        """
        Get airport coordinates by ICAO or IATA code.
        
        Args:
            code: ICAO or IATA airport code
            
        Returns:
            Airport data or None if not found
        """
        self._load_airports()
        
        code_u = self._normalize_airport_code(code)
        candidates = self._candidate_codes(code_u)
        
        for airport in self.airports:
            icao_code = (airport.get("icao") or airport.get("icaoCode") or "").upper()
            iata_code = (airport.get("iata") or airport.get("iataCode") or "").upper()
            
            if not ({icao_code, iata_code} & candidates):
                continue
            
            lat, lon = self._extract_lat_lon(airport)
            if lat is None or lon is None:
                continue
            
            return Airport({
                "icao": icao_code,
                "iata": iata_code,
                "name": airport.get("name"),
                "city": airport.get("city") or "",
                "country": airport.get("country") or "",
                "latitude": float(lat),
                "longitude": float(lon),
                "elevation": airport.get("elevation"),
                "type": airport.get("type") or "",
            })
        
        return None
    
    def search_airports(
        self,
        *,
        query: Optional[str] = None,
        limit: int = 20,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius_nm: Optional[float] = None,
    ) -> List[Airport]:
        """
        Search airports by query string and/or proximity.
        
        Args:
            query: Search query (airport code, name, city, country)
            limit: Maximum number of results to return
            latitude: Latitude for proximity search
            longitude: Longitude for proximity search
            radius_nm: Maximum distance in nautical miles for proximity search
            
        Returns:
            List of matching airports sorted by relevance/distance
        """
        self._load_airports()
        
        q = (query or "").strip().lower()
        has_geo = latitude is not None and longitude is not None
        
        if not q and not has_geo:
            return []
        
        candidates: List[Tuple[float, float, Airport]] = []
        seen: Set[str] = set()
        
        for airport in self.airports:
            icao_code = (airport.get("icao") or airport.get("icaoCode") or "").upper()
            iata_code = (airport.get("iata") or airport.get("iataCode") or "").upper()
            alt_codes = self._candidate_codes(icao_code)
            name = str(airport.get("name") or "")
            city = str(airport.get("city") or "")
            country = str(airport.get("country") or "")
            
            lat_v, lon_v = self._extract_lat_lon(airport)
            if lat_v is None or lon_v is None:
                continue
            
            # Calculate distance if geo coordinates provided
            dist_nm: Optional[float] = None
            if has_geo:
                dist_nm = self._haversine_nm(float(latitude), float(longitude), float(lat_v), float(lon_v))
                if radius_nm is not None and dist_nm > float(radius_nm):
                    continue
            
            # Normalize airport data
            normalized = Airport({
                "icao": icao_code,
                "iata": iata_code,
                "name": airport.get("name") or "",
                "city": airport.get("city") or "",
                "country": airport.get("country") or "",
                "latitude": float(lat_v),
                "longitude": float(lon_v),
                "elevation": airport.get("elevation"),
                "type": airport.get("type") or "",
            })
            
            # Deduplicate by key
            key = (
                normalized["icao"]
                or normalized["iata"]
                or f"{normalized['latitude']},{normalized['longitude']}"
            )
            if key in seen:
                continue
            seen.add(key)
            
            # Calculate search score if query provided
            score = 0.0
            if q:
                code_hay = " ".join(sorted({icao_code, iata_code, *alt_codes})).lower()
                text_hay = f"{code_hay} {name} {city} {country}".lower()
                
                # Exact code match
                if q in {c.lower() for c in {icao_code, iata_code, *alt_codes} if c}:
                    score = 1.0
                # ICAO starts with query
                elif icao_code.lower().startswith(q):
                    score = 0.95
                # IATA starts with query
                elif iata_code.lower().startswith(q):
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
                        difflib.SequenceMatcher(None, q, icao_code.lower()).ratio(),
                        difflib.SequenceMatcher(None, q, iata_code.lower()).ratio(),
                        difflib.SequenceMatcher(None, q, name.lower()).ratio(),
                    )
                    if ratio < 0.6:
                        continue  # Skip low-quality matches
                    score = 0.5 + (ratio - 0.6) * 0.5
            
            # Add distance to result if available
            if dist_nm is not None:
                normalized["distance_nm"] = round(dist_nm, 2)
            
            candidates.append((score, dist_nm if dist_nm is not None else float("inf"), normalized))
        
        # Sort by score (descending) then distance (ascending)
        if has_geo and not q:
            # Proximity search only: sort by distance
            candidates.sort(key=lambda t: t[1])
        else:
            # Text search or combined: sort by score then distance
            candidates.sort(key=lambda t: (-t[0], t[1]))
        
        return [item[2] for item in candidates[:limit]]
    
    def search(self, query: str, limit: int = 20) -> List[Airport]:
        """
        Simple search by query string (convenience method).
        
        Args:
            query: Search query
            limit: Maximum results
            
        Returns:
            List of matching airports
        """
        return self.search_airports(query=query, limit=limit)
    
    def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_nm: float,
        limit: int = 20
    ) -> List[Airport]:
        """
        Find airports near a location.
        
        Args:
            latitude: Latitude
            longitude: Longitude
            radius_nm: Search radius in nautical miles
            limit: Maximum results
            
        Returns:
            List of nearby airports sorted by distance
        """
        return self.search_airports(
            latitude=latitude,
            longitude=longitude,
            radius_nm=radius_nm,
            limit=limit
        )
    
    def get_by_icao(self, icao: str) -> Optional[Airport]:
        """Get airport by ICAO code (convenience method)."""
        return self.get_airport_coordinates(icao)
    
    def get_by_iata(self, iata: str) -> Optional[Airport]:
        """Get airport by IATA code (convenience method)."""
        return self.get_airport_coordinates(iata)


# Singleton instance
_default_database: Optional[AirportDatabase] = None


def get_airport_database(data_path: Optional[str] = None) -> AirportDatabase:
    """Get or create the default airport database instance."""
    global _default_database
    if _default_database is None or data_path:
        _default_database = AirportDatabase(data_path)
    return _default_database


# Convenience functions using singleton
def search_airports(query: str, limit: int = 20) -> List[Airport]:
    """Search airports using the default database."""
    return get_airport_database().search(query, limit)


def get_airport_by_code(code: str) -> Optional[Airport]:
    """Get airport by ICAO or IATA code using the default database."""
    return get_airport_database().get_airport_coordinates(code)


def find_nearby_airports(
    latitude: float,
    longitude: float,
    radius_nm: float,
    limit: int = 20
) -> List[Airport]:
    """Find nearby airports using the default database."""
    return get_airport_database().find_nearby(latitude, longitude, radius_nm, limit)
