#!/usr/bin/env bash
# پشتیبانِ ملک‌جت — دیتابیس و فایل‌های دادهٔ JSON.
#
# درسِ ۲۹ اوت ۲۰۲۶: با `set -e`، شکستِ pg_dump کلِ اسکریپت را کشت و پشتیبانِ
# فایل‌ها هم ساخته نشد — درست همان شبی که فایل‌ها داشتند نابود می‌شدند. این دو
# مستقل‌اند و باید مستقل هم شکست بخورند. هیچ خطایی هم نباید بی‌صدا بماند.
set -uo pipefail

DB="${MELKJET_DB:-melkjet}"
APP_DIR="${MELKJET_APP_DIR:-/var/www/melkjet/melkjet-nextjs}"
BACKUP_DIR="${MELKJET_BACKUP_DIR:-/var/backups/melkjet}"
KEEP_DAYS="${MELKJET_BACKUP_KEEP_DAYS:-14}"
KEEP_MIN="${MELKJET_BACKUP_KEEP_MIN:-5}"      # هرگز کمتر از این تعداد نگه ندار
FAIL=0
say() { echo "[$(date -Is)] $*"; }
bad() { FAIL=1; say "✗ $*"; logger -t melkjet-backup "FAIL: $*"; }

if [ "$(id -un)" = "postgres" ]; then PGDUMP=(pg_dump); else PGDUMP=(sudo -u postgres pg_dump); fi
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -name '*.tmp' -mmin +120 -delete 2>/dev/null   # زباله‌های تلاشِ ناموفق
DB_FILE="$BACKUP_DIR/melkjet-db-$STAMP.sql.gz"
FILES_FILE="$BACKUP_DIR/melkjet-files-$STAMP.tar.gz"
say "شروعِ پشتیبان → $BACKUP_DIR"

# ── ۱) دیتابیس ──
if "${PGDUMP[@]}" --no-owner --no-privileges "$DB" 2>/tmp/bk-db.err | gzip -9 > "$DB_FILE.tmp"; then
  if gzip -t "$DB_FILE.tmp" 2>/dev/null && [ "$(stat -c%s "$DB_FILE.tmp")" -gt 1000000 ]; then
    mv "$DB_FILE.tmp" "$DB_FILE"; say "✓ دیتابیس: $(du -h "$DB_FILE" | cut -f1)"
  else
    rm -f "$DB_FILE.tmp"; bad "دیتابیس: فایل معیوب یا خیلی کوچک"
  fi
else
  rm -f "$DB_FILE.tmp"; bad "دیتابیس: $(head -2 /tmp/bk-db.err | tr '\n' ' ')"
fi

# ── ۲) فایل‌های JSON — مستقل از نتیجهٔ بالا ──
# الگو از .*-data.json به .*.json گشاد شد؛ قبلاً persiansaze/divar-places جا می‌ماندند.
if ( cd "$APP_DIR" && tar -czf "$FILES_FILE.tmp" .*.json ) 2>/tmp/bk-f.err; then
  if gzip -t "$FILES_FILE.tmp" 2>/dev/null && [ "$(stat -c%s "$FILES_FILE.tmp")" -gt 100000 ]; then
    mv "$FILES_FILE.tmp" "$FILES_FILE"; say "✓ فایل‌ها: $(du -h "$FILES_FILE" | cut -f1)"
  else
    rm -f "$FILES_FILE.tmp"; bad "فایل‌ها: آرشیو معیوب یا خیلی کوچک"
  fi
else
  rm -f "$FILES_FILE.tmp"; bad "فایل‌ها: $(head -2 /tmp/bk-f.err | tr '\n' ' ')"
fi

# ── ۳) چرخش — با کف. آخرین نسخه‌های سالم هرگز حذف نمی‌شوند، هرچقدر هم کهنه.
for pat in 'melkjet-db-*.sql.gz' 'melkjet-files-*.tar.gz'; do
  n=$(find "$BACKUP_DIR" -maxdepth 1 -name "$pat" -type f | wc -l)
  [ "$n" -le "$KEEP_MIN" ] && continue
  find "$BACKUP_DIR" -maxdepth 1 -name "$pat" -type f -mtime +"$KEEP_DAYS" -printf '%T@ %p\n' \
    | sort -n | head -n "$((n - KEEP_MIN))" | cut -d' ' -f2- | xargs -r rm -f
done

say "پایان. دیتابیس: $(find "$BACKUP_DIR" -name 'melkjet-db-*.sql.gz' | wc -l) | فایل: $(find "$BACKUP_DIR" -name 'melkjet-files-*.tar.gz' | wc -l)"
[ "$FAIL" -ne 0 ] && say "⚠ پشتیبان ناقص بود — به syslog هم ثبت شد" 
exit "$FAIL"
