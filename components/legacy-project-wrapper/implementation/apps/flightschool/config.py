import os
from dotenv import load_dotenv
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

# Import keystore secrets
try:
    from app_secrets import (
        get_secret_key,
        get_database_url,
        get_csrf_secret_key,
        get_mail_server,
        get_mail_port,
        get_mail_username,
        get_mail_password,
        get_google_client_id,
        get_google_client_secret,
        get_google_redirect_uri,
    )
    KEYSTORE_AVAILABLE = True
except Exception:
    # Catch all exceptions (not just ImportError) in case secrets module
    # loads but keystore isn't available
    KEYSTORE_AVAILABLE = False
    get_secret_key = lambda: os.environ.get('SECRET_KEY', 'dev')
    get_database_url = lambda: os.environ.get('DATABASE_URL', 'sqlite:///flightschool.db')
    get_csrf_secret_key = lambda: os.environ.get('WTF_CSRF_SECRET_KEY', 'csrf-key')
    get_mail_server = lambda: os.environ.get('MAIL_SERVER')
    get_mail_port = lambda: int(os.environ.get('MAIL_PORT') or 25)
    get_mail_username = lambda: os.environ.get('MAIL_USERNAME')
    get_mail_password = lambda: os.environ.get('MAIL_PASSWORD')
    get_google_client_id = lambda: os.environ.get('GOOGLE_CLIENT_ID')
    get_google_client_secret = lambda: os.environ.get('GOOGLE_CLIENT_SECRET')
    get_google_redirect_uri = lambda: os.environ.get('GOOGLE_REDIRECT_URI')

class Config:
    """Base configuration."""
    SECRET_KEY = get_secret_key()
    SQLALCHEMY_DATABASE_URI = get_database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    WTF_CSRF_ENABLED = True
    WTF_CSRF_SECRET_KEY = get_csrf_secret_key()
    WTF_CSRF_TIME_LIMIT = None  # No time limit for CSRF tokens
    SESSION_COOKIE_SECURE = False  # Set to True in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PREFERRED_URL_SCHEME = 'http'  # Change to 'https' in production
    SCHOOL_NAME = os.environ.get('SCHOOL_NAME', 'Tailwheel Addicts Aviation')
    CONTACT_EMAIL = os.environ.get('CONTACT_EMAIL', 'info@tailwheeladdicts.com')
    CONTACT_PHONE = os.environ.get('CONTACT_PHONE', '(555) 123-4567')
    
    # Mail settings (placeholder for future implementation)
    MAIL_SERVER = get_mail_server()
    MAIL_PORT = get_mail_port()
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS') is not None
    MAIL_USERNAME = get_mail_username()
    MAIL_PASSWORD = get_mail_password()
    
    # Application specific settings
    MAX_BOOKING_DURATION = 8  # hours
    MIN_BOOKING_DURATION = 1  # hour

    # Google Calendar settings
    GOOGLE_CLIENT_ID = get_google_client_id()
    GOOGLE_CLIENT_SECRET = get_google_client_secret()
    GOOGLE_REDIRECT_URI = get_google_redirect_uri() or 'http://localhost:5000/booking/google-callback'

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    SERVER_NAME = 'localhost.localdomain'

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False

config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
