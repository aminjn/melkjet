#!/bin/bash
# هرسِ تصاویرِ یتیمِ کشِ آگهی.
#
# کلیدِ کش sha1(آدرسِ CDN) است و آدرسِ دیوار امضادار و ناپایدار است: هر بار که یک آگهی
# دوباره اسکرپ شود آدرسش عوض می‌شود، هشِ تازه‌ای می‌گیرد، و نسخهٔ قبلی روی دیسک یتیم
# می‌ماند. پس این کش رشدِ خطی دارد و هیچ‌وقت کوچک نمی‌شود — دو دورِ سینک ۸ گیگ شد و
# دیسک را پر کرد. این اسکریپت هرچه را که هیچ آگهی و هیچ سندِ kv به آن ارجاع نمی‌دهد
# پاک می‌کند. بدونِ آرگومان فقط گزارش می‌دهد؛ حذفِ واقعی با --delete.
set -uo pipefail
DIR=/var/www/melkjet/melkjet-nextjs/.media/li
[ -d "$DIR" ] || { echo "پوشهٔ کش نیست: $DIR"; exit 1; }
TMP=$(mktemp -d) || exit 1
trap 'rm -rf "$TMP"' EXIT

# مجموعهٔ «نگه‌دار»: هر نامِ /api/li/… که در جدولِ آگهی‌ها یا در سندهای kv دیده شود.
# kv هم لازم است چون فایل‌های مشاورها (advisor:{owner}) آدرسِ محلی را در خود دارند.
sudo -u postgres psql -d melkjet -tAc "
  SELECT DISTINCT m[1] FROM (
    SELECT regexp_matches(data::text, '/api/li/([a-f0-9]{20}[.](?:jpg|png|webp|gif))', 'g') AS m FROM listings
    UNION ALL
    SELECT regexp_matches(data::text, '/api/li/([a-f0-9]{20}[.](?:jpg|png|webp|gif))', 'g') AS m FROM kv
  ) t" 2>/dev/null | grep -E '^[a-f0-9]{20}[.](jpg|png|webp|gif)$' | sort -u > "$TMP/keep"

ls -1 "$DIR" 2>/dev/null | grep -E '^[a-f0-9]{20}[.](jpg|png|webp|gif)$' | sort -u > "$TMP/have"

# گاردِ ایمنی: اگر مجموعهٔ نگه‌دار مشکوکانه کوچک باشد (کوئری شکست خورده یا جدول خالی
# است)، چیزی حذف نمی‌شود. بدونِ این گارد، یک خطای دیتابیس یعنی پاک‌شدنِ کلِ کش.
K=$(wc -l < "$TMP/keep"); H=$(wc -l < "$TMP/have")
comm -23 "$TMP/have" "$TMP/keep" > "$TMP/orphans"
O=$(wc -l < "$TMP/orphans")
SZ=$(cd "$DIR" && xargs -r -a "$TMP/orphans" du -c --block-size=1M 2>/dev/null | tail -1 | cut -f1)
echo "روی دیسک: $H   ارجاع‌شده: $K   یتیم: $O   (~${SZ:-0} مگابایت)"
if [ "$K" -lt 1000 ]; then
  echo "توقف: مجموعهٔ ارجاع‌شده خیلی کوچک است ($K) — کوئری احتمالا شکست خورده. چیزی حذف نشد."
  exit 2
fi
if [ "${1:-}" = "--delete" ]; then
  (cd "$DIR" && xargs -r -a "$TMP/orphans" rm -f)
  echo "حذف شد. اندازهٔ فعلی:"; du -sh "$DIR"
else
  echo "(اجرای آزمایشی — برای حذفِ واقعی: --delete)"
fi
