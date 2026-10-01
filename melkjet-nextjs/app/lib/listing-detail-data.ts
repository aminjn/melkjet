import type { Item } from './scraper-store'
import { listingHref } from './listing-url'
import { FA_DIGITS, faDigit } from './digits'

// ─── فاز ۲۹۷د — موتورِ مشترکِ «صفحهٔ آگهی» ───────────────────────────────────────
// همهٔ منطقِ سرورسایدِ صفحهٔ آگهیِ سایتِ اصلی (سئوی بازساخته، JSON-LD، امتیازِ اصالت،
// enrich در HTMLِ اولیه) اینجا زندگی می‌کند تا صفحهٔ آگهیِ «داخلِ سایت‌ساز» هم دقیقاً
// از همان استفاده کند — نه یک کپیِ موازیِ فقیر که همیشه عقب می‌افتد.
// (کدِ بدنه عیناً از app/listing/[slug]/page.tsx منتقل شده — رفتارِ سایتِ اصلی صفر تغییر.)

function faToEn(s: string): string { return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) }
function num(s?: string): number | undefined { const m = faToEn(s || '').match(/\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : undefined }

/** عنوان/توضیحِ سئوی بازساخته از دادهٔ ساخت‌یافته (فاز ۲۲۸) + سئوِ محله‌ای (دسترسی‌های واقعی). */
export async function listingSeoText(it: Item): Promise<{ title: string; desc: string }> {
  const { seoListingTitle, seoListingDescription, deriveListing } = await import('./listing-search')
  const d = deriveListing(it as Parameters<typeof deriveListing>[0])
  const title = seoListingTitle(d)
  let desc = seoListingDescription(d, it.price)
  try {
    const { getEnrichment } = await import('./enrich-store')
    const nb = getEnrichment(it.id)?.nearby
    if (Array.isArray(nb) && nb.length >= 2) {
      const names = nb.slice(0, 5).map((n: { name?: string }) => n?.name).filter(Boolean).join('، ')
      if (names) desc = `${desc} نزدیک به ${names}.`.slice(0, 320)
    }
  } catch { /* بدونِ سئوِ محله هم صفحه سالم است */ }
  return { title, desc }
}

export interface ListingDetailData {
  ld: Record<string, unknown>
  breadcrumbLd: Record<string, unknown>
  nearbyLd: Record<string, unknown> | null
  originality: import('./originality').OriginalityVerdict | null
  initial: Item & { promoted?: boolean; promoKind?: string }
  initialEnrich: {
    analysis: unknown
    facts: { label: string; value: string }[]
    amenities: string[]
    gallery: string[]
    geo: { lat: number; lng: number } | null
    nearby: { type?: string; name?: string; time: string }[]
  } | null
}

/** کلِ دادهٔ سرورسایدِ صفحهٔ آگهی — JSON-LDها، اصالت، پروموت، و enrich برای HTMLِ اولیه. */
export async function buildListingDetailData(it: Item): Promise<ListingDetailData> {
  const id = String(it.id)
  const loc = it.location || ''
  const area = num(it.meta?.['متراژ'])
  const rooms = num(it.meta?.['اتاق خواب'])
  const city = (it.meta?.['شهر'] || '').trim()
  const canonical = `https://melkjet.com${listingHref(it.id, it.title, it.location)}`
  // فاز ۲۳۰: مرجعِ واحدِ dealOf (اجارهٔ روزانه دیگر «فروشی» حساب نمی‌شود — نه در بردکرامب نه در قیمتِ اسکیما)
  const { dealOf } = await import('./listing-filter')
  const deal = dealOf(it)
  const isRent = deal !== 'sale'
  // قیمتِ فروش برای اسکیما — فقط اگر یک عددِ واقعی باشد (اجاره = ودیعه+اجاره، یک عدد نیست؛ «توافقی» = عدد ندارد).
  const priceToman = isRent ? undefined : num(it.price)
  const offerRial = priceToman && priceToman >= 1_000_000 ? priceToman * 10 : undefined

  // فاز ۱۳۷ (سئوی آگهی‌ها): اسکیمای کاملِ RealEstateListing — همه از دادهٔ واقعیِ آگهی.
  const about: Record<string, unknown> = {
    '@type': 'Apartment', name: it.title,
    numberOfRooms: rooms || undefined,
    floorSize: area ? { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' } : undefined,
    address: { '@type': 'PostalAddress', addressLocality: city || loc || undefined, addressCountry: 'IR' },
  }
  // descriptionِ اسکیما هرگز متنِ خامِ دیوار نیست: متنِ ساختهٔ خودِ ما (analysis.summary) → توصیفِ سئو → هیچ.
  let enr: import('./enrich-store').Enrichment | null = null
  try { const { getEnrichment } = await import('./enrich-store'); enr = getEnrichment(id) } catch {}
  // اگر تحلیل هنوز ساخته نشده، همین‌جا بساز — نسخهٔ «فقط ماشین‌لرنینگ»: بدونِ AI و دیوار، ~۶ms.
  if (!enr?.analysis) {
    try {
      const { ensureAnalysisNow } = await import('./enrich-warm')
      const fresh = await ensureAnalysisNow(id)
      if (fresh?.analysis) enr = fresh
    } catch { /* صفحه بدونِ تحلیل هم سالم است؛ کلاینت دوباره تلاش می‌کند */ }
  }
  let seoDesc = ''
  try {
    const { seoListingDescription, deriveListing } = await import('./listing-search')
    seoDesc = seoListingDescription(deriveListing(it as Parameters<typeof deriveListing>[0]), it.price)
  } catch {}
  const anaSummary = String((enr?.analysis as { summary?: string } | undefined)?.summary || '').trim()
  const ldDescription = anaSummary || seoDesc || undefined
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: it.title, description: ldDescription,
    image: it.image || undefined, url: canonical,
    datePosted: it.scrapedAt ? new Date(it.scrapedAt).toISOString() : undefined,
    about,
    offers: offerRial ? { '@type': 'Offer', price: offerRial, priceCurrency: 'IRR', url: canonical } : undefined,
  }
  const clean = (o: Record<string, unknown>) => { Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o }
  clean(about); clean(about.address as Record<string, unknown>); clean(ld)

  const crumbs = [
    { name: 'خانه', item: 'https://melkjet.com/' },
    { name: 'آگهی‌ها', item: 'https://melkjet.com/listings' },
    { name: deal === 'daily' ? 'اجارهٔ روزانه و کوتاه‌مدت' : deal === 'rent' ? 'رهن و اجاره' : 'خرید و فروش', item: `https://melkjet.com/listings/${deal === 'daily' ? 'daily' : deal === 'rent' ? 'rent' : 'sale'}` },
    { name: it.title, item: canonical },
  ]
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
  }

  // فاز ۱۳۷: نشانِ پروموت سرورساید تا آیتمِ کامل در HTML اولیه باشد.
  let promoKind: string | undefined
  try { const { promotedListingKinds } = await import('./promotion-store'); promoKind = (await promotedListingKinds()).get(String(it.id))?.kind } catch {}

  // فاز ۲۲۶ — امتیازِ اصالتِ واقعی: هر سیگنال از دادهٔ ثبت‌شده؛ سیگنالِ نامعلوم شمرده نمی‌شود.
  let originality: import('./originality').OriginalityVerdict | null = null
  try {
    const { originalityOf } = await import('./originality')
    const gallery = enr?.gallery?.length || 0
    // انحرافِ قیمتِ متری از میانهٔ هم‌محله‌ها (فقط هم‌نوعِ معامله؛ حداقل ۵ نمونه وگرنه نامعلوم)
    let priceVsMarketPct: number | null = null
    try {
      const { listItemsStable } = await import('./scraper-store')
      const { derivedFrom } = await import('./derived-cache')
      const { matchesLocationName } = await import('./location-match')
      const { deriveListing } = await import('./listing-search')
      const me = deriveListing(it as Parameters<typeof deriveListing>[0])
      if (me.priceNum > 0 && me.areaNum > 0 && it.location) {
        const hood = (it.location.split(/[،,]/)[1] || '').trim()
        if (hood) {
          // فاز ۲۳۲: میانهٔ متریِ هر (محله،معامله) یک‌بار در هر نسلِ داده حساب می‌شود، نه در هر بازدید.
          const all = await listItemsStable('listing', { publicOnly: true })
          const median = derivedFrom(all, `ppmMed:${me.deal}:${hood}`, () => {
            const peers = all
              .filter(x => matchesLocationName(hood, x.location || ''))
              .map(x => deriveListing(x as Parameters<typeof deriveListing>[0])).filter(d => d.deal === me.deal && d.priceNum > 0 && d.areaNum > 0)
              .map(d => d.priceNum / d.areaNum).sort((a, b) => a - b)
            return peers.length >= 5 ? peers[Math.floor(peers.length / 2)] : 0
          })
          if (median > 0) priceVsMarketPct = Math.round(((me.priceNum / me.areaNum - median) / median) * 100)
        }
      }
    } catch { /* نامعلوم */ }
    let ownerAccount: { exists: boolean; ageDays: number } | null = null
    try {
      const phone = String((it.meta as Record<string, string> | undefined)?.['__ownerPhone'] || it.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
      if (phone) {
        const { getAccount } = await import('./account-store')
        const a = getAccount(phone)
        ownerAccount = a ? { exists: true, ageDays: Math.floor((Date.now() - (a.createdAt || Date.now())) / 864e5) } : { exists: false, ageDays: 0 }
      }
    } catch { /* نامعلوم */ }
    originality = originalityOf({
      moderationApproved: it.moderatedAt ? it.status === 'approved' : undefined,
      moderationScore: (it as { aiScore?: number }).aiScore,
      priceVsMarketPct,
      hasGeo: !!(Number(it.meta?.['__lat']) && Number(it.meta?.['__lng'])),
      imageCount: gallery || (it.image ? 1 : 0),
      factsCount: ['متراژ', 'طبقه', 'سال ساخت', 'اتاق خواب'].filter(k => it.meta?.[k]).length,
      hasPhone: !!(it.phone || it.meta?.['__ownerPhone']),
      ownerAccount,
    })
  } catch { originality = null }

  // فاز ۲۵۲ — سئوِ محله‌ای: دسترسی‌های واقعی هم به description اسکیما، هم ItemListِ Placeها.
  let nearbyLd: Record<string, unknown> | null = null
  try {
    const nb = enr?.nearby as { type?: string; name?: string; time?: string }[] | undefined
    if (Array.isArray(nb) && nb.length >= 2) {
      // نامِ نشان خودش اغلب با نوع شروع می‌شود؛ چسباندنِ بی‌شرطِ نوع «سوپرمارکت سوپرمارکت…» می‌ساخت.
      const line = nb.slice(0, 8).map(n => {
        const nm = (n.name || '').trim(), tp = (n.type || '').trim()
        const label = !nm ? tp : (tp && !nm.includes(tp) ? `${tp} ${nm}` : nm)
        return `${label}${n.time ? ` (${n.time})` : ''}`.trim()
      }).filter(Boolean).join('، ')
      if (line) {
        ld.description = `${ld.description ? ld.description + ' ' : ''}دسترسی‌های نزدیک: ${line}.`
        nearbyLd = {
          '@context': 'https://schema.org', '@type': 'ItemList', name: `دسترسی‌های نزدیکِ ${it.title}`,
          itemListElement: nb.slice(0, 10).filter(n => n.name).map((n, i) => ({
            '@type': 'ListItem', position: i + 1,
            item: { '@type': 'Place', name: n.name, ...(n.type ? { additionalType: n.type } : {}) },
          })),
        }
      }
    }
  } catch { /* بدونِ سئوِ محله هم صفحه سالم است */ }

  const initial = (promoKind ? { ...it, promoted: true, promoKind } : it) as ListingDetailData['initial']
  // تحلیل/فکت/امکانات/گالری از سرور در HTMLِ اولیه می‌نشیند تا خزندهٔ گوگل محتوایِ ساختهٔ ما را ببیند.
  const initialEnrich = enr ? {
    analysis: (enr.analysis ?? null) as unknown,
    facts: (enr.facts || []).slice(0, 40),
    amenities: (enr.amenities || []).slice(0, 40),
    // تصویرِ data: هرگز داخلِ HTML نمی‌رود — همان درسی که صفحهٔ ۴۸ مگابایتی داد.
    gallery: (enr.gallery || []).filter(u => typeof u === 'string' && !u.startsWith('data:')).slice(0, 30),
    geo: enr.geo ?? null,
    nearby: (enr.nearby || []).slice(0, 12),
  } : null

  return { ld, breadcrumbLd, nearbyLd, originality, initial, initialEnrich }
}
