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

# nice/ionice مثلِ deploy.sh: build تمامِ ۴ هسته را نمی‌بلعد و سایت وسطِ دیپلویِ خودکار ۵۰۴ نمی‌دهد.
# هرسِ کشِ اجراییِ ISR پیش از بیلد. سایت زنده است و خزنده‌ها مدام زیرِ
# .next/server/app فایل می‌سازند؛ اگر فقط فایل‌ها پاک شوند پوشه‌های خالی
# می‌مانند و next build با ENOTEMPTY روی rmdir شکست می‌خورد.
# ۲۹ اوت ۲۰۲۶: دو بیلدِ پشتِ سرِ هم به همین دلیل شکست خوردند.
prune_isr() {
  [ -f "$APP_DIR/.next/BUILD_ID" ] || return 0
  find "$APP_DIR/.next/server/app" -type f -newer "$APP_DIR/.next/BUILD_ID" -delete 2>/dev/null || true
  find "$APP_DIR/.next/server/app" -depth -type d -empty -delete 2>/dev/null || true
}
build() { prune_isr; NODE_OPTIONS="--max-old-space-size=2048" nice -n 19 ionice -c3 npm run build; }
# ENOTEMPTY (`rmdir … not empty`) گلیچِ `.next`ِ کهنهٔ توربوپک است، نه ایرادِ کد — درمانش پاک‌کردنِ
# `.next` و buildِ دوباره است. پس خودمان یک‌بار همین کار را می‌کنیم به‌جای مردن.
if ! build; then
  echo "$(date) ✗ build شکست خورد — .next پاک می‌شود و یک‌بارِ دیگر تلاش می‌کنم (گلیچِ ENOTEMPTY)"
  rm -rf .next
  if ! build; then
    echo "$(date) ✗✗ buildِ دوم هم شکست خورد. سرور روی نسخهٔ قبلی است و کرون خودکار باز تلاش می‌کند."
    echo "$(date)    اگر تکرار شد دستی ببین:  cd $APP_DIR && rm -rf .next && npm run build"
    exit 1                                              # مارکر می‌ماند → دورِ بعد دوباره تلاش
  fi
  echo "$(date) ✓ تلاشِ دوم پس از پاک‌کردنِ .next موفق شد"
fi
# restart نه reload: سرورِ زندهٔ Next فایل‌های .next را باز نگه می‌دارد و بعد از
# جایگزینیِ بیلد، reload خطای «client reference manifest does not exist» می‌دهد.
pm2 restart ecosystem.config.js --update-env
rm -f "$FAILED_MARK"                                     # از این‌جا به بعد دیپلوی تمام‌شده است

# چکِ سلامت: اگر اینستنسی ۲۰۰ نداد، در لاگ فریاد بزن (ولی خروجی را غیرصفر نکن تا کرون هی هشدار نفرستد).
sleep 3
for port in 3001 3002 3003; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$port/" || echo "000")
  [ "$code" = "200" ] && echo "$(date)   ✓ $port=$code" || echo "$(date)   ✗ $port=$code — بررسی کن: pm2 logs --err"
done
echo "$(date) ✓ دیپلوی انجام شد"
