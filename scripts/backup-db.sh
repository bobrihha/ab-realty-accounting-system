#!/usr/bin/env bash
# Database Backup Script for Production

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_USER="${POSTGRES_USER:-realtyuser}"
POSTGRES_DB="${POSTGRES_DB:-realty_agency}"

mkdir -p "$BACKUP_DIR"

echo "Creating backup at $TIMESTAMP..."

# Using docker exec to create backup
docker exec realty-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

# Compress the backup
gzip "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "Backup created: $BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete

echo "Old backups cleaned up (retention: 30 days)"
