// فاز ۳۰۴ه — مرجعِ واحدِ دسته‌های دایرکتوری + «نرمال‌سازی». ریشهٔ باگِ «دستهٔ تکراری»:
// آیتم‌ها گاهی با کلیدِ کوتاه (کارشناس)، گاهی با برچسبِ کامل (کارشناسان رسمی) و گاهی با هم‌معنی
// (وکیل، بانک، سردفتر…) ذخیره شده‌اند؛ سایدبار هرکدام را یک «دستهٔ جدا» می‌دید. این ماژول هر
// صورتِ دسته را به «کلیدِ کوتاهِ canonical» برمی‌گرداند — فقط در «خواندن»، بدونِ هیچ نوشتن/مهاجرتِ
// سنگین (که روی قفلِ scraper_meta گیر می‌کرد). هم سرور (API) و هم کلاینت (صفحهٔ دایرکتوری) از آن می‌خوانند.

export const DIR_CAT_DEFS: { id: string; label: string }[] = [
  { id: 'مشاور', label: 'مشاوران املاک' },
  { id: 'آژانس', label: 'آژانس‌ها' },
  { id: 'سازنده', label: 'سازندگان' },
  { id: 'مصالح', label: 'فروشندگان مصالح' },
  { id: 'معمار', label: 'معماران و طراحان' },
  { id: 'پیمانکار', label: 'پیمانکاران' },
  { id: 'کارشناس', label: 'کارشناسان رسمی' },
  { id: 'حقوقی', label: 'دفاتر حقوقی و وکلا' },
  { id: 'بیمه', label: 'بانک و بیمه' },
  { id: 'دفترخانه', label: 'دفاتر اسناد رسمی' },
]

const IDS = new Set(DIR_CAT_DEFS.map(c => c.id))
const LABEL_TO_ID: Record<string, string> = Object.fromEntries(DIR_CAT_DEFS.map(c => [c.label, c.id]))
// هم‌معنی‌ها → کلیدِ canonical (دسته‌های پراکندهٔ اسکرپ/ایمپورتِ قدیمی جذبِ دستهٔ درست می‌شوند).
const ALIAS: Record<string, string> = {
  'وکیل': 'حقوقی', 'وکلا': 'حقوقی', 'وکالت': 'حقوقی',
  'سازندگان تهران': 'سازنده',
  'بانک': 'بیمه', 'بیمه': 'بیمه', 'بانک و بیمه': 'بیمه',
  'سردفتر': 'دفترخانه', 'دفتر اسناد رسمی': 'دفترخانه', 'اسناد رسمی': 'دفترخانه',
  'ارزیاب': 'کارشناس',
}

/** هر صورتِ دسته → کلیدِ کوتاهِ canonical (برای شمارش، فیلتر و نمایش). ناشناخته = خودِ رشته. */
export function canonCat(c?: string | null): string {
  const s = String(c || '').trim()
  if (!s) return s
  if (IDS.has(s)) return s
  return LABEL_TO_ID[s] || ALIAS[s] || s
}

/** آیا این رشته یکی از دسته‌های شناخته‌شده است (کلید، برچسب یا هم‌معنی)؟ — برای حذفِ دسته‌های «اضافه» از سایدبار. */
export function isKnownCat(c?: string | null): boolean {
  const s = String(c || '').trim()
  return IDS.has(s) || !!LABEL_TO_ID[s] || !!ALIAS[s]
}

export const catLabelOf = (id: string) => DIR_CAT_DEFS.find(c => c.id === canonCat(id))?.label || id
