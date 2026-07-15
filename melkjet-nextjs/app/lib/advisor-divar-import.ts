import { fetchDivarPost, divarToken, divarProfileSlug, fetchDivarProfileTokens, type BrandPost } from './divar-post'
import { addListing, updateListing, publishListing, setListingStatus, deleteListing, getAdvisor, updateAdvisorProfile, type Listing } from './advisor-store'
import { findNeighborhoodInGeo } from './geo-store'
import { warmEnrichment } from './enrich-warm'
import { getDivar, hasToken, recordImport, removeImport, markRun, markSourceRun, clearImports, type AdvisorDivar } from './advisor-divar-store'
import { getJob, setJob, isStale , appendJobLog } from './advisor-divar-job'
import { scrapeDivar } from './divar'
import type { Source } from './scraper-store'

// (ممیزیِ per-listing حذف شد؛ ممیزی حالا دسته‌ای و روی اینستنسِ ۰ توسطِ کرون انجام می‌شود.)

export interface ImportResult {
  ok: boolean
  skipped?: boolean
  updated?: boolean
  reason?: string
  listing?: Listing
  token?: string
}

// محله را به «مناطق فعالیتِ» مشاور اضافه می‌کند (برای کشف‌شدن در صفحات پابلیک).
async function addAreaToProfile(o: string, neighborhood: string) {
  if (!neighborhood) return
  const prof = (await getAdvisor(o)).profile
  const areas = (prof.areas || '').split('،').map(s => s.trim()).filter(Boolean)
  const norm = (s: string) => s.replace(/‌/g, '').replace(/\s+/g, '')
  if (!areas.some(a => norm(a) === norm(neighborhood))) {
    areas.push(neighborhood)
    await updateAdvisorProfile(o, { areas: areas.join('، ') })
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
  const advisorPhone = (await getAdvisor(o)).profile.phone || ''

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

  if (cfg.autoNeighborhood && matched) await addAreaToProfile(o, matched.neighborhood)

  // ── به‌روزرسانیِ آگهیِ موجود (اگر در دیوار تغییر کرده باشد) ──
  if (existing) {
    const updated = await updateListing(o, existing.listingId, payload)
    if (!updated) {
      // فایل حذف شده بوده — دوباره به‌عنوان جدید اضافه کن
      removeImport(o, token)
      return importDivarToken(o, input, hint, sourceId)
    }
    // آگهی روی دیوار زنده است ولی فایل مهرِ فروخته/اجاره‌رفته دارد (بازنشر) → فعال برگردد، نه نسخهٔ دوم
    if (updated.status !== 'active') await setListingStatus(o, existing.listingId, 'active')
    let published = updated.published || false
    if (cfg.autoPublish) { const pub = await publishListing(o, existing.listingId); published = !!pub; if (pub?.publicId) warmEnrichment(pub.publicId) }   // بازانتشار + پیش‌گرمِ تحلیل (ممیزی دسته‌ای توسطِ کرون)
    recordImport(o, { token, listingId: existing.listingId, title: updated.title, url: `https://divar.ir/v/${token}`, at: existing.at, published, sourceId: sourceId || existing.sourceId })
    return { ok: true, updated: true, listing: updated, token }
  }

  // ── جلوگیری از تکراری: دیوار اغلب همان ملک را با «توکنِ جدید» بازنشر می‌کند (توکنِ قبلی می‌میرد)،
  //    پس تطبیقِ توکنی رد می‌شود و آگهیِ تکراری ساخته می‌شد. تطبیقِ محتوایی با موتورِ ویژگی‌محور
  //    (متن+متراژ+قیمت+اتاق+محله، شباهت≥۰٫۸۵ — نه فقط عنوانِ دقیقاً یکسان) → همان فایل به‌روزرسانی
  //    و توکنِ جدید به آن نگاشت می‌شود (نه ساختِ نسخهٔ دوم). ──
  const { fieldsFromParts, similarity, DUP_THRESHOLD } = await import('./listing-similarity')
  const probe = fieldsFromParts({ deal: payload.deal, title: payload.title, hood: payload.neighborhood || payload.district, price: payload.price, area: payload.area, rooms: payload.rooms })
  const mineListings = (await getAdvisor(o)).listings || []
  let twin: (typeof mineListings)[number] | undefined
  let bestSim = DUP_THRESHOLD - 1e-9
  for (const l of mineListings) {
    const s = similarity(fieldsFromParts({ deal: l.deal, title: l.title, hood: l.neighborhood || l.district, price: l.price, area: l.area, rooms: l.rooms }), probe)
    if (s > bestSim) { bestSim = s; twin = l }
  }
  if (twin) {
    const updated = await updateListing(o, twin.id, payload)
    // بازنشرِ همان ملک با توکنِ جدید در حالی که فایل مهرِ فروخته/اجاره‌رفته خورده → فعال برگردد
    if (updated && updated.status !== 'active') await setListingStatus(o, twin.id, 'active')
    let published = updated?.published || false
    if (cfg.autoPublish && updated) { const pub = await publishListing(o, twin.id); published = !!pub; if (pub?.publicId) warmEnrichment(pub.publicId) }
    recordImport(o, { token, listingId: twin.id, title: (updated || twin).title, url: `https://divar.ir/v/${token}`, at: Date.now(), published, sourceId })
    return { ok: true, updated: true, listing: updated || twin, token }
  }

  // ── افزودنِ آگهیِ جدید ──
  const listing = await addListing(o, payload)
  let published = false
  if (cfg.autoPublish) { const pub = await publishListing(o, listing.id); published = !!pub; if (pub?.publicId) warmEnrichment(pub.publicId) }   // پیش‌گرمِ تحلیل (ممیزی دسته‌ای توسطِ کرون)
  recordImport(o, { token, listingId: listing.id, title: listing.title, url: `https://divar.ir/v/${token}`, at: Date.now(), published, sourceId })
  return { ok: true, listing, token }
}

function normName(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

export interface SyncResult { ok: boolean; reason?: string; scanned: number; imported: number; updated: number; skipped: number; sold?: number; tokens: string[] }

// چند آگهی را با هم‌زمانیِ محدود وارد/به‌روزرسانی می‌کند (تا ۶۶ آگهی در چند دقیقه، نه ۱۱ دقیقه).
async function importTokens(o: string, items: BrandPost[], sourceId?: string, onProgress?: (done: number, total: number) => void): Promise<{ imported: number; updated: number; skipped: number; tokens: string[] }> {
  let imported = 0, updated = 0, skipped = 0
  const done: string[] = []
  const total = items.length
  let i = 0
  let consecutiveFail = 0   // مدارشکن: اگر پروکسی/دیوار قطع است، زود بیرون بیا (نه گرفتنِ همهٔ آگهی‌ها).
  let aborted = false
  let idx = 0
  const CONC = 4            // هم‌زمانی: ۴ آگهی با هم → حدودِ ۴ برابر سریع‌تر

  const worker = async () => {
    while (idx < items.length && !aborted) {
      const it = items[idx++]
      const token = it.token
      if (!token) { i++; try { onProgress?.(i, total) } catch {} ; continue }
      // هر آگهی سقفِ ۱۵ ثانیه + یک‌بار تلاشِ مجدد؛ اگر هنگ کرد، رد می‌شود تا کل کار قفل نشود.
      let res: any = null
      for (let attempt = 0; attempt < 2 && !aborted; attempt++) {
        try {
          res = await Promise.race([
            importDivarToken(o, token, it, sourceId),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
          ])
          if (res && (res.ok || res.skipped)) break
        } catch { res = null }
        if (attempt === 0) await new Promise(r => setTimeout(r, 400))
      }
      const okThis = !!(res && res.ok)
      if (res && res.ok && res.updated) updated++
      else if (res && res.ok && !res.skipped) { imported++; done.push(token) }
      else skipped++
      consecutiveFail = okThis ? 0 : consecutiveFail + 1
      if (consecutiveFail >= 8) aborted = true   // ۸ شکستِ پیاپی = اتصال قطع
      i++; try { onProgress?.(i, total) } catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, items.length) }, () => worker()))
  if (aborted) throw new Error('اتصال به دیوار برقرار نشد (چند آگهیِ پیاپی خوانده نشد) — پروکسیِ دیوار را در ادمین بررسی کنید.')
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
  const liveTokens = new Set(posts.map(p => p.token))

  onProgress?.(0, posts.length)
  const r = await importTokens(o, posts, sourceId, onProgress)

  // آگهی‌هایی که قبلاً وارد شده بودند ولی دیگر در پروفایلِ دیوار نیستند = فروخته/اجاره‌رفته.
  // «بعد از» ایمپورت محاسبه می‌شود: دیوار اغلب همان ملک را با توکنِ جدید بازنشر می‌کند و موتورِ
  // شباهت آن را به همان فایل نگاشت می‌کند — در این حالت فایل زیرِ توکنِ تازه «زنده» است و نباید
  // به‌خاطرِ مرگِ توکنِ کهنه مهرِ فروخته بخورد (باگِ قبلی)؛ فقط رکوردِ توکنِ کهنه پاک می‌شود.
  const importsNow = getDivar(o).imports
  const liveListingIds = new Set(importsNow.filter(i => liveTokens.has(i.token)).map(i => i.listingId))
  const gone: typeof importsNow = []
  for (const i of importsNow) {
    if (liveTokens.has(i.token)) continue
    if (sourceId && i.sourceId !== sourceId) continue
    if (liveListingIds.has(i.listingId)) { removeImport(o, i.token); continue }   // همان فایل با توکنِ جدید زنده است
    gone.push(i)
  }
  const sold = await markGone(o, gone)
  markRun(o, r.imported, '')
  return { ok: true, scanned: posts.length, ...r, sold }
}

