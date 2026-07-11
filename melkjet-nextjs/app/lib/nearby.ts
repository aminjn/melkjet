import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'
import { aiFor, agentModel } from './gapgpt'
const { chatCompleteSafe } = aiFor('دسترسی‌های اطراف')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// همهٔ تماس‌های نشان از DNS شکن داخل برنامه عبور می‌کنند (مثل GapGPT) تا مستقل از
// resolv.conf سرور همیشه به api.neshan.org برسند.
async function neshanGet(url: string, key: string, timeout = 8000): Promise<{ status: number; json: any }> {
  const r = await shecanRequest(url, { method: 'GET', headers: { 'Api-Key': key, accept: 'application/json' }, timeout })
  let json: any = null
  try { json = JSON.parse(r.body) } catch {}
  return { status: r.status, json }
}

// مختصات → شهر/محله (با Neshan reverse). برای تشخیصِ خودکارِ منطقهٔ کاربر.
export async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; neighborhood?: string; address?: string } | null> {
  const nz = getAdminData().neshan
  // ترجیحِ کلیدِ سرویس (service.…) — سرویس‌های REST با کلیدِ وب کار نمی‌کنند (خودترمیمِ جابه‌جایی، فاز ۳۰)
  const key = [nz?.serviceKey, nz?.mapKey].find(k => k && !/^web\./i.test(k)) || nz?.serviceKey || nz?.mapKey
  if (!key) return null
  try {
    const { status, json } = await neshanGet(`https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`, key)
    if (status !== 200 || !json) return null
    return {
      city: json.city || json.county || undefined,
      neighborhood: json.neighbourhood || json.neighborhood || undefined,
      address: json.formatted_address || undefined,
    }
  } catch { return null }
}

const CATEGORIES: { type: string; term: string }[] = [
  { type: 'مترو', term: 'ایستگاه مترو' },
  { type: 'بیمارستان', term: 'بیمارستان' },
  { type: 'پارک', term: 'بوستان' },
  { type: 'مدرسه', term: 'مدرسه' },
  { type: 'مرکز خرید', term: 'مرکز خرید' },
  { type: 'بانک', term: 'بانک' },
  { type: 'داروخانه', term: 'داروخانه' },
  { type: 'اتوبوس', term: 'ایستگاه اتوبوس' },
]

function fa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function nearestPlace(key: string, term: string, lat: number, lng: number) {
  const { status, json: d } = await neshanGet(`https://api.neshan.org/v1/search?term=${encodeURIComponent(term)}&lat=${lat}&lng=${lng}`, key)
  if (status !== 200 || !d) return null
  let best: { name: string; lat: number; lng: number; km: number } | null = null
  for (const it of (d.items || []).slice(0, 10)) {
    const y = it.location?.y, x = it.location?.x
    if (typeof y !== 'number' || typeof x !== 'number') continue
    const km = haversine(lat, lng, y, x)
    if (!best || km < best.km) best = { name: it.title || term, lat: y, lng: x, km }
  }
  return best
}

// از بین کلیدهای موجود (سرویس و نقشه) کلیدی را پیدا کن که مجوز Search دارد
async function pickSearchKey(keys: string[], lat: number, lng: number): Promise<string | null> {
  for (const k of keys) {
    try {
      const { status } = await neshanGet(`https://api.neshan.org/v1/search?term=${encodeURIComponent('بانک')}&lat=${lat}&lng=${lng}`, k)
      if (status === 200) return k
    } catch { /* try next */ }
  }
  return null
}

async function routeMatrix(key: string, lat: number, lng: number, dests: { lat: number; lng: number }[]) {
  const origins = `${lat},${lng}`
  const destinations = dests.map(d => `${d.lat},${d.lng}`).join('|')
  const { status, json: d } = await neshanGet(`https://api.neshan.org/v1/distance-matrix?type=car&origins=${origins}&destinations=${encodeURIComponent(destinations)}`, key)
  if (status !== 200 || !d) return null
  return d.rows?.[0]?.elements || null
}

export interface NearbyResult { nearby: { type?: string; name?: string; time: string; meters?: number }[]; source: string; note?: string }

