# procedures.py

from typing import List, Dict, Any


class Procedure:
    """Represents a flight procedure (SID, STAR, or approach)."""
    def __init__(self, name: str, procedure_type: str, runway: str, 
                 initial_altitude: int = None, waypoints: List[str] = None):
        self.name = name
        self.type = procedure_type
        self.runway = runway
        self.initial_altitude = initial_altitude
        self.waypoints = waypoints or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'type': self.type,
            'runway': self.runway,
            'initial_altitude': self.initial_altitude,
            'waypoints': self.waypoints
        }


class ProceduresService:
    """Service for managing flight procedures."""
    
    def __init__(self):
        self.procedures = {}
        self._initialize_sample_procedures()

    def _initialize_sample_procedures(self):
        """Initialize with sample procedures."""
        # Sample SIDs for KJFK
        self.procedures['KJFK_SID'] = [
            Procedure('CANDLE', 'SID', '04L', 2000, ['CANDLE', 'GREKI']),
            Procedure('CANDLE', 'SID', '04R', 2000, ['CANDLE', 'GREKI']),
            Procedure('SKYWAY', 'SID', '22L', 2000, ['SKYWAY', 'BETTE']),
            Procedure('SKYWAY', 'SID', '22R', 2000, ['SKYWAY', 'BETTE'])
        ]
        
        # Sample STARs for KJFK
        self.procedures['KJFK_STAR'] = [
            Procedure('CAVEN', 'STAR', '04L', 5000, ['CAVEN', 'MERTZ']),
            Procedure('CAVEN', 'STAR', '04R', 5000, ['CAVEN', 'MERTZ']),
            Procedure('WHITPAIN', 'STAR', '22L', 5000, ['WHITPAIN', 'LNSKY']),
            Procedure('WHITPAIN', 'STAR', '22R', 5000, ['WHITPAIN', 'LNSKY'])
        ]
        
        # Sample approaches for KJFK
        self.procedures['KJFK_APPROACH'] = [
            Procedure('ILS 04L', 'ILS', '04L', None, ['APPROACH', 'FINAL']),
            Procedure('ILS 04R', 'ILS', '04R', None, ['APPROACH', 'FINAL']),
            Procedure('ILS 22L', 'ILS', '22L', None, ['APPROACH', 'FINAL']),
            Procedure('ILS 22R', 'ILS', '22R', None, ['APPROACH', 'FINAL']),
            Procedure('VOR 04L', 'VOR', '04L', None, ['VOR', 'FINAL']),
            Procedure('VOR 22L', 'VOR', '22L', None, ['VOR', 'FINAL'])
        ]

    def get_sid(self, airport_code: str, runway: str = None) -> List[Dict[str, Any]]:
        """Get Standard Instrument Departure procedures.
        
        Args:
            airport_code: ICAO airport code
            runway: Optional runway designation (e.g., '04L')
            
        Returns:
            List of SID procedures
        """
        key = f'{airport_code}_SID'
        procedures = self.procedures.get(key, [])
        
        if runway:
            procedures = [p for p in procedures if p.runway == runway]
        
        return [p.to_dict() for p in procedures]

    def get_star(self, airport_code: str, runway: str = None) -> List[Dict[str, Any]]:
        """Get Standard Terminal Arrival Route procedures.
        
        Args:
            airport_code: ICAO airport code
            runway: Optional runway designation (e.g., '04L')
            
        Returns:
            List of STAR procedures
        """
        key = f'{airport_code}_STAR'
        procedures = self.procedures.get(key, [])
        
        if runway:
            procedures = [p for p in procedures if p.runway == runway]
        
        return [p.to_dict() for p in procedures]

    def get_approach(self, airport_code: str, runway: str = None) -> List[Dict[str, Any]]:
        """Get approach procedures.
        
        Args:
            airport_code: ICAO airport code
            runway: Optional runway designation (e.g., '04L')
            
        Returns:
            List of approach procedures
        """
        key = f'{airport_code}_APPROACH'
        procedures = self.procedures.get(key, [])
        
        if runway:
            procedures = [p for p in procedures if p.runway == runway]
        
        return [p.to_dict() for p in procedures]

    def get_all_procedures(self, airport_code: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get all procedures for an airport.
        
        Args:
            airport_code: ICAO airport code
            
        Returns:
            Dictionary with 'sids', 'stars', and 'approaches'
        """
        return {
            'sids': self.get_sid(airport_code),
            'stars': self.get_star(airport_code),
            'approaches': self.get_approach(airport_code)
        }
