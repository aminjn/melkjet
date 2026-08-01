import { aiFor, agentModel } from './gapgpt'
import { geoApiEnabled, geoReverse as gaReverse, geoGeocode, geoSearch, geoMatrix } from './geo-api'
const { chatCompleteSafe } = aiFor('دسترسی‌های اطراف')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// فاز ۲۳۴ — «دسترسی‌های اطراف» حالا کاملاً روی سامانهٔ نقشهٔ اختصاصی است (نشان حذف شد، به دستورِ
// کاربر). مسیرِ اصلی: جستجوی «شعاعی» واقعی (v1/search با radius — چیزی که پلنِ نشان نداشت) →
// مکان‌های واقعی داخلِ ۱ کیلومتر با فاصلهٔ واقعی. مسیرِ پشتیبان (دیتای POI هنوز کم بود):
// reverse → نام‌ها از AI → اعتبارسنجی با geocode → همان قانونِ صادقانهٔ ۱کیلومتر/حدنصاب.

// مختصات → شهر/محله. برای تشخیصِ خودکارِ منطقهٔ کاربر.
export async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; neighborhood?: string; address?: string } | null> {
  if (!geoApiEnabled()) return null
  const r = await gaReverse(lat, lng)
  if (!r) return null
  return { city: r.city || undefined, neighborhood: r.neighbourhood || undefined, address: r.address || undefined }
}