// آگهی‌هایی که از دیوار حذف شده‌اند را «فروش/اجاره رفته» علامت می‌زند و از سرچِ سایت برمی‌دارد.
async function markGone(o: string, gone: { token: string; listingId: string; title: string; url: string; at: number; published: boolean }[]): Promise<number> {
  if (!gone.length) return 0
  const listings = (await getAdvisor(o)).listings
  let count = 0
  for (const g of gone) {
    const l = listings.find(x => x.id === g.listingId)
    if (!l || l.status !== 'active') continue
    // از پروفایلِ دیوار حذف شده → «فروخته/اجاره‌رفته». روی سایت می‌ماند ولی با مهرِ «فروخته شد / اجاره رفت»
    // (setListingStatus مهر را روی آگهیِ عمومی هم می‌زند) — نه حذفِ کامل، تا هم SEO حفظ شود هم کاربر ببیند.
    await setListingStatus(o, l.id, l.deal === 'rent' ? 'rented' : 'sold')
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

// ── همگام‌سازیِ پس‌زمینهٔ «ازسرگیری‌پذیر» (resumable) ───────────────────────────
// کار به دسته‌های زمان‌دار شکسته می‌شود: هر دور حداکثر BATCH_BUDGET کار می‌کند؛ اگر آگهی
// باقی بماند (مثلاً ۳۰۰ فایل) یا اتصال موقتاً قطع شود، «هولد» می‌شود و کرون چند دقیقهٔ
// بعد خودکار ادامه می‌دهد — پس هیچ اسکرپِ بزرگی نیمه‌کاره fail نمی‌شود.
const BATCH_BUDGET = 3.5 * 60 * 1000
const BATCH_CONC = 4

// فهرستِ آگهی‌ها + آگهی‌های حذف‌شده را می‌سازد (بدونِ وارد کردن).
async function prepareSync(o: string, cfgIn?: AdvisorDivar, sourceId?: string): Promise<{ items: BrandPost[]; gone: any[] }> {
  const cfg = cfgIn || getDivar(o)
  if (!cfg.searchUrl) throw new Error('لینک دیوار تنظیم نشده')
  const slug = divarProfileSlug(cfg.searchUrl)
  if (slug) {
    const { posts, reason } = await fetchDivarProfileTokens(slug)
    if (!posts.length) {
      throw new Error(reason === 'unreachable'
        ? 'اتصال به دیوار برقرار نشد — پروکسیِ دیوار را در ادمین → «اتصال‌ها» بررسی کنید'
        : reason && reason.startsWith('http_') ? `دیوار پاسخِ خطای ${reason.replace('http_', '')} داد` : 'آگهی‌ای در این پروفایل خوانده نشد')
    }
    const liveTokens = new Set(posts.map(p => p.token))
    const gone = getDivar(o).imports.filter(i => !liveTokens.has(i.token) && (sourceId ? i.sourceId === sourceId : true))
    return { items: posts, gone }
  }
  const want = normName(cfg.divarName)
  if (!want) throw new Error('برای همگام‌سازیِ جستجو، «نام شما در دیوار» را پر کنید یا لینکِ پروفایلِ پرو بدهید')
  const rows = await scrapeDivar({ url: cfg.searchUrl, meta: {} } as unknown as Source)
  const mine = rows.filter(r => { if (!r.url) return false; const owner = normName(r.owner || ''); return owner && (owner === want || owner.includes(want) || want.includes(owner)) })
  const items: BrandPost[] = mine.map(x => ({ token: divarToken(x.url || '') || '', title: x.title, price: x.price, location: x.location, image: x.image })).filter(it => it.token)
  return { items, gone: [] }
}

async function importOneSafe(o: string, it: BrandPost, sourceId?: string): Promise<{ ok: boolean; updated?: boolean; skipped?: boolean }> {
  const token = it.token
  if (!token) return { ok: true, skipped: true }
  let res: any = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await Promise.race([importDivarToken(o, token, it, sourceId), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))])
      if (res && (res.ok || res.skipped)) break
    } catch { res = null }
    if (attempt === 0) await new Promise(r => setTimeout(r, 400))
  }
  if (!res) return { ok: false }
  return { ok: !!res.ok, updated: !!res.updated, skipped: !!res.skipped }
}

