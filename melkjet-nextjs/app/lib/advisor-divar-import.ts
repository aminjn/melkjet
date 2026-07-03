import { fetchDivarPost, divarToken, divarProfileSlug, fetchDivarProfileTokens, type BrandPost } from './divar-post'
import { addListing, updateListing, publishListing, setListingStatus, deleteListing, getAdvisor, updateAdvisorProfile, type Listing } from './advisor-store'
import { findNeighborhoodInGeo } from './geo-store'
import { warmEnrichment } from './enrich-warm'
import { getDivar, hasToken, recordImport, removeImport, markRun, markSourceRun, clearImports, type AdvisorDivar } from './advisor-divar-store'
import { getJob, setJob, isStale } from './advisor-divar-job'
import { scrapeDivar } from './divar'
import type { Source } from './scraper-store'

// ممیزیِ خودکارِ آگهیِ منتشرشده در پس‌زمینه (مدلِ یادگیرنده → در صورتِ نبودِ اطمینان AI).
// importهای پویا برای پرهیز از حلقهٔ وابستگی؛ fire-and-forget تا جریانِ ایمپورت را کند نکند.
function moderatePublicItem(id: string): void {
  (async () => {
    const [{ moderateOne, moderationModel }, { getItemById }] = await Promise.all([import('./moderation'), import('./scraper-store')])
    const it = getItemById(id)
    if (it) await moderateOne(it, moderationModel())
  })().catch(() => {})
}

export interface ImportResult {
  ok: boolean
  skipped?: boolean
  updated?: boolean
  reason?: string
  listing?: Listing
  token?: string
}

// محله را به «مناطق فعالیتِ» مشاور اضافه می‌کند (برای کشف‌شدن در صفحات پابلیک).
function addAreaToProfile(o: string, neighborhood: string) {
  if (!neighborhood) return
  const prof = getAdvisor(o).profile
  const areas = (prof.areas || '').split('،').map(s => s.trim()).filter(Boolean)
  const norm = (s: string) => s.replace(/‌/g, '').replace(/\s+/g, '')
  if (!areas.some(a => norm(a) === norm(neighborhood))) {
    areas.push(neighborhood)
    updateAdvisorProfile(o, { areas: areas.join('، ') })
  }
}

/** یک آگهیِ دیوار را (با توکن یا لینک) به‌عنوان فایلِ مشاور وارد می‌کند.
 *  hint: عنوان/تصویرِ واقعیِ آگهی از فهرستِ پروفایل (چون API تک‌آگهی گاهی عنوانِ دسته را می‌دهد). */
