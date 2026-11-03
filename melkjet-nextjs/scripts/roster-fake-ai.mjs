// فاز ۳۴۶ — «AI»ِ ساختگی برای تست‌های سینکِ روستر: نام فقط از AI می‌آید، پس تست‌های چرخهٔ سینک (ساخت حساب/ادغام/مسابقه)
// یک پاسخ‌دهندهٔ قطعی لازم دارند. آخرین واژهٔ فارسیِ خطی که «کارشناس/مشاور» دارد را برمی‌گرداند؛ وگرنه خالی (= «بی‌امضا»).
export async function fakeAi(items) {
  const map = {}
  for (const it of items) {
    const line = String(it.desc || '').split('\n').reverse().find(l => /کارشناس|مشاور/.test(l))
    const ws = line ? line.match(/[ء-ی]{2,}/g) || [] : []
    if (ws.length) map[it.i] = ws[ws.length - 1]
  }
  return { map, raw: '', answered: items.map(it => it.i) }
}
