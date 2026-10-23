from flask import (
    Blueprint,
    render_template,
    flash,
    redirect,
    url_for,
    request,
    current_app,
    session,
)
from flask_login import login_required, current_user
from app import db
from app.calendar_service import GoogleCalendarService
import json

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/calendar")
@login_required
def calendar():
    """Display calendar settings."""
    return render_template("settings/calendar.html")


@settings_bp.route("/calendar/authorize")
@login_required
def calendar_authorize():
    """Start Google Calendar OAuth2 flow using shared SDK."""
    if not current_app.config.get("GOOGLE_CLIENT_ID"):
        flash("Google Calendar integration is not configured.", "error")
        return redirect(url_for("settings.calendar"))

    try:
        calendar_service = GoogleCalendarService()
        authorization_url = calendar_service.get_authorization_url()
        return redirect(authorization_url)
    except Exception as e:
        current_app.logger.error(f"Google OAuth error: {str(e)}")
        flash("Failed to start Google Calendar authorization.", "error")
        return redirect(url_for("settings.calendar"))


@settings_bp.route("/calendar/callback")
@login_required
def calendar_callback():
    """Handle Google Calendar OAuth2 callback using shared SDK."""
    if not session.get("google_oauth_state"):
        flash("Invalid OAuth state.", "error")
        return redirect(url_for("settings.calendar"))

    try:
        # Extract authorization code from callback URL
        code = request.args.get("code")
        if not code:
            flash("No authorization code received.", "error")
            return redirect(url_for("settings.calendar"))

        # Handle callback using shared SDK
        calendar_service = GoogleCalendarService()
        credentials = calendar_service.handle_callback(code)

        # Store credentials in the database (using shared SDK format)
        current_user.google_calendar_credentials = json.dumps(credentials.to_dict())
        current_user.google_calendar_enabled = True
        db.session.commit()

        flash("Successfully connected to Google Calendar!", "success")
    except Exception as e:
        current_app.logger.error(f"Google OAuth error: {str(e)}")
        flash("Failed to connect to Google Calendar.", "error")

    return redirect(url_for("settings.calendar"))


@settings_bp.route("/calendar/disconnect")
@login_required
def calendar_disconnect():
    """Disconnect Google Calendar integration."""
    if current_user.google_calendar_credentials:
        current_user.google_calendar_credentials = None
        current_user.google_calendar_enabled = False
        db.session.commit()
        flash("Google Calendar disconnected successfully.", "success")
    return redirect(url_for("settings.calendar"))