export async function importDivarToken(o: string, input: string, hint?: BrandPost, sourceId?: string): Promise<ImportResult> {
  const token = divarToken(input)
  if (!token) return { ok: false, reason: 'لینک یا توکنِ دیوار معتبر نیست' }
  // اگر قبلاً وارد شده، به‌جای رد کردن، با دادهٔ تازهٔ دیوار به‌روزرسانی می‌شود.
  const existing = getDivar(o).imports.find(i => i.token === token)

  const cfg = getDivar(o)
  let post
  try { post = await fetchDivarPost(token) } catch (e: any) { return { ok: false, reason: e?.message || 'اتصال به دیوار ناموفق بود', token } }
  if (post.reason && !post.images.length && !post.title && !hint?.title) {
    return { ok: false, reason: `آگهی از دیوار خوانده نشد (${post.reason})`, token }
  }

  // محلهٔ دیوار را به محله‌های موجودِ سایتِ خودمان نگاشت کن (هیچ محلهٔ جدیدی ساخته نمی‌شود).
  let matched: { province: string; city: string; district: string; neighborhood: string } | null = null
  try { matched = findNeighborhoodInGeo(post.city || '', post.neighborhood || '') } catch {}

  // عنوانِ واقعیِ آگهی از hint (فهرستِ پروفایل) مقدّم بر post.title است که گاهی «املاک» می‌دهد.
  const realTitle = (hint?.title && hint.title.trim()) || (post.title && post.title.trim() && post.title.trim() !== 'املاک' ? post.title.trim() : '') || 'آگهی واردشده از دیوار'
  const images = (post.images && post.images.length) ? post.images : (hint?.image ? [hint.image] : [])
  const advisorPhone = getAdvisor(o).profile.phone || ''

  const payload: Partial<Listing> = {
    title: realTitle,
    ptype: post.ptype || 'آپارتمان',
    deal: post.deal === 'rent' ? 'rent' : 'sale',
    price: post.price || 0,
    rentMonthly: post.rentMonthly || undefined,
    location: post.location || hint?.location || '',
    province: matched?.province || undefined,
    city: matched?.city || post.city || undefined,
    district: matched?.district || post.district || undefined,
    neighborhood: matched?.neighborhood || post.neighborhood || undefined,
    lat: typeof post.lat === 'number' ? post.lat : undefined,
    lng: typeof post.lng === 'number' ? post.lng : undefined,
    area: post.area,
    rooms: post.rooms,
    floor: post.floor,
    yearBuilt: post.yearBuilt,
    amenities: post.amenities,
    description: post.description,
    images,
    phone: advisorPhone || undefined,
  }

  if (cfg.autoNeighborhood && matched) addAreaToProfile(o, matched.neighborhood)

  // ── به‌روزرسانیِ آگهیِ موجود (اگر در دیوار تغییر کرده باشد) ──
  if (existing) {
    const updated = updateListing(o, existing.listingId, payload)
    if (!updated) {
      // فایل حذف شده بوده — دوباره به‌عنوان جدید اضافه کن
      removeImport(o, token)
      return importDivarToken(o, input, hint, sourceId)
    }
    let published = updated.published || false
    if (cfg.autoPublish) { const pub = publishListing(o, existing.listingId); published = !!pub; if (pub?.publicId) { warmEnrichment(pub.publicId); moderatePublicItem(pub.publicId) } }   // بازانتشار + پیش‌گرم تحلیل + ممیزی
    recordImport(o, { token, listingId: existing.listingId, title: updated.title, url: `https://divar.ir/v/${token}`, at: existing.at, published, sourceId: sourceId || existing.sourceId })
    return { ok: true, updated: true, listing: updated, token }
  }

  // ── افزودنِ آگهیِ جدید ──
  const listing = addListing(o, payload)
  let published = false
  if (cfg.autoPublish) { const pub = publishListing(o, listing.id); published = !!pub; if (pub?.publicId) { warmEnrichment(pub.publicId); moderatePublicItem(pub.publicId) } }   // پیش‌گرمِ تحلیل + ممیزیِ خودکار
  recordImport(o, { token, listingId: listing.id, title: listing.title, url: `https://divar.ir/v/${token}`, at: Date.now(), published, sourceId })
  return { ok: true, listing, token }
}

function normName(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

export interface SyncResult { ok: boolean; reason?: string; scanned: number; imported: number; updated: number; skipped: number; sold?: number; tokens: string[] }

// چند آگهی را پشت‌سرهم وارد/به‌روزرسانی می‌کند — hint برای عنوان/تصویرِ درست.
async function importTokens(o: string, items: BrandPost[], sourceId?: string, onProgress?: (done: number, total: number) => void): Promise<{ imported: number; updated: number; skipped: number; tokens: string[] }> {
  let imported = 0, updated = 0, skipped = 0
  const done: string[] = []
  const total = items.length
  let i = 0
  let consecutiveFail = 0   // مدارشکن: اگر پروکسی/دیوار قطع است، به‌جای گرفتنِ ۶۶ آگهی (~یک ساعت) زود بیرون بیا.
  for (const it of items) {
    i++
    const token = it.token
    if (token) {
      // یک‌بار تلاشِ مجدد در صورتِ خطای گذرای پروکسی/دیوار (تا یک آگهیِ تکی کلِ کار را خراب نکند).
      // هر آگهی سقفِ ۱۵ ثانیه زمان دارد؛ اگر پروکسی/دیوار هنگ کرد، رد می‌شود تا کل کار قفل نشود.
      let res: any = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await Promise.race([
            importDivarToken(o, token, it, sourceId),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
          ])
          if (res && (res.ok || res.skipped)) break
        } catch { res = null }
        if (attempt === 0) await new Promise(r => setTimeout(r, 500))
      }
      const okThis = !!(res && res.ok)
      if (res && res.ok && res.updated) { updated++ }
      else if (res && res.ok && !res.skipped) { imported++; done.push(token) }
      else skipped++
      // مدارشکن: پس از ۶ شکستِ پیاپی، اتصال قطع فرض می‌شود و کار متوقف می‌شود.
      consecutiveFail = okThis ? 0 : consecutiveFail + 1
      if (consecutiveFail >= 6) throw new Error('اتصال به دیوار برقرار نشد (چند آگهیِ پیاپی خوانده نشد) — پروکسیِ دیوار را در ادمین بررسی کنید.')
    }
    try { onProgress?.(i, total) } catch {}
  }
  return { imported, updated, skipped, tokens: done }
}

