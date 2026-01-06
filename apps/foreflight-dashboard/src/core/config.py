"""Configuration settings for the ForeFlight Logbook Manager."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file (for backward compatibility)
load_dotenv()

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Import secrets from keystore
try:
    from .secrets import (
        SECRET_KEY,
        DATABASE_URL as KEYSTORE_DATABASE_URL,
        FOREFLIGHT_API_KEY as KEYSTORE_FOREFLIGHT_API_KEY,
        FOREFLIGHT_API_SECRET as KEYSTORE_FOREFLIGHT_API_SECRET,
        REDIS_URL,
        SENTRY_DSN,
        get_secret,
    )
    
    # Use keystore values, with environment fallback for non-sensitive config
    FOREFLIGHT_API_KEY = KEYSTORE_FOREFLIGHT_API_KEY or os.getenv("FOREFLIGHT_API_KEY")
    FOREFLIGHT_API_SECRET = KEYSTORE_FOREFLIGHT_API_SECRET or os.getenv("FOREFLIGHT_API_SECRET")
    DATABASE_URL = KEYSTORE_DATABASE_URL or os.getenv("DATABASE_URL", "sqlite:///logbook.db")
    
except Exception:
    # Fallback to environment variables if keystore not available
    # Catch all exceptions (not just ImportError) in case secrets module
    # loads but keystore isn't available
    print("Warning: Keystore not available, falling back to environment variables")
    SECRET_KEY = os.getenv("SECRET_KEY")
    FOREFLIGHT_API_KEY = os.getenv("FOREFLIGHT_API_KEY")
    FOREFLIGHT_API_SECRET = os.getenv("FOREFLIGHT_API_SECRET")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///logbook.db")
    REDIS_URL = os.getenv("REDIS_URL")
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    get_secret = lambda key, default=None, required=False: os.getenv(key, default)

# API Configuration (non-sensitive)
FOREFLIGHT_API_BASE_URL = os.getenv("FOREFLIGHT_API_BASE_URL", "https://api.foreflight.com/")

# Logging Configuration (non-sensitive)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = BASE_DIR / "logs" / "logbook.log"

# Currency Requirements (in days)
CURRENCY_REQUIREMENTS = {
    "day_landing": 90,  # Days for day landing currency
    "night_landing": 90,  # Days for night landing currency
    "instrument": 180,  # Days for instrument currency
} 