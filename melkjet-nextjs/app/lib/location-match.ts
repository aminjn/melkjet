// فاز ۲۲۲ (کشفِ GSC: صفحهٔ گیشا با کلی آگهی «noindex» خورده بود) — تطبیقِ نامِ مکانِ درخت با
// متنِ آگهی‌ها، مشترک بینِ سایت‌مپ و صفحهٔ /locations. مشکلِ قدیمی: `includes(نامِ کامل)` —
// نامِ مرکب («گیشا (کوی نصر)») یا واریانتِ نیم‌فاصله هرگز نمی‌خورد → محلهٔ پرآگهی «کم‌محتوا»
// حساب و noindex می‌شد و از سایت‌مپ هم می‌افتاد. حالا: نام تکه‌تکه می‌شود و هر تکه با
// «مرزِ واژه» تطبیق می‌خورد («ونک» هرگز «پونک» را نمی‌گیرد؛ «سهروردی» «سهروردی جنوبی» را می‌گیرد).

const norm = (s: string) => ' ' + String(s || '')
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/‌/g, ' ')
  .replace(/[،؛؟«»٬]/g, ' ')   // نقطه‌گذاریِ فارسی داخلِ بازهٔ ؀-ۿ است و باید صریح مرز شود («تهران،»)
  .replace(/[^؀-ۿa-zA-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ').trim() + ' '

/** تکه‌های معنادارِ نامِ مکان: «گیشا (کوی نصر)» → [«گیشا»، «کوی نصر»] */
export function locationNameParts(nameFa: string): string[] {
  return String(nameFa || '').split(/[()\/،,]/).map(s => s.trim()).filter(s => s.length >= 2)
}

/** آیا متنِ آگهی (location+title) به این نامِ مکان می‌خورد؟ */
export function matchesLocationName(nameFa: string, hay: string): boolean {
  const h = norm(hay)
  return locationNameParts(nameFa).some(p => h.includes(norm(p)))
}

/** نسخهٔ پیش‌محاسبه برای حلقه‌های بزرگ (سایت‌مپ): متن‌ها یک‌بار نرمال می‌شوند. */
export function makeLocationMatcher(hays: string[]): (nameFa: string) => boolean {
  const H = hays.map(norm)
  return (nameFa: string) => {
    const parts = locationNameParts(nameFa).map(norm)
    return parts.length > 0 && H.some(h => parts.some(p => h.includes(p)))
  }
}

// ── پاک‌کردنِ پیشوندِ زمان از مکانِ اسکرپ‌شده ──────────────────────────────────
// کارتِ آگهی در دیوار زمان و محله را در یک خط می‌گذارد — «۱۴ ساعت پیش در سلسبیل
// شمالی» — و اسکرپر همهٔ آن خط را به‌عنوان location ذخیره می‌کرد. ۶۱۶ ردیف مقداری
// مثلِ «۱۴ساعتپیشدرسلسبیلشمالی» دارند که هیچ فیلترِ محله‌ای نمی‌تواند تطبیقش دهد:
// نه loc_norm می‌خوردش، نه صفحهٔ /locations، نه مرورِ محله‌به‌محله در بازی.
//
// The time part is machine-generated and safe to anchor on. The "در" after it is
// not: with the spaces intact "در سلسبیل شمالی" is a separator, but with them gone
// "درکه" and "دروس" are real Tehran neighbourhoods whose first two letters would be
// eaten. So the separator is only removed when a boundary proves it is one, and the
// ambiguous no-space case is returned as both candidates for the geo lookup to
// settle - a dictionary decides, not a regex.
const TIME_PREFIX = /^[\s\u200c]*(?:[۰-۹0-9]+[\s\u200c]*(?:ثانیه|دقیقه|ساعت|روز|هفته|ماه|سال)|لحظاتی|دقایقی)[\s\u200c]*پیش/
const DAR_SEP = /^[\s\u200c]*در[\s\u200c]+/

/** آیا این مقدار آلودهٔ پیشوندِ زمان است؟ */
export function hasTimePrefix(raw: string): boolean {
  return TIME_PREFIX.test(String(raw || '').trim())
}

/** «۱۴ ساعت پیش در سلسبیل شمالی» → «سلسبیل شمالی». بدونِ پیشوند، دست‌نخورده. */
export function stripTimePrefix(raw: string): string {
  const s = String(raw || '').trim()
  if (!TIME_PREFIX.test(s)) return s
  const rest = s.replace(TIME_PREFIX, '')
  const out = (DAR_SEP.test(rest) ? rest.replace(DAR_SEP, '') : rest).trim()
  return out || s
}

/** نامزدهای محله پس از حذفِ زمان. در حالتِ بی‌فاصله هر دو صورت برمی‌گردد
 *  («درسلسبیلشمالی» و «سلسبیلشمالی») تا تطبیقِ ژئو انتخاب کند. */
export function locationCandidates(raw: string): string[] {
  const first = stripTimePrefix(raw)
  const out = [first]
  const m = first.match(/^در[\s\u200c]*(.+)$/)
  if (m && m[1].trim().length >= 2) out.push(m[1].trim())
  return out
}
