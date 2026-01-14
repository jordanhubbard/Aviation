"""
Airport Model - Migrated to Shared SDK

This module now imports from @aviation/shared-sdk for airport functionality.
Maintains backward compatibility with existing code.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# Import from shared SDK
import sys
import os

# Add shared SDK to path
sdk_path = os.path.join(os.path.dirname(__file__), '../../../../../packages/shared-sdk/python')
if sdk_path not in sys.path:
    sys.path.insert(0, sdk_path)

from aviation.airports import (
    load_airport_cache,
    get_airport_coordinates,
    search_airports as sdk_search_airports,
    search_airports_advanced,
)

# Re-export for backward compatibility
__all__ = [
    'load_airport_cache',
    'get_airport_coordinates',
    'search_airports',
    'search_airports_advanced',
]


def search_airports(
    query: str,
    limit: int = 20,
    **kwargs
) -> List[Dict[str, Any]]:
    """
    Search airports by code, name, or city.
    
    Wrapper around shared SDK function for backward compatibility.
    """
    return sdk_search_airports(query=query, limit=limit, **kwargs)
