#!/usr/bin/env python3
"""Script to test the aircraft image download functionality."""

import os
import sys
import shutil

# Add the parent directory to the path so we can import the app
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from app import create_app, db
from app.models import Aircraft

def main():
    """Test the aircraft image download functionality."""
    app = create_app()
    with app.app_context():
        # Check for existing aircraft images
        image_dir = os.path.join('app/static/images/aircraft')
        print(f"Current aircraft images:")
        for img in os.listdir(image_dir):
            if img.endswith(('.jpg', '.jpeg', '.png')):
                print(f"- {img}: {os.path.getsize(os.path.join(image_dir, img))} bytes")
        
        # Remove specific aircraft images to force download
        for aircraft in Aircraft.query.all():
            if aircraft.image_filename:
                image_path = os.path.join(image_dir, aircraft.image_filename)
                if os.path.exists(image_path):
                    print(f"\nBacking up and removing {image_path} to test download...")
                    backup_path = image_path + '.bak'
                    shutil.copy2(image_path, backup_path)
                    os.remove(image_path)
                    print(f"Image backed up to {backup_path}")
        
        print("\nNow run the check_aircraft_images.py script to test downloading:")
        print("python scripts/check_aircraft_images.py")
        
        print("\nAfter testing, you can restore the backed up images with:")
        print("python scripts/restore_aircraft_images.py")

if __name__ == '__main__':
    main()
