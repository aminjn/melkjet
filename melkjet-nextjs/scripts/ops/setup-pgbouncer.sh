#!/usr/bin/env bash
# ── نصب و پیکربندیِ pgbouncer (استخرِ اتصالِ transaction-mode) برای ملک‌جت ──────────────
# چرا: خطای تکراریِ «timeout exceeded when trying to connect» یعنی استخرِ اتصالِ اپ زیرِ بار
# پر می‌شد. pgbouncer صدها اتصالِ اپ را روی چند اتصالِ واقعیِ PG مالتی‌پلکس می‌کند، پس دیگر
# «اتصال گرفتن» شکست نمی‌خورد. ریپو برای transaction-pooling امن است (نه LISTEN/NOTIFY،
# نه prepared statement، نه advisory lockِ نشستی، فقط SET LOCAL).
#
# ⚠️ ایمنی: این اسکریپت DATABASE_URLِ سایت را «عوض نمی‌کند». فقط pgbouncer را روی پورتِ 6432
# بالا می‌آورد و با اسموک‌تستِ واقعی (مثلِ خودِ اپ) می‌سنجد. سایت تا وقتی خودت آگاهانه URL را
# سوییچ نکنی، مستقیم روی PG (5432) می‌ماند. برگشت هم یک خط است.
#
# اجرا (روی سرور، کاربرِ root):
#   sudo bash scripts/ops/setup-pgbouncer.sh
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "باید با sudo/root اجرا شود."; exit 1; }
cd "$(dirname "$0")/../.." || exit 1
APP_DIR="$(pwd)"

# ۱) DATABASE_URLِ فعلی را از env بخوان (مستقیمِ 5432)
ENVF=".env.production.local"
[[ -f "$ENVF" ]] || { echo "فایلِ $ENVF پیدا نشد (در $APP_DIR)."; exit 1; }
# shellcheck disable=SC1090
DB_URL="$(grep -E '^DATABASE_URL=' "$ENVF" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e "s/^'//" -e 's/"$//' -e "s/'$//")"
[[ -n "${DB_URL:-}" ]] || { echo "DATABASE_URL در $ENVF نیست."; exit 1; }

# ۲) پارسِ مطمئن با python3 (پسوردِ URL-encoded مثلِ %40 را هم دیکد می‌کند)
read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME < <(python3 - "$DB_URL" <<'PY'
import sys, urllib.parse as u
p = u.urlsplit(sys.argv[1])
print(u.unquote(p.username or ''), u.unquote(p.password or ''), p.hostname or '127.0.0.1', p.port or 5432, (p.path or '/').lstrip('/'))
PY
)
echo "دیتابیس: user=$DB_USER db=$DB_NAME host=$DB_HOST port=$DB_PORT"
if [[ "$DB_PORT" == "6432" ]]; then
  echo "⚠️ DATABASE_URL از قبل روی 6432 (pgbouncer) است. اگر می‌خواهی دوباره تنظیم کنی، اول به 5432 برگردان."
fi
case "$DB_HOST" in
  127.0.0.1|localhost|::1) : ;;
  *) echo "⚠️ هاستِ دیتابیس محلی نیست ($DB_HOST). این اسکریپت pgbouncer را «جلوی PGِ محلی» می‌گذارد؛ برای PGِ ریموت دستی تنظیم کن."; exit 1 ;;
esac
# اگر URL روی 6432 بود، مقصدِ واقعیِ PG را 5432 فرض کن
REAL_PORT="$DB_PORT"; [[ "$REAL_PORT" == "6432" ]] && REAL_PORT=5432

# ۳) نصبِ pgbouncer
if ! command -v pgbouncer >/dev/null 2>&1; then
  echo "نصبِ pgbouncer…"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq pgbouncer
else
  echo "pgbouncer از قبل نصب است ($(pgbouncer --version 2>/dev/null | head -1))."
fi

