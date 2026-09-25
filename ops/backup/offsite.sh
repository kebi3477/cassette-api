#!/bin/sh
# 외부 저장소(Cloudflare R2, Backblaze B2 등 S3 호환)로 매일 복제한다.
# - MinIO 버킷(녹음 파일) → offsite:$OFFSITE_BUCKET/minio (sync. 지워진 파일은 minio-deleted/<날짜>로 옮겨 보관)
# - Postgres 백업 파일   → offsite:$OFFSITE_BUCKET/postgres (copy)
# rclone 리모트(minio, offsite)는 RCLONE_CONFIG_* 환경 변수로 정의한다 (docker-compose.yml)
set -eu
if [ -z "${OFFSITE_BUCKET:-}" ]; then
  echo "[offsite] OFFSITE_BUCKET이 없어 외부 복제를 건너뜁니다"
  exit 0
fi
TODAY=$(date -u +%Y%m%d)
KEEP_DELETED="${OFFSITE_DELETED_RETENTION:-30d}"
KEEP_PG="${OFFSITE_POSTGRES_RETENTION:-30d}"

echo "[offsite] MinIO → offsite:${OFFSITE_BUCKET}/minio"
rclone sync "minio:${S3_BUCKET}" "offsite:${OFFSITE_BUCKET}/minio" \
  --backup-dir "offsite:${OFFSITE_BUCKET}/minio-deleted/${TODAY}" \
  --fast-list --transfers 4 --checksum

echo "[offsite] Postgres 백업 → offsite:${OFFSITE_BUCKET}/postgres"
rclone copy /backups/postgres "offsite:${OFFSITE_BUCKET}/postgres" --transfers 2

echo "[offsite] 보관 기간 지난 파일 정리 (postgres ${KEEP_PG}, minio-deleted ${KEEP_DELETED})"
rclone delete "offsite:${OFFSITE_BUCKET}/postgres" --min-age "$KEEP_PG" || true
rclone delete "offsite:${OFFSITE_BUCKET}/minio-deleted" --min-age "$KEEP_DELETED" --rmdirs || true
echo "[offsite] 완료"
