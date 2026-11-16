#!/bin/sh
# Restore drill: restores a dump into a scratch database next to the live one and compares row counts table by table.
# Never touches the live database.   deploy/restore-drill.sh backups/vyralink-....dump
set -eu
dump="$1"
psql() { docker compose exec -T postgres psql -U vyralink -v ON_ERROR_STOP=1 "$@"; }
psql -d postgres -c "DROP DATABASE IF EXISTS restore_drill" -c "CREATE DATABASE restore_drill" > /dev/null
docker compose exec -T postgres pg_restore -U vyralink -d restore_drill --no-owner < "$dump"
count() { psql -d "$1" -tAc "SELECT string_agg(t || '=' || n, ' ' ORDER BY t) FROM (SELECT relname AS t, n_live_tup AS n FROM pg_stat_user_tables) s" ; }
psql -d vyralink -c "ANALYZE" > /dev/null; psql -d restore_drill -c "ANALYZE" > /dev/null
live=$(count vyralink); restored=$(count restore_drill)
psql -d postgres -c "DROP DATABASE restore_drill" > /dev/null
if [ "$live" = "$restored" ]; then echo "restore drill OK: $(echo "$live" | wc -w) tables match"; else echo "MISMATCH"; echo "live:     $live"; echo "restored: $restored"; exit 1; fi
