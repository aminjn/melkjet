// فاز ۲۳۴ — سامانهٔ نقشهٔ اختصاصیِ ملک‌جت (جایگزینِ کاملِ نشان، به دستورِ کاربر).
// یک کلاینتِ واحد برای همهٔ اندپوینت‌ها: geocode / reverse / search (شعاعی!) / matrix /
// staticmap / tiles. آدرسِ سرویس و کلید knob زنده در سوپرادمین‌اند (اتصال‌ها → سامانهٔ نقشه).
// کلید هم در کوئری (key=) و هم در هدرها (Api-Key / X-API-Key) فرستاده می‌شود تا با هر
// قراردادِ احرازِ سرویس کار کند؛ سرور فیلدهای اضافه را نادیده می‌گیرد.

import { getAdminData } from './admin-store'

export function geoApiCfg(): { baseUrl: string; apiKey: string } {
  const g = (getAdminData() as { geoApi?: { baseUrl?: string; apiKey?: string } }).geoApi || {}
  // مقاوم در برابرِ هر شکلی از ورودیِ ذخیره‌شده: بدونِ https → اضافه؛ «/v1» یا «/» انتهایی → حذف
  // (مسیرها خودشان /v1/… دارند؛ آدرسِ ذخیره‌شدهٔ «nexamap.ir/v1» درخواست را به /v1/v1 می‌برد).
  let baseUrl = String(g.baseUrl || '').trim()
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) baseUrl = 'https://' + baseUrl
  baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '')
  return { baseUrl, apiKey: String(g.apiKey || '').trim() }
}
export function geoApiEnabled(): boolean { return !!geoApiCfg().baseUrl }

async function call(path: string, opts?: { method?: string; body?: unknown; timeoutMs?: number }): Promise<{ status: number; json: any }> {
  const { baseUrl, apiKey } = geoApiCfg()
  if (!baseUrl) return { status: 0, json: null }
  const sep = path.includes('?') ? '&' : '?'
  const url = `${baseUrl}${path}${apiKey ? `${sep}key=${encodeURIComponent(apiKey)}` : ''}`
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts?.timeoutMs || 8000)
  try {
    const r = await fetch(url, {
      method: opts?.method || 'GET',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { 'Api-Key': apiKey, 'X-API-Key': apiKey } : {}),
        ...(opts?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal,
    })
    let json: any = null
    try { json = await r.json() } catch {}
    return { status: r.status, json }
  } catch {
    return { status: 0, json: null }
  } finally { clearTimeout(timer) }
}

export interface GeoPoint { lat: number; lng: number }

/** پروبِ دیباگ: وضعیتِ HTTP و تکهٔ پاسخِ هر سرویس — تا «چرا»ی خطا دیده شود، نه فقط ✗. */
export async function geoDebugProbe(): Promise<{ name: string; status: number; snippet: string }[]> {
  const probes: [string, string][] = [
    ['geocode', `/v1/geocode?address=${encodeURIComponent('تهران ونک')}`],
    ['reverse', '/v1/reverse?lat=35.7575&lng=51.41'],
    ['search', `/v1/search?lat=35.7575&lng=51.41&radius=1000&limit=2`],
  ]
  return Promise.all(probes.map(async ([name, path]) => {
    const { status, json } = await call(path, { timeoutMs: 8000 })
    return { name, status, snippet: JSON.stringify(json)?.slice(0, 140) || '' }
  }))
}

/** آدرسِ آزادِ فارسی → مختصات (v1/geocode). null = پیدا نشد/سرویس در دسترس نیست. */
export async function geoGeocode(address: string, timeoutMs = 6000): Promise<(GeoPoint & { formatted?: string; confidence?: number }) | null> {
  const q = (address || '').trim()
  if (q.length < 2) return null
  const { status, json } = await call(`/v1/geocode?address=${encodeURIComponent(q)}`, { timeoutMs })
  const r0 = json?.results?.[0]
  const lat = Number(r0?.location?.lat), lng = Number(r0?.location?.lng)
  if (status !== 200 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) < 0.1) return null
  return { lat, lng, formatted: r0?.formatted_address || undefined, confidence: typeof r0?.confidence === 'number' ? r0.confidence : undefined }
}

