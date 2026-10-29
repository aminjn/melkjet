import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, getSitePage, type Site, type SitePage, type SiteBlock } from '@/app/lib/sites-store'
import { listItems, listArticles, type Item } from '@/app/lib/scraper-store'
import { getTeamMembers, memberIdOf, type TeamMember } from '@/app/lib/team-members'
import { listReviews } from '@/app/lib/reviews-store'
import { shopProductsOf } from '@/app/lib/materials-store'
import ListingsSlider from './ListingsSlider'
import SiteListings, { type SiteListing } from './SiteListings'
import ServicesSlider from './ServicesSlider'
import HeroSlider from './HeroSlider'
import GallerySlider from './GallerySlider'
import BlogFull, { type BlogArticle } from './BlogFull'
import NavBar from './NavBar'
import ReviewForm from './ReviewForm'
import RevealPhone from './RevealPhone'
import { sealPhone, phoneMask } from '@/app/lib/phone-token'
import Beacon from './Beacon'
import { Fragment } from 'react'
import { getSiteStats } from '@/app/lib/site-stats-store'
import SiteMotion from './SiteMotion'

// Public renderer for builder-published sites living at melkjet.com/{slug}.
// Existing static single-segment routes (search, owner, ...) take precedence;
// this dynamic segment only catches unknown single-segment paths. Sub-pages live
// at /{slug}/{pageSlug} (app/[site]/[page]/page.tsx) and reuse the helpers here.
//
// Rendering mirrors the builder's BlockBody (app/components/tools/WebsiteBuilderTool.tsx),
// reading each block's `props` and the site `theme.primary`.

// فاز ۲۹۶و — بدونِ revalidate، نکست HTML صفحه را «تا دیپلویِ بعدی» کش می‌کرد: سایتِ
// ارتقایافته/ویرایش‌شده هرگز به بازدیدکننده نمی‌رسید («هیچ تغییری نکرد»). هر ۵ دقیقه تازه می‌شود.
export const revalidate = 300

export async function generateMetadata(
  { params }: { params: Promise<{ site: string }> }
): Promise<Metadata> {
  const { site: slug } = await params
  const site = await getSite(slug)
  if (!site) return {}
  // فاز ۲۹۶ (سئو): canonical + openGraph تا صفحهٔ اختصاصیِ شخص در گوگل درست ایندکس شود.
  const url = `https://melkjet.com/${encodeURIComponent(site.slug)}`
  const title = site.seo?.title || site.title
  const description = site.seo?.description || undefined
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

// Helper: read a prop with fallback.
function p(block: SiteBlock): Record<string, any> {
  return (block.props || {}) as Record<string, any>
}

// ── Owner listings: resolve the site owner's REAL published listings ──────────
// Mirrors the article↔listing owner match (app/api/content/route.ts): normalise
// whitespace + lowercase and compare for equality against item.owner.
function normOwner(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

// تطبیق آگهی‌ها با مالک سایت: اول با شمارهٔ حساب (مطمئن، مستقل از نام)، سپس
// به‌عنوان جایگزین با نامِ نمایشیِ نرمال‌شده.
async function ownerListings(ownerName: string | undefined, ownerPhone: string | undefined, count: number): Promise<Item[]> {
  const want = normOwner(ownerName || '')
  const phone = (ownerPhone || '').trim()
  if (!want && !phone) return []
  const all = await listItems('listing', { publicOnly: true })
  // معیارِ مطمئن: شمارهٔ حساب (هنگام انتشار مهر می‌خورد). فقط اگر هیچ آگهیِ مهرخورده‌ای
  // نبود، به‌عنوان جایگزین با نام تطبیق می‌دهیم — تا آگهی‌های سراسریِ سایت نشت نکنند.
  let mine = phone ? all.filter(it => it.meta?.__ownerPhone === phone) : []
  if (mine.length === 0 && want) mine = all.filter(it => !it.meta?.__ownerPhone && normOwner(it.owner || '') === want)
  return mine.slice(0, count)
}

// Owner articles: resolve the site owner's REAL published articles, matched the
// same way as listings — normalised meta.author === normalised site ownerName.
async function ownerArticles(ownerName: string | undefined, count: number): Promise<Item[]> {
  const want = normOwner(ownerName || '')
  if (!want) return []
  return (await listArticles({ publishedOnly: true }))
    .filter(it => normOwner(it.meta?.author || '') === want)
    .slice(0, count)
}

// ── Shared visual primitives ──────────────────────────────────────────────────
// رنگ‌ها از متغیرهای CSS خوانده می‌شوند تا با پالتِ تمِ سایت بازرنگ شوند (SiteShell
// روی <main> این متغیرها را از theme می‌ست می‌کند).
const INK = 'var(--mjs-heading)'
const MUTED = 'var(--mjs-muted)'
const SURFACE = 'var(--mjs-surface)'
const CARD_SHADOW = '0 10px 34px -22px rgba(20,16,10,.55), 0 2px 8px -4px rgba(20,16,10,.10)'
const SECTION_PAD = 'clamp(52px,7vw,88px) clamp(20px,5vw,24px)'
// فاز ۲۹۷ق۲ — حاشیه‌های «تم‌آگاه»: بژِ هاردکد (#efe9df و خانواده) روی پالت‌های تیره
// می‌جنگید و کل سیستم را آماتور نشان می‌داد. همه از رنگِ متنِ تم مشتق می‌شوند.
const BORDER = '1px solid color-mix(in srgb, var(--mjs-text) 13%, transparent)'
const BORDER_SOFT = '1px solid color-mix(in srgb, var(--mjs-text) 8%, transparent)'
const BORDER_DASHED = '1px dashed color-mix(in srgb, var(--mjs-text) 24%, transparent)'
const INPUT_BORDER = '1px solid color-mix(in srgb, var(--mjs-text) 20%, transparent)'
// دکمهٔ مدرن: گرادیانِ تم + درخششِ رنگی به‌جای رنگِ تختِ تنها.
const btnBg = (primary: string) => `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 72%, var(--mjs-secondary)))`

// Bold section heading with a short primary accent underline.
// فاز ۳۴۲ — «سرتیترِ کوچک» (eyebrow) بالای تیتر: ریتمِ مجله‌ای و یکدست با نشانِ هیرو؛ تیترِ تنهای بی‌مقدمه
// همان چیزی بود که بخش‌ها را «بلوکِ قالبی» نشان می‌داد.
function SectionHeading({ children, primary, center, light, sub, eyebrow }: {
  children: React.ReactNode; primary: string; center?: boolean; light?: boolean; sub?: string; eyebrow?: string
}) {
  return (
    <div style={{ marginBottom: 'clamp(26px,4vw,42px)', textAlign: center ? 'center' : 'right' }}>
      {eyebrow ? (
        <div className="mjs-eyebrow" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14,
          fontSize: 12.5, fontWeight: 800, letterSpacing: '.3px', color: light ? 'rgba(255,255,255,.8)' : primary,
        }}>
          {/* راست‌به‌چپ: سرِ پررنگِ هر خط کنارِ متن است */}
          <span aria-hidden style={{ width: 26, height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${primary}, transparent)` }} />
          {eyebrow}
          {center ? <span aria-hidden style={{ width: 26, height: 2, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${primary})` }} /> : null}
        </div>
      ) : null}
      <h2 style={{
        fontSize: 'clamp(28px,4.4vw,46px)', fontWeight: 900, letterSpacing: '-1.2px',
        color: light ? '#fff' : INK, margin: 0, lineHeight: 1.2,
      }}>{children}</h2>
      {eyebrow ? null : <div className="mjs-h-line" style={{
        height: 4, width: 88, borderRadius: 999,
        background: `linear-gradient(90deg, ${primary}, color-mix(in srgb, ${primary} 25%, transparent))`,
        boxShadow: `0 2px 14px -2px ${primary}99`,
        margin: center ? '14px auto 0' : '14px 0 0',
      }} />}
      {sub ? (
        <p style={{
          fontSize: 'clamp(14px,1.6vw,16px)', color: light ? 'rgba(255,255,255,.72)' : MUTED,
          margin: center ? '14px auto 0' : '14px 0 0', maxWidth: 640, lineHeight: 1.9,
        }}>{sub}</p>
      ) : null}
    </div>
  )
}

// فاز ۲۹۷ق — دادهٔ «پروفایلی» که پوسته به هیرو تزریق می‌کند (همه واقعی، هیچ عددِ ساختگی):
// آواتار از بلوکِ درباره، بازدیدِ کل از آمارِ خودِ سایت، نظرات از نظراتِ تاییدشدهٔ مالک.
type HeroExtras = {
  avatar?: string
  views: number
  reviewsCount: number
  reviewsAvg: number
  memberYear?: string
  listingsCount?: number   // فاز ۳۴۲ — آگهی‌های فعالِ واقعیِ مالک (+ تیم، برای آژانس)
  teamCount?: number       // فاز ۳۴۲ — مشاورانِ تیم (فقط وقتی سایت بلوکِ تیم دارد)
  contactHref?: string
  showStats: boolean
  // فاز ۲۹۷ق۳ — عکس‌های واقعیِ خودِ سایت (گالری/کارت‌های پروژه): هیروی بی‌عکس به‌جای
  // گرادیانِ خالی، اسلایدشوی سینماییِ همین عکس‌ها می‌شود (الگوی قالب‌های Shopify).
  heroImages?: string[]
  // پوستهٔ نسلِ ۲ — دادهٔ واقعیِ کارتِ پروفایلِ هیرو: نامِ برند و عنوانِ خدماتِ خودِ سایت.
  brand?: string
  highlights?: string[]
  // صفحهٔ داخلی (نه خانه): سربرگِ جمع‌وجور با مسیرِ صفحه به‌جای هیروی بزرگِ تکراری.
  inner?: { homeHref: string; title: string; isContact: boolean }
}

