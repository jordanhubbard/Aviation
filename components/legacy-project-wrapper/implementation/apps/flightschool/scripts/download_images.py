#!/usr/bin/env python3
import os
import requests
from PIL import Image
from io import BytesIO
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Updated aircraft images with reliable sources that allow hotlinking
AIRCRAFT_IMAGES = {
    'cessna172.jpg': 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?q=80&w=1964&auto=format&fit=crop',
    'tbm930.jpg': 'https://images.pexels.com/photos/1381613/pexels-photo-1381613.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    'baron58.jpg': 'https://images.pexels.com/photos/1556801/pexels-photo-1556801.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    'kingair350.jpg': 'https://images.pexels.com/photos/46148/aircraft-jet-landing-cloud-46148.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    'citation.jpg': 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=1000',
    'default.jpg': 'https://images.pexels.com/photos/1089306/pexels-photo-1089306.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
}

# Define a comprehensive user agent string to prevent sites from blocking requests
USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'

def download_and_save_image(url, filename, target_size=(800, 600)):
    """Download an image from URL, resize it, and save it as JPEG."""
    logger.info(f"Downloading {url} to {filename}")
    try:
        # Add user agent header and other headers to the request
        headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/'
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        logger.info(f"Downloaded {len(response.content)} bytes")
        
        # Open the image using PIL
        img = Image.open(BytesIO(response.content))
        logger.info(f"Opened image: size={img.size}, mode={img.mode}")
        
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            logger.info("Converted image to RGB mode")
        
        # Resize image while maintaining aspect ratio
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        logger.info(f"Resized image to {img.size}")
        
        # Save as JPEG with good quality
        img.save(filename, 'JPEG', quality=85)
        logger.info(f"Successfully saved {filename}")
        return True
    except Exception as e:
        logger.error(f"Error downloading {filename} from {url}: {str(e)}")
        return False

def main():
    # Create the aircraft images directory if it doesn't exist
    image_dir = os.path.join('app', 'static', 'images', 'aircraft')
    os.makedirs(image_dir, exist_ok=True)
    logger.info(f"Using image directory: {image_dir}")
    
    # Download each image
    for filename, url in AIRCRAFT_IMAGES.items():
        filepath = os.path.join(image_dir, filename)
        if not os.path.exists(filepath):
            logger.info(f"Downloading {filename}...")
            download_and_save_image(url, filepath)
        else:
            logger.info(f"Skipping {filename} - already exists")

if __name__ == '__main__':
    main()
