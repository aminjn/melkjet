// جغرافیای زنده از آگهی‌های واقعی — مکملِ درختِ دستیِ geo-store.
// مشکل: لیستِ محلاتِ شهرهای غیرتهران در geo تقریباً خالی است؛ ولی خودِ آگهی‌ها (location = «شهر، محله»)
// هزاران جفتِ واقعیِ شهر/محله دارند. اینجا همان را استخراج و کش می‌کنیم تا:
//   • دراپ‌داونِ «مناطقِ فعالیت/محله» در پروفایل‌ها همیشه کامل باشد (خودگسترنده با رشدِ آگهی‌ها)
//   • ادمین با یک کلیک درختِ geo را از دادهٔ واقعی تکمیل کند (enrich)
import { candidateListings, type Item } from './scraper-store'
import { getAll } from './geo-store'

export interface LiveGeo {
  cities: Array<{ city: string; count: number }>
  hoodsByCity: Map<string, Map<string, number>>   // شهر → (محله → تعدادِ آگهیِ واقعی)
}

const norm = (s: string) => String(s || '').trim().replace(/\s+/g, ' ')
let cache: { at: number; geo: LiveGeo } | null = null
const TTL = 5 * 60_000

export async function liveGeo(): Promise<LiveGeo> {
  if (cache && Date.now() - cache.at < TTL) return cache.geo
  const items = await candidateListings(10000).catch(() => [] as Item[])
  const cityCount = new Map<string, number>()
  const hoodsByCity = new Map<string, Map<string, number>>()
  for (const it of items) {
    const parts = String(it.location || '').split(/[،,]/).map(norm).filter(Boolean)
    if (!parts.length) continue
    const city = parts[0]
    if (!city || city.length > 30) continue
    cityCount.set(city, (cityCount.get(city) || 0) + 1)
    // محله = آخرین بخش (همان قراردادِ hoodOf در کلِ پروژه)؛ فقط وقتی جدا از شهر آمده باشد.
    const hood = parts.length > 1 ? parts[parts.length - 1] : ''
    if (!hood || hood === city || hood.length > 40) continue
    if (!hoodsByCity.has(city)) hoodsByCity.set(city, new Map())
    const m = hoodsByCity.get(city)!
    m.set(hood, (m.get(hood) || 0) + 1)
  }
  const geo: LiveGeo = {
    cities: [...cityCount.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count),
    hoodsByCity,
  }
  cache = { at: Date.now(), geo }
  return geo
}
export function invalidateLiveGeo() { cache = null }

// محله‌های یک شهر: ادغامِ درختِ دستیِ geo (اول) + محله‌های دیده‌شده در آگهی‌های واقعی (به‌ترتیبِ فراوانی).
export async function hoodsForCity(cityName: string): Promise<string[]> {
  const city = norm(cityName)
  if (!city) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of getAll()) for (const c of p.cities || []) {
    if (norm(c.name) !== city) continue
    for (const d of c.districts || []) for (const h of d.neighborhoods || []) { const n = norm(h); if (n && !seen.has(n)) { seen.add(n); out.push(n) } }
  }
  const live = await liveGeo()
  const fromListings = [...(live.hoodsByCity.get(city) || new Map()).entries()].sort((a, b) => b[1] - a[1])
  for (const [h] of fromListings) if (!seen.has(h)) { seen.add(h); out.push(h) }
  return out.slice(0, 400)
}

// همهٔ شهرها برای دراپ‌داون: شهرهای درختِ geo + شهرهای دارای آگهیِ واقعی (≥۲ آگهی، ضدِ نویز).
export async function citiesList(): Promise<string[]> {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of getAll()) for (const c of p.cities || []) { const n = norm(c.name); if (n && !seen.has(n)) { seen.add(n); out.push(n) } }
  const live = await liveGeo()
  for (const { city, count } of live.cities) if (count >= 2 && !seen.has(city)) { seen.add(city); out.push(city) }
  return out.slice(0, 500)
}
