import { kvGet, kvSet, pgEnabled } from './db'
import { listAccounts, type Account } from './account-store'
import { getProfile, type BusinessProfile } from './profile-store'
import { listSiteHeads, saveSite, sanitizeSlug } from './sites-store'
import { buildProfileSite, STARTER_TEMPLATES, type TplBlock } from './site-templates'
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
export const AUTO_SITE_V = 5

// نگاشتِ نوعِ دایرکتوری → پروفایلِ قالب‌های سایت‌ساز (همان گروه‌هایی که ابزار دارد).
const TYPE_TO_PROFILE: Record<string, string> = {
  pros: 'مشاور', agency: 'آژانس', builder: 'سازنده', architect: 'معمار', contractor: 'پیمانکار',
  materials: 'فروشگاه', legal: 'حقوقی', lawfirm: 'دفتر حقوقی', finance: 'بانک و بیمه',
  appraiser: 'کارشناس', notary: 'دفترخانه',
}

/** بدنهٔ سایتِ خودکار — فاز ۲۹۷هـ («باید با حرفه‌ای‌ترین گرافیکِ خودِ سایت‌ساز و همهٔ
 *  صفحات ساخته بشه»): دیگر چیدمانِ دستی نیست؛ «خودِ» موتورِ قالبِ سایت‌ساز
 *  (buildProfileSite: قالبِ صنفی + پالتِ تم + صفحاتِ کاملِ هر پنل: درباره/فایل‌ها یا
 *  نمونه‌کارها یا محصولات/خدمات/تیم/وبلاگ/تماس) سایت را می‌سازد و بعد با دادهٔ «واقعیِ»
 *  خودِ شخص شخصی‌سازی می‌شود. قانونِ آهنین پابرجاست: روی سایتِ یک شخصِ واقعی هیچ عددِ
 *  ساختگی و هیچ عکس/نظرِ جعلی نمی‌نشیند — آمارِ بی‌سند حذف می‌شود، نه جعل.
 *  قالبِ هر شخص از بینِ ۱۰ قالبِ صنفش «قطعی از روی شماره‌اش» انتخاب می‌شود تا سایت‌ها
 *  متنوع ولی در بازسازی‌ها پایدار باشند. خالص و تست‌پذیر. */
