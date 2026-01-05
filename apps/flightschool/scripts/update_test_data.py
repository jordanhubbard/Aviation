#!/usr/bin/env python3
"""
Script to update the test data file with additional aircraft.
This script adds four new aircraft to the test data, including a Citabria 7ECA and a Kitfox Series 7 STI.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Path to test data file
TEST_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tests', 'test_data.json')

def update_test_data():
    """Update the test data file with additional aircraft."""
    logger.info(f"Reading test data from {TEST_DATA_PATH}")
    
    # Read existing test data
    with open(TEST_DATA_PATH, 'r') as f:
        test_data = json.load(f)
    
    # Get current aircraft count
    current_count = len(test_data['aircraft'])
    logger.info(f"Current aircraft count: {current_count}")
    
    # Define new aircraft to add
    new_aircraft = [
        {
            "registration": "N7ECA",
            "make": "American Champion",
            "model": "Citabria 7ECA",
            "year": 2018,
            "serial_number": "7ECA-12345",
            "status": "available",
            "category": "single_engine_land",
            "engine_type": "piston",
            "num_engines": 1,
            "description": "Aerobatic-capable taildragger with conventional gear",
            "ifr_equipped": False,
            "gps_equipped": True,
            "gps_model": "Garmin aera 760",
            "autopilot": False,
            "adsb_out": True,
            "adsb_in": True,
            "dme_equipped": False,
            "tcas_equipped": False,
            "rate_per_hour": 145.0,
            "fuel_capacity": 36.0,
            "fuel_type": "100LL",
            "oil_capacity": 8.0,
            "max_weight": 1750,
            "empty_weight": 1200,
            "useful_load": 550,
            "hobbs_time": 1245.6,
            "tach_time": 1200.4,
            "total_time": 1245.6,
            "engine_time": 600.0,
            "prop_time": 600.0,
            "last_maintenance": "2025-03-15T00:00:00Z",
            "last_annual": "2025-02-01T00:00:00Z",
            "last_100hr": "2025-03-15T00:00:00Z",
            "last_pitot_static": "2024-11-15T00:00:00Z",
            "last_vor_check": "2025-02-15T00:00:00Z",
            "last_altimeter": "2024-11-15T00:00:00Z",
            "last_transponder": "2024-11-15T00:00:00Z",
            "last_elt_check": "2025-02-01T00:00:00Z",
            "maintenance_status": "airworthy",
            "next_maintenance_date": "2025-06-15T00:00:00Z",
            "next_maintenance_hours": 1345.6,
            "maintenance_notes": "Tailwheel recently serviced",
            "insurance_expiry": "2026-02-01T00:00:00Z",
            "registration_expiry": "2026-12-31T00:00:00Z",
            "airworthiness_cert": "7654321",
            "airworthiness_date": "2018-06-15T00:00:00Z",
            "image_filename": "n7eca.jpg",
            "time_to_next_oil_change": 25.0,
            "time_to_next_100hr": 54.4,
            "date_of_next_annual": "2026-02-01"
        },
        {
            "registration": "N7STI",
            "make": "Kitfox",
            "model": "Series 7 STI",
            "year": 2020,
            "serial_number": "KF7STI-54321",
            "status": "available",
            "category": "single_engine_land",
            "engine_type": "piston",
            "num_engines": 1,
            "description": "Light sport aircraft with STOL capabilities",
            "ifr_equipped": False,
            "gps_equipped": True,
            "gps_model": "Garmin G3X Touch",
            "autopilot": True,
            "autopilot_model": "Garmin GMC 507",
            "adsb_out": True,
            "adsb_in": True,
            "dme_equipped": False,
            "tcas_equipped": False,
            "rate_per_hour": 135.0,
            "fuel_capacity": 30.0,
            "fuel_type": "100LL",
            "oil_capacity": 6.0,
            "max_weight": 1550,
            "empty_weight": 850,
            "useful_load": 700,
            "hobbs_time": 845.2,
            "tach_time": 830.1,
            "total_time": 845.2,
            "engine_time": 845.2,
            "prop_time": 845.2,
            "last_maintenance": "2025-02-15T00:00:00Z",
            "last_annual": "2025-01-10T00:00:00Z",
            "last_100hr": "2025-02-15T00:00:00Z",
            "last_pitot_static": "2024-10-10T00:00:00Z",
            "last_vor_check": "2025-01-15T00:00:00Z",
            "last_altimeter": "2024-10-10T00:00:00Z",
            "last_transponder": "2024-10-10T00:00:00Z",
            "last_elt_check": "2025-01-10T00:00:00Z",
            "maintenance_status": "airworthy",
            "next_maintenance_date": "2025-05-15T00:00:00Z",
            "next_maintenance_hours": 945.2,
            "maintenance_notes": "New tires installed",
            "insurance_expiry": "2026-01-15T00:00:00Z",
            "registration_expiry": "2026-12-31T00:00:00Z",
            "airworthiness_cert": "8765432",
            "airworthiness_date": "2020-03-10T00:00:00Z",
            "image_filename": "n7sti.jpg",
            "time_to_next_oil_change": 30.0,
            "time_to_next_100hr": 54.8,
            "date_of_next_annual": "2026-01-10"
        },
        {
            "registration": "N182RG",
            "make": "Cessna",
            "model": "R182 Skylane RG",
            "year": 1985,
            "serial_number": "R18200123",
            "status": "available",
            "category": "single_engine_land",
            "engine_type": "piston",
            "num_engines": 1,
            "description": "Retractable gear Skylane with excellent cross-country capability",
            "ifr_equipped": True,
            "gps_equipped": True,
            "gps_model": "Garmin GTN 750",
            "autopilot": True,
            "autopilot_model": "S-TEC 55X",
            "adsb_out": True,
            "adsb_in": True,
            "dme_equipped": True,
            "tcas_equipped": False,
            "rate_per_hour": 185.0,
            "fuel_capacity": 88.0,
            "fuel_type": "100LL",
            "oil_capacity": 12.0,
            "max_weight": 3100,
            "empty_weight": 1850,
            "useful_load": 1250,
            "hobbs_time": 4532.8,
            "tach_time": 4500.5,
            "total_time": 4532.8,
            "engine_time": 1200.0,
            "prop_time": 1200.0,
            "last_maintenance": "2025-01-20T00:00:00Z",
            "last_annual": "2025-01-20T00:00:00Z",
            "last_100hr": "2025-01-20T00:00:00Z",
            "last_pitot_static": "2024-12-20T00:00:00Z",
            "last_vor_check": "2025-01-25T00:00:00Z",
            "last_altimeter": "2024-12-20T00:00:00Z",
            "last_transponder": "2024-12-20T00:00:00Z",
            "last_elt_check": "2025-01-20T00:00:00Z",
            "maintenance_status": "airworthy",
            "next_maintenance_date": "2025-04-20T00:00:00Z",
            "next_maintenance_hours": 4632.8,
            "maintenance_notes": "Landing gear recently serviced",
            "insurance_expiry": "2026-01-20T00:00:00Z",
            "registration_expiry": "2026-12-31T00:00:00Z",
            "airworthiness_cert": "9876543",
            "airworthiness_date": "1985-05-10T00:00:00Z",
            "image_filename": "n182rg.jpg",
            "time_to_next_oil_change": 15.0,
            "time_to_next_100hr": 67.2,
            "date_of_next_annual": "2026-01-20"
        },
        {
            "registration": "N6PA",
            "make": "Piper",
            "model": "PA-32-301 Saratoga",
            "year": 2000,
            "serial_number": "3246088",
            "status": "available",
            "category": "single_engine_land",
            "engine_type": "piston",
            "num_engines": 1,
            "description": "Six-seat high-performance aircraft with club seating",
            "ifr_equipped": True,
            "gps_equipped": True,
            "gps_model": "Garmin G500 TXi",
            "autopilot": True,
            "autopilot_model": "Garmin GFC 600",
            "adsb_out": True,
            "adsb_in": True,
            "dme_equipped": True,
            "tcas_equipped": True,
            "rate_per_hour": 210.0,
            "fuel_capacity": 102.0,
            "fuel_type": "100LL",
            "oil_capacity": 12.0,
            "max_weight": 3600,
            "empty_weight": 2300,
            "useful_load": 1300,
            "hobbs_time": 3245.6,
            "tach_time": 3200.4,
            "total_time": 3245.6,
            "engine_time": 900.0,
            "prop_time": 900.0,
            "last_maintenance": "2025-02-10T00:00:00Z",
            "last_annual": "2025-01-05T00:00:00Z",
            "last_100hr": "2025-02-10T00:00:00Z",
            "last_pitot_static": "2024-12-05T00:00:00Z",
            "last_vor_check": "2025-02-15T00:00:00Z",
            "last_altimeter": "2024-12-05T00:00:00Z",
            "last_transponder": "2024-12-05T00:00:00Z",
            "last_elt_check": "2025-01-05T00:00:00Z",
            "maintenance_status": "airworthy",
            "next_maintenance_date": "2025-05-10T00:00:00Z",
            "next_maintenance_hours": 3345.6,
            "maintenance_notes": "Avionics upgrade completed",
            "insurance_expiry": "2026-01-05T00:00:00Z",
            "registration_expiry": "2026-12-31T00:00:00Z",
            "airworthiness_cert": "1098765",
            "airworthiness_date": "2000-04-15T00:00:00Z",
            "image_filename": "n6pa.jpg",
            "time_to_next_oil_change": 20.0,
            "time_to_next_100hr": 54.4,
            "date_of_next_annual": "2026-01-05"
        }
    ]
    
    # Add new aircraft to test data
    test_data['aircraft'].extend(new_aircraft)
    
    # Update test data file
    with open(TEST_DATA_PATH, 'w') as f:
        json.dump(test_data, f, indent=4)
    
    logger.info(f"Updated test data file with {len(new_aircraft)} new aircraft")
    logger.info(f"New aircraft count: {len(test_data['aircraft'])}")

if __name__ == '__main__':
    update_test_data()
