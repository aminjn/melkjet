import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface DivarPost {
  images: string[]
  description?: string
  facts: { label: string; value: string }[]
  amenities: string[]
  lat?: number
  lng?: number
  reason?: string
  // فیلدهای ساخت‌یافته برای ایمپورت به‌عنوان فایلِ مشاور (همگی اختیاری):
  title?: string
  city?: string
  district?: string
  neighborhood?: string
  location?: string
  deal?: 'sale' | 'rent'
  ptype?: string
  price?: number          // قیمت کل (فروش) یا ودیعه (اجاره) — تومان
  rentMonthly?: number    // اجارهٔ ماهانه — تومان
  area?: number
  rooms?: number
  floor?: number
  yearBuilt?: number
}

export function divarToken(url?: string): string | null {
  const m = (url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
  if (m) return m[1]
  const s = (url || '').trim()
  return /^[A-Za-z0-9_-]{4,20}$/.test(s) ? s : null
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
function faToNum(s?: string): number {
  if (!s) return 0
  const latin = String(s).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
  const n = parseInt(latin.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// پارسِ مبلغِ تومان با درکِ «میلیون/میلیارد» (توضیحاتِ دیوار اغلب این‌طوری‌اند: «۲۵۰ میلیون»).
// «رایگان/توافقی/مجانی» → صفر. اعدادِ کامل با کاما («۲۵۰,۰۰۰,۰۰۰») هم درست خوانده می‌شوند.
function parseToman(s?: string): number {
  if (!s) return 0
  if (/رایگان|توافقی|مجانی|مجانی|طبق توافق/.test(s)) return 0
  // ارقامِ فارسی → لاتین + نرمال‌سازیِ جداکننده‌های عربی: ٬ (هزارگان) حذف، ٫ (اعشار) → نقطه.
  const latin = String(s).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))).replace(/٬/g, '').replace(/٫/g, '.')
  const num = latin.match(/[\d][\d,.]*/)
  if (!num) return 0
  const base = parseFloat(num[0].replace(/,/g, '')) || 0
  if (/میلیارد/.test(s)) return Math.round(base * 1e9)
  if (/میلیون/.test(s)) return Math.round(base * 1e6)
  return Math.round(base)
}

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// تشخیصِ لینکِ پروفایلِ پرو/کسب‌وکارِ دیوار: divar.ir/pro/<slug> یا /businesses/<slug>
export function divarProfileSlug(url?: string): string | null {
  const m = (url || '').trim().match(/divar\.ir\/(?:pro|businesses|business)\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : null
}

const PROXY = () => getAdminData().divar?.proxyUrl
  || process.env.HTTPS_PROXY || process.env.https_proxy
  || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:1080'

// اولین مقدارِ یک کلید در عمقِ JSON (برای پیداکردنِ cursorِ صفحهٔ بعد).
function deepFindKey(node: any, key: string): any {
  if (!node || typeof node !== 'object') return undefined
  if (Array.isArray(node)) { for (const x of node) { const r = deepFindKey(x, key); if (r !== undefined) return r } return undefined }
  if (node[key] !== undefined && node[key] !== null && node[key] !== '') return node[key]
  for (const k of Object.keys(node)) { const r = deepFindKey(node[k], key); if (r !== undefined) return r }
  return undefined
}

export interface BrandPost { token: string; title?: string; price?: string; location?: string; image?: string }

/** آگهی‌های یک پروفایلِ پرو/کسب‌وکارِ دیوار (divar.ir/pro/<slug>) را با endpointِ عمومیِ
 *  brand-landing استخراج می‌کند — با صفحه‌بندیِ last_item_identifier تا همهٔ آگهی‌ها.
 *  عنوان/قیمت/تصویرِ هر آگهی هم از همین پاسخ برداشته می‌شود (دقیق‌تر از API تک‌آگهی). */
export async function fetchDivarProfileTokens(slug: string): Promise<{ posts: BrandPost[]; name?: string; reason?: string }> {
  if (!slug) return { posts: [], reason: 'bad_slug' }
  const proxyUrl = PROXY()
  const ENDPOINT = `https://api.divar.ir/v8/premium-user/web/business/brand-landing/${encodeURIComponent(slug)}`
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/plain, */*',
    'user-agent': UA_BROWSER,
    origin: 'https://divar.ir',
    referer: `https://divar.ir/pro/${slug}`,
    'x-screen-size': '1280x720',
    'x-standard-divar-error': 'true',
  }

  const posts = new Map<string, BrandPost>()
  let name: string | undefined
  let cursor = ''
  let any200 = false
  let reason: string | undefined

  for (let page = 0; page < 40; page++) {
    const body = JSON.stringify({ request_data: { brand_token: slug, tracker_session_id: '' }, specification: { last_item_identifier: cursor } })
    let res
    try {
      res = await proxiedRequest(ENDPOINT, { method: 'POST', headers, body, proxyUrl, timeout: 20000 })
    } catch { reason = reason || 'unreachable'; break }
    if (res.status !== 200) { if (page === 0) reason = `http_${res.status}`; break }
    any200 = true

    const raw = res.body || ''
    const before = posts.size
    let j: any = null
    try { j = JSON.parse(raw) } catch { /* پایین‌تر با regex */ }

    // آگهی‌ها در post_row_widget_list هستند؛ token می‌تواند _ و - داشته باشد (base64url).
    if (j && Array.isArray(j.post_row_widget_list)) {
      for (const w of j.post_row_widget_list) {
        const d = w?.data || {}
        const t = d?.action?.payload?.token || d?.token
        if (typeof t === 'string' && t && t !== slug && !posts.has(t)) {
          posts.set(t, {
            token: t,
            title: typeof d.title === 'string' ? d.title.trim() : undefined,
            price: typeof d.middle_description_text === 'string' ? d.middle_description_text.trim() : undefined,
            location: typeof d.bottom_description_text === 'string' ? d.bottom_description_text.replace(/^\s*در\s*/, '').trim() : undefined,
            image: typeof d.image_url === 'string' ? d.image_url : undefined,
          })
        }
      }
      if (!name) { const t = j.header_widget_list?.[0]?.data?.title; if (typeof t === 'string') name = t.trim() }
    } else {
      // پشتیبان: regex با charsetِ درست (شاملِ _ و -)
      let m: RegExpExecArray | null
      const re = /"token"\s*:\s*"([A-Za-z0-9_-]{6,14})"/g
      while ((m = re.exec(raw))) { if (m[1] !== slug && !posts.has(m[1])) posts.set(m[1], { token: m[1] }) }
    }

    // cursorِ صفحهٔ بعد: infinite_scroll_response.last_item_identifier
    const next = (j?.infinite_scroll_response?.last_item_identifier ?? deepFindKey(j, 'last_item_identifier'))

    if (posts.size === before) break                       // آگهیِ جدیدی نیامد → تمام
    if (next === undefined || next === null || next === '' || String(next) === cursor) break  // صفحهٔ بعدی نیست
    cursor = String(next)
  }

  // Fallback: اگر APIِ brand-landing چیزی نداد (تغییرِ ساختار/۴۰۳)، صفحهٔ HTMLِ پروِ عمومی را
  // می‌خوانیم و توکن‌ها را از JSONِ جاسازی‌شده (__NEXT_DATA__) درمی‌آوریم.
  if (!posts.size) {
    try {
      const res = await proxiedRequest(`https://divar.ir/pro/${encodeURIComponent(slug)}`, {
        method: 'GET',
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': UA_BROWSER, referer: 'https://divar.ir/' },
        proxyUrl, timeout: 20000,
      })
      if (res.status === 200) {
        const html = res.body || ''
        any200 = true
        const re = /"token"\s*:\s*"([A-Za-z0-9_-]{6,16})"/g
        let m: RegExpExecArray | null
        while ((m = re.exec(html))) { if (m[1] !== slug && !posts.has(m[1])) posts.set(m[1], { token: m[1] }) }
        if (!name) { const nm = html.match(/"name"\s*:\s*"([^"]{2,60})"/); if (nm) name = nm[1] }
      } else if (!reason) reason = `http_${res.status}`
    } catch { if (!reason) reason = 'unreachable' }
  }

  const list = Array.from(posts.values()).slice(0, 300)
  if (!list.length) return { posts: [], name, reason: reason || (any200 ? 'no_tokens' : 'unreachable') }
  return { posts: list, name }
}