function HeroBlock({ block, primary, extras }: { block: SiteBlock; primary: string; extras?: HeroExtras }) {
  if (extras?.inner) return <InnerHero block={block} primary={primary} extras={extras} />
  const props = p(block)
  // پوستهٔ نسلِ ۲ — چیدمانِ «ادیتوریال»: متن در سمتِ شروع (راست) و ستونِ تصویری کنارش؛ «همه‌چیز وسطِ صفحه»
  // امضای قالب‌های پیش‌ساخته بود. فقط align='center'ِ صریح وسط‌چین می‌ماند.
  const alignPref = props.align === 'center' ? 'center' : 'right'
  const textColor = props.textColor || '#fff'
  const overlay: 'dark' | 'light' | 'none' =
    props.overlay === 'light' ? 'light' : props.overlay === 'none' ? 'none' : 'dark'

  const ownImages: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  const image: string = typeof props.image === 'string' ? props.image.trim() : ''
  const autoImages = (!image && ownImages.length < 2 && (extras?.heroImages?.length || 0) >= 2)
    ? extras!.heroImages! : null
  const images = ownImages.length >= 2 ? ownImages : (autoImages || ownImages)
  const useSlider = images.length >= 2
  const overlayGrad =
    overlay === 'dark' ? 'linear-gradient(180deg, rgba(10,8,6,.30), rgba(10,8,6,.72))'
      : overlay === 'light' ? 'linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.55))' : ''
  // پس‌زمینهٔ عکس‌دارِ دستیِ کاربر (bg با url) محترم است؛ گرادیانِ تختِ پیش‌فرضِ قالب نه.
  const bgImage = /url\(/.test(String(props.bg || '')) ? String(props.bg) : ''
  // بی‌عکس: «شفقِ» متحرک از رنگ‌های خودِ برند روی زمینهٔ تیرهٔ تم (به‌جای گرادیانِ تختِ قالبی)
  const aurora = !useSlider && !image && !bgImage

  // ستونِ تصویری: پرترهٔ واقعی (عکسِ بلوکِ درباره) یا کارتِ پروفایلِ شیشه‌ای از خدماتِ واقعیِ خودِ سایت.
  const highlights = (extras?.highlights || []).slice(0, 4)
  const visual: 'portrait' | 'card' | null = extras?.avatar ? 'portrait' : highlights.length >= 2 ? 'card' : null
  // قالب‌ها هیرو را صریحاً center ذخیره کرده‌اند؛ در چیدمانِ دوستونه متن همیشه از راست شروع می‌شود.
  const align = visual ? 'right' : alignPref
  const words = String(props.heading || '').trim().split(/\s+/).filter(Boolean)
  const gradLast = overlay !== 'light' && words.length >= 3
  const brand = (extras?.brand || '').trim()
  const fa = (n: number) => n.toLocaleString('fa-IR')

  return (
    <section id="hero" style={{
      position: 'relative', direction: 'rtl', overflow: 'hidden', isolation: 'isolate',
      background: 'var(--mjs-secondary)',
      padding: 'clamp(84px,12vw,132px) clamp(20px,5vw,32px) clamp(96px,12vw,140px)',
      minHeight: 'clamp(560px,88vh,880px)', display: 'flex', alignItems: 'center',
    }}>
      {/* لایهٔ پس‌زمینه (پارالاکس با اسکرول) */}
      <div className="mjs-hero-par" aria-hidden style={{ position: 'absolute', inset: '-8% 0 -8% 0', zIndex: 0, willChange: 'transform' }}>
        {useSlider ? <HeroSlider images={images} overlay={overlay} interval={5000} />
          : image ? <div style={{ position: 'absolute', inset: 0, background: `${overlayGrad ? overlayGrad + ', ' : ''}url(${image}) center/cover` }} />
            : bgImage ? <div style={{ position: 'absolute', inset: 0, background: `${overlayGrad ? overlayGrad + ', ' : ''}${bgImage}`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : null}
        {aurora ? (
          <div className="mjs-aurora" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(120% 90% at 85% 0%, color-mix(in srgb, ${primary} 26%, var(--mjs-secondary)), var(--mjs-secondary) 62%)` }}>
            <i style={{ position: 'absolute', width: '62vmax', height: '62vmax', top: '-28%', right: '-12%', borderRadius: '50%', opacity: .55, background: `radial-gradient(circle, ${primary}, transparent 64%)` }} />
            <i style={{ position: 'absolute', width: '48vmax', height: '48vmax', bottom: '-30%', left: '-10%', borderRadius: '50%', opacity: .42, background: `radial-gradient(circle, color-mix(in srgb, ${primary} 45%, #7b6cff), transparent 66%)` }} />
            <i style={{ position: 'absolute', width: '34vmax', height: '34vmax', top: '30%', left: '28%', borderRadius: '50%', opacity: .28, background: `radial-gradient(circle, color-mix(in srgb, ${primary} 35%, #fff), transparent 66%)` }} />
          </div>
        ) : null}
      </div>
      {/* شبکهٔ ظریف + محوشدن به زمینهٔ صفحه در پایین (پیوستگی با بخشِ بعد) */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: aurora ? .5 : .22,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
      }} />
      <div aria-hidden style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 120, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--mjs-secondary) 60%, transparent))' }} />

      <div className="mjs-hero-grid" style={{
        position: 'relative', zIndex: 2, maxWidth: 1180, margin: '0 auto', width: '100%',
        display: 'grid', gridTemplateColumns: visual ? 'minmax(0,1.15fr) minmax(0,.85fr)' : '1fr',
        gap: 'clamp(36px,5vw,72px)', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', textAlign: align as any, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', marginBottom: 22 }}>
            {(() => {
              const badge297 = props.eyebrow !== undefined ? String(props.eyebrow).trim()
                : props.badge !== undefined ? String(props.badge).trim() : 'املاک و مستغلات'
              return badge297 ? (
                <span className="mjs-hero-badge" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: textColor,
                  background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.20)',
                  padding: '7px 16px 7px 14px', borderRadius: 999,
                }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: primary, boxShadow: `0 0 0 4px ${primary}40` }} />{badge297}</span>
              ) : null
            })()}
            {/* نشانِ «تاییدشده» فقط وقتی ستونِ تصویری نیست (پرتره و کارت خودشان این نشان را دارند — دوباره نیاید) */}
            {!visual ? (
              <span className="mjs-hero-badge" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800,
                color: '#aef0c3', background: 'rgba(37,170,92,.20)', border: '1px solid rgba(110,224,152,.36)',
                padding: '7px 14px', borderRadius: 999,
              }}>✓ تاییدشده در ملک‌جت</span>
            ) : null}
          </div>
          <h1 className="mjs-hero-h1" style={{
            fontSize: 'clamp(36px,6.4vw,74px)', fontWeight: 900, color: textColor,
            margin: '0 0 22px', letterSpacing: '-1.8px', lineHeight: 1.12, maxWidth: 820,
          }}>
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className={`mjs-w${gradLast && i === words.length - 1 ? ' mjs-grad-word' : ''}`} style={{ ['--i' as any]: i }}>{w}</span>{i < words.length - 1 ? ' ' : ''}
              </Fragment>
            ))}
          </h1>
          {props.subheading ? (
            <p className="mjs-hero-sub" style={{
              fontSize: 'clamp(15.5px,1.9vw,19.5px)', color: textColor, opacity: .8,
              margin: '0 0 34px', maxWidth: 600, lineHeight: 1.95,
            }}>{props.subheading}</p>
          ) : null}
          <div className="mjs-hero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
            {props.buttonText ? (
              <a href={props.buttonLink || '#'} className="mjs-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 34px', background: btnBg(primary), borderRadius: 999,
                fontSize: 16, fontWeight: 800, color: '#fff', textDecoration: 'none',
                boxShadow: `0 18px 44px -14px ${primary}, inset 0 1px 0 rgba(255,255,255,.25)`,
              }}>{props.buttonText}<span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>←</span></a>
            ) : null}
            {extras?.contactHref && extras.contactHref !== (props.buttonLink || '') ? (
              <a href={extras.contactHref} className="mjs-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 28px',
                background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.28)',
                borderRadius: 999, fontSize: 15.5, fontWeight: 800, color: textColor,
                textDecoration: 'none',
              }}>☎ تماس</a>
            ) : null}
          </div>

          {/* کارتِ اعتماد — فقط اعدادِ واقعی (بازدیدِ کل، نظراتِ تاییدشده، سالِ عضویت) */}
          {extras?.showStats ? (() => {
            const cells: { value: string; label: string; count?: boolean }[] = []
            // فاز ۳۴۲ — اول اعدادی که برای مشتری معنا دارند (فایلِ فعال، مشاور، امتیاز). «۴۲ بازدید» عددِ کوچکِ
            // ضدِتبلیغ بود → بازدید فقط از ۳۰۰ به بالا. حداکثر سه خانه تا ردیف شلوغ نشود.
            if ((extras.listingsCount || 0) > 0) cells.push({ value: fa(extras.listingsCount!), label: 'فایلِ فعال', count: true })
            if ((extras.teamCount || 0) > 1) cells.push({ value: fa(extras.teamCount!), label: 'مشاورِ متخصص', count: true })
            if (extras.reviewsCount > 0) cells.push({ value: (Math.round(extras.reviewsAvg * 10) / 10).toLocaleString('fa-IR') + ' ★', label: `${fa(extras.reviewsCount)} نظرِ مشتری` })
            if (extras.views >= 300) cells.push({ value: fa(extras.views), label: 'بازدیدِ صفحه', count: true })
            if (extras.memberYear) cells.push({ value: extras.memberYear, label: 'عضوِ ملک‌جت از' })
            cells.splice(3)
            // «عضوِ ملک‌جت از ۱۴۰۵» به‌تنهایی ردیفِ آمار نمی‌سازد (یک عددِ تنها زیرِ دکمه‌ها خالی به نظر می‌رسید)
            if (cells.length === 0 || (cells.length === 1 && extras.memberYear && cells[0].value === extras.memberYear)) return null
            return (
              <div className="mjs-hero-trust" style={{
                display: 'flex', marginTop: 'clamp(34px,5vw,52px)', gap: 'clamp(18px,4vw,40px)', flexWrap: 'wrap',
                alignSelf: align === 'center' ? 'center' : 'flex-start',
              }}>
                {cells.map((c, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingInlineStart: i > 0 ? 'clamp(18px,4vw,40px)' : 0, borderInlineStart: i > 0 ? '1px solid rgba(255,255,255,.16)' : 'none' }}>
                    <span {...(c.count ? { 'data-count': '' } : {})} style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 900, color: '#fff', letterSpacing: '-.6px', lineHeight: 1 }}>{c.value}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.62)', whiteSpace: 'nowrap' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            )
          })() : null}
        </div>

        {visual === 'portrait' ? (
          <div className="mjs-hero-visual mjs-hero-portrait" style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 420 }}>
            <div aria-hidden style={{ position: 'absolute', inset: '8% -6% -6% 8%', borderRadius: 36, background: `linear-gradient(135deg, ${primary}, transparent 70%)`, opacity: .55, filter: 'blur(2px)' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={extras!.avatar} alt={brand} style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', objectPosition: 'top', borderRadius: 32, border: '1px solid rgba(255,255,255,.28)', boxShadow: '0 40px 90px -40px rgba(0,0,0,.85)' }} />
            <span className="mjs-float" style={{ position: 'absolute', bottom: '8%', right: '-6%', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderRadius: 16, background: 'rgba(255,255,255,.92)', color: '#15301f', fontSize: 13, fontWeight: 800, boxShadow: '0 20px 44px -18px rgba(0,0,0,.6)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#22a55a', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</span>تاییدشده در ملک‌جت
            </span>
            {extras!.reviewsCount > 0 ? (
              <span className="mjs-float-2" style={{ position: 'absolute', top: '9%', left: '-7%', padding: '10px 14px', borderRadius: 16, background: 'rgba(12,10,8,.86)', border: '1px solid rgba(255,255,255,.18)', color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: '0 20px 44px -18px rgba(0,0,0,.6)' }}>
                <span style={{ color: '#ffcf4a' }}>★</span> {(Math.round(extras!.reviewsAvg * 10) / 10).toLocaleString('fa-IR')} <span style={{ opacity: .65, fontWeight: 600 }}>از {fa(extras!.reviewsCount)} نظر</span>
              </span>
            ) : null}
          </div>
        ) : visual === 'card' ? (
          <div className="mjs-hero-visual mjs-hero-card" style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 420, perspective: 1400 }}>
            <div className="mjs-float" style={{
              position: 'relative', borderRadius: 28, padding: 'clamp(22px,3vw,30px)',
              // بدونِ backdrop-filter: پشتش شفقِ متحرک است و بلورِ پس‌زمینهٔ متحرک هر فریم از نو محاسبه می‌شد (لگِ اسکرول)
              background: 'linear-gradient(160deg, color-mix(in srgb, var(--mjs-secondary) 55%, rgba(255,255,255,.18)), color-mix(in srgb, var(--mjs-secondary) 80%, rgba(255,255,255,.06)))',
              border: '1px solid rgba(255,255,255,.22)',
              boxShadow: '0 50px 100px -50px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.28)',
              transform: 'rotateY(-9deg) rotateX(4deg)', transformStyle: 'preserve-3d', color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                <span style={{ width: 54, height: 54, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, background: btnBg(primary), boxShadow: `0 14px 30px -12px ${primary}` }}>{(brand || 'م').charAt(0)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16.5, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#aef0c3', marginTop: 3 }}>✓ تاییدشده در ملک‌جت</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {highlights.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.10)', fontSize: 14, fontWeight: 700 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', background: `${primary}55`, border: `1px solid ${primary}88` }}>✓</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</span>
                  </div>
                ))}
              </div>
              {extras?.contactHref ? (
                <a href={extras.contactHref} style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 14, background: '#fff', color: '#15110b', fontSize: 14, fontWeight: 900, textDecoration: 'none' }}>
                  گفت‌وگو با ما<span aria-hidden>←</span>
                </a>
              ) : null}
            </div>
            {/* فاز ۳۴۲ — به‌جای مربعِ رنگیِ شناور (شبیهِ خطای رندر)، تراشهٔ واقعیِ «فایلِ فعال» */}
            {(extras?.listingsCount || 0) > 0 ? (
              <span className="mjs-float-2" style={{ position: 'absolute', top: -16, left: -12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 16, background: '#fff', color: '#15110b', fontSize: 13, fontWeight: 800, boxShadow: '0 20px 44px -18px rgba(0,0,0,.6)' }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: btnBg(primary), color: '#fff', fontSize: 12 }}>⌂</span>
                {fa(extras!.listingsCount!)} فایلِ فعال
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* نشانهٔ اسکرول */}
      <div className="mjs-cue" aria-hidden style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 26, height: 42, borderRadius: 999, border: '1.5px solid rgba(255,255,255,.4)', display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <i style={{ display: 'block', width: 4, height: 8, borderRadius: 4, background: '#fff' }} />
      </div>
    </section>
  )
}

