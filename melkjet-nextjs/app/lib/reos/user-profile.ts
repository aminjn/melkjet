// 👤 فاز ۱۸۹ — شناختِ کاربر از رفتارِ واقعی (فیدبک: «باید کاربران رو از رفتارشون بشناسه ولی هیچی نداره»):
// پروفایلِ رفتاری ۱۰۰٪ از رویدادهای واقعیِ REOS ساخته می‌شود — بازدید/ذخیره/جستجو/تماس، محله‌های
// محبوب، بازهٔ قیمتیِ واقعاً دیده‌شده، آخرین فعالیت + امتیازِ تعاملِ یادگرفته‌شده. هیچ عددِ ساختگی؛
// دادهٔ کم = گزارشِ صادقانهٔ «هنوز شناخت کافی نیست».
import { recentEvents, getFeatures } from './store'
import type { ReosEvent } from './types'

export interface UserProfile {
  userId: string
  events: number
  views: number; saves: number; searches: number; contacts: number
  topHoods: Array<{ hood: string; count: number }>
  priceBand: { min: number; median: number; max: number } | null
  recentQueries: string[]
  lastActiveAt: number | null
  engagement: number
  known: boolean            // آیا دادهٔ کافی برای «شناخت» داریم؟ (حداقل ۳ رویدادِ محتوایی)
}

// هستهٔ خالص (تست‌پذیر): از رویدادها + اطلاعاتِ آگهی‌های دیده‌شده پروفایل بساز
export function profileCoreOf(
  userId: string,
  events: Array<Pick<ReosEvent, 'type' | 'at' | 'propertyId'> & { meta?: Record<string, unknown> }>,
  propInfo: Record<string, { hood?: string; price?: number }>,
  engagement = 0,
): UserProfile {
  const views = events.filter(e => e.type === 'user_clicked_property')
  const saves = events.filter(e => e.type === 'user_saved_property').length
  const searches = events.filter(e => e.type === 'user_searched')
  const contacts = events.filter(e => e.type === 'contact_made').length
  const hoodCount = new Map<string, number>()
  const prices: number[] = []
  const seenProps = new Set<string>()
  for (const ev of [...views, ...events.filter(e => e.type === 'user_saved_property' || e.type === 'contact_made')]) {
    const id = ev.propertyId
    if (!id || seenProps.has(id)) continue
    seenProps.add(id)
    const info = propInfo[id]
    if (!info) continue
    const h = String(info.hood || '').trim()
    if (h) hoodCount.set(h, (hoodCount.get(h) || 0) + 1)
    if ((info.price || 0) > 0) prices.push(info.price!)
  }
  prices.sort((a, b) => a - b)
  const queries = searches
    .map(e => String((e.meta as any)?.q || '').trim()).filter(Boolean)
  const lastActiveAt = events.length ? Math.max(...events.map(e => e.at || 0)) : null
  return {
    userId,
    events: events.length,
    views: views.length, saves, searches: searches.length, contacts,
    topHoods: [...hoodCount.entries()].map(([hood, count]) => ({ hood, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    priceBand: prices.length ? { min: prices[0], median: prices[Math.floor(prices.length / 2)], max: prices[prices.length - 1] } : null,
    recentQueries: [...new Set(queries)].slice(0, 5),
    lastActiveAt,
    engagement,
    known: views.length + saves + searches.length + contacts >= 3,
  }
}

// نسخهٔ کامل: رویدادهای واقعیِ کاربر + مشخصاتِ آگهی‌های دیده‌شده از استورِ واقعی
export async function userProfileOf(userId: string): Promise<UserProfile> {
  const events = await recentEvents({ userId, limit: 300 }).catch(() => [])
  const ids = [...new Set(events.map(e => e.propertyId).filter(Boolean))].slice(0, 40) as string[]
  const { getItemById } = await import('../scraper-store')
  const { parseFaNum } = await import('./features')
  const propInfo: Record<string, { hood?: string; price?: number }> = {}
  for (const id of ids) {
    const it = await getItemById(id).catch(() => null)
    if (!it) continue
    const parts = String(it.location || '').split(/[،,]/).map(x => x.trim()).filter(Boolean)
    propInfo[id] = { hood: parts.length > 1 ? parts[parts.length - 1] : (parts[0] || ''), price: parseFaNum(it.price) || 0 }
  }
  const feats = await getFeatures('user', userId).catch(() => ({} as Record<string, number>))
  return profileCoreOf(userId, events as any, propInfo, Math.round(feats.engagement_score || 0))
}
