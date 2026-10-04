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

# قفلِ مشترک با auto-deploy.sh (کرون): دو build هم‌زمان `.next` را خراب می‌کند و اینستنس‌ها را
# به چانک‌های حذف‌شده وصل می‌کند — همان کرش‌لوپی که در CLAUDE.md مستند است. این‌جا (برخلافِ کرون)
# منتظر می‌مانیم تا نوبت برسد، چون این اجرا عمدیِ آدم است و نباید بی‌صدا رد شود.
LOCK="/tmp/melkjet-deploy.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "→ یک دیپلویِ دیگر (کرون) در حالِ اجراست — منتظر می‌مانم تا تمام شود…"
  flock 9
fi

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
# Build into the idle slot, never into the directory these processes serve from.
CUR=".next"
if [ -f .next-current ]; then CUR="$(cat .next-current)"; fi
[ -f "$CUR/BUILD_ID" ] || CUR=".next"
case "$CUR" in .next-a) NEW=".next-b" ;; *) NEW=".next-a" ;; esac
echo "→ بیلد در اسلاتِ خاموش: $NEW   (زنده: $CUR)"

# Two build directories exist at once, so stop loudly instead of filling the disk.
FREE_KB=$(df -Pk . | awk 'NR==2{print $4}')
NEED_KB=$(du -sk "$CUR" 2>/dev/null | awk '{print $1}'); NEED_KB=${NEED_KB:-1500000}
if [ "$FREE_KB" -lt $((NEED_KB + 500000)) ]; then
  echo "✗ فضای دیسک برای بیلدِ تازه کافی نیست — اول scripts/media-prune.sh را بزن."
  echo "   free=${FREE_KB}KB  need=$((NEED_KB + 500000))KB"
  exit 1
fi

# ── فاز ۲۹۷ر — همان حصارهای auto-deploy: رمِ ماشین برای build جا ندارد (اینستنس‌ها + پستگرس
# ≈ کلِ رم)، پس ۳۰۰۳ در پنجرهٔ بیلد خاموش می‌شود (برگشتِ تضمینی با trap) و build داخلِ cgroup
# با سقفِ CPU/RAM اجرا می‌شود تا در بدترین حالت فقط «بیلد» بمیرد، نه سرور/SSH.
avail_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
[ "${avail_mb:-0}" -lt 1100 ] && echo "⚠ رمِ آزاد فقط ${avail_mb}MB است — بیلد کند و سنگین خواهد بود."
pm2 stop melkjet-3003 >/dev/null 2>&1 || true
trap 'pm2 start melkjet-3003 >/dev/null 2>&1 || true' EXIT
# فاز ۲۹۷غ — Nice=19 propertyِ نامعتبرِ systemd-run بود و با set -e کلِ دیپلوی را می‌کُشت
# (بیلد هرگز اجرا نمی‌شد). nice به دستور منتقل شد؛ probe حالا دقیقاً همان propertyها را می‌سنجد.
FENCE_PROPS="-p CPUQuota=70% -p MemoryMax=2600M -p MemorySwapMax=512M -p IOWeight=20"
fence() {
  if systemd-run --scope --quiet $FENCE_PROPS /bin/true 2>/dev/null; then
    systemd-run --scope --quiet $FENCE_PROPS -- nice -n 19 ionice -c3 "$@"
  else
    nice -n 19 ionice -c3 "$@"
  fi
}
rm -rf "$NEW"
fence env NEXT_DIST_DIR="$NEW" NODE_OPTIONS="--max-old-space-size=2048" npm run build

# A half-written slot must never go live.
if [ ! -f "$NEW/BUILD_ID" ]; then
  echo "✗ بیلد ناقص ماند — اشاره‌گر عوض نشد و سایت روی نسخهٔ قبلی ماند."
  rm -rf "$NEW"
  exit 1
fi

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
echo "$NEW" > .next-current
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
  # Only now is the old slot certainly unused.
  if [ "$CUR" != "$NEW" ]; then rm -rf "$CUR"; echo "✓ اسلاتِ قدیمی پاک شد: $CUR"; fi
  echo "یادآوری: اگر HTML را در Arvan کش می‌کنی، cache را Purge کن (یا در CDN فقط /_next/static را کش کن، HTML را هرگز)."
else
  echo "✗ چکِ سلامت رد شد — برگشت به نسخهٔ قبلی…"
  echo "$CUR" > .next-current
  pm2 reload ecosystem.config.js --update-env
  sleep 4
  rm -rf "$NEW"
  echo "✓ برگشت انجام شد. سایت روی نسخهٔ قبلی است. لاگ: pm2 logs --err --lines 40 --nostream"
  exit 1
fi
