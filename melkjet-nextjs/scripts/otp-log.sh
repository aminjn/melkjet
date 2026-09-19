#!/usr/bin/env bash
# آخرین خطوطِ ارسالِ OTP و DNSِ کند — از هر اینستنس جدا.
#
# Why a script and not a one-liner: the four pm2 instances each have their own log
# file, so `grep -h ... *out*.log | tail` only ever shows the end of the LAST file
# and silently hides a line written by any other instance. That reading is what
# made me say "nobody requested a code" when someone just had.
#
# اجرا:  bash /var/www/melkjet/melkjet-nextjs/scripts/otp-log.sh
set -u
shopt -s nullglob
found=0
for f in /root/.pm2/logs/*out*.log; do
  found=1
  printf '== %s\n' "${f##*/}"
  grep -E 'otp\] send|\[dns\] slow' "$f" | tail -6
done
if [ "$found" -eq 0 ]; then
  echo 'هیچ فایلِ لاگی در /root/.pm2/logs پیدا نشد — pm2 زیرِ کاربرِ دیگری اجرا می‌شود؟'
fi
