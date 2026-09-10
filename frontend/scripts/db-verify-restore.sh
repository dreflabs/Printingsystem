#!/bin/sh
# Latihan restore — buktikan backup benar-benar bisa dipulihkan.
#
#   ./scripts/db-verify-restore.sh                 # pakai backup terbaru
#   ./scripts/db-verify-restore.sh path/ke/x.dump  # pakai file tertentu
#
# Backup yang belum pernah diuji restore bukan backup, itu harapan. File bisa
# saja terbentuk rapi tiap hari dan baru ketahuan rusak, terpotong, atau kosong
# justru pada hari kamu membutuhkannya.
#
# Script ini memulihkan dump ke database SEMENTARA bernama acak, menghitung isi
# tabel-tabel penting, lalu menghapus database sementara itu. Database produksi
# tidak pernah disentuh — tidak ada perintah tulis apa pun ke sana.
#
# Env:
#   DATABASE_URL     (wajib) connection string produksi; hanya dibaca nama
#                    host/user-nya untuk membuat database latihan di server yang sama
#   BACKUP_DIR       (opsional) default ./backups
#   PP_DB_CONTAINER  (opsional) nama container Postgres, bila psql/pg_restore
#                    tidak ada di mesin ini
#   KEEP_DRILL_DB=1  (opsional) jangan hapus database latihan, untuk diperiksa manual

set -eu

DB_URL="${DATABASE_URL:-}"
DIR="${BACKUP_DIR:-./backups}"
CONTAINER="${PP_DB_CONTAINER:-}"
DUMP="${1:-}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] verify-restore: $*"; }

if [ -z "$DB_URL" ]; then
  log "GAGAL — DATABASE_URL belum diset."
  exit 1
fi

pg() {
  cmd="$1"; shift
  if [ -n "$CONTAINER" ]; then
    docker exec -i "$CONTAINER" "$cmd" "$@"
  else
    "$cmd" "$@"
  fi
}

if [ -z "$CONTAINER" ] && ! command -v pg_restore >/dev/null 2>&1; then
  log "GAGAL — pg_restore tidak ada. Set PP_DB_CONTAINER dan jalankan dari host VPS."
  exit 1
fi

# Pilih dump terbaru bila tidak disebutkan.
if [ -z "$DUMP" ]; then
  DUMP=$(ls -1t "$DIR"/printpilot-*.dump 2>/dev/null | head -1 || true)
fi
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  log "GAGAL — tidak ada file backup untuk diuji (dicari di $DIR)."
  exit 1
fi

# Nama database latihan: acak, dan selalu memuat penanda supaya tidak mungkin
# tertukar dengan database sungguhan.
DRILL="pp_restore_drill_$(date -u '+%Y%m%d%H%M%S')_$$"
case "$DRILL" in
  *restore_drill*) ;;
  *) log "GAGAL — nama database latihan tidak aman: $DRILL"; exit 1 ;;
esac

# Connection string ke database `postgres` di server yang sama, untuk
# CREATE/DROP DATABASE. Ganti hanya bagian nama database di URL.
base="${DB_URL%%\?*}"          # buang query string
qs=""
case "$DB_URL" in *\?*) qs="?${DB_URL#*\?}" ;; esac
prefix="${base%/*}"            # semua sampai sebelum nama database
ADMIN_URL="$prefix/postgres$qs"
DRILL_URL="$prefix/$DRILL$qs"

cleanup() {
  if [ "${KEEP_DRILL_DB:-0}" = "1" ]; then
    log "database latihan DIPERTAHANKAN: $DRILL"
    return
  fi
  pg psql --dbname="$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $DRILL;" >/dev/null 2>&1 || true
  log "database latihan dihapus: $DRILL"
}
trap cleanup EXIT

log "menguji $(basename "$DUMP") ($(wc -c < "$DUMP" | tr -d ' ') byte)"
log "membuat database latihan $DRILL"

if ! pg psql --dbname="$ADMIN_URL" -q -c "CREATE DATABASE $DRILL;" >/tmp/drill.err 2>&1; then
  log "GAGAL — tidak bisa membuat database latihan: $(head -c 300 /tmp/drill.err)"
  exit 1
fi

log "memulihkan…"
if ! pg pg_restore --no-owner --no-acl --dbname="$DRILL_URL" < "$DUMP" >/tmp/drill.err 2>&1; then
  log "GAGAL — pg_restore error: $(head -c 500 /tmp/drill.err)"
  exit 1
fi

# ── Periksa isinya masuk akal ───────────────────────────────────────────
# Nama tabel PascalCase karena schema Prisma tidak memakai @@map — di Postgres
# identifier tanpa kutip dilipat jadi huruf kecil, jadi kutip gandanya WAJIB.
log "memeriksa isi:"
FAIL=0
for t in Tenant User Role Order SuperAdmin; do
  n=$(pg psql --dbname="$DRILL_URL" -tAc "SELECT count(*) FROM \"$t\";" 2>/dev/null || echo "ERR")
  case "$n" in
    ERR|"") log "  $t: TABEL TIDAK ADA"; FAIL=1 ;;
    *)      log "  $t: $n baris" ;;
  esac
done

# Tenant kosong tidak selalu salah (instalasi baru), tapi tabelnya wajib ada.
if [ "$FAIL" -eq 1 ]; then
  log "GAGAL — backup tidak memuat struktur yang diharapkan."
  exit 1
fi

log "ok — backup terbukti bisa dipulihkan"
