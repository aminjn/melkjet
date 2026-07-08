import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

const DATA_FILE = join(process.cwd(), '.divar-places.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface DivarCity { id: number; name: string; slug: string; province?: string }
export interface DivarDistrict { id: number; name: string; slug: string; lat?: number; lng?: number }
interface PlacesDB { cities: DivarCity[]; districts: Record<string, DivarDistrict[]>; importedAt?: number }

function load(): PlacesDB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { cities: [], districts: {} }
}
function save(db: PlacesDB) { writeFileSync(DATA_FILE, JSON.stringify(db), 'utf-8') }

export function getCities(): DivarCity[] { return load().cities }
export function getDistricts(cityId: string | number): DivarDistrict[] { return load().districts[String(cityId)] || [] }
export function placesSummary() {
  const db = load()
  const loaded = Object.keys(db.districts).length
  const totalDistricts = Object.values(db.districts).reduce((a, l) => a + l.length, 0)
  return { cities: db.cities.length, citiesWithDistricts: loaded, totalDistricts, importedAt: db.importedAt }
}

function proxy() {
  return getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined
}
const headers = { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' }

// Fetch + store the full Divar cities list
export async function importCities(): Promise<{ count: number }> {
  const res = await proxiedRequest('https://api.divar.ir/v8/places/cities', { method: 'GET', headers, proxyUrl: proxy(), timeout: 20000 })
  if (res.status !== 200) throw new Error(`Divar HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const raw: any[] = Array.isArray(d) ? d : (d.cities || d.data || [])
  const cities: DivarCity[] = raw
    .map((c: any) => ({
      id: Number(c.id), name: c.name || c.title || '', slug: c.slug || '',
      // اگر پاسخِ دیوار استان را بدهد (province/parent/state)، نگه می‌داریم — برای ساختِ خودکارِ شهرهای غایب در درختِ geo.
      province: String(c.province?.name || c.province?.title || c.parent?.name || c.parent?.title || c.state?.name || '').trim() || undefined,
    }))
    .filter((c: DivarCity) => c.id && c.name)
  const db = load()
  db.cities = cities
  db.importedAt = Date.now()
  save(db)
  return { count: cities.length }
}

// درختِ کاملِ استان→شهرِ کلِ ایران از دیوار (مثلاً مازندران ~۷۰ شهر).
// چند endpoint به‌ترتیب امتحان می‌شود؛ ذخیره تدریجی است تا قطعِ وسطِ کار داده را از دست ندهد.
// اگر هیچ‌کدام استان ندهد، نمونهٔ خامِ اولین شهر برگردانده می‌شود تا شکلِ پاسخ عیب‌یابی شود.
export async function importCitiesTree(): Promise<{ provinces: number; cities: number; note?: string; sample?: unknown }> {
  const tryJson = async (url: string) => {
    const r = await proxiedRequest(url, { method: 'GET', headers, proxyUrl: proxy(), timeout: 20000 }).catch(() => null)
    if (!r || r.status !== 200) return null
    try { return JSON.parse(r.body) } catch { return null }
  }
  const arr = (d: any, ...keys: string[]): any[] => {
    if (Array.isArray(d)) return d
    for (const k of keys) if (Array.isArray(d?.[k])) return d[k]
    return []
  }
  // ۱) استان‌ها → شهرهای هر استان
  for (const provUrl of ['https://api.divar.ir/v8/places/provinces', 'https://api.divar.ir/v8/places/states']) {
    const pd = await tryJson(provUrl)
    const provs = arr(pd, 'provinces', 'states', 'data')
      .map((p: any) => ({ id: Number(p.id), name: String(p.name || p.title || '').trim() }))
      .filter(p => p.id && p.name)
    if (!provs.length) continue
    const db = load()
    db.cities = []
    let citiesCount = 0
    for (const p of provs) {
      const cd = await tryJson(`${provUrl}/${p.id}/cities`)
      const raw = arr(cd, 'cities', 'data')
      for (const c of raw) {
        const id = Number(c.id), name = String(c.name || c.title || '').trim()
        if (id && name) { db.cities.push({ id, name, slug: c.slug || '', province: p.name }); citiesCount++ }
      }
      db.importedAt = Date.now()
      save(db)   // ذخیرهٔ تدریجی
      await new Promise(res => setTimeout(res, 150))
    }
    if (citiesCount) return { provinces: provs.length, cities: citiesCount }
  }
  // ۲) fallback: لیستِ تختِ شهرها (با پارسِ منعطفِ استان) + نمونهٔ خام برای عیب‌یابی
  const res = await proxiedRequest('https://api.divar.ir/v8/places/cities', { method: 'GET', headers, proxyUrl: proxy(), timeout: 20000 })
  if (res.status !== 200) throw new Error(`Divar HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const raw: any[] = arr(d, 'cities', 'data')
  const cities: DivarCity[] = raw.map((c: any) => ({
    id: Number(c.id), name: String(c.name || c.title || '').trim(), slug: c.slug || '',
    province: String(c.province?.name || c.province?.title || c.parent?.name || c.parent?.title || c.state?.name || '').trim() || undefined,
  })).filter(c => c.id && c.name)
  const db = load()
  db.cities = cities
  db.importedAt = Date.now()
  save(db)
  const withProv = cities.filter(c => c.province).length
  return {
    provinces: new Set(cities.map(c => c.province).filter(Boolean)).size, cities: cities.length,
    note: withProv ? undefined : 'پاسخِ دیوار استانِ شهرها را نمی‌دهد — نمونهٔ خام را بفرست تا endpoint درست ساخته شود',
    sample: withProv ? undefined : raw[0],
  }
}

// Fetch + store one city's districts
export async function importDistricts(cityId: number | string): Promise<{ count: number }> {
  const res = await proxiedRequest(`https://api.divar.ir/v8/places/cities/${cityId}/districts`, { method: 'GET', headers, proxyUrl: proxy(), timeout: 20000 })
  if (res.status !== 200) throw new Error(`Divar HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const raw: any[] = d.districts || d.data || []
  const districts: DivarDistrict[] = raw
    .map((x: any) => ({ id: Number(x.id), name: x.name || '', slug: x.slug || '', lat: x.centroid?.latitude, lng: x.centroid?.longitude }))
    .filter((x: DivarDistrict) => x.id && x.name)
  const db = load()
  db.districts[String(cityId)] = districts
  save(db)
  return { count: districts.length }
}
