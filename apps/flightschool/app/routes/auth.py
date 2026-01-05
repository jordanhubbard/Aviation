from flask import Blueprint, render_template, flash, redirect, url_for, request
from flask_login import login_required, login_user, logout_user, current_user
from app.models import User
from app.forms import LoginForm, RegistrationForm, AccountSettingsForm
from app import db
import google_auth_oauthlib
from flask import session

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if current_user.is_authenticated:
        if current_user.is_admin:
            return redirect(url_for('admin.dashboard'))
        return redirect(url_for('booking.dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            if user.status != 'active':
                flash('Your account is not active. Please contact an administrator.', 'error')
                return render_template('auth/login.html', form=form)
            
            login_user(user, remember=form.remember_me.data)
            next_page = request.args.get('next')
            
            if next_page:
                return redirect(next_page)
            elif user.is_admin:
                return redirect(url_for('admin.dashboard'))
            else:
                return redirect(url_for('booking.dashboard'))
                
        flash('Invalid email or password', 'error')
    return render_template('auth/login.html', form=form)


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Handle user registration."""
    form = RegistrationForm()
    if form.validate_on_submit():
        try:
            user = User(
                email=form.email.data,
                first_name=form.first_name.data,
                last_name=form.last_name.data,
                phone=form.phone.data,
                status='pending'
            )
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            flash('Registration successful! Please wait for admin approval.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f'Registration error: {str(e)}')
            flash('An error occurred during registration.', 'danger')
    
    return render_template('auth/register.html', form=form)


@auth_bp.route('/logout')
@login_required
def logout():
    """Handle user logout."""
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.index'))


@auth_bp.route('/account-settings', methods=['GET', 'POST'])
@login_required
def account_settings():
    """Handle user account settings."""
    form = AccountSettingsForm(obj=current_user)
    if form.validate_on_submit():
        current_user.first_name = form.first_name.data
        current_user.last_name = form.last_name.data
        current_user.phone = form.phone.data
        current_user.address = form.address.data
        if form.password.data:
            current_user.set_password(form.password.data)
        db.session.commit()
        flash('Your account settings have been updated.', 'success')
        return redirect(url_for('auth.account_settings'))
    return render_template('auth/account_settings.html', form=form)


@auth_bp.route('/documents')
@login_required
def documents():
    """Display user documents."""
    return render_template('auth/documents.html')


@auth_bp.route('/flight-logs')
@login_required
def flight_logs():
    """Display user flight logs."""
    return render_template('auth/flight_logs.html')


@auth_bp.route('/google-auth')
@login_required
def google_auth():
    """Start Google Calendar OAuth2 flow."""
    if not current_app.config.get('GOOGLE_CLIENT_CONFIG'):
        flash('Google Calendar integration is not configured.', 'error')
        return redirect(url_for('auth.account_settings'))
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        current_app.config['GOOGLE_CLIENT_CONFIG'],
        scopes=['https://www.googleapis.com/auth/calendar.events']
    )
    flow.redirect_uri = url_for('auth.google_callback', _external=True)
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    session['google_oauth_state'] = state
    return redirect(authorization_url)


@auth_bp.route('/google-callback')
@login_required
def google_callback():
    """Handle Google Calendar OAuth2 callback."""
    if not session.get('google_oauth_state'):
        flash('Invalid OAuth state.', 'error')
        return redirect(url_for('auth.account_settings'))
    
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        current_app.config['GOOGLE_CLIENT_CONFIG'],
        scopes=['https://www.googleapis.com/auth/calendar.events'],
        state=session['google_oauth_state']
    )
    flow.redirect_uri = url_for('auth.google_callback', _external=True)
    
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
    
    return redirect(url_for('auth.account_settings'))
