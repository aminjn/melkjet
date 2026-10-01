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
interface DoneRec { at: number; slug: string; smsAt?: number; smsTries?: number; manual?: boolean; lastErr?: string; v?: number }
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
  providerUrl?: string    // صفحهٔ دایرکتوریِ همین شخص (مقصدِ CTA — لینکِ داخلیِ سئو)
  // دادهٔ غنیِ معمار (طرح‌۲طرح) — همه واقعی
  arch?: {
    cover?: string
    images: string[]
    projDone?: number; projDoing?: number; honors?: number
    rating?: number; ratingCount?: number
    edus: string[]; skills: string[]; engagements: string[]
    officeName?: string
  }
}

// نسخهٔ سازنده — بالارفتنش یعنی سایت‌های خودکارِ «دست‌نخورده» در جاروِ بعدی بازسازی می‌شوند.
export const AUTO_SITE_V = 2

/** بدنهٔ سایتِ خودکار از دادهٔ واقعی — خالص و تست‌پذیر. فاز ۲۹۶هـ: چیدمانِ کامل
 *  («سایتِ خالی جذابیت ندارد»): جستجو/فیلترِ کاملِ آگهی‌ها، نظراتِ واقعی، CTA، و برای
 *  معماران کلِ دادهٔ طرح‌۲طرح (نمونه‌کارها/آمار/تحصیلات/مهارت‌ها/دفتر). */
export function buildAutoSitePayload(s: AutoSiteSeed) {
  const roleLabel = typeLabel(s.roleType)
  const inCity = s.city ? ` در ${s.city}` : ''
  let id = 1
  const blocks: SiteBlock[] = []
  const a = s.arch

  blocks.push({ id: id++, type: 'hero', props: { heading: s.name, subheading: `${roleLabel}${inCity}${s.tagline ? ' — ' + s.tagline : ''}`, align: 'center', badge: roleLabel, ...(a?.cover ? { image: a.cover } : {}) } })
  if (s.about && s.about.trim().length >= 20) blocks.push({ id: id++, type: 'about', props: { heading: `دربارهٔ ${s.name}`, text: s.about.trim().slice(0, 1500), ...(s.logo ? { image: s.logo } : {}) } })

  // آمارِ واقعی (فقط عددهای ناصفر — هیچ عددِ ساختگی)
  if (a) {
    const items: { label: string; value: string }[] = []
    if (a.projDone) items.push({ label: 'پروژهٔ اجراشده', value: a.projDone.toLocaleString('fa-IR') })
    if (a.projDoing) items.push({ label: 'در حال اجرا', value: a.projDoing.toLocaleString('fa-IR') })
    if (a.honors) items.push({ label: 'جایزه و مقام', value: a.honors.toLocaleString('fa-IR') })
    if (a.rating) items.push({ label: 'امتیاز بازخوردها', value: `${a.rating.toLocaleString('fa-IR')} از ۵` })
    if (items.length >= 2) blocks.push({ id: id++, type: 'stats', props: { items } })
  }

  if (s.specialties.length) blocks.push({ id: id++, type: 'services', props: { heading: 'خدمات و تخصص‌ها', items: s.specialties.slice(0, 9).map(t => ({ title: t })), perSlide: 3 } })

  if (LISTING_TYPES.has(s.roleType)) {
    // جستجو/فیلترِ کاملِ آگهی‌های خودِ شخص (نه فقط اسلایدر) — «فیلتر و امکانات کامل».
    blocks.push({ id: id++, type: 'searchlist', props: { heading: `جستجو در آگهی‌های ${s.name}`, total: 120 } })
    if (s.roleType === 'agency') blocks.push({ id: id++, type: 'team', props: { heading: 'مشاوران ما' } })
  }
  if (CATALOG_TYPES.has(s.roleType)) blocks.push({ id: id++, type: 'catalog', props: { heading: `محصولات ${s.name}` } })

  if (a) {
    if (a.images.length) blocks.push({ id: id++, type: 'gallery', props: { heading: 'نمونه‌کارها و پروژه‌ها', images: a.images.slice(0, 12), perSlide: 3 } })
    if (a.skills.length || a.engagements.length) blocks.push({ id: id++, type: 'services', props: { heading: 'مهارت‌ها و حوزه‌های همکاری', items: [...a.skills, ...a.engagements].slice(0, 9).map(t => ({ title: t })), perSlide: 3 } })
    if (a.edus.length) blocks.push({ id: id++, type: 'services', props: { heading: 'تحصیلات و سوابق', items: a.edus.slice(0, 6).map(t => ({ title: t })), perSlide: 3 } })
  }

  // نظراتِ واقعیِ تاییدشده (بلوک خودش از store می‌خواند — همیشه تازه) + فرمِ ثبت
  blocks.push({ id: id++, type: 'testimonials', props: { heading: 'نظرات مشتریان' } })
  blocks.push({ id: id++, type: 'cta', props: { heading: s.roleType === 'architect' ? 'پروژه‌ای در ذهن دارید؟' : 'به دنبال خرید، فروش یا اجاره هستید؟', subheading: `همین حالا با ${s.name} در ارتباط باشید`, buttonText: s.providerUrl ? 'مشاهدهٔ پروفایل و درخواست مشاوره' : 'تماس با ما', buttonLink: s.providerUrl || '#contact' } })
  blocks.push({ id: id++, type: 'contact', props: { heading: 'تماس با ما', phone: s.contactPhone || s.phone, ...(s.address || s.city || a?.officeName ? { address: [a?.officeName, s.address || s.city].filter(Boolean).join(' — ') } : {}) } })
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

  // لینکِ CTA به صفحهٔ دایرکتوریِ خودِ شخص (فرمِ درخواست/پروفایلِ کامل + لینکِ داخلیِ سئو)
  let providerUrl = ''
  try { const { ensureProviderSlug } = await import('./provider-slug-store'); providerUrl = `/${roleType}/${encodeURIComponent(await ensureProviderSlug(acc.phone, name))}` } catch {}

  // فاز ۲۹۶هـ — دادهٔ کاملِ معمار از طرح‌۲طرح: نمونه‌کارها، آمار، تحصیلات، مهارت‌ها، دفتر.
  let arch: AutoSiteSeed['arch']
  if (roleType === 'architect') {
    try {
      const { getArchitectPublic } = await import('./tarh2tarh-store')
      const t = await getArchitectPublic(acc.phone)
      if (t) {
        arch = {
          cover: t.cover || '',
          images: (t.projects || []).map(pr => pr.image || '').filter(Boolean),
          projDone: t.projDone, projDoing: t.projDoing,
          honors: (t.honor1 || 0) + (t.honor2 || 0) + (t.honor3 || 0) + (t.honorFinal || 0) || undefined,
          rating: t.rating, ratingCount: t.ratingCount,
          edus: t.edus || [], skills: t.skills || [], engagements: t.engagements || [],
          officeName: t.officeName || '',
        }
        if (!logo && t.avatar) logo = t.avatar
      }
    } catch { /* بدونِ دادهٔ طرح‌۲طرح — سایتِ پایه ساخته می‌شود */ }
  }

  return { phone: acc.phone, name, roleType, city, tagline, about, logo, specialties, contactPhone: p.contactPhone || p.landline || '', address: p.address || '', providerUrl, arch }
}

