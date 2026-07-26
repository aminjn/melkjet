// فاز ۲۲۲ (کشفِ GSC: صفحهٔ گیشا با کلی آگهی «noindex» خورده بود) — تطبیقِ نامِ مکانِ درخت با
// متنِ آگهی‌ها، مشترک بینِ سایت‌مپ و صفحهٔ /locations. مشکلِ قدیمی: `includes(نامِ کامل)` —
// نامِ مرکب («گیشا (کوی نصر)») یا واریانتِ نیم‌فاصله هرگز نمی‌خورد → محلهٔ پرآگهی «کم‌محتوا»
// حساب و noindex می‌شد و از سایت‌مپ هم می‌افتاد. حالا: نام تکه‌تکه می‌شود و هر تکه با
// «مرزِ واژه» تطبیق می‌خورد («ونک» هرگز «پونک» را نمی‌گیرد؛ «سهروردی» «سهروردی جنوبی» را می‌گیرد).

const norm = (s: string) => ' ' + String(s || '')
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/‌/g, ' ')
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