// واکشی جزئیات کامل یک آگهی دیوار (همهٔ عکس‌ها/مشخصات/توضیحات/مختصات) از طریق پروکسی.
export async function fetchDivarPost(token: string): Promise<DivarPost> {
  const empty: DivarPost = { images: [], facts: [], amenities: [] }
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) return { ...empty, reason: 'bad_token' }

  const proxyUrl = getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined

  try {
    const res = await proxiedRequest(`https://api.divar.ir/v8/posts-v2/web/${token}`, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' },
      proxyUrl,
      timeout: 15000,
    })
    if (res.status !== 200) return { ...empty, reason: `http_${res.status}` }

    const re = /https?:\\?\/\\?\/[^"'\s]*divarcdn[^"'\s]*\.(?:jpe?g|png|webp)/gi
    const found = (res.body.match(re) || []).map(u => u.replace(/\\\//g, '/'))
    const byName = new Map<string, string>()
    for (const u of found) {
      if (/widget-icons|\/imgs\/|logo|avatar|brand/i.test(u)) continue
      const name = (u.split('?')[0].split('/').pop() || u)
      const ex = byName.get(name)
      if (!ex || (/thumbnail/i.test(ex) && !/thumbnail/i.test(u))) byName.set(name, u)
    }
    const images = Array.from(byName.values()).slice(0, 20)

    let d: any = null
    try { d = JSON.parse(res.body) } catch { /* fall back below */ }

    const strOf = (x: any): string => {
      if (x == null) return ''
      if (typeof x === 'string') return x
      if (typeof x === 'number') return String(x)
      if (typeof x === 'object') return strOf(x.value ?? x.str?.value ?? x.text ?? x.normalized_text ?? x.name ?? x.title ?? '')
      return ''
    }
    const findFirst = (o: any, key: string): any => {
      let r: any
      const walk = (x: any) => { if (r !== undefined || !x || typeof x !== 'object') return; if (key in x) { r = x[key]; return }; for (const k in x) walk(x[k]) }
      walk(o); return r
    }

    const FACT_LABELS = ['متراژ', 'ساخت', 'سن بنا', 'سال ساخت', 'اتاق', 'تعداد اتاق', 'خواب', 'طبقه', 'ودیعه', 'رهن', 'رهن و اجاره', 'مبلغ رهن', 'مبلغ ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'اجاره ماهیانه', 'مبلغ اجاره', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت فروش', 'قیمت هر متر', 'پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'جهت ساختمان', 'سند', 'وضعیت واحد', 'نوع']
    const AMENITY_WORDS = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'کولر', 'پکیج', 'لابی', 'سالن اجتماعات', 'استخر', 'سونا', 'جکوزی', 'روف‌گاردن', 'دوربین', 'سیستم امنیتی', 'لاندری', 'مستر', 'نگهبان', 'سرایدار', 'فول مشاعات']
    const factsMap: Record<string, string> = {}
    // قیمت‌ها را جدا و با «شامل‌بودنِ» برچسب می‌گیریم، چون دیوار پسوندِ «(تومان)» و همزه
    // («اجارهٔ ماهانه») دارد و با تطبیقِ دقیقِ برچسب گم می‌شدند.
    const priceHit: { deposit: string; monthly: string; total: string } = { deposit: '', monthly: '', total: '' }
    const amenitySet = new Set<string>()
    let lat: number | undefined, lng: number | undefined
    let description: string | undefined

    if (d) {
      const fs = findFirst(d, 'floorSize'); if (fs) factsMap['متراژ'] = strOf(fs).replace(/[^\d۰-۹٬,]/g, '') + ' متر'
      const nr = findFirst(d, 'numberOfRooms'); if (nr != null) factsMap['اتاق'] = strOf(nr)
      const la = findFirst(d, 'latitude'), lo = findFirst(d, 'longitude')
      if (typeof la === 'number' && typeof lo === 'number') { lat = la; lng = lo }
      const dsc = findFirst(d, 'description'); if (dsc) description = strOf(dsc)
      // فقط «متنِ واقعی» کاندیدِ توضیحات باشد — نه URLِ عکس (که طولانی‌ترین رشتهٔ payload است
      // و قبلاً اشتباهاً به‌جای توضیحات می‌نشست). متنِ واقعی فاصله دارد و URL نیست.
      const isText = (s: string) => s.length > 20 && /\s/.test(s) && !/^https?:\/\//i.test(s) && !/divarcdn|\/static\/|\.(webp|jpe?g|png|gif|svg|mp4)(\?|$)/i.test(s)
      let longest = description && isText(description) ? description : ''
      const dwalk = (x: any) => {
        if (typeof x === 'string') { if (isText(x) && x.length > longest.length) longest = x }
        else if (x && typeof x === 'object') { for (const k in x) dwalk(x[k]) }
      }
      dwalk(d)
      if (longest && longest.length > (description && isText(description) ? description.length : 0)) description = longest

      const walk = (x: any) => {
        if (!x || typeof x !== 'object') return
        if (Array.isArray(x)) { x.forEach(walk); return }
        if ('title' in x && 'value' in x) {
          const a = strOf(x.title).trim(), b = strOf(x.value).trim()
          if (a && b && a.length <= 40 && b.length <= 40) {
            if (FACT_LABELS.includes(b) && !factsMap[b]) factsMap[b] = a
            else if (FACT_LABELS.includes(a) && !factsMap[a]) factsMap[a] = b
            // قیمت‌ها با «شامل‌بودن» (ودیعه/رهن → ودیعه، اجاره → اجارهٔ ماهانه، قیمت → کل)؛
            // مقدار باید رقم داشته باشد تا «قابل تبدیل» و متن‌های دیگر نگیرد.
            if (/[\d۰-۹]/.test(b) && !/تبدیل/.test(a)) {
              const la = a.replace(/ٔ/g, 'ه')   // «اجارهٔ» → «اجاره»
              if (!priceHit.deposit && /(ودیعه|رهن)/.test(la)) priceHit.deposit = b
              else if (!priceHit.monthly && /اجاره/.test(la)) priceHit.monthly = b
              else if (!priceHit.total && /قیمت/.test(la) && !/هر\s*متر/.test(la)) priceHit.total = b
            }
          }
        }
        const t = strOf(x.title).trim()
        if (t && AMENITY_WORDS.some(w => t === w || t.includes(w))) AMENITY_WORDS.forEach(w => { if (t.includes(w)) amenitySet.add(w) })
        for (const k in x) walk(x[k])
      }
      walk(d)
    }

    const dtext = description || ''
    AMENITY_WORDS.forEach(w => { if (dtext.includes(w)) amenitySet.add(w) })

    if (!description) {
      const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
      const descs = [...res.body.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/g)].map(m => unesc(m[1]))
      if (descs.length) description = descs.sort((a, b) => b.length - a.length)[0]
    }

    const order = ['متراژ', 'خواب', 'اتاق', 'تعداد اتاق', 'ساخت', 'سال ساخت', 'سن بنا', 'طبقه', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت هر متر', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'نوع', 'سند', 'جهت ساختمان', 'وضعیت واحد']
    const facts = order.filter(l => factsMap[l]).map(l => ({ label: l, value: factsMap[l] }))
    const amenities = Array.from(amenitySet)

    // ── فیلدهای ساخت‌یافته برای ایمپورت ──
    const factVal = (...keys: string[]) => { for (const k of keys) if (factsMap[k]) return factsMap[k]; return '' }
    let deposit = priceHit.deposit || factVal('ودیعه', 'رهن', 'مبلغ رهن', 'مبلغ ودیعه', 'رهن و اجاره')
    let monthly = priceHit.monthly || factVal('اجارهٔ ماهانه', 'اجاره ماهیانه', 'مبلغ اجاره', 'اجاره')
    let total = priceHit.total || factVal('قیمت کل (تومان)', 'قیمت کل', 'قیمت فروش', 'قیمت')
    const area = faToNum(factVal('متراژ')) || undefined
    const roomsRaw = factVal('اتاق', 'تعداد اتاق', 'خواب')
    const rooms = roomsRaw.includes('بدون') ? 0 : (faToNum(roomsRaw) || undefined)
    const yearBuilt = faToNum(factVal('ساخت', 'سال ساخت', 'سن بنا')) || undefined
    // طبقه: «۵ از ۸» → ۵ (اولین عدد)؛ «همکف» → ۰
    const floorRaw = factVal('طبقه')
    const floorDigits = floorRaw.replace(/[۰-۹]/g, ch => String(FA_DIGITS.indexOf(ch))).match(/\d+/)
    const floor = floorRaw.includes('همکف') ? 0 : (floorDigits ? parseInt(floorDigits[0], 10) : undefined)

    // عنوانِ آگهی: طولانی‌ترین مقدارِ «title» (اولین مقدار معمولاً نامِ دستهٔ «املاک» است).
    let title = ''
    if (d) {
      const titles: string[] = []
      const tw = (x: any) => { if (!x || typeof x !== 'object') return; if (typeof x.title === 'string' && x.title.trim()) titles.push(x.title.trim()); for (const k in x) tw(x[k]) }
      tw(d)
      title = titles.filter(t => t !== 'املاک').sort((a, b) => b.length - a.length)[0] || ''
    }
    const city = d ? strOf(findFirst(d, 'city_persian')).trim() : ''
    const district = d ? strOf(findFirst(d, 'district_persian')).trim() : ''
    const neighborhood = (d ? (strOf(findFirst(d, 'neighborhood_persian')) || strOf(findFirst(d, 'neighbourhood_persian'))).trim() : '') || district
    const cat = (d ? strOf(findFirst(d, 'category')).trim() : '').toLowerCase()
    const dsc = description || ''
    const tt = `${cat} ${title}`   // فقط دسته + عنوان (توضیحات واژه‌های گمراه‌کننده مثلِ «تجاری» دارد)

    // ── نوعِ ملک — اولویتِ قاطع با اسلاگِ انگلیسیِ دسته؛ بعد فقط عنوان (نه توضیحات) ──
    let ptype = /office/.test(cat) ? 'اداری'
      : /(store|shop)/.test(cat) ? 'تجاری'
      : /(plot|land)/.test(cat) ? 'زمین'
      : /(villa|house)/.test(cat) ? 'ویلا/خانه'
      : /(apartment|residential)/.test(cat) ? 'آپارتمان'
      : ''
    if (!ptype) {
      if (/اداری|دفترِ? کار/.test(title)) ptype = 'اداری'
      else if (/مغازه|تجاری|سوله/.test(title)) ptype = 'تجاری'
      else if (/زمین|کلنگی/.test(title)) ptype = 'زمین'
      else if (/ویلا|خانهٔ? ویلایی/.test(title)) ptype = 'ویلا/خانه'
      else ptype = 'آپارتمان'
    }

    // ── نوعِ معامله — اولویتِ قاطع با اسلاگِ دسته؛ بعد وجودِ ودیعه/اجاره؛ بعد واژه‌های عنوان ──
    let deal: 'sale' | 'rent'
    if (/rent/.test(cat)) deal = 'rent'
    else if (/(sell|sale)/.test(cat)) deal = 'sale'
    else if (deposit || monthly || /(اجاره|رهن|ودیعه)/.test(tt)) deal = 'rent'
    else deal = 'sale'

    // ── قیمت: پشتیبان از توضیحات، ولی فقط اگر واقع‌بینانه باشد (≥ یک میلیون تومان) تا
    //    عددِ متراژ («۷۷ متری») به‌جای اجاره گرفته نشود.
    const bigEnough = (v: string) => parseToman(v) >= 1_000_000
    if (deal === 'rent') {
      if (!deposit) { const m = dsc.match(/(?:ودیعه|رهن)\D{0,14}([\d۰-۹][\d۰-۹,.\s]*(?:میلیون|میلیارد)?)/); if (m && bigEnough(m[1])) deposit = m[1] }
      if (!monthly) { const m = dsc.match(/اجاره\D{0,14}([\d۰-۹][\d۰-۹,.\s]*(?:میلیون|میلیارد)?)/); if (m && bigEnough(m[1])) monthly = m[1] }
    } else {
      if (!total) { const m = dsc.match(/(?:قیمت|مبلغ کل)\D{0,14}([\d۰-۹][\d۰-۹,.\s]*(?:میلیون|میلیارد)?)/); if (m && bigEnough(m[1])) total = m[1] }
    }

    // پشتیبانِ عمیق برای آگهی‌های اجارهٔ «قابل‌تبدیل» (تاگلِ ودیعه/اجاره): قیمت در ویجتی می‌آید
    // که از walkِ title/value رد می‌شود؛ پس مستقیم از کلِ بدنهٔ پاسخ می‌خوانیم.
    const body = res.body || ''
    // مقدار پس از برچسبِ فارسی (ودیعه/رهن/اجاره/قیمت) در بدنه. همهٔ occurrenceها را می‌گردیم
    // و اولین عددِ واقع‌بینانه (≥۱م) را برمی‌گردانیم؛ پس برچسب‌های تزئینی (بردکرامب، «قابل تبدیل»)
    // که عددِ بزرگ کنارشان نیست، رد می‌شوند.
    const afterLabel = (labels: RegExp): string => {
      const re = new RegExp('(?:' + labels.source + ')(?:\\s*\\(?تومان\\)?)?[^\\d۰-۹]{0,40}?([\\d۰-۹][\\d۰-۹٬٫,.\\s]*(?:\\s*(?:میلیون|میلیارد))?)', 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(body))) { if (bigEnough(m[1])) return m[1].trim() }
      return ''
    }
    // فیلدهای عددیِ خامِ دیوار (credit=ودیعه، rent=اجاره، price=فروش) به‌عنوان آخرین تلاش.
    const rawNum = (key: RegExp, minDigits: number): string => {
      const re = new RegExp('"(?:' + key.source + ')"\\s*:\\s*"?(\\d{' + minDigits + ',})')
      const m = body.match(re); return m ? m[1] : ''
    }
    if (deal === 'rent') {
      if (!deposit) deposit = afterLabel(/ودیعه|رهن/) || rawNum(/credit|deposit/, 7)
      if (!monthly) monthly = afterLabel(/اجاره/) || rawNum(/rent/, 6)
    } else {
      if (!total) total = afterLabel(/قیمت کل|قیمت فروش|مبلغ کل/) || rawNum(/total_?price|sale_?price|price/, 8)
    }

    return {
      images, description, facts, amenities, lat, lng,
      title, city, district, neighborhood, ptype,
      location: [city, neighborhood].filter(Boolean).join('، '),
      deal,
      price: deal === 'rent' ? parseToman(deposit) : parseToman(total),
      rentMonthly: deal === 'rent' ? parseToman(monthly) : 0,
      area, rooms, floor, yearBuilt,
    }
  } catch (e: any) {
    return { ...empty, reason: e?.message || 'error' }
  }
}
