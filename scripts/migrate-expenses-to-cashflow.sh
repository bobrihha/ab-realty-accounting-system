#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/env.sh"

if [[ "$DATABASE_URL" != file:* ]]; then
  echo "migrate-expenses-to-cashflow is SQLite-only. Skipping."
  exit 0
fi

DB_PATH="${DATABASE_URL#file:}"

has_expenses_table="$(
  sqlite3 "$DB_PATH" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='expenses' LIMIT 1;"
)"

has_cashflow_status_column="$(
  sqlite3 "$DB_PATH" "SELECT 1 FROM pragma_table_info('cash_flow') WHERE name='status' LIMIT 1;"
)"

if [[ "$has_expenses_table" == "1" && "$has_cashflow_status_column" == "1" ]]; then
  sqlite3 "$DB_PATH" <<'SQL'
PRAGMA foreign_keys=OFF;
BEGIN;

INSERT OR IGNORE INTO accounts (id, name, balance, type, createdAt, updatedAt)
VALUES ('legacy_expenses', 'Legacy: Expenses', 0, 'DIGITAL', datetime('now'), datetime('now'));

INSERT INTO cash_flow (id, type, amount, category, status, plannedDate, actualDate, description, accountId, createdAt)
SELECT
  'expense_' || e.id,
  'EXPENSE',
  e.amount,
  e.category,
  'PAID',
  e.date,
  e.date,
  e.description,
  'legacy_expenses',
  e.createdAt
FROM expenses e
WHERE NOT EXISTS (SELECT 1 FROM cash_flow cf WHERE cf.id = 'expense_' || e.id);

UPDATE cash_flow
SET status = CASE WHEN actualDate IS NULL THEN 'PLANNED' ELSE 'PAID' END;

COMMIT;
PRAGMA foreign_keys=ON;
SQL
elif [[ "$has_expenses_table" == "1" && "$has_cashflow_status_column" != "1" ]]; then
  sqlite3 "$DB_PATH" <<'SQL'
PRAGMA foreign_keys=OFF;
BEGIN;

INSERT OR IGNORE INTO accounts (id, name, balance, type, createdAt, updatedAt)
VALUES ('legacy_expenses', 'Legacy: Expenses', 0, 'DIGITAL', datetime('now'), datetime('now'));

INSERT INTO cash_flow (id, type, amount, category, plannedDate, actualDate, description, accountId, createdAt)
SELECT
  'expense_' || e.id,
  'EXPENSE',
  e.amount,
  e.category,
  e.date,
  e.date,
  e.description,
  'legacy_expenses',
  e.createdAt
FROM expenses e
WHERE NOT EXISTS (SELECT 1 FROM cash_flow cf WHERE cf.id = 'expense_' || e.id);

COMMIT;
PRAGMA foreign_keys=ON;
SQL
fi

if [[ "$has_expenses_table" == "1" ]]; then
  echo "Migrated 'expenses' → 'cash_flow' (legacy_expenses)."
else
  echo "No 'expenses' table found — nothing to migrate."
fi

if [[ "$has_cashflow_status_column" == "1" ]]; then
  sqlite3 "$DB_PATH" "UPDATE cash_flow SET status = CASE WHEN actualDate IS NULL THEN 'PLANNED' ELSE 'PAID' END;"
  echo "Backfilled 'cash_flow.status' from actualDate."
fi
