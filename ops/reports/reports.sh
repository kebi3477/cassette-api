#!/bin/sh
# 신고 조회·상태 변경 (관리자 API가 생기기 전까지 미니PC에서 쓴다). docs/deploy.md "신고 처리" 참고.
#
#   ops/reports/reports.sh list [개수]          최근 신고 (기본 20개, 상태가 received인 것부터)
#   ops/reports/reports.sh show <신고 id>       신고 한 건과 대상 정보
#   ops/reports/reports.sh set <신고 id> <상태>  상태 변경: received | reviewed | actioned | dismissed
#
# 기본은 docker compose의 postgres 컨테이너에서 psql을 돈다 (ENV_FILE, 기본 .env.production).
# 로컬에서 시험할 때: REPORTS_PSQL="psql cassette_dev" ops/reports/reports.sh list
set -eu
cd "$(dirname "$0")/../.."

run_psql() {
  if [ -n "${REPORTS_PSQL:-}" ]; then
    # shellcheck disable=SC2086
    $REPORTS_PSQL -X -q -v ON_ERROR_STOP=1 "$@"
  else
    docker compose --env-file "${ENV_FILE:-.env.production}" exec -T postgres \
      sh -c 'psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
  fi
}

is_uuid() {
  echo "$1" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
}

cmd="${1:-list}"
case "$cmd" in
  list)
    limit="${2:-20}"
    echo "$limit" | grep -Eq '^[0-9]+$' || { echo "개수는 숫자로 적어 주세요" >&2; exit 1; }
    run_psql -v limit="$limit" <<'SQL'
SELECT r.id,
       to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS "신고 시각(KST)",
       r.status AS "상태",
       r.reason AS "사유",
       r.target_type AS "대상",
       COALESCE(tu.name, su.name, '(탈퇴·없음)') AS "대상 이름",
       COALESCE(ru.name, '(탈퇴)') AS "신고자",
       left(COALESCE(r.memo, ''), 40) AS "메모"
  FROM reports r
  LEFT JOIN users ru ON ru.id = r.reporter_id
  LEFT JOIN users tu ON r.target_type = 'user' AND tu.id = r.target_id
  LEFT JOIN users su ON r.target_type = 'tape' AND su.id = r.tape_sender_id
 ORDER BY (r.status = 'received') DESC, r.created_at DESC
 LIMIT :limit;
SQL
    ;;
  show)
    id="${2:-}"
    is_uuid "$id" || { echo "신고 id(uuid)를 적어 주세요" >&2; exit 1; }
    run_psql -v id="$id" <<'SQL'
\x on
SELECT r.*,
       ru.name AS reporter_name,
       tu.name AS target_user_name,
       su.name AS tape_sender_name,
       d.sender_name AS tape_sender_name_at_send,
       d.sent_at AS tape_sent_at,
       d.opened_at AS tape_opened_at,
       d.deleted_at AS tape_deleted_at,
       rec.processed_key AS tape_file_key,
       (SELECT count(*) FROM reports x
         WHERE x.target_id = r.target_id OR (r.tape_sender_id IS NOT NULL AND x.tape_sender_id = r.tape_sender_id)
       ) AS reports_on_same_target
  FROM reports r
  LEFT JOIN users ru ON ru.id = r.reporter_id
  LEFT JOIN users tu ON r.target_type = 'user' AND tu.id = r.target_id
  LEFT JOIN users su ON su.id = r.tape_sender_id
  LEFT JOIN deliveries d ON r.target_type = 'tape' AND d.id = r.target_id
  LEFT JOIN recordings rec ON rec.id = d.recording_id
 WHERE r.id = :'id';
SQL
    ;;
  set)
    id="${2:-}"; status="${3:-}"
    is_uuid "$id" || { echo "신고 id(uuid)를 적어 주세요" >&2; exit 1; }
    case "$status" in
      received|reviewed|actioned|dismissed) ;;
      *) echo "상태는 received | reviewed | actioned | dismissed 중 하나예요" >&2; exit 1 ;;
    esac
    run_psql -v id="$id" -v status="$status" <<'SQL'
UPDATE reports SET status = :'status' WHERE id = :'id' RETURNING id, status;
SQL
    ;;
  *)
    sed -n '2,7p' "$0"
    exit 1
    ;;
esac
