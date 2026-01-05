#!/usr/bin/env python3
"""Script to list all aircraft in the database and their associated images."""

import os
import sys

# Add the parent directory to the path so we can import the app
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from app import create_app, db
from app.models import Aircraft

def main():
    """List all aircraft in the database and their associated images."""
    app = create_app()
    with app.app_context():
        print('Aircraft in database:')
        for aircraft in Aircraft.query.all():
            print(f'- {aircraft.registration}: {aircraft.make} {aircraft.model} (Image: {aircraft.image_filename or "None"})')
            
            # Check if the image file exists
            if aircraft.image_filename:
                image_path = os.path.join('app/static/images/aircraft', aircraft.image_filename)
                if os.path.exists(image_path):
                    print(f'  Image file exists: {image_path} ({os.path.getsize(image_path)} bytes)')
                else:
                    print(f'  Image file does not exist: {image_path}')

if __name__ == '__main__':
    main()