// پوستهٔ نسلِ ۲ — سربرگِ صفحه‌های داخلی: همان زبانِ بصریِ هیرو (شفق + شبکه) ولی کوتاه، با مسیرِ صفحه.
// قبلاً هر صفحه هیروی کاملِ خانه (کارتِ پروفایل، نوارِ متحرک، نشانهٔ اسکرول) را تکرار می‌کرد → همهٔ صفحه‌ها یکی.
function InnerHero({ block, primary, extras }: { block: SiteBlock; primary: string; extras: HeroExtras }) {
  const props = p(block)
  const inner = extras.inner!
  const textColor = props.textColor || '#fff'
  const image: string = typeof props.image === 'string' ? props.image.trim() : ''
  const heading = String(props.heading || inner.title || '').trim()
  const words = heading.split(/\s+/).filter(Boolean)
  const btnHref = String(props.buttonLink || '')
  // روی خودِ صفحهٔ تماس، دکمهٔ «تماس با ما» بی‌معناست (فرم و شماره همین زیر است).
  const showBtn = !!props.buttonText && !inner.isContact
  return (
    <section id="hero" style={{
      position: 'relative', direction: 'rtl', overflow: 'hidden', isolation: 'isolate', background: 'var(--mjs-secondary)',
      padding: 'clamp(56px,8vw,96px) clamp(20px,5vw,32px) clamp(48px,7vw,80px)', minHeight: 'clamp(280px,42vh,420px)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div className="mjs-hero-par" aria-hidden style={{ position: 'absolute', inset: '-10% 0 -10% 0', zIndex: 0 }}>
        {image ? <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,8,6,.35), rgba(10,8,6,.78)), url(${image}) center/cover` }} /> : (
          <div className="mjs-aurora" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(120% 120% at 90% 0%, color-mix(in srgb, ${primary} 24%, var(--mjs-secondary)), var(--mjs-secondary) 60%)` }}>
            <i style={{ position: 'absolute', width: '50vmax', height: '50vmax', top: '-40%', right: '-10%', borderRadius: '50%', opacity: .5, background: `radial-gradient(circle, ${primary}, transparent 64%)` }} />
            <i style={{ position: 'absolute', width: '40vmax', height: '40vmax', bottom: '-50%', left: '0%', borderRadius: '50%', opacity: .35, background: `radial-gradient(circle, color-mix(in srgb, ${primary} 45%, #7b6cff), transparent 66%)` }} />
          </div>
        )}
      </div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .4, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: '64px 64px', WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 70% 30%, #000 20%, transparent 75%)', maskImage: 'radial-gradient(ellipse 70% 80% at 70% 30%, #000 20%, transparent 75%)' }} />
      {/* واژهٔ اولِ تیتر، غول‌پیکر و توخالی در پس‌زمینهٔ سمتِ چپ */}
      {words[0] ? <div aria-hidden style={{ position: 'absolute', left: '-1%', bottom: '-0.18em', zIndex: 0, fontSize: 'clamp(110px,19vw,260px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-6px', color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,.10)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{words[0]}</div> : null}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1180, margin: '0 auto', width: '100%' }}>
        <nav aria-label="مسیر" className="mjs-hero-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.62)', marginBottom: 18 }}>
          <a href={inner.homeHref} style={{ color: 'rgba(255,255,255,.62)', textDecoration: 'none' }}>خانه</a>
          <span aria-hidden style={{ opacity: .5 }}>/</span>
          <span style={{ color: '#fff' }}>{inner.title}</span>
        </nav>
        <h1 style={{ fontSize: 'clamp(34px,5.4vw,62px)', fontWeight: 900, color: textColor, margin: '0 0 14px', letterSpacing: '-1.4px', lineHeight: 1.15, maxWidth: 820 }}>
          {words.map((w, i) => (
            <Fragment key={i}><span className={`mjs-w${words.length >= 2 && i === words.length - 1 ? ' mjs-grad-word' : ''}`} style={{ ['--i' as any]: i }}>{w}</span>{i < words.length - 1 ? ' ' : ''}</Fragment>
          ))}
        </h1>
        {props.subheading ? <p className="mjs-hero-sub" style={{ fontSize: 'clamp(15px,1.8vw,18px)', color: textColor, opacity: .78, margin: 0, maxWidth: 620, lineHeight: 1.9 }}>{props.subheading}</p> : null}
        {showBtn ? (
          <div className="mjs-hero-ctas" style={{ marginTop: 26 }}>
            <a href={btnHref || '#'} className="mjs-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', background: btnBg(primary), borderRadius: 999, fontSize: 15, fontWeight: 800, color: '#fff', textDecoration: 'none', boxShadow: `0 16px 36px -14px ${primary}` }}>{props.buttonText}<span aria-hidden>←</span></a>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SearchBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section style={{ background: SURFACE, padding: 'clamp(28px,5vw,44px) clamp(20px,5vw,24px)', direction: 'rtl' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {props.heading ? <h2 style={{ fontSize: 'clamp(18px,2.4vw,22px)', fontWeight: 800, color: INK, marginBottom: 16 }}>{props.heading}</h2> : null}
        <div className="mjs-search-row" style={{
          display: 'flex', gap: 12, background: 'var(--mjs-bg)', padding: 10, borderRadius: 18,
          boxShadow: CARD_SHADOW, border: BORDER,
        }}>
          <div style={{ flex: 1, minHeight: 52, background: 'var(--mjs-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '0 18px', color: MUTED, fontSize: 15 }}>
            <span style={{ marginLeft: 10, opacity: .7 }}>🔍</span>{props.placeholder}
          </div>
          <div className="mjs-btn" style={{ padding: '0 34px', minHeight: 52, background: btnBg(primary), borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: `0 10px 26px -12px ${primary}` }}>جستجو</div>
        </div>
      </div>
    </section>
  )
}

// Reusable property/article card.
function MediaCard({ href, image, gradient, children }: {
  href: string; image?: string; gradient: string; children: React.ReactNode
}) {
  return (
    <a href={href} className="mjs-card" style={{
      background: 'var(--mjs-bg)', borderRadius: 18, overflow: 'hidden', border: BORDER,
      textDecoration: 'none', display: 'block', boxShadow: CARD_SHADOW,
    }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 190, background: `linear-gradient(135deg,${gradient})` }} />
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </a>
  )
}

// حالتِ خالیِ صادقانه — روی سایتِ منتشرشدهٔ کاربر هرگز آگهی/قیمتِ ساختگی نمایش داده نمی‌شود.
function EmptyBlockNote({ text }: { text: string }) {
  return <div style={{ marginTop: 24, padding: '28px 18px', textAlign: 'center', color: MUTED, fontSize: 13.5, background: SURFACE, borderRadius: 16, border: BORDER_DASHED }}>{text}</div>
}

async function ListingsBlock({ block, primary, ownerName, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerName?: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  // total = تعداد آگهی‌های بارگذاری‌شده (پیش‌فرض ۹)؛ count به‌عنوان جایگزینِ legacy.
  const total = Math.max(1, Math.min(48, Number(props.total) || Number(props.count) || 9))
  const perSlide = Math.max(1, Math.min(6, Number(props.perSlide) || 3))
  const showCategories = props.showCategories !== 'no'

  // فقط آگهی‌های واقعیِ منتشرشدهٔ مالک — هیچ دادهٔ نمونه/فیک. در نبودِ آگهی، حالتِ خالی.
  const items = await ownerListings(ownerName, ownerPhone, total)
  const categories: string[] = []
  for (const it of items) {
    const c = (it.category || '').trim()
    if (c && !categories.includes(c)) categories.push(c)
  }
  const sliderItems = items.map(it => ({
    id: it.id, title: it.title, location: it.location, price: it.price, image: it.image, category: (it.category || '').trim(),
  }))
  // پوستهٔ نسلِ ۲ — بخشِ خالی روی سایتِ منتشرشده رندر نمی‌شود (جعبهٔ «هنوز … نداریم» امضای قالبِ پیش‌ساخته بود).
  if (items.length === 0) return null
  return (
    <section id="listings" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="فایل‌های منتخب">{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <EmptyBlockNote text="به‌زودی آگهی‌های ما اینجا نمایش داده می‌شود." />
        ) : (
          <ListingsSlider
            items={sliderItems}
            categories={categories}
            perSlide={perSlide}
            primary={primary}
            showCategories={showCategories}
            siteSlug={slug || ''}
          />
        )}
      </div>
    </section>
  )
}

async function BlogBlock({ block, primary, ownerName, slug: siteSlug }: { block: SiteBlock; primary: string; ownerName?: string; slug?: string }) {
  const props = p(block)
  const n = Math.max(1, Math.min(12, Number(props.count) || 3))
  const grads = ['#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d2215,#1e1a12', '#2d1515,#1e0e0e', '#1e2215,#141a10']

  // فقط مقاله‌های واقعیِ منتشرشدهٔ مالک — هیچ دادهٔ نمونه. در نبودِ مقاله، حالتِ خالی.
  const items = await ownerArticles(ownerName, n)
  // پوستهٔ نسلِ ۲ — بخشِ خالی روی سایتِ منتشرشده رندر نمی‌شود (جعبهٔ «هنوز … نداریم» امضای قالبِ پیش‌ساخته بود).
  if (items.length === 0) return null
  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="مجله">{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <div style={{ background: 'var(--mjs-bg)', border: BORDER_DASHED, borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: MUTED, fontSize: 14.5 }}>
            هنوز مقالهٔ منتشرشده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {items.map((it, i) => {
              const slug = it.meta?.slug || it.id
              const excerpt = it.meta?.summary || it.meta?.metaDescription || it.excerpt || ''
              const cat = (it.category || it.meta?.category || '').trim()
              const author = (it.meta?.author || '').trim()
              const date = (it.meta?.date || it.meta?.publishedAt || '').trim()
              const meta = [author, date].filter(Boolean).join(' · ')
              return (
                <MediaCard key={it.id} href={siteSlug ? `/${siteSlug}/blog/${slug}` : `/article/${slug}`} image={it.image} gradient={grads[i % grads.length]}>
                  {cat ? (
                    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: primary, background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 999, padding: '3px 11px', marginBottom: 12 }}>{cat}</span>
                  ) : null}
                  <div style={{ fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.title}</div>
                  {excerpt ? <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.95, margin: '0 0 16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{excerpt}</p> : null}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: BORDER_SOFT, paddingTop: 14 }}>
                    {meta ? <span style={{ fontSize: 12, color: MUTED }}>{meta}</span> : <span />}
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: primary }}>ادامه مطلب →</span>
                  </div>
                </MediaCard>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// صفحهٔ کاملِ وبلاگ: فقط مقاله‌های واقعیِ منتشرشده را بارگذاری می‌کند (هیچ دادهٔ نمونه)؛
// دسته‌ها را استخراج و به مؤلفهٔ کلاینتِ BlogFull (فیلتر + جستجو + ساید‌بار) پاس می‌دهد.
async function BlogFullBlock({ block, primary, ownerName, slug }: { block: SiteBlock; primary: string; ownerName?: string; slug?: string }) {
  const props = p(block)
  const heading = props.heading || 'وبلاگ'
  const sidebar: 'yes' | 'no' = props.sidebar === 'no' ? 'no' : 'yes'

  const items = await ownerArticles(ownerName, 24)
  const articles: BlogArticle[] = items.map(it => ({
    id: it.id,
    slug: it.meta?.slug || it.id,
    title: it.title,
    excerpt: it.meta?.summary || it.meta?.metaDescription || it.excerpt || '',
    image: it.image,
    category: (it.category || it.meta?.category || '').trim() || undefined,
    author: (it.meta?.author || '').trim() || undefined,
    date: (it.meta?.date || it.meta?.publishedAt || '').trim() || undefined,
  }))

  // دسته‌های متمایزِ غیرخالی به ترتیبِ اولین مشاهده.
  const categories: string[] = []
  for (const a of articles) {
    const c = (a.category || '').trim()
    if (c && !categories.includes(c)) categories.push(c)
  }

  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="مجله">{heading}</SectionHeading>
        <BlogFull articles={articles} categories={categories} sidebar={sidebar} primary={primary} siteSlug={slug || ''} />
      </div>
    </section>
  )
}

// تبدیلِ رقمِ فارسی به لاتین و استخراجِ عدد.
function faDigits(s: string): number {
  const latin = String(s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const n = parseInt(latin.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// «آگهی‌ها با جستجو و فیلتر» — مثلِ صفحهٔ اصلیِ آگهی‌ها: گریدِ کامل + فیلتر + جستجو.
async function SearchListBlock({ block, primary, ownerName, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerName?: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const total = Math.max(1, Math.min(300, Number(props.total) || 60))
  const items: SiteListing[] = (await ownerListings(ownerName, ownerPhone, total)).map(it => {
    const m = (it.meta || {}) as Record<string, string>
    const deal: 'sale' | 'rent' = m['نوع معامله'] === 'اجاره' ? 'rent' : 'sale'
    return {
      id: it.id, title: it.title, location: it.location, price: it.price, image: it.image, category: (it.category || '').trim(),
      deal, ptype: (m['نوع ملک'] || '').trim(),
      city: (m['شهر'] || '').trim(), neighborhood: (m['محله'] || m['منطقه'] || '').trim(),
      rooms: faDigits(m['اتاق خواب'] || ''), area: faDigits(m['متراژ'] || ''),
      priceNum: faDigits(it.price || ''),
    }
  })
  return (
    <section id="listings" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="جستجوی فایل">{props.heading}</SectionHeading>
        {items.length === 0 ? (
          // پوستهٔ نسلِ ۲ — صفحهٔ «فایل‌ها» بی‌آگهی: به‌جای جعبهٔ نقطه‌چینِ «هنوز … نداریم»، دعوت به «سفارشِ فایل»
          // (رفتارِ واقعیِ مشاور: فایلِ مناسب را خودش پیدا می‌کند) — صفحه خالی نمی‌ماند و مشتری یک اقدام دارد.
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, padding: 'clamp(36px,6vw,64px) clamp(22px,5vw,56px)', background: `radial-gradient(90% 120% at 100% 0%, ${primary}22, transparent 60%), ${SURFACE}`, border: BORDER, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <div style={{ fontSize: 'clamp(20px,2.6vw,28px)', fontWeight: 900, color: INK, marginBottom: 12, letterSpacing: '-.5px' }}>فایلِ مناسبِ شما را ما پیدا می‌کنیم</div>
              <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--mjs-text)', margin: 0, maxWidth: 520 }}>فایل‌های جدید به‌زودی این‌جا منتشر می‌شوند. بگویید دنبالِ چه ملکی هستید — منطقه، متراژ و بودجه — تا فایل‌های مناسب را مستقیم برایتان بفرستیم.</p>
            </div>
            <a href={slug ? `/${encodeURIComponent(slug)}/contact` : '#contact'} className="mjs-btn" style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '15px 30px', borderRadius: 999, background: btnBg(primary), color: '#fff', fontSize: 15.5, fontWeight: 800, textDecoration: 'none', boxShadow: `0 16px 36px -14px ${primary}` }}>سفارشِ فایل<span aria-hidden>←</span></a>
          </div>
        ) : (
          <SiteListings items={items} primary={primary} siteSlug={slug || ''} />
        )}
      </div>
    </section>
  )
}

function ServicesBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  const perSlide = Math.max(1, Math.min(4, Number(props.perSlide) || 3))
  return (
    <section id="services" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="خدمات">{props.heading}</SectionHeading>
        <ServicesSlider items={items} perSlide={perSlide} primary={primary} />
      </div>
    </section>
  )
}

function AboutBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  return (
    <section id="about" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div className="mjs-about" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 'clamp(28px,5vw,56px)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px' }}>
          <SectionHeading primary={primary} eyebrow="درباره ما">{props.heading}</SectionHeading>
          <p style={{ fontSize: 'clamp(15px,1.7vw,16.5px)', lineHeight: 2.1, color: 'var(--mjs-text)', margin: 0 }}>{props.text}</p>
        </div>
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt="" style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, objectFit: 'cover', borderRadius: 22, boxShadow: CARD_SHADOW }} />
        ) : (
          // پوستهٔ نسلِ ۲ — بی‌عکس: ترکیبِ «مونوگرام» (حرفِ اولِ تیتر در حلقه‌های متحرکِ برند) به‌جای
          // جعبهٔ گرادیانیِ خالی که آشکارا جای‌خالیِ قالب بود.
          <div aria-hidden style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 340, position: 'relative', borderRadius: 28, overflow: 'hidden', background: `radial-gradient(120% 100% at 80% 0%, color-mix(in srgb, ${primary} 30%, var(--mjs-secondary)), var(--mjs-secondary) 70%)`, boxShadow: CARD_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {[220, 300, 380].map((d, i) => (
              <span key={d} className={i % 2 ? 'mjs-float-2' : 'mjs-float'} style={{ position: 'absolute', width: d, height: d, borderRadius: '50%', border: `1px solid ${primary}${['66', '40', '22'][i]}` }} />
            ))}
            <span style={{ position: 'relative', fontSize: 132, fontWeight: 900, lineHeight: 1, background: `linear-gradient(160deg, #fff, ${primary})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{String(props.heading || 'م').replace(/^درباره(ٔ|ی)?\s*/, '').trim().charAt(0) || 'م'}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// فاز ۲۹۷ق — آمار به‌شکلِ کاشی‌های کارتیِ آیکن‌دار (الگوی «وضعیتِ پروژه‌ها»ی پلتفرم‌های حرفه‌ای)
// به‌جای عددهای لختِ وسطِ صفحه. آیکن از کلیدواژهٔ برچسب حدس زده می‌شود.
const STAT_ICONS: [RegExp, string][] = [
  [/پروژه/, '🏗'], [/واحد/, '🏢'], [/متراژ|زمین|متر/, '📐'], [/منطقه|محله|شهر/, '📍'],
  [/سال|تجربه|سابقه/, '⏳'], [/مشتری|رضایت|همراه/, '🤝'], [/آگهی|ملک|فایل/, '🏠'],
  [/قرارداد|معامله|پرونده/, '📝'], [/کارشناس|مشاور|تیم|نفر/, '👥'], [/محصول|کالا/, '📦'],
]
function statIcon(label: string): string {
  for (const [re, icon] of STAT_ICONS) if (re.test(label)) return icon
  return '✦'
}

function StatsBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const items: any[] = Array.isArray(props.items) ? props.items : []
  if (!items.length) return null
  // پوستهٔ نسلِ ۲ — باندِ تیرهٔ برند با عددهای بزرگِ گرادیانی که از صفر شمرده می‌شوند (SiteMotion)؛
  // کاشی‌های سفیدِ ایموجی‌دار حسِ قالبِ آماده می‌داد. ریتمِ تیره/روشن هم صفحه را از یکنواختی درمی‌آورد.
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--mjs-secondary)', padding: 'clamp(64px,9vw,104px) clamp(20px,5vw,24px)', direction: 'rtl' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(600px 280px at 85% 0%, ${primary}38, transparent 70%), radial-gradient(500px 260px at 10% 100%, ${primary}24, transparent 70%)` }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .35, backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '120px 100%' }} />
      <div className="mjs-stats-grid" style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)},minmax(0,1fr))`, gap: 0 }}>
        {items.map((s, i) => (
          <div key={i} className="mjs-stat" style={{
            padding: 'clamp(14px,2.4vw,22px) clamp(14px,2.6vw,28px)', textAlign: 'right',
            borderInlineStart: i > 0 ? '1px solid rgba(255,255,255,.14)' : 'none',
          }}>
            {/* فاز ۳۴۲ — «۲۰ ساعته»/«۱۲ سال»: عدد بزرگ، واحد کوچک کنارش (قبلاً کلِ عبارت ۶۴px می‌شد و دو خط) */}
            {(() => {
              const v = String(s?.value ?? '').trim()
              const m = v.match(/^([+\-]?[0-9۰-۹٬,.]+[%٪+]?)\s+(\S.*)$/)
              return (
                <div className="mjs-stat-num" style={{ fontSize: 'clamp(40px,5.6vw,64px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                  <span data-count="">{m ? m[1] : v}</span>
                  {m ? <span style={{ fontSize: '.4em', letterSpacing: 0, marginInlineStart: 8, fontWeight: 800 }}>{m[2]}</span> : null}
                </div>
              )
            })()}
            <div style={{ fontSize: 'clamp(13.5px,1.5vw,15px)', color: 'rgba(255,255,255,.66)', fontWeight: 700, marginTop: 10 }}>{String(s?.label || '')}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GalleryBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const imgs: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  const total = Math.max(1, Math.min(48, Number(props.total) || 9))
  const perSlide = Math.max(1, Math.min(6, Number(props.perSlide) || 3))
  // پوستهٔ نسلِ ۲ — بخشِ خالی روی سایتِ منتشرشده رندر نمی‌شود (جعبهٔ «هنوز … نداریم» امضای قالبِ پیش‌ساخته بود).
  if (imgs.length === 0) return null
  return (
    <section id="gallery" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="گالری">{props.heading}</SectionHeading>
        <GallerySlider images={imgs.slice(0, total)} perSlide={perSlide} primary={primary} />
      </div>
    </section>
  )
}

function TestimonialsBlock({ block, primary, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const showReal = props.showReal !== 'no'
  const allowSubmit = props.allowSubmit !== 'no'

  // نظراتِ دستی (props.items) + نظراتِ واقعیِ ثبت‌شده برای مالکِ سایت.
  type Quote = { name: string; text: string; rating: number }
  const manual: Quote[] = (Array.isArray(props.items) ? props.items : []).map((s: any) => ({
    name: String(s?.name || '').trim(),
    text: String(s?.text || ''),
    rating: Math.max(0, Math.min(5, Number(s?.rating) || 5)),
  }))
  const real: Quote[] = (showReal && ownerPhone)
    ? listReviews(ownerPhone).map(r => ({ name: r.name, text: r.text, rating: Math.max(0, Math.min(5, Number(r.rating) || 5)) }))
    : []
  // دستی‌ها اول، سپس واقعی‌ها.
  const quotes: Quote[] = [...manual, ...real]

  // پوستهٔ نسلِ ۲ — بدونِ هیچ نظری: چیدمانِ دوستونه (دعوت + فرم) به‌جای یک فرمِ تنهای وسطِ بخشِ خالی.
  if (quotes.length === 0) {
    if (!(allowSubmit && slug)) return null
    return (
      <section id="reviews" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
        <div className="mjs-about" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 'clamp(28px,5vw,64px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', position: 'relative' }}>
            <div aria-hidden style={{ position: 'absolute', top: -40, right: -8, fontSize: 180, lineHeight: 1, fontWeight: 900, color: `${primary}1c`, pointerEvents: 'none' }}>”</div>
            <SectionHeading primary={primary} eyebrow="صدای مشتریان">{props.heading}</SectionHeading>
            <p style={{ fontSize: 'clamp(15px,1.7vw,17px)', lineHeight: 2.1, color: 'var(--mjs-text)', margin: 0, maxWidth: 440 }}>
              تجربهٔ همکاری با ما را بنویسید — نظرِ شما پس از تأیید این‌جا منتشر می‌شود و به دیگران در انتخاب کمک می‌کند.
            </p>
          </div>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}><ReviewForm slug={slug} primary={primary} /></div>
        </div>
      </section>
    )
  }

  return (
    <section id="reviews" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="صدای مشتریان" center>{props.heading}</SectionHeading>
        {quotes.length > 0 ? (
          <div className="mjs-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 24 }}>
            {quotes.map((s, i) => {
              const rating = Math.max(0, Math.min(5, Number(s.rating) || 5))
              const initial = (s.name || '?').toString().trim().charAt(0) || '?'
              return (
                <div key={i} className="mjs-card" style={{ background: 'var(--mjs-bg)', border: BORDER, borderRadius: 18, padding: 26, boxShadow: CARD_SHADOW }}>
                  <div style={{ fontSize: 40, lineHeight: 0.6, color: `${primary}55`, fontWeight: 900, marginBottom: 8 }}>”</div>
                  <p style={{ fontSize: 15, lineHeight: 2, color: 'var(--mjs-text)', margin: '0 0 18px' }}>{s.text}</p>
                  <div style={{ color: primary, marginBottom: 16, fontSize: 15, letterSpacing: 2 }}>
                    {'★'.repeat(rating)}<span style={{ color: 'color-mix(in srgb, var(--mjs-text) 25%, transparent)' }}>{'★'.repeat(5 - rating)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: BORDER_SOFT, paddingTop: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${primary}1f`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{initial}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{s.name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (allowSubmit && slug) ? (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 14.5 }}>اولین نظر را شما ثبت کنید.</div>
        ) : null}

        {allowSubmit && slug ? <ReviewForm slug={slug} primary={primary} /> : null}
      </div>
    </section>
  )
}

