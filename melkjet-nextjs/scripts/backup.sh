#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# بکاپِ کاملِ ملک‌جت: هم دیتابیسِ PostgreSQL و هم فایل‌های دادهٔ JSON روی دیسک.
#
# چرا هر دو؟  استورهای داغ (پیام/لید/CRM/آگهی‌ها) روی PostgreSQL‌اند، ولی تنظیمات
# (account, role, admin, geo, plan, payment …) و کش‌ها هنوز روی فایل‌های
# .*-data.json در ریشهٔ پروژه می‌مانند. بکاپِ کامل باید هر دو را داشته باشد،
# وگرنه با از دست رفتنِ سرور یا دیتابیس، بخشی از داده برمی‌گردد و بخشی نه.
#
# نصبِ کرونِ روزانه (به‌عنوانِ root):
#   sudo crontab -e
#   # هر شب ساعت ۳:۳۰ بامداد
#   30 3 * * * /var/www/melkjet/melkjet-nextjs/scripts/backup.sh >> /var/log/melkjet-backup.log 2>&1
#
# اجرای دستی (تست):
#   sudo /var/www/melkjet/melkjet-nextjs/scripts/backup.sh
#
# بازگردانی (restore) — راهنما در پایین همین فایل.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── تنظیمات (قابلِ override با متغیرِ محیطی) ──
DB="${MELKJET_DB:-melkjet}"
APP_DIR="${MELKJET_APP_DIR:-/var/www/melkjet/melkjet-nextjs}"
BACKUP_DIR="${MELKJET_BACKUP_DIR:-/var/backups/melkjet}"
KEEP_DAYS="${MELKJET_BACKUP_KEEP_DAYS:-14}"   # چند روز بکاپ نگه داشته شود

# pg_dump را با کاربرِ سیستمیِ postgres اجرا می‌کنیم (احرازِ peer) تا رمز در اسکریپت نباشد.
if [ "$(id -un)" = "postgres" ]; then
  PGDUMP=(pg_dump)
else
  PGDUMP=(sudo -u postgres pg_dump)
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/melkjet-db-$STAMP.sql.gz"
FILES_FILE="$BACKUP_DIR/melkjet-files-$STAMP.tar.gz"

echo "[$(date -Is)] شروعِ بکاپ → $BACKUP_DIR"

# ── ۱) دیتابیسِ PostgreSQL ──
# --no-owner/--no-privileges: بازگردانی روی هر کاربری بدونِ خطای مالکیت کار کند.
"${PGDUMP[@]}" --no-owner --no-privileges "$DB" | gzip -9 > "$DB_FILE.tmp"
mv "$DB_FILE.tmp" "$DB_FILE"
echo "[$(date -Is)]   ✓ دیتابیس: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# ── ۲) فایل‌های دادهٔ روی دیسک (تنظیمات + کش‌هایی که هنوز روی PostgreSQL نرفته‌اند) ──
# فایل‌های مخفیِ .*-data.json در ریشهٔ پروژه. -print0/--null برای نام‌های امن.
if compgen -G "$APP_DIR/.*-data.json" > /dev/null; then
  # الگوی .*-data.json به‌خاطرِ پسوندِ -data.json هیچ‌وقت با «.» یا «..» مطابقت نمی‌کند.
  ( cd "$APP_DIR" && tar -czf "$FILES_FILE.tmp" .*-data.json )
  mv "$FILES_FILE.tmp" "$FILES_FILE"
  echo "[$(date -Is)]   ✓ فایل‌های JSON: $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1))"
else
  echo "[$(date -Is)]   ⚠ هیچ فایلِ .*-data.json پیدا نشد (شاید همه روی PostgreSQL‌اند)."
fi

# ── ۳) چرخش: پاک‌کردنِ بکاپ‌های قدیمی‌تر از KEEP_DAYS روز ──
find "$BACKUP_DIR" -maxdepth 1 -name 'melkjet-db-*.sql.gz'   -type f -mtime +"$KEEP_DAYS" -print -delete || true
find "$BACKUP_DIR" -maxdepth 1 -name 'melkjet-files-*.tar.gz' -type f -mtime +"$KEEP_DAYS" -print -delete || true

echo "[$(date -Is)] بکاپ تمام شد. تعدادِ فعلی: $(find "$BACKUP_DIR" -name 'melkjet-db-*.sql.gz' | wc -l) دیتابیس، $(find "$BACKUP_DIR" -name 'melkjet-files-*.tar.gz' | wc -l) فایل."

# ─────────────────────────────────────────────────────────────────────────────
# بازگردانی (RESTORE) — دستی، با احتیاط:
#
#   # دیتابیس (روی یک دیتابیسِ خالی؛ اول در صورتِ نیاز دراپ/کریت):
#   gunzip -c /var/backups/melkjet/melkjet-db-YYYYMMDD-HHMMSS.sql.gz \
#     | sudo -u postgres psql melkjet
#
#   # فایل‌های JSON (در ریشهٔ پروژه؛ سرویس را اول متوقف کنید تا هم‌زمان ننویسد):
#   pm2 stop all
#   tar -xzf /var/backups/melkjet/melkjet-files-YYYYMMDD-HHMMSS.tar.gz -C /var/www/melkjet/melkjet-nextjs
#   pm2 start all
# ─────────────────────────────────────────────────────────────────────────────
