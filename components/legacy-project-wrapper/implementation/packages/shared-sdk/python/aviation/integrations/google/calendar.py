"""
Google Calendar Integration - Calendar API Client
Python implementation matching TypeScript API
"""

from typing import List, Optional, Dict, Any
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .auth import GoogleCalendarAuth
from .types import GoogleCredentials, CalendarEvent, ListEventsOptions


class GoogleCalendarClient:
    """Google Calendar API client"""
    
    def __init__(self, auth: GoogleCalendarAuth, credentials: Optional[GoogleCredentials] = None):
        self.auth = auth
        self.credentials = credentials
        self._service = None
    
    def set_credentials(self, credentials: GoogleCredentials) -> None:
        """Set credentials for API calls"""
        self.credentials = credentials
        self._service = None  # Reset service to reinitialize with new credentials
    
    def _get_service(self):
        """Get or create Google Calendar service"""
        if self._service:
            return self._service
        
        if not self.credentials:
            raise ValueError('No credentials available')
        
        # Ensure credentials are valid
        self.credentials = self.auth.ensure_valid_credentials(self.credentials)
        
        # Convert to google.oauth2.credentials.Credentials
        expiry = None
        if self.credentials.expiry_date:
            from datetime import datetime
            expiry = datetime.fromtimestamp(self.credentials.expiry_date / 1000)
        
        creds = Credentials(
            token=self.credentials.access_token,
            refresh_token=self.credentials.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=self.auth.config.client_id,
            client_secret=self.auth.config.client_secret,
            scopes=self.auth.config.scopes,
        )
        if expiry:
            creds.expiry = expiry
        
        self._service = build('calendar', 'v3', credentials=creds)
        return self._service
    
    def list_calendars(self) -> List[Dict[str, Any]]:
        """List all calendars"""
        try:
            service = self._get_service()
            calendar_list = service.calendarList().list().execute()
            return calendar_list.get('items', [])
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def get_calendar(self, calendar_id: str = 'primary') -> Dict[str, Any]:
        """Get a specific calendar"""
        try:
            service = self._get_service()
            calendar = service.calendars().get(calendarId=calendar_id).execute()
            return calendar
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def list_events(
        self,
        calendar_id: str = 'primary',
        options: Optional[ListEventsOptions] = None
    ) -> List[CalendarEvent]:
        """
        List events in a calendar
        
        Args:
            calendar_id: Calendar ID (default: 'primary')
            options: Filter options
            
        Returns:
            List of calendar events
        """
        try:
            service = self._get_service()
            
            # Build query parameters
            params = {'calendarId': calendar_id}
            
            if options:
                if options.timeMin:
                    params['timeMin'] = options.timeMin.isoformat()
                if options.timeMax:
                    params['timeMax'] = options.timeMax.isoformat()
                if options.maxResults:
                    params['maxResults'] = options.maxResults
                if options.orderBy:
                    params['orderBy'] = options.orderBy
                    params['singleEvents'] = True  # Required for orderBy
                if options.q:
                    params['q'] = options.q
                if options.singleEvents is not None:
                    params['singleEvents'] = options.singleEvents
                if options.showDeleted is not None:
                    params['showDeleted'] = options.showDeleted
            
            events_result = service.events().list(**params).execute()
            events_data = events_result.get('items', [])
            
            return [CalendarEvent.from_dict(event) for event in events_data]
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def get_event(self, event_id: str, calendar_id: str = 'primary') -> CalendarEvent:
        """Get a specific event"""
        try:
            service = self._get_service()
            event = service.events().get(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
            return CalendarEvent.from_dict(event)
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def create_event(
        self,
        event: CalendarEvent,
        calendar_id: str = 'primary'
    ) -> CalendarEvent:
        """
        Create a new calendar event
        
        Args:
            event: Event data
            calendar_id: Calendar ID (default: 'primary')
            
        Returns:
            Created event with ID
        """
        try:
            service = self._get_service()
            created = service.events().insert(
                calendarId=calendar_id,
                body=event.to_dict()
            ).execute()
            return CalendarEvent.from_dict(created)
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def update_event(
        self,
        event_id: str,
        event: CalendarEvent,
        calendar_id: str = 'primary'
    ) -> CalendarEvent:
        """
        Update an existing calendar event
        
        Args:
            event_id: Event ID to update
            event: Updated event data
            calendar_id: Calendar ID (default: 'primary')
            
        Returns:
            Updated event
        """
        try:
            service = self._get_service()
            updated = service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event.to_dict()
            ).execute()
            return CalendarEvent.from_dict(updated)
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def patch_event(
        self,
        event_id: str,
        updates: Dict[str, Any],
        calendar_id: str = 'primary'
    ) -> CalendarEvent:
        """
        Partially update an event (PATCH)
        
        Args:
            event_id: Event ID to update
            updates: Partial event data to update
            calendar_id: Calendar ID (default: 'primary')
            
        Returns:
            Updated event
        """
        try:
            service = self._get_service()
            updated = service.events().patch(
                calendarId=calendar_id,
                eventId=event_id,
                body=updates
            ).execute()
            return CalendarEvent.from_dict(updated)
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def delete_event(self, event_id: str, calendar_id: str = 'primary') -> None:
        """
        Delete a calendar event
        
        Args:
            event_id: Event ID to delete
            calendar_id: Calendar ID (default: 'primary')
        """
        try:
            service = self._get_service()
            service.events().delete(
                calendarId=calendar_id,
                eventId=event_id
            ).execute()
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def quick_add(self, text: str, calendar_id: str = 'primary') -> CalendarEvent:
        """
        Quick add event using natural language
        
        Args:
            text: Natural language text describing the event
            calendar_id: Calendar ID (default: 'primary')
            
        Returns:
            Created event
            
        Example:
            client.quick_add('Appointment at Somewhere on June 3rd 10am-10:25am')
        """
        try:
            service = self._get_service()
            event = service.events().quickAdd(
                calendarId=calendar_id,
                text=text
            ).execute()
            return CalendarEvent.from_dict(event)
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
    
    def get_free_busy(
        self,
        time_min,
        time_max,
        items: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Get free/busy information for calendars
        
        Args:
            time_min: Start time
            time_max: End time
            items: List of calendar IDs to check (e.g., [{'id': 'primary'}])
            
        Returns:
            Free/busy information
        """
        try:
            service = self._get_service()
            
            body = {
                'timeMin': time_min.isoformat() if hasattr(time_min, 'isoformat') else time_min,
                'timeMax': time_max.isoformat() if hasattr(time_max, 'isoformat') else time_max,
                'items': items,
            }
            
            freebusy = service.freebusy().query(body=body).execute()
            return freebusy
        except HttpError as e:
            raise Exception(f'Google Calendar API error: {e}')
