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

if [[ "$DB_URL" == file:* ]]; then
  DB_PATH="${DB_URL#file:}"
  mkdir -p "$(dirname "$DB_PATH")"

  if [ -f "$DB_PATH" ]; then
    ts="$(date +%Y%m%d_%H%M%S)"
    cp "$DB_PATH" "${DB_PATH}.${ts}.bak"
  fi

  sql="$(mktemp)"

  DATABASE_URL="$DB_URL" npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --shadow-database-url "file:${sql}.shadow.db" >"$sql"

  rm -f "$DB_PATH"
  sqlite3 "$DB_PATH" <"$sql"
  rm -f "$sql" "${sql}.shadow.db"

  echo "Initialized SQLite database at: $DB_PATH"
else
  DATABASE_URL="$DB_URL" npx prisma db push
  echo "Initialized PostgreSQL database at: $DB_URL"
fi
