#!/usr/bin/env python3
"""
Script to check the database schema of the FlightSchool application.
"""

import os
import sys
import logging

# Set up the Flask app context
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
from app import create_app, db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def check_db_schema():
    """Check the database schema to understand what columns are available."""
    logger.info("Checking database schema...")
    
    # Get all tables
    with db.engine.connect() as conn:
        # SQLite specific query to get table names
        tables_result = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in tables_result]
        
        logger.info(f"Found {len(tables)} tables in the database:")
        for table in tables:
            logger.info(f"  - {table}")
            
            # Get columns for this table
            try:
                # SQLite specific query to get column info
                pragma_result = conn.execute(f"PRAGMA table_info({table});")
                columns = [(row[1], row[2]) for row in pragma_result]  # name, type
                
                logger.info(f"    Columns in {table}:")
                for col_name, col_type in columns:
                    logger.info(f"      - {col_name} ({col_type})")
            except Exception as e:
                logger.error(f"Error getting columns for table {table}: {e}")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        check_db_schema()