// فاز ۲۹۷ق۲ — CTA به‌شکلِ پنلِ شیشه‌ایِ مدرن روی گرادیانِ تم + هالهٔ رنگی، به‌جای نوارِ تخت.
function CtaBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const baseBg = props.bg || 'linear-gradient(135deg, var(--mjs-primary), var(--mjs-secondary) 75%)'
  const bg = `linear-gradient(180deg, rgba(12,9,6,.22), rgba(12,9,6,.48)), ${baseBg}`
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: bg, backgroundSize: 'cover', backgroundPosition: 'center', padding: 'clamp(56px,8vw,92px) clamp(20px,5vw,24px)', textAlign: 'center', direction: 'rtl' }}>
      <div aria-hidden className="mjs-hero-glow" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(460px 300px at 85% 15%, ${primary}33, transparent 70%), radial-gradient(420px 300px at 10% 90%, rgba(255,255,255,.10), transparent 70%)`,
      }} />
      {/* پوستهٔ نسلِ ۲ — لبهٔ درخشانِ چرخان دورِ پنل. فاز ۳۴۱: قبلاً conicِ @property بود که هر فریم کلِ پنل را
          دوباره رنگ می‌کرد (~۶۰٪ هزینهٔ رسترِ اسکرول)؛ حالا لایهٔ ::before یک بار رنگ می‌شود و فقط transform می‌چرخد. */}
      <div className="mjs-glow-border" style={{ position: 'relative', maxWidth: 824, margin: '0 auto', padding: 2, borderRadius: 32, overflow: 'hidden', isolation: 'isolate', background: `color-mix(in srgb, ${primary} 35%, transparent)` }}>
      <div style={{
        position: 'relative', maxWidth: 820, margin: '0 auto',
        background: 'color-mix(in srgb, var(--mjs-secondary) 92%, transparent)',
        border: '1px solid rgba(255,255,255,.10)', borderRadius: 30,
        padding: 'clamp(36px,6vw,60px) clamp(22px,5vw,48px)',
        boxShadow: '0 34px 90px -40px rgba(0,0,0,.75)',
      }}>
        <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.8px', lineHeight: 1.25 }}>{props.heading}</h2>
        {props.subheading ? <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(255,255,255,0.78)', margin: '0 0 34px', lineHeight: 1.9 }}>{props.subheading}</p> : null}
        {props.buttonText ? <a href={props.buttonLink || '#'} className="mjs-btn" style={{ display: 'inline-block', padding: '15px 42px', background: '#fff', borderRadius: 999, fontSize: 16, fontWeight: 800, color: '#15110b', textDecoration: 'none', boxShadow: '0 18px 44px -16px rgba(0,0,0,.65)' }}>{props.buttonText}</a> : null}
      </div>
      </div>
    </section>
  )
}

// فاز ۲۹۷ق — تماس به‌شکلِ دوستونه (کارتِ «ارتباط با ما» + فرم) با دکمهٔ «نمایشِ شماره»
// (الگوی پلتفرم‌های تخصصی) — شماره در HTML خام لو نمی‌رود و حسِ پلتفرمِ جدی می‌دهد.
function ContactBlock({ block, primary, slug }: { block: SiteBlock; primary: string; slug?: string }) {
  const props = p(block)
  const phone = String(props.phone || '').trim()
  const email = String(props.email || '').trim()
  const address = String(props.address || '').trim()
  const Row = ({ icon, label, children, ltr }: { icon: string; label: string; children: React.ReactNode; ltr?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 13, background: `${primary}16`, border: `1px solid ${primary}2e`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: 'var(--mjs-text)', fontWeight: 700, direction: ltr ? 'ltr' : 'rtl', textAlign: 'right', overflowWrap: 'anywhere' }}>{children}</div>
      </div>
    </div>
  )
  return (
    <section id="contact" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="در تماس باشید">{props.heading}</SectionHeading>
        <div className="mjs-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 22, alignItems: 'start' }}>
          {/* کارتِ راه‌های ارتباطی */}
          <div className="mjs-card" style={{ background: SURFACE, border: BORDER, borderRadius: 22, padding: 'clamp(22px,3.5vw,30px)', boxShadow: CARD_SHADOW }}>
            <div style={{ fontSize: 16.5, fontWeight: 900, color: INK, marginBottom: 20 }}>ارتباط با ما</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {phone ? <Row icon="☎" label="شمارهٔ تماس"><RevealPhone token={sealPhone(phone)} mask={phoneMask(phone)} primary={primary} slug={slug} /></Row> : null}
              {email ? <Row icon="✉" label="ایمیل" ltr><a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a></Row> : null}
              {address ? <Row icon="📍" label="آدرس">{address}</Row> : null}
            </div>
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="mjs-btn" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24,
                padding: '14px 18px', background: btnBg(primary), borderRadius: 999, fontSize: 15, fontWeight: 800,
                color: '#fff', textDecoration: 'none', boxShadow: `0 12px 30px -14px ${primary}`,
              }}>☎ تماسِ مستقیم</a>
            ) : null}
          </div>
          {/* فرمِ پیام */}
          <div className="mjs-card" style={{ background: SURFACE, border: BORDER, borderRadius: 22, padding: 'clamp(22px,3.5vw,30px)', boxShadow: CARD_SHADOW }}>
            <div style={{ fontSize: 16.5, fontWeight: 900, color: INK, marginBottom: 18 }}>پیام بگذارید</div>
            <div className="mjs-contact-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <input placeholder="نام" style={{ minHeight: 50, background: 'var(--mjs-bg)', border: INPUT_BORDER, borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
              <input placeholder="شماره تماس" style={{ minHeight: 50, background: 'var(--mjs-bg)', border: INPUT_BORDER, borderRadius: 12, padding: '0 16px', fontSize: 14.5, fontFamily: 'inherit' }} />
            </div>
            <textarea placeholder="پیام شما" style={{ width: '100%', minHeight: 120, background: 'var(--mjs-bg)', border: INPUT_BORDER, borderRadius: 12, padding: 16, fontSize: 14.5, marginBottom: 18, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
            <button className="mjs-btn" style={{ padding: '14px 38px', background: btnBg(primary), borderRadius: 999, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: `0 12px 30px -14px ${primary}`, fontFamily: 'inherit' }}>ارسال پیام</button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Rich multi-column footer ──────────────────────────────────────────────────
// پسوندِ تیرهٔ برند (var(--mjs-secondary)): برند + توضیح، ستون‌های لینک، تماس و
// شبکه‌های اجتماعی در گریدِ واکنش‌گرا، با ردیفِ کپی‌رایت در پایین. سازگار با propهای legacy.
type FooterLink = { label: string; href: string }
type FooterColumn = { title: string; links: FooterLink[] }

function FooterBlock({ block, primary, ownerName, slug }: { block: SiteBlock; primary: string; ownerName?: string; slug?: string }) {
  const props = p(block)

  const brand: string = String(props.brand || props.text || ownerName || 'ملک‌جت').trim() || 'ملک‌جت'
  const about: string = String(props.about || 'همراه شما در خرید و فروش ملک.').trim()
  const copyright: string = String(props.copyright || '© ۱۴۰۴ — تمامی حقوق محفوظ است').trim()

  // ستون‌ها: props.columns ← اگر نبود، propی legacyِ links به‌عنوان یک ستونِ «دسترسی سریع».
  let columns: FooterColumn[] = Array.isArray(props.columns)
    ? (props.columns as any[])
        .map(c => ({ title: String(c?.title || '').trim(), links: Array.isArray(c?.links) ? (c.links as any[]).map(l => ({ label: String(l?.label || ''), href: String(l?.href || '#') })) : [] }))
        .filter(c => c.title || c.links.length)
        .slice(0, 4)
    : []
  if (columns.length === 0 && Array.isArray(props.links) && props.links.length) {
    columns = [{ title: 'دسترسی سریع', links: (props.links as any[]).map(l => ({ label: String(l?.label || ''), href: String(l?.href || '#') })) }]
  }

  const phone = String(props.phone || '').trim()
  const email = String(props.email || '').trim()
  const address = String(props.address || '').trim()
  const hasContact = !!(phone || email || address)

  // شبکه‌های اجتماعی: هم از props.social (شیء) و هم از فیلدهای مسطحِ ویرایشگر خوانده می‌شود.
  const socialObj = (props.social && typeof props.social === 'object' ? props.social : {}) as Record<string, string>
  const social: Record<string, string> = {
    instagram: socialObj.instagram || props.instagram,
    telegram: socialObj.telegram || props.telegram,
    whatsapp: socialObj.whatsapp || props.whatsapp,
    linkedin: socialObj.linkedin || props.linkedin,
  }
  const socialItems: { key: string; glyph: string; href: string; label: string }[] = []
  const sv = (v: any) => String(v || '').trim()
  if (sv(social.instagram)) socialItems.push({ key: 'instagram', glyph: 'IG', href: sv(social.instagram), label: 'اینستاگرام' })
  if (sv(social.telegram)) socialItems.push({ key: 'telegram', glyph: 'TG', href: sv(social.telegram), label: 'تلگرام' })
  if (sv(social.whatsapp)) socialItems.push({ key: 'whatsapp', glyph: 'WA', href: sv(social.whatsapp), label: 'واتساپ' })
  if (sv(social.linkedin)) socialItems.push({ key: 'linkedin', glyph: 'in', href: sv(social.linkedin), label: 'لینکدین' })

  const ContactRow = ({ icon, children, ltr }: { icon: string; children: React.ReactNode; ltr?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
      <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 9, background: `${primary}26`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13.5, color: '#b6ac9c', direction: ltr ? 'ltr' : 'rtl', textAlign: 'right', flex: 1 }}>{children}</span>
    </div>
  )

  return (
    <footer style={{ position: 'relative', background: 'var(--mjs-secondary)', padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,24px) 32px', direction: 'rtl' }}>
      {/* فاز ۲۹۷ق۲ — خطِ گرادیانیِ جداکننده بالای فوتر */}
      <div aria-hidden style={{ position: 'absolute', top: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 2, background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }} />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* «1.5fr repeat(auto-fit,…)» نامعتبر بود (auto-repeat کنارِ ستونِ fr مجاز نیست) → کلِ قاعده نادیده و فوتر
            یک‌ستونه می‌شد. شمارِ ستون‌ها صریح: برند + ستون‌های لینک + تماس. */}
        <div className="mjs-footer-grid" style={{ display: 'grid', gridTemplateColumns: `minmax(0,1.5fr) repeat(${Math.max(1, columns.length + (hasContact ? 1 : 0))}, minmax(0,1fr))`, gap: 'clamp(28px,5vw,44px)', marginBottom: 38, alignItems: 'start' }}>
          {/* برند + توضیح + شبکه‌های اجتماعی */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: primary, marginBottom: 14, letterSpacing: '-0.4px' }}>{brand}</div>
            {about ? <p style={{ fontSize: 14, color: '#9b9183', lineHeight: 2, maxWidth: 340, margin: '0 0 18px' }}>{about}</p> : null}
            {socialItems.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {socialItems.map(s => (
                  <a key={s.key} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label} className="mjs-fsocial" style={{
                    width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12.5, fontWeight: 800, color: '#cfc6b6', background: 'rgba(255,255,255,.07)',
                    border: '1px solid rgba(255,255,255,.12)', textDecoration: 'none',
                  }}>{s.glyph}</a>
                ))}
              </div>
            ) : null}
          </div>

          {/* ستون‌های لینک */}
          {columns.map((col, ci) => (
            <div key={ci}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c2b8a6', marginBottom: 16, letterSpacing: '.3px' }}>{col.title}</div>
              {col.links.map((l, i) => (
                <a key={i} href={l.href || '#'} className="mjs-flink" style={{ display: 'block', fontSize: 14, color: '#8a8073', marginBottom: 11, textDecoration: 'none' }}>{l.label}</a>
              ))}
            </div>
          ))}

          {/* تماس */}
          {hasContact ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c2b8a6', marginBottom: 16, letterSpacing: '.3px' }}>تماس</div>
              {/* فاز ۲۹۸ب — شمارهٔ فوتر دیگر خام نیست: پشتِ «نمایشِ شماره» (مثلِ کارتِ تیم/تماس)
                  تا هم در HTMLِ خام لو نرود و هم نمایشش در پنلِ سایت‌سازها گزارش شود. */}
              {phone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.07)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>☎</span>
                  <RevealPhone token={sealPhone(phone)} mask={phoneMask(phone)} primary={primary} slug={slug} />
                </div>
              ) : null}
              {email ? <ContactRow icon="✉" ltr>{email}</ContactRow> : null}
              {address ? <ContactRow icon="📍">{address}</ContactRow> : null}
            </div>
          ) : null}
        </div>

        {/* پوستهٔ نسلِ ۲ — نامِ برند به‌صورتِ واژهٔ غول‌پیکرِ توخالی (امضای سایت‌های مدرن) */}
        <div aria-hidden style={{ fontSize: 'clamp(54px,13vw,170px)', fontWeight: 900, lineHeight: .95, letterSpacing: '-4px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', margin: '12px 0 20px', color: 'transparent', WebkitTextStroke: `1px color-mix(in srgb, ${primary} 45%, transparent)`, backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${primary} 22%, transparent), transparent 85%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{brand}</div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.10)', paddingTop: 22, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: '#8a8070' }}>{copyright}</span>
        </div>
      </div>
    </footer>
  )
}

// ── Team / advisors block: کارتِ زیبای مشاورانِ عضوِ آژانس با تخصص و اطلاعاتِ مفید ──
// اعضا از رابطهٔ واقعیِ «مشاور↔آژانس» خوانده و کامل می‌شوند (team-members). مشاوری که
// در props.members انتخاب شده باشد نمایش داده می‌شود؛ اگر چیزی انتخاب نشده، همه.
// فاز ۲۹۷ض۲ — کارتِ مدرن‌ترِ مشاور: دایره حفظ شد (حلقهٔ درخشان + بَجِ نقش روی آواتار)،
// چیدمانِ تمیزتر، و «شماره» دیگر خام نیست — پشتِ «نمایشِ شماره» (RevealPhone) که هر نمایش
// در پنلِ سایت‌سازها گزارش می‌شود. slug برای همان گزارش لازم است.
export function TeamMemberCard({ m, primary, showSites, showPhone, slug }: { m: TeamMember; primary: string; showSites: boolean; showPhone: boolean; slug?: string }) {
  // فاز ۳۴۲ — کارتِ مشاورِ نسلِ ۲: به‌جای «نوارِ آبیِ تخت + دایره» (امضای قالب)، هالهٔ نرمِ رنگِ برند،
  // آواتار با حلقهٔ گرادیانی، مناطق زیرِ نام، و نوارِ آمارِ واقعی (آگهیِ فعال / سابقه) مثلِ کارتِ پروفایل.
  const initial = (m.name || '?').trim().charAt(0) || '?'
  const stats: { value: string; label: string }[] = []
  if (m.activeListings > 0) stats.push({ value: m.activeListings.toLocaleString('fa-IR'), label: 'آگهیِ فعال' })
  if (m.experience) stats.push({ value: m.experience, label: 'سابقه' })
  return (
    <div className="mjs-card mjs-team-card" style={{
      position: 'relative', isolation: 'isolate', overflow: 'hidden', background: 'var(--mjs-bg)', border: BORDER, borderRadius: 26,
      padding: '28px 22px 22px', boxShadow: CARD_SHADOW, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: '0 0 auto 0', height: 150, zIndex: -1, background: `radial-gradient(120% 100% at 50% -10%, color-mix(in srgb, ${primary} 22%, transparent), transparent 72%)` }} />
      <div aria-hidden style={{ position: 'absolute', inset: '0 0 auto 0', height: 150, zIndex: -1, opacity: .5, backgroundImage: `radial-gradient(color-mix(in srgb, ${primary} 30%, transparent) 1px, transparent 1.2px)`, backgroundSize: '14px 14px', WebkitMaskImage: 'linear-gradient(180deg,#000,transparent)', maskImage: 'linear-gradient(180deg,#000,transparent)' }} />
      {/* آواتار با حلقهٔ گرادیانی */}
      <div className="mjs-team-ava" style={{ padding: 3, borderRadius: '50%', background: `conic-gradient(from 200deg, ${primary}, color-mix(in srgb, ${primary} 25%, #fff), ${primary})`, boxShadow: `0 16px 34px -16px ${primary}` }}>
        {m.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photo} alt={m.name} loading="lazy" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', display: 'block', border: '3px solid var(--mjs-bg)' }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: btnBg(primary), color: '#fff', fontSize: 38, fontWeight: 900, border: '3px solid var(--mjs-bg)' }}>{initial}</div>
        )}
      </div>
      <div style={{ fontSize: 18.5, fontWeight: 900, color: INK, marginTop: 14, letterSpacing: '-.3px' }}>{m.name}</div>
      {m.title ? <div style={{ fontSize: 13, color: primary, fontWeight: 800, marginTop: 4 }}>{m.title}</div> : null}
      {m.areas ? <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {m.areas}</div> : null}
      {m.specialties.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {m.specialties.slice(0, 3).map((s, i) => (
            <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: primary, background: `${primary}12`, border: `1px solid ${primary}2e`, borderRadius: 999, padding: '3px 11px' }}>{s}</span>
          ))}
        </div>
      )}
      {stats.length > 0 && (
        <div style={{ width: '100%', marginTop: 18, display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))`, background: SURFACE, border: BORDER_SOFT, borderRadius: 16, overflow: 'hidden' }}>
          {stats.map((st, i) => (
            <div key={i} style={{ padding: '11px 8px', borderInlineStart: i > 0 ? BORDER_SOFT : 'none', minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: INK, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.value}</div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{st.label}</div>
            </div>
          ))}
        </div>
      )}
      {/* شماره: پشتِ «نمایشِ شماره» (گزارش‌پذیر)، نه خام */}
      {(showPhone && m.phone) || (showSites && m.slug) ? (
        <div style={{ marginTop: 'auto', paddingTop: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {showPhone && m.phone ? <RevealPhone token={sealPhone(m.phone)} mask={phoneMask(m.phone)} primary={primary} slug={slug} /> : null}
          {showSites && m.slug ? (
            <a href={`/${m.slug}`} target="_blank" rel="noreferrer" className="mjs-btn" style={{ display: 'block', width: '100%', fontSize: 13.5, fontWeight: 800, color: '#fff', background: btnBg(primary), borderRadius: 999, padding: '11px 8px', textDecoration: 'none', boxShadow: `0 12px 26px -12px ${primary}` }}>وب‌سایتِ من ↗</a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

async function TeamBlock({ block, primary, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const showSites = props.showSites !== 'no'
  const showPhone = props.showPhone !== 'no'
  const sel = Array.isArray(props.members) ? (props.members as string[]) : null
  let people = ownerPhone ? await getTeamMembers(ownerPhone) : []
  // آرایهٔ خالیِ ذخیره‌شده = «انتخابِ خاصی نشده»، نه «هیچ‌کس» (وگرنه تیم ناپدید می‌شد)
  if (sel && sel.length) people = people.filter(m => sel.includes(memberIdOf(m)))
  // پوستهٔ نسلِ ۲ — بخشِ خالی روی سایتِ منتشرشده رندر نمی‌شود (جعبهٔ «هنوز … نداریم» امضای قالبِ پیش‌ساخته بود).
  if (people.length === 0) return null
  return (
    <section id="team" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="تیمِ ما" center sub={props.subheading || undefined}>{props.heading || 'مشاوران ما'}</SectionHeading>
        {people.length === 0 ? (
          <div style={{ background: SURFACE, border: BORDER_DASHED, borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: MUTED, fontSize: 14.5 }}>هنوز مشاوری به این آژانس متصل نشده است.</div>
        ) : (
          // دسکتاپ: ستون‌های هم‌عرض و وسط‌چین (یک مشاور کلِ عرض را نمی‌گیرد)؛ موبایل: ردیفِ افقیِ لغزان (CSSِ mjs-team-row)
          <div className="mjs-team-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,280px))', justifyContent: 'center', gap: 22 }}>
            {people.map(m => <TeamMemberCard key={memberIdOf(m)} m={m} primary={primary} showSites={showSites} showPhone={showPhone} slug={slug} />)}
          </div>
        )}
      </div>
    </section>
  )
}

// Render one block. `ownerName` powers the real «آگهی‌های من» listings.
// ── کاتالوگِ محصولاتِ مصالح (واقعی، از پنلِ فروشندهٔ همین سایت) ──
async function CatalogBlock({ block, primary, ownerPhone, slug: siteSlug }: { block: SiteBlock; primary: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const data = ownerPhone ? await shopProductsOf(ownerPhone) : null
  const count = Math.max(3, Math.min(24, Number(props.count) || 12))
  const products = (data?.products || []).slice(0, count)
  // پوستهٔ نسلِ ۲ — بخشِ خالی روی سایتِ منتشرشده رندر نمی‌شود (جعبهٔ «هنوز … نداریم» امضای قالبِ پیش‌ساخته بود).
  if (products.length === 0) return null
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)
  return (
    <section id="catalog" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="فروشگاه" center>{props.heading || 'محصولات ما'}</SectionHeading>
        {products.length === 0 ? (
          <EmptyBlockNote text="به‌زودی محصولات و قیمت‌های ما اینجا نمایش داده می‌شود." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 18, marginTop: 24 }}>
            {products.map(pr => {
              const price = Math.round(pr.price * (1 - (pr.discountPct || 0) / 100))
              const img = pr.images?.[0]
              const href = siteSlug ? `/${siteSlug}/store` : (data?.slug ? `/store/${data.slug}` : undefined)
              const Card: any = href ? 'a' : 'div'
              return (
                <Card key={pr.id} {...(href ? { href } : {})} style={{ background: SURFACE, border: BORDER, borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', boxShadow: CARD_SHADOW }}>
                  <div style={{ height: 150, background: img ? `center/cover no-repeat url(${img})` : `linear-gradient(135deg,${primary}22,${primary}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{!img && '🧱'}</div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.6 }}>{pr.name}</div>
                    {pr.brand && <div style={{ fontSize: 11.5, color: MUTED }}>{pr.brand}</div>}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: primary }}>{money(price)}</span>
                      <span style={{ fontSize: 11, color: MUTED }}>تومان/{pr.unit}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ── نرخِ روزِ محصولاتِ فروشنده (جدولِ قیمت) ──
