import { fetchDivarPost, divarToken, divarProfileSlug, fetchDivarProfileTokens, type BrandPost } from './divar-post'
import { addListing, updateListing, publishListing, unpublishListing, setListingStatus, deleteListing, getAdvisor, updateAdvisorProfile, type Listing } from './advisor-store'
import { findNeighborhoodInGeo } from './geo-store'
import { warmEnrichment } from './enrich-warm'
import { getDivar, hasToken, recordImport, removeImport, markRun, clearImports, type AdvisorDivar } from './advisor-divar-store'
import { scrapeDivar } from './divar'
import type { Source } from './scraper-store'

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
    if (cfg.autoPublish) { const pub = publishListing(o, existing.listingId); published = !!pub; if (pub?.publicId) warmEnrichment(pub.publicId) }   // بازانتشار + پیش‌گرم تحلیل
    recordImport(o, { token, listingId: existing.listingId, title: updated.title, url: `https://divar.ir/v/${token}`, at: existing.at, published, sourceId: sourceId || existing.sourceId })
    return { ok: true, updated: true, listing: updated, token }
  }

  // ── افزودنِ آگهیِ جدید ──
  const listing = addListing(o, payload)
  let published = false
  if (cfg.autoPublish) { const pub = publishListing(o, listing.id); published = !!pub; if (pub?.publicId) warmEnrichment(pub.publicId) }   // تحلیلِ AI در پس‌زمینه پیش‌گرم می‌شود
  recordImport(o, { token, listingId: listing.id, title: listing.title, url: `https://divar.ir/v/${token}`, at: Date.now(), published, sourceId })
  return { ok: true, listing, token }
}

function normName(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

export interface SyncResult { ok: boolean; reason?: string; scanned: number; imported: number; updated: number; skipped: number; sold?: number; tokens: string[] }

// چند آگهی را پشت‌سرهم وارد/به‌روزرسانی می‌کند — hint برای عنوان/تصویرِ درست.
async function importTokens(o: string, items: BrandPost[], sourceId?: string): Promise<{ imported: number; updated: number; skipped: number; tokens: string[] }> {
  let imported = 0, updated = 0, skipped = 0
  const done: string[] = []
  for (const it of items) {
    const token = it.token
    if (!token) continue
    try {
      const res = await importDivarToken(o, token, it, sourceId)   // موجود را به‌روز می‌کند، جدید را اضافه
      if (res.ok && res.updated) { updated++ }
      else if (res.ok && !res.skipped) { imported++; done.push(token) }
      else skipped++
    } catch { skipped++ }
  }
  return { imported, updated, skipped, tokens: done }
}

/** همهٔ آگهی‌های یک «پروفایلِ پرو/کسب‌وکارِ دیوار» را وارد می‌کند (لینکِ divar.ir/pro/<slug>). */
export async function importDivarProfile(o: string, url: string, sourceId?: string): Promise<SyncResult> {
  const slug = divarProfileSlug(url)
  if (!slug) return { ok: false, reason: 'لینک پروفایل دیوار معتبر نیست', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] }
  const { posts, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) {
    const msg = reason === 'unreachable' ? 'اتصال به دیوار ناموفق بود (پروکسی را بررسی کنید)' : 'آگهی‌ای در این پروفایل پیدا نشد — می‌توانید لینکِ تک‌تکِ آگهی‌ها را اضافه کنید'
    markRun(o, 0, msg)
    return { ok: false, reason: msg, scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] }
  }
  // آگهی‌هایی که قبلاً وارد شده بودند ولی دیگر در پروفایلِ دیوار نیستند = فروخته/اجاره‌رفته.
  // فقط در محدودهٔ همین اسکرپ (اگر sourceId داده شده) تا اسکرپ‌های دیگر دست‌نخورده بمانند.
  const liveTokens = new Set(posts.map(p => p.token))
  const gone = getDivar(o).imports.filter(i => !liveTokens.has(i.token) && (sourceId ? i.sourceId === sourceId : true))

  const r = await importTokens(o, posts, sourceId)
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
    setListingStatus(o, l.id, l.deal === 'rent' ? 'rented' : 'sold')
    unpublishListing(o, l.id)   // از سرچِ سایت حذف می‌شود
    recordImport(o, { ...g, published: false })
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
export async function syncAdvisorDivar(o: string, cfgIn?: AdvisorDivar, sourceId?: string): Promise<SyncResult> {
  const cfg = cfgIn || getDivar(o)
  if (!cfg.searchUrl) { markRun(o, 0, 'لینک دیوار تنظیم نشده'); return { ok: false, reason: 'لینک دیوار تنظیم نشده', scanned: 0, imported: 0, updated: 0, skipped: 0, tokens: [] } }

  // اگر لینکِ پروفایلِ پرو است، همهٔ آگهی‌های همان پروفایل (همگی متعلق به خودِ مشاور).
  if (divarProfileSlug(cfg.searchUrl)) return importDivarProfile(o, cfg.searchUrl, sourceId)

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
  const r = await importTokens(o, items, sourceId)
  markRun(o, r.imported, r.imported || mine.length ? '' : 'آگهیِ منطبقی با نامِ شما پیدا نشد')
  return { ok: true, scanned: rows.length, ...r }
}

/** همهٔ آگهی‌های واردشده از دیوار را پاک می‌کند (فایل + نسخهٔ عمومی) و فهرست را خالی می‌کند. */
export function clearDivarImports(o: string): { removed: number } {
  const imports = getDivar(o).imports
  let removed = 0
  for (const im of imports) { try { deleteListing(o, im.listingId); removed++ } catch {} }
  clearImports(o)
  return { removed }
}