# ۴) userlist.txt — پسوردِ خام (scram-sha-256؛ pgbouncer از همین برای auth کلاینت و سرور استفاده می‌کند)
BQ_DIR="/etc/pgbouncer"
mkdir -p "$BQ_DIR"
# بکاپِ تنظیماتِ قبلی (اگر بود)
ts="$(date +%Y%m%d-%H%M%S)"
[[ -f "$BQ_DIR/pgbouncer.ini" ]] && cp -a "$BQ_DIR/pgbouncer.ini" "$BQ_DIR/pgbouncer.ini.bak-$ts"
[[ -f "$BQ_DIR/userlist.txt" ]] && cp -a "$BQ_DIR/userlist.txt" "$BQ_DIR/userlist.txt.bak-$ts"

# گریزِ دابل‌کوتِ داخلِ پسورد
esc_pass="${DB_PASS//\"/\"\"}"
printf '"%s" "%s"\n' "$DB_USER" "$esc_pass" > "$BQ_DIR/userlist.txt"
chown postgres:postgres "$BQ_DIR/userlist.txt" 2>/dev/null || true
chmod 600 "$BQ_DIR/userlist.txt"

# ۵) pgbouncer.ini — transaction-pooling، هم‌خوان با app/lib/db.ts
cat > "$BQ_DIR/pgbouncer.ini" <<INI
[databases]
* = host=127.0.0.1 port=$REAL_PORT

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = $BQ_DIR/userlist.txt
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 30
min_pool_size = 5
reserve_pool_size = 10
reserve_pool_timeout = 3
server_idle_timeout = 120
server_lifetime = 1800
query_wait_timeout = 30
# node-pg پارامترِ statement_timeout را روی startup می‌فرستد → باید نادیده/عبوردادنی باشد
ignore_startup_parameters = extra_float_digits,statement_timeout,options,application_name
tcp_keepalive = 1
INI
chown postgres:postgres "$BQ_DIR/pgbouncer.ini" 2>/dev/null || true

# ۶) راه‌اندازی
systemctl enable pgbouncer >/dev/null 2>&1 || true
systemctl restart pgbouncer
sleep 1
systemctl is-active --quiet pgbouncer || { echo "❌ pgbouncer بالا نیامد. لاگ: journalctl -u pgbouncer -n 40"; exit 1; }
echo "pgbouncer روی 127.0.0.1:6432 فعال شد."

# ۷) اسموک‌تستِ واقعی (مثلِ خودِ اپ) روی 6432
BQ_URL="postgres://${DB_USER}:$(python3 -c 'import sys,urllib.parse as u;print(u.quote(sys.argv[1],safe=""))' "$DB_PASS")@127.0.0.1:6432/${DB_NAME}"
echo "اسموک‌تست روی pgbouncer…"
if node "$APP_DIR/scripts/ops/pgbouncer-smoketest.mjs" "$BQ_URL"; then
  echo
  echo "════════════════════════════════════════════════════════════════════"
  echo "✅ آماده است. برای سوییچِ سایت به pgbouncer (پورت 6432):"
  echo
  echo "  ۱) پشتیبان:   cp $ENVF $ENVF.bak-$ts"
  echo "  ۲) سوییچ:     sed -i -E 's#(DATABASE_URL=.*@127.0.0.1:)5432(/)#\\16432\\2#' $ENVF"
  echo "                (اگر هاست localhost است نه 127.0.0.1، در الگو عوضش کن)"
  echo "  ۳) اعمال:     sudo pm2 reload ecosystem.config.js --update-env"
  echo
  echo "  🔙 برگشتِ فوری (اگر هر مشکلی دیدی):"
  echo "     sed -i -E 's#(DATABASE_URL=.*@127.0.0.1:)6432(/)#\\15432\\2#' $ENVF && sudo pm2 reload ecosystem.config.js --update-env"
  echo "════════════════════════════════════════════════════════════════════"
else
  echo "❌ اسموک‌تست قرمز — DATABASE_URL را سوییچ نکن. pgbouncer بالا هست ولی اپ از آن رد نشد؛ خطا را بالا ببین."
  exit 1
fi