// یک دورِ زمان‌دار: pending را تا پایانِ بودجه پردازش می‌کند؛ اگر ماند → هولد، وگرنه → پایان.
export async function runBatch(o: string): Promise<void> {
  const budgetEnd = Date.now() + BATCH_BUDGET
  const j0 = getJob(o)
  let imported = j0.imported || 0, updated = j0.updated || 0, skipped = j0.skipped || 0
  const sourceId = j0.sourceId
  const total = j0.total || 0
  let pending: BrandPost[] = Array.isArray(j0.pending) ? j0.pending.slice() : []
  let consecutiveFail = 0

  while (pending.length && Date.now() < budgetEnd) {
    const batch = pending.slice(0, BATCH_CONC)
    pending = pending.slice(batch.length)
    const results = await Promise.all(batch.map(it => importOneSafe(o, it, sourceId)))
    for (const r of results) {
      if (r.ok && r.updated) updated++
      else if (r.ok && !r.skipped) imported++
      else skipped++
      consecutiveFail = r.ok ? 0 : consecutiveFail + 1
    }
    setJob(o, { pending, imported, updated, skipped, done: total - pending.length, lastProgressAt: Date.now() })
    const done131 = total - pending.length
    if (done131 % 20 < BATCH_CONC || !pending.length) appendJobLog(o, `📦 ${done131.toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')} — جدید ${imported.toLocaleString('fa-IR')} · به‌روز ${updated.toLocaleString('fa-IR')} · ردشده ${skipped.toLocaleString('fa-IR')}`)
    if (consecutiveFail >= 12) {   // ~۳ دستهٔ کاملاً ناموفق = اتصال قطع → هولد و ادامهٔ بعدی
      appendJobLog(o, '⚠️ چند دستهٔ پیاپی ناموفق — اتصالِ دیوار موقتاً قطع شد؛ کار «هولد» شد و چند دقیقهٔ دیگر خودکار ادامه می‌یابد')
      setJob(o, { running: false, paused: true, pausedAt: Date.now(), note: 'اتصالِ دیوار موقتاً قطع شد — چند دقیقهٔ دیگر خودکار ادامه می‌یابد.', lastProgressAt: Date.now() })
      return
    }
  }

  if (pending.length) {   // بودجهٔ این دور تمام شد ولی آگهی مانده → هولد؛ کرون ادامه می‌دهد.
    appendJobLog(o, `⏸ بودجهٔ این دور تمام شد (${(total - pending.length).toLocaleString('fa-IR')} از ${total.toLocaleString('fa-IR')}) — چند دقیقهٔ دیگر خودکار ادامه می‌یابد`)
    setJob(o, { running: false, paused: true, pausedAt: Date.now(), pending, imported, updated, skipped, done: total - pending.length, note: `متوقفِ موقت — ${total - pending.length} از ${total} انجام شد؛ چند دقیقهٔ دیگر خودکار ادامه می‌یابد.`, lastProgressAt: Date.now() })
    return
  }

  let sold = 0   // تمام شد → مهرِ فروخته/اجاره‌رفته + پایان
  try {
    // بازنشرِ دیوار (توکنِ جدید → همان فایل): فایل زیرِ توکنِ زنده است → مهرِ فروخته نخورَد؛ فقط رکوردِ کهنه پاک شود.
    const live = new Set<string>((j0.liveTokens as string[] | undefined) || [])
    const importsNow = getDivar(o).imports
    const liveListingIds = new Set(importsNow.filter(i => live.has(i.token)).map(i => i.listingId))
    const gone = ((j0.gone || []) as { token: string; listingId: string }[]).filter(g => {
      if (live.size && liveListingIds.has(g.listingId)) { removeImport(o, g.token); return false }
      return true
    })
    sold = await markGone(o, gone as any)
  } catch {}
  if (sourceId) { try { markSourceRun(o, sourceId, imported, '') } catch {} }
  appendJobLog(o, `🏁 همگام‌سازی کامل شد — جدید ${imported.toLocaleString('fa-IR')} · به‌روز ${updated.toLocaleString('fa-IR')} · فروخته/اجاره‌رفته ${sold.toLocaleString('fa-IR')} · ردشده ${skipped.toLocaleString('fa-IR')}`)
  setJob(o, { running: false, paused: false, pending: [], gone: [], imported, updated, skipped, sold, done: total, finishedAt: Date.now(), note: '', error: '' })
}

