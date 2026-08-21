// محله‌ها و شهرهایی که یک کاربر واقعاً در آن‌ها کار می‌کند — از فایل‌های خودش.
// مرجعِ واحد است تا پنلِ آمارِ بازار و پنلِ پیشنهادها هرگز از هم جدا نیفتند.
import { listListings } from '../advisor-store'
import { getAgency } from '../agency-store'

export async function myArea(phone: string): Promise<{ hoods: string[]; cities: string[] }> {
  const hoods = new Set<string>(), cities = new Set<string>()
  const push = (h?: string, c?: string) => { if (h?.trim()) hoods.add(h.trim()); if (c?.trim()) cities.add(c.trim()) }
  try { for (const l of await listListings(phone)) push(l.neighborhood || l.district, l.city) } catch { /* مشاور نیست */ }
  try { for (const l of (await getAgency(phone)).listings || []) push(l.neighborhood || l.district, l.city) } catch { /* آژانس نیست */ }
  return { hoods: [...hoods], cities: [...cities] }
}
