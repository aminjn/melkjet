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