// دسترسی‌های واقعی اطراف یک نقطه — فقط از سرویس داخلی نشان (سرور آروان اینترنت
// بین‌الملل ندارد). اگر سرویس Search روی کلید نبود، از reverse + geocoding +
// distance-matrix (که کلید دارد) استفاده می‌کنیم: نام مکان‌ها را AI پیشنهاد می‌دهد
// ولی هر مکان با geocoding نشان «اعتبارسنجی و مکان‌یابی» می‌شود (پس fake نمی‌ماند).
// کشِ «دسترسی‌های اطراف»: POIهای اطرافِ یک نقطه تغییر نمی‌کنند، ولی هر بازدیدِ صفحهٔ ملک
// تا ۸ کوئریِ Neshan + ماتریسِ فاصله (یا مسیرِ کندِ AI) می‌زد و درخواستِ Next را ۱۰-۳۰ث نگه
// می‌داشت → از عواملِ ۵۰۴. کش (کلید: مختصاتِ گردشده ~۱۰۰م، TTL ۶ ساعت) این بار را حذف می‌کند.
const nearbyCache = new Map<string, { at: number; data: NearbyResult }>()
const NEARBY_TTL = 6 * 3600 * 1000

export async function computeNearby(lat: number, lng: number): Promise<NearbyResult> {
  const ck = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const hit = nearbyCache.get(ck)
  if (hit && Date.now() - hit.at < NEARBY_TTL) return hit.data
  const data = await computeNearbyUncached(lat, lng)
  // فقط نتیجهٔ واقعی را کش کن (نه خطا/خالی) تا دفعهٔ بعد دوباره تلاش شود.
  if (data.nearby && data.nearby.length) {
    if (nearbyCache.size > 2000) nearbyCache.clear()
    nearbyCache.set(ck, { at: Date.now(), data })
  }
  return data
}

async function computeNearbyUncached(lat: number, lng: number): Promise<NearbyResult> {
  const nz = getAdminData().neshan
  const keys = Array.from(new Set([nz?.serviceKey, nz?.mapKey].filter(Boolean) as string[]))
  if (!keys.length) return { nearby: [], source: 'none', note: 'کلید نشان تنظیم نشده است.' }

  // مسیر اول: اگر کلیدی مجوز Search داشت، دقیق‌ترین حالت
  const searchKey = await pickSearchKey(keys, lat, lng)
  if (searchKey) {
    const places = (await Promise.all(CATEGORIES.map(async (c) => {
      try {
        const p = await nearestPlace(searchKey, c.term, lat, lng)
        if (!p || p.km > 8) return null
        return { type: c.type, name: p.name, lat: p.lat, lng: p.lng, km: p.km }
      } catch { return null }
    }))).filter(Boolean) as Located[]
    if (places.length) return await withTimes(searchKey, lat, lng, places, 'neshan')
  }

  // مسیر دوم (وقتی Search نبود): reverse → نام‌های واقعی با AI → geocoding اعتبارسنجی → matrix
  const key = keys[0]
  return await aiGroundedNearby(key, lat, lng)
}

interface Located { type: string; name: string; lat: number; lng: number; km: number }

// زمان واقعی هر مقصد را با distance-matrix می‌گیرد و خروجی نهایی را می‌سازد
async function withTimes(key: string, lat: number, lng: number, places: Located[], source: string): Promise<NearbyResult> {
  let elements: any[] | null = null
  try { elements = await routeMatrix(key, lat, lng, places.map(p => ({ lat: p.lat, lng: p.lng }))) } catch { /* تخمین زیر */ }
  const nearby = places.map((p, i) => {
    const el = elements?.[i]
    const ok = el && String(el.status).toLowerCase() === 'ok'
    const meters = ok ? Number(el.distance?.value) : Math.round(p.km * 1000 * 1.3)
    const carSec = ok ? Number(el.duration?.value) : null
    let time: string
    if (meters <= 1000) time = `${fa(Math.max(1, Math.round(meters / 80)))} دقیقه پیاده`
    else if (carSec) time = `${fa(Math.max(1, Math.round(carSec / 60)))} دقیقه با ماشین`
    else time = `${fa(Math.max(1, Math.round((p.km * 1.3 / 26) * 60)))} دقیقه با ماشین`
    return { type: p.type, name: p.name, time, meters }
  }).sort((a, b) => a.meters - b.meters)
  return { nearby, source }
}

