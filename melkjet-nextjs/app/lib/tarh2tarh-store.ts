// ── معماران (طرح‌۲طرح) — فاز ۲۸۸ ─────────────────────────────────────────────
// اسکرپِ «بانکِ معمارانِ» tarh2tarh.com برای پرکردنِ دستهٔ «معماران و طراحان» دایرکتوری.
// سایتِ مقصد server-rendered است (HTML کامل، بدونِ React/JSON-LD) پس فقط fetch + regex —
// بدونِ Chrome. الگو همان «سازنده‌ها (پرشین‌سازه)» است: اسکرپِ تدریجیِ زمان‌بندی‌شده روی
// اینستنسِ ۰، ذخیرهٔ پروفایل‌ها، و ساختِ حسابِ «معمار» برای آنهایی که شماره دارند.
//
// سئو (خواستهٔ صریحِ کاربر: «مثلِ آگهی‌ها، با گوگل مشکل نخوریم»): متنِ خامِ سایتِ مبدأ
// هرگز عیناً منتشر نمی‌شود. بیو از «واقعیت‌های ساخت‌یافته» (عنوان، پروژه‌ها، مهارت‌ها،
// افتخارات) با جمله‌بندیِ خودمان تولید می‌شود؛ متنِ «درباره»ی مبدأ فقط raw ذخیره می‌ماند.
//
// شماره‌ها: پشتِ لاگین‌اند. ورودِ سایت پیامکی است (فرمِ check-account با phone)، پس به‌جای
// یوزر/پس، «کوکیِ نشست» را از مرورگرِ ادمین می‌گیریم (یک‌بار لاگین، کپیِ کوکی در پنل).
import { pgEnabled, kvGet, kvSet, kvGetPrefix, kvDelete } from './db'
import fs from './fs-atomic'
import path from 'node:path'
import { FA_DIGITS, faDigit } from './digits'

const BASE = 'https://www.tarh2tarh.com'
const KV_CFG = 't2t:config'
const KV_META = 't2t:meta'
const KV_P = 't2t:p:'                       // t2t:p:{handle}
const FILE = path.join(process.cwd(), '.tarh2tarh-data.json')   // حالتِ فایل (dev)

export interface T2tConfig {
  enabled: boolean
  cookie: string            // هدرِ Cookie از مرورگرِ لاگین‌شده (برای شماره‌ها)
  pagesPerTick: number      // چند صفحهٔ فهرست در هر تیک
  profilesPerTick: number   // چند پروفایل در هر تیک
  delayMs: number           // مکثِ مؤدبانه بین درخواست‌ها
}
export interface T2tProject { title?: string; image?: string; lat?: number; lng?: number; city?: string; year?: string; landArea?: number; builtArea?: number; category?: string }
export interface T2tProfile {
  handle: string; name: string; title?: string; avatar?: string; cover?: string
  uuid?: string; userId?: number; officePhone?: string
  officeName?: string; managerName?: string
  rank?: number; score?: number; credit?: number; views?: number
  rating?: number; ratingCount?: number; nps?: number; strengths?: string[]
  projDone?: number; projDoing?: number; projPresented?: number
  honor1?: number; honor2?: number; honor3?: number; honorFinal?: number
  honours?: { title: string; rank?: string }[]
  about?: string            // متنِ خامِ مبدأ — فقط برای مرجع؛ منتشر نمی‌شود
  skills?: string[]; edus?: string[]; engagements?: string[]
  instagram?: string; linkedin?: string
  projects?: T2tProject[]
  phone?: string; phoneAt?: number
  scrapedAt: number
  error?: string
}
interface T2tMeta {
  handles: string[]                 // همهٔ هندل‌های دیده‌شده در فهرست
  pageCursor: number                // صفحهٔ بعدیِ فهرست برای اسکن
  listDoneAt?: number               // یک دورِ کاملِ فهرست تمام شد
  lastTickAt?: number
  lastError?: string
  fetched?: number                  // شمارِ پروفایل‌های گرفته‌شده (کشِ آمار)
  withPhone?: number
  accounted?: number                // تا این تعداد شماره‌دار، حسابِ خودکار ساخته شده
  accountsAt?: number               // آخرین به‌روزرسانیِ خودکارِ حساب/پروفایل‌ها
  // وضعیتِ سبکِ هر هندل: '<code><epochSec>' — e=خطا، o=گرفته بدونِ شماره، p=گرفته با شماره.
  // تیک با همین تصمیم می‌گیرد چه چیزی را بگیرد؛ دیگر لازم نیست هر دور ۱۴هزار ردیفِ کامل
  // از دیتابیس خوانده شود (همان اشتباهِ «کلِ جدول زیرِ قفل» که فاز ۲۸۷ جای دیگر جمعش کرد).
  state?: Record<string, string>
}

