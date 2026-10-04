import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, getSitePage, type Site, type SitePage, type SiteBlock } from '@/app/lib/sites-store'
import { listItems, listArticles, type Item } from '@/app/lib/scraper-store'
import { getTeamMembers, type TeamMember } from '@/app/lib/team-members'
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
import Beacon from './Beacon'
import { Fragment } from 'react'
import { getSiteStats } from '@/app/lib/site-stats-store'

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
const SECTION_PAD = 'clamp(56px,8vw,96px) clamp(20px,5vw,24px)'
// فاز ۲۹۷ق۲ — حاشیه‌های «تم‌آگاه»: بژِ هاردکد (#efe9df و خانواده) روی پالت‌های تیره
// می‌جنگید و کل سیستم را آماتور نشان می‌داد. همه از رنگِ متنِ تم مشتق می‌شوند.
const BORDER = '1px solid color-mix(in srgb, var(--mjs-text) 13%, transparent)'
const BORDER_SOFT = '1px solid color-mix(in srgb, var(--mjs-text) 8%, transparent)'
const BORDER_DASHED = '1px dashed color-mix(in srgb, var(--mjs-text) 24%, transparent)'
const INPUT_BORDER = '1px solid color-mix(in srgb, var(--mjs-text) 20%, transparent)'
// دکمهٔ مدرن: گرادیانِ تم + درخششِ رنگی به‌جای رنگِ تختِ تنها.
const btnBg = (primary: string) => `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 72%, var(--mjs-secondary)))`