// reverse geocoding → نام محله و شهر
async function neshanReverse(key: string, lat: number, lng: number): Promise<{ area: string; city: string }> {
  try {
    const { status, json } = await neshanGet(`https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`, key)
    if (status === 200 && json) {
      const nb = json.neighbourhood || json.district || ''
      const city = json.city || json.county || 'تهران'
      return { area: [nb, city].filter(Boolean).join('، ') || city, city }
    }
  } catch {}
  return { area: 'تهران', city: 'تهران' }
}

// geocoding: تبدیل یک آدرس متنی به مختصات (سرویسی که کلید دارد)
async function neshanGeocode(key: string, address: string): Promise<{ lat: number; lng: number } | null> {
  for (const url of [
    `https://api.neshan.org/geocoding/v1?address=${encodeURIComponent(address)}`,
    `https://api.neshan.org/v4/geocoding?address=${encodeURIComponent(address)}`,
  ]) {
    try {
      const { status, json } = await neshanGet(url, key)
      if (status !== 200 || !json) continue
      const loc = json.location || json.items?.[0]?.location || json.results?.[0]?.location
      const y = loc?.y ?? loc?.latitude, x = loc?.x ?? loc?.longitude
      if (typeof y === 'number' && typeof x === 'number') return { lat: y, lng: x }
    } catch {}
  }
  return null
}

const AI_SYS = `تو متخصص جغرافیای شهری ایران هستی. برای یک محله، نزدیک‌ترین و معروف‌ترین مکان‌های واقعی همان محله را نام ببر که حتماً وجود دارند و روی نقشه قابل جستجو هستند. فقط یک آرایهٔ JSON برگردان (بدون توضیح):
[{"type":"مترو","name":"ایستگاه مترو ..."},{"type":"بیمارستان","name":"بیمارستان ..."},{"type":"پارک","name":"بوستان ..."},{"type":"مرکز خرید","name":"..."},{"type":"بانک","name":"..."},{"type":"داروخانه","name":"داروخانه ..."},{"type":"مدرسه","name":"..."},{"type":"دانشگاه","name":"..."}]
name باید نام دقیق و واقعی مکان باشد (نه عمومی). فقط مکان‌هایی که واقعاً نزدیک همان محله‌اند.`

// مسیر دوم: نام‌ها از AI، اعتبارسنجی و مکان‌یابی با geocoding نشان، زمان با matrix
async function aiGroundedNearby(key: string, lat: number, lng: number): Promise<NearbyResult> {
  const { area } = await neshanReverse(key, lat, lng)
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  if (!model) return { nearby: [], source: 'neshan', note: 'برای دسترسی‌ها به مدل AI نیاز است (پنل → API و مدل‌های AI).' }

  let cands: { type: string; name: string }[] = []
  try {
    let out = await chatCompleteSafe(model, [{ role: 'system', content: AI_SYS }, { role: 'user', content: `محله: ${area}` }], { temperature: 0.4, max_tokens: 500 })
    const m = out.match(/\[[\s\S]*\]/); if (m) out = m[0]
    cands = JSON.parse(out)
  } catch { /* parse failed */ }
  if (!Array.isArray(cands) || !cands.length) return { nearby: [], source: 'neshan', note: 'فهرست دسترسی‌ها ساخته نشد.' }

  // هر نام را geocode کن؛ فقط مواردی که نشان پیدا کرد و نزدیک ملک‌اند بمانند
  const located: Located[] = []
  for (const c of cands.slice(0, 10)) {
    if (!c?.name) continue
    const g = await neshanGeocode(key, `${c.name}، ${area}`)
    if (!g) continue
    const km = haversine(lat, lng, g.lat, g.lng)
    if (km > 7) continue
    located.push({ type: c.type || 'مکان', name: c.name, lat: g.lat, lng: g.lng, km })
  }
  if (!located.length) return { nearby: [], source: 'neshan', note: 'مکان نزدیکی پیدا/تأیید نشد.' }
  return await withTimes(key, lat, lng, located, 'neshan-geocoded')
}