// «در صف گذاشتنِ» همگام‌سازی. کارِ سنگین اینجا اجرا نمی‌شود؛ فقط ثبتِ صف می‌شود و
// کارگرِ اینستنسِ ۰ (cron-runner → driveJob) آن را با سقفِ همزمانی برمی‌دارد.
// این‌طور اینستنس‌های کاربری (۳۰۰۱-۳۰۰۳) هیچ کارِ سنگینی نمی‌کنند و سایت سریع می‌ماند،
// و ۱۰۰۰ مشاورِ همزمان → یک صفِ منظم، نه ۱۰۰۰ حلقهٔ موازیِ اسکرپ.
export function startBackgroundSync(o: string, cfgIn?: AdvisorDivar, sourceId?: string, label?: string): { started: boolean; alreadyRunning?: boolean; queued?: boolean } {
  const cur = getJob(o)
  if (cur.running && !isStale(cur)) return { started: false, alreadyRunning: true }
  if (cur.queued) return { started: true, queued: true }                                   // از قبل در صف است
  if (cur.paused && (cur.pending || []).length) return { started: true, queued: true }      // هولدشده؛ کارگر ادامه می‌دهد
  setJob(o, {
    queued: true, cfg: cfgIn || null, queuedAt: Date.now(),
    running: false, paused: false, total: 0, done: 0, imported: 0, updated: 0, skipped: 0, failed: 0, sold: 0,
    error: '', note: 'در صفِ پردازش…', label: label || 'همگام‌سازیِ دیوار',
    startedAt: Date.now(), lastProgressAt: Date.now(), finishedAt: undefined, pending: [], gone: [], sourceId,
    log: [],
  })
  appendJobLog(o, '⏳ در صفِ سرور قرار گرفت — کارگرِ پردازش حداکثر تا ۴۵ ثانیهٔ دیگر برمی‌دارد')
  return { started: true, queued: true }
}

