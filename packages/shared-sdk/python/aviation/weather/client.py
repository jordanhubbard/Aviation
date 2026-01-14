"""
Python client for aviation weather services.

This wraps the TypeScript implementation via subprocess calls.
For production use in Python apps, consider using the native Python
implementations from flightplanner until this wrapper is more mature.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

FlightCategory = Literal["VFR", "MVFR", "IFR", "LIFR", "UNKNOWN"]


class WeatherClient:
    """
    Client for aviation weather services.
    
    This wraps the shared-sdk TypeScript implementation.
    """
    
    def __init__(self, sdk_path: Optional[str] = None):
        """
        Initialize weather client.
        
        Args:
            sdk_path: Path to shared-sdk package (auto-detected if None)
        """
        if sdk_path:
            self.sdk_path = Path(sdk_path)
        else:
            # Auto-detect SDK path relative to this file
            self.sdk_path = Path(__file__).parent.parent.parent.parent
    
    def _run_ts_script(self, script: str, *args: str) -> Dict[str, Any]:
        """
        Run a TypeScript script via Node.js.
        
        Args:
            script: Script name (relative to sdk/dist/aviation/weather/)
            *args: Arguments to pass to script
            
        Returns:
            JSON response from script
            
        Raises:
            RuntimeError: If script execution fails
        """
        script_path = self.sdk_path / "dist" / "aviation" / "weather" / script
        
        if not script_path.exists():
            raise RuntimeError(
                f"TypeScript script not found: {script_path}\n"
                f"Run 'npm run build' in {self.sdk_path}"
            )
        
        try:
            result = subprocess.run(
                ["node", str(script_path), *args],
                capture_output=True,
                text=True,
                check=True,
            )
            return json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Weather service error: {e.stderr}") from e
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Invalid JSON response: {e}") from e


# Helper functions for direct access (without instantiating WeatherClient)


def fetch_metar_raw(station: str) -> Optional[str]:
    """
    Fetch raw METAR for a single station.
    
    Args:
        station: ICAO station identifier
        
    Returns:
        Raw METAR string or None if unavailable
        
    Note:
        This is a simplified wrapper. For production use, consider using
        the native Python implementation from flightplanner.
    """
    # For now, import from flightplanner if available
    try:
        from app.services.metar import fetch_metar_raw as _fetch
        import asyncio
        return asyncio.run(_fetch(station))
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )


def fetch_metar_raws(stations: List[str]) -> Dict[str, Optional[str]]:
    """
    Fetch raw METARs for multiple stations.
    
    Args:
        stations: List of ICAO station identifiers
        
    Returns:
        Dict mapping station to raw METAR (None if unavailable)
    """
    try:
        from app.services.metar import fetch_metar_raws as _fetch
        return _fetch(stations)
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )


def parse_metar(raw: str) -> Dict[str, Any]:
    """
    Parse a METAR string.
    
    Args:
        raw: Raw METAR string
        
    Returns:
        Dict with parsed elements (wind, visibility, temperature, ceiling)
    """
    try:
        from app.services.metar import parse_metar as _parse
        return _parse(raw)
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )


def flight_category(
    visibility_sm: Optional[float],
    ceiling_ft: Optional[float],
) -> FlightCategory:
    """
    Determine flight category from ceiling and visibility.
    
    Args:
        visibility_sm: Visibility in statute miles
        ceiling_ft: Ceiling in feet AGL
        
    Returns:
        Flight category (VFR, MVFR, IFR, LIFR, UNKNOWN)
    """
    try:
        from app.services.flight_recommendations import flight_category as _cat
        return _cat(visibility_sm=visibility_sm, ceiling_ft=ceiling_ft)
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )


def recommendation_for_category(category: FlightCategory) -> str:
    """
    Get flight recommendation based on category.
    
    Args:
        category: Flight category
        
    Returns:
        Human-readable recommendation
    """
    try:
        from app.services.flight_recommendations import recommendation_for_category as _rec
        return _rec(category)
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )


def warnings_for_conditions(
    visibility_sm: Optional[float],
    ceiling_ft: Optional[float],
    wind_speed_kt: Optional[float],
) -> List[str]:
    """
    Get warnings for weather conditions.
    
    Args:
        visibility_sm: Visibility in statute miles
        ceiling_ft: Ceiling in feet AGL
        wind_speed_kt: Wind speed in knots
        
    Returns:
        List of warning messages
    """
    try:
        from app.services.flight_recommendations import warnings_for_conditions as _warn
        return _warn(
            visibility_sm=visibility_sm,
            ceiling_ft=ceiling_ft,
            wind_speed_kt=wind_speed_kt,
        )
    except ImportError:
        raise NotImplementedError(
            "Python wrapper not fully implemented. "
            "Use the TypeScript version or flightplanner's native implementation."
        )
