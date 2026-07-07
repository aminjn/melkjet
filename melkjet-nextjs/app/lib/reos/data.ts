// REOS · Data adapters — موجودیت‌های موتور را از دادهٔ واقعیِ اپ می‌سازد (آگهی/مشاور/کاربر).
import { listItems, type Item } from '../scraper-store'
import { forIds } from '../listing-stats-store'
import { getPrefs } from '../user-store'
import { getAgency } from '../agency-store'
import { getAdvisor as getAdvisorProfile } from '../advisor-store'
import { agencyAdvisorFiles } from '../agency-team'
import { getFeatures, recentEvents } from './store'
import { parseFaNum, tokenize } from './features'
import type { PropertyEntity, UserEntity, AgentEntity, Intent } from './types'

// ── Item (آگهیِ عمومی) → PropertyEntity ──
export function itemToProperty(it: Item, stat?: { views: number; contacts: number }, saves = 0): PropertyEntity {
  const m = it.meta || {}
  const deal = (m['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(it.price || '')) ? 'rent' : 'sale'
  const lat = Number(m['__lat']) || undefined, lng = Number(m['__lng']) || undefined
  const features = m['امکانات'] ? String(m['امکانات']).split(/[،,]/).map(s => s.trim()).filter(Boolean) : []
  const ptype = m['نوع ملک'] || it.category || 'آپارتمان'
  return {
    id: it.id, price: parseFaNum(it.price), rentMonthly: deal === 'rent' ? parseFaNum(it.price) : undefined,
    deal, ptype, lat, lng, locationText: it.location || [m['شهر'], m['محله']].filter(Boolean).join('، '),
    area: parseFaNum(m['متراژ']) || undefined, rooms: parseFaNum(m['اتاق خواب']) || undefined,
    features, tokens: [...tokenize(ptype), ...tokenize(it.location), ...tokenize(it.title), ...features.flatMap(tokenize)],
    views: stat?.views || 0, contacts: stat?.contacts || 0, saves, createdAt: it.scrapedAt, ownerId: it.ownerId,
  }
}

// همهٔ املاکِ عمومیِ رتبه‌پذیر (با سیگنالِ تقاضا از listing-stats + feature store).
export async function loadProperties(limit = 300): Promise<PropertyEntity[]> {
  const items = (await listItems('listing', { publicOnly: true })).slice(0, limit)
  const stats = await forIds(items.map(i => i.id))
  const out: PropertyEntity[] = []
  for (const it of items) {
    let saves = 0
    try { saves = Number((await getFeatures('property', it.id)).save_count) || 0 } catch {}
    out.push(itemToProperty(it, stats[it.id], saves))
  }
  return out
}

// ── کاربر (خریدار/سرمایه‌گذار) → UserEntity: علاقه‌مندی + رفتار + ویژگی‌ها ──
export async function loadUser(userId: string): Promise<UserEntity> {
  const prefs = await getPrefs(userId).catch(() => ({ favorites: [] as string[], savedSearches: [] as { query: string }[] } as any))
  const feats = await getFeatures('user', userId).catch(() => ({} as Record<string, number>))
  const events = await recentEvents({ userId, limit: 100 }).catch(() => [])
  const interacted = Array.from(new Set([...(prefs.favorites || []), ...events.filter(e => e.propertyId).map(e => e.propertyId!)]))
  // توکنِ رفتاری از جستجوهای ذخیره‌شده (نوع/منطقه/…)
  const searchToks = (prefs.savedSearches || []).flatMap((s: { query: string }) => tokenize(s.query))
  // بودجه/نیت را از جستجوها استخراج کن (سبک)؛ وگرنه پیش‌فرض.
  const allSearch = (prefs.savedSearches || []).map((s: { query: string }) => s.query).join(' ')
  const budget = parseFaNum((allSearch.match(/([\d۰-۹,٬]{4,})/) || [])[1]) || Number(feats.budget) || 0
  const intent: Intent = /اجاره|رهن/.test(allSearch) ? 'rent' : /سرمایه|invest/.test(allSearch) ? 'invest' : 'buy'
  const engagementScore = Math.min(1, (Number(feats.intent_score) || 0) / 50 + (interacted.length ? 0.2 : 0))
  return {
    id: userId, budget, intent, locationText: (prefs.savedSearches?.[0]?.query) || undefined,
    engagementScore, behaviorTokens: searchToks, interactedPropertyIds: interacted,
  }
}

// ── مشاورانِ یک آژانس → AgentEntity[] (با عملکردِ واقعی از agency-team) ──
export async function loadAgentsForAgency(agencyPhone: string): Promise<AgentEntity[]> {
  const agency = await getAgency(agencyPhone)
  const af = await agencyAdvisorFiles(agencyPhone)
  const out: AgentEntity[] = []
  // مشاورانِ لینک‌شده (اکانت‌دار) با آمارِ واقعی
  for (const r of af.rows) {
    const leads = r.leads?.total || 0
    const conv = leads ? Math.min(1, r.closedCount / leads) : 0
    // تخصصِ واقعیِ مشاور از پروفایلش (تخصص‌ها + مناطق) — برای تطبیقِ منطقه/نوع در موتور.
    let specialties: string[] = []
    try { const prof = (await getAdvisorProfile(r.advisorPhone)).profile; specialties = [...(prof.specialties || []), ...(prof.areas ? String(prof.areas).split(/[،,]/).map(s => s.trim()).filter(Boolean) : [])] } catch {}
    out.push({ id: r.advisorPhone, name: r.advisorName, conversionRate: conv, deals: r.closedCount, openLoad: r.leads?.open || 0, rating: 4, active: true, specialties })
  }
  // مشاورانِ محلیِ دستی (بدونِ اکانت) — برای تخصیصِ داخلی
  for (const g of agency.agents.filter(a => a.active)) {
    if (out.some(o => o.name === g.name)) continue
    out.push({ id: 'local:' + g.id, name: g.name, deals: g.deals || 0, conversionRate: g.deals ? Math.min(1, g.deals / Math.max(1, g.leads)) : 0, openLoad: 0, rating: 3.5, active: true, specialties: [] })
  }
  return out
}