const DEF_CFG: T2tConfig = { enabled: false, cookie: '', pagesPerTick: 2, profilesPerTick: 15, delayMs: 1500 }

// ── لایهٔ ذخیره (PG: هر پروفایل یک ردیفِ kv؛ فایل: یک JSON برای dev) ─────────────
interface FileDb { config: T2tConfig; meta: T2tMeta; profiles: Record<string, T2tProfile>; byPhone?: Record<string, string> }
function fileLoad(): FileDb {
  try { return { config: { ...DEF_CFG }, meta: { handles: [], pageCursor: 1 }, profiles: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf-8')) } }
  catch { return { config: { ...DEF_CFG }, meta: { handles: [], pageCursor: 1 }, profiles: {} } }
}
function fileSave(d: FileDb) { fs.writeFileSync(FILE, JSON.stringify(d)) }

export async function getConfig(): Promise<T2tConfig> {
  if (!pgEnabled()) return fileLoad().config
  return { ...DEF_CFG, ...(await kvGet<Partial<T2tConfig>>(KV_CFG, {})) }
}
export async function saveConfig(patch: Partial<T2tConfig>): Promise<T2tConfig> {
  const cur = await getConfig()
  // کلیدهای undefined نباید مقدارِ فعلی را پاک کنند (روت با فیلدهای ناقص صدا می‌زند)
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T2tConfig>
  const next: T2tConfig = {
    ...cur, ...clean,
    pagesPerTick: Math.max(1, Math.min(10, Number(patch.pagesPerTick ?? cur.pagesPerTick) || 2)),
    profilesPerTick: Math.max(1, Math.min(60, Number(patch.profilesPerTick ?? cur.profilesPerTick) || 15)),
    delayMs: Math.max(500, Math.min(10_000, Number(patch.delayMs ?? cur.delayMs) || 1500)),
  }
  if (!pgEnabled()) { const d = fileLoad(); d.config = next; fileSave(d) } else await kvSet(KV_CFG, next)
  return next
}
export async function getConfigMasked(): Promise<Omit<T2tConfig, 'cookie'> & { cookieSet: boolean }> {
  const { cookie, ...rest } = await getConfig()
  return { ...rest, cookieSet: !!cookie.trim() }
}

async function getMeta(): Promise<T2tMeta> {
  if (!pgEnabled()) return fileLoad().meta
  return { handles: [], pageCursor: 1, ...(await kvGet<Partial<T2tMeta>>(KV_META, {})) }
}
async function saveMeta(m: T2tMeta) {
  if (!pgEnabled()) { const d = fileLoad(); d.meta = m; fileSave(d) } else await kvSet(KV_META, m)
}
export async function getProfileByHandle(handle: string): Promise<T2tProfile | null> {
  if (!pgEnabled()) return fileLoad().profiles[handle] || null
  return await kvGet<T2tProfile | null>(KV_P + handle, null)
}
async function saveProfileRow(p: T2tProfile) {
  if (!pgEnabled()) { const d = fileLoad(); d.profiles[p.handle] = p; fileSave(d) } else await kvSet(KV_P + p.handle, p)
}
// ⚠️ عمداً تابعِ «همهٔ پروفایل‌ها» نداریم: با ۱۴هزار ردیفِ چندکیلوبایتی، هر بار صدها مگابایت
// می‌شد (همان الگوی «کلِ جدول» که فاز ۲۸۷ جای دیگر جمع کرد). همه‌چیز از meta.state + kvGetِ
// هدفمندِ تک‌ردیف می‌گذرد.
export async function clearAll(): Promise<void> {
  if (!pgEnabled()) { fileSave({ config: (fileLoad().config), meta: { handles: [], pageCursor: 1 }, profiles: {} }); return }
  for (const { key } of await kvGetPrefix<unknown>(KV_P)) await kvDelete(key)
  await kvSet(KV_META, { handles: [], pageCursor: 1 })
}

// ── fetch + پارس ──────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
// کوکی‌های تازهٔ Set-Cookie در کوکیِ ذخیره‌شده ادغام می‌شوند (نشستِ لاراولِ مبدأ ۲ساعته است و
// با هر پاسخ نو می‌شود؛ بدونِ این، کوکیِ چسبانده‌شدهٔ ادمین بعد از مدتی می‌مُرد).
function mergeCookieHeader(cur: string, setCookies: string[]): string {
  if (!setCookies.length) return cur
  const jar = new Map<string, string>()
  for (const part of cur.split(/;\s*/)) { const i = part.indexOf('='); if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1)) }
  for (const sc of setCookies) { const kv = sc.split(';')[0]; const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)) }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
