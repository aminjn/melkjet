#!/usr/bin/env bash
# فاز ۱۰۴/۱۱۲ — ارتقای Node 20 → 22 روی سرور (تا Economy QA خودکار هم روی سرور اجرا شود).
# اجرای دستی روی VPS با root:  sudo bash scripts/upgrade-node22.sh
# نکتهٔ شبکه: deb.nodesource.com و registry.npmjs.org «خارجی»اند — egress سرور مستقیم به آن‌ها
# نمی‌رسد (curl 56). این اسکریپت اول مستقیم امتحان می‌کند؛ نشد، خودکار از پروکسیِ محلی
# (همان پروکسیِ دیوار — پیش‌فرض 127.0.0.1:1080؛ با PROXY=... قابلِ‌تغییر) عبور می‌کند.
set -euo pipefail

echo "== Node فعلی: $(node -v)"
if node -v | grep -q '^v22'; then echo "همین حالا Node 22 است — کاری لازم نیست."; exit 0; fi

PROXY="${PROXY:-http://127.0.0.1:1080}"
NS=/tmp/nodesource-setup-22.sh
APT_PROXY_CONF=/etc/apt/apt.conf.d/99melkjet-node22-proxy
cleanup() { rm -f "$APT_PROXY_CONF" "$NS"; }
trap cleanup EXIT

if curl -fsSL --max-time 25 https://deb.nodesource.com/setup_22.x -o "$NS"; then
  echo "== دانلودِ مستقیم OK"
else
  echo "== مستقیم نشد — عبور از پروکسیِ محلی ($PROXY)"
  curl -fsSL --max-time 90 -x "$PROXY" https://deb.nodesource.com/setup_22.x -o "$NS"
  # همهٔ ابزارهای پایین‌دست (curl/gpg داخلِ اسکریپتِ NodeSource، npm) از همین env می‌خوانند
  export http_proxy="$PROXY" https_proxy="$PROXY" HTTP_PROXY="$PROXY" HTTPS_PROXY="$PROXY"
  export npm_config_proxy="$PROXY" npm_config_https_proxy="$PROXY"
  # apt به env اعتماد نمی‌کند — کانفیگِ موقت (در پایان پاک می‌شود)
  printf 'Acquire::http::Proxy "%s";\nAcquire::https::Proxy "%s";\n' "$PROXY" "$PROXY" > "$APT_PROXY_CONF"
fi

bash "$NS"
apt-get install -y nodejs
echo "== Node جدید: $(node -v)"

# pm2 باید با Node جدید از نو ثبت شود
npm i -g pm2
cd /var/www/melkjet/melkjet-nextjs
npm ci
npm run build
pm2 kill
pm2 start ecosystem.config.js
pm2 save
echo "== سلامت:"; for p in 3001 3002 3003; do curl -s --noproxy '*' -o /dev/null -w "port $p: %{http_code}\n" "http://127.0.0.1:$p/"; done
echo "تمام — حالا Economy QA روی کرانِ سرور هم اجرا می‌شود."
