#!/usr/bin/env python3
"""Script to restore backed up aircraft images."""

import os
import sys
import shutil

def main():
    """Restore backed up aircraft images."""
    image_dir = os.path.join('app/static/images/aircraft')
    
    # Find all backup files
    backup_files = [f for f in os.listdir(image_dir) if f.endswith('.bak')]
    
    if not backup_files:
        print("No backup files found.")
        return
    
    print(f"Found {len(backup_files)} backup files:")
    for backup in backup_files:
        original = backup[:-4]  # Remove .bak extension
        backup_path = os.path.join(image_dir, backup)
        original_path = os.path.join(image_dir, original)
        
        print(f"Restoring {backup} to {original}...")
        shutil.copy2(backup_path, original_path)
        os.remove(backup_path)
        print(f"Restored {original} and removed backup.")

if __name__ == '__main__':
    main()
