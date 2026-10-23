#!/usr/bin/env python3
"""
A simplified script to check and fix aircraft images in the FlightSchool application.
This script focuses only on the image_filename field and doesn't rely on other attributes.
"""

import os
import sys
import requests
import logging
from PIL import Image

# Set up the Flask app context
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
from app import create_app, db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Constants
STATIC_IMAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../app/static/images/aircraft'))
NORMALIZED_SIZE = (800, 600)

# User agent for requests (following Wikimedia policy)
USER_AGENT = 'FlightSchool/1.0 (https://github.com/jordanhubbard/flightschool; contact@flightschool.com)'
HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
}

def download_image(url, filepath):
    """Download image from URL with proper headers."""
    logger.info(f"Downloading image from: {url}")
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code == 200 and len(response.content) > 1024:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'wb') as f:
                f.write(response.content)
            logger.info(f"Successfully downloaded image to {filepath}")
            return True
        else:
            logger.warning(f"Failed to download image: HTTP {response.status_code} or content too small")
            return False
    except Exception as e:
        logger.error(f"Error downloading image: {e}")
        return False

def normalize_image_size(img_path):
    """Normalize image size while preserving aspect ratio."""
    try:
        with Image.open(img_path) as img:
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Calculate new dimensions preserving aspect ratio
            width, height = img.size
            ratio = min(NORMALIZED_SIZE[0] / width, NORMALIZED_SIZE[1] / height)
            new_size = (int(width * ratio), int(height * ratio))
            
            # Resize the image
            img = img.resize(new_size, Image.LANCZOS)
            
            # Create a new blank image with white background
            new_img = Image.new('RGB', NORMALIZED_SIZE, (255, 255, 255))
            
            # Paste the resized image in the center
            left = (NORMALIZED_SIZE[0] - new_size[0]) // 2
            top = (NORMALIZED_SIZE[1] - new_size[1]) // 2
            new_img.paste(img, (left, top))
            
            # Save the normalized image
            new_img.save(img_path, 'JPEG', quality=85)
            logger.info(f"Normalized {os.path.basename(img_path)} to {NORMALIZED_SIZE[0]}x{NORMALIZED_SIZE[1]}")
            return True
    except Exception as e:
        logger.error(f"Error normalizing image {img_path}: {e}")
        return False

def batch_normalize_all_images():
    """Normalize all aircraft images in the static directory."""
    logger.info("Batch normalizing all aircraft images...")
    
    # Ensure the directory exists
    os.makedirs(STATIC_IMAGE_DIR, exist_ok=True)
    
    # Process each image file
    for fname in os.listdir(STATIC_IMAGE_DIR):
        img_path = os.path.join(STATIC_IMAGE_DIR, fname)
        if os.path.isfile(img_path) and fname.lower().endswith(('.jpg', '.jpeg', '.png')):
            normalize_image_size(img_path)

def check_aircraft_images():
    """Check if all aircraft have associated images and offer to download missing ones."""
    logger.info("Checking aircraft images...")
    
    # Ensure the directory exists
    os.makedirs(STATIC_IMAGE_DIR, exist_ok=True)
    
    # Get list of existing image files
    existing_images = [f.lower() for f in os.listdir(STATIC_IMAGE_DIR) 
                      if os.path.isfile(os.path.join(STATIC_IMAGE_DIR, f)) and 
                      f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    logger.info(f"Found {len(existing_images)} existing aircraft images:")
    for img in existing_images:
        logger.info(f"  - {img}")
    
    # Check if default image exists, create if not
    if 'default.jpg' not in existing_images:
        logger.warning("Default aircraft image missing. Creating a blank one.")
        blank_img = Image.new('RGB', NORMALIZED_SIZE, (255, 255, 255))
        blank_img.save(os.path.join(STATIC_IMAGE_DIR, 'default.jpg'), 'JPEG', quality=85)
        existing_images.append('default.jpg')
    
    # Use raw SQL to avoid ORM issues
    with db.engine.connect() as conn:
        # Get all aircraft with their registration and image_filename
        result = conn.execute("SELECT id, registration, image_filename FROM aircraft")
        aircraft_list = [{'id': row[0], 'registration': row[1], 'image_filename': row[2]} 
                         for row in result]
    
    logger.info(f"Found {len(aircraft_list)} aircraft in database")
    
    # Check each aircraft for missing images
    missing_images = []
    for aircraft in aircraft_list:
        logger.info(f"Checking aircraft {aircraft['registration']}")
        
        if not aircraft['image_filename']:
            logger.info(f"  No specific image assigned for {aircraft['registration']}")
            continue
        
        # Check if the assigned image exists
        if aircraft['image_filename'].lower() not in existing_images:
            logger.warning(f"  Missing assigned image: {aircraft['image_filename']}")
            missing_images.append(aircraft)
    
    if missing_images:
        logger.info(f"\nFound {len(missing_images)} aircraft with missing images")
        
        for aircraft in missing_images:
            logger.info(f"\nAircraft {aircraft['registration']} is missing its image: {aircraft['image_filename']}")
            
            # Prompt user to download an image
            url = input(f"Enter URL to download for {aircraft['image_filename']} (or press Enter to skip): ").strip()
            
            if url:
                img_path = os.path.join(STATIC_IMAGE_DIR, aircraft['image_filename'])
                if download_image(url, img_path):
                    normalize_image_size(img_path)
    else:
        logger.info("All aircraft have their assigned images available.")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        batch_normalize_all_images()
        check_aircraft_images()
