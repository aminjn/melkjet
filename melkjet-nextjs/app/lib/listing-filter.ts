// فاز ۱۵۱ — منبعِ واحدِ «شهر/نوعِ معامله»ی یک آگهی.
// جستجو (کلاینت) و /api/content (سرور) باید آگهی را عینِ هم دسته‌بندی کنند، وگرنه شمارِ
// «N از total» با کارت‌های نمایش‌داده‌شده نمی‌خواند. هر تغییری این‌جا هر دو طرف را با هم می‌برد.
export type DealKind = 'sale' | 'rent' | 'presale' | 'daily'

export interface DealFields {
  title?: string
  price?: string
  category?: string
  tags?: string[]
  meta?: Record<string, string>
}

// فاز ۱۷۷ (فیدبک: «می‌زنم اجاره همه‌چیز میاره») — طبقه‌بندی با «تقدمِ سیگنالِ قوی»، نه regex روی همه‌چیز:
// (۱) متای صریحِ «نوع معامله» حرفِ آخر است. (۲) رشتهٔ قیمت (ودیعه/اجاره = rent، تومانِ ساده = sale).
// (۳) فقط عنوان+دسته. تگ‌ها کلاً حذف شدند — تگِ عمومیِ «رهن و اجاره» همهٔ آگهی‌ها را اجاره‌ای می‌کرد.
// فاز ۱۹۰ — اجارهٔ روزانه/کوتاه‌مدت (فیدبک+اسکرین‌شاتِ دیوار: «آگهی‌های اجارهٔ روزانه رو سایت درست نمیاره»):
// سیگنال‌ها: «کوتاه‌مدت/روزانه» در متا/عنوان/دسته، قیمتِ «تومان/شب»، یا متاهای مخصوصِ دیوار
// (روزهای عادی/آخر هفته/ظرفیت استاندارد). چون «اجارهٔ کوتاه‌مدت» واژهٔ اجاره را دارد، روزانه قبل از rent چک می‌شود.
const DAILY_RE = /کوتاه[‌\s]?مدت|روزانه/
const NIGHT_PRICE_RE = /\/\s*شب|تومان\s*\/?\s*شب|هر\s*شب|شبی\s/
export function dealOf(it: DealFields): DealKind {
  const explicit = it.meta?.['نوع معامله'] || ''
  if (explicit) {
    if (/پیش[‌\s]?فروش/.test(explicit)) return 'presale'
    if (DAILY_RE.test(explicit)) return 'daily'
    if (/اجاره|رهن|ودیعه/.test(explicit)) return 'rent'
    if (/فروش|خرید/.test(explicit)) return 'sale'
  }
  const price = it.price || ''
  if (NIGHT_PRICE_RE.test(price)) return 'daily'
  const metaKeys = Object.keys(it.meta || {}).join(' ')
  if (/روزهای عادی|آخر هفته|ظرفیت استاندارد|تعطیلات و مناسبت/.test(metaKeys)) return 'daily'
  if (/ودیعه|رهن|اجاره/.test(price)) return 'rent'
  const tc = `${it.title || ''} ${it.category || ''}`
  if (/پیش[‌\s]?فروش/.test(tc)) return 'presale'
  if (DAILY_RE.test(tc) && /اجاره|سوئیت|آپارتمان|اقامت/.test(tc)) return 'daily'
  if (/اجاره|رهن|ودیعه/.test(tc)) return 'rent'
  return 'sale'
}

// تطبیقِ شهر — مقاوم به نیم‌فاصله/فاصله («سعادت‌آباد» = «سعادت آباد»). موقعیتِ آگهی یا meta شهر.
const normCity = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()

export function cityMatch(it: { location?: string; meta?: Record<string, string> }, city: string): boolean {
  const c = normCity(city)
  if (!c) return true
  return normCity(it.location || '').includes(c) || normCity(it.meta?.['شهر'] || '').includes(c)
}