/** جاروِ کرون: هر تیک چند سایتِ جدید + چند پیامکِ معوق. خروجی برای لاگِ عملیاتی. */
export async function sweepAutoSites(maxCreate = 8, maxSms = 4): Promise<{ created: number; sms: number; pending: number }> {
  const cfg = await getAutoSiteCfg()
  if (!cfg.enabled) return { created: 0, sms: 0, pending: 0 }
  const meta = await loadMeta()
  let created = 0, sms = 0, dirty = false

  // یک خواندنِ store برای کلِ تیک (نه به‌ازای هر کاندید).
  const byOwner = new Map<string, { slug: string; updatedAt: number }>()
  for (const st of await listSites()) if (st.owner) byOwner.set(String(st.owner), { slug: st.slug, updatedAt: st.updatedAt })

  const accounts = listAccounts()
  const candidates = accounts.filter(a => !meta.done[a.phone] && urlTypeForRole(a.role))
  for (const acc of candidates) {
    if (created >= maxCreate) break
    const existing = byOwner.get(acc.phone)
    if (existing) {
      // سایتِ دست‌ساز دارد — فقط ثبت می‌کنیم؛ نه بازنویسی، نه پیامک.
      meta.done[acc.phone] = { at: Date.now(), slug: existing.slug, manual: true, smsAt: 0, v: AUTO_SITE_V }
      dirty = true
      continue
    }
    const seed = await seedOf(acc)
    if (!seed) continue   // بی‌نام — تیکِ بعد دوباره دیده می‌شود (شاید پروفایل کامل شود)
    const site = await saveSite(buildAutoSitePayload(seed))
    meta.done[acc.phone] = { at: Date.now(), slug: site.slug, v: AUTO_SITE_V }
    created++; dirty = true
  }

  // فاز ۲۹۶هـ — ارتقای خودکار: سازنده نسخهٔ جدید گرفت → سایت‌های خودکارِ «دست‌نخورده» با
  // چیدمانِ کامل بازسازی می‌شوند. سایتی که صاحبش ویرایش کرده هرگز دست نمی‌خورد.
  let upgraded = 0
  for (const [phone, rec] of Object.entries(meta.done)) {
    if (upgraded >= maxCreate || created >= maxCreate * 2) break
    if (rec.manual || (rec.v || 1) >= AUTO_SITE_V) continue
    const st = byOwner.get(phone)
    if (!st) { rec.v = AUTO_SITE_V; dirty = true; continue }           // سایت حذف شده — کاری نیست
    if (st.updatedAt > rec.at + 120_000) { rec.v = AUTO_SITE_V; dirty = true; continue }   // صاحبش ویرایش کرده — دست نزن
    const acc = accounts.find(x => x.phone === phone)
    if (!acc) { rec.v = AUTO_SITE_V; dirty = true; continue }
    const seed = await seedOf(acc)
    if (!seed) { rec.v = AUTO_SITE_V; dirty = true; continue }
    await saveSite(buildAutoSitePayload(seed))                          // با ownerِ موجود همان slug آپدیت می‌شود
    rec.v = AUTO_SITE_V; rec.at = Date.now(); upgraded++; dirty = true
  }
  if (upgraded) console.log(`[autosite] ${upgraded} سایت به چیدمانِ v${AUTO_SITE_V} ارتقا یافت`)

  // پیامکِ خوش‌آمد — فقط برای سایت‌های خودکار، با سقفِ هر تیک و حداکثر ۳ تلاش.
  if (cfg.sms) {
    for (const [phone, rec] of Object.entries(meta.done)) {
      if (sms >= maxSms) break
      if (rec.manual || rec.smsAt || (rec.smsTries || 0) >= 3) continue
      const name = (getProfile(phone).businessName || getProfile(phone).displayName || listAccounts().find(a => a.phone === phone)?.name || '').trim() || 'همکار'
      try {
        const { sendServiceSms } = await import('./sms')
        const r = await sendServiceSms(phone, `سلام ${name} عزیز؛ سایت اختصاصی شما در ملک‌جت آماده شد:\nhttps://melkjet.com/${encodeURIComponent(rec.slug)}\nآگهی‌ها و پروفایل شما در آن به‌روز نمایش داده می‌شود.`, 'سایت‌ساز ملک‌جت', name)
        if (r.ok) { rec.smsAt = Date.now(); rec.lastErr = ''; sms++ }
        else {
          rec.smsTries = (rec.smsTries || 0) + 1; rec.lastErr = String(r.error || 'خطا').slice(0, 120)
          // قانونِ شمارهٔ یک: پیامکِ نرفته باید فریاد بزند، نه اینکه ۳ تلاش بی‌صدا بسوزد.
          console.error(`[autosite] sms failed phone=${phone} try=${rec.smsTries}: ${rec.lastErr}`)
        }
      } catch (e) { rec.smsTries = (rec.smsTries || 0) + 1; rec.lastErr = String((e as Error)?.message || e).slice(0, 120); console.error(`[autosite] sms threw phone=${phone}: ${rec.lastErr}`) }
      dirty = true
    }
  }

  if (dirty) await saveMeta(meta)
  const pending = listAccounts().filter(a => !meta.done[a.phone] && urlTypeForRole(a.role)).length
  return { created, sms, pending }
}

/** فاز ۲۹۶د — بعد از درست‌شدنِ پیکربندیِ پیامک (پترنِ اتوماسیون)، ناموفق‌ها دوباره در صف می‌آیند. */
export async function resetFailedSms(): Promise<number> {
  const meta = await loadMeta()
  let n = 0
  for (const rec of Object.values(meta.done)) {
    if (!rec.manual && !rec.smsAt && (rec.smsTries || 0) > 0) { rec.smsTries = 0; n++ }
  }
  if (n) await saveMeta(meta)
  return n
}

/** وضعیتِ پیامک‌ها برای پنل: چندتا ناموفقِ قطعی و نمونهٔ آخرین خطا. */
export async function smsStatus(): Promise<{ failed: number; waiting: number; sampleErr: string }> {
  const meta = await loadMeta()
  let failed = 0, waiting = 0, sampleErr = ''
  for (const rec of Object.values(meta.done)) {
    if (rec.manual || rec.smsAt) continue
    if ((rec.smsTries || 0) >= 3) { failed++; if (!sampleErr && rec.lastErr) sampleErr = rec.lastErr }
    else waiting++
  }
  return { failed, waiting, sampleErr }
}
