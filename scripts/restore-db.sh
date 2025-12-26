#!/usr/bin/env bash
# Database Restore Script for Production

set -euo pipefail

BACKUP_FILE="$1"
POSTGRES_USER="${POSTGRES_USER:-realtyuser}"
POSTGRES_DB="${POSTGRES_DB:-realty_agency}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring database from: $BACKUP_FILE"
echo "WARNING: This will replace all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Decompress and restore
gunzip -c "$BACKUP_FILE" | docker exec -i realty-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Database restored successfully from $BACKUP_FILE"
