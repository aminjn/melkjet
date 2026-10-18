#!/usr/bin/env bash
# ── تیونِ PostgreSQL برای ملک‌جت (باکسِ ۴ vCPU / ۸ GB، مشترک با اپ) ────────────────────
# هدف: کم‌کردنِ طوفان‌های نوشتن که باعثِ checkpoint PANIC و «statement/connect timeout» می‌شدند.
# محافظه‌کارانه: چون اپ ~۶ گیگ رم می‌خورد، به PG رمِ کم ولی چک‌پوینتِ هموار و WALِ بزرگ‌تر می‌دهیم.
# همهٔ تنظیم‌ها «reload»ی‌اند جز shared_buffers که با «restart»ِ بعدیِ PG اعمال می‌شود.
#
# اجرا:  sudo bash scripts/ops/pg-tune.sh          (می‌نویسد + reload)
#        sudo bash scripts/ops/pg-tune.sh --restart (همان + restartِ PG برای اعمالِ shared_buffers)
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "باید با sudo/root اجرا شود."; exit 1; }

DO_RESTART=0; [[ "${1:-}" == "--restart" ]] && DO_RESTART=1

# محلِ conf.d را از خودِ PG بپرس (مطمئن‌تر از حدسِ نسخه)
CONF_FILE="$(sudo -u postgres psql -tAc 'SHOW config_file' 2>/dev/null || true)"
[[ -n "$CONF_FILE" ]] || { echo "نتوانستم config_file را از PG بخوانم. آیا PostgreSQL بالا است؟"; exit 1; }
CONF_DIR="$(dirname "$CONF_FILE")/conf.d"
mkdir -p "$CONF_DIR"
DROPIN="$CONF_DIR/melkjet-tuning.conf"
[[ -f "$DROPIN" ]] && cp -a "$DROPIN" "$DROPIN.bak-$(date +%Y%m%d-%H%M%S)"

# مطمئن شو conf.d include می‌شود (در دبیان/اوبونتو پیش‌فرض هست؛ محضِ احتیاط)
grep -qE "^\s*include_dir\s*=\s*'conf.d'" "$CONF_FILE" || echo "include_dir = 'conf.d'" >> "$CONF_FILE"

cat > "$DROPIN" <<'CONF'
# ملک‌جت — تیونِ پایدار (scripts/ops/pg-tune.sh). این فایل را دستی ویرایش نکن؛ اسکریپت بازنویسی می‌کند.

# ── چک‌پوینتِ هموار: ریشهٔ PANIC و اسپایک‌های IO زیرِ بارِ نوشتنِ روستر/ممیزی ──
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min
max_wal_size = 3GB
min_wal_size = 512MB
wal_compression = on

# ── حافظه (محافظه‌کارانه چون اپ ~۶گیگ می‌خورد) ──
shared_buffers = 512MB            # نیازمندِ restart
effective_cache_size = 1536MB
work_mem = 16MB
maintenance_work_mem = 256MB

# ── دیسکِ SSD ──
random_page_cost = 1.1
effective_io_concurrency = 200

# ── autovacuum تهاجمی‌تر: جدولِ listings پرگردش است؛ bloat = کوئریِ کند ──
autovacuum_naptime = 20s
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.02
autovacuum_vacuum_cost_limit = 2000

# ── پایداری: synchronous_commit روشن می‌ماند (ضدِ از‌دست‌رفتنِ داده — درسِ ۲۹ اوت) ──
synchronous_commit = on
CONF
chown postgres:postgres "$DROPIN" 2>/dev/null || true
echo "نوشته شد: $DROPIN"

echo "reload…"
systemctl reload postgresql
echo "✓ تنظیم‌های reloadی اعمال شدند (چک‌پوینت/WAL/work_mem/autovacuum/…)."

if [[ $DO_RESTART -eq 1 ]]; then
  echo "restartِ PostgreSQL برای اعمالِ shared_buffers… (چند ثانیه قطعیِ دیتابیس)"
  systemctl restart postgresql
  echo "✓ restart شد — shared_buffers=512MB فعال."
else
  echo "ℹ shared_buffers=512MB فقط با restart اعمال می‌شود. وقتِ خلوت: sudo systemctl restart postgresql"
  echo "  (یا همین اسکریپت را با --restart اجرا کن.)"
fi

echo
echo "تأیید:"
sudo -u postgres psql -c "SELECT name, setting, unit FROM pg_settings WHERE name IN ('checkpoint_completion_target','max_wal_size','shared_buffers','work_mem','effective_cache_size','autovacuum_vacuum_scale_factor','synchronous_commit') ORDER BY name;"
