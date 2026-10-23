#!/usr/bin/env python3
"""
Script to check and fix aircraft images in the FlightSchool application.
This script:
1. Verifies all aircraft have associated images
2. Offers to download missing images from search engines
3. Normalizes image sizes for consistency
"""

import os
import sys
import requests
from PIL import Image
import json
import logging

# Set up the Flask app context
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app, db
from app.models import Aircraft

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Constants
STATIC_IMAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app', 'static', 'images', 'aircraft')
NORMALIZED_SIZE = (800, 600)

# User agent for requests (following Wikimedia policy)
USER_AGENT = 'FlightSchool/1.0 (https://github.com/jordanhubbard/flightschool; contact@flightschool.com)'
HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
}

def search_wikimedia_commons(query):
    """Search Wikimedia Commons for aircraft images."""
    logger.info(f"Searching Wikimedia Commons for: {query}")
    url = f"https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&generator=search&gsrsearch={query} aircraft&gsrlimit=5&iiprop=url"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        data = response.json()
        
        if 'query' in data and 'pages' in data['query']:
            results = []
            for page_id, page_data in data['query']['pages'].items():
                if 'imageinfo' in page_data and len(page_data['imageinfo']) > 0:
                    image_url = page_data['imageinfo'][0]['url']
                    title = page_data.get('title', '').replace('File:', '')
                    results.append({
                        'url': image_url,
                        'title': title
                    })
            return results
        else:
            logger.warning("No results found in Wikimedia Commons")
            return []
    except Exception as e:
        logger.error(f"Error searching Wikimedia Commons: {e}")
        return []

