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
export interface T2tProject { image?: string; lat?: number; lng?: number }
export interface T2tProfile {
  handle: string; name: string; title?: string; avatar?: string
  rank?: number; score?: number; credit?: number; views?: number
  projDone?: number; projDoing?: number; projPresented?: number
  honor1?: number; honor2?: number; honor3?: number; honorFinal?: number
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
}

const DEF_CFG: T2tConfig = { enabled: false, cookie: '', pagesPerTick: 2, profilesPerTick: 15, delayMs: 1500 }

// ── لایهٔ ذخیره (PG: هر پروفایل یک ردیفِ kv؛ فایل: یک JSON برای dev) ─────────────
interface FileDb { config: T2tConfig; meta: T2tMeta; profiles: Record<string, T2tProfile> }
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
async function allProfiles(): Promise<T2tProfile[]> {
  if (!pgEnabled()) return Object.values(fileLoad().profiles)
  return (await kvGetPrefix<T2tProfile>(KV_P)).map(r => r.data)
}
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
  const title = strip(html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || '') || undefined
  const avatar = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1] || html.match(/content="([^"]+)"\s+property="og:image"/)?.[1]
  const p: T2tProfile = { handle, name, title, avatar, scrapedAt: Date.now() }
  p.rank = numNear(html, 'رتبه'); p.score = numNear(html, 'امتیاز رقابت'); p.credit = numNear(html, 'اعتبار تخصصی')
  p.views = numNear(html, 'بازدید')
  p.projDone = numNear(html, 'اجرا شده'); p.projDoing = numNear(html, 'در حال اجرا'); p.projPresented = numNear(html, 'ارائه شده')
  p.honor1 = numNear(html, 'مقام اول'); p.honor2 = numNear(html, 'مقام دوم'); p.honor3 = numNear(html, 'مقام سوم'); p.honorFinal = numNear(html, 'فینالیست')
  const aboutM = html.match(/درباره من<\/h2>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/)
  const about = aboutM ? strip(aboutM[1]) : ''
  if (about && !about.includes('ثبت نشده')) p.about = about.slice(0, 2000)
  const lines = (id: string) => {
    const sec = sectionOf(html, id); if (!sec) return undefined
    const items = [...sec.matchAll(/<(?:li|h3|h4)[^>]*>([\s\S]*?)<\/(?:li|h3|h4)>/g)].map(m => strip(m[1])).filter(s => s && s.length < 150)
    return items.length ? [...new Set(items)].slice(0, 25) : undefined
  }
  p.skills = lines('section-skill'); p.edus = lines('section-edu'); p.engagements = lines('section-engagment')
  // پروژه‌ها: مختصاتِ پین‌ها + تصاویرِ بخشِ پروژه
  const coords = [...html.matchAll(/"lat":\s*([\d.]+)\s*,\s*"lng":\s*([\d.]+)/g)].map(m => ({ lat: Number(m[1]), lng: Number(m[2]) }))
  const projSec = sectionOf(html, 'section-project')
  const imgs = [...projSec.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(u => !u.includes('logo')).slice(0, 24)
  const projects: T2tProject[] = []
  const n = Math.max(coords.length, imgs.length)
  for (let i = 0; i < n && i < 40; i++) projects.push({ image: imgs[i], lat: coords[i]?.lat, lng: coords[i]?.lng })
  if (projects.length) p.projects = projects
  // شبکه‌های اجتماعیِ خودِ معمار (فوترِ سایت لینک‌های خودِ tarh2tarh را دارد — حذف)
  const insta = [...html.matchAll(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/g)].map(m => m[1]).find(u => !/tarh2tarh/i.test(u))
  const li = [...html.matchAll(/href="(https?:\/\/(?:www\.)?linkedin\.com\/[^"]+)"/g)].map(m => m[1]).find(u => !/tarh2tarh/i.test(u))
  if (insta) p.instagram = insta
  if (li) p.linkedin = li
  // شماره: فقط لینکِ tel: (متنِ آزاد شماره‌های خودِ سایت را هم دارد)
  const tel = html.match(/href="tel:\+?9?8?(0?9\d{9})"/)?.[1]
  if (tel) { p.phone = tel.startsWith('0') ? tel : '0' + tel; p.phoneAt = Date.now() }
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
    // ۲) چند پروفایل (گرفته‌نشده‌ها؛ بعد آنهایی که کوکی داریم و شماره ندارند)
    const have = new Map((await allProfiles()).map(p => [p.handle, p]))
    const wants: string[] = []
    for (const h of meta.handles) { if (!have.has(h)) wants.push(h); if (wants.length >= cfg.profilesPerTick) break }
    if (wants.length < cfg.profilesPerTick && cfg.cookie.trim()) {
      for (const [h, pr] of have) { if (!pr.phone && !pr.error && (!pr.phoneAt || Date.now() - pr.phoneAt > 7 * 24 * 3600_000)) wants.push(h); if (wants.length >= cfg.profilesPerTick) break }
    }
    let ok = 0, withPhone = 0
    const jar = { cookie: cfg.cookie.trim(), dirty: false }
    for (const h of wants) {
      try {
        const html = await fetchHtml(`${BASE}/@${h}`, jar.cookie, jar.cookie ? jar : undefined)
        const p = parseProfile(h, html)
        if (!p.name) { p.error = 'نام پیدا نشد (ساختارِ صفحه؟)' } else ok++
        if (!p.phone) p.phoneAt = Date.now()   // با این کوکی شماره نبود — تا ۷ روز دوباره تلاش نکن
        const prev = have.get(h)
        if (prev?.phone && !p.phone) { p.phone = prev.phone; p.phoneAt = prev.phoneAt }   // شمارهٔ قبلاً گرفته‌شده گم نشود
        await saveProfileRow(p)
      } catch (e: any) {
        await saveProfileRow({ handle: h, name: '', scrapedAt: Date.now(), error: String(e?.message).slice(0, 100) })
      }
      await sleep(cfg.delayMs)
    }
    if (jar.dirty) await saveConfig({ cookie: jar.cookie })   // کوکیِ تازه‌شده ماندگار شود
    const all = await allProfiles()
    meta.fetched = all.filter(p => p.name).length
    meta.withPhone = all.filter(p => p.phone).length
    withPhone = meta.withPhone
    await saveMeta(meta)
    if (wants.length || !listDone) console.log(`[t2t] tick: +${ok} fetched=${meta.fetched}/${meta.handles.length} phones=${withPhone}`)
    return { ran: true }
  } finally { ticking = false }
}

