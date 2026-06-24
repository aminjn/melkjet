import { fetchDivarPost, divarToken } from './divar-post'
import { addListing, publishListing, getAdvisor, updateAdvisorProfile, type Listing } from './advisor-store'
import { ensureNeighborhoodByName } from './geo-store'
import { getDivar, hasToken, recordImport, markRun, type AdvisorDivar } from './advisor-divar-store'
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

/** یک آگهیِ دیوار را (با توکن یا لینک) به‌عنوان فایلِ مشاور وارد می‌کند. */
export async function importDivarToken(o: string, input: string): Promise<ImportResult> {
  const token = divarToken(input)
  if (!token) return { ok: false, reason: 'لینک یا توکنِ دیوار معتبر نیست' }
  if (hasToken(o, token)) return { ok: true, skipped: true, reason: 'این آگهی قبلاً وارد شده', token }

  const cfg = getDivar(o)
  let post
  try { post = await fetchDivarPost(token) } catch (e: any) { return { ok: false, reason: e?.message || 'اتصال به دیوار ناموفق بود', token } }
  if (post.reason && !post.images.length && !post.title) {
    return { ok: false, reason: `آگهی از دیوار خوانده نشد (${post.reason})`, token }
  }

  const advisorPhone = getAdvisor(o).profile.phone || ''
  const listing = addListing(o, {
    title: post.title || 'آگهی واردشده از دیوار',
    ptype: post.ptype || 'آپارتمان',
    deal: post.deal === 'rent' ? 'rent' : 'sale',
    price: post.price || 0,
    rentMonthly: post.rentMonthly || undefined,
    location: post.location || '',
    city: post.city || undefined,
    neighborhood: post.neighborhood || undefined,
    district: post.district || undefined,
    lat: typeof post.lat === 'number' ? post.lat : undefined,
    lng: typeof post.lng === 'number' ? post.lng : undefined,
    area: post.area,
    rooms: post.rooms,
    yearBuilt: post.yearBuilt,
    amenities: post.amenities,
    description: post.description,
    images: post.images,
    phone: advisorPhone || undefined,
  })

  // محله را خودکار بساز و به مناطقِ مشاور اضافه کن
  if (cfg.autoNeighborhood && post.city && post.neighborhood) {
    try { ensureNeighborhoodByName(post.city, post.neighborhood, post.district) } catch {}
    addAreaToProfile(o, post.neighborhood)
  }

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

/** آگهی‌های منطقهٔ مشاور را از روی لینکِ جستجوی دیوار سینک می‌کند؛ فقط آگهی‌هایی که
 *  نامِ آگهی‌دهنده با «نام دیوار»‌ِ مشاور می‌خواند (در صورت تنظیم). نتیجه ثبت می‌شود. */
export async function syncAdvisorDivar(o: string, cfgIn?: AdvisorDivar): Promise<SyncResult> {
  const cfg = cfgIn || getDivar(o)
  if (!cfg.searchUrl) { markRun(o, 0, 'لینک جستجوی دیوار تنظیم نشده'); return { ok: false, reason: 'لینک جستجوی دیوار تنظیم نشده', scanned: 0, imported: 0, skipped: 0, tokens: [] } }

  let rows
  try {
    rows = await scrapeDivar({ url: cfg.searchUrl, meta: {} } as unknown as Source)
  } catch (e: any) {
    markRun(o, 0, e?.message || 'خطا در خواندن دیوار')
    return { ok: false, reason: e?.message || 'خطا در خواندن دیوار', scanned: 0, imported: 0, skipped: 0, tokens: [] }
  }

  const want = normName(cfg.divarName)
  const mine = rows.filter(r => {
    if (!r.url) return false
    if (!want) return true // اگر نام دیوار خالی است، همهٔ آگهی‌های همان جستجو/منطقه
    const owner = normName(r.owner || '')
    return owner && (owner === want || owner.includes(want) || want.includes(owner))
  })

  let imported = 0, skipped = 0
  const tokens: string[] = []
  for (const r of mine) {
    const token = divarToken(r.url || '')
    if (!token) continue
    if (hasToken(o, token)) { skipped++; continue }
    try {
      const res = await importDivarToken(o, token)
      if (res.ok && !res.skipped) { imported++; tokens.push(token) }
      else skipped++
    } catch { skipped++ }
  }

  markRun(o, imported, imported || mine.length ? '' : 'آگهیِ منطبقی پیدا نشد')
  return { ok: true, scanned: rows.length, imported, skipped, tokens }
}
