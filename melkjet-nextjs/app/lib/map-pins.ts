// فاز ۲۰۲ (فیدبک: «نقشه همچنان مشکل داره؛ محله‌ای انتخاب نکردم باید کلِ شهر رو نشون بده») —
// منطقِ خالصِ نقشهٔ جستجو، جدا از کامپوننت تا واقعاً تست‌پذیر باشد:
// ۱) پین‌ها دیگر به ۴۰ آگهیِ اولِ مرتب‌سازی محدود نیستند (کلِ استخرِ فیلترشدهٔ شهر پین می‌شود؛
//    خوشه‌بندیِ سمتِ نقشه ازدحام را جمع می‌کند)، پس قاب باید «کلِ شهر» را بگیرد.
// ۲) قابِ نقشه مقاوم به مختصاتِ پرت است: چند geocodeِ اشتباه/آگهیِ خارج از شهر نباید
//    قاب را به بیابان بکشد — کرانه‌ها از صدک ۵٪–۹۵٪ می‌آیند (وقتی پین کافی داریم).

export type PinPoint = { lat: number; lng: number }
export type PinView = { center: { lat: number; lng: number }; zoom: number }

/** قابِ متناسب با گسترهٔ پین‌ها؛ با ≥۲۰ پین، کرانه‌ها صدکی می‌شوند تا پرت‌ها قاب را ندزدند. */
export function pinBoundsView(pins: PinPoint[]): PinView | null {
  if (!pins.length) return null
  const lats = pins.map(p => p.lat).sort((a, b) => a - b)
  const lngs = pins.map(p => p.lng).sort((a, b) => a - b)
  const trim = pins.length >= 20
  const lo = (a: number[]) => a[trim ? Math.floor((a.length - 1) * 0.05) : 0]
  const hi = (a: number[]) => a[trim ? Math.ceil((a.length - 1) * 0.95) : a.length - 1]
  const minLat = lo(lats), maxLat = hi(lats), minLng = lo(lngs), maxLng = hi(lngs)
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.004)
  // شهرِ کامل (گسترهٔ ~۰٫۴ درجه) باید در قاب جا شود → کفِ زوم ۱۰؛ محلهٔ تکی همان ۱۵.
  const zoom = Math.max(10, Math.min(15, Math.floor(Math.log2(360 / span)) - 1))
  return { center, zoom }
}

const normFa = (s: string) => (s || '').replace(/[‌\s]/g, '')

/** نامِ محله از رشتهٔ موقعیت — تکهٔ اولی که «خودِ نامِ شهر» نباشد. («تهران، جنت‌آباد جنوبی» → جنت‌آباد جنوبی)
 *  کدِ قدیمی همیشه تکهٔ اول را می‌گرفت → برای این قالب، نامِ شهر geocode می‌شد و همهٔ
 *  آگهی‌های بی‌مختصات وسطِ شهر تلنبار می‌شدند. */
export function hoodPartOf(location: string, city: string): string {
  const parts = (location || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
  if (!parts.length) return ''
  const c = normFa(city)
  const hood = parts.find(p => !c || normFa(p) !== c) || parts[0]
  return hood === 'نامشخص' ? '' : hood
}

/** کلیدِ geocodeِ یک آگهی («<محله> <شهر>») — همان کلیدی که پین و کشِ کلاینت استفاده می‌کنند. */
export function geoKeyOf(location: string, city: string): string {
  const hood = hoodPartOf(location, city)
  return hood ? `${hood} ${city || ''}`.trim() : ''
}

/** کلیدهای geocodeِ محله برای آگهی‌های بی‌مختصات — یکتا، بدونِ «نامشخص»، با سقف (فشار به نشان). */
export function geocodeKeysOf(
  items: { lat?: number; lng?: number; location?: string }[],
  city: string,
  cap = 120,
): string[] {
  const set = new Set<string>()
  for (const it of items) {
    if (it.lat && it.lng) continue
    const key = geoKeyOf(it.location || '', city)
    if (!key) continue
    set.add(key)
    if (set.size >= cap) break
  }
  return Array.from(set)
}
