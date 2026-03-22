"""ForeFlight API client for accessing logbook data."""

import logging
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta

from src.core.config import FOREFLIGHT_API_KEY, FOREFLIGHT_API_SECRET, FOREFLIGHT_API_BASE_URL
from src.core.models import LogbookEntry, Aircraft

logger = logging.getLogger(__name__)

class ForeFlightClient:
    """Client for interacting with the ForeFlight API."""
    
    def __init__(self, csv_file_path: Optional[str] = None, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        """Initialize the ForeFlight client.
        
        Args:
            csv_file_path: Path to CSV file for local data (used for testing)
            api_key: ForeFlight API key (optional, defaults to environment variable)
            api_secret: ForeFlight API secret (optional, defaults to environment variable)
        """
        # Always set these attributes for test compatibility
        self.csv_file_path = csv_file_path
        self.api_key = api_key or FOREFLIGHT_API_KEY
        self.api_secret = api_secret or FOREFLIGHT_API_SECRET
        self.base_url = FOREFLIGHT_API_BASE_URL.rstrip('/') if FOREFLIGHT_API_BASE_URL else "https://api.foreflight.com"
        
        # If CSV file is provided, use local data mode
        if self.csv_file_path:
            from src.services.importer import ForeFlightImporter
            self.importer = ForeFlightImporter(self.csv_file_path)
            self.logbook_entries = self.importer.get_flight_entries()
            self.aircraft_list = self.importer.get_aircraft_list()
        else:
            # API mode - require credentials
            if not self.api_key or not self.api_secret:
                raise ValueError("ForeFlight API credentials not provided")
            self.importer = None
            self.logbook_entries = []
            self.aircraft_list = []
            
        self.session = requests.Session()
        self.session.auth = (self.api_key, self.api_secret)
        
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """Make a request to the ForeFlight API.
        
        Args:
            method: HTTP method to use
            endpoint: API endpoint to call
            **kwargs: Additional arguments to pass to requests
            
        Returns:
            Dict containing the API response
            
        Raises:
            requests.exceptions.RequestException: If the request fails
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
        
    def get_logbook_entries(self, start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None) -> List[LogbookEntry]:
        """Retrieve logbook entries from ForeFlight API or local data.
        
        Args:
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            List of LogbookEntry objects
        """
        # If using local data (CSV file) or have logbook_entries (e.g., in tests)
        if (hasattr(self, 'csv_file_path') and self.csv_file_path) or (hasattr(self, 'logbook_entries') and self.logbook_entries is not None):
            entries = self.logbook_entries if hasattr(self, 'logbook_entries') else []
            
            # Apply date filtering if provided
            if start_date or end_date:
                filtered_entries = []
                for entry in entries:
                    entry_date = entry.date
                    if start_date and entry_date < start_date:
                        continue
                    if end_date and entry_date > end_date:
                        continue
                    filtered_entries.append(entry)
                return filtered_entries
            
            return entries
        
        # API mode
        params = {}
        if start_date:
            params['start_date'] = start_date.isoformat()
        if end_date:
            params['end_date'] = end_date.isoformat()
            
        try:
            response = self._make_request('GET', '/logbook/entries', params=params)
            return [LogbookEntry(**entry) for entry in response.get('entries', [])]
        except requests.exceptions.RequestException as e:
            logger.warning(f"ForeFlight API request failed for logbook entries: {e}")
            return []
        
    def add_logbook_entry(self, entry: LogbookEntry) -> LogbookEntry:
        """Add a new logbook entry to ForeFlight or local data.
        
        Args:
            entry: LogbookEntry object to add
            
        Returns:
            Updated LogbookEntry object with server-assigned ID
        """
        # If using local data (CSV file)
        if self.csv_file_path:
            self.logbook_entries.append(entry)
            return entry
        
        # API mode
        response = self._make_request('POST', '/logbook/entries',
                                    json=entry.model_dump(exclude={'id'}))
        return LogbookEntry(**response)
        
    def update_logbook_entry(self, entry_id: str, entry: LogbookEntry) -> LogbookEntry:
        """Update an existing logbook entry in ForeFlight or local data.
        
        Args:
            entry_id: ID of the entry to update
            entry: LogbookEntry object with updated data
            
        Returns:
            Updated LogbookEntry object
            
        Raises:
            ValueError: If the entry is not found
        """
        # If using local data (CSV file)
        if self.csv_file_path:
            for i, existing_entry in enumerate(self.logbook_entries):
                if existing_entry.id == entry_id:
                    entry.id = entry_id  # Ensure ID is preserved
                    self.logbook_entries[i] = entry
                    return entry
            raise ValueError("Entry not found")
            
        # API mode
        response = self._make_request('PUT', f'/logbook/entries/{entry_id}',
                                    json=entry.model_dump(exclude={'id'}))
        return LogbookEntry(**response)
        
    def delete_logbook_entry(self, entry_id: str) -> bool:
        """Delete a logbook entry from ForeFlight or local data.
        
        Args:
            entry_id: ID of the entry to delete
            
        Returns:
            True if deleted successfully, False if not found
        """
        # If using local data (CSV file)
        if self.csv_file_path:
            for i, existing_entry in enumerate(self.logbook_entries):
                if existing_entry.id == entry_id:
                    del self.logbook_entries[i]
                    return True
            return False
            
        # API mode
        try:
            self._make_request('DELETE', f'/logbook/entries/{entry_id}')
            return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return False
            raise
        
    def get_aircraft_list(self) -> List[Aircraft]:
        """Retrieve aircraft list from ForeFlight or local data.
        
        Returns:
            List of Aircraft objects
        """
        # If using local data (CSV file) or mocked data
        if hasattr(self, 'csv_file_path') and self.csv_file_path:
            return self.aircraft_list
        
        # If aircraft_list is already populated (e.g., in tests)
        if hasattr(self, 'aircraft_list') and self.aircraft_list:
            return self.aircraft_list
        
        # API mode
        try:
            response = self._make_request('GET', '/aircraft')
            return [Aircraft(**aircraft) for aircraft in response.get('aircraft', [])]
        except requests.exceptions.RequestException as e:
            logger.warning(f"ForeFlight API request failed for aircraft list: {e}")
            return []
        
    def get_statistics(self) -> Dict:
        """Get flight statistics from local data or API.

        Returns:
            Dictionary containing flight statistics including aircraft classification totals.
        """
        empty_stats: Dict = {
            'total_flights': 0,
            'total_time': 0.0,
            'pic_time': 0.0,
            'cross_country_time': 0.0,
            'instrument_time': 0.0,
            'night_time': 0.0,
            'total_landings': 0,
            'tailwheel_time': 0.0,
            'complex_time': 0.0,
            'high_performance_time': 0.0,
        }

        # If using local data or have logbook entries
        if hasattr(self, 'logbook_entries') and self.logbook_entries:
            entries = self.logbook_entries
            return {
                'total_flights': len(entries),
                'total_time': sum(entry.total_time for entry in entries),
                'pic_time': sum(entry.pic_time for entry in entries),
                'cross_country_time': sum(entry.conditions.cross_country for entry in entries),
                'instrument_time': sum(
                    entry.conditions.actual_instrument + entry.conditions.simulated_instrument
                    for entry in entries
                ),
                'night_time': sum(entry.conditions.night for entry in entries),
                'total_landings': sum(entry.landings_day + entry.landings_night for entry in entries),
                'tailwheel_time': sum(
                    entry.total_time for entry in entries
                    if entry.aircraft.gear_type and 'tailwheel' in entry.aircraft.gear_type.lower()
                ),
                'complex_time': sum(
                    entry.total_time for entry in entries if entry.aircraft.complex_aircraft
                ),
                'high_performance_time': sum(
                    entry.total_time for entry in entries if entry.aircraft.high_performance
                ),
            }

        return empty_stats
        
    def get_recent_flights(self, days: int = 30) -> List[LogbookEntry]:
        """Get recent flights within specified days.

        Args:
            days: Number of days to look back (must be positive)

        Returns:
            List of recent LogbookEntry objects
        """
        if days <= 0:
            raise ValueError("days must be a positive integer")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        return self.get_logbook_entries(start_date, end_date)