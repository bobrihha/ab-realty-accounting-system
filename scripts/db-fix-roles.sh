#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINK_DIR="${REALTY_SYMLINK_DIR:-/tmp/realty-agency}"

ln -sfn "$ROOT_DIR" "$LINK_DIR"

DB_URL="${DATABASE_URL:-file:${LINK_DIR}/db/custom.db}"
DB_PATH="${DB_URL#file:}"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

sqlite3 "$DB_PATH" "UPDATE employees SET role='OWNER' WHERE role='ADMIN';"
echo "Updated roles: ADMIN -> OWNER in $DB_PATH"