async function fetchHtml(url: string, cookie = '', jar?: { cookie: string; dirty?: boolean }): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fa,en;q=0.8', ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
  if (jar) {
    try {
      const sc = (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || []
      const merged = mergeCookieHeader(jar.cookie, sc)
      if (merged !== jar.cookie) { jar.cookie = merged; jar.dirty = true }
    } catch {}
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return await r.text()
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── شمارهٔ خودِ معمار — همان درخواستی که دکمهٔ «نمایش شماره»ی سایت می‌سازد ────────
// (از باندلِ JSِ مبدأ: POST /user/contact_number با {uuid, contact_type} → {data:{phone}}).
// لاراول CSRF را از هدرِ X-XSRF-TOKEN (کوکیِ XSRF-TOKEN، URL-decoded) می‌پذیرد.
function xsrfOf(cookie: string): string {
  const m = cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  try { return m ? decodeURIComponent(m[1]) : '' } catch { return m?.[1] || '' }
}
async function fetchContactNumber(uuid: string, contactType: string, jar: { cookie: string; dirty?: boolean }, referer: string): Promise<string> {
  const base: Record<string, string> = {
    'User-Agent': UA, Cookie: jar.cookie, 'X-XSRF-TOKEN': xsrfOf(jar.cookie),
    'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', Referer: referer,
  }
  // اول JSON، بعد فرم — هر کدام که سرورِ مبدأ بپذیرد.
  const tries: [string, string][] = [
    ['application/json', JSON.stringify({ uuid, contact_type: contactType })],
    ['application/x-www-form-urlencoded', `uuid=${encodeURIComponent(uuid)}&contact_type=${encodeURIComponent(contactType)}`],
  ]
  for (const [ct, body] of tries) {
    try {
      const r = await fetch(`${BASE}/user/contact_number`, { method: 'POST', headers: { ...base, 'Content-Type': ct }, body, signal: AbortSignal.timeout(20_000) })
      try {
        const sc = (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || []
        const merged = mergeCookieHeader(jar.cookie, sc)
        if (merged !== jar.cookie) { jar.cookie = merged; jar.dirty = true }
      } catch {}
      if (!r.ok) continue
      const j = await r.json().catch(() => null) as { data?: { phone?: string }; phone?: string } | null
      const ph = String(j?.data?.phone ?? j?.phone ?? '').trim()
      if (ph) return ph
    } catch { /* تلاشِ بعدی */ }
  }
  return ''
}
const enNum = (s: string) => Number(String(s).replace(FA_DIGITS, faDigit).replace(/[,٬\s]/g, '')) || undefined
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&(zwnj|nbsp);/g, ' ').replace(/\s+/g, ' ').trim()

export function parseListPage(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/href="https:\/\/www\.tarh2tarh\.com\/@([\w.\-]+)"/g)) out.add(m[1])
  return [...out]
}

// عدد نزدیک به یک برچسب (عدد در مارک‌آپ قبل از برچسب می‌آید — <dd>۱۹۷۴</dd> … <dt>امتیاز رقابت</dt> یا برعکس)
function numNear(html: string, label: string): number | undefined {
  const i = html.indexOf(label)
  if (i < 0) return undefined
  const before = html.slice(Math.max(0, i - 400), i)
  const after = html.slice(i, i + 400)
  const mA = after.match(/>\s*([\d,۰-۹٬]{1,12})\s*</)
  const mB = [...before.matchAll(/>\s*([\d,۰-۹٬]{1,12})\s*</g)].pop()
  return enNum((mA?.[1] ?? mB?.[1]) || '')
}
function sectionOf(html: string, id: string): string {
  const m = html.match(new RegExp(`<section[^>]+id="${id}"[\\s\\S]*?<\\/section>`))
  return m ? m[0] : ''
}