async function PriceListBlock({ block, primary, ownerPhone }: { block: SiteBlock; primary: string; ownerPhone?: string }) {
  const props = p(block)
  const data = ownerPhone ? await shopProductsOf(ownerPhone) : null
  const rows = (data?.products || []).slice(0, 40)
  const fa = (n: number) => n.toLocaleString('fa-IR')
  return (
    <section id="pricelist" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <SectionHeading primary={primary} eyebrow="نرخِ روز" center>{props.heading || 'نرخِ روزِ محصولات'}</SectionHeading>
        <div style={{ marginTop: 24, background: 'var(--mjs-bg)', borderRadius: 16, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 18px', background: `${primary}12`, fontSize: 13, fontWeight: 800, color: INK }}>
            <div>کالا</div><div>واحد</div><div style={{ textAlign: 'left' }}>قیمت (تومان)</div>
          </div>
          {rows.length === 0
            ? <div style={{ padding: '26px 18px', textAlign: 'center', color: MUTED, fontSize: 13.5, borderTop: BORDER_SOFT }}>هنوز قیمتی ثبت نشده — به‌زودی نرخِ روزِ محصولات اینجا قرار می‌گیرد.</div>
            : rows.map((pr, i) => {
              const price = Math.round(pr.price * (1 - (pr.discountPct || 0) / 100))
              return (
                <div key={pr.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 18px', borderTop: BORDER_SOFT, fontSize: 13.5, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: INK }}>{pr.name}{pr.brand && <span style={{ color: MUTED, fontWeight: 400 }}> · {pr.brand}</span>}</div>
                  <div style={{ color: MUTED }}>{pr.unit}</div>
                  <div style={{ textAlign: 'left', fontWeight: 800, color: primary }}>{fa(price)}</div>
                </div>
              )
            })}
        </div>
      </div>
    </section>
  )
}

// ── فاز ۲۹۷ق — نوارِ چسبانِ سکشن‌های صفحه (الگوی «پروژه‌ها | تخصص‌ها | بازخوردها») ──
// از خودِ بلوک‌های صفحه ساخته می‌شود؛ زیرِ هدرِ چسبان می‌چسبد و با انکرها نرم اسکرول می‌کند.
const SECTION_ANCHORS: Record<string, { id: string; label: string }> = {
  listings: { id: 'listings', label: 'آگهی‌ها' }, searchlist: { id: 'listings', label: 'آگهی‌ها' },
  services: { id: 'services', label: 'خدمات' }, gallery: { id: 'gallery', label: 'گالری' },
  about: { id: 'about', label: 'درباره' }, team: { id: 'team', label: 'تیمِ ما' },
  blog: { id: 'blog', label: 'وبلاگ' }, blogfull: { id: 'blog', label: 'وبلاگ' },
  catalog: { id: 'catalog', label: 'محصولات' }, pricelist: { id: 'pricelist', label: 'نرخِ روز' },
  testimonials: { id: 'reviews', label: 'نظرات' }, contact: { id: 'contact', label: 'تماس' },
}
// پوستهٔ نسلِ ۲ — نوارِ متحرکِ خدماتِ واقعیِ سایت زیرِ هیرو (الگوی سایت‌های مدرنِ Framer/Webflow).
// محتوا دوبار پشتِ هم تا حلقه بی‌درز باشد؛ جهتِ ltr فقط برای حرکت، متن‌ها همچنان فارسی.
function Marquee({ items, primary }: { items: string[]; primary: string }) {
  const row = (k: string) => (
    <div key={k} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden={k === 'b'}>
      {items.map((t, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(18px,3vw,34px)', paddingInline: 'clamp(9px,1.5vw,17px)', fontSize: 'clamp(17px,2.4vw,26px)', fontWeight: 900, letterSpacing: '-.4px', whiteSpace: 'nowrap', color: i % 2 ? 'transparent' : 'var(--mjs-heading)', WebkitTextStroke: i % 2 ? '1.2px color-mix(in srgb, var(--mjs-heading) 55%, transparent)' : undefined }}>
          {t}<span style={{ color: primary, fontSize: '0.7em', WebkitTextStroke: 0 }}>✦</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="mjs-marquee" style={{ direction: 'ltr', overflow: 'hidden', background: 'var(--mjs-bg)', borderBottom: '1px solid color-mix(in srgb, var(--mjs-text) 10%, transparent)', padding: 'clamp(16px,2.4vw,24px) 0', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <div className="mjs-marquee-track" style={{ display: 'flex', width: 'max-content', direction: 'rtl' }}>{row('a')}{row('b')}</div>
    </div>
  )
}

function SectionNav({ page, primary }: { page: SitePage; primary: string }) {
  const items: { id: string; label: string }[] = []
  for (const b of page.blocks) {
    const a = SECTION_ANCHORS[b.type]
    if (!a || items.some(i => i.id === a.id)) continue
    const h = String((b.props as any)?.heading || '').trim()
    items.push({ id: a.id, label: h && h.length <= 18 ? h : a.label })
  }
  if (items.length < 3) return null
  return (
    <nav className="mjs-subnav" style={{
      position: 'sticky', top: 64, zIndex: 40, direction: 'rtl',
      background: 'color-mix(in srgb, var(--mjs-bg) 97%, transparent)',
      borderBottom: '1px solid color-mix(in srgb, var(--mjs-text) 10%, transparent)',
      padding: '0 clamp(16px,4vw,24px)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 6, overflowX: 'auto', padding: '9px 0' }}>
        {items.map(it => (
          <a key={it.id} href={`#${it.id}`} className="mjs-subnav-link" style={{
            flex: '0 0 auto', fontSize: 13, fontWeight: 700, color: 'var(--mjs-text)', textDecoration: 'none',
            padding: '8px 15px', borderRadius: 999, whiteSpace: 'nowrap',
            border: '1px solid color-mix(in srgb, var(--mjs-text) 14%, transparent)',
          }}>{it.label}</a>
        ))}
      </div>
    </nav>
  )
}

function renderBlock(block: SiteBlock, primary: string, ownerName?: string, ownerPhone?: string, slug?: string, extras?: HeroExtras) {
  switch (block.type) {
    case 'catalog': return <CatalogBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} slug={slug} />
    case 'pricelist': return <PriceListBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} />
    case 'hero': return <HeroBlock key={block.id} block={block} primary={primary} extras={extras} />
    case 'search': return <SearchBlock key={block.id} block={block} primary={primary} />
    case 'listings': return <ListingsBlock key={block.id} block={block} primary={primary} ownerName={ownerName} ownerPhone={ownerPhone} slug={slug} />
    case 'searchlist': return <SearchListBlock key={block.id} block={block} primary={primary} ownerName={ownerName} ownerPhone={ownerPhone} slug={slug} />
    case 'blog': return <BlogBlock key={block.id} block={block} primary={primary} ownerName={ownerName} slug={slug} />
    case 'blogfull': return <BlogFullBlock key={block.id} block={block} primary={primary} ownerName={ownerName} slug={slug} />
    case 'services': return <ServicesBlock key={block.id} block={block} primary={primary} />
    case 'about': return <AboutBlock key={block.id} block={block} primary={primary} />
    case 'team': return <TeamBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} slug={slug} />
    case 'stats': return <StatsBlock key={block.id} block={block} primary={primary} />
    case 'gallery': return <GalleryBlock key={block.id} block={block} primary={primary} />
    case 'testimonials': return <TestimonialsBlock key={block.id} block={block} primary={primary} ownerPhone={ownerPhone} slug={slug} />
    case 'cta': return <CtaBlock key={block.id} block={block} primary={primary} />
    case 'contact': return <ContactBlock key={block.id} block={block} primary={primary} slug={slug} />
    case 'footer': return <FooterBlock key={block.id} block={block} primary={primary} ownerName={ownerName} slug={slug} />
    default:
      return (
        <section key={block.id} style={{ background: 'var(--mjs-bg)', padding: '32px 24px', direction: 'rtl' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: INK }}>{p(block).heading || block.type}</h2>
        </section>
      )
  }
}

// Top nav listing every page of the site, themed. Home → /{slug}, others → /{slug}/{pageSlug}.
// صفحاتی که باید در منو بیایند: خانه همیشه + هر صفحه‌ای که inMenu !== false
// نامِ برند = عنوانِ سایت پیش از «|» / «-» — ویرایشگر عنوانِ سئو («آژانس X | خرید و فروش ملک») را عنوانِ سایت
// ذخیره می‌کند و منو کلِ آن را نشان می‌داد (دم‌درازِ سئویی در لوگو = حسِ قالبِ آماده).
function brandOf(site: Site): string {
  const t = String(site.title || '').split(/\s[|｜–—-]\s/)[0].trim()
  return t || site.title
}

function menuPages(site: Site): { slug: string; label: string; home: boolean }[] {
  return site.pages
    .map((pg, i) => ({ slug: pg.slug, label: pg.menuLabel || pg.title, home: i === 0, inMenu: i === 0 || pg.inMenu !== false }))
    .filter(p => p.inMenu)
    .map(({ slug, label, home }) => ({ slug, label, home }))
}

// رپرِ نازکِ سازگار: ناوبری به مؤلفهٔ کلاینتِ NavBar واگذار می‌شود (همبرگرِ موبایل).
function SiteNav({ site, primary, currentSlug }: { site: Site; primary: string; currentSlug: string }) {
  return <NavBar brand={brandOf(site)} items={menuPages(site)} currentSlug={currentSlug} siteSlug={site.slug} primary={primary} />
}

// Shared full-site shell: nav + the given page's blocks. Used by both the home
// route and the [page] sub-route so there's a single source of truth.
// پوستهٔ سایت‌ساز (تم + ناوبری + فوتر) که «هر محتوایی» را داخلِ خودش می‌گیرد.
// صفحه‌های جزئیاتِ آگهی/محصول/مقاله از همین استفاده می‌کنند تا داخلِ همان سایت + قالب بمانند.
// فاز ۲۹۷ط — منوی ثابتِ پایینِ موبایل («باید منو زیر داشته باشه، منو موبایلی»): مثلِ اپ،
// خانه + ۴ صفحهٔ اولِ منو همیشه دمِ دستِ انگشت. چون در «پوسته» است، روی همهٔ سایت‌ها
// (خودکار و دست‌ساز) بدونِ بازسازی زنده می‌شود. آیکنِ هر صفحه از اسلاگش.
const BOTTOM_ICONS: Record<string, string> = {
  home: '⌂', listings: '⌕', opportunities: '⌕', projects: '▦', portfolio: '▦', products: '▤',
  prices: '▤', services: '◈', about: '¶', blog: '✎', contact: '✉', team: '☺', reviews: '❝',
}
function BottomNav({ site, currentSlug, primary }: { site: Site; currentSlug: string; primary: string }) {
  const items = menuPages(site).slice(0, 5)
  if (items.length < 2) return null
  return (
    <nav className="mjs-bottom-bar" style={{
      position: 'fixed', bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 60, direction: 'rtl',
      display: 'none', background: 'color-mix(in srgb, var(--mjs-bg) 98%, transparent)',
      borderTop: '1px solid color-mix(in srgb, var(--mjs-text) 14%, transparent)',
      paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -6px 24px -18px rgba(20,16,10,.8)',
    }}>
      {items.map(it => {
        const active = it.home ? !currentSlug || currentSlug === 'home' : it.slug === currentSlug
        return (
          <a key={it.slug} href={it.home ? `/${encodeURIComponent(site.slug)}` : `/${encodeURIComponent(site.slug)}/${it.slug}`} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '8px 2px 7px', textDecoration: 'none', minWidth: 0,
            color: active ? primary : 'var(--mjs-text)', fontWeight: active ? 800 : 600,
          }}>
            <span aria-hidden style={{ fontSize: 19, lineHeight: 1, opacity: active ? 1 : .75 }}>{BOTTOM_ICONS[it.slug] || '•'}</span>
            <span style={{ fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

export function SiteChrome({ site, currentSlug, children, appendFooter, bottomNav = true }: { site: Site; currentSlug?: string; children: React.ReactNode; appendFooter?: boolean; bottomNav?: boolean }) {
  const t = site.theme
  const primary = t?.primary || '#c9a84c'
  const secondary = t?.secondary || '#1a1510'
  const bg = t?.bg || '#ffffff'
  const surface = t?.surface || '#fbfaf8'
  const text = t?.text || '#4a4338'
  const heading = t?.heading || '#15110b'
  const fontFamily = (t?.font ? `'${t.font}', ` : '') + 'Vazirmatn, Tahoma, sans-serif'
  const cssVars = {
    '--mjs-primary': primary, '--mjs-secondary': secondary, '--mjs-bg': bg,
    '--mjs-surface': surface, '--mjs-text': text, '--mjs-heading': heading, '--mjs-muted': text,
  } as React.CSSProperties
  // برای صفحه‌های جزئیات، فوترِ صفحهٔ خانه را هم ته صفحه بیاور تا حسِ «داخلِ سایت» کامل شود.
  const home = site.pages.find(p => p.slug === 'home') || site.pages[0]
  const footerBlocks = appendFooter ? (home?.blocks || []).filter(b => b.type === 'footer') : []
  return (
    <main className="mjs-site-main" style={{ minHeight: '100vh', background: 'var(--mjs-bg)', color: 'var(--mjs-text)', fontFamily, ...cssVars }}>
      <style>{`
        /* ناوبریِ موبایلِ ملک‌جت روی سایتِ منتشرشده دیده نشود — هر سایت منوی خودش را دارد. */
        .mj-bottom-nav{display:none !important}
        /* دستیارِ ✦ِ خودِ ملک‌جت روی سایتِ شخصیِ کاربر جایی ندارد (شلوغی + حسِ «سایتِ قالبی») */
        .mj-ai-btn{display:none !important}
        .mjs-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-btn{transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease}
        .mjs-btn:hover{transform:translateY(-2px);opacity:.94}
        .mjs-flink{transition:color .18s ease, padding .18s ease}
        .mjs-flink:hover{color:${primary};padding-right:5px}
        .mjs-fsocial{transition:transform .18s ease, background .18s ease, color .18s ease, border-color .18s ease}
        .mjs-fsocial:hover{transform:translateY(-2px);background:${primary};color:#fff;border-color:${primary}}
        .mjs-gallery-img{transition:transform .35s ease}
        .mjs-gallery-img:hover{transform:scale(1.03)}
        .mjs-card:hover .mjs-gallery-img,.mjsl-card:hover .mjs-gallery-img,.mjs-slide-card:hover .mjs-gallery-img{transform:scale(1.07)}
        .mjs-nav-items{scrollbar-width:none}
        .mjs-nav-items::-webkit-scrollbar{display:none}
        /* فاز ۲۹۷ق — اسکرولِ نرمِ انکرها + جا برای هدر و نوارِ سکشنِ چسبان */
        html{scroll-behavior:smooth}
        section[id]{scroll-margin-top:122px}
        .mjs-subnav>div{scrollbar-width:none}
        .mjs-subnav>div::-webkit-scrollbar{display:none}
        .mjs-subnav-link{transition:background .18s ease, color .18s ease, border-color .18s ease}
        .mjs-subnav-link:hover{background:${primary}1a;color:${primary};border-color:${primary}55}
        @media(max-width:680px){.mjs-contact-grid{grid-template-columns:1fr !important}}
        /* ═══ پوستهٔ نسلِ ۲ — حرکت و جزئیات (همهٔ سایت‌ها، بدونِ بازسازی) ═══
           ظاهرشدنِ بخش‌ها دیگر با animation-timeline نیست (سافاریِ آیفون نداشت ← سایتِ بی‌حرکت)؛
           SiteMotion با IntersectionObserver کلاسِ mjs-in می‌دهد. پنهان‌بودنِ پیش از ورود فقط زیرِ
           html.mjs-js است ← بدونِ JS (خزنده/سئو) محتوا کامل دیده می‌شود. ورود با animation و
           fill=backwards تا transformِ هاورِ کارت‌ها بعدِ ورود آزاد بماند. */
        @keyframes mjsUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes mjsRise{from{opacity:0;transform:translate3d(0,38px,0) scale(.975)}to{opacity:1;transform:none}}
        @keyframes mjsMask{from{opacity:0;clip-path:inset(0 0 100% 0);transform:translateY(.45em)}to{opacity:1;clip-path:inset(-25% -5% -25% -5%);transform:none}}
        @keyframes mjsWord{from{opacity:0;transform:translateY(.7em) rotate(2deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
        @keyframes mjsGlowFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-16px,0) scale(1.04)}}
        @keyframes mjsAurora1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(12%,8%) scale(1.15)}66%{transform:translate(-6%,14%) scale(.92)}}
        @keyframes mjsAurora2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-14%,-10%) scale(1.2)}}
        @keyframes mjsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes mjsMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes mjsCue{0%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(12px);opacity:0}}
        @keyframes mjsSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
        .mjs-glow-border::before{content:'';position:absolute;left:50%;top:50%;width:max(1100px,140%);aspect-ratio:1;transform:translate(-50%,-50%);background:conic-gradient(transparent 0deg,${primary} 70deg,#fff 110deg,transparent 170deg,transparent 360deg);pointer-events:none;z-index:0}
        .mjs-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:300;transform:scaleX(0);transform-origin:100% 50%;background:linear-gradient(270deg,${primary},color-mix(in srgb,${primary} 40%,#fff));pointer-events:none}
        @media (prefers-reduced-motion: no-preference){
          html.mjs-js [data-r]:not(.mjs-in){opacity:0}
          html.mjs-js [data-r].mjs-in{animation:mjsRise .95s cubic-bezier(.16,1,.3,1) var(--d,0s) backwards}
          html.mjs-js [data-r="mask"].mjs-in{animation-name:mjsMask;animation-duration:1.05s}
          .mjs-w{display:inline-block;animation:mjsWord .9s cubic-bezier(.16,1,.3,1) calc(var(--i) * 75ms + .12s) backwards}
          .mjs-hero-badge{animation:mjsUp .55s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-sub{animation:mjsUp .8s .45s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-ctas{animation:mjsUp .8s .6s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-trust{animation:mjsUp .8s .75s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-visual{animation:mjsRise 1.2s .3s cubic-bezier(.16,1,.3,1) both}
          .mjs-hero-glow{animation:mjsGlowFloat 11s ease-in-out infinite}
          .mjs-aurora>i:nth-child(1){animation:mjsAurora1 18s ease-in-out infinite}
          .mjs-aurora>i:nth-child(2){animation:mjsAurora2 22s ease-in-out infinite}
          .mjs-aurora>i:nth-child(3){animation:mjsAurora1 26s ease-in-out infinite reverse}
          .mjs-float{animation:mjsFloat 6s ease-in-out infinite}
          .mjs-float-2{animation:mjsFloat 7.5s 1.2s ease-in-out infinite}
          .mjs-marquee-track{animation:mjsMarquee 38s linear infinite}
          .mjs-cue i{animation:mjsCue 1.8s ease-in-out infinite}
          .mjs-glow-border::before{animation:mjsSpin 7s linear infinite;will-change:transform}
          @media(max-width:719px){.mjs-glow-border::before{animation:none;will-change:auto}}
        }
        .mjs-marquee:hover .mjs-marquee-track{animation-play-state:paused}
        /* فاز ۳۴۱ — انیمیشنِ بی‌پایانِ بیرونِ دید متوقف (SiteMotion → data-off) */
        [data-off],[data-off] *,[data-off]::before{animation-play-state:paused !important}
        /* فاز ۳۴۲ — دو بخشِ پیاپیِ هم‌رنگ: پدینگِ پایینِ اولی + بالای دومی ≈ ۱۸۰px فضای خالی (حسِ «بلوک‌های
           جدا»). بخشِ دوم پدینگِ بالایش را کم می‌کند تا صفحه یک روایتِ پیوسته باشد. */
        main>section[style*="background:var(--mjs-bg)"]+section[style*="background:var(--mjs-bg)"],
        main>section[style*="background:var(--mjs-surface)"]+section[style*="background:var(--mjs-surface)"]{padding-top:clamp(8px,2vw,20px) !important}
        /* فاز ۳۴۲ — کارتِ مشاور: بلند شدن + چرخشِ آرامِ حلقهٔ آواتار با هاور */
        .mjs-team-card{transition:transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease}
        .mjs-team-card:hover{transform:translateY(-6px);box-shadow:0 26px 60px -30px rgba(20,16,10,.6)}
        .mjs-team-ava{transition:transform .6s cubic-bezier(.16,1,.3,1)}
        .mjs-team-card:hover .mjs-team-ava{transform:scale(1.04) rotate(-4deg)}
        @media(max-width:719px){
          /* موبایل: تیم به‌جای کارت‌های تمام‌صفحهٔ روی‌هم، ردیفِ لغزانِ افقی با «لبهٔ کارتِ بعدی» (مثلِ اپ) */
          .mjs-team-row{display:flex !important;overflow-x:auto;scroll-snap-type:x mandatory;gap:14px !important;margin-inline:calc(-1 * clamp(20px,5vw,24px));padding:4px clamp(20px,5vw,24px) 14px;scrollbar-width:none}
          .mjs-team-row::-webkit-scrollbar{display:none}
          .mjs-team-row>*{flex:0 0 78%;scroll-snap-align:center}
          .mjs-team-row>*:only-child{flex-basis:100%}
          /* نوارِ بخش‌ها روی موبایل چسبان نیست (نوارِ پایین و هدر کافی‌اند؛ ۶۰px از صفحه را نمی‌خورد) */
          .mjs-subnav{position:relative !important;top:auto !important}
        }
        .mjs-aurora>i{will-change:transform}
        /* هدرِ «اسکرول‌شده» روی موبایل سایه/جابه‌جاییِ ارتفاع نگیرد (reflowِ هر بار) */
        @media(max-width:719px){main.mjs-scrolled .mjs-nav>div:first-child{min-height:64px !important}}
        /* خطِ زیرِ تیترِ بخش‌ها با ورود «کشیده» می‌شود */
        .mjs-h-line{transform-origin:100% 50%;transition:transform 1.1s .25s cubic-bezier(.16,1,.3,1)}
        html.mjs-js [data-r="mask"]:not(.mjs-in)+.mjs-h-line{transform:scaleX(0)}
        /* نورِ دنبال‌کنندهٔ نشانگر روی کارت‌ها + لبهٔ درخشان */
        @media (hover:hover){
          .mjs-card,.mjs-slide-card,.mjsl-card{position:relative}
          .mjs-card::after,.mjs-slide-card::after,.mjsl-card::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .35s ease;background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,${primary} 16%,transparent),transparent 62%);z-index:1}
          .mjs-card:hover::after,.mjs-slide-card:hover::after,.mjsl-card:hover::after{opacity:1}
          .mjs-card:hover,.mjs-slide-card:hover{box-shadow:0 28px 60px -28px rgba(20,16,10,.6),0 0 0 1px color-mix(in srgb,${primary} 35%,transparent) !important}
        }
        /* دکمه‌ها: برقِ عبوری روی هاور */
        .mjs-btn{position:relative;overflow:hidden;isolation:isolate}
        .mjs-btn::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.38) 50%,transparent 70%);transform:translateX(120%);transition:transform .8s cubic-bezier(.16,1,.3,1)}
        .mjs-btn:hover::after{transform:translateX(-120%)}
        /* هدر: با اسکرول فشرده‌تر و سایه‌دار (فاز ۳۴۱: بی‌بلور ← تقریباً مات، تا متنِ زیرش از پشتش دیده نشود) */
        .mjs-nav{transition:background .3s ease, box-shadow .3s ease}
        .mjs-nav>div:first-child{transition:min-height .3s ease}
        main.mjs-scrolled .mjs-nav{background:color-mix(in srgb,var(--mjs-bg) 95%,transparent) !important;box-shadow:0 14px 40px -28px rgba(20,16,10,.8) !important}
        /* فقط ردیفِ اصلیِ هدر؛ قبلاً پنلِ بستهٔ منوی موبایل (mjs-nav-panel) هم ۵۸px می‌گرفت → نوارِ سفیدِ خالی زیرِ هدر */
        main.mjs-scrolled .mjs-nav>div:first-child{min-height:58px !important}
        .mjs-stat-num{background:linear-gradient(135deg,#fff,color-mix(in srgb,${primary} 55%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent}
        .mjs-grad-word{background:linear-gradient(100deg,color-mix(in srgb,${primary} 55%,#fff),${primary} 60%,color-mix(in srgb,${primary} 70%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent}
        @media(max-width:899px){.mjs-hero-grid{grid-template-columns:1fr !important}.mjs-hero-visual{max-width:440px;margin-inline:auto;width:100%}}
        /* فاز ۳۴۲ — موبایل: پرترهٔ ۴:۵ به عرضِ کامل یک صفحهٔ کامل را می‌گرفت؛ جمع‌وجور و کمی خوابیده‌تر */
        @media(max-width:719px){.mjs-hero-portrait{max-width:min(70vw,270px) !important}.mjs-hero-portrait img{aspect-ratio:1 / 1 !important}}
        @media(max-width:640px){#hero{min-height:auto !important;padding-top:64px !important;padding-bottom:72px !important}.mjs-hero-card{display:none !important}.mjs-hero-visual.mjs-hero-portrait{max-width:300px}.mjs-cue{display:none !important}}
        /* فاز ۲۹۷ط — منوی پایینِ موبایل فقط زیرِ ۷۲۰px دیده می‌شود؛ جا برای آن ته صفحه باز می‌شود */
        @media(max-width:719px){
          .mjs-bottom-bar{display:flex !important}
          main.mjs-site-main{padding-bottom:62px}
        }
        @media(max-width:680px){
          .mjs-grid-3,.mjs-grid-4{grid-template-columns:1fr !important}
          .mjs-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;row-gap:22px !important}
          .mjs-stat{border-inline-start:none !important}
          .mjs-search-row{flex-direction:column !important}
          .mjs-contact-fields{grid-template-columns:1fr !important}
          .mjs-about{flex-direction:column !important}
          .mjs-footer-grid{grid-template-columns:1fr !important}
        }
      `}</style>
      <div className="mjs-progress" aria-hidden />
      <SiteMotion />
      <NavBar brand={brandOf(site)} items={menuPages(site)} currentSlug={currentSlug || ''} siteSlug={site.slug} primary={primary} />
      {children}
      {footerBlocks.map(block => renderBlock(block, primary, site.ownerName, site.owner, site.slug))}
      {bottomNav ? <BottomNav site={site} currentSlug={currentSlug || ''} primary={primary} /> : null}
    </main>
  )
}

export async function SiteShell({ site, page, preview = false }: { site: Site; page: SitePage; preview?: boolean }) {
  const primary = site.theme?.primary || '#c9a84c'

  // فاز ۲۹۷ق — دادهٔ پروفایلیِ هیرو: همه واقعی. خطای هرکدام نباید صفحه را بیندازد،
  // ولی باید در لاگ دیده شود (قانون شمارهٔ یک).
  let views = 0
  try { views = (await getSiteStats(site.slug))?.totalV || 0 }
  catch (e: any) { console.error(`[site:${site.slug}] خواندنِ آمارِ بازدید شکست خورد: ${e?.message || e}`) }
  let reviewsCount = 0, reviewsAvg = 0
  try {
    const rvs = site.owner ? listReviews(site.owner) : []
    reviewsCount = rvs.length
    if (reviewsCount) reviewsAvg = rvs.reduce((a, r) => a + (Number(r.rating) || 5), 0) / reviewsCount
  } catch (e: any) { console.error(`[site:${site.slug}] خواندنِ نظرات شکست خورد: ${e?.message || e}`) }

  const home = site.pages.find(pg => pg.slug === 'home') || site.pages[0]
  const aboutImgOf = (pg?: SitePage) => {
    for (const b of pg?.blocks || []) if (b.type === 'about') { const im = String((b.props as any)?.image || '').trim(); if (im) return im }
    return ''
  }
  // پرترهٔ هیرو: عکسِ بلوکِ «درباره» از صفحهٔ فعلی، خانه، یا هر صفحهٔ دیگرِ سایت (معمولاً صفحهٔ «درباره ما»).
  const avatar = aboutImgOf(page) || aboutImgOf(home) || site.pages.map(aboutImgOf).find(Boolean) || ''
  // فاز ۲۹۷ق۳ — عکس‌های واقعیِ خودِ سایت برای هیروی سینمایی: گالری + کارت‌های پروژه (services با image).
  const heroImages: string[] = []
  const seenImg = new Set<string>()
  for (const pg of [page, home]) {
    for (const b of pg?.blocks || []) {
      const bp = (b.props || {}) as Record<string, any>
      if (b.type === 'gallery') for (const im of (Array.isArray(bp.images) ? bp.images : [])) {
        const s = String(im || '').trim(); if (s && !seenImg.has(s)) { seenImg.add(s); heroImages.push(s) }
      }
      if (b.type === 'services') for (const it of (Array.isArray(bp.items) ? bp.items : [])) {
        const s = String(it?.image || '').trim(); if (s && !seenImg.has(s)) { seenImg.add(s); heroImages.push(s) }
      }
    }
    if (heroImages.length >= 5) break
  }
  // پوستهٔ نسلِ ۲ — عنوانِ خدماتِ واقعیِ خودِ سایت: کارتِ پروفایلِ هیرو + نوارِ متحرکِ زیرِ هیرو.
  const highlights: string[] = []
  for (const pg of [page, home]) for (const b of pg?.blocks || []) {
    if (b.type !== 'services') continue
    for (const it of (Array.isArray((b.props as any)?.items) ? (b.props as any).items : [])) {
      const t = String(it?.title || '').trim(); if (t && !highlights.includes(t)) highlights.push(t)
    }
  }
  const contactHref = page.blocks.some(b => b.type === 'contact')
    ? '#contact'
    : site.pages.some(pg => pg.slug === 'contact') ? `/${encodeURIComponent(site.slug)}/contact` : ''
  const memberYear = site.createdAt ? new Date(site.createdAt).toLocaleDateString('fa-IR', { year: 'numeric' }) : ''
  // فاز ۳۴۲ — آمارِ واقعیِ هیرو: آگهی‌های فعالِ مالک (+ آگهیِ مشاورانِ تیم وقتی سایت بلوکِ تیم دارد) و تعدادِ تیم.
  let listingsCount = 0, teamCount = 0
  if (page.slug === 'home' || page === home) {
    try { listingsCount = (await ownerListings(site.ownerName, site.owner, 100000)).length }
    catch (e: any) { console.error(`[site:${site.slug}] شمارشِ آگهی‌ها شکست خورد: ${e?.message || e}`) }
    if (site.owner && site.pages.some(pg => pg.blocks.some(b => b.type === 'team'))) {
      try {
        const team = await getTeamMembers(site.owner)
        teamCount = team.length
        listingsCount += team.reduce((a, m) => a + (m.activeListings || 0), 0)
      } catch (e: any) { console.error(`[site:${site.slug}] خواندنِ تیم شکست خورد: ${e?.message || e}`) }
    }
  }
  const extras: HeroExtras = {
    avatar, views, reviewsCount, reviewsAvg, memberYear, contactHref, listingsCount, teamCount,
    showStats: page.slug === 'home' || page === home,
    heroImages: heroImages.slice(0, 5),
    brand: site.ownerName || brandOf(site),
    highlights,
    ...(page !== home && page.slug !== 'home' ? { inner: { homeHref: `/${encodeURIComponent(site.slug)}`, title: (page as any).menuLabel || page.title, isContact: page.slug === 'contact' } } : {}),
  }

  const heroIdx = page.blocks.findIndex(b => b.type === 'hero')
  return (
    <SiteChrome site={site} currentSlug={page.slug}>
      {/* فاز ۲۹۶ب — آمارِ بازدیدِ سایتِ اختصاصی (پنلِ «سایت‌سازها»ی ادمین) */}
      {/* پیش‌نمایشِ ویرایشگر آمارِ بازدید را بالا نمی‌برد */}
      {preview ? null : <Beacon slug={site.slug} />}
      {page.blocks.map((block, i) => (
        <Fragment key={block.id}>
          {renderBlock(block, primary, site.ownerName, site.owner, site.slug, extras)}
          {i === heroIdx && !extras.inner && highlights.length >= 3 ? <Marquee items={highlights} primary={primary} /> : null}
          {i === heroIdx ? <SectionNav page={page} primary={primary} /> : null}
        </Fragment>
      ))}
    </SiteChrome>
  )
}

export default async function PublishedSitePage(
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: slug } = await params
  const site: Site | null = await getSite(slug)
  if (!site) notFound()

  const home = getSitePage(site, 'home')
  // فاز ۲۹۶ (سئو): دادهٔ ساخت‌یافتهٔ کسب‌وکار — نام/آدرسِ صفحه برای جست‌وجوی نامِ شخص.
  const ld296: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'RealEstateAgent',
    name: site.ownerName || site.title,
    url: `https://melkjet.com/${encodeURIComponent(site.slug)}`,
    description: site.seo?.description || undefined,
  }
  Object.keys(ld296).forEach(k => ld296[k] === undefined && delete ld296[k])
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld296) }} />
      <SiteShell site={site} page={home} />
    </>
  )
}
