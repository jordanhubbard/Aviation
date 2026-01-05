import os
from dotenv import load_dotenv
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///flightschool.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    WTF_CSRF_ENABLED = True
    WTF_CSRF_SECRET_KEY = os.environ.get('WTF_CSRF_SECRET_KEY', 'csrf-key')
    WTF_CSRF_TIME_LIMIT = None  # No time limit for CSRF tokens
    SESSION_COOKIE_SECURE = False  # Set to True in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PREFERRED_URL_SCHEME = 'http'  # Change to 'https' in production
    SCHOOL_NAME = os.environ.get('SCHOOL_NAME', 'Tailwheel Addicts Aviation')
    CONTACT_EMAIL = os.environ.get('CONTACT_EMAIL', 'info@tailwheeladdicts.com')
    CONTACT_PHONE = os.environ.get('CONTACT_PHONE', '(555) 123-4567')
    
    # Mail settings (placeholder for future implementation)
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 25)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS') is not None
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    
    # Application specific settings
    MAX_BOOKING_DURATION = 8  # hours
    MIN_BOOKING_DURATION = 1  # hour

    # Google Calendar settings
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI') or 'http://localhost:5000/booking/google-callback'

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