export function parseProfile(handle: string, html: string): T2tProfile {
  const name = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '')
  // pِ بعد از h1 گاهی شمارندهٔ بازدید است (وقتی معمار عنوان ندارد) — آن عنوان نیست.
  const titleRaw = strip(html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || '')
  const title = titleRaw && !/^بازدید/.test(titleRaw) ? titleRaw : undefined
  // بینِ property و content اتریبیوت‌های دیگری هم هست (itemprop) — رگکسِ سخت‌گیرِ قبلی رد می‌شد.
  const avatar = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1]
    || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/)?.[1]
  const cover = html.match(/<img[^>]+src="([^"]*tarh2tarh-profile\/cover-[^"]+)"/)?.[1]
  const p: T2tProfile = { handle, name, title, avatar, cover, scrapedAt: Date.now() }
  p.rank = numNear(html, 'رتبه'); p.score = numNear(html, 'امتیاز رقابت'); p.credit = numNear(html, 'اعتبار تخصصی')
  p.views = numNear(html, 'بازدید')
  // وضعیت/مقام‌ها: در مارک‌آپِ مبدأ «عدد بالا، برچسب پایین» است (عدد قبل از برچسب). numNear
  // عددِ کارتِ همسایه را می‌گرفت (۴/۲۹/۲۹ به‌جای ۸/۴/۲۹) — جفتِ صریحِ «عدد→برچسب» جایگزین شد.
  const pairOf = (label: string): number | undefined => {
    const m = html.match(new RegExp(`>\\s*([\\d,۰-۹٬]{1,7})\\s*<(?:[^<>]|<[^>]*>){0,120}?>\\s*${label}\\s*<`))
    return m ? enNum(m[1]) : undefined
  }
  p.projDone = pairOf('اجرا شده'); p.projDoing = pairOf('در حال اجرا'); p.projPresented = pairOf('ارائه شده')
  p.honor1 = pairOf('مقام اول'); p.honor2 = pairOf('مقام دوم'); p.honor3 = pairOf('مقام سوم'); p.honorFinal = pairOf('فینالیست')
  const aboutM = html.match(/درباره من<\/h2>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/)
  const about = aboutM ? strip(aboutM[1]) : ''
  if (about && !about.includes('ثبت نشده')) p.about = about.slice(0, 2000)
  const lines = (id: string) => {
    const sec = sectionOf(html, id); if (!sec) return undefined
    const items = [...sec.matchAll(/<(?:li|h3|h4)[^>]*>([\s\S]*?)<\/(?:li|h3|h4)>/g)].map(m => strip(m[1])).filter(s => s && s.length < 150)
    return items.length ? [...new Set(items)].slice(0, 25) : undefined
  }
  p.skills = lines('section-skill'); p.edus = lines('section-edu'); p.engagements = lines('section-engagment')
  // دفتر/شرکت — JSONِ داخلِ صفحه
  try {
    const om = html.match(/const currnetUserJobLocation = (\{[\s\S]*?\});/)?.[1]
    if (om) { const o = JSON.parse(om); if (o?.office_name) p.officeName = strip(String(o.office_name)); if (o?.manager_name) p.managerName = strip(String(o.manager_name)) }
  } catch {}
  // بازخوردها: امتیاز (x از ۵)، تعدادِ دیدگاه، NPS، نقاطِ قوت
  const rat = html.match(/امتیاز بازخوردها[^0-9.۰-۹]{0,20}([\d.۰-۹]{1,4})/)?.[1]
  if (rat) { const v = Number(String(rat).replace(FA_DIGITS, faDigit)); if (v > 0 && v <= 5) p.rating = v }
  const rc = html.match(/([\d۰-۹]{1,5})\s*دیدگاه/)?.[1]; if (rc) p.ratingCount = enNum(rc)
  const nps = html.match(/NPS\s*=\s*([+-]?\s*[\d۰-۹]{1,3})/)?.[1]
  if (nps != null) { const v = Number(String(nps).replace(/\s/g, '').replace(FA_DIGITS, faDigit)); if (Number.isFinite(v)) p.nps = v }
  {
    const i = html.indexOf('نقاط قوت')
    if (i > 0) {
      const w = html.slice(i, i + 1600)
      const chips = [...w.matchAll(/>([^<>]{6,60})</g)].map(m => strip(m[1]))
        .filter(s => s && !/^[\d۰-۹\s.,]+$/.test(s) && !s.includes('نقاط قوت'))
      if (chips.length) p.strengths = [...new Set(chips)].slice(0, 8)
    }
  }
  // مختصاتِ پروژه‌ها: اول JSONِ lat_lngs (دقیق)، وگرنه اسکنِ عمومی
  let coords: { lat: number; lng: number }[] = []
  try {
    const ll = html.match(/const lat_lngs = (\[[\s\S]*?\]);/)?.[1]
    if (ll) {
      const arr = JSON.parse(ll) as unknown[]
      coords = arr.map((x): { lat: number; lng: number } | null => {
        // فرمِ واقعیِ مبدأ: آرایهٔ رشته‌ای «"lat,lng"» (گاهی با فاصله بعد از کاما)
        if (typeof x === 'string') { const [a, b] = x.split(',').map(s => Number(s.trim())); return { lat: a, lng: b } }
        if (Array.isArray(x) && x.length >= 2) return { lat: Number(x[0]), lng: Number(x[1]) }
        if (x && typeof x === 'object') { const o = x as { lat?: unknown; lng?: unknown }; return { lat: Number(o.lat), lng: Number(o.lng) } }
        return null
      }).filter((c): c is { lat: number; lng: number } => !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng))
    }
  } catch {}
  if (!coords.length) coords = [...html.matchAll(/"lat":\s*([\d.]+)\s*,\s*"lng":\s*([\d.]+)/g)].map(m => ({ lat: Number(m[1]), lng: Number(m[2]) }))
  // کارت‌های پروژه: هر کارت یک <article class="…activity-item…"> با ساختارِ ثابت است
  // (h3 عنوان، imgِ نمونه‌کار با alt، جفت‌های <span>برچسب</span><span>مقدار</span>، چیپِ دسته).
  const projects: T2tProject[] = []
  {
    const chunks = html.split(/<article[^>]*activity-item/).slice(1)
    for (const raw of chunks.slice(0, 60)) {
      const end = raw.indexOf('</article>')
      const c = end > 0 ? raw.slice(0, end) : raw.slice(0, 4000)
      const pr: T2tProject = {}
      const h3 = c.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) || c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)
      if (h3) pr.title = strip(h3[1]).slice(0, 90) || undefined
      const img = c.match(/<img[^>]+src="([^"]+)"/); if (img && !img[1].includes('logo')) pr.image = img[1]
      const lbl = (l: string) => { const m = c.match(new RegExp(`${l}<\\/span>\\s*<span[^>]*>\\s*([^<]{1,60}?)\\s*<`)); return m ? strip(m[1]) : undefined }
      pr.builtArea = enNum(lbl('متراژ زیربنا') || ''); pr.landArea = enNum(lbl('متراژ زمین') || '')
      const yr = lbl('سال انجام'); if (yr && /^[\d۰-۹]{4}$/.test(yr)) pr.year = yr.replace(FA_DIGITS, faDigit)
      const city = lbl('شهر'); if (city && !/^[\d۰-۹]/.test(city)) pr.city = city
      const cat = c.match(/rounded-full[^>]*>\s*([^<>]{2,35}?)\s*</)
      if (cat) { const cc = strip(cat[1]); if (cc && cc !== pr.title) pr.category = cc }
      if (pr.title || pr.image || pr.builtArea) projects.push(pr)
    }
  }
  for (let i = 0; i < coords.length && i < 60; i++) {
    if (projects[i]) { projects[i].lat = coords[i].lat; projects[i].lng = coords[i].lng }
    else projects.push({ lat: coords[i].lat, lng: coords[i].lng })
  }
  if (projects.length) p.projects = projects.slice(0, 60)
  // شبکه‌های اجتماعیِ خودِ معمار (فوترِ سایت لینک‌های خودِ tarh2tarh را دارد — حذف)
  const insta = [...html.matchAll(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/g)].map(m => m[1]).find(u => !/tarh2tarh/i.test(u))
  const li = [...html.matchAll(/href="(https?:\/\/(?:www\.)?linkedin\.com\/[^"]+)"/g)].map(m => m[1]).find(u => !/tarh2tarh/i.test(u))
  if (insta) p.instagram = insta
  if (li) p.linkedin = li
  // شناسه‌های JSONِ صفحه — شماره با POST به /user/contact_number با همین uuid گرفته می‌شود.
  p.uuid = html.match(/const modelUuid = "([0-9a-f-]{20,50})"/)?.[1]
  const uid = html.match(/"user_id":(\d{1,10})/)?.[1]
  if (uid) p.userId = Number(uid)
  return p
}