// اجرای واقعیِ یک کار — فقط از کارگرِ اینستنسِ ۰ (cron-runner) صدا زده می‌شود.
// اگر «در صف» است: prepareSync سپس runBatch. اگر «هولد» است: ادامه (resume).
export async function driveJob(o: string): Promise<void> {
  const j = getJob(o)
  if (j.running && !isStale(j)) return
  // فاز ۱۳۴ — بازپس‌گیریِ زامبی: running کهنه با آگهیِ مانده → هولد و ادامه (قبلاً تا بازدیدِ صاحبش برای همیشه گیر می‌ماند)
  if (j.running && isStale(j) && (j.pending || []).length) {
    appendJobLog(o, '♻️ کارِ نیمه‌کارهٔ رهاشده توسطِ کارگر بازیابی شد — ادامه…')
    setJob(o, { running: false, paused: true, pausedAt: 0 })
    resumeJob(o)
    return
  }
  if (j.paused && (j.pending || []).length) { resumeJob(o); return }
  if (!j.queued) return
  const cfgIn = j.cfg as AdvisorDivar | undefined
  const sourceId = j.sourceId
  setJob(o, { queued: false, running: true, paused: false, note: '', startedAt: Date.now(), lastProgressAt: Date.now() })
  appendJobLog(o, '🚚 کارگرِ صف کار را برداشت (اینستنسِ ۰) — شروعِ اجرا')
  appendJobLog(o, '🌐 در حال خواندنِ فهرستِ آگهی‌ها از دیوار (از مسیرِ پروکسیِ تنظیم‌شده در ادمین)…')
  try {
    const prep = await Promise.race([
      prepareSync(o, cfgIn, sourceId),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('خواندنِ فهرستِ آگهی‌ها از دیوار بیش از حد طول کشید — اتصالِ پروکسی را بررسی کنید.')), 90000)),
    ])
    // liveTokens هم ذخیره می‌شود تا در پایانِ اجرا (runBatch) فایل‌هایی که با توکنِ جدید بازنشر
    // شده‌اند و موتورِ شباهت به همان فایل نگاشتشان کرده، اشتباهاً «فروخته» مهر نخورند.
    setJob(o, { total: prep.items.length, pending: prep.items, gone: prep.gone, liveTokens: prep.items.map(i => i.token), sourceId, lastProgressAt: Date.now() })
    appendJobLog(o, `✅ فهرست خوانده شد: ${prep.items.length.toLocaleString('fa-IR')} آگهیِ زنده${prep.gone.length ? ` · ${prep.gone.length.toLocaleString('fa-IR')} فایلِ حذف‌شده از دیوار (نامزدِ مهرِ فروخته)` : ''}`)
    appendJobLog(o, '📦 شروعِ ایمپورت/به‌روزرسانیِ آگهی‌ها…')
    await runBatch(o)
  } catch (e: any) {
    if (sourceId) { try { markSourceRun(o, sourceId, 0, e?.message || 'خطا یا وقفه') } catch {} }
    appendJobLog(o, `❌ ${e?.message || 'خطای داخلی هنگامِ همگام‌سازی'}`)
    setJob(o, { running: false, paused: false, queued: false, pending: [], finishedAt: Date.now(), error: e?.message || 'خطای داخلی هنگامِ همگام‌سازی' })
  }
}

// ادامهٔ یک کارِ هولدشده (کرون یا دکمهٔ «ادامهٔ الان»).
export function resumeJob(o: string): boolean {
  const j = getJob(o)
  if (j.running || !j.paused || !(j.pending || []).length) return false
  setJob(o, { running: true, paused: false, lastProgressAt: Date.now(), note: 'در حالِ ادامه…' })
  appendJobLog(o, '▶️ ادامهٔ کارِ هولدشده…')
  ;(async () => {
    try { await runBatch(o) }
    catch (e: any) { setJob(o, { running: false, paused: true, pausedAt: Date.now(), note: 'وقفه — دوباره تلاش می‌شود.', error: e?.message || 'خطا' }) }
  })()
  return true
}

/** همهٔ آگهی‌های واردشده از دیوار را پاک می‌کند (فایل + نسخهٔ عمومی) و فهرست را خالی می‌کند. */
export async function clearDivarImports(o: string): Promise<{ removed: number }> {
  const imports = getDivar(o).imports
  let removed = 0
  for (const im of imports) { try { await deleteListing(o, im.listingId); removed++ } catch {} }
  clearImports(o)
  return { removed }
}
