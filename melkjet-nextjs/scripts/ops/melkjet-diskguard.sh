#!/bin/bash
# اگر دیسک از ۸۰٪ بگذرد، کشِ اجراییِ Next را هرس کن. فایل‌های تازه‌تر از BUILD_ID
# خروجیِ بیلد نیستند؛ Next خودش دوباره می‌سازدشان. ۲۹ اوت ۲۰۲۶: خزنده در یک روز
# ۵۳۳ هزار فایل ساخت، دیسک پر شد، پستگرس و فایل‌های داده با هم رفتند.
D=/var/www/melkjet/melkjet-nextjs
U=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$U" -lt 80 ] && exit 0
N=$(find "$D/.next/server/app" -type f -newer "$D/.next/BUILD_ID" 2>/dev/null | wc -l)
find "$D/.next/server/app" -type f -newer "$D/.next/BUILD_ID" -delete 2>/dev/null
find "$D/.next/server/app" -depth -type d -empty -delete 2>/dev/null
logger -t melkjet-diskguard "disk ${U}% — pruned $N cache files, now $(df --output=pcent / | tail -1 | tr -d ' ')"