// ── تیکِ اسکرپ (اینستنسِ ۰، تدریجی و ازسرگیرنده) ────────────────────────────────
let ticking = false
export async function tickScrape(force = false): Promise<{ ran: boolean; note?: string }> {
  if (ticking) return { ran: false, note: 'در حالِ اجرا' }
  const cfg = await getConfig()
  if (!cfg.enabled && !force) return { ran: false, note: 'خاموش' }
  const meta = await getMeta()
  if (!force && meta.lastTickAt && Date.now() - meta.lastTickAt < 50_000) return { ran: false, note: 'زود است' }
  ticking = true
  try {
    meta.lastTickAt = Date.now(); meta.lastError = ''
    // قرنطینهٔ کوکیِ آلوده: کوکیِ قدیمیِ حاویِ «…» از قبل از گاردِ ذخیره مانده بود و
    // تازه‌سازیِ خودکار هم روی همان بنا می‌شد → هر درخواستِ کوکی‌دار با ByteString می‌ترکید.
    if (/[^\x20-\x7E]/.test(cfg.cookie)) {
      cfg.cookie = ''
      meta.lastError = 'کوکی نویسهٔ نامعتبر داشت و کنار گذاشته شد — از DevTools دوباره کپی و ذخیره کن'
      console.error('[t2t] cookie قرنطینه شد (نویسهٔ غیرASCII) — شماره‌ها تا کوکیِ تازه صبر می‌کنند')
    }
    const known = new Set(meta.handles)
    // ۱) چند صفحهٔ فهرست
    let listDone = !!meta.listDoneAt && Date.now() - (meta.listDoneAt || 0) < 7 * 24 * 3600_000
    for (let i = 0; i < cfg.pagesPerTick && !listDone; i++) {
      const url = `${BASE}/architects?order=year&s=&page=${meta.pageCursor}`
      let html = ''
      try { html = await fetchHtml(url) } catch (e: any) { meta.lastError = `فهرست ص${meta.pageCursor}: ${String(e?.message).slice(0, 80)}`; break }
      const hs = parseListPage(html)
      let fresh = 0
      for (const h of hs) if (!known.has(h)) { known.add(h); meta.handles.push(h); fresh++ }
      console.log(`[t2t] list page=${meta.pageCursor} found=${hs.length} new=${fresh} total=${meta.handles.length}`)
      if (hs.length === 0) { meta.listDoneAt = Date.now(); meta.pageCursor = 1; listDone = true }
      else meta.pageCursor++
      await sleep(cfg.delayMs)
    }
    // ۲) چند پروفایل — انتخاب از روی وضعیتِ سبکِ meta.state، نه خواندنِ همهٔ ردیف‌های کامل
    meta.state = meta.state || {}
    const stOf = (h: string) => { const s = meta.state![h]; return s ? { code: s[0], at: Number(s.slice(1)) || 0 } : null }
    const nowSec = Math.floor(Date.now() / 1000)
    const errRetry = force ? 0 : 3600                 // خطا: تلاشِ دوباره بعد از ۱ ساعت (اسکنِ دستی: فوری)
    const phoneRetry = force ? 0 : 7 * 24 * 3600      // بی‌شماره با کوکی: بعد از ۷ روز (اسکنِ دستی: فوری)
    const wants: string[] = []
    for (const h of meta.handles) {
      const st = stOf(h)
      if (!st) wants.push(h)
      else if (st.code === 'e' && nowSec - st.at >= errRetry) wants.push(h)
      else if (st.code === 'o' && cfg.cookie.trim() && nowSec - st.at >= phoneRetry) wants.push(h)
      if (wants.length >= cfg.profilesPerTick) break
    }
    let ok = 0, withPhone = 0
    const jar = { cookie: cfg.cookie.trim(), dirty: false }
    for (const h of wants) {
      try {
        const html = await fetchHtml(`${BASE}/@${h}`, jar.cookie, jar.cookie ? jar : undefined)
        const p = parseProfile(h, html)
        if (!p.name) { p.error = 'نام پیدا نشد (ساختارِ صفحه؟)' } else ok++
        // شماره‌ها از endpointِ «نمایش شماره» — فقط با کوکیِ لاگین و uuidِ صفحه.
        if (jar.cookie && p.uuid && p.name) {
          const referer = `${BASE}/@${h}`
          const mob = (await fetchContactNumber(p.uuid, 'display_phone', jar, referer)).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
          if (/^0?9\d{9}$/.test(mob)) { p.phone = mob.startsWith('0') ? mob : '0' + mob }
          await sleep(400)
          // نامِ contact_typeِ ثابت حدسی است؛ اگر مبدأ نپذیرد، خالی برمی‌گردد و بی‌ضرر است.
          const land = (await fetchContactNumber(p.uuid, 'display_landline', jar, referer)).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
          if (land && land.length >= 8 && land !== p.phone) p.officePhone = land.startsWith('0') ? land : '0' + land
        }
        p.phoneAt = Date.now()   // شماره‌گیری انجام شد (موفق یا نه) — تا ۷ روز دوباره تلاش نکن
        // پلِ داده↔حساب همان لحظه نوشته می‌شود — نه فقط موقعِ ساختِ حساب؛ وگرنه پنجره‌ای بود
        // که بیو/عکس روی حساب می‌نشست ولی صفحهٔ معمار به دادهٔ کامل (آمار/پروژه/نقشه) وصل نبود.
        if (p.phone) { try { await setByPhone(p.phone, h) } catch {} }
        // جوایز و افتخارات — مسیرِ JSONِ خودِ صفحه (get_honours_route)
        const hrRoute = html.match(/const get_honours_route = "([^"]+)"/)?.[1]
        if (hrRoute && p.name && hrRoute.startsWith(BASE)) {
          try {
            const j = JSON.parse(await fetchHtml(hrRoute, jar.cookie, jar.cookie ? jar : undefined)) as unknown
            const arr = Array.isArray(j) ? j : Array.isArray((j as { data?: unknown[] })?.data) ? (j as { data: unknown[] }).data : []
            const hs = arr.slice(0, 25).map(raw => {
              const it = raw as Record<string, unknown>
              return {
                title: strip(String(it?.title ?? it?.name ?? it?.competition_title ?? it?.project_title ?? '')).slice(0, 120),
                rank: it?.rank != null ? String(it.rank).slice(0, 30) : (it?.honour_title ? strip(String(it.honour_title)).slice(0, 40) : undefined),
              }
            }).filter(x => x.title)
            if (hs.length) p.honours = hs
          } catch { /* اختیاری */ }
          await sleep(300)
        }
        await saveProfileRow(p)   // بازنویسیِ کامل: شمارهٔ غلطِ قبلی هم با همین پاک می‌شود
        meta.state[h] = (p.error ? 'e' : p.phone ? 'p' : 'o') + Math.floor(Date.now() / 1000)
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 100)
        console.error(`[t2t] profile @${h} failed: ${msg}`)
        await saveProfileRow({ handle: h, name: '', scrapedAt: Date.now(), error: msg })
        meta.state[h] = 'e' + Math.floor(Date.now() / 1000)
      }
      await sleep(cfg.delayMs)
    }
    if (jar.dirty) await saveConfig({ cookie: jar.cookie })   // کوکیِ تازه‌شده ماندگار شود
    let fetchedN = 0, phoneN = 0
    for (const v of Object.values(meta.state)) { if (v[0] !== 'e') fetchedN++; if (v[0] === 'p') phoneN++ }
    meta.fetched = fetchedN; meta.withPhone = phoneN
    withPhone = meta.withPhone
    // ساختِ حسابِ خودکار + تازه‌سازیِ پروفایل‌ها (عکس/بیو/تخصص) — بدونِ هیچ دکمه‌ای.
    // هم با آمدنِ شمارهٔ تازه، هم حداکثر ساعتی یک‌بار وقتی پروفایلی به‌روز شده (تا مثلا
    // آواتارِ تازه‌پارس‌شده روی حساب‌های موجود هم بنشیند).
    const accountsStale = ok > 0 && Date.now() - (meta.accountsAt || 0) > 3600_000
    if ((meta.withPhone || 0) !== (meta.accounted || 0) || accountsStale) {
      try {
        const r = await createArchitectAccounts()
        if (r.created) console.log(`[t2t] auto-accounts: +${r.created} حسابِ معمار`)
        if (!r.noRole) { meta.accounted = meta.withPhone; meta.accountsAt = Date.now() }
      } catch (e: any) { console.error(`[t2t] auto-accounts failed: ${String(e?.message).slice(0, 80)}`) }
    }
    await saveMeta(meta)
    if (wants.length || !listDone) console.log(`[t2t] tick: +${ok} fetched=${meta.fetched}/${meta.handles.length} phones=${withPhone}`)
    return { ran: true }
  } finally { ticking = false }
}

