import { kvGet, kvSet, pgEnabled } from './db'
import { listAccounts, type Account } from './account-store'
import { getProfile, type BusinessProfile } from './profile-store'
import { listSites, saveSite, sanitizeSlug, type SiteBlock } from './sites-store'
import { urlTypeForRole, typeLabel } from './provider-public'

// ─── فاز ۲۹۶ — سایت‌سازِ خودکار برای همهٔ اهالیِ دایرکتوری ────────────────────────
// هر حسابِ نقش‌دار (مشاور/آژانس/معمار/مصالح/…) — چه اسکرپ‌شده چه ثبت‌نامی، چه قدیمی چه
// جدید — خودکار یک سایتِ اختصاصی با دادهٔ «واقعیِ» خودش می‌گیرد (قانونِ آهنین: هیچ عددِ
// ساختگی). جارو در کرونِ اینستنسِ ۰ هر تیک چندتا می‌سازد و یک پیامکِ خوش‌آمد می‌فرستد؛
// چون جارو همیشه می‌چرخد، حسابِ تازه (graduate/معمار/ثبت‌نام) هم خودکار ظرفِ چند دقیقه
// سایت می‌گیرد — هیچ قلابِ دستی لازم نیست (zero-click).
// سئو: عنوان/توضیح از واقعیت‌های خودِ شخص ساخته می‌شود، اسلاگِ فارسیِ نامِ شخص، canonical
// و سایت‌مپِ اختصاصی — تا جست‌وجوی نامِ شخص به همین صفحه برسد. سایتِ دست‌سازِ قبلی هرگز
// بازنویسی نمی‌شود (فقط حسابِ «بدونِ سایت» سایت می‌گیرد).

const CFG_KV = 'autosite_cfg'
const META_KV = 'autosite_meta'

export interface AutoSiteCfg { enabled: boolean; sms: boolean }
interface DoneRec { at: number; slug: string; smsAt?: number; smsTries?: number; manual?: boolean }
interface Meta { done: Record<string, DoneRec> }

// حالتِ فایل/تست: متای درون‌حافظه‌ای (جارو فقط روی سرورِ PG معنا دارد).
let memMeta: Meta = { done: {} }
async function loadMeta(): Promise<Meta> { return pgEnabled() ? await kvGet<Meta>(META_KV, { done: {} }) : memMeta }
async function saveMeta(m: Meta): Promise<void> { if (pgEnabled()) await kvSet(META_KV, m); else memMeta = m }
export async function getAutoSiteCfg(): Promise<AutoSiteCfg> {
  const c = pgEnabled() ? await kvGet<Partial<AutoSiteCfg>>(CFG_KV, {}) : {}
  return { enabled: c.enabled !== false, sms: c.sms !== false }
}

// نقش‌هایی که آگهیِ ملکی دارند → بلوکِ آگهی‌ها؛ مصالح → کاتالوگِ محصولات.
const LISTING_TYPES = new Set(['pros', 'agency'])
const CATALOG_TYPES = new Set(['materials'])

export interface AutoSiteSeed {
  phone: string
  name: string
  roleType: string        // urlType: pros/agency/architect/…
  city?: string
  tagline?: string
  about?: string
  logo?: string
  specialties: string[]
  contactPhone?: string
  address?: string
}

/** بدنهٔ سایتِ خودکار از دادهٔ واقعی — خالص و تست‌پذیر. */
export function buildAutoSitePayload(s: AutoSiteSeed) {
  const roleLabel = typeLabel(s.roleType)
  const inCity = s.city ? ` در ${s.city}` : ''
  let id = 1
  const blocks: SiteBlock[] = []
  blocks.push({ id: id++, type: 'hero', props: { heading: s.name, subheading: `${roleLabel}${inCity}${s.tagline ? ' — ' + s.tagline : ''}`, align: 'center' } })
  if (s.about && s.about.trim().length >= 20) blocks.push({ id: id++, type: 'about', props: { heading: `دربارهٔ ${s.name}`, text: s.about.trim().slice(0, 1500), ...(s.logo ? { image: s.logo } : {}) } })
  if (s.specialties.length) blocks.push({ id: id++, type: 'services', props: { heading: 'خدمات و تخصص‌ها', items: s.specialties.slice(0, 8).map(t => ({ title: t })) } })
  if (LISTING_TYPES.has(s.roleType)) blocks.push({ id: id++, type: 'listings', props: { heading: `آگهی‌های ${s.name}`, total: 12, perSlide: 3 } })
  if (CATALOG_TYPES.has(s.roleType)) blocks.push({ id: id++, type: 'catalog', props: { heading: `محصولات ${s.name}` } })
  blocks.push({ id: id++, type: 'contact', props: { heading: 'تماس با ما', phone: s.contactPhone || s.phone, ...(s.address || s.city ? { address: s.address || s.city } : {}) } })
  blocks.push({ id: id++, type: 'footer', props: {} })

  // سئو از واقعیت‌های ساخت‌یافته — عنوانی که با «نامِ شخص» شروع می‌شود (هدف: جست‌وجوی نام).
  const seoTitle = `${s.name} | ${roleLabel}${inCity}`.slice(0, 70)
  const seoDesc = `${s.name}، ${roleLabel}${inCity}${s.specialties.length ? `؛ تخصص: ${s.specialties.slice(0, 3).join('، ')}` : ''}. آگهی‌ها، خدمات و اطلاعاتِ تماس در سایتِ اختصاصیِ ${s.name} در ملک‌جت.`.slice(0, 160)
  return {
    slug: sanitizeSlug(s.name),
    title: s.name,
    owner: s.phone,
    ownerName: s.name,
    pages: [{ slug: 'home', title: 'خانه', blocks }],
    seo: { title: seoTitle, description: seoDesc },
  }
}