/** همهٔ آگهی‌های یک «پروفایلِ پرو/کسب‌وکارِ دیوار» را وارد می‌کند (لینکِ divar.ir/pro/<slug>). */
export async function importDivarProfile(o: string, url: string, sourceId?: string, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const slug = divarProfileSlug(url)
  if (!slug) return { ok: false, reason: 'لینک پروفایل دیوار معتبر نیست', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] }
  const { posts, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) {
    const msg = reason === 'unreachable'
      ? 'اتصال به دیوار برقرار نشد — پروکسیِ دیوار را در ادمین → «اتصال‌ها» بررسی کنید'
      : reason && reason.startsWith('http_')
        ? `دیوار پاسخِ خطای ${reason.replace('http_', '')} داد — لینک را بررسی کنید یا کمی بعد دوباره تلاش کنید`
        : 'آگهی‌ای در این پروفایل خوانده نشد — لینکِ صفحهٔ پروی خودتان را بررسی کنید یا آگهی‌ها را تکی اضافه کنید'
    markRun(o, 0, msg)
    return { ok: false, reason: msg, scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] }
  }
  // آگهی‌هایی که قبلاً وارد شده بودند ولی دیگر در پروفایلِ دیوار نیستند = فروخته/اجاره‌رفته.
  // فقط در محدودهٔ همین اسکرپ (اگر sourceId داده شده) تا اسکرپ‌های دیگر دست‌نخورده بمانند.
  const liveTokens = new Set(posts.map(p => p.token))
  const gone = getDivar(o).imports.filter(i => !liveTokens.has(i.token) && (sourceId ? i.sourceId === sourceId : true))

  onProgress?.(0, posts.length)
  const r = await importTokens(o, posts, sourceId, onProgress)
  const sold = markGone(o, gone)
  markRun(o, r.imported, '')
  return { ok: true, scanned: posts.length, ...r, sold }
}

// آگهی‌هایی که از دیوار حذف شده‌اند را «فروش/اجاره رفته» علامت می‌زند و از سرچِ سایت برمی‌دارد.
function markGone(o: string, gone: { token: string; listingId: string; title: string; url: string; at: number; published: boolean }[]): number {
  if (!gone.length) return 0
  const listings = getAdvisor(o).listings
  let count = 0
  for (const g of gone) {
    const l = listings.find(x => x.id === g.listingId)
    if (!l || l.status !== 'active') continue
    // از پروفایلِ دیوار حذف شده → «فروخته/اجاره‌رفته». روی سایت می‌ماند ولی با مهرِ «فروخته شد / اجاره رفت»
    // (setListingStatus مهر را روی آگهیِ عمومی هم می‌زند) — نه حذفِ کامل، تا هم SEO حفظ شود هم کاربر ببیند.
    setListingStatus(o, l.id, l.deal === 'rent' ? 'rented' : 'sold')
    recordImport(o, { ...g, published: true })
    count++
  }
  return count
}

