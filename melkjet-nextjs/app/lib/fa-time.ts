// فاز ۲۰۸ (فیدبک: «آگهی‌ها معلوم نیست برای کی هست و کاربر نمی‌فهمه — خیلی مهمه؛ هم روی کارت‌ها هم
// توی خودِ آگهی») — برچسبِ سنِ آگهی، خالص و مشترک بینِ کارتِ جستجو و صفحهٔ آگهی (تست‌پذیر).
const faDig = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])

/** «دقایقی پیش / N ساعت پیش / دیروز / N روز پیش / N هفته پیش / N ماه پیش» — از مهرِ واقعیِ ثبت. */
export function listingAgeLabel(ts: number, now: number = Date.now()): string {
  if (!ts || ts > now + 60_000) return ''
  const min = Math.floor(Math.max(0, now - ts) / 60_000)
  if (min < 60) return 'دقایقی پیش'
  const h = Math.floor(min / 60)
  if (h < 24) return `${faDig(h)} ساعت پیش`
  const d = Math.floor(h / 24)
  if (d === 1) return 'دیروز'
  if (d < 7) return `${faDig(d)} روز پیش`
  if (d < 30) return `${faDig(Math.floor(d / 7))} هفته پیش`
  return `${faDig(Math.max(1, Math.floor(d / 30)))} ماه پیش`
}

/** آگهیِ «تازه» (زیرِ ۲۴ ساعت) — برای برچسبِ برجستهٔ «جدید». */
export const isFreshListing = (ts: number, now: number = Date.now()) => !!ts && now - ts < 24 * 3600 * 1000
