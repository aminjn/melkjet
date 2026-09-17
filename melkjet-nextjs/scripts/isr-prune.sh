#!/usr/bin/env bash
# هرسِ کشِ ISR — سقف‌محور و سن‌محور، نه یک‌جا.
#
# Next keeps one cache entry per rendered URL under <slot>/server/app/... and never
# caps the total. With ~14.6k listings and ~6.6k location pages the cache reached
# 3.2GB in 42 hours; before that it was 2.2GB + 890MB when the disk hit 94%.
#
# Deleting all of it at once is the wrong cure and we proved it: clearing 3.2GB on
# 15 Sep freed the disk but forced every one of those pages to re-render, which is
# the sustained 100-200% CPU on the serving instances that followed. So this trims
# only the excess above a cap, oldest first, and only when the cap is exceeded -
# a small wave nightly instead of one large one.
#
# Entries are groups: <name>.html, <name>.rsc, <name>.meta and <name>.segments/.
# Route code (.js, .nft.json and the [slug] directories) is never touched.
#
# Run:  isr-prune.sh [--delete]        (reports only, unless --delete)
set -uo pipefail
APP=/var/www/melkjet/melkjet-nextjs
CAP_MB=${ISR_CAP_MB:-1200}     # per route group
MIN_AGE_MIN=${ISR_MIN_AGE_MIN:-120}   # never evict something rendered in the last 2h
DELETE=0; [ "${1:-}" = "--delete" ] && DELETE=1

cd "$APP" || exit 1
SLOT=".next"
if [ -f .next-current ]; then SLOT="$(cat .next-current)"; fi
if [ ! -f "$SLOT/BUILD_ID" ]; then echo "✗ اسلاتِ زنده پیدا نشد: $SLOT"; exit 1; fi

total_freed=0
for group in listing locations product; do
  DIR="$SLOT/server/app/$group"
  [ -d "$DIR" ] || continue
  before_kb=$(du -sk "$DIR" | awk '{print $1}')
  cap_kb=$((CAP_MB * 1024))
  if [ "$before_kb" -le "$cap_kb" ]; then
    echo "$group: $((before_kb/1024))MB ≤ ${CAP_MB}MB — دست نمی‌زنم"
    continue
  fi

  # Oldest first. Only .html anchors a group, so we walk those and take the rest with it.
  need_kb=$((before_kb - cap_kb))
  freed_kb=0; n=0
  while IFS= read -r html; do
    [ "$freed_kb" -ge "$need_kb" ] && break
    base="${html%.html}"
    grp_kb=0
    for f in "$base.html" "$base.rsc" "$base.meta"; do
      [ -f "$f" ] && grp_kb=$((grp_kb + $(du -sk "$f" | awk '{print $1}')))
    done
    [ -d "$base.segments" ] && grp_kb=$((grp_kb + $(du -sk "$base.segments" | awk '{print $1}')))
    if [ "$DELETE" = "1" ]; then
      rm -f "$base.html" "$base.rsc" "$base.meta"
      rm -rf "$base.segments"
    fi
    freed_kb=$((freed_kb + grp_kb)); n=$((n + 1))
  done < <(find "$DIR" -type f -name '*.html' -mmin +"$MIN_AGE_MIN" -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-)

  total_freed=$((total_freed + freed_kb))
  echo "$group: $((before_kb/1024))MB → هدف ${CAP_MB}MB — $n ورودی، $((freed_kb/1024))MB"
done

echo "جمع: $((total_freed/1024))MB"
if [ "$DELETE" != "1" ]; then
  echo "اجرای آزمایشی — برای حذفِ واقعی: --delete"
fi
df -h / | tail -1
