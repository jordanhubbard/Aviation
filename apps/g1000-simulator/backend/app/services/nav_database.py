# nav_database.py

from typing import List, Dict, Any, Optional


class Navaid:
    """Navigation aid (VOR, NDB, etc.)."""
    def __init__(self, identifier: str, name: str, navaid_type: str, 
                 latitude: float, longitude: float, frequency: str = None):
        self.identifier = identifier
        self.name = name
        self.type = navaid_type
        self.latitude = latitude
        self.longitude = longitude
        self.frequency = frequency

    def to_dict(self) -> Dict[str, Any]:
        return {
            'identifier': self.identifier,
            'name': self.name,
            'type': self.type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'frequency': self.frequency
        }


class Airport:
    """Airport information."""
    def __init__(self, icao: str, iata: str, name: str, 
                 latitude: float, longitude: float, elevation: int):
        self.icao = icao
        self.iata = iata
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
        self.elevation = elevation

    def to_dict(self) -> Dict[str, Any]:
        return {
            'icao': self.icao,
            'iata': self.iata,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'elevation': self.elevation
        }


class NavigationDatabaseService:
    """Service for accessing navigation database."""
    
    def __init__(self):
        self.navaids: Dict[str, Navaid] = {}
        self.airports: Dict[str, Airport] = {}
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample navigation data."""
        # Sample airports
        self.airports['KJFK'] = Airport(
            icao='KJFK', iata='JFK', name='John F. Kennedy International',
            latitude=40.6413, longitude=-73.7781, elevation=13
        )
        self.airports['KLAX'] = Airport(
            icao='KLAX', iata='LAX', name='Los Angeles International',
            latitude=33.9425, longitude=-118.4081, elevation=125
        )
        
        # Sample navaids
        self.navaids['JFK'] = Navaid(
            identifier='JFK', name='JFK VOR', navaid_type='VOR',
            latitude=40.6413, longitude=-73.7781, frequency='110.9'
        )

    def search(self, query: str) -> Dict[str, List[Dict[str, Any]]]:
        """Search the navigation database.
        
        Args:
            query: Search query (airport code, navaid identifier, etc.)
            
        Returns:
            Dictionary with 'airports' and 'navaids' lists
        """
        query_upper = query.upper()
        
        airports = [
            airport.to_dict() for airport in self.airports.values()
            if query_upper in airport.icao or query_upper in airport.iata or 
               query_upper in airport.name.upper()
        ]
        
        navaids = [
            navaid.to_dict() for navaid in self.navaids.values()
            if query_upper in navaid.identifier or query_upper in navaid.name.upper()
        ]
        
        return {
            'airports': airports,
            'navaids': navaids
        }

    def get_procedures(self, airport_code: str) -> Dict[str, Any]:
        """Get procedures for a specific airport.
        
        Args:
            airport_code: ICAO airport code
            
        Returns:
            Dictionary with SIDs, STARs, and approaches
        """
        airport = self.airports.get(airport_code)
        if not airport:
            return {'error': f'Airport {airport_code} not found'}
        
        return {
            'airport': airport.to_dict(),
            'sids': self._get_sids(airport_code),
            'stars': self._get_stars(airport_code),
            'approaches': self._get_approaches(airport_code)
        }

    def _get_sids(self, airport_code: str) -> List[Dict[str, Any]]:
        """Get Standard Instrument Departures for an airport."""
        # Placeholder implementation
        return [
            {'name': 'DEPARTURE1', 'runway': '04L', 'initial_altitude': 2000},
            {'name': 'DEPARTURE2', 'runway': '04R', 'initial_altitude': 2000}
        ]

    def _get_stars(self, airport_code: str) -> List[Dict[str, Any]]:
        """Get Standard Terminal Arrival Routes for an airport."""
        # Placeholder implementation
        return [
            {'name': 'ARRIVAL1', 'runway': '22L', 'initial_altitude': 5000},
            {'name': 'ARRIVAL2', 'runway': '22R', 'initial_altitude': 5000}
        ]

    def _get_approaches(self, airport_code: str) -> List[Dict[str, Any]]:
        """Get approach procedures for an airport."""
        # Placeholder implementation
        return [
            {'name': 'ILS 04L', 'type': 'ILS', 'runway': '04L'},
            {'name': 'VOR 22L', 'type': 'VOR', 'runway': '22L'}
        ]