export function buildAutoSitePayload(s: AutoSiteSeed) {
  const roleLabel = typeLabel(s.roleType)
  const inCity = s.city ? ` در ${s.city}` : ''
  const a = s.arch
  const profile = TYPE_TO_PROFILE[s.roleType] || 'عمومی'
  let h = 0; for (const ch of s.phone) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const tpls = STARTER_TEMPLATES.filter(t => t.profile === profile)
  const built = buildProfileSite(profile, tpls.length ? tpls[h % tpls.length] : undefined)

  // دادهٔ واقعیِ شخص — تنها چیزی که حق دارد جای محتوای نمونهٔ قالب بنشیند.
  const statItems: { label: string; value: string }[] = []
  if (a) {
    if (a.projDone) statItems.push({ label: 'پروژهٔ اجراشده', value: a.projDone.toLocaleString('fa-IR') })
    if (a.projDoing) statItems.push({ label: 'در حال اجرا', value: a.projDoing.toLocaleString('fa-IR') })
    if (a.honors) statItems.push({ label: 'جایزه و مقام', value: a.honors.toLocaleString('fa-IR') })
    if (a.rating) statItems.push({ label: 'امتیاز بازخوردها', value: `${a.rating.toLocaleString('fa-IR')} از ۵` })
  }
  const realServices = [...s.specialties, ...(a ? [...a.skills, ...a.engagements] : [])].filter(Boolean).slice(0, 9)
  const realEdus = (a?.edus || []).filter(Boolean).slice(0, 6)
  const galleryImages = (a?.images || []).filter(Boolean)
  const realAbout = s.about && s.about.trim().length >= 20 ? s.about.trim().slice(0, 1500) : ''
  const contactPhone = s.contactPhone || s.phone
  const address = [a?.officeName, s.address || s.city].filter(Boolean).join(' — ')

  const pages = built.pages.map((pg, pi) => {
    const blocks = pg.blocks.map(b => {
      const p = { ...b.props }
      switch (b.type) {
        case 'hero':
          // فقط هیروی صفحهٔ اصلی شخصی می‌شود؛ هیروی صفحه‌های داخلی («درباره ما»…) عمومی و درست است.
          if (pi === 0) { p.heading = s.name; p.subheading = `${roleLabel}${inCity}${s.tagline ? ' — ' + s.tagline : ''}`; p.eyebrow = roleLabel; if (a?.cover) p.image = a.cover }
          return { ...b, props: p }
        case 'stats':
          // قانونِ آهنین: آمارِ نمونهٔ قالب («۵۰۰+ ملک فروخته») روی شخصِ واقعی جعل است — واقعی یا هیچ.
          if (statItems.length >= 2) { p.items = statItems; return { ...b, props: p } }
          return null
        case 'services':
          if (realServices.length) { p.heading = 'خدمات و تخصص‌ها'; p.items = realServices.map(t => ({ icon: '◈', title: t, desc: '' })) }
          return { ...b, props: p }   // بدونِ دادهٔ واقعی: خدماتِ صنفیِ خودِ قالب (توصیفِ حرفه، نه ادعای عددی)
        case 'gallery':
          // گالری فقط با عکس‌های واقعیِ خودِ شخص؛ خالی/نمونه حذف می‌شود.
          if (galleryImages.length) { p.images = galleryImages.slice(0, pi === 0 ? 9 : 24); return { ...b, props: p } }
          return null
        case 'about':
          if (realAbout) { p.heading = `دربارهٔ ${s.name}`; p.text = realAbout }
          if (s.logo) p.image = s.logo
          return { ...b, props: p }
        case 'listings': p.heading = `آخرین آگهی‌های ${s.name}`; return { ...b, props: p }
        case 'searchlist': p.heading = `جستجو در آگهی‌های ${s.name}`; p.total = 120; return { ...b, props: p }
        case 'catalog': p.heading = `محصولات ${s.name}`; return { ...b, props: p }
        case 'cta':
          if (s.providerUrl) { p.buttonLink = s.providerUrl; p.buttonText = 'مشاهدهٔ پروفایل و درخواست مشاوره' }
          return { ...b, props: p }
        case 'contact': p.phone = contactPhone; p.email = ''; if (address) p.address = address; else p.address = ''; return { ...b, props: p }
        case 'footer': p.brand = s.name; p.phone = contactPhone; p.email = ''; p.address = address; return { ...b, props: p }
        default: return { ...b, props: p }
      }
    }).filter((b): b is TplBlock => !!b)
    // تحصیلات و سوابقِ واقعیِ معمار — روی صفحهٔ «درباره» (قبل از فوتر).
    if (pg.slug === 'about' && realEdus.length) {
      blocks.splice(Math.max(blocks.length - 1, 0), 0, { id: 9000 + pi, type: 'services', props: { heading: 'تحصیلات و سوابق', items: realEdus.map(t => ({ icon: '◈', title: t, desc: '' })), perSlide: 3 } })
    }
    return { ...pg, blocks }
  })
  // صفحه‌ای که بعد از حذفِ محتوای بی‌سند فقط هیرو/اقدام/فوتر برایش مانده، حذف می‌شود —
  // صفحهٔ خالی در منو ضدِ «حسِ سایت» است. صفحهٔ خانه همیشه می‌ماند.
  const chrome = new Set(['hero', 'cta', 'footer'])
  const finalPages = pages.filter((pg, i) => i === 0 || pg.blocks.some(b => !chrome.has(b.type)))

  // سئو از واقعیت‌های ساخت‌یافته — عنوانی که با «نامِ شخص» شروع می‌شود (هدف: جست‌وجوی نام).
  const seoTitle = `${s.name} | ${roleLabel}${inCity}`.slice(0, 70)
  const seoDesc = `${s.name}، ${roleLabel}${inCity}${s.specialties.length ? `؛ تخصص: ${s.specialties.slice(0, 3).join('، ')}` : ''}. آگهی‌ها، خدمات و اطلاعاتِ تماس در سایتِ اختصاصیِ ${s.name} در ملک‌جت.`.slice(0, 160)
  return {
    slug: sanitizeSlug(s.name),
    title: s.name,
    owner: s.phone,
    ownerName: s.name,
    theme: built.theme,
    pages: finalPages,
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

  // فاز ۲۹۷ — فقط سرصفحه‌های سبک (یک ردیفِ ایندکس)، نه سندهای کاملِ هزاران سایت.
  const byOwner = new Map<string, { slug: string; updatedAt: number }>()
  for (const st of await listSiteHeads()) if (st.owner) byOwner.set(st.owner, { slug: st.slug, updatedAt: st.updatedAt })

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
      // فاز ۲۹۷ج — حسابِ با کلیدِ شمارهٔ ثابت (مثلاً آژانسِ ۰۲۱…) هرگز پیامک نمی‌گیرد؛
      // تلاش برایش فقط «شمارهٔ نامعتبر» و چرخیدنِ بی‌پایانِ صفِ retry است → ناموفقِ قطعی.
      if (!/^09\d{9}$/.test(phone)) { rec.smsTries = 3; rec.lastErr = 'شمارهٔ ثابت/غیرموبایل — پیامک ممکن نیست'; dirty = true; continue }
      const name = (getProfile(phone).businessName || getProfile(phone).displayName || listAccounts().find(a => a.phone === phone)?.name || '').trim() || 'همکار'
      try {
        // فاز ۲۹۷ب — پترنِ اختصاصیِ سایت‌ساز (متنِ پیامک از خودِ پترنِ ثبت‌شده می‌آید).
        const { sendAutoSiteSms } = await import('./sms')
        const r = await sendAutoSiteSms(phone, name, `https://melkjet.com/${encodeURIComponent(rec.slug)}`)
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

/** فاز ۲۹۶د — بعد از درست‌شدنِ پیکربندیِ پیامک (پترنِ اتوماسیون)، ناموفق‌ها دوباره در صف می‌آیند.
 *  فاز ۲۹۷ج: شماره‌های ثابت/غیرموبایل بازنشانی نمی‌شوند — پیامک به آنها هرگز ممکن نیست. */
export async function resetFailedSms(): Promise<number> {
  const meta = await loadMeta()
  let n = 0
  for (const [phone, rec] of Object.entries(meta.done)) {
    if (!rec.manual && !rec.smsAt && (rec.smsTries || 0) > 0 && /^09\d{9}$/.test(phone)) { rec.smsTries = 0; n++ }
  }
  if (n) await saveMeta(meta)
  return n
}

/** وضعیتِ پیامک‌ها برای پنل: ناموفقِ قطعی (تفکیکِ شمارهٔ ثابت) و نمونهٔ آخرین خطا. */
export async function smsStatus(): Promise<{ failed: number; invalid: number; waiting: number; sampleErr: string }> {
  const meta = await loadMeta()
  let failed = 0, invalid = 0, waiting = 0, sampleErr = ''
  for (const [phone, rec] of Object.entries(meta.done)) {
    if (rec.manual || rec.smsAt) continue
    if ((rec.smsTries || 0) >= 3) {
      if (!/^09\d{9}$/.test(phone)) invalid++
      else { failed++; if (!sampleErr && rec.lastErr) sampleErr = rec.lastErr }
    } else waiting++
  }
  return { failed, invalid, waiting, sampleErr }
}
