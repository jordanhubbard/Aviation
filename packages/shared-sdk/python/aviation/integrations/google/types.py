"""
Google Calendar Integration - Type Definitions
Python types matching TypeScript implementation
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime


@dataclass
class GoogleCredentials:
    """OAuth2 credentials for Google Calendar"""
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None
    expiry_date: Optional[int] = None  # Unix timestamp in milliseconds
    scope: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'access_token': self.access_token,
            'token_type': self.token_type,
            'refresh_token': self.refresh_token,
            'expiry_date': self.expiry_date,
            'scope': self.scope,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GoogleCredentials':
        """Create from dictionary"""
        return cls(
            access_token=data['access_token'],
            token_type=data['token_type'],
            refresh_token=data.get('refresh_token'),
            expiry_date=data.get('expiry_date'),
            scope=data.get('scope'),
        )


@dataclass
class GoogleOAuthConfig:
    """OAuth2 configuration"""
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: List[str] = field(default_factory=lambda: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
    ])


@dataclass
class CalendarDateTime:
    """Calendar event date/time"""
    dateTime: Optional[str] = None  # ISO 8601 format
    date: Optional[str] = None  # YYYY-MM-DD format for all-day events
    timeZone: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API calls"""
        result = {}
        if self.dateTime:
            result['dateTime'] = self.dateTime
        if self.date:
            result['date'] = self.date
        if self.timeZone:
            result['timeZone'] = self.timeZone
        return result


@dataclass
class CalendarEvent:
    """Calendar event"""
    summary: str
    start: CalendarDateTime
    end: CalendarDateTime
    id: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    recurrence: Optional[List[str]] = None
    reminders: Optional[Dict[str, Any]] = None
    colorId: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API calls"""
        result = {
            'summary': self.summary,
            'start': self.start.to_dict(),
            'end': self.end.to_dict(),
        }
        if self.id:
            result['id'] = self.id
        if self.description:
            result['description'] = self.description
        if self.location:
            result['location'] = self.location
        if self.recurrence:
            result['recurrence'] = self.recurrence
        if self.reminders:
            result['reminders'] = self.reminders
        if self.colorId:
            result['colorId'] = self.colorId
        if self.status:
            result['status'] = self.status
        if self.visibility:
            result['visibility'] = self.visibility
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CalendarEvent':
        """Create from API response"""
        start_data = data['start']
        end_data = data['end']
        
        return cls(
            id=data.get('id'),
            summary=data.get('summary', ''),
            description=data.get('description'),
            location=data.get('location'),
            start=CalendarDateTime(
                dateTime=start_data.get('dateTime'),
                date=start_data.get('date'),
                timeZone=start_data.get('timeZone'),
            ),
            end=CalendarDateTime(
                dateTime=end_data.get('dateTime'),
                date=end_data.get('date'),
                timeZone=end_data.get('timeZone'),
            ),
            recurrence=data.get('recurrence'),
            reminders=data.get('reminders'),
            colorId=data.get('colorId'),
            status=data.get('status'),
            visibility=data.get('visibility'),
        )


@dataclass
class ListEventsOptions:
    """Options for listing events"""
    timeMin: Optional[datetime] = None
    timeMax: Optional[datetime] = None
    maxResults: Optional[int] = None
    orderBy: Optional[str] = None  # 'startTime' or 'updated'
    q: Optional[str] = None  # Free text search
    singleEvents: Optional[bool] = None
    showDeleted: Optional[bool] = None