/** ورودیِ یکپارچه: اگر لینکِ پروفایلِ پرو باشد همهٔ آگهی‌هایش، اگر لینکِ تک‌آگهی باشد همان یکی. */
export async function importDivarFromUrl(o: string, url: string): Promise<{ ok: boolean; reason?: string; profile?: boolean; imported?: number; skipped?: number; scanned?: number; skippedOne?: boolean; listing?: Listing }> {
  if (divarProfileSlug(url)) {
    const r = await importDivarProfile(o, url)
    return { ok: r.ok, reason: r.reason, profile: true, imported: r.imported, skipped: r.skipped, scanned: r.scanned }
  }
  const r = await importDivarToken(o, url)
  return { ok: r.ok, reason: r.reason, profile: false, skippedOne: !!r.skipped, listing: r.listing, imported: r.ok && !r.skipped ? 1 : 0 }
}

/** چند ورودی را با هم پردازش می‌کند: کاربر می‌تواند چند لینکِ آگهی (هر کدام در یک خط یا
 *  جداشده با فاصله) یا یک لینکِ پروفایلِ پرو را بچسباند. همه وارد می‌شوند. */
export async function importDivarInput(o: string, raw: string): Promise<{ ok: boolean; reason?: string; imported: number; updated: number; skipped: number; failed: number; sold: number; profile: boolean }> {
  const parts = Array.from(new Set(String(raw || '').split(/[\s,،]+/).map(s => s.trim()).filter(Boolean)))
  if (!parts.length) return { ok: false, reason: 'لینکی وارد نشده', imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0, profile: false }

  let imported = 0, updated = 0, skipped = 0, failed = 0, sold = 0, profile = false
  let firstErr = ''
  for (const part of parts) {
    if (divarProfileSlug(part)) {
      profile = true
      const r = await importDivarProfile(o, part)
      if (r.ok) { imported += r.imported; updated += r.updated; skipped += r.skipped; sold += (r.sold || 0) } else { failed++; firstErr = firstErr || (r.reason || '') }
    } else {
      const r = await importDivarToken(o, part)
      if (r.ok && r.updated) updated++
      else if (r.ok && !r.skipped) imported++
      else if (r.ok && r.skipped) skipped++
      else { failed++; firstErr = firstErr || (r.reason || '') }
    }
  }
  return { ok: imported > 0 || updated > 0 || sold > 0 || (failed === 0 && skipped > 0), reason: (imported || updated) ? '' : firstErr, imported, updated, skipped, failed, sold, profile }
}

/** آگهی‌های مشاور را از روی لینکِ ذخیره‌شده سینک می‌کند: لینکِ پروفایلِ پرو → همهٔ آگهی‌های او؛
 *  لینکِ جستجو/نقشه → آگهی‌هایی که نامِ آگهی‌دهنده با «نام دیوار»‌ِ مشاور می‌خواند (نام الزامی است). */
export async function syncAdvisorDivar(o: string, cfgIn?: AdvisorDivar, sourceId?: string, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const cfg = cfgIn || getDivar(o)
  if (!cfg.searchUrl) { markRun(o, 0, 'لینک دیوار تنظیم نشده'); return { ok: false, reason: 'لینک دیوار تنظیم نشده', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] } }

  // اگر لینکِ پروفایلِ پرو است، همهٔ آگهی‌های همان پروفایل (همگی متعلق به خودِ مشاور).
  if (divarProfileSlug(cfg.searchUrl)) return importDivarProfile(o, cfg.searchUrl, sourceId, onProgress)

  // لینکِ جستجو/نقشه: برای جلوگیری از ورودِ آگهی‌های دیگران، «نام دیوار» الزامی است.
  const want = normName(cfg.divarName)
  if (!want) { markRun(o, 0, 'برای همگام‌سازیِ جستجو، «نام شما در دیوار» را پر کنید (یا لینکِ پروفایلِ پرو بدهید)'); return { ok: false, reason: 'برای همگام‌سازیِ جستجو، «نام شما در دیوار» را پر کنید یا لینکِ پروفایلِ پرو بدهید', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] } }

  let rows
  try {
    rows = await scrapeDivar({ url: cfg.searchUrl, meta: {} } as unknown as Source)
  } catch (e: any) {
    markRun(o, 0, e?.message || 'خطا در خواندن دیوار')
    return { ok: false, reason: e?.message || 'خطا در خواندن دیوار', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] }
  }

  const mine = rows.filter(r => {
    if (!r.url) return false
    const owner = normName(r.owner || '')
    return owner && (owner === want || owner.includes(want) || want.includes(owner))
  })

  const items: BrandPost[] = mine.map(x => ({ token: divarToken(x.url || '') || '', title: x.title, price: x.price, location: x.location, image: x.image })).filter(it => it.token)
  onProgress?.(0, items.length)
  const r = await importTokens(o, items, sourceId, onProgress)
  markRun(o, r.imported, r.imported || mine.length ? '' : 'آگهیِ منطبقی با نامِ شما پیدا نشد')
  return { ok: true, scanned: rows.length, ...r }
}

