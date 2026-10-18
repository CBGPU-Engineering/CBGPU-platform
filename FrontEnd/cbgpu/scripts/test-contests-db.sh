#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
runtime="${CONTEST_TEST_RUNTIME:-podman}"
container="cbgpu-contests-test-${RANDOM}-$$"
cleanup() { "$runtime" rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$runtime" run -d --name "$container" -e POSTGRES_PASSWORD=contest-test-only docker.io/library/postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if "$runtime" exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
"$runtime" exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < tests/contests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  "$runtime" exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < "$migration"
done
"$runtime" exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < tests/contests/database.sql
"$runtime" exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < tests/contests/logos.sql
