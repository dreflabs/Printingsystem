#!/bin/sh
# Backup database + verifikasi isinya.
#
#   ./scripts/db-backup.sh
#
# Melengkapi (bukan menggantikan) fitur Backups bawaan Coolify. Yang tidak
# ditutup Coolify: tidak ada yang memeriksa backup benar-benar terbentuk dan
# masuk akal. Backup yang gagal diam-diam persis sama tidak bergunanya dengan
# tidak punya backup — dan itu baru ketahuan saat kamu membutuhkannya.
#
# Script ini men-dump, lalu MEMBACA ULANG hasilnya untuk memastikan file itu
# arsip Postgres yang sah dan berisi tabel, baru menganggapnya sukses.
# Exit code bukan-nol kalau ada yang salah, supaya scheduler menandainya merah.
#
# Env:
#   DATABASE_URL      (wajib) connection string
#   BACKUP_DIR        (opsional) default ./backups
#   BACKUP_KEEP       (opsional) jumlah file disimpan, default 7
#   BACKUP_MIN_TABLES (opsional) minimal tabel di dump, default 20
#   PP_DB_CONTAINER   (opsional) nama container Postgres. Diisi bila pg_dump
#                     tidak ada di mesin ini — perintah dijalankan lewat
#                     `docker exec`. Container aplikasi Next.js biasanya TIDAK
#                     memuat pg_dump, jadi jalankan dari host VPS.

set -eu

DB_URL="${DATABASE_URL:-}"
DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP:-7}"
MIN_TABLES="${BACKUP_MIN_TABLES:-20}"
CONTAINER="${PP_DB_CONTAINER:-}"
STAMP="$(date -u '+%Y%m%d-%H%M%S')"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] db-backup: $*"; }

if [ -z "$DB_URL" ]; then
  log "GAGAL — DATABASE_URL belum diset."
  exit 1
fi

# Jalankan perintah Postgres langsung, atau lewat container bila diminta.
pg() {
  cmd="$1"; shift
  if [ -n "$CONTAINER" ]; then
    docker exec -i "$CONTAINER" "$cmd" "$@"
  else
    "$cmd" "$@"
  fi
}

if [ -z "$CONTAINER" ] && ! command -v pg_dump >/dev/null 2>&1; then
  log "GAGAL — pg_dump tidak ada di mesin ini. Set PP_DB_CONTAINER=<nama container postgres>"
  log "        dan jalankan script ini dari host VPS."
  exit 1
fi

mkdir -p "$DIR"
OUT="$DIR/printpilot-$STAMP.dump"

log "mulai dump → $OUT"

# -Fc = format custom: terkompresi, dan bisa direstore selektif per tabel.
if ! pg pg_dump --format=custom --no-owner --no-acl --dbname="$DB_URL" > "$OUT" 2>/tmp/pgdump.err; then
  log "GAGAL — pg_dump error: $(head -c 400 /tmp/pgdump.err)"
  rm -f "$OUT"
  exit 1
fi

# ── Verifikasi: file ada isinya dan benar-benar arsip Postgres ──────────
SIZE=$(wc -c < "$OUT" | tr -d ' ')
if [ "$SIZE" -lt 1024 ]; then
  log "GAGAL — hasil dump hanya ${SIZE} byte, hampir pasti kosong."
  rm -f "$OUT"
  exit 1
fi

TABLES=$(pg pg_restore --list < "$OUT" 2>/dev/null | grep -c ' TABLE ' || true)
if [ "$TABLES" -lt "$MIN_TABLES" ]; then
  log "GAGAL — dump hanya memuat ${TABLES} tabel (minimal ${MIN_TABLES})."
  log "        File TIDAK dihapus supaya bisa diperiksa: $OUT"
  exit 1
fi

log "ok — ${SIZE} byte, ${TABLES} tabel"

# ── Rotasi ─────────────────────────────────────────────────────────────
TOTAL=$(ls -1 "$DIR"/printpilot-*.dump 2>/dev/null | wc -l | tr -d ' ')
if [ "$TOTAL" -gt "$KEEP" ]; then
  REMOVE=$((TOTAL - KEEP))
  ls -1t "$DIR"/printpilot-*.dump | tail -n "$REMOVE" | while read -r old; do
    rm -f "$old"
    log "hapus backup lama: $(basename "$old")"
  done
fi

KEPT=$(ls -1 "$DIR"/printpilot-*.dump 2>/dev/null | wc -l | tr -d ' ')
log "selesai — $KEPT file tersimpan di $DIR"
