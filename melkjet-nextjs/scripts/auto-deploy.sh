#!/usr/bin/env bash
# دیپلوی خودکار: اگر روی origin/main پوش جدیدی باشد، pull + build + reload می‌کند.
# با cron هر ۲ دقیقه اجرا شود. قفل دارد تا دو build هم‌زمان نشود.
#
# ⚠️ نکتهٔ مهم: reload باید با نامِ درست باشد. پراسس‌ها «melkjet-3000..3003»‌اند (نه
#    «melkjet»). قبلاً اینجا `pm2 restart melkjet` بود که چون آن نام وجود ندارد
#    شکست می‌خورد و با `set -e` اسکریپت بعد از build می‌مُرد → build جدید روی .next
#    نشسته ولی اینستنس‌های قدیمی reload نشده و به چانک‌های حذف‌شده اشاره می‌کنند →
#    سایت «couldn't load» می‌شد. حالا reload با ecosystem و چکِ سلامت انجام می‌شود.
set -e
APP_DIR="/var/www/melkjet/melkjet-nextjs"
LOCK="/tmp/melkjet-deploy.lock"
exec 9>"$LOCK"
flock -n 9 || { echo "$(date) قفل گرفته‌شده، رد شد"; exit 0; }

cd "$APP_DIR"

# fetch ممکن است شکست بخورد (پروکسیِ گیت‌هاب در محیطِ کرون نیست/قطع است). با `set -e` این یعنی
# مرگِ بی‌صدا هر ۲ دقیقه — دقیقاً همان «کارِ بی‌صدا مرده»ی قانونِ شمارهٔ یک. پس بلند گزارش می‌کنیم.
if ! timeout 60 git fetch origin main --quiet; then
  echo "$(date) ✗ fetch نشد (پروکسی/شبکه؟) — دیپلوی این دور رد شد. چک: cd $APP_DIR && proxy-on && git fetch origin main"
  exit 0
fi
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
# «دیپلویِ ناتمام» = pull انجام شده ولی build شکسته. چون از آن به بعد HEAD با origin/main یکی است،
# دورهای بعدیِ کرون بی‌صدا رد می‌شدند و سرور برای همیشه روی buildِ خرابِ نیمه‌کاره می‌ماند
# (قانونِ شمارهٔ یک). مارکر این حالت را زنده نگه می‌دارد تا خودکار دوباره تلاش شود.
FAILED_MARK="$APP_DIR/.deploy-failed"
# فقط وقتی ریموت جلوتر است دیپلوی کن. شرطِ قبلی «نابرابری» بود، و کامیتِ محلیِ
# پوش‌نشده هر ۲ دقیقه یک بیلدِ کامل راه می‌انداخت — حلقهٔ خودتخریبی که سایت را دو بار پایین آورد.
if git merge-base --is-ancestor "$REMOTE" "$LOCAL" 2>/dev/null; then
  [ -f "$FAILED_MARK" ] || exit 0                       # واقعاً چیزی تغییر نکرده
  echo "$(date) ↻ دیپلویِ قبلی ناتمام مانده بود — تلاشِ دوباره روی همان کامیت ($LOCAL)"
else
  echo "$(date) → پوش جدید: $REMOTE  — دیپلوی شروع شد"
  git pull origin main --quiet
fi
echo "$REMOTE" > "$FAILED_MARK"   # تا وقتی build+reload موفق نشده، «ناتمام» حساب می‌شود

