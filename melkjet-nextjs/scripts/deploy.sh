#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# دیپلوی امنِ ملک‌جت — بعد از reload سلامتِ هر اینستنس را چک می‌کند تا اگر دیپلوی
# چیزی را خراب کرد، همان لحظه بفهمی (نه از روی مرورگرِ کاربر).
#
# اجرا:  sudo /var/www/melkjet/melkjet-nextjs/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
APP_DIR="${MELKJET_APP_DIR:-/var/www/melkjet/melkjet-nextjs}"
cd "$APP_DIR"

# نکته: git pull اینجا انجام نمی‌شود. زیرِ sudo متغیرهای proxy پاک می‌شوند و git به
# GitHub نمی‌رسد (hang). قبل از این اسکریپت، خودت با proxy-on دستی pull کن:
#   proxy-on && git pull origin main
echo "→ build"
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo "→ reload (rolling، بدونِ داون‌تایم)"
pm2 reload ecosystem.config.js --update-env

# چند ثانیه فرصت تا اینستنس‌ها بالا بیایند، بعد سلامتِ پورت‌های کاربر (nginx به 3001-3003 می‌فرستد).
sleep 3
echo "→ چکِ سلامت"
ok=1
for port in 3001 3002 3003; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$port/" || echo "000")
  if [ "$code" = "200" ]; then echo "   ✓ localhost:$port = $code"; else echo "   ✗ localhost:$port = $code"; ok=0; fi
done

if [ "$ok" = "1" ]; then
  echo "✓ همهٔ اینستنس‌ها سالم‌اند."
  echo "یادآوری: اگر HTML را در Arvan کش می‌کنی، cache را Purge کن — یا بهتر، در CDN فقط /_next/static را کش کن و HTML را هرگز (راهنما در CLAUDE.md → «هرگز خراب نشدنِ دیپلوی»)."
else
  echo "✗ یک اینستنس ۲۰۰ نداد. لاگ:  pm2 logs --err --lines 40 --nostream"
  exit 1
fi
