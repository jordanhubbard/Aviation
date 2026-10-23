#!/bin/bash

# Aviation Mission Management - Database Backup Script
# This script creates a backup of the H2 database

set -e

BACKUP_DIR="./backups"
DATA_DIR="./data"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="aviation-missions-backup-${TIMESTAMP}"

echo "🗄️  Creating database backup..."

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Check if database files exist
if [ ! -f "${DATA_DIR}/aviation-missions.mv.db" ]; then
    echo "❌ No database found at ${DATA_DIR}/aviation-missions.mv.db"
    echo "   Make sure the application has been started at least once."
    exit 1
fi

# Create backup directory for this backup
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "${BACKUP_PATH}"

# Copy database files
echo "📁 Copying database files..."
cp "${DATA_DIR}/aviation-missions.mv.db" "${BACKUP_PATH}/"
if [ -f "${DATA_DIR}/aviation-missions.trace.db" ]; then
    cp "${DATA_DIR}/aviation-missions.trace.db" "${BACKUP_PATH}/"
fi

# Create a timestamp file
echo "Backup created: $(date)" > "${BACKUP_PATH}/backup-info.txt"
echo "Database files:" >> "${BACKUP_PATH}/backup-info.txt"
ls -la "${BACKUP_PATH}/" >> "${BACKUP_PATH}/backup-info.txt"

# Create a compressed archive
echo "🗜️  Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
rm -rf "${BACKUP_NAME}/"
cd - > /dev/null

echo "✅ Backup completed successfully!"
echo "📦 Backup file: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo ""
echo "To restore this backup:"
echo "  1. Stop the application: make stop"
echo "  2. Extract: tar -xzf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz -C ${BACKUP_DIR}/"
echo "  3. Copy files: cp ${BACKUP_DIR}/${BACKUP_NAME}/* ${DATA_DIR}/"
echo "  4. Start application: make start"
