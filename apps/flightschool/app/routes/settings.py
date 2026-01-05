from flask import Blueprint, render_template, flash, redirect, url_for, request, current_app
from flask_login import login_required, current_user
from app import db
import google_auth_oauthlib.flow
import google.oauth2.credentials

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/calendar')
@login_required
def calendar():
    """Display calendar settings."""
    return render_template('settings/calendar.html')


@settings_bp.route('/calendar/authorize')
@login_required
def calendar_authorize():
    """Start Google Calendar OAuth2 flow."""
    if not current_app.config.get('GOOGLE_CLIENT_CONFIG'):
        flash('Google Calendar integration is not configured.', 'error')
        return redirect(url_for('settings.calendar'))
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        current_app.config['GOOGLE_CLIENT_CONFIG'],
        scopes=['https://www.googleapis.com/auth/calendar.events']
    )
    flow.redirect_uri = url_for('settings.calendar_callback', _external=True)
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    session['google_oauth_state'] = state
    return redirect(authorization_url)


@settings_bp.route('/calendar/callback')
@login_required
def calendar_callback():
    """Handle Google Calendar OAuth2 callback."""
    if not session.get('google_oauth_state'):
        flash('Invalid OAuth state.', 'error')
        return redirect(url_for('settings.calendar'))
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        current_app.config['GOOGLE_CLIENT_CONFIG'],
        scopes=['https://www.googleapis.com/auth/calendar.events'],
        state=session['google_oauth_state']
    )
    flow.redirect_uri = url_for('settings.calendar_callback', _external=True)
    
    try:
        flow.fetch_token(authorization_response=request.url)
        credentials = flow.credentials
        
        # Store credentials in the database
        current_user.google_credentials = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        db.session.commit()
        
        flash('Successfully connected to Google Calendar!', 'success')
    except Exception as e:
        current_app.logger.error(f'Google OAuth error: {str(e)}')
        flash('Failed to connect to Google Calendar.', 'error')
    
    return redirect(url_for('settings.calendar'))


@settings_bp.route('/calendar/disconnect')
@login_required
def calendar_disconnect():
    """Disconnect Google Calendar integration."""
    if current_user.google_credentials:
        current_user.google_credentials = None
        db.session.commit()
        flash('Google Calendar disconnected successfully.', 'success')
    return redirect(url_for('settings.calendar')) 