#!/usr/bin/env bash
# Runs the schema and security tests against a throwaway local Postgres (no Supabase account needed).
# Usage: PGHOST=... PGPORT=... PGUSER=... bash tests/run_db_tests.sh     (needs a running Postgres you can create databases in)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=uk_test_$$
psql -q -c "create database $DB"
trap 'psql -q -c "drop database $DB" >/dev/null' EXIT
for f in tests/stub_supabase.sql supabase/migrations/*.sql; do psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f"; done
psql -q -d "$DB" -f tests/db_test.sql | tee /tmp/uk_db_results.txt
! grep -q FAIL /tmp/uk_db_results.txt && echo "All database checks passed."