# ⚠️ بیلد باید در «اسلاتِ خاموش» انجام شود، دقیقاً مثلِ deploy.sh.
# ecosystem.config.js پوشهٔ سِرو را از `.next-current` می‌خواند (.next-a/.next-b).
# نسخهٔ قبلیِ این اسکریپت در `.next` بیلد می‌کرد و به اشاره‌گر دست نمی‌زد؛ نتیجه
# (۲۸ سپتامبر ۲۰۲۶): بیلدِ سالمِ ۱۰ دقیقه‌ای در پوشه‌ای نشست که هیچ اینستنسی از آن
# سِرو نمی‌کرد، «✓ دیپلوی انجام شد» چاپ شد ولی سایت روی کدِ قدیمی ماند — دیپلویِ
# دروغین، بدترین نوعِ «کارِ بی‌صدا مرده»ی قانونِ شمارهٔ یک.
CUR=".next"
if [ -f "$APP_DIR/.next-current" ]; then CUR="$(cat "$APP_DIR/.next-current")"; fi
[ -f "$APP_DIR/$CUR/BUILD_ID" ] || CUR=".next"
case "$CUR" in .next-a) NEW=".next-b" ;; *) NEW=".next-a" ;; esac
echo "$(date) → بیلد در اسلاتِ خاموش: $NEW   (زنده: $CUR)"

# nice/ionice مثلِ deploy.sh: build تمامِ ۴ هسته را نمی‌بلعد و سایت وسطِ دیپلویِ خودکار ۵۰۴ نمی‌دهد.
# اسلاتِ خاموش هر بار از صفر ساخته می‌شود، پس ENOTEMPTY/ISRِ کهنه اصلاً پیش نمی‌آید.
build() { rm -rf "$APP_DIR/$NEW"; NEXT_DIST_DIR="$NEW" NODE_OPTIONS="--max-old-space-size=2048" nice -n 19 ionice -c3 npm run build; }
if ! build; then
  echo "$(date) ✗ build شکست خورد — یک‌بارِ دیگر تلاش می‌کنم"
  if ! build; then
    echo "$(date) ✗✗ buildِ دوم هم شکست خورد. سرور روی نسخهٔ قبلی است و کرون خودکار باز تلاش می‌کند."
    echo "$(date)    اگر تکرار شد دستی ببین:  cd $APP_DIR && sudo scripts/deploy.sh"
    rm -rf "$APP_DIR/$NEW"
    exit 1                                              # مارکر می‌ماند → دورِ بعد دوباره تلاش
  fi
  echo "$(date) ✓ تلاشِ دوم موفق شد"
fi
# اسلاتِ نیمه‌ساخته هرگز نباید زنده شود.
if [ ! -f "$APP_DIR/$NEW/BUILD_ID" ]; then
  echo "$(date) ✗ بیلد ناقص ماند (BUILD_ID نیست) — اشاره‌گر عوض نشد و سایت روی نسخهٔ قبلی ماند."
  rm -rf "$APP_DIR/$NEW"
  exit 1
fi
echo "$NEW" > "$APP_DIR/.next-current"
# reload (نه restart): با اسلات‌ها پوشهٔ در حالِ سِرو هیچ‌وقت دست نمی‌خورد، پس
# reloadِ نوبتی امن است و داون‌تایم صفر — همان کاری که deploy.sh می‌کند.
pm2 reload ecosystem.config.js --update-env
rm -f "$FAILED_MARK"                                     # از این‌جا به بعد دیپلوی تمام‌شده است

# چکِ سلامت: اگر اینستنسی ۲۰۰ نداد، در لاگ فریاد بزن (ولی خروجی را غیرصفر نکن تا کرون هی هشدار نفرستد).
sleep 3
ok=1
for port in 3001 3002 3003; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$port/" || echo "000")
  [ "$code" = "200" ] && echo "$(date)   ✓ $port=$code" || { echo "$(date)   ✗ $port=$code — بررسی کن: pm2 logs --err"; ok=0; }
done
# فقط وقتی همه سالم‌اند اسلاتِ قدیمی پاک می‌شود (دیسک محدود است؛ دو اسلات نباید بمانند).
if [ "$ok" = "1" ] && [ "$CUR" != "$NEW" ] && [ -d "$APP_DIR/$CUR" ]; then
  rm -rf "$APP_DIR/$CUR"
  echo "$(date)   ✓ اسلاتِ قدیمی پاک شد: $CUR"
fi
echo "$(date) ✓ دیپلوی انجام شد — سِرو از $NEW"