// ── همگام‌سازیِ پس‌زمینه: کار را شروع می‌کند و بلافاصله برمی‌گردد؛ تا پایان ادامه می‌یابد
//    حتی اگر کاربر صفحه را ببندد. پیشرفت در فایلِ jobها ذخیره می‌شود تا UI بپاید. ─────
export function startBackgroundSync(o: string, cfgIn?: AdvisorDivar, sourceId?: string, label?: string): { started: boolean; alreadyRunning?: boolean } {
  const cur = getJob(o)
  if (cur.running && !isStale(cur)) return { started: false, alreadyRunning: true }
  setJob(o, { running: true, total: 0, done: 0, imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0, error: '', label: label || 'همگام‌سازیِ دیوار', startedAt: Date.now(), lastProgressAt: Date.now(), finishedAt: undefined })
  // عمداً await نمی‌کنیم — در پس‌زمینهٔ همین ورکر تا تهِ کار اجرا می‌شود.
  ;(async () => {
    const DEADLINE = 5 * 60 * 1000   // سقفِ کلِ کار: اگر پروکسی/دیوار پاسخ نداد، بعد از ۵ دقیقه قطعاً متوقف می‌شود
    try {
      const onProgress = (done: number, total: number) => setJob(o, { done, total, lastProgressAt: Date.now() })
      const r = await Promise.race([
        syncAdvisorDivar(o, cfgIn, sourceId, onProgress),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('همگام‌سازی بیش از حد طول کشید (پروکسی/دیوار پاسخ نداد) و متوقف شد. اتصالِ پروکسی را بررسی کنید.')), DEADLINE)),
      ])
      if (sourceId) markSourceRun(o, sourceId, r.imported || 0, r.ok ? '' : (r.reason || 'خطا'))
      setJob(o, { running: false, finishedAt: Date.now(), imported: r.imported || 0, updated: r.updated || 0, skipped: r.skipped || 0, sold: r.sold || 0, error: r.ok ? '' : (r.reason || 'همگام‌سازی ناموفق بود') })
    } catch (e: any) {
      // مهم: حتی در خطا/وقفه هم lastRun را آپدیت کن تا کرون این منبع را بی‌وقفه هر ۵ دقیقه دوباره اجرا نکند.
      if (sourceId) { try { markSourceRun(o, sourceId, 0, e?.message || 'خطا یا وقفه') } catch {} }
      setJob(o, { running: false, finishedAt: Date.now(), error: e?.message || 'خطای داخلی هنگامِ همگام‌سازی' })
    }
  })()
  return { started: true }
}

/** همهٔ آگهی‌های واردشده از دیوار را پاک می‌کند (فایل + نسخهٔ عمومی) و فهرست را خالی می‌کند. */
export function clearDivarImports(o: string): { removed: number } {
  const imports = getDivar(o).imports
  let removed = 0
  for (const im of imports) { try { deleteListing(o, im.listingId); removed++ } catch {} }
  clearImports(o)
  return { removed }
}
