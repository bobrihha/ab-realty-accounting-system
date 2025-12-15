#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINK_DIR="${REALTY_SYMLINK_DIR:-/tmp/realty-agency}"

ln -sfn "$ROOT_DIR" "$LINK_DIR"

export DATABASE_URL="${DATABASE_URL:-file:${LINK_DIR}/db/custom.db}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dev-secret-change-me}"

