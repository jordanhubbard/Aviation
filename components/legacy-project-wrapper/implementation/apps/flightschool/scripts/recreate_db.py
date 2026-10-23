#!/usr/bin/env python3
"""
Script to recreate the database with the correct schema based on the SQLAlchemy models.
This script will:
1. Drop all existing tables
2. Create new tables based on the SQLAlchemy models
3. Load test data (optional)
"""

import os
import sys
import logging
import argparse

# Set up the Flask app context
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
from app import create_app, db
from app.models import (
    Aircraft, User, Booking, MaintenanceType, MaintenanceRecord, Squawk,
    WeatherMinima, FlightLog, Endorsement, Document, AuditLog, WaitlistEntry,
    RecurringBooking, EquipmentStatus, CheckIn, CheckOut, Invoice
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def recreate_database(load_test_data=False):
    """Recreate the database with the correct schema."""
    logger.info("Recreating database...")
    
    # Drop all tables
    db.drop_all()
    logger.info("All tables dropped")
    
    # Create all tables
    db.create_all()
    logger.info("All tables created with correct schema")
    
    # Create admin user
    admin = User(
        email='admin@example.com',
        first_name='Admin',
        last_name='User',
        role='admin',
        is_admin=True,
        status='active'
    )
    admin.set_password('admin123')
    db.session.add(admin)
    
    # Create instructor user
    instructor = User(
        email='instructor@example.com',
        first_name='Flight',
        last_name='Instructor',
        role='instructor',
        is_instructor=True,
        status='active'
    )
    instructor.set_password('instructor123')
    db.session.add(instructor)
    
    # Create student user
    student = User(
        email='student@example.com',
        first_name='Student',
        last_name='Pilot',
        role='student',
        status='active'
    )
    student.set_password('student123')
    db.session.add(student)
    
    # Create sample aircraft
    cessna = Aircraft(
        registration='N12345',
        make='Cessna',
        model='172S',
        year=2020,
        status='available',
        category='single_engine_land',
        engine_type='piston',
        num_engines=1,
        ifr_equipped=True,
        gps=True,
        autopilot=True,
        rate_per_hour=150.0,
        image_filename='n12345.jpg'
    )
    db.session.add(cessna)
    
    piper = Aircraft(
        registration='N54321',
        make='Piper',
        model='PA-28-181',
        year=2018,
        status='available',
        category='single_engine_land',
        engine_type='piston',
        num_engines=1,
        ifr_equipped=True,
        gps=True,
        autopilot=False,
        rate_per_hour=140.0,
        image_filename='n54321.jpg'
    )
    db.session.add(piper)
    
    # Commit the changes
    db.session.commit()
    logger.info("Created admin user, instructor, student, and sample aircraft")
    
    # Load test data if requested
    if load_test_data:
        try:
            from scripts.load_test_data import load_test_data
            load_test_data()
            logger.info("Test data loaded successfully")
        except Exception as e:
            logger.error(f"Error loading test data: {e}")
    
    logger.info("Database recreation completed successfully!")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description='Recreate the database with the correct schema.')
    parser.add_argument('--test-data', action='store_true', help='Load test data after recreating the database')
    args = parser.parse_args()
    
    app = create_app()
    with app.app_context():
        recreate_database(load_test_data=args.test_data)

if __name__ == '__main__':
    main()