// ── بیوی سئو-امن: فقط از واقعیت‌های ساخت‌یافته، با جمله‌بندیِ خودمان ─────────────
export function seoBio(p: T2tProfile): string {
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const bits: string[] = []
  if (p.title && p.officeName && !p.title.includes(p.officeName)) bits.push(`${p.name}، ${p.title} است و در «${p.officeName}» فعالیت می‌کند`)
  else if (p.title) bits.push(`${p.name}، ${p.title} است`)
  else if (p.officeName) bits.push(`${p.name} در «${p.officeName}» فعالیت می‌کند`)
  else bits.push(`${p.name} از معماران و طراحانِ فعالِ کشور است`)
  const pr = (p.projDone || 0) + (p.projDoing || 0) + (p.projPresented || 0)
  if (pr > 0) bits.push(`تاکنون ${fa(pr)} پروژه در کارنامهٔ حرفه‌ایِ او ثبت شده${p.projDone ? ` که ${fa(p.projDone)} موردِ آن به مرحلهٔ اجرا رسیده است` : ''}`)
  const cities = [...new Set((p.projects || []).map(x => x.city).filter((c): c is string => !!c))].slice(0, 4)
  if (cities.length) bits.push(`نمونه‌کارهای او در ${cities.join('، ')} ثبت شده است`)
  const honors = (p.honor1 || 0) + (p.honor2 || 0) + (p.honor3 || 0)
  if (honors > 0) bits.push(`او در مسابقاتِ معماری ${fa(honors)} مقام کسب کرده${p.honor1 ? ` (از جمله ${fa(p.honor1)} مقامِ نخست)` : ''}`)
  if (p.rating && p.ratingCount) bits.push(`کارفرمایان به تجربهٔ همکاری با او میانگینِ ${p.rating.toLocaleString('fa-IR')} از ۵ داده‌اند (${fa(p.ratingCount)} بازخورد)`)
  if (p.edus?.length) bits.push(`تحصیلات: ${p.edus.slice(0, 3).join('، ')}`)
  if (p.skills?.length) bits.push(`حوزه‌های کاریِ او شاملِ ${p.skills.slice(0, 4).join('، ')} می‌شود`)
  return bits.join('. ') + '.'
}

