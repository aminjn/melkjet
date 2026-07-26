// فاز ۲۲۹ — نوارِ آمارِ صفحهٔ اصلی: «عددِ ضعیف بدتر از نبودنِ عدد است».
// در سورسِ لایوِ خودِ کاربر «۰+ متخصص و مشاور» و «۱+ فروشگاه» دیده شد — عددِ واقعی، ولی
// روی صفحهٔ اصلیِ بازاریابی مثلِ سایتِ خالی به نظر می‌رسد. قانونِ پروژه «هیچ عددِ ساختگی»
// است، پس راهِ درست پنهان‌کردنِ آمارِ زیرِ آستانه است، نه بزرگ‌نمایی. تابع pure است تا
// در تستِ واحد سنجیده شود؛ HomeClient فقط خروجیِ همین را رندر می‌کند.

export type HomeSysStats = { listings: number; advisors: number; products: number; shops: number; builders: number }

export const HOME_STAT_MIN = 10

export function visibleHomeStats(s: HomeSysStats | null | undefined, min = HOME_STAT_MIN): { n: number; l: string }[] {
  if (!s) return []
  const rows = [
    { n: Number(s.listings) || 0, l: 'آگهیِ فعالِ ملک' },
    { n: Number(s.products) || 0, l: 'محصولِ مصالح' },
    { n: Number(s.shops) || 0, l: 'فروشگاهِ مصالح' },
    { n: Number(s.advisors) || 0, l: 'متخصص و مشاور' },
    { n: Number(s.builders) || 0, l: 'سازنده در دیتابیس' },
  ]
  return rows.filter(r => r.n >= min)
}