/** دانهٔ ساخت از حساب + پروفایل (+ نامِ مشاوری اگر پروفایلِ عمومی خالی بود). */
async function seedOf(acc: Account): Promise<AutoSiteSeed | null> {
  const roleType = urlTypeForRole(acc.role)
  if (!roleType) return null
  const p: BusinessProfile = getProfile(acc.phone)
  let name = (p.businessName || p.displayName || acc.name || '').trim()
  let logo = p.logo || ''
  let specialties = Array.isArray(p.specialties) ? p.specialties : []
  let city = p.city || ''
  let about = p.about || ''
  let tagline = p.tagline || p.businessType || ''
  try {
    const { getAdvisor } = await import('./advisor-store')
    const ap = (await getAdvisor(acc.phone)).profile
    if (ap) {
      if (!name && ap.name) name = ap.name.trim()
      if (!logo && ap.photo) logo = ap.photo
      if (!specialties.length && Array.isArray(ap.specialties)) specialties = ap.specialties
      if (!city && ap.areas) city = String(ap.areas).split(/[،,]/)[0].trim()
      if (!about && (ap as { bio?: string }).bio) about = String((ap as { bio?: string }).bio)
      if (!tagline && ap.title) tagline = ap.title
    }
  } catch { /* بدونِ پروفایلِ مشاور */ }
  if (!name) return null   // بی‌نام سایت نمی‌گیرد (صفحهٔ خالی = سمِ سئو)
  return { phone: acc.phone, name, roleType, city, tagline, about, logo, specialties, contactPhone: p.contactPhone || p.landline || '', address: p.address || '' }
}

/** جاروِ کرون: هر تیک چند سایتِ جدید + چند پیامکِ معوق. خروجی برای لاگِ عملیاتی. */
export async function sweepAutoSites(maxCreate = 8, maxSms = 4): Promise<{ created: number; sms: number; pending: number }> {
  const cfg = await getAutoSiteCfg()
  if (!cfg.enabled) return { created: 0, sms: 0, pending: 0 }
  const meta = await loadMeta()
  let created = 0, sms = 0, dirty = false

  // یک خواندنِ store برای کلِ تیک (نه به‌ازای هر کاندید).
  const byOwner = new Map<string, { slug: string }>()
  for (const st of await listSites()) if (st.owner) byOwner.set(String(st.owner), { slug: st.slug })

  const candidates = listAccounts().filter(a => !meta.done[a.phone] && urlTypeForRole(a.role))
  for (const acc of candidates) {
    if (created >= maxCreate) break
    const existing = byOwner.get(acc.phone)
    if (existing) {
      // سایتِ دست‌ساز دارد — فقط ثبت می‌کنیم؛ نه بازنویسی، نه پیامک.
      meta.done[acc.phone] = { at: Date.now(), slug: existing.slug, manual: true, smsAt: 0 }
      dirty = true
      continue
    }
    const seed = await seedOf(acc)
    if (!seed) continue   // بی‌نام — تیکِ بعد دوباره دیده می‌شود (شاید پروفایل کامل شود)
    const site = await saveSite(buildAutoSitePayload(seed))
    meta.done[acc.phone] = { at: Date.now(), slug: site.slug }
    created++; dirty = true
  }

  // پیامکِ خوش‌آمد — فقط برای سایت‌های خودکار، با سقفِ هر تیک و حداکثر ۳ تلاش.
  if (cfg.sms) {
    for (const [phone, rec] of Object.entries(meta.done)) {
      if (sms >= maxSms) break
      if (rec.manual || rec.smsAt || (rec.smsTries || 0) >= 3) continue
      const name = (getProfile(phone).businessName || getProfile(phone).displayName || listAccounts().find(a => a.phone === phone)?.name || '').trim() || 'همکار'
      try {
        const { sendServiceSms } = await import('./sms')
        const r = await sendServiceSms(phone, `سلام ${name} عزیز؛ سایت اختصاصی شما در ملک‌جت آماده شد:\nhttps://melkjet.com/${encodeURIComponent(rec.slug)}\nآگهی‌ها و پروفایل شما در آن به‌روز نمایش داده می‌شود.`, 'سایت‌ساز ملک‌جت', name)
        if (r.ok) { rec.smsAt = Date.now(); sms++ } else { rec.smsTries = (rec.smsTries || 0) + 1 }
      } catch { rec.smsTries = (rec.smsTries || 0) + 1 }
      dirty = true
    }
  }

  if (dirty) await saveMeta(meta)
  const pending = listAccounts().filter(a => !meta.done[a.phone] && urlTypeForRole(a.role)).length
  return { created, sms, pending }
}
