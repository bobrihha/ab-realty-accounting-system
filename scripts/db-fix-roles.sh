#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINK_DIR="${REALTY_SYMLINK_DIR:-/tmp/realty-agency}"

ln -sfn "$ROOT_DIR" "$LINK_DIR"

DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  DB_USER="${POSTGRES_USER:-realtyuser}"
  DB_PASS="${POSTGRES_PASSWORD:-changeme123}"
  DB_NAME="${POSTGRES_DB:-realty_agency}"
  DB_HOST="${POSTGRES_HOST:-localhost}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
fi

if [[ "$DB_URL" != file:* ]]; then
  echo "db-fix-roles is SQLite-only. Use a SQL client for PostgreSQL." >&2
  exit 0
fi

DB_PATH="${DB_URL#file:}"
if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

sqlite3 "$DB_PATH" "UPDATE employees SET role='OWNER' WHERE role='ADMIN';"
echo "Updated roles: ADMIN -> OWNER in $DB_PATH"
