// فاز ۲۳۲ — کشِ نتایجِ مشتق، قفل‌شده به «نسلِ» دادهٔ منبع.
// لنگر (anchor) = آرایهٔ مرجع-پایدارِ listItemsStable: تا وقتی داده عوض نشده همان مرجع است،
// پس نتیجهٔ گرانِ مشتق (فیلترِ هاب، میانهٔ قیمتِ محله، آگهی‌های یک مکان) یک‌بار در هر نسل
// محاسبه می‌شود نه در هر درخواست. با نوشتنِ جدید، نسلِ تازه لنگرِ تازه دارد و WeakMap نسلِ
// قبلی را خودش جمع می‌کند — هیچ TTL و هیچ invalidationِ دستی لازم نیست.
const store = new WeakMap<object, Map<string, unknown>>()

export function derivedFrom<T>(anchor: object, key: string, build: () => T): T {
  let m = store.get(anchor)
  if (!m) { m = new Map(); store.set(anchor, m) }
  if (!m.has(key)) m.set(key, build())
  return m.get(key) as T
}