// ── بیوی سئو-امن: فقط از واقعیت‌های ساخت‌یافته، با جمله‌بندیِ خودمان ─────────────
export function seoBio(p: T2tProfile): string {
  const bits: string[] = []
  if (p.title) bits.push(`${p.name}، ${p.title} است`)
  else bits.push(`${p.name} از معماران و طراحانِ فعالِ کشور است`)
  const pr = (p.projDone || 0) + (p.projDoing || 0) + (p.projPresented || 0)
  if (pr > 0) bits.push(`تاکنون ${pr.toLocaleString('fa-IR')} پروژه در کارنامهٔ حرفه‌ایِ او ثبت شده${p.projDone ? ` که ${p.projDone.toLocaleString('fa-IR')} موردِ آن به مرحلهٔ اجرا رسیده است` : ''}`)
  const honors = (p.honor1 || 0) + (p.honor2 || 0) + (p.honor3 || 0)
  if (honors > 0) bits.push(`او در مسابقاتِ معماری ${honors.toLocaleString('fa-IR')} مقام کسب کرده${p.honor1 ? ` (از جمله ${p.honor1.toLocaleString('fa-IR')} مقامِ نخست)` : ''}`)
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
  const profiles = (await allProfiles()).filter(p => p.name)
  let noPhone = 0
  const rows: { phone: string; name?: string; role?: string }[] = []
  const byPhone = new Map<string, T2tProfile>()
  for (const p of profiles) {
    const ph = (p.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(ph)) { noPhone++; continue }
    rows.push({ phone: ph, name: p.name, role: roleId })
    byPhone.set(ph, p)
  }
  const r = bulkCreate(rows)
  // پروفایلِ عمومی: بیوی تولیدیِ خودمان (نه متنِ مبدأ) + مهارت‌ها + لینک‌ها
  for (const [ph, p] of byPhone) {
    try {
      saveProfile(ph, {
        displayName: p.name, tagline: (p.title || '').slice(0, 120) || undefined,
        about: seoBio(p), logo: p.avatar || undefined,
        specialties: p.skills?.slice(0, 8), contactPhone: ph,
      } as any)
    } catch {}
  }
  return { created: r.created, skipped: r.skipped + r.invalid, noPhone, total: profiles.length }
}

// ── آمار برای پنل ────────────────────────────────────────────────────────────
export async function stats() {
  const meta = await getMeta()
  const all = await allProfiles()
  return {
    handles: meta.handles.length, pageCursor: meta.pageCursor, listDoneAt: meta.listDoneAt || null,
    fetched: all.filter(p => p.name).length, errors: all.filter(p => p.error).length,
    withPhone: all.filter(p => p.phone).length, lastTickAt: meta.lastTickAt || null, lastError: meta.lastError || '',
  }
}
export async function listProfilesView(opts: { q?: string; withPhone?: boolean; page?: number }) {
  const q = (opts.q || '').trim()
  let all = (await allProfiles()).filter(p => p.name)
  if (opts.withPhone) all = all.filter(p => p.phone)
  if (q) all = all.filter(p => p.name.includes(q) || p.handle.includes(q) || (p.title || '').includes(q))
  all.sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9))
  const page = Math.max(1, opts.page || 1), per = 30
  return { total: all.length, page, pages: Math.ceil(all.length / per), items: all.slice((page - 1) * per, page * per) }
}
