#!/bin/sh
# Pemanggil background job /api/jobs/* untuk cron / Coolify Scheduled Task.
#
#   ./scripts/run-job.sh dispatch-notifications
#   ./scripts/run-job.sh deadline-alerts
#   ./scripts/run-job.sh break-warnings
#
# Kenapa tidak curl langsung di crontab: contoh `curl ... >/dev/null 2>&1` membuang
# seluruh keluaran, jadi JOBS_SECRET yang salah atau aplikasi yang mati terlihat
# sama persis dengan job yang sukses — cron jalan bertahun-tahun tanpa hasil dan
# tidak ada yang tahu. Script ini mencetak ringkasan dan mengembalikan exit code
# bukan-nol saat gagal, sehingga Coolify menandai task-nya merah.
#
# Env:
#   JOBS_SECRET  (wajib) token Bearer, sama dengan yang dipakai aplikasi
#   JOBS_BASE_URL (opsional) default http://127.0.0.1:3000
#                 Default-nya localhost karena Scheduled Task Coolify berjalan
#                 di dalam container yang sama dengan aplikasi.
#   JOBS_TIMEOUT (opsional) detik, default 120

set -eu

JOB="${1:-}"
BASE_URL="${JOBS_BASE_URL:-http://127.0.0.1:3000}"
TIMEOUT="${JOBS_TIMEOUT:-120}"
STAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

log() { echo "[$STAMP] run-job ${JOB:-?}: $*"; }

case "$JOB" in
  dispatch-notifications|deadline-alerts|break-warnings) ;;
  "")
    echo "pemakaian: $0 <dispatch-notifications|deadline-alerts|break-warnings>" >&2
    exit 2
    ;;
  *)
    echo "job tidak dikenal: $JOB" >&2
    exit 2
    ;;
esac

if [ -z "${JOBS_SECRET:-}" ]; then
  log "GAGAL — JOBS_SECRET belum diset."
  exit 1
fi

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# -sS: senyap tapi tetap tampilkan error. Sengaja TANPA -f supaya badan respons
# error (yang memuat alasannya) tetap terbaca, bukan cuma "exit 22".
CODE="$(
  curl -sS -o "$BODY_FILE" -w '%{http_code}' \
    --max-time "$TIMEOUT" \
    -X POST \
    -H "Authorization: Bearer $JOBS_SECRET" \
    "$BASE_URL/api/jobs/$JOB"
)" || {
  log "GAGAL — tidak bisa menghubungi $BASE_URL (aplikasi mati atau URL salah)."
  exit 1
}

BODY="$(cat "$BODY_FILE")"

case "$CODE" in
  200)
    log "ok $BODY"
    ;;
  401)
    log "GAGAL 401 — JOBS_SECRET tidak cocok dengan milik aplikasi. $BODY"
    exit 1
    ;;
  500)
    log "GAGAL 500 — $BODY"
    exit 1
    ;;
  *)
    log "GAGAL HTTP $CODE — $BODY"
    exit 1
    ;;
esac
