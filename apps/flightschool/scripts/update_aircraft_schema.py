#!/usr/bin/env python3
"""
Script to update the aircraft table schema to match the SQLAlchemy model.
This script will:
1. Back up the current data
2. Alter the table to add missing columns
3. Migrate data from old columns to new ones where possible
"""

import os
import sys
import logging
import json
from datetime import datetime

# Set up the Flask app context
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
from app import create_app, db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def backup_data():
    """Backup the current aircraft data."""
    logger.info("Backing up current aircraft data...")
    
    with db.engine.connect() as conn:
        # Get all aircraft data
        result = conn.execute("SELECT * FROM aircraft")
        
        # Convert to list of dictionaries
        columns = result.keys()
        aircraft_data = [dict(zip(columns, row)) for row in result]
        
        # Save to backup file
        backup_file = f"aircraft_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_file, 'w') as f:
            json.dump(aircraft_data, f, indent=2, default=str)
        
        logger.info(f"Backed up {len(aircraft_data)} aircraft records to {backup_file}")
        return aircraft_data

def update_schema():
    """Update the aircraft table schema to match the SQLAlchemy model."""
    logger.info("Updating aircraft table schema...")
    
    with db.engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        
        try:
            # Create a new table with the correct schema
            conn.execute("""
            CREATE TABLE aircraft_new (
                id INTEGER PRIMARY KEY,
                registration VARCHAR(10) UNIQUE NOT NULL,
                make VARCHAR(50) NOT NULL,
                model VARCHAR(50) NOT NULL,
                year INTEGER,
                description TEXT,
                status VARCHAR(20) DEFAULT 'available',
                category VARCHAR(50),
                engine_type VARCHAR(20),
                num_engines INTEGER DEFAULT 1,
                ifr_equipped BOOLEAN DEFAULT 0,
                gps BOOLEAN DEFAULT 0,
                autopilot BOOLEAN DEFAULT 0,
                rate_per_hour FLOAT NOT NULL DEFAULT 0,
                hobbs_time FLOAT,
                tach_time FLOAT,
                last_maintenance DATETIME,
                image_filename VARCHAR(255),
                time_to_next_oil_change FLOAT,
                time_to_next_100hr FLOAT,
                date_of_next_annual DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """)
            
            # Commit the transaction
            trans.commit()
            logger.info("Created new aircraft table with updated schema")
        except Exception as e:
            # Rollback in case of error
            trans.rollback()
            logger.error(f"Error creating new table: {e}")
            return False
    
    return True

def migrate_data(aircraft_data):
    """Migrate data from the old table to the new one."""
    logger.info("Migrating aircraft data to new schema...")
    
    with db.engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        
        try:
            for aircraft in aircraft_data:
                # Map old fields to new fields
                make = ""
                model = ""
                
                # Split make_model into make and model if available
                if 'make_model' in aircraft and aircraft['make_model']:
                    parts = aircraft['make_model'].split(' ', 1)
                    make = parts[0]
                    model = parts[1] if len(parts) > 1 else ""
                
                # Map type to category and engine_type
                category = "single_engine_land"  # Default
                engine_type = "piston"  # Default
                
                if 'type' in aircraft and aircraft['type']:
                    type_lower = aircraft['type'].lower()
                    if 'multi' in type_lower:
                        category = "multi_engine_land"
                    if 'turbo' in type_lower:
                        engine_type = "turboprop"
                    elif 'jet' in type_lower:
                        engine_type = "jet"
                
                # Generate a default image filename based on registration
                image_filename = f"{aircraft['registration'].lower()}.jpg"
                
                # Insert into new table
                conn.execute(
                    """
                    INSERT INTO aircraft_new (
                        id, registration, make, model, year, status, category, engine_type,
                        rate_per_hour, image_filename, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        aircraft['id'],
                        aircraft['registration'],
                        make,
                        model,
                        aircraft.get('year'),
                        aircraft.get('status', 'available'),
                        category,
                        engine_type,
                        100.0,  # Default rate per hour
                        image_filename,
                        aircraft.get('created_at', datetime.now()),
                        aircraft.get('updated_at', datetime.now())
                    )
                )
            
            # Commit the transaction
            trans.commit()
            logger.info(f"Migrated {len(aircraft_data)} aircraft records to new schema")
        except Exception as e:
            # Rollback in case of error
            trans.rollback()
            logger.error(f"Error migrating data: {e}")
            return False
    
    return True

def swap_tables():
    """Swap the old table with the new one."""
    logger.info("Swapping tables...")
    
    with db.engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        
        try:
            # Rename the old table
            conn.execute("ALTER TABLE aircraft RENAME TO aircraft_old")
            
            # Rename the new table
            conn.execute("ALTER TABLE aircraft_new RENAME TO aircraft")
            
            # Commit the transaction
            trans.commit()
            logger.info("Tables swapped successfully")
        except Exception as e:
            # Rollback in case of error
            trans.rollback()
            logger.error(f"Error swapping tables: {e}")
            return False
    
    return True

def main():
    """Update the aircraft table schema."""
    logger.info("Starting aircraft schema update...")
    
    # Backup current data
    aircraft_data = backup_data()
    
    # Update schema
    if not update_schema():
        logger.error("Schema update failed. Aborting.")
        return
    
    # Migrate data
    if not migrate_data(aircraft_data):
        logger.error("Data migration failed. Aborting.")
        return
    
    # Swap tables
    if not swap_tables():
        logger.error("Table swap failed. Aborting.")
        return
    
    logger.info("Aircraft schema update completed successfully!")
    logger.info("The old table has been preserved as 'aircraft_old' for reference.")
    logger.info("You can drop it with: DROP TABLE aircraft_old;")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        main()
