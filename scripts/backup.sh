#!/usr/bin/env bash
#
# Backup WebCafe: dump database + folder uploads.
#
# Cron harian 02.15 (hindari :00 — semua cron sedunia menumpuk di sana):
#   15 2 * * * /var/www/web-cafe/scripts/backup.sh >> /var/log/webcafe-backup.log 2>&1
#
# Restore: lihat bagian bawah file ini.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/webcafe}"
SIMPAN_HARI="${SIMPAN_HARI:-14}"
TANGGAL="$(date +%F-%H%M)"

ENV_FILE="$REPO_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "FATAL: $ENV_FILE tidak ada"; exit 1; }

command -v node >/dev/null || { echo "FATAL: node tidak ada di PATH"; exit 1; }
command -v mariadb-dump >/dev/null || { echo "FATAL: mariadb-dump tidak ada di PATH"; exit 1; }

# DATABASE_URL diurai oleh Node, bukan string-manipulation bash: Prisma
# mewajibkan karakter khusus di-percent-encode, dan password kuat sering
# berisi @ : / # ?. Tanpa decode, mariadb-dump menerima "p%40ss" bukan "p@ss".
# Node sudah pasti ada di mesin ini — backend-nya jalan di atasnya.
eval "$(node -e '
const fs = require("node:fs");
const isi = fs.readFileSync(process.argv[1], "utf8");
const ambil = (k) => {
  const m = isi.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["\x27]|["\x27]$/g, "") : "";
};
const url = ambil("DATABASE_URL");
if (!url) { console.error("DATABASE_URL kosong di .env"); process.exit(1); }
const u = new URL(url);
const sh = (v) => "\x27" + String(v).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
console.log(`DB_USER=${sh(decodeURIComponent(u.username))}`);
console.log(`DB_PASS=${sh(decodeURIComponent(u.password))}`);
console.log(`DB_HOST=${sh(u.hostname)}`);
console.log(`DB_PORT=${sh(u.port || "3306")}`);
console.log(`DB_NAME=${sh(u.pathname.replace(/^\//, ""))}`);
console.log(`UPLOAD_DIR=${sh(ambil("UPLOAD_DIR") || "./uploads")}`);
' "$ENV_FILE")"

[[ -n "${DB_NAME:-}" ]] || { echo "FATAL: nama database tidak terbaca dari DATABASE_URL"; exit 1; }

mkdir -p "$BACKUP_DIR"
# Backup berisi seluruh data pelanggan: jangan bisa dibaca user lain.
chmod 700 "$BACKUP_DIR"

DUMP="$BACKUP_DIR/db-$TANGGAL.sql.gz"
ARSIP="$BACKUP_DIR/uploads-$TANGGAL.tar.gz"

echo "[$(date +%T)] dump $DB_NAME -> $DUMP"

# --single-transaction: snapshot konsisten tanpa mengunci tabel, jadi cafe
#   tetap bisa menerima order selama backup jalan.
# --quick: baris dialirkan satu per satu, menahan pemakaian RAM di mesin 1GB.
# MYSQL_PWD, bukan --password=: argumen terlihat di `ps` oleh semua user.
MYSQL_PWD="$DB_PASS" mariadb-dump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --quick --routines --events \
  "$DB_NAME" | gzip -9 > "$DUMP"

chmod 600 "$DUMP"

[[ "$UPLOAD_DIR" = /* ]] || UPLOAD_DIR="$REPO_DIR/$UPLOAD_DIR"

if [[ -d "$UPLOAD_DIR" ]]; then
  echo "[$(date +%T)] arsip foto menu -> $ARSIP"
  tar czf "$ARSIP" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  chmod 600 "$ARSIP"
else
  echo "[$(date +%T)] $UPLOAD_DIR tidak ada, dilewati"
fi

# Dump kosong = backup gagal yang terlihat sukses. Diperiksa SEBELUM rotasi,
# supaya backup lama tidak dihapus demi backup rusak.
UKURAN="$(stat -c %s "$DUMP")"
if (( UKURAN < 1024 )); then
  echo "FATAL: dump hanya $UKURAN byte — kemungkinan gagal. Backup lama TIDAK dihapus."
  exit 1
fi
gzip -t "$DUMP" || { echo "FATAL: $DUMP korup (gzip -t gagal)"; exit 1; }

echo "[$(date +%T)] buang backup lebih lama dari $SIMPAN_HARI hari"
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$SIMPAN_HARI" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime "+$SIMPAN_HARI" -delete

echo "[$(date +%T)] selesai — $(du -h "$DUMP" | cut -f1) db, $(find "$BACKUP_DIR" -maxdepth 1 -type f | wc -l) file tersimpan"

# ---------------------------------------------------------------------------
# RESTORE
#
# Uji restore ke database terpisah SEKALI sebelum mengandalkan backup ini.
# Backup yang belum pernah di-restore belum terbukti backup.
#
#   sudo mariadb -e "CREATE DATABASE webcafe_uji"
#   gunzip < /var/backups/webcafe/db-YYYY-MM-DD-HHMM.sql.gz | sudo mariadb webcafe_uji
#   sudo mariadb webcafe_uji -e "SELECT COUNT(*) FROM orders"
#   sudo mariadb -e "DROP DATABASE webcafe_uji"
#
# Restore sungguhan MENIMPA data yang ada. Pastikan itu memang yang diinginkan:
#
#   pm2 stop cafe-api
#   gunzip < db-YYYY-MM-DD-HHMM.sql.gz | mariadb webcafe
#   tar xzf uploads-YYYY-MM-DD-HHMM.tar.gz -C /var/www/web-cafe
#   pm2 start cafe-api
#
# Simpan salinan di LUAR VPS ini. Disk yang mati membawa backup-nya sekalian:
#   rsync -az /var/backups/webcafe/ user@mesin-lain:/backup/webcafe/
# ---------------------------------------------------------------------------