def search_duckduckgo(query):
    """Search DuckDuckGo for aircraft images."""
    logger.info(f"Searching DuckDuckGo for: {query}")
    try:
        # Try to import the DuckDuckGo search package
        from duckduckgo_search import DDGS
        
        with DDGS() as ddgs:
            results = list(ddgs.images(query + " aircraft", max_results=5))
            return [{'url': r['image'], 'title': r.get('title', 'Unknown')} for r in results]
    except ImportError:
        logger.warning("duckduckgo_search package not installed. Skipping DuckDuckGo search.")
        return []
    except Exception as e:
        logger.error(f"Error searching DuckDuckGo: {e}")
        return []

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
    
    missing_specific = []  # Track aircraft with missing specific images
    missing_fallback = []  # Track aircraft with missing fallback images
    
    for aircraft in Aircraft.query.all():
        expected_files = []
        
        # Only check for aircraft-specific image if explicitly assigned
        if aircraft.image_filename:
            img_path = os.path.join(STATIC_IMAGE_DIR, aircraft.image_filename)
            if not os.path.exists(img_path) or os.path.getsize(img_path) < 1024:
                # Only add to missing list if explicitly assigned
                logger.info(f"Aircraft {aircraft.registration} has an assigned image that's missing: {aircraft.image_filename}")
                expected_files.append(aircraft.image_filename)
                missing_specific.append(aircraft)
            else:
                # If the specific image exists, we're good - no need to check fallbacks
                continue
        
        # If no specific image is assigned or it's missing, check fallbacks
        
        # Add type-based fallback based on category and engine type if available
        try:
            if hasattr(aircraft, 'category') and aircraft.category:
                if aircraft.category == 'single_engine_land':
                    if hasattr(aircraft, 'engine_type') and aircraft.engine_type == 'piston':
                        expected_files.append('cessna172.jpg')
                    elif hasattr(aircraft, 'engine_type') and aircraft.engine_type == 'turboprop':
                        expected_files.append('tbm930.jpg')
                elif aircraft.category == 'multi_engine_land':
                    if hasattr(aircraft, 'engine_type') and aircraft.engine_type == 'piston':
                        expected_files.append('baron58.jpg')
                    elif hasattr(aircraft, 'engine_type') and aircraft.engine_type == 'turboprop':
                        expected_files.append('kingair350.jpg')
                    elif hasattr(aircraft, 'engine_type') and aircraft.engine_type == 'jet':
                        expected_files.append('citation.jpg')
        except AttributeError:
            # If category or engine_type attributes don't exist, just continue
            pass
        
        # Always include default as last resort
        expected_files.append('default.jpg')
        
        # Check if any of the expected fallback files exist
        found = False
        for fname in expected_files:
            img_path = os.path.join(STATIC_IMAGE_DIR, fname)
            if os.path.exists(img_path) and os.path.getsize(img_path) > 1024:
                found = True
                break
        
        if not found:
            missing_fallback.append(aircraft)
    
    # Process missing images
    missing = missing_specific + missing_fallback
    
    if missing:
        logger.info(f"Found {len(missing)} aircraft with missing images")
        
        for aircraft in missing:
            # Determine which list this aircraft is in
            is_specific = aircraft in missing_specific
            
            if is_specific:
                # This aircraft has a specific image assigned but missing
                expected_files = [aircraft.image_filename]
                logger.info(f"\nMissing specific image for aircraft: {aircraft.registration} ({aircraft.make} {aircraft.model})")
            else:
                # This aircraft is missing all fallback images
                expected_files = []
                logger.info(f"\nMissing all fallback images for aircraft: {aircraft.registration} ({aircraft.make} {aircraft.model})")
                
                # Add appropriate fallback images
                if aircraft.category == 'single_engine_land':
                    if aircraft.engine_type == 'piston':
                        expected_files.append('cessna172.jpg')
                    elif aircraft.engine_type == 'turboprop':
                        expected_files.append('tbm930.jpg')
                elif aircraft.category == 'multi_engine_land':
                    if aircraft.engine_type == 'piston':
                        expected_files.append('baron58.jpg')
                    elif aircraft.engine_type == 'turboprop':
                        expected_files.append('kingair350.jpg')
                    elif aircraft.engine_type == 'jet':
                        expected_files.append('citation.jpg')
                
                # Always include default as last resort
                expected_files.append('default.jpg')
            
            logger.info(f"Expected files: {', '.join(expected_files)}")
            
            # Try to find the most specific filename (not default)
            for fname in expected_files:
                if fname != 'default.jpg':
                    # Construct search query based on aircraft details
                    if hasattr(aircraft, 'make') and hasattr(aircraft, 'model'):
                        query = f"{aircraft.make} {aircraft.model}"
                    else:
                        # Just use registration if make/model not available
                        query = f"aircraft {aircraft.registration}"
                    
                    # Try Wikimedia Commons first
                    results = search_wikimedia_commons(query)
                    if not results:
                        # Fall back to DuckDuckGo if available
                        results = search_duckduckgo(query)
                    
                    if results:
                        logger.info(f"Found {len(results)} potential images:")
                        for idx, result in enumerate(results):
                            logger.info(f"  [{idx+1}] {result['title']}: {result['url']}")
                        
                        choice = input(f"Enter number to download and save as {fname} (Enter to skip): ").strip()
                        if choice.isdigit() and 1 <= int(choice) <= len(results):
                            img_url = results[int(choice)-1]['url']
                            img_path = os.path.join(STATIC_IMAGE_DIR, fname)
                            
                            if download_image(img_url, img_path):
                                normalize_image_size(img_path)
                                break
                        else:
                            logger.info("Skipped.")
                    else:
                        logger.warning(f"No images found for {query}")
                    
                    # Only try the first non-default filename
                    break
    else:
        logger.info("All aircraft have all required images.")
    
    # Provide a summary
    if missing_specific:
        logger.info(f"\nSummary: {len(missing_specific)} aircraft have missing specific images:")
        for aircraft in missing_specific:
            logger.info(f"  - {aircraft.registration}: missing {aircraft.image_filename}")
    else:
        logger.info("\nAll aircraft-specific images are present.")
    
    if missing_fallback:
        logger.info(f"\n{len(missing_fallback)} aircraft are missing all fallback images.")
    else:
        logger.info("\nAll aircraft have at least one fallback image available.")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        batch_normalize_all_images()
        check_aircraft_images()
