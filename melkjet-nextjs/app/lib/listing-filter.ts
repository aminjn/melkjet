// فاز ۱۵۱ — منبعِ واحدِ «شهر/نوعِ معامله»ی یک آگهی.
// جستجو (کلاینت) و /api/content (سرور) باید آگهی را عینِ هم دسته‌بندی کنند، وگرنه شمارِ
// «N از total» با کارت‌های نمایش‌داده‌شده نمی‌خواند. هر تغییری این‌جا هر دو طرف را با هم می‌برد.
export type DealKind = 'sale' | 'rent' | 'presale'

export interface DealFields {
  title?: string
  price?: string
  category?: string
  tags?: string[]
  meta?: Record<string, string>
}

export function dealOf(it: DealFields): DealKind {
  const dealTxt = `${it.price || ''} ${it.title || ''} ${it.category || ''} ${it.meta?.['نوع معامله'] || ''} ${(it.tags || []).join(' ')}`
  if (/پیش[‌\s]?فروش/.test(dealTxt)) return 'presale'
  if (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(dealTxt)) return 'rent'
  return 'sale'
}

// تطبیقِ شهر — مقاوم به نیم‌فاصله/فاصله («سعادت‌آباد» = «سعادت آباد»). موقعیتِ آگهی یا meta شهر.
const normCity = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()

export function cityMatch(it: { location?: string; meta?: Record<string, string> }, city: string): boolean {
  const c = normCity(city)
  if (!c) return true
  return normCity(it.location || '').includes(c) || normCity(it.meta?.['شهر'] || '').includes(c)
}
