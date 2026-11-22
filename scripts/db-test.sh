#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres (with a small Supabase
# shim) and runs every supabase/tests/*.sql file. No Docker or network needed.
# Usage: npm run test:db    (needs Postgres server binaries: initdb, pg_ctl, psql)
#        npm run gen:types  (same, then writes src/types/supabase.ts)
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb)")"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d /tmp/lifeos-pg.XXXXXX)"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}
[ "$(id -u)" = "0" ] && chown postgres "$DATA"

cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  rm -rf -- "$DATA"
}
trap cleanup EXIT

as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -w -l "$DATA/server.log" \
  -o "-p $PORT -k $DATA -c listen_addresses=''" start >/dev/null

psql_file() {
  as_pg psql -X -q -v ON_ERROR_STOP=1 -h "$DATA" -p "$PORT" -U postgres -d postgres -f "$1"
}
run_sql() { psql_file "$1" >/dev/null; } # NOTICEs/errors still reach stderr
shopt -s nullglob

run_sql supabase/tests/local/shim.sql
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  run_sql "$f"
done
if [ "${1:-}" = "--gen-types" ]; then
  psql_file scripts/db-types.sql > "$DATA/schema.json"
  node scripts/gen-types.mjs "$DATA/schema.json" src/types/supabase.ts
  npx prettier --write src/types/supabase.ts >/dev/null
  exit 0
fi

for f in supabase/tests/*.sql; do
  echo "test     $(basename "$f")"
  psql_file "$f"
done
echo "db tests passed"
