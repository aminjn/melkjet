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
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then exit 0; fi   # چیزی تغییر نکرده

echo "$(date) → پوش جدید: $REMOTE  — دیپلوی شروع شد"
git pull origin main --quiet
NODE_OPTIONS="--max-old-space-size=2048" npm run build
pm2 reload ecosystem.config.js --update-env

# چکِ سلامت: اگر اینستنسی ۲۰۰ نداد، در لاگ فریاد بزن (ولی خروجی را غیرصفر نکن تا کرون هی هشدار نفرستد).
sleep 3
for port in 3001 3002 3003; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$port/" || echo "000")
  [ "$code" = "200" ] && echo "$(date)   ✓ $port=$code" || echo "$(date)   ✗ $port=$code — بررسی کن: pm2 logs --err"
done
echo "$(date) ✓ دیپلوی انجام شد"
