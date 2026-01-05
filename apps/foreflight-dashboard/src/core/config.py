"""Configuration settings for the ForeFlight Logbook Manager."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# API Configuration
FOREFLIGHT_API_KEY = os.getenv("FOREFLIGHT_API_KEY")
FOREFLIGHT_API_SECRET = os.getenv("FOREFLIGHT_API_SECRET")
FOREFLIGHT_API_BASE_URL = os.getenv("FOREFLIGHT_API_BASE_URL", "https://api.foreflight.com/")

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///logbook.db")

# Logging Configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = BASE_DIR / "logs" / "logbook.log"

# Currency Requirements (in days)
CURRENCY_REQUIREMENTS = {
    "day_landing": 90,  # Days for day landing currency
    "night_landing": 90,  # Days for night landing currency
    "instrument": 180,  # Days for instrument currency
} 