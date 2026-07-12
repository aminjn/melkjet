#!/usr/bin/env bash
# فاز ۱۰۴ — ارتقای Node 20 → 22 روی سرور (تا Economy QA خودکار هم روی سرور اجرا شود).
# اجرای دستی روی VPS با root:  sudo bash scripts/upgrade-node22.sh
set -euo pipefail

echo "== Node فعلی: $(node -v)"
if node -v | grep -q '^v22'; then echo "همین حالا Node 22 است — کاری لازم نیست."; exit 0; fi

# NodeSource برای Node 22 (دبیان/اوبونتو) — از پشتِ proxy-on اگر دسترسی خارجی لازم شد
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
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
echo "== سلامت:"; for p in 3001 3002 3003; do curl -s -o /dev/null -w "port $p: %{http_code}\n" "http://127.0.0.1:$p/"; done
echo "تمام — حالا Economy QA روی کرانِ سرور هم اجرا می‌شود."
