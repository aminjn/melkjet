#!/bin/bash
# عکسِ ساعتیِ فایل‌های هویتی. پشتیبانِ روزانه پنجرهٔ ۲۴ ساعته دارد و در ۲۹ اوت ۲۰۲۶
# باعث شد ۲٫۵ روز حساب برنگردد. این فایل‌ها روی هم زیرِ یک مگابایت‌اند.
# نکتهٔ کلیدی: فایلِ خراب هرگز عکس گرفته نمی‌شود، وگرنه نسخه‌های سالم بیرون می‌روند.
D=/var/www/melkjet/melkjet-nextjs
S=/var/backups/melkjet/snap
mkdir -p "$S"
T=$(date +%Y%m%d-%H%M)
for f in .account-data.json .role-data.json .plan-data.json .profile-data.json .admin-data.json .payment-data.json .pending-reg-data.json; do
  [ -s "$D/$f" ] || continue
  python3 -c "import json;json.load(open('$D/$f'))" 2>/dev/null || { logger -t melkjet-snap "SKIP corrupt $f"; continue; }
  cp -a "$D/$f" "$S/$T$f"
done
ls -1t "$S" | tail -n +400 | while read -r x; do rm -f "$S/$x"; done