// ── ساختِ حسابِ «معمار» برای پروفایل‌های شماره‌دار ───────────────────────────────
export async function createArchitectAccounts(): Promise<{ created: number; skipped: number; noPhone: number; total: number; noRole?: boolean }> {
  const { listRoles } = await import('./role-store')
  const roleId = listRoles().find(r => r.dashboard === '/architect' && r.active)?.id
  if (!roleId) return { created: 0, skipped: 0, noPhone: 0, total: 0, noRole: true }
  const { bulkCreate } = await import('./account-store')
  const { saveProfile } = await import('./profile-store')
  // فقط ردیف‌های شماره‌دار (state='p') خوانده می‌شوند — نه همهٔ ۱۴هزار پروفایل.
  const meta = await getMeta()
  const st = meta.state || {}
  let total = 0, noPhone = 0
  const rows: { phone: string; name?: string; role?: string }[] = []
  const byPhone = new Map<string, T2tProfile>()
  for (const [h, v] of Object.entries(st)) {
    if (v[0] === 'e') continue
    total++
    if (v[0] !== 'p') { noPhone++; continue }
    const p = await getProfileByHandle(h)
    if (!p?.name) continue
    const ph = (p.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(ph)) { noPhone++; continue }
    rows.push({ phone: ph, name: p.name, role: roleId })
    byPhone.set(ph, p)
  }
  const r = bulkCreate(rows)
  // پروفایلِ عمومی: بیوی تولیدیِ خودمان (نه متنِ مبدأ) + مهارت‌ها + لینک‌ها
  // + ایندکسِ شماره→هندل تا صفحهٔ معمارِ ملک‌جت دادهٔ کامل (پروژه‌ها/نقشه/آمار) را با یک kvGet بردارد.
  for (const [ph, p] of byPhone) {
    try {
      saveProfile(ph, {
        displayName: p.name, tagline: (p.title || '').slice(0, 120) || undefined,
        about: seoBio(p), logo: p.avatar || undefined,
        specialties: p.skills?.slice(0, 8), contactPhone: ph,
      } as any)
      await setByPhone(ph, p.handle)
    } catch {}
  }
  return { created: r.created, skipped: r.skipped + r.invalid, noPhone, total }
}

