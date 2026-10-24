#!/usr/bin/env bash
# Applies the migration to a THROWAWAY local Postgres database ("pmtest") and checks the privacy rules.
# Uses the usual libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD). The user must be allowed to create databases
# and roles. Never point this at a real project: the stub creates roles and drops/recreates the "pmtest" database.
#   PGUSER=postgres bash test/run_sql_tests.sh
set -u
cd "$(dirname "$0")/.."
out=$(cat test/sql/00_supabase_stub.sql supabase/migrations/*.sql test/sql/02_rls_tests.sql | psql -X -q -v ON_ERROR_STOP=1 -d postgres 2>&1)
status=$?
echo "$out" | grep -E "PASS|FAIL|ERROR" | sed -e 's/^psql:[^ ]* //' -e 's/^NOTICE:  //'
fails=$(echo "$out" | grep -c "FAIL")
passes=$(echo "$out" | grep -c "PASS")
echo "SQL tests: $passes passed, $fails failed"
[ $status -eq 0 ] && [ "$fails" -eq 0 ] && [ "$passes" -gt 0 ]
