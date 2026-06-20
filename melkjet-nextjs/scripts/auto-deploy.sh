#!/usr/bin/env bash
# دیپلوی خودکار: اگر روی origin/main پوش جدیدی باشد، pull + build + restart می‌کند.
# با cron هر ۲ دقیقه اجرا شود. قفل دارد تا دو build هم‌زمان نشود.
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
npm run build
pm2 restart melkjet
echo "$(date) ✓ دیپلوی انجام شد"