// Bold section heading with a short primary accent underline.
function SectionHeading({ children, primary, center, light, sub }: {
  children: React.ReactNode; primary: string; center?: boolean; light?: boolean; sub?: string
}) {
  return (
    <div style={{ marginBottom: 'clamp(28px,4vw,44px)', textAlign: center ? 'center' : 'right' }}>
      <h2 style={{
        fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 900, letterSpacing: '-0.6px',
        color: light ? '#fff' : INK, margin: 0, lineHeight: 1.25,
      }}>{children}</h2>
      <div style={{
        height: 4, width: 68, borderRadius: 999,
        background: `linear-gradient(90deg, ${primary}, color-mix(in srgb, ${primary} 25%, transparent))`,
        boxShadow: `0 2px 14px -2px ${primary}99`,
        margin: center ? '14px auto 0' : '14px 0 0',
      }} />
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
  contactHref?: string
  showStats: boolean
  // فاز ۲۹۷ق۳ — عکس‌های واقعیِ خودِ سایت (گالری/کارت‌های پروژه): هیروی بی‌عکس به‌جای
  // گرادیانِ خالی، اسلایدشوی سینماییِ همین عکس‌ها می‌شود (الگوی قالب‌های Shopify).
  heroImages?: string[]
}

function HeroBlock({ block, primary, extras }: { block: SiteBlock; primary: string; extras?: HeroExtras }) {
  const props = p(block)
  const align = props.align === 'right' ? 'right' : 'center'
  const textColor = props.textColor || '#fff'
  const overlay: 'dark' | 'light' | 'none' =
    props.overlay === 'light' ? 'light' : props.overlay === 'none' ? 'none' : 'dark'
  const tall = props.height === 'tall'

  // منبعِ تصاویرِ اسلایدشو (اگر ≥۲ باشد یک لایهٔ پس‌زمینهٔ کلاینت با محو-تدریجی رندر می‌شود).
  const ownImages: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  // پس‌زمینهٔ ثابت: image → props.bg → گرادیانِ تم.
  const image: string = typeof props.image === 'string' ? props.image.trim() : ''
  // فاز ۲۹۷ق۳ — هیروی بی‌عکسِ سایتِ عکس‌دار: اسلایدشو از عکس‌های واقعیِ خودش.
  const autoImages = (!image && ownImages.length < 2 && (extras?.heroImages?.length || 0) >= 2)
    ? extras!.heroImages! : null
  const images = ownImages.length >= 2 ? ownImages : (autoImages || ownImages)
  const useSlider = images.length >= 2
  const baseBg = image
    ? `url(${image})`
    : (props.bg || 'linear-gradient(135deg, var(--mjs-primary), var(--mjs-secondary) 70%)')

  // گرادیانِ روکش برای خوانایی، بسته به overlay.
  const overlayGrad =
    overlay === 'dark'
      ? 'linear-gradient(180deg, rgba(12,9,6,.38), rgba(12,9,6,.70))'
      : overlay === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.55))'
        : ''

  // وقتی اسلایدر فعال است، روکش داخلِ HeroSlider اعمال می‌شود؛ پس‌زمینهٔ section خنثی می‌ماند.
  const sectionBg = useSlider
    ? 'var(--mjs-secondary)'
    : (overlayGrad ? `${overlayGrad}, ${baseBg}` : baseBg)

  const minHeight = tall ? 'clamp(440px,80vh,720px)' : undefined
  const padY = tall ? 'clamp(96px,16vw,160px)' : 'clamp(72px,13vw,140px)'

  return (
    <section id="hero" style={{
      position: 'relative', background: sectionBg, backgroundSize: 'cover', backgroundPosition: 'center',
      padding: `${padY} clamp(20px,5vw,24px)`, direction: 'rtl', overflow: 'hidden',
      minHeight, display: 'flex', alignItems: 'center',
    }}>
      {useSlider ? <HeroSlider images={images} overlay={overlay} interval={5000} /> : null}
      {/* فاز ۲۹۷ق — عمقِ بصری: دو هالهٔ نرمِ رنگِ تم با شناوریِ آرام، بدونِ مزاحمت برای خوانایی */}
      <div aria-hidden className="mjs-hero-glow" style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(420px 320px at 12% 18%, ${primary}30, transparent 70%), radial-gradient(520px 380px at 88% 86%, ${primary}22, transparent 70%)`,
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1000, margin: '0 auto', width: '100%', textAlign: align as any,
        display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start',
      }}>
        {/* فاز ۲۹۷ق — ردیفِ پروفایلی: آواتارِ واقعی (از بلوکِ درباره) کنارِ نام — حسِ صفحهٔ شخصیِ معتبر */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'clamp(18px,3.5vw,32px)', flexWrap: 'wrap',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          flexDirection: align === 'center' ? 'column' : 'row',
          width: '100%',
        }}>
          {extras?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={extras.avatar} alt="" style={{
              width: 'clamp(92px,13vw,128px)', height: 'clamp(92px,13vw,128px)', borderRadius: 26,
              objectFit: 'cover', flexShrink: 0,
              border: '3px solid rgba(255,255,255,.85)', boxShadow: '0 18px 44px -16px rgba(0,0,0,.55)',
            }} />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', minWidth: 0 }}>
            {/* فاز ۲۹۶و/۲۹۷و — نشانِ هیرو: ترتیبِ eyebrow → badge → متنِ قدیمی. رشتهٔ خالی = حذف.
                فاز ۲۹۷ق — + نشانِ «تاییدشده در ملک‌جت» (واقعی: این سایت از ملک‌جت منتشر شده). */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', marginBottom: 20 }}>
              {(() => {
                const badge297 = props.eyebrow !== undefined ? String(props.eyebrow).trim()
                  : props.badge !== undefined ? String(props.badge).trim() : 'املاک و مستغلات'
                return badge297 ? (
                  <span className="mjs-hero-badge" style={{
                    display: 'inline-block', fontSize: 13, fontWeight: 700, color: textColor,
                    background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)',
                    padding: '7px 16px', borderRadius: 999, backdropFilter: 'blur(4px)',
                  }}>{badge297}</span>
                ) : null
              })()}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800,
                color: '#aef0c3', background: 'rgba(37,170,92,.22)', border: '1px solid rgba(110,224,152,.38)',
                padding: '7px 14px', borderRadius: 999, backdropFilter: 'blur(4px)',
              }}>✓ تاییدشده در ملک‌جت</span>
            </div>
            <h1 className="mjs-hero-h1" style={{
              fontSize: 'clamp(32px,6vw,60px)', fontWeight: 900, color: textColor,
              margin: 0, marginBottom: 18, letterSpacing: '-1px', lineHeight: 1.15, maxWidth: 900,
            }}>{props.heading}</h1>
            {props.subheading ? (
              <p style={{
                fontSize: 'clamp(15px,2vw,19px)', color: textColor, opacity: .82,
                margin: 0, marginBottom: 30, maxWidth: 620, lineHeight: 1.9,
              }}>{props.subheading}</p>
            ) : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
              {props.buttonText ? (
                <a href={props.buttonLink || '#'} className="mjs-btn" style={{
                  display: 'inline-block', padding: '15px 38px', background: btnBg(primary), borderRadius: 999,
                  fontSize: 16, fontWeight: 800, color: '#fff', textDecoration: 'none',
                  boxShadow: `0 16px 40px -14px ${primary}`,
                }}>{props.buttonText}</a>
              ) : null}
              {/* دکمهٔ دومِ «تماس» فقط وقتی CTAی اصلی خودش به تماس نمی‌رود */}
              {extras?.contactHref && extras.contactHref !== (props.buttonLink || '') ? (
                <a href={extras.contactHref} className="mjs-btn" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 30px',
                  background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.32)',
                  borderRadius: 999, fontSize: 15.5, fontWeight: 800, color: textColor,
                  textDecoration: 'none', backdropFilter: 'blur(4px)',
                }}>☎ تماس</a>
              ) : null}
            </div>
          </div>
        </div>

        {/* فاز ۲۹۷ق — کارتِ اعتمادِ شناور (الگوی پلتفرم‌های تخصصی): فقط اعدادِ واقعی.
            بازدیدِ کل از آمارِ خودِ سایت، میانگینِ نظراتِ تاییدشده، سالِ عضویت. فقط صفحهٔ خانه. */}
        {extras?.showStats ? (() => {
          const fa = (n: number) => n.toLocaleString('fa-IR')
          const cells: { icon: string; value: string; label: string }[] = []
          if (extras.views > 0) cells.push({ icon: '👁', value: fa(extras.views), label: 'بازدیدِ صفحه' })
          if (extras.reviewsCount > 0) cells.push({ icon: '★', value: (Math.round(extras.reviewsAvg * 10) / 10).toLocaleString('fa-IR'), label: `${fa(extras.reviewsCount)} نظرِ مشتری` })
          if (extras.memberYear) cells.push({ icon: '✓', value: extras.memberYear, label: 'عضوِ ملک‌جت' })
          if (cells.length === 0) return null
          return (
            <div className="mjs-hero-trust" style={{
              display: 'flex', marginTop: 'clamp(30px,5vw,44px)', width: '100%', maxWidth: 580,
              alignSelf: align === 'center' ? 'center' : 'flex-start',
              background: 'rgba(10,8,5,.38)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,.16)', borderRadius: 20, padding: '18px 8px',
              boxShadow: '0 24px 60px -30px rgba(0,0,0,.7)',
            }}>
              {cells.map((c, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '2px 8px',
                  borderInlineStart: i > 0 ? '1px solid rgba(255,255,255,.12)' : 'none', minWidth: 0,
                }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, color: primary, background: `${primary}2b`, border: `1px solid ${primary}55`,
                  }}>{c.icon}</span>
                  <span style={{ fontSize: 'clamp(19px,2.6vw,24px)', fontWeight: 900, color: '#fff', letterSpacing: '-.5px', lineHeight: 1 }}>{c.value}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.68)', whiteSpace: 'nowrap' }}>{c.label}</span>
                </div>
              ))}
            </div>
          )
        })() : null}
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
  return (
    <section id="listings" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
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
  return (
    <section id="blog" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
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
        <SectionHeading primary={primary}>{heading}</SectionHeading>
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
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        {items.length === 0 ? (
          <div style={{ background: SURFACE, border: BORDER_DASHED, borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: MUTED, fontSize: 14.5 }}>
            هنوز آگهی منتشرشده‌ای برای نمایش وجود ندارد.
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
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
        {items.length > 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 24 }}>
            {items.length.toLocaleString('fa-IR')} مورد · {perSlide.toLocaleString('fa-IR')} در هر نما
          </div>
        )}
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
          <SectionHeading primary={primary}>{props.heading}</SectionHeading>
          <p style={{ fontSize: 'clamp(15px,1.7vw,16.5px)', lineHeight: 2.1, color: 'var(--mjs-text)', margin: 0 }}>{props.text}</p>
        </div>
        {props.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.image} alt="" style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, objectFit: 'cover', borderRadius: 22, boxShadow: CARD_SHADOW }} />
        ) : (
          <div style={{ flex: '1 1 340px', width: '100%', maxWidth: 440, height: 320, background: 'linear-gradient(135deg,var(--mjs-primary),var(--mjs-secondary))', borderRadius: 22, boxShadow: CARD_SHADOW }} />
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
  return (
    <section style={{ background: `linear-gradient(135deg, ${primary}12, ${primary}05)`, padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,24px)', direction: 'rtl' }}>
      <div className="mjs-grid-4" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 18 }}>
        {items.map((s, i) => {
          const label = String(s?.label || '')
          return (
            <div key={i} className="mjs-card" style={{
              background: 'var(--mjs-bg)', border: BORDER, borderRadius: 20,
              padding: '26px 18px', textAlign: 'center', boxShadow: CARD_SHADOW,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 50, height: 50, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 23, background: `${primary}16`, border: `1px solid ${primary}30`,
              }}>{statIcon(label)}</span>
              <div style={{ fontSize: 'clamp(30px,4.2vw,40px)', fontWeight: 900, color: primary, letterSpacing: '-1px', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 14, color: MUTED, fontWeight: 700 }}>{label}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function GalleryBlock({ block, primary }: { block: SiteBlock; primary: string }) {
  const props = p(block)
  const imgs: string[] = Array.isArray(props.images) ? props.images.filter(Boolean) : []
  const total = Math.max(1, Math.min(48, Number(props.total) || 9))
  const perSlide = Math.max(1, Math.min(6, Number(props.perSlide) || 3))
  return (
    <section id="gallery" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <GallerySlider images={imgs.slice(0, total)} perSlide={perSlide} primary={primary} placeholders={total} />
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

  return (
    <section id="reviews" style={{ background: SURFACE, padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading}</SectionHeading>
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
      <div style={{
        position: 'relative', maxWidth: 820, margin: '0 auto',
        background: 'rgba(12,9,6,.30)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,.16)', borderRadius: 30,
        padding: 'clamp(36px,6vw,60px) clamp(22px,5vw,48px)',
        boxShadow: '0 34px 90px -40px rgba(0,0,0,.75)',
      }}>
        <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.8px', lineHeight: 1.25 }}>{props.heading}</h2>
        {props.subheading ? <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(255,255,255,0.78)', margin: '0 0 34px', lineHeight: 1.9 }}>{props.subheading}</p> : null}
        {props.buttonText ? <a href={props.buttonLink || '#'} className="mjs-btn" style={{ display: 'inline-block', padding: '15px 42px', background: '#fff', borderRadius: 999, fontSize: 16, fontWeight: 800, color: '#15110b', textDecoration: 'none', boxShadow: '0 18px 44px -16px rgba(0,0,0,.65)' }}>{props.buttonText}</a> : null}
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
        <SectionHeading primary={primary}>{props.heading}</SectionHeading>
        <div className="mjs-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 22, alignItems: 'start' }}>
          {/* کارتِ راه‌های ارتباطی */}
          <div className="mjs-card" style={{ background: SURFACE, border: BORDER, borderRadius: 22, padding: 'clamp(22px,3.5vw,30px)', boxShadow: CARD_SHADOW }}>
            <div style={{ fontSize: 16.5, fontWeight: 900, color: INK, marginBottom: 20 }}>ارتباط با ما</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {phone ? <Row icon="☎" label="شمارهٔ تماس"><RevealPhone phone={phone} primary={primary} slug={slug} /></Row> : null}
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

function FooterBlock({ block, primary, ownerName }: { block: SiteBlock; primary: string; ownerName?: string }) {
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
        <div className="mjs-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(auto-fit,minmax(160px,1fr))', gap: 'clamp(28px,5vw,44px)', marginBottom: 38, alignItems: 'start' }}>
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
              {phone ? <ContactRow icon="☎" ltr>{phone}</ContactRow> : null}
              {email ? <ContactRow icon="✉" ltr>{email}</ContactRow> : null}
              {address ? <ContactRow icon="📍">{address}</ContactRow> : null}
            </div>
          ) : null}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.10)', paddingTop: 22, textAlign: 'center' }}>
          <span style={{ fontSize: 12.5, color: '#7a7062' }}>{copyright}</span>
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
  const info: { icon: string; label: string; value: string }[] = []
  if (m.areas) info.push({ icon: '📍', label: 'مناطقِ کاری', value: m.areas })
  if (m.experience) info.push({ icon: '⏳', label: 'سابقه', value: m.experience })
  if (m.activeListings > 0) info.push({ icon: '🏠', label: 'آگهیِ فعال', value: `${m.activeListings.toLocaleString('fa-IR')} مورد` })
  const initial = (m.name || '?').trim().charAt(0) || '?'
  return (
    <div className="mjs-card" style={{ background: 'var(--mjs-bg)', border: BORDER, borderRadius: 24, overflow: 'hidden', boxShadow: CARD_SHADOW, textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
      {/* سرستونِ گرادیانیِ بلندتر + هالهٔ نرم */}
      <div style={{ position: 'relative', height: 92, background: `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, var(--mjs-secondary)))`, overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(260px 120px at 80% 0%, rgba(255,255,255,.22), transparent 70%)' }} />
      </div>
      <div style={{ padding: '0 20px 22px', marginTop: -56, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        {/* دایرهٔ آواتار با حلقهٔ درخشان (حفظ شد) */}
        <div style={{ position: 'relative' }}>
          {m.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.photo} alt={m.name} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '4px solid var(--mjs-bg)', boxShadow: `0 0 0 3px ${primary}, 0 10px 24px -8px rgba(0,0,0,.45)` }} />
          ) : (
            <div style={{ width: 100, height: 100, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${primary}2e, ${primary}14)`, color: primary, fontSize: 40, fontWeight: 900, border: '4px solid var(--mjs-bg)', boxShadow: `0 0 0 3px ${primary}, 0 10px 24px -10px ${primary}` }}>{initial}</div>
          )}
        </div>
        <div style={{ fontSize: 18.5, fontWeight: 900, color: INK, marginTop: 13 }}>{m.name}</div>
        {m.title ? <div style={{ fontSize: 13, color: primary, fontWeight: 700, marginTop: 4 }}>{m.title}</div> : null}
        {/* چیپ‌های تخصص */}
        {m.specialties.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
            {m.specialties.slice(0, 3).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: primary, background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 999, padding: '3px 11px' }}>{s}</span>
            ))}
          </div>
        )}
        {/* اطلاعاتِ مفید (بدونِ شماره — شماره پشتِ دکمه می‌رود) */}
        {info.length > 0 && (
          <div style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'right' }}>
            {info.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, background: SURFACE, border: BORDER_SOFT, borderRadius: 11, padding: '8px 11px' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: `${primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{r.icon}</span>
                <span style={{ fontSize: 11.5, color: MUTED, flexShrink: 0 }}>{r.label}:</span>
                <span style={{ fontSize: 12.5, color: INK, fontWeight: 700, marginInlineStart: 'auto', direction: 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {/* شماره: پشتِ «نمایشِ شماره» (گزارش‌پذیر)، نه خام */}
        {showPhone && m.phone ? (
          <div style={{ width: '100%', marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <RevealPhone phone={m.phone} primary={primary} slug={slug} />
          </div>
        ) : null}
        {/* دکمه‌ها */}
        {showSites && m.slug ? (
          <div style={{ marginTop: 'auto', paddingTop: 16, width: '100%' }}>
            <a href={`/${m.slug}`} target="_blank" rel="noreferrer" className="mjs-btn" style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#fff', background: btnBg(primary), borderRadius: 999, padding: '11px 8px', textDecoration: 'none', boxShadow: `0 12px 26px -12px ${primary}` }}>وب‌سایتِ من ↗</a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

async function TeamBlock({ block, primary, ownerPhone, slug }: { block: SiteBlock; primary: string; ownerPhone?: string; slug?: string }) {
  const props = p(block)
  const showSites = props.showSites !== 'no'
  const showPhone = props.showPhone !== 'no'
  const sel = Array.isArray(props.members) ? (props.members as string[]) : null
  let people = ownerPhone ? await getTeamMembers(ownerPhone) : []
  if (sel) people = people.filter(m => sel.includes(m.phone))
  return (
    <section id="team" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center sub={props.subheading || undefined}>{props.heading || 'مشاوران ما'}</SectionHeading>
        {people.length === 0 ? (
          <div style={{ background: SURFACE, border: BORDER_DASHED, borderRadius: 18, padding: '52px 24px', textAlign: 'center', color: MUTED, fontSize: 14.5 }}>هنوز مشاوری به این آژانس متصل نشده است.</div>
        ) : (
          <div className="mjs-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {people.map(m => <TeamMemberCard key={m.phone} m={m} primary={primary} showSites={showSites} showPhone={showPhone} slug={slug} />)}
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
  const fa = (n: number) => n.toLocaleString('fa-IR')
  const money = (t: number) => t >= 1e9 ? `${fa(Math.round(t / 1e8) / 10)} میلیارد` : t >= 1e6 ? `${fa(Math.round(t / 1e5) / 10)} میلیون` : fa(t)
  return (
    <section id="catalog" style={{ background: 'var(--mjs-bg)', padding: SECTION_PAD, direction: 'rtl' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <SectionHeading primary={primary} center>{props.heading || 'محصولات ما'}</SectionHeading>
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
        <SectionHeading primary={primary} center>{props.heading || 'نرخِ روزِ محصولات'}</SectionHeading>
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
      background: 'color-mix(in srgb, var(--mjs-bg) 90%, transparent)', backdropFilter: 'blur(10px)',
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
    case 'footer': return <FooterBlock key={block.id} block={block} primary={primary} ownerName={ownerName} />
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
function menuPages(site: Site): { slug: string; label: string; home: boolean }[] {
  return site.pages
    .map((pg, i) => ({ slug: pg.slug, label: pg.menuLabel || pg.title, home: i === 0, inMenu: i === 0 || pg.inMenu !== false }))
    .filter(p => p.inMenu)
    .map(({ slug, label, home }) => ({ slug, label, home }))
}

// رپرِ نازکِ سازگار: ناوبری به مؤلفهٔ کلاینتِ NavBar واگذار می‌شود (همبرگرِ موبایل).
function SiteNav({ site, primary, currentSlug }: { site: Site; primary: string; currentSlug: string }) {
  return <NavBar brand={site.title} items={menuPages(site)} currentSlug={currentSlug} siteSlug={site.slug} primary={primary} />
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
      display: 'none', background: 'color-mix(in srgb, var(--mjs-bg) 94%, transparent)', backdropFilter: 'blur(12px)',
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
        .mjs-card{transition:transform .22s ease, box-shadow .22s ease}
        .mjs-card:hover{transform:translateY(-5px);box-shadow:0 22px 50px -24px rgba(20,16,10,.55),0 6px 16px -8px rgba(20,16,10,.18)}
        .mjs-btn{transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease}
        .mjs-btn:hover{transform:translateY(-2px);opacity:.94}
        .mjs-navlink{transition:background .18s ease, color .18s ease}
        .mjs-navlink:hover{background:${primary}1f;color:${primary}}
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
        /* فاز ۲۹۷ق۲ — حرکت و عمق (مثلِ سایت‌های مدرن): ورودِ نرمِ هیرو، شناوریِ هاله‌ها،
           و ظاهرشدنِ سکشن‌ها هنگامِ اسکرول (فقط مرورگرهای پشتیبان؛ بقیه ثابتِ سالم). */
        @keyframes mjsUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes mjsGlowFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-16px,0) scale(1.04)}}
        @media (prefers-reduced-motion: no-preference){
          .mjs-hero-badge{animation:mjsUp .55s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-h1{animation:mjsUp .7s .06s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-trust{animation:mjsUp .8s .16s cubic-bezier(.2,.7,.2,1) both}
          .mjs-hero-glow{animation:mjsGlowFloat 11s ease-in-out infinite}
          @supports (animation-timeline: view()){
            main.mjs-site-main>section:not(:first-of-type){
              animation:mjsUp .8s cubic-bezier(.2,.7,.2,1) both;
              animation-timeline:view();animation-range:entry 0% entry 32%;
            }
          }
        }
        /* فاز ۲۹۷ط — منوی پایینِ موبایل فقط زیرِ ۷۲۰px دیده می‌شود؛ جا برای آن ته صفحه باز می‌شود */
        @media(max-width:719px){
          .mjs-bottom-bar{display:flex !important}
          main.mjs-site-main{padding-bottom:62px}
        }
        @media(max-width:680px){
          .mjs-grid-3,.mjs-grid-4{grid-template-columns:1fr !important}
          .mjs-search-row{flex-direction:column !important}
          .mjs-contact-fields{grid-template-columns:1fr !important}
          .mjs-about{flex-direction:column !important}
          .mjs-footer-grid{grid-template-columns:1fr !important}
        }
      `}</style>
      <NavBar brand={site.title} items={menuPages(site)} currentSlug={currentSlug || ''} siteSlug={site.slug} primary={primary} />
      {children}
      {footerBlocks.map(block => renderBlock(block, primary, site.ownerName, site.owner, site.slug))}
      {bottomNav ? <BottomNav site={site} currentSlug={currentSlug || ''} primary={primary} /> : null}
    </main>
  )
}

export async function SiteShell({ site, page }: { site: Site; page: SitePage }) {
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
  const avatar = aboutImgOf(page) || aboutImgOf(home)
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
  const contactHref = page.blocks.some(b => b.type === 'contact')
    ? '#contact'
    : site.pages.some(pg => pg.slug === 'contact') ? `/${encodeURIComponent(site.slug)}/contact` : ''
  const memberYear = site.createdAt ? new Date(site.createdAt).toLocaleDateString('fa-IR', { year: 'numeric' }) : ''
  const extras: HeroExtras = {
    avatar, views, reviewsCount, reviewsAvg, memberYear, contactHref,
    showStats: page.slug === 'home' || page === home,
    heroImages: heroImages.slice(0, 5),
  }

  const heroIdx = page.blocks.findIndex(b => b.type === 'hero')
  return (
    <SiteChrome site={site} currentSlug={page.slug}>
      {/* فاز ۲۹۶ب — آمارِ بازدیدِ سایتِ اختصاصی (پنلِ «سایت‌سازها»ی ادمین) */}
      <Beacon slug={site.slug} />
      {page.blocks.map((block, i) => (
        <Fragment key={block.id}>
          {renderBlock(block, primary, site.ownerName, site.owner, site.slug, extras)}
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
