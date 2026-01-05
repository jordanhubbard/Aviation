from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import json
from flask import current_app, session
from app.models import Booking
from app import db


SCOPES = ['https://www.googleapis.com/auth/calendar']


class GoogleCalendarService:
    def __init__(self):
        self.credentials = None
        self.service = None

    def get_authorization_url(self):
        """Generate the authorization URL for Google Calendar."""
        config = {
            "web": {
                "client_id": current_app.config['GOOGLE_CLIENT_ID'],
                "client_secret": current_app.config['GOOGLE_CLIENT_SECRET'],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [
                    current_app.config['GOOGLE_REDIRECT_URI']
                ],
                "scopes": SCOPES
            }
        }
        flow = Flow.from_client_config(config)
        flow.redirect_uri = current_app.config['GOOGLE_REDIRECT_URI']
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        session['state'] = state
        return authorization_url

    def handle_callback(self, code):
        """Handle the OAuth2 callback and store credentials."""
        state = session['state']
        config = {
            "web": {
                "client_id": current_app.config['GOOGLE_CLIENT_ID'],
                "client_secret": current_app.config['GOOGLE_CLIENT_SECRET'],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [
                    current_app.config['GOOGLE_REDIRECT_URI']
                ],
                "scopes": SCOPES
            }
        }
        flow = Flow.from_client_config(config, state=state)
        flow.redirect_uri = current_app.config['GOOGLE_REDIRECT_URI']
        flow.fetch_token(code=code)
        credentials = flow.credentials
        return credentials

    def get_bookings_for_user(self, user):
        """Get bookings based on user role."""
        if user.is_admin:
            return Booking.query.all()
        elif user.is_instructor:
            return Booking.query.filter(
                (Booking.instructor_id == user.id) |
                (Booking.instructor_id.is_(None))
            ).all()
        else:
            return Booking.query.filter_by(student_id=user.id).all()

    def create_event(self, booking, user):
        """Create a Google Calendar event for a booking."""
        if not self.service:
            self._initialize_service(user)

        instructor_name = (
            booking.instructor.full_name if booking.instructor else "Solo"
        )
        event = {
            'summary': f'Flight Training - {booking.aircraft.tail_number}',
            'description': (
                f'Student: {booking.student.full_name}\n'
                f'Instructor: {instructor_name}\n'
                f'Status: {booking.status}'
            ),
            'start': {
                'dateTime': booking.start_time.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': booking.end_time.isoformat(),
                'timeZone': 'UTC',
            },
        }

        try:
            event = self.service.events().insert(
                calendarId='primary',
                body=event
            ).execute()
            return event.get('id')
        except Exception as e:
            current_app.logger.error(
                f"Error creating Google Calendar event: {str(e)}"
            )
            return None

    def update_event(self, event_id, booking, user):
        """Update a Google Calendar event for a booking."""
        if not self.service:
            self._initialize_service(user)

        instructor_name = (
            booking.instructor.full_name if booking.instructor else "Solo"
        )
        event = {
            'summary': f'Flight Training - {booking.aircraft.tail_number}',
            'description': (
                f'Student: {booking.student.full_name}\n'
                f'Instructor: {instructor_name}\n'
                f'Status: {booking.status}'
            ),
            'start': {
                'dateTime': booking.start_time.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': booking.end_time.isoformat(),
                'timeZone': 'UTC',
            },
        }

        try:
            event = self.service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            return event.get('id')
        except Exception as e:
            current_app.logger.error(
                f"Error updating Google Calendar event: {str(e)}"
            )
            return None

    def delete_event(self, event_id, user):
        """Delete a Google Calendar event."""
        if not self.service:
            self._initialize_service(user)

        try:
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id
            ).execute()
            return True
        except Exception as e:
            current_app.logger.error(
                f"Error deleting Google Calendar event: {str(e)}"
            )
            return False

    def sync_all_bookings(self, user):
        """Sync all relevant bookings for a user based on their role."""
        if not (user.google_calendar_enabled and
                user.google_calendar_credentials):
            return

        bookings = self.get_bookings_for_user(user)
        for booking in bookings:
            if not booking.google_calendar_event_id:
                event_id = self.create_event(booking, user)
                if event_id:
                    booking.google_calendar_event_id = event_id
            else:
                self.update_event(
                    booking.google_calendar_event_id,
                    booking,
                    user
                )

    def _initialize_service(self, user):
        """Initialize the Google Calendar service with user's credentials."""
        if not user.google_calendar_credentials:
            raise Exception("No Google Calendar credentials found for user")

        self.credentials = Credentials.from_authorized_user_info(
            json.loads(user.google_calendar_credentials),
            SCOPES
        )

        if not self.credentials or not self.credentials.valid:
            if (self.credentials and self.credentials.expired and
                    self.credentials.refresh_token):
                self.credentials.refresh(Request())
                # Update stored credentials
                user.google_calendar_credentials = self.credentials.to_json()
                db.session.commit()
            else:
                raise Exception("No valid credentials available")

        self.service = build('calendar', 'v3', credentials=self.credentials)
