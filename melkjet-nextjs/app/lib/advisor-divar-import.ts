import { fetchDivarPost, divarToken, divarProfileSlug, fetchDivarProfileTokens, type BrandPost } from './divar-post'
import { addListing, publishListing, deleteListing, getAdvisor, updateAdvisorProfile, type Listing } from './advisor-store'
import { findNeighborhoodInGeo } from './geo-store'
import { getDivar, hasToken, recordImport, markRun, clearImports, type AdvisorDivar } from './advisor-divar-store'
import { scrapeDivar } from './divar'
import type { Source } from './scraper-store'

export interface ImportResult {
  ok: boolean
  skipped?: boolean
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
export async function importDivarToken(o: string, input: string, hint?: BrandPost): Promise<ImportResult> {
  const token = divarToken(input)
  if (!token) return { ok: false, reason: 'لینک یا توکنِ دیوار معتبر نیست' }
  if (hasToken(o, token)) return { ok: true, skipped: true, reason: 'این آگهی قبلاً وارد شده', token }

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
  const listing = addListing(o, {
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
  })

  // فقط اگر محلهٔ دیوار با یکی از محله‌های موجودِ سایت خواند، آن را به مناطقِ مشاور اضافه کن.
  if (cfg.autoNeighborhood && matched) addAreaToProfile(o, matched.neighborhood)

  let published = false
  if (cfg.autoPublish) {
    const r = publishListing(o, listing.id)
    published = !!r
  }

  recordImport(o, { token, listingId: listing.id, title: listing.title, url: `https://divar.ir/v/${token}`, at: Date.now(), published })
  return { ok: true, listing, token }
}

function normName(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

export interface SyncResult { ok: boolean; reason?: string; scanned: number; imported: number; skipped: number; tokens: string[] }

// چند آگهی را پشت‌سرهم وارد می‌کند (با حذفِ تکراری‌ها) — hint برای عنوان/تصویرِ درست.
async function importTokens(o: string, items: BrandPost[]): Promise<{ imported: number; skipped: number; tokens: string[] }> {
  let imported = 0, skipped = 0
  const done: string[] = []
  for (const it of items) {
    const token = it.token
    if (!token) continue
    if (hasToken(o, token)) { skipped++; continue }
    try {
      const res = await importDivarToken(o, token, it)
      if (res.ok && !res.skipped) { imported++; done.push(token) } else skipped++
    } catch { skipped++ }
  }
  return { imported, skipped, tokens: done }
}

/** همهٔ آگهی‌های یک «پروفایلِ پرو/کسب‌وکارِ دیوار» را وارد می‌کند (لینکِ divar.ir/pro/<slug>). */
export async function importDivarProfile(o: string, url: string): Promise<SyncResult> {
  const slug = divarProfileSlug(url)
  if (!slug) return { ok: false, reason: 'لینک پروفایل دیوار معتبر نیست', scanned: 0, imported: 0, skipped: 0, tokens: [] }
  const { posts, reason } = await fetchDivarProfileTokens(slug)
  if (!posts.length) {
    const msg = reason === 'unreachable' ? 'اتصال به دیوار ناموفق بود (پروکسی را بررسی کنید)' : 'آگهی‌ای در این پروفایل پیدا نشد — می‌توانید لینکِ تک‌تکِ آگهی‌ها را اضافه کنید'
    markRun(o, 0, msg)
    return { ok: false, reason: msg, scanned: 0, imported: 0, skipped: 0, tokens: [] }
  }
  const r = await importTokens(o, posts)
  markRun(o, r.imported, '')
  return { ok: true, scanned: posts.length, ...r }
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
export async function importDivarInput(o: string, raw: string): Promise<{ ok: boolean; reason?: string; imported: number; skipped: number; failed: number; profile: boolean }> {
  const parts = Array.from(new Set(String(raw || '').split(/[\s,،]+/).map(s => s.trim()).filter(Boolean)))
  if (!parts.length) return { ok: false, reason: 'لینکی وارد نشده', imported: 0, skipped: 0, failed: 0, profile: false }

  let imported = 0, skipped = 0, failed = 0, profile = false
  let firstErr = ''
  for (const part of parts) {
    if (divarProfileSlug(part)) {
      profile = true
      const r = await importDivarProfile(o, part)
      if (r.ok) { imported += r.imported; skipped += r.skipped } else { failed++; firstErr = firstErr || (r.reason || '') }
    } else {
      const r = await importDivarToken(o, part)
      if (r.ok && !r.skipped) imported++
      else if (r.ok && r.skipped) skipped++
      else { failed++; firstErr = firstErr || (r.reason || '') }
    }
  }
  return { ok: imported > 0 || (failed === 0 && skipped > 0), reason: imported ? '' : firstErr, imported, skipped, failed, profile }
}

/** آگهی‌های مشاور را از روی لینکِ ذخیره‌شده سینک می‌کند: لینکِ پروفایلِ پرو → همهٔ آگهی‌های او؛
 *  لینکِ جستجو/نقشه → آگهی‌هایی که نامِ آگهی‌دهنده با «نام دیوار»‌ِ مشاور می‌خواند (نام الزامی است). */
export async function syncAdvisorDivar(o: string, cfgIn?: AdvisorDivar): Promise<SyncResult> {
  const cfg = cfgIn || getDivar(o)
  if (!cfg.searchUrl) { markRun(o, 0, 'لینک دیوار تنظیم نشده'); return { ok: false, reason: 'لینک دیوار تنظیم نشده', scanned: 0, imported: 0, skipped: 0, tokens: [] } }

  // اگر لینکِ پروفایلِ پرو است، همهٔ آگهی‌های همان پروفایل (همگی متعلق به خودِ مشاور).
  if (divarProfileSlug(cfg.searchUrl)) return importDivarProfile(o, cfg.searchUrl)

  // لینکِ جستجو/نقشه: برای جلوگیری از ورودِ آگهی‌های دیگران، «نام دیوار» الزامی است.
  const want = normName(cfg.divarName)
  if (!want) { markRun(o, 0, 'برای همگام‌سازیِ جستجو، «نام شما در دیوار» را پر کنید (یا لینکِ پروفایلِ پرو بدهید)'); return { ok: false, reason: 'برای همگام‌سازیِ جستجو، «نام شما در دیوار» را پر کنید یا لینکِ پروفایلِ پرو بدهید', scanned: 0, imported: 0, skipped: 0, tokens: [] } }

  let rows
  try {
    rows = await scrapeDivar({ url: cfg.searchUrl, meta: {} } as unknown as Source)
  } catch (e: any) {
    markRun(o, 0, e?.message || 'خطا در خواندن دیوار')
    return { ok: false, reason: e?.message || 'خطا در خواندن دیوار', scanned: 0, imported: 0, skipped: 0, tokens: [] }
  }

  const mine = rows.filter(r => {
    if (!r.url) return false
    const owner = normName(r.owner || '')
    return owner && (owner === want || owner.includes(want) || want.includes(owner))
  })

  const items: BrandPost[] = mine.map(x => ({ token: divarToken(x.url || '') || '', title: x.title, price: x.price, location: x.location, image: x.image })).filter(it => it.token)
  const r = await importTokens(o, items)
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
