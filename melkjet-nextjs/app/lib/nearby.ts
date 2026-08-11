import { geoApiEnabled, geoReverse as gaReverse, geoSearch } from './geo-api'

// فاز ۲۵۱ — «دسترسی‌های اطراف» حالا کاملاً و فقط روی NexaMap و دادهٔ واقعی است؛ هیچ AIای در کار نیست
// (به دستورِ صریحِ کاربر). روشِ درست: به‌جای «جستجوی شعاعیِ عبارتِ خالی» (که NexaMap برایش خالی
// برمی‌گرداند)، برای هر دستهٔ کاربردی (مترو، بیمارستان، پارک، سوپرمارکت…) یک جستجوی واقعیِ NexaMap
// می‌زنیم و نزدیک‌ترینِ هر دسته را با فاصله و زمانِ پیادهٔ واقعی نگه می‌داریم. مسیرِ AIِ قدیمی حذف شد.

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
// دستهٔ فارسی؛ فاز ۲۵۱: جستجوی دسته‌ایِ NexaMap و حذفِ AI) این عدد را بالا می‌برد تا کش‌ها بازسازی شوند.
export const NEARBY_V = 5

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
      // فاز ۲۵۱: v4→v5 — کش‌های ناقصِ روشِ قبلی (موازی/ماتریس) بازنشسته می‌شوند (بدونِ flushِ دستی)
      const cached = await rGet(`nearby:v5:${ck}`)
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
    if (redisEnabled()) rSetEx(`nearby:v5:${ck}`, NEARBY_TTL / 1000, JSON.stringify(data)).catch(() => {})
  }
  return data
}

// دسته‌های کاربردیِ «دسترسی‌های اطراف» — هرکدام یک جستجوی واقعیِ NexaMap (بدونِ AI). عبارتِ جستجو
// همان اصطلاحِ رایج است؛ برچسبِ نمایشیِ دسته کنارش. ترتیب = اولویتِ نمایش وقتی فاصله‌ها برابرند.
const NEARBY_CATEGORIES: { q: string; label: string }[] = [
  { q: 'ایستگاه مترو', label: 'مترو' },
  { q: 'ایستگاه اتوبوس', label: 'ایستگاه اتوبوس' },
  { q: 'بیمارستان', label: 'بیمارستان' },
  { q: 'داروخانه', label: 'داروخانه' },
  { q: 'پارک', label: 'پارک' },
  { q: 'سوپرمارکت', label: 'سوپرمارکت' },
  { q: 'نانوایی', label: 'نانوایی' },
  { q: 'بانک', label: 'بانک' },
  { q: 'مدرسه', label: 'مدرسه' },
  { q: 'مرکز خرید', label: 'مرکز خرید' },
  { q: 'رستوران', label: 'رستوران' },
  { q: 'کافه', label: 'کافه' },
]
const NEARBY_MAX_KM = 2.5   // نزدیکیِ کاربردیِ پیاده/کوتاه؛ نزدیک‌ترین‌ها اول می‌آیند

async function computeNearbyUncached(lat: number, lng: number): Promise<NearbyResult> {
  if (!geoApiEnabled()) return { nearby: [], source: 'none', note: 'سامانهٔ نقشه تنظیم نشده است (ادمین → اتصال‌ها → سامانهٔ نقشه).' }

  // برای هر دسته یک جستجوی واقعیِ NexaMap — کاملاً بدونِ AI. ترتیبی (نه موازی) اجرا می‌شود تا NexaMap
  // زیرِ فشارِ ده‌ها درخواستِ هم‌زمان تعدادی را timeout/rate-limit نکند (تجربهٔ «فقط ۳تا آمد»). چون
  // نتیجه ۶ ساعت کش می‌شود، این چند ثانیه فقط یک‌بار برای هر نقطه هزینه دارد.
  const picked: Located[] = []
  for (const c of NEARBY_CATEGORIES) {
    try {
      const found = await geoSearch(c.q, { lat, lng, radius: NEARBY_MAX_KM * 1000, limit: 5, timeoutMs: 8000 })
      const near = found
        .filter(f => f.name && !isAdminPlace(f))   // واحدهای اداری (استان/شهر/محله…) مکانِ «قابلِ رفتن» نیستند
        .map(f => ({
          type: c.label, name: f.name, lat: f.lat, lng: f.lng,
          km: typeof f.distanceM === 'number' ? f.distanceM / 1000 : haversine(lat, lng, f.lat, f.lng),
        }))
        .filter(p => p.km <= NEARBY_MAX_KM)
        .sort((a, b) => a.km - b.km)
      if (near[0]) picked.push(near[0])
    } catch { /* این دسته را رد کن */ }
  }

  // نزدیک‌ترینِ هر دسته → فهرستِ متنوعِ واقعی، مرتب بر اساسِ فاصله، حداکثر ۱۰تا.
  const all = dedupByName(picked).sort((a, b) => a.km - b.km).slice(0, 10)
  if (all.length < 2) return { nearby: [], source: 'geoapi', note: 'مکانِ نزدیکِ تأییدشده‌ای در NexaMap پیدا نشد.' }
  return withWalkTimes(all, 'geoapi')
}

interface Located { type: string; name: string; lat: number; lng: number; km: number }

function dedupByName(places: Located[]): Located[] {
  const seen = new Set<string>()
  return places.filter(p => { const k = p.name.replace(/\s+/g, ''); if (seen.has(k)) return false; seen.add(k); return true })
}

// زمانِ پیاده از فاصلهٔ واقعیِ NexaMap محاسبه می‌شود — نه از ماتریس (که زمان‌های پرت می‌داد،
// «مترو ۴۴ دقیقه» برای ۹۰۰ متر). سرعتِ پیادهٔ ~۵km/h ⇒ ~۸۰ متر/دقیقه؛ ضریبِ ۱.۳ برای مسیرِ واقعی.
function withWalkTimes(places: Located[], source: string): NearbyResult {
  const nearby = places.map(p => {
    const meters = Math.round(p.km * 1000)
    const time = `${fa(Math.max(1, Math.round((meters * 1.3) / 80)))} دقیقه پیاده`
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

