#!/bin/sh
# Nightly backup: compressed custom-format dump of the database (run by cron / a scheduled job on the host).
#   deploy/backup.sh [output-dir]      → <dir>/vyralink-YYYYmmdd-HHMMSS.dump
# Uploaded files live in the "storage" volume; back that up with the same schedule (or move to S3 with versioning).
set -eu
out="${1:-./backups}"
mkdir -p "$out"
file="$out/vyralink-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T postgres pg_dump -U vyralink -d vyralink -Fc > "$file"
echo "$file ($(wc -c < "$file") bytes)"