/** نقطه → آدرس (v1/reverse). اجزای آدرس با نام‌های آشنای سایت برمی‌گردد. */
export async function geoReverse(lat: number, lng: number, timeoutMs = 6000): Promise<{ province?: string; city?: string; district?: string; neighbourhood?: string; address?: string } | null> {
  const { status, json } = await call(`/v1/reverse?lat=${lat}&lng=${lng}`, { timeoutMs })
  const r0 = json?.results?.[0]
  if (status !== 200 || !r0) return null
  const c = r0.components || {}
  return {
    province: c['استان'] || c.province || undefined,
    city: c['شهر'] || c.city || undefined,
    district: c['منطقه'] || c.district || undefined,
    neighbourhood: c['محله'] || c.neighbourhood || c.neighborhood || undefined,
    address: r0.formatted_address || undefined,
  }
}

/** جستجوی POI — متنی و/یا شعاعی (v1/search). q خالی = همهٔ مکان‌های داخلِ شعاع. */
export async function geoSearch(q: string, opts?: { lat?: number; lng?: number; radius?: number; limit?: number; timeoutMs?: number }): Promise<{ name: string; type: string; lat: number; lng: number; distanceM?: number }[]> {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (opts?.lat !== undefined && opts?.lng !== undefined) { p.set('lat', String(opts.lat)); p.set('lng', String(opts.lng)) }
  if (opts?.radius) p.set('radius', String(opts.radius))
  p.set('limit', String(opts?.limit || 15))
  const { status, json } = await call(`/v1/search?${p}`, { timeoutMs: opts?.timeoutMs || 6000 })
  if (status !== 200 || !Array.isArray(json?.results)) return []
  return json.results
    .map((r: any) => ({
      name: String(r.name || '').trim(),
      type: String(r.category?.title || (Array.isArray(r.category?.path) ? r.category.path[r.category.path.length - 1] : r.category?.id) || '').trim(),
      lat: Number(r.location?.lat), lng: Number(r.location?.lng),
      distanceM: typeof r.distance_m === 'number' ? r.distance_m : undefined,
    }))
    .filter((r: any) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
}

/** ماتریسِ زمان/مسافت (v1/matrix). durations بر حسبِ ثانیه. */
export async function geoMatrix(sources: GeoPoint[], destinations: GeoPoint[], mode = 'pedestrian', timeoutMs = 8000): Promise<{ durations: number[][]; distances: number[][] } | null> {
  if (!sources.length || !destinations.length) return null
  const { status, json } = await call('/v1/matrix', { method: 'POST', body: { sources, destinations, mode }, timeoutMs })
  if (status !== 200 || !Array.isArray(json?.durations)) return null
  return { durations: json.durations, distances: Array.isArray(json?.distances) ? json.distances : [] }
}

/** الگوی URLِ کاشی برای نقشهٔ تعاملی (Leaflet). null = پیکربندی نشده. */
export function geoTileTemplate(): string | null {
  const { baseUrl, apiKey } = geoApiCfg()
  if (!baseUrl) return null
  return `${baseUrl}/v1/tiles/{z}/{x}/{y}.png?style=day${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`
}

/** URLِ نقشهٔ ثابت (v1/staticmap) — سمتِ سرور صدا زده و پروکسی می‌شود تا کلید نشت نکند. */
export function geoStaticMapUrl(q: { center: string; zoom: number; w: number; h: number; markers: [number, number][] }): string | null {
  const { baseUrl, apiKey } = geoApiCfg()
  if (!baseUrl) return null
  const p = new URLSearchParams({ center: q.center, zoom: String(q.zoom), width: String(q.w), height: String(q.h), format: 'png' })
  for (const [la, ln] of q.markers.slice(0, 25)) p.append('marker', `color:red|${la},${ln}`)
  if (apiKey) p.set('key', apiKey)
  return `${baseUrl}/v1/staticmap?${p}`
}
