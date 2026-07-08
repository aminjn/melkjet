// جغرافیای زنده از آگهی‌های واقعی — مکملِ درختِ دستیِ geo-store.
// مشکل: لیستِ محلاتِ شهرهای غیرتهران در geo تقریباً خالی است؛ ولی خودِ آگهی‌ها (location = «شهر، محله»)
// هزاران جفتِ واقعیِ شهر/محله دارند. اینجا همان را استخراج و کش می‌کنیم تا:
//   • دراپ‌داونِ «مناطقِ فعالیت/محله» در پروفایل‌ها همیشه کامل باشد (خودگسترنده با رشدِ آگهی‌ها)
//   • ادمین با یک کلیک درختِ geo را از دادهٔ واقعی تکمیل کند (enrich)
import { candidateListings, type Item } from './scraper-store'
import { getAll } from './geo-store'
import { getCities as divarCitiesRaw, getDistricts as divarDistricts } from './divar-places'

// تطبیقِ نامِ فارسی (حذف ZWNJ/فاصله + یکسان‌سازی ی/ک) — همان قراردادِ geo-store.
const normFa = (s: string) => String(s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()

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

// محلاتِ رسمیِ دیوار برای یک شهر (اگر ادمین «دریافت از دیوار» را زده باشد) — کامل‌ترین منبعِ کلِ ایران.
export function divarHoodsFor(cityName: string): string[] {
  const key = normFa(cityName)
  if (!key) return []
  const c = divarCitiesRaw().find(x => normFa(x.name) === key)
  if (!c) return []
  return divarDistricts(c.id).map(d => String(d.name || '').trim()).filter(Boolean)
}

// محله‌های یک شهر: درختِ دستیِ geo (اول) + محلاتِ رسمیِ دیوار (کامل — مثلاً «جنت‌آباد شمالی») +
// محله‌های دیده‌شده در آگهی‌های واقعی (به‌ترتیبِ فراوانی). تکراری‌ها با تطبیقِ فارسی حذف می‌شوند.
export async function hoodsForCity(cityName: string): Promise<string[]> {
  const city = norm(cityName)
  if (!city) return []
  const out: string[] = []
  const seen = new Set<string>()
  const push = (h: string) => { const n = norm(h); const k = normFa(n); if (n && k && !seen.has(k)) { seen.add(k); out.push(n) } }
  for (const p of getAll()) for (const c of p.cities || []) {
    if (normFa(c.name) !== normFa(city)) continue
    for (const d of c.districts || []) for (const h of d.neighborhoods || []) push(h)
  }
  for (const h of divarHoodsFor(city)) push(h)
  const live = await liveGeo()
  const fromListings = [...(live.hoodsByCity.get(city) || new Map()).entries()].sort((a, b) => b[1] - a[1])
  for (const [h] of fromListings) push(h)
  return out.slice(0, 600)
}

// همهٔ شهرها برای دراپ‌داون: درختِ geo + شهرهای دیوار (کلِ ایران، اگر ایمپورت شده) + شهرهای دارای آگهیِ واقعی.
export async function citiesList(): Promise<string[]> {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (c: string) => { const n = norm(c); const k = normFa(n); if (n && k && !seen.has(k)) { seen.add(k); out.push(n) } }
  for (const p of getAll()) for (const c of p.cities || []) push(c.name)
  for (const c of divarCitiesRaw()) push(c.name)
  const live = await liveGeo()
  for (const { city, count } of live.cities) if (count >= 2) push(city)
  return out.slice(0, 2000)
}
