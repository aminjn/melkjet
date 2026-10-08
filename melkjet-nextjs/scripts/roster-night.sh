#!/usr/bin/env bash
# چرا هر پاسِ سینکِ آژانس این‌قدر طول می‌کشد؟ — از لاگِ همین حالا، بدونِ انتظار تا فردا.
#
# roster-health می‌گوید «شبی N آژانس». این می‌گوید «چرا N و نه ۴N»: پاس‌های تمام‌شده،
# پاس‌هایی که بودجهٔ ۴۵دقیقه‌ای‌شان تمام شده، بارِ تازه‌سازیِ هر پاس، و زمانِ واکشیِ دیوار.
#
# ⚠ یک سوگیریِ مهم که باید بدانی: خطِ `[roster] token=` فقط وقتی چاپ می‌شود که
#   `ms > 30000` یا واکشی ناموفق باشد (agency-roster-store). پس این نمونه «فقط کندها»
#   است، نه همهٔ توکن‌ها — عدد میانه‌اش را به‌جای میانهٔ واقعی نخوان. شمارشش ولی
#   معنادار است: هر خط = یک واکشیِ بالای ۳۰ ثانیه.
#
# اجرا (روی سرور، کاربرِ root چون لاگ زیرِ /root است):
#   sudo bash scripts/roster-night.sh            # کلِ لاگِ موجود
#   sudo bash scripts/roster-night.sh 2026-10-08 # فقط یک روز (اگر لاگ تاریخ دارد)
set -uo pipefail

LOGDIR=${LOGDIR:-/root/.pm2/logs}
DAY=${1:-}
shopt -s nullglob
LOGS=("$LOGDIR"/melkjet-3000-out*.log "$LOGDIR"/melkjet-out*.log)
if [ ${#LOGS[@]} -eq 0 ]; then
  echo "لاگی در $LOGDIR پیدا نشد. مسیر را با LOGDIR=... بده." >&2
  exit 1
fi
echo "لاگ‌ها: ${LOGS[*]}"
[ -n "$DAY" ] && echo "فیلترِ روز: $DAY"

# فیلترِ روز فقط اگر pm2 log_date_format فعال باشد؛ وگرنه کلِ فایل.
feed() {
  if [ -n "$DAY" ]; then grep -hF -- "$DAY" "${LOGS[@]}" 2>/dev/null
  else cat "${LOGS[@]}" 2>/dev/null; fi
}

# -F الزامی است: «[roster]» در regex یک کلاسِ نویسه است (یکی از r,o,s,t,e) نه متنِ
# «[roster]». بارِ اول همین باگ همهٔ شمارش‌ها را صفر نشان داد.
n() { feed | grep -cF -- "$1" 2>/dev/null || true; }

echo
echo "— پاس‌ها —"
printf '  %-34s %6s\n' "پاسِ موفقِ کامل"        "$(n '[roster] pass end OK')"
printf '  %-34s %6s\n' "بودجه/توقف (ناتمام)"    "$(n '[roster] pass end (')"
printf '  %-34s %6s\n' "پاسِ شکست‌خورده"        "$(n '[roster] pass FAILED')"
printf '  %-34s %6s\n' "اسکنِ ناقصِ پروفایل"     "$(n 'اسکن')"

echo
echo "— بارِ تازه‌سازیِ هر پاس (سقفِ مشتق‌شده از ردیف‌ها) —"
REFRESH=$(feed | grep -F -- '[roster] incremental: refreshing' | sed -E 's/.*refreshing ([0-9]+) stale rows of ([0-9]+) \(cap ([0-9]+)\).*/\1 \2 \3/')
if [ -z "$REFRESH" ]; then
  echo "  هیچ خطی نبود — یعنی هیچ پاسی ردیفِ کهنه نداشته، یا لاگ چرخیده."
else
  echo "$REFRESH" | awk '{ r+=$1; if ($3>mc) mc=$3; n++ } END {
    printf "  %-30s %6d\n", "پاس‌های دارای تازه‌سازی", n
    printf "  %-30s %6d\n", "جمعِ ردیف‌های تازه‌شده", r
    printf "  %-30s %6.1f\n", "میانگین در هر پاس", r/n
    printf "  %-30s %6d\n", "بیشترین سقفِ دیده‌شده", mc }'
  # میانه با sort، چون asort فقط در gawk هست و سرور ممکن است mawk باشد
  MED=$(echo "$REFRESH" | awk '{print $1}' | sort -n | awk '{v[NR]=$1} END{print v[int((NR+1)/2)]}')
  printf '  %-30s %6s\n' "میانهٔ هر پاس" "$MED"
fi

echo
echo "— واکشیِ کُندِ دیوار (فقط >۳۰ ثانیه یا ناموفق؛ هر خط یک واکشی) —"
SLOW=$(feed | grep -F -- '[roster] token=' | sed -E 's/.*ms=([0-9]+).*/\1/' | grep -E '^[0-9]+$' | sort -n)
if [ -z "$SLOW" ]; then
  echo "  هیچ واکشیِ کُندی ثبت نشده — پس طولِ پاس از دیوار نیست؛ جای دیگر را بگرد."
else
  echo "$SLOW" | awk '{v[NR]=$1; s+=$1} END {
    printf "  %-30s %6d\n", "تعداد", NR
    printf "  %-30s %6.1f ثانیه\n", "میانه (از همین کُندها)", v[int((NR+1)/2)]/1000
    printf "  %-30s %6.1f ثانیه\n", "بیشترین", v[NR]/1000
    printf "  %-30s %6.1f دقیقه\n", "جمعِ زمانِ همین کُندها", s/60000 }'
fi
echo "  عقب‌نشینیِ نرخ (پیامِ کند/محدودِ دیوار): $(n 'کند')"

echo
echo "— ری‌استارتِ اینستنسِ ۰ وسطِ کار (هر دیپلوی یکی) —"
printf '  %-34s %6s\n' "سینکِ نیمه‌کاره از ری‌استارت" "$(n 'ری‌استارتِ سرور نیمه‌کاره')"
printf '  %-34s %6s\n' "scheduler armed (بوتِ کرون)"  "$(n 'scheduler armed')"

echo
echo "— خطاهای زیرساخت در مسیرِ سینک —"
printf '  %-34s %6s\n' "timeout گرفتنِ اتصالِ PG" "$(n 'timeout exceeded when trying to connect')"
printf '  %-34s %6s\n' "statement timeout"        "$(n 'statement timeout')"
printf '  %-34s %6s\n' "۴۲۹ دیوار"                "$(n 'http_429')"

echo
echo "راهنما: اگر «بودجه/توقف» نزدیکِ «پاسِ موفق» است، سقفِ ۴۵دقیقه‌ای گلوگاه است."
echo "        اگر واکشیِ کُند زیاد است، گلوگاه throttleِ دیوار روی همین IP است (فاز ۲۶۰: پروکسیِ بیشتر)."
echo "        اگر هر دو کم‌اند ولی پاس‌ها کم‌شمارند، راه‌اندازِ کرون اسلات‌ها را پر نمی‌کند."
