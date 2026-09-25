#!/bin/sh
# 백업 컨테이너 진입점: CRON_SCHEDULE(UTC)에 JOB을 돌리는 busybox crond를 띄운다.
# 수동 실행: docker compose --env-file .env.production run --rm --entrypoint /bin/sh <서비스> /ops/backup/<스크립트>.sh
set -eu
: "${CRON_SCHEDULE:?CRON_SCHEDULE이 없습니다}"
: "${JOB:?JOB이 없습니다}"
mkdir -p /etc/crontabs
# crond는 환경 변수를 넘기지 않으므로 지금 환경을 파일로 저장해 두고 작업 전에 불러온다
export -p > /tmp/job.env
echo "${CRON_SCHEDULE} . /tmp/job.env; ${JOB} > /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] ${CRON_SCHEDULE} (UTC) 에 ${JOB} 실행"
exec crond -f -l 8
