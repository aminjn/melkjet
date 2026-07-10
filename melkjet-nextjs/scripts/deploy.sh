#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# دیپلوی امنِ ملک‌جت — کدِ روی سرور را با origin/main هم‌گام می‌کند، build می‌کند،
# reload می‌کند و سلامتِ هر اینستنس را چک می‌کند. اگر سرور از گیت‌هاب عقب باشد و
# نتواند pull کند، «با صدای بلند» متوقف می‌شود (نه اینکه بی‌صدا کدِ قدیمی را build کند).
#
# اجرا:  sudo /var/www/melkjet/melkjet-nextjs/scripts/deploy.sh
#   یا با pullِ دستیِ قبلی:  proxy-on && git pull origin main && sudo scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
APP_DIR="${MELKJET_APP_DIR:-/var/www/melkjet/melkjet-nextjs}"
cd "$APP_DIR"

echo "→ کدِ فعلیِ روی سرور:"
git log -1 --oneline 2>/dev/null || true

# ── هم‌گام‌سازی با origin/main ────────────────────────────────────────────────
# fetch/pull ممکن است زیرِ sudo (پروکسیِ پاک‌شده) hang کند؛ پس با timeout و best-effort.
# اگر fetch موفق شد و سرور عقب بود، اول ff-only pull؛ اگر نشد، «با صدای بلند» توقف.
echo "→ بررسیِ هم‌گامی با گیت‌هاب…"
FETCH_OK=0
if timeout 30 git fetch origin main 2>/dev/null; then FETCH_OK=1; fi

if [ "$FETCH_OK" = "1" ]; then
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "   سرور عقب است — در حالِ pull (ff-only)…"
    if timeout 30 git pull --ff-only origin main; then
      echo "   ✓ هم‌گام شد:"; git log -1 --oneline
    else
      echo "   ✗ pull نشد (احتمالاً تعارضِ محلی). دستی حل کن:"
      echo "     proxy-on && git status && git pull origin main"
      exit 1
    fi
  else
    echo "   ✓ سرور به‌روز است."
  fi
else
  # نتوانستیم fetch کنیم (پروکسی زیرِ sudo). به کاربر بگو حتماً قبلش دستی pull کرده باشد.
  echo "   ⚠ نتوانستم با گیت‌هاب چک کنم (پروکسی زیرِ sudo پاک می‌شود)."
  echo "   ⚠ اگر مطمئن نیستی جدیدترین کد را pull کرده‌ای، همین حالا Ctrl+C بزن و اجرا کن:"
  echo "        proxy-on && git pull origin main   ← بعد دوباره این اسکریپت"
  echo "   ۵ ثانیه تا ادامه…"
  sleep 5
fi

echo "→ build (با اولویتِ پایین — سایت در طولِ build زنده می‌ماند)"
# nice/ionice: کامپایل تمامِ ۴ هسته را نمی‌بلعد؛ اینستنس‌های سرویس‌دهنده (۳۰۰۱-۳۰۰۳) گرسنه نمی‌مانند
# و دیگر وسطِ دیپلوی ۵۰۴/Timeout نمی‌خوریم (نمودارِ CPU آروان سرِ دیپلوی ۷۰۰٪ می‌زد). build کمی کندتر
# تمام می‌شود ولی ترافیکِ کاربر همیشه مقدم است.
NODE_OPTIONS="--max-old-space-size=2048" nice -n 19 ionice -c3 npm run build

# Economy QA (سند ۲۳ فصل ۱۳ Part 09): ممیزیِ knobهای زندهٔ اقتصادِ «امپراتوری» قبل از انتشار —
# پولِ مجانی/سودِ غیرمنطقی/پاداشِ خارج از تعادل. هشدار می‌دهد ولی دیپلوی را متوقف نمی‌کند.
# لودرِ TS به type-strippingِ Node 22+ نیاز دارد — روی Nodeِ قدیمی‌تر صادقانه رد می‌شویم (نه هشدارِ دروغِ «نقضِ تعادل»).
echo "→ Economy QA (ممیزیِ تعادلِ اقتصاد)"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -ge 22 ]; then
  node --import ./scripts/reos-loader.mjs scripts/economy-qa.mjs || echo "   ⚠⚠ تعادلِ اقتصاد نقض شده — بعد از دیپلوی حتماً در ادمین → امپراتوری اصلاح کن!"
else
  echo "   ⚠ Nodeِ سرور v$NODE_MAJOR است (نیاز: ۲۲+) — Economy QA این بار رد شد؛ برای اجرای خودکارش Node را ارتقا بده."
fi

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
  echo "✓ همهٔ اینستنس‌ها سالم‌اند. دیپلوی‌شده:"
  git log -1 --oneline
  echo "یادآوری: اگر HTML را در Arvan کش می‌کنی، cache را Purge کن (یا در CDN فقط /_next/static را کش کن، HTML را هرگز)."
else
  echo "✗ یک اینستنس ۲۰۰ نداد. لاگ:  pm2 logs --err --lines 40 --nostream"
  exit 1
fi
