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

// نامِ استانِ هر گروه از رویِ مرکزِ استانش پیدا می‌شود (نگاشتِ جغرافیاییِ واقعیِ ۳۱ مرکزِ استان).
const PROVINCE_CAPITALS: Record<string, string> = {
  'تهران': 'تهران', 'کرج': 'البرز', 'اصفهان': 'اصفهان', 'مشهد': 'خراسان رضوی', 'شیراز': 'فارس',
  'تبریز': 'آذربایجان شرقی', 'ارومیه': 'آذربایجان غربی', 'اهواز': 'خوزستان', 'رشت': 'گیلان',
  'ساری': 'مازندران', 'کرمان': 'کرمان', 'یزد': 'یزد', 'قم': 'قم', 'همدان': 'همدان',
  'کرمانشاه': 'کرمانشاه', 'سنندج': 'کردستان', 'اردبیل': 'اردبیل', 'زنجان': 'زنجان', 'قزوین': 'قزوین',
  'گرگان': 'گلستان', 'خرمآباد': 'لرستان', 'اراک': 'مرکزی', 'ایلام': 'ایلام', 'بوشهر': 'بوشهر',
  'بندرعباس': 'هرمزگان', 'زاهدان': 'سیستان و بلوچستان', 'بیرجند': 'خراسان جنوبی',
  'بجنورد': 'خراسان شمالی', 'سمنان': 'سمنان', 'شهرکرد': 'چهارمحال و بختیاری', 'یاسوج': 'کهگیلویه و بویراحمد',
}
const normCap = (s: string) => String(s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()

// درختِ کاملِ استان→شهرِ کلِ ایران از دیوار (مثلاً مازندران ~۷۰ شهر).
// شکلِ واقعیِ پاسخِ ‎/v8/places/cities‎ (از عیب‌یابیِ روی سرور): هر شهر «parent» عددی دارد
// (تهران → parent:904) ولی نامِ استان در پاسخ نیست → شهرها با parent گروه‌بندی می‌شوند و
// نامِ استانِ هر گروه از مرکزِ استانِ همان گروه درمی‌آید (ساری در گروه ⇒ کلِ گروه = مازندران).
export async function importCitiesTree(): Promise<{ provinces: number; cities: number; note?: string; sample?: unknown }> {
  const res = await proxiedRequest('https://api.divar.ir/v8/places/cities', { method: 'GET', headers, proxyUrl: proxy(), timeout: 25000 })
  if (res.status !== 200) throw new Error(`Divar HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const raw: any[] = Array.isArray(d) ? d : (d.cities || d.data || [])
  // اگر خودِ والدها (استان‌ها، level≠place2) هم در پاسخ باشند، نامشان مستقیم استفاده می‌شود.
  const parentName = new Map<number, string>()
  for (const c of raw) {
    const lvl = String(c.level || '')
    if (lvl && lvl !== 'place2') {
      const id = Number(c.id), name = String(c.name || c.title || '').trim()
      if (id && name) parentName.set(id, name)
    }
  }
  const items = raw
    .map((c: any) => ({ id: Number(c.id), name: String(c.name || c.title || '').trim(), slug: c.slug || '', parent: Number(c.parent) || 0, level: String(c.level || '') }))
    .filter(c => c.id && c.name && (!c.level || c.level === 'place2'))
  // گروه‌بندی با parent → نامِ استان از مرکزِ استانِ گروه
  const groupProvince = new Map<number, string>()
  for (const c of items) {
    if (!c.parent || groupProvince.has(c.parent)) continue
    const direct = parentName.get(c.parent)
    if (direct) { groupProvince.set(c.parent, direct); continue }
    // در همین گروه دنبالِ مرکزِ استان بگرد
    const cap = items.find(x => x.parent === c.parent && PROVINCE_CAPITALS[normCap(x.name)])
    if (cap) groupProvince.set(c.parent, PROVINCE_CAPITALS[normCap(cap.name)])
  }
  const cities: DivarCity[] = items.map(c => ({ id: c.id, name: c.name, slug: c.slug, province: c.parent ? groupProvince.get(c.parent) : undefined }))
  const db = load()
  db.cities = cities
  db.importedAt = Date.now()
  save(db)
  const withProv = cities.filter(c => c.province).length
  const orphan = cities.length - withProv
  return {
    provinces: new Set(cities.map(c => c.province).filter(Boolean)).size,
    cities: cities.length,
    note: withProv === 0
      ? 'استانِ هیچ شهری تشخیص داده نشد — نمونهٔ خام را بفرست'
      : orphan > 0 ? `${orphan.toLocaleString('fa-IR')} شهر بدونِ استان ماند (گروهِ بدونِ مرکزِ استان)` : undefined,
    sample: withProv === 0 ? raw[0] : undefined,
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
