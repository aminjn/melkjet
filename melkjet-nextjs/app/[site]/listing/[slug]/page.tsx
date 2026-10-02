import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSite, type Site } from '@/app/lib/sites-store'
import { getItemById } from '@/app/lib/scraper-store'
import { idFromListingSlug, listingHref } from '@/app/lib/listing-url'
import { listingSeoText, buildListingDetailData } from '@/app/lib/listing-detail-data'
import { SiteChrome } from '../../page'
import Beacon from '../../Beacon'
import PropertyClient from '@/app/listing/[slug]/PropertyClient'

export const revalidate = 300
const MAIN = 'https://melkjet.com'

// ─── فاز ۲۹۷د — صفحهٔ آگهیِ داخلِ سایت‌ساز = «خودِ» صفحهٔ آگهیِ سایتِ اصلی ────────────
// قبلاً یک کپیِ موازیِ فقیر (ListingDetail) بود که همیشه از سایتِ اصلی عقب می‌افتاد
// («امکانات دقیقا مثل سایت اصلی باشه»). حالا همان موتور (PropertyClient + کلِ منطقِ
// سرورسایدِ listing-detail-data: سئوی بازساخته، JSON-LDها، امتیازِ اصالت، enrich در
// HTMLِ اولیه) داخلِ پوستهٔ همان سایت (NavBar/فوتر/تمِ خودش) رندر می‌شود — یک موتور،
// دو پوسته؛ هر امکانِ تازهٔ صفحهٔ اصلی خودکار اینجا هم هست.

async function load(siteSlug: string, slug: string) {
  const site = await getSite(siteSlug); if (!site) return null
  const it = await getItemById(idFromListingSlug(slug))
  if (!it || it.type !== 'listing' || it.status === 'rejected' || it.status === 'duplicate') return null
  return { site, it }
}

export async function generateMetadata({ params }: { params: Promise<{ site: string; slug: string }> }): Promise<Metadata> {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) return { title: 'آگهی یافت نشد' }
  // همان سئوی بازساختهٔ سایتِ اصلی (فاز ۲۲۸ + سئوِ محله‌ای)، با برندِ خودِ سایت.
  const { title, desc } = await listingSeoText(r.it)
  const canonical = `${MAIN}${listingHref(r.it.id, r.it.title, r.it.location)}`   // مرجع = صفحهٔ اصلی → گوگل تکراری نمی‌بیند
  return {
    title: `${title} | ${r.site.seo?.title || r.site.title}`,
    description: desc,
    alternates: { canonical },
    openGraph: { title, images: r.it.image ? [r.it.image] : undefined },
  }
}

// پالتِ سایتِ اصلی با رنگِ برندِ همان سایت — تا اجزای مشترکِ صفحهٔ آگهی داخلِ سایتِ
// شخصی درست رنگ بگیرند. پینِ inline اینجا «عمدی» است (استثنای قاعدهٔ فاز ۲۹۴، مثلِ empRoot):
// سایتِ منتشرشده تمِ ثابتِ خودش را دارد و سوییچِ دارک/لایتِ ملک‌جت رویش معنا ندارد.
// فاز ۲۹۷هـ: قالب‌های سایت‌ساز تمِ تیره هم دارند (مشکی لوکس/سرمه‌ای شب/…) — متن/خط/سطح
// بر اساسِ روشناییِ پس‌زمینهٔ خودِ سایت انتخاب می‌شود تا متنِ تیره روی زمینهٔ تیره نیفتد.
function themeVars(site: Site): React.CSSProperties {
  const t = site.theme
  const primary = t?.primary || '#c9a84c'
  const bg = t?.bg || '#faf8f3'
  const m = /^#([0-9a-f]{6})$/i.exec(bg.trim())
  const lum = m ? (parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.59 + parseInt(m[1].slice(4, 6), 16) * 0.11) : 255
  const dark = lum < 128
  return {
    '--bg': bg, '--bg2': dark ? 'rgba(255,255,255,0.05)' : '#f5f2ea', '--surface': t?.surface || (dark ? '#17171c' : '#ffffff'),
    '--line': dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)', '--line2': dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
    '--text': t?.heading || (dark ? '#f2efe9' : '#1a1712'),
    '--muted': dark ? 'rgba(240,236,228,0.66)' : 'rgba(26,23,18,0.66)', '--faint': dark ? 'rgba(240,236,228,0.4)' : 'rgba(26,23,18,0.4)',
    '--gold': primary, '--gold2': primary, '--goldText': primary, '--goldDim': `${primary}1f`,
    '--navbg': dark ? 'rgba(20,18,14,0.92)' : 'rgba(250,248,243,0.92)', '--shadow': '0 24px 60px -28px rgba(40,30,10,0.18)',
  } as React.CSSProperties
}

export default async function InSiteListing({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { site: siteSlug, slug } = await params
  const r = await load(siteSlug, slug)
  if (!r) notFound()
  const d = await buildListingDetailData(r.it)
  return (
    <SiteChrome site={r.site} appendFooter>
      <Beacon slug={r.site.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.breadcrumbLd) }} />
      {d.nearbyLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d.nearbyLd) }} />}
      <div style={themeVars(r.site)}>
        <PropertyClient
          id={String(r.it.id)}
          initial={d.initial as any}
          originality={d.originality}
          initialEnrich={d.initialEnrich as any}
          site={{ slug: r.site.slug, title: r.site.title, hasListingsPage: r.site.pages.some(p => p.slug === 'listings') }}
        />
      </div>
    </SiteChrome>
  )
}
