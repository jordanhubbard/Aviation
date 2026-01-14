"""
Google Calendar Service using Shared SDK
Wrapper around @aviation/shared-sdk Google Calendar integration
"""

import json
from typing import Optional
from flask import current_app, session
from app.models import Booking, User
from app import db

# Import shared SDK Google Calendar components
import sys
import os

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "../../..", "packages/shared-sdk/python")
)

from aviation.integrations.google import (
    GoogleCalendarAuth,
    GoogleCalendarClient,
    GoogleOAuthConfig,
    GoogleCredentials,
    CalendarEvent,
    CalendarDateTime,
)


SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


class GoogleCalendarService:
    """
    Google Calendar Service using shared SDK

    This replaces the old calendar_service.py with shared SDK implementation.
    Maintains API compatibility with existing code.
    """

    def __init__(self):
        self.auth: Optional[GoogleCalendarAuth] = None
        self.client: Optional[GoogleCalendarClient] = None
        self._initialize_auth()

    def _initialize_auth(self):
        """Initialize Google Calendar auth from Flask config"""
        config = GoogleOAuthConfig(
            client_id=current_app.config.get("GOOGLE_CLIENT_ID", ""),
            client_secret=current_app.config.get("GOOGLE_CLIENT_SECRET", ""),
            redirect_uri=current_app.config.get("GOOGLE_REDIRECT_URI", ""),
            scopes=SCOPES,
        )
        self.auth = GoogleCalendarAuth(config)
        self.client = GoogleCalendarClient(self.auth)

    def get_authorization_url(self) -> str:
        """
        Generate the authorization URL for Google Calendar.

        Returns:
            Authorization URL to redirect user to
        """
        if not self.auth:
            raise Exception("Google Calendar not configured")

        # Generate state for CSRF protection
        import secrets

        state = secrets.token_urlsafe(32)
        session["google_oauth_state"] = state

        return self.auth.get_authorization_url(state=state)

    def handle_callback(self, code: str) -> GoogleCredentials:
        """
        Handle the OAuth2 callback and store credentials.

        Args:
            code: Authorization code from callback

        Returns:
            Google credentials
        """
        if not self.auth:
            raise Exception("Google Calendar not configured")

        state = session.get("google_oauth_state")
        if not state:
            raise Exception("Invalid OAuth state")

        credentials = self.auth.handle_callback(code, state=state)
        return credentials

    def get_bookings_for_user(self, user: User):
        """Get bookings based on user role."""
        if user.is_admin:
            return Booking.query.all()
        elif user.is_instructor:
            return Booking.query.filter(
                (Booking.instructor_id == user.id) | (Booking.instructor_id.is_(None))
            ).all()
        else:
            return Booking.query.filter_by(student_id=user.id).all()

    def create_event(self, booking: Booking, user: User) -> Optional[str]:
        """
        Create a Google Calendar event for a booking.

        Args:
            booking: Booking to create event for
            user: User to create event for

        Returns:
            Event ID if successful, None otherwise
        """
        try:
            self._initialize_client_for_user(user)

            instructor_name = (
                booking.instructor.full_name if booking.instructor else "Solo"
            )

            # Create event using shared SDK types
            event = CalendarEvent(
                summary=f"Flight Training - {booking.aircraft.tail_number}",
                description=(
                    f"Student: {booking.student.full_name}\n"
                    f"Instructor: {instructor_name}\n"
                    f"Status: {booking.status}"
                ),
                start=CalendarDateTime(
                    dateTime=booking.start_time.isoformat(),
                    timeZone="UTC",
                ),
                end=CalendarDateTime(
                    dateTime=booking.end_time.isoformat(),
                    timeZone="UTC",
                ),
            )

            created_event = self.client.create_event(event, calendar_id="primary")
            return created_event.id

        except Exception as e:
            current_app.logger.error(f"Error creating Google Calendar event: {str(e)}")
            return None

    def update_event(
        self, event_id: str, booking: Booking, user: User
    ) -> Optional[str]:
        """
        Update a Google Calendar event for a booking.

        Args:
            event_id: Event ID to update
            booking: Booking with updated data
            user: User to update event for

        Returns:
            Event ID if successful, None otherwise
        """
        try:
            self._initialize_client_for_user(user)

            instructor_name = (
                booking.instructor.full_name if booking.instructor else "Solo"
            )

            # Update event using shared SDK types
            event = CalendarEvent(
                summary=f"Flight Training - {booking.aircraft.tail_number}",
                description=(
                    f"Student: {booking.student.full_name}\n"
                    f"Instructor: {instructor_name}\n"
                    f"Status: {booking.status}"
                ),
                start=CalendarDateTime(
                    dateTime=booking.start_time.isoformat(),
                    timeZone="UTC",
                ),
                end=CalendarDateTime(
                    dateTime=booking.end_time.isoformat(),
                    timeZone="UTC",
                ),
            )

            updated_event = self.client.update_event(
                event_id, event, calendar_id="primary"
            )
            return updated_event.id

        except Exception as e:
            current_app.logger.error(f"Error updating Google Calendar event: {str(e)}")
            return None

    def delete_event(self, event_id: str, user: User) -> bool:
        """
        Delete a Google Calendar event.

        Args:
            event_id: Event ID to delete
            user: User to delete event for

        Returns:
            True if successful, False otherwise
        """
        try:
            self._initialize_client_for_user(user)
            self.client.delete_event(event_id, calendar_id="primary")
            return True

        except Exception as e:
            current_app.logger.error(f"Error deleting Google Calendar event: {str(e)}")
            return False

    def sync_all_bookings(self, user: User):
        """Sync all relevant bookings for a user based on their role."""
        if not (user.google_calendar_enabled and user.google_calendar_credentials):
            return

        bookings = self.get_bookings_for_user(user)
        for booking in bookings:
            if not booking.google_calendar_event_id:
                event_id = self.create_event(booking, user)
                if event_id:
                    booking.google_calendar_event_id = event_id
            else:
                self.update_event(booking.google_calendar_event_id, booking, user)

        db.session.commit()

    def _initialize_client_for_user(self, user: User):
        """
        Initialize the Google Calendar client with user's credentials.

        Args:
            user: User with Google Calendar credentials
        """
        if not user.google_calendar_credentials:
            raise Exception("No Google Calendar credentials found for user")

        # Parse credentials from JSON
        creds_data = json.loads(user.google_calendar_credentials)
        credentials = GoogleCredentials.from_dict(creds_data)

        # Ensure credentials are valid (refresh if needed)
        if self.auth:
            credentials = self.auth.ensure_valid_credentials(credentials)

            # Update stored credentials if refreshed
            user.google_calendar_credentials = json.dumps(credentials.to_dict())
            db.session.commit()

        # Set credentials on client
        self.client.set_credentials(credentials)