function fa(n: number | string): string { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface NearbyResult { nearby: { type?: string; name?: string; time: string; meters?: number }[]; source: string; note?: string }

// نسخهٔ منطقِ nearby — هر تغییرِ معنادار (فاز ۲۱۳: شعاعِ سفت؛ فاز ۲۴۶: فیلترِ واحدهای اداری +
// دستهٔ فارسی) این عدد را بالا می‌برد تا کش‌های enrichِ قدیمی خودکار بازنشسته و بازسازی شوند.
export const NEARBY_V = 3

// فاز ۲۴۶ — جستجوی شعاعیِ سامانه «مرزهای اداری» (استان/شهرستان/بخش/شهر/منطقه/محله) را هم به‌عنوانِ
// «مکان» برمی‌گرداند («استان تهران · ۴۴ دقیقه پیاده»!) و دستهٔ بعضی POIها برچسبِ خامِ انگلیسی دارد
// (health_food, optician, county…). این دو خالص و تست‌پذیرند:
const ADMIN_CAT_RE = /^(country|province|state|county|city|town|village|hamlet|district|region|municipality|suburb|neighbou?rhood|quarter|borough|locality|place|administrative|postcode)$/i
const ADMIN_FA = new Set(['کشور', 'استان', 'شهرستان', 'بخش', 'شهر', 'منطقه', 'ناحیه', 'محله', 'روستا', 'دهستان', 'آبادی'])
const ADMIN_NAME_RE = /^(استان|شهرستان|بخش|دهستان|ناحیه)\s|^منطقه\s*[\d۰-۹]|^شهر\s/
/** آیا این نتیجه یک «واحدِ اداری» است نه یک مکانِ واقعیِ قابلِ رفتن؟ */
export function isAdminPlace(p: { name?: string; type?: string; categoryId?: string }): boolean {
  const t = (p.type || '').trim(), cid = (p.categoryId || '').trim()
  if (ADMIN_CAT_RE.test(t) || ADMIN_CAT_RE.test(cid) || ADMIN_FA.has(t)) return true
  return ADMIN_NAME_RE.test((p.name || '').trim())
}

// دسته‌های رایجِ OSM → فارسی؛ برچسبِ فارسیِ خودِ سامانه دست‌نخورده می‌ماند؛ ناشناسِ انگلیسی → «مکان».
const CAT_FA: Record<string, string> = {
  supermarket: 'سوپرمارکت', convenience: 'سوپرمارکت', kiosk: 'دکه', marketplace: 'بازار', mall: 'مرکز خرید',
  dairy: 'لبنیات‌فروشی', health_food: 'مواد غذایی', greengrocer: 'میوه‌فروشی', butcher: 'قصابی', bakery: 'نانوایی',
  confectionery: 'شیرینی‌فروشی', ice_cream: 'بستنی‌فروشی', seafood: 'ماهی‌فروشی', deli: 'اغذیه', beverages: 'نوشیدنی',
  pharmacy: 'داروخانه', chemist: 'بهداشتی', optician: 'عینک‌سازی', hospital: 'بیمارستان', clinic: 'کلینیک',
  doctors: 'مطب', dentist: 'دندان‌پزشکی', veterinary: 'دامپزشکی',
  school: 'مدرسه', kindergarten: 'مهدکودک', university: 'دانشگاه', college: 'آموزشگاه', library: 'کتابخانه',
  mosque: 'مسجد', place_of_worship: 'مکانِ مذهبی', church: 'کلیسا',
  park: 'پارک', playground: 'زمینِ بازی', garden: 'بوستان', sports_centre: 'مجموعهٔ ورزشی', fitness_centre: 'باشگاه',
  gym: 'باشگاه', swimming_pool: 'استخر', stadium: 'ورزشگاه',
  bank: 'بانک', atm: 'خودپرداز', post_office: 'دفترِ پستی', police: 'کلانتری', fire_station: 'آتش‌نشانی',
  fuel: 'پمپ بنزین', car_wash: 'کارواش', car_repair: 'تعمیرگاه', parking: 'پارکینگ',
  restaurant: 'رستوران', fast_food: 'فست‌فود', cafe: 'کافه', tea: 'چایخانه',
  bus_station: 'پایانهٔ اتوبوس', bus_stop: 'ایستگاه اتوبوس', station: 'ایستگاه مترو', subway: 'ایستگاه مترو',
  subway_entrance: 'ورودی مترو', taxi: 'ایستگاه تاکسی',
  hairdresser: 'آرایشگاه', beauty: 'سالنِ زیبایی', laundry: 'خشکشویی', dry_cleaning: 'خشکشویی', tailor: 'خیاطی',
  florist: 'گل‌فروشی', stationery: 'نوشت‌افزار', books: 'کتاب‌فروشی', toys: 'اسباب‌بازی‌فروشی',
  clothes: 'پوشاک', shoes: 'کفش‌فروشی', jewelry: 'طلا و جواهر', mobile_phone: 'موبایل‌فروشی', computer: 'کامپیوتر',
  electronics: 'لوازمِ الکترونیکی', hardware: 'ابزارفروشی', doityourself: 'ابزارفروشی', furniture: 'مبلمان',
  hotel: 'هتل', guest_house: 'مهمان‌پذیر', cinema: 'سینما', theatre: 'تئاتر', museum: 'موزه',
}
/** برچسبِ دسته → فارسیِ نمایشی. فارسیِ موجود می‌ماند؛ انگلیسیِ شناخته ترجمه؛ ناشناس «مکان». */
export function faPlaceType(type?: string, categoryId?: string): string {
  const t = (type || '').trim()
  if (t && /[؀-ۿ]/.test(t)) return t
  const k = (categoryId || t).trim().toLowerCase().replace(/[\s-]+/g, '_')
  return CAT_FA[k] || CAT_FA[t.toLowerCase().replace(/[\s-]+/g, '_')] || 'مکان'
}

// کشِ «دسترسی‌های اطراف»: POIهای اطرافِ یک نقطه تغییر نمی‌کنند (کلید: مختصاتِ گردشده ~۱۰۰م، TTL ۶ ساعت).
const nearbyCache = new Map<string, { at: number; data: NearbyResult }>()
const NEARBY_TTL = 6 * 3600 * 1000

export async function computeNearby(lat: number, lng: number): Promise<NearbyResult> {
  const ck = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const hit = nearbyCache.get(ck)
  if (hit && Date.now() - hit.at < NEARBY_TTL) return hit.data
  // فاز ۲۴۰ — کشِ مشترکِ Redis: در ۴+ اینستنس، هر نقطه یک‌بار محاسبه می‌شود نه یک‌بار per اینستنس.
  const { redisEnabled, rGet, rSetEx } = await import('./redis')
  if (redisEnabled()) {
    try {
      // فاز ۲۴۶: v2→v3 — کش‌های آلوده به «استان/شهر/محله» بازنشسته می‌شوند (بدونِ flushِ دستی)
      const cached = await rGet(`nearby:v3:${ck}`)
      if (cached) {
        const data = JSON.parse(cached) as NearbyResult
        if (data.nearby?.length) { nearbyCache.set(ck, { at: Date.now(), data }); return data }
      }
    } catch { /* miss */ }
  }
  const data = await computeNearbyUncached(lat, lng)
  // فقط نتیجهٔ واقعی را کش کن (نه خطا/خالی) تا دفعهٔ بعد دوباره تلاش شود.
  if (data.nearby && data.nearby.length) {
    if (nearbyCache.size > 2000) nearbyCache.clear()
    nearbyCache.set(ck, { at: Date.now(), data })
    if (redisEnabled()) rSetEx(`nearby:v3:${ck}`, NEARBY_TTL / 1000, JSON.stringify(data)).catch(() => {})
  }
  return data
}

async function computeNearbyUncached(lat: number, lng: number): Promise<NearbyResult> {
  if (!geoApiEnabled()) return { nearby: [], source: 'none', note: 'سامانهٔ نقشه تنظیم نشده است (ادمین → اتصال‌ها → سامانهٔ نقشه).' }

  // مسیرِ اصلی: جستجوی شعاعیِ واقعی — همهٔ مکان‌های داخلِ ۱ کیلومتر
  try {
    const found = await geoSearch('', { lat, lng, radius: 1000, limit: 24 })
    // فاز ۲۴۶: واحدهای اداری (استان/شهر/محله…) مکانِ «قابلِ رفتن» نیستند؛ دسته‌ها فارسیِ نمایشی.
    const places: Located[] = found.filter(f => !isAdminPlace(f)).map(f => ({
      type: faPlaceType(f.type, f.categoryId), name: f.name, lat: f.lat, lng: f.lng,
      km: typeof f.distanceM === 'number' ? f.distanceM / 1000 : haversine(lat, lng, f.lat, f.lng),
    }))
    const kept = keepVerifiedNearby(dedupByName(places), 1, 2).slice(0, 10)
    if (kept.length) return await withTimes(lat, lng, kept, 'geoapi')
  } catch { /* مسیرِ پشتیبان */ }

  // مسیرِ پشتیبان: دیتای POI سامانه هنوز برای این نقطه کم است → نام‌ها از AI + اعتبارسنجی با geocode
  return await aiGroundedNearby(lat, lng)
}

interface Located { type: string; name: string; lat: number; lng: number; km: number }

function dedupByName(places: Located[]): Located[] {
  const seen = new Set<string>()
  return places.filter(p => { const k = p.name.replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true })
}

// زمانِ واقعیِ هر مقصد با ماتریسِ پیاده (v1/matrix mode=pedestrian) — داخلِ ۱ کیلومتر یعنی پیاده.
async function withTimes(lat: number, lng: number, places: Located[], source: string): Promise<NearbyResult> {
  let durations: number[][] | null = null
  let distances: number[][] = []
  try {
    const m = await geoMatrix([{ lat, lng }], places.map(p => ({ lat: p.lat, lng: p.lng })), 'pedestrian')
    if (m) { durations = m.durations; distances = m.distances }
  } catch { /* تخمین زیر */ }
  const nearby = places.map((p, i) => {
    const distM = Number(distances?.[0]?.[i])
    const durS = Number(durations?.[0]?.[i])
    const meters = Number.isFinite(distM) && distM > 0 ? Math.round(distM) : Math.round(p.km * 1000 * 1.3)
    const time = Number.isFinite(durS) && durS > 0
      ? `${fa(Math.max(1, Math.round(durS / 60)))} دقیقه پیاده`
      : `${fa(Math.max(1, Math.round(meters / 80)))} دقیقه پیاده`
    return { type: p.type, name: p.name, time, meters }
  }).sort((a, b) => a.meters - b.meters)
  return { nearby, source }
}

// فاز ۲۰۹ — تشخیصِ فهرستِ «همه-دور»ِ کش‌شده (میراثِ شعاعِ شلِ قدیم؛ خالص و تست‌پذیر):
// با قانونِ ۱کیلومتر، هر کشی که «همهٔ» مواردش دورتر از ~۱.۶کیلومترِ مسیری است خراب حساب می‌شود.
export function isAllFarNearby(nearby?: { meters?: number }[] | null, maxMeters = 1600): boolean {
  return !!nearby?.length && nearby.every(n => typeof n.meters === 'number' && n.meters > maxMeters)
}

// فاز ۲۰۷ب/۲۰۸ (خواستِ صریحِ کاربر: «شعاع ۱ کیلومتر»): فقط مکان‌های واقعاً نزدیکِ تأییدشده؛
// اگر به حدنصاب نرسید، صادقانه هیچ — بهتر از فهرستِ مضحک. (خالص و تست‌پذیر)
export function keepVerifiedNearby<T extends { km: number }>(places: T[], maxKm = 1, minKeep = 2): T[] {
  const close = places.filter(p => p.km <= maxKm)
  return close.length >= minKeep ? close : []
}

const AI_SYS = `تو متخصص جغرافیای شهری ایران هستی. برای یک محله، نزدیک‌ترین مکان‌های واقعی «داخلِ خودِ همان محله، حداکثر در شعاعِ حدودِ یک کیلومتر» را نام ببر که حتماً وجود دارند و روی نقشه قابل جستجو هستند. مکان‌های معروفِ مرکزِ شهر یا محله‌های دور را هرگز نیاور (کاربر محلی است و متوجه می‌شود). فقط یک آرایهٔ JSON برگردان (بدون توضیح):
[{"type":"مترو","name":"ایستگاه مترو ..."},{"type":"بیمارستان","name":"بیمارستان ..."},{"type":"پارک","name":"بوستان ..."},{"type":"مرکز خرید","name":"..."},{"type":"بانک","name":"..."},{"type":"داروخانه","name":"داروخانه ..."},{"type":"مدرسه","name":"..."},{"type":"دانشگاه","name":"..."}]
name باید نام دقیق و واقعی مکان باشد (نه عمومی). فقط مکان‌هایی که واقعاً نزدیک همان محله‌اند.`

// مسیرِ پشتیبان: نام‌ها از AI، اعتبارسنجی و مکان‌یابی با geocodeِ سامانه، زمان با matrix.
async function aiGroundedNearby(lat: number, lng: number): Promise<NearbyResult> {
  const rev = await gaReverse(lat, lng)
  const city = rev?.city || 'تهران'
  const area = [rev?.neighbourhood, city].filter(Boolean).join('، ') || city
  const model = agentModel('pricing', 'text') || agentModel('content', 'text') || agentModel('chat', 'text')
  if (!model) return { nearby: [], source: 'geoapi', note: 'برای دسترسی‌ها به مدل AI نیاز است (پنل → API و مدل‌های AI).' }

  let cands: { type: string; name: string }[] = []
  try {
    let out = await chatCompleteSafe(model, [{ role: 'system', content: AI_SYS }, { role: 'user', content: `محله: ${area}` }], { temperature: 0.4, max_tokens: 500, timeoutMs: 30_000 })
    const m = out.match(/\[[\s\S]*\]/); if (m) out = m[0]
    cands = JSON.parse(out)
  } catch { /* parse failed */ }
  if (!Array.isArray(cands) || !cands.length) return { nearby: [], source: 'geoapi', note: 'فهرست دسترسی‌ها ساخته نشد.' }

  // فاز ۲۱۳: geocode با «نام، شهر» (نه محله — اعتبارسنجی دوری می‌شد)؛ فاز ۲۱۵: ۶ کاندیدِ موازی، تایم‌اوتِ کوتاه.
  const results = await Promise.all(cands.slice(0, 6).map(async (c) => {
    if (!c?.name) return null
    const g = await geoGeocode(`${c.name}، ${city}`, 5000)
    if (!g) return null
    const km = haversine(lat, lng, g.lat, g.lng)
    if (km > 7) return null
    return { type: c.type || 'مکان', name: c.name, lat: g.lat, lng: g.lng, km } as Located
  }))
  const located = results.filter(Boolean) as Located[]
  // فاز ۲۰۷ب: فقط واقعاً نزدیک‌ها و با حدنصاب — وگرنه صادقانه هیچ
  const kept = keepVerifiedNearby(located)
  if (!kept.length) return { nearby: [], source: 'geoapi', note: 'مکانِ نزدیکِ تأییدشده‌ای پیدا نشد.' }
  return await withTimes(lat, lng, kept, 'geoapi-grounded')
}
