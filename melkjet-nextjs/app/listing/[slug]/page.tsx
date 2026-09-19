import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { getItemById } from '@/app/lib/scraper-store'
import { idFromListingSlug, listingHref } from '@/app/lib/listing-url'
import PropertyClient from './PropertyClient'
import { FA_DIGITS, faDigit } from '@/app/lib/digits'

export const revalidate = 300
export function generateStaticParams() { return [] }

function faToEn(s: string): string { return (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) }
function num(s?: string): number | undefined { const m = faToEn(s || '').match(/\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : undefined }

async function load(slug: string) {
  const id = idFromListingSlug(slug)
  const it = await getItemById(id)
  if (!it || it.type !== 'listing' || it.status === 'rejected' || it.status === 'duplicate') return null
  return it
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const it = await load(slug)
  if (!it) return { title: 'آگهی یافت نشد | ملک‌جت' }
  // فاز ۲۲۸ (ضدِ تکراری با دیوار): title/description «به‌کل» از دادهٔ ساختاریافتهٔ خودِ آگهی بازساخته
  // می‌شود — نه کپیِ متنِ دیوار. H1ِ صفحه همان متنِ صاحبِ آگهی می‌ماند (هیچ دستکاری‌ای در نمایش).
  const { seoListingTitle, seoListingDescription, deriveListing } = await import('@/app/lib/listing-search')
  const d228 = deriveListing(it as Parameters<typeof deriveListing>[0])
  const title = seoListingTitle(d228)
  let desc = seoListingDescription(d228, it.price)
  // سئوِ محله‌ای — دسترسی‌های نزدیکِ واقعی (کشِ enrich، فقط NexaMap، بدونِ AI) را به توضیحاتِ متا
  // بیفزا تا گوگل «نزدیک به مترو…، بانک…، مدرسه…» را برای هر آگهی ایندکس کند.
  try {
    const { getEnrichment } = await import('@/app/lib/enrich-store')
    const nb = getEnrichment(it.id)?.nearby
    if (Array.isArray(nb) && nb.length >= 2) {
      const names = nb.slice(0, 5).map((n: { name?: string }) => n?.name).filter(Boolean).join('، ')
      if (names) desc = `${desc} نزدیک به ${names}.`.slice(0, 320)
    }
  } catch { /* بدونِ سئوِ محله هم صفحه سالم است */ }
  // فاز ۲۱۸ (ممیزیِ کاملِ سئو): canonical قبلاً «همان slugِ درخواستی» بود — هر واریانتی خودش را
  // canonical اعلام می‌کرد و گوگل نسخه‌های تکراری نگه می‌داشت. حالا همیشه «یک» URLِ حقیقی.
  const url = `https://melkjet.com${listingHref(it.id, it.title, it.location)}`
  return {
    title: `${title} | ملک‌جت`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, url, images: it.image ? [it.image] : undefined },
  }
}

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const it = await load(slug)
  if (!it) notFound()
  // فاز ۲۱۸: هر slugِ غیرِ حقیقی (عنوانِ عوض‌شده/لینکِ قدیمی/دست‌ساز) با ۳۰۸ به URLِ یکتا می‌رود —
  // گوگل هرگز دو نسخه از یک آگهی نمی‌بیند.
  const canonicalPath = listingHref(it.id, it.title, it.location)
  if (`/listing/${decodeURIComponent(slug)}` !== canonicalPath) permanentRedirect(canonicalPath)
  const id = idFromListingSlug(slug)
  const loc = it.location || ''
  const area = num(it.meta?.['متراژ'])
  const rooms = num(it.meta?.['اتاق خواب'])
  const city = (it.meta?.['شهر'] || '').trim()
  const canonical = `https://melkjet.com/listing/${slug}`
  // فاز ۲۳۰: مرجعِ واحدِ dealOf (اجارهٔ روزانه دیگر «فروشی» حساب نمی‌شود — نه در بردکرامب نه در قیمتِ اسکیما)
  const { dealOf } = await import('@/app/lib/listing-filter')
  const deal = dealOf(it)
  const isRent = deal !== 'sale'
  // قیمتِ فروش برای اسکیما — فقط اگر یک عددِ واقعی باشد (اجاره = ودیعه+اجاره، یک عدد نیست؛ «توافقی» = عدد ندارد).
  // schema.org کدِ «تومان» ندارد؛ عدد به ریال (×۱۰) با IRR می‌رود تا واقعی بماند.
  const priceToman = isRent ? undefined : num(it.price)
  const offerRial = priceToman && priceToman >= 1_000_000 ? priceToman * 10 : undefined

  // فاز ۱۳۷ (سئوی آگهی‌ها): اسکیمای کاملِ RealEstateListing — همه از دادهٔ واقعیِ آگهی.
  const about: Record<string, unknown> = {
    '@type': 'Apartment', name: it.title,
    numberOfRooms: rooms || undefined,
    floorSize: area ? { '@type': 'QuantitativeValue', value: area, unitCode: 'MTK' } : undefined,
    address: { '@type': 'PostalAddress', addressLocality: city || loc || undefined, addressCountry: 'IR' },
  }
  // ۱۹ سپتامبر — تا امروز descriptionِ اسکیما عیناً متنِ دیوار بود: فاز ۲۲۸ عنوان/متا را یکتا کرده بود
  // ولی دادهٔ ساختاریافته همان متنِ تکراری را به گوگل می‌داد. ترتیبِ ترجیح: متنِ یکتایِ enrich →
  // توصیفِ بازساختهٔ سئو → هیچ. متنِ خامِ دیوار دیگر هیچ‌وقت به اسکیما نمی‌رود.
  let enr: import('@/app/lib/enrich-store').Enrichment | null = null
  try { const { getEnrichment } = await import('@/app/lib/enrich-store'); enr = getEnrichment(id) } catch {}
  // اگر تحلیل هنوز ساخته نشده، همین‌جا بساز — نسخهٔ «فقط ماشین‌لرنینگ» است: هیچ فراخوانِ AI،
  // هیچ تماسی با دیوار، ~۶ میلی‌ثانیه. بدونِ این، آگهیِ تازه‌ای که گوگل زودتر از کاربر می‌بیند صفحه‌ای
  // بدونِ محتوایِ ساختهٔ ما ایندکس می‌شود — دقیقاً همان صفحه‌ای که می‌خواهیم تکراری نباشد.
  if (!enr?.analysis) {
    try {
      const { ensureAnalysisNow } = await import('@/app/lib/enrich-warm')
      const fresh = await ensureAnalysisNow(id)
      if (fresh?.analysis) enr = fresh
    } catch { /* صفحه بدونِ تحلیل هم سالم است؛ کلاینت دوباره تلاش می‌کند */ }
  }
  let seoDesc = ''
  try {
    const { seoListingDescription, deriveListing } = await import('@/app/lib/listing-search')
    seoDesc = seoListingDescription(deriveListing(it as Parameters<typeof deriveListing>[0]), it.price)
  } catch {}
  // تصحیحِ همین روز: اول enr.description را «متنِ یکتا» فرض کرده بودم — نیست. آن خروجیِ
  // fetchDivarPost است، یعنی متنِ کاملِ خودِ دیوار (enrich-warm.ts:54) — بدتر از excerpt بود نه بهتر.
  // متنِ واقعاً ساختهٔ خودِ ما analysis.summary است (از دادهٔ ساختاریافته، بدونِ یک کلمه از دیوار).
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

  // فاز ۱۳۷: نشانِ پروموت سرورساید (به‌جای فچِ جداگانهٔ کلاینت) تا آیتمِ کامل در HTML اولیه باشد.
  let promoKind: string | undefined
  try { const { promotedListingKinds } = await import('@/app/lib/promotion-store'); promoKind = (await promotedListingKinds()).get(String(it.id))?.kind } catch {}

  // فاز ۲۲۶ — امتیازِ اصالتِ واقعی: هر سیگنال از دادهٔ ثبت‌شده؛ سیگنالِ نامعلوم شمرده نمی‌شود (هیچ ادعای بی‌سند).
  let originality: import('@/app/lib/originality').OriginalityVerdict | null = null
  try {
    const { originalityOf } = await import('@/app/lib/originality')
    const gallery = enr?.gallery?.length || 0
    // انحرافِ قیمتِ متری از میانهٔ هم‌محله‌ها (فقط هم‌نوعِ معامله؛ حداقل ۵ نمونه وگرنه نامعلوم)
    let priceVsMarketPct: number | null = null
    try {
      const { listItemsStable } = await import('@/app/lib/scraper-store')
      const { derivedFrom } = await import('@/app/lib/derived-cache')
      const { matchesLocationName } = await import('@/app/lib/location-match')
      const { deriveListing } = await import('@/app/lib/listing-search')
      const me = deriveListing(it as any)
      if (me.priceNum > 0 && me.areaNum > 0 && it.location) {
        const hood = (it.location.split(/[،,]/)[1] || '').trim()
        if (hood) {
          // فاز ۲۳۲: این اسکنِ ۱۲هزارتایی «در هر بازدیدِ صفحهٔ آگهی» اجرا می‌شد و گوگل ۱۲هزار صفحهٔ
          // آگهی را می‌خزد — میانهٔ متریِ هر (محله،معامله) حالا یک‌بار در هر نسلِ داده حساب می‌شود.
          const all = await listItemsStable('listing', { publicOnly: true })
          const median = derivedFrom(all, `ppmMed:${me.deal}:${hood}`, () => {
            const peers = all
              .filter(x => matchesLocationName(hood, x.location || ''))
              .map(x => deriveListing(x as any)).filter(d => d.deal === me.deal && d.priceNum > 0 && d.areaNum > 0)
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
        const { getAccount } = await import('@/app/lib/account-store')
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

  // فاز ۲۵۲ — سئوِ محله‌ای: دسترسی‌های نزدیکِ واقعی (کشِ enrich، فقط NexaMap، بدونِ AI) را هم به
  // توضیحاتِ اسکیمای آگهی می‌ریزیم، هم یک ItemListِ ساختاریافته از Placeها می‌سازیم تا گوگل
  // «نزدیک به مترو…، بانک…، مدرسه…» را ایندکس کند. اگر هنوز در کش نبود، این بخش بی‌صدا رد می‌شود.
  let nearbyLd: Record<string, unknown> | null = null
  try {
    const nb = enr?.nearby as { type?: string; name?: string; time?: string }[] | undefined
    if (Array.isArray(nb) && nb.length >= 2) {
      const line = nb.slice(0, 8).map(n => `${n.type ? n.type + ' ' : ''}${n.name || ''}${n.time ? ` (${n.time})` : ''}`.trim()).filter(Boolean).join('، ')
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

  const initial = (promoKind ? { ...it, promoted: true, promoKind } : it) as any
  // تحلیل/فکت/امکانات/گالری همه در کشِ enrich حاضرند، ولی کلاینت بعد از فچِ
  // /api/listing/enrich آن‌ها را می‌نشاند — پس HTMLِ اولیه فقط متنِ دیوار را داشت و خزندهٔ گوگل
  // هیچ‌وقت محتوایِ ساختهٔ خودِ ما را نمی‌دید. حالا همان داده از سرور می‌رود و در HTMLِ اولیه می‌نشیند
  // (فچِ کلاینت سرجایش است و همان مقدار را دوباره می‌نشاند — پس رفتار عوض نمی‌شود، فقط زودتر دیده می‌شود).
  const initialEnrich = enr ? {
    analysis: (enr.analysis ?? null) as any,
    facts: (enr.facts || []).slice(0, 40),
    amenities: (enr.amenities || []).slice(0, 40),
    // تصویرِ data: هرگز داخلِ HTML نمی‌رود — همان درسی که صفحهٔ ۴۸ مگابایتی داد.
    gallery: (enr.gallery || []).filter(u => typeof u === 'string' && !u.startsWith('data:')).slice(0, 30),
    geo: enr.geo ?? null,
    nearby: (enr.nearby || []).slice(0, 12),
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {nearbyLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(nearbyLd) }} />}
      <PropertyClient id={id} initial={initial} originality={originality} initialEnrich={initialEnrich} />
    </>
  )
}
