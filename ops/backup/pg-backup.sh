#!/bin/sh
# Postgres 백업: pg_dump 사용자 지정 형식(-Fc, 압축)으로 /backups/postgres에 쓰고 최근 BACKUP_KEEP개만 남긴다.
# 필요한 환경 변수: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE, BACKUP_KEEP(기본 14)
set -eu
KEEP="${BACKUP_KEEP:-14}"
DIR=/backups/postgres
mkdir -p "$DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$DIR/${PGDATABASE}-${TS}.dump"

echo "[pg-backup] 시작 $FILE"
pg_dump --format=custom --compress=6 --no-owner --file="$FILE.part"
mv "$FILE.part" "$FILE"
echo "[pg-backup] 완료 $(du -h "$FILE" | cut -f1)"

# 오래된 백업 정리 (최신 KEEP개 유지)
ls -1t "$DIR"/*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  echo "[pg-backup] 오래된 백업 삭제 $old"
  rm -f "$old"
done