async function setByPhone(ph: string, handle: string): Promise<void> {
  if (!pgEnabled()) { const d = fileLoad(); d.byPhone = d.byPhone || {}; d.byPhone[ph] = handle; fileSave(d) }
  else await kvSet('t2t:byphone:' + ph, handle)
}

/** دادهٔ کاملِ معمارِ اسکرپ‌شده برای صفحهٔ عمومیِ ملک‌جت (بر اساسِ شمارهٔ حساب). */
export async function getArchitectPublic(phone: string): Promise<T2tProfile | null> {
  const ph = String(phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
  if (!ph) return null
  const handle = !pgEnabled() ? ((fileLoad().byPhone || {})[ph] || '') : await kvGet<string>('t2t:byphone:' + ph, '')
  if (!handle) return null
  return getProfileByHandle(handle)
}

// ── آمار برای پنل ────────────────────────────────────────────────────────────
export async function stats() {
  const meta = await getMeta()
  const st = meta.state || {}
  let fetched = 0, withPhone = 0, errors = 0
  const errHandles: string[] = []
  for (const [h, v] of Object.entries(st)) {
    if (v[0] === 'e') { errors++; if (errHandles.length < 3) errHandles.push(h) }
    else { fetched++; if (v[0] === 'p') withPhone++ }
  }
  const sampleErrors: string[] = []
  for (const h of errHandles) { const p = await getProfileByHandle(h); if (p?.error) sampleErrors.push(`@${h}: ${p.error}`) }
  return {
    handles: meta.handles.length, pageCursor: meta.pageCursor, listDoneAt: meta.listDoneAt || null,
    fetched, errors, withPhone, lastTickAt: meta.lastTickAt || null, lastError: meta.lastError || '',
    sampleErrors,
  }
}
export async function listProfilesView(opts: { q?: string; withPhone?: boolean; page?: number }) {
  const meta = await getMeta()
  const st = meta.state || {}
  let hs = meta.handles.filter(h => st[h] && st[h][0] !== 'e')
  if (opts.withPhone) hs = hs.filter(h => st[h][0] === 'p')
  const q = (opts.q || '').trim()
  const per = 30, page = Math.max(1, opts.page || 1)
  if (!q) {
    // بدونِ جستجو فقط ۳۰ ردیفِ همین صفحه خوانده می‌شود (ترتیب = ترتیبِ فهرستِ مبدأ، که خودش رتبه‌ای است)
    const slice = hs.slice((page - 1) * per, page * per)
    const items: T2tProfile[] = []
    for (const h of slice) { const p = await getProfileByHandle(h); if (p?.name) items.push(p) }
    return { total: hs.length, page, pages: Math.max(1, Math.ceil(hs.length / per)), items }
  }
  // جستجو: پیمایشِ هدفمند با سقف (نه بارکردنِ همهٔ ردیف‌ها)
  const items: T2tProfile[] = []
  let scanned = 0
  for (const h of hs) {
    if (scanned++ >= 1200 || items.length >= per * page + per) break
    const p = await getProfileByHandle(h)
    if (p?.name && (p.name.includes(q) || p.handle.includes(q) || (p.title || '').includes(q))) items.push(p)
  }
  return { total: items.length, page, pages: Math.max(1, Math.ceil(items.length / per)), items: items.slice((page - 1) * per, page * per) }
}
