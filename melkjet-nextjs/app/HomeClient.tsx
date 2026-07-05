// صفحهٔ اصلی حالا یک server component است: کلِ صفحه روی سرور رندر می‌شود (بدونِ hydration)
// و فقط جزیره‌های تعاملی (جستجو، آکاردئونِ FAQ، دکمهٔ لایک، بنر، دستیارِ AI) در مرورگر
// اجرا می‌شوند → main-thread و JavaScriptِ کلاینت به‌شدت کمتر.
import Link from 'next/link'
import Nav from './components/Nav'
import Footer from './components/Footer'
import PropertyCard from './components/PropertyCard'
import PromoBadge from './components/PromoBadge'
import PromoSpotlight from './components/PromoSpotlight'
import HeroSearch from './components/home/HeroSearch'
import FaqAccordion from './components/home/FaqAccordion'
import HomeBanner from './components/home/HomeBanner'
import HomeAssistant from './components/home/HomeAssistant'
import { gradientFor, initialsFor, type ContentItem } from './lib/content-display'
import { listingHref } from './lib/listing-url'
import type { HomeData } from './lib/home-data'

const featured = [
  { id: '1', title: 'آپارتمان لوکس نوساز', location: 'سعادت‌آباد، تهران', price: '۱۷٫۸ میلیارد', size: '۱۴۰', beds: '۳', year: '۱۴۰۲', tag: 'ویژه', score: 96, img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { id: '2', title: 'پنت‌هاوس دوبلکس با ویو', location: 'زعفرانیه، تهران', price: '۸۵ میلیارد', size: '۲۶۰', beds: '۴', year: '۱۴۰۳', tag: 'لوکس', score: 94, img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
  { id: '3', title: 'آپارتمان دنج و آفتاب‌گیر', location: 'ونک، تهران', price: '۹٫۲ میلیارد', size: '۹۵', beds: '۲', year: '۱۳۹۸', tag: 'فرصت', score: 88, img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { id: '4', title: 'ویلا باغ با استخر', location: 'لواسان', price: '۱۲۰ میلیارد', size: '۴۲۰', beds: '۵', year: '۱۴۰۱', tag: 'لوکس', score: 92, img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
  { id: '5', title: 'آپارتمان روشن خوش‌نقشه', location: 'جردن، تهران', price: '۱۴٫۵ میلیارد', size: '۱۱۰', beds: '۲', year: '۱۴۰۰', tag: 'ویژه', score: 91, img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
  { id: '6', title: 'دفتر کار اداری مدرن', location: 'میرداماد، تهران', price: '۶٫۸ میلیارد', size: '۸۰', beds: '—', year: '۱۳۹۹', tag: 'اداری', score: 84, img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
]
const stats = [
  { n: '۲۴۰٬۰۰۰+', l: 'فایل فعال' }, { n: '۱۸٬۵۰۰', l: 'مشاور تأییدشده' },
  { n: '۴۲', l: 'شهر تحت پوشش' }, { n: '۹۸٪', l: 'دقت تحلیل قیمت' }
]
const hoods = [
  { n: 'سعادت‌آباد', p: '۱۲۷ م', g: '+۸٪', img: 'linear-gradient(135deg,#3a3530,#23201c)' },
  { n: 'زعفرانیه', p: '۳۲۷ م', g: '+۵٪', img: 'linear-gradient(135deg,#33303a,#201d26)' },
  { n: 'ونک', p: '۹۷ م', g: '+۱۱٪', img: 'linear-gradient(135deg,#2c343a,#1c2126)' },
  { n: 'جردن', p: '۱۳۲ م', g: '+۶٪', img: 'linear-gradient(135deg,#34323c,#221f29)' },
  { n: 'لواسان', p: '۲۸۶ م', g: '+۹٪', img: 'linear-gradient(135deg,#2f3a34,#1d231f)' },
  { n: 'میرداماد', p: '۱۰۵ م', g: '+۴٪', img: 'linear-gradient(135deg,#3a3630,#241f1a)' },
]
const modules = [
  { ic: '◈', t: 'تحلیل ارزش واقعی', d: 'برآورد قیمت منصفانه بر اساس موقعیت، متراژ و داده‌های تاریخی، همراه با Confidence Score.', cta: 'محاسبه ارزش ملک' },
  { ic: '◰', t: 'نقشه حرارتی بازار', d: 'میانگین قیمت، رشد، تقاضا و فرصت سرمایه‌گذاری هر محله را روی نقشه ببین.', cta: 'مشاهده نقشه' },
  { ic: '◴', t: 'پیش‌بینی آینده بازار', d: 'روند رشد، احتمال کاهش و میزان ریسک هر منطقه را پیش از تصمیم بدان.', cta: 'پیش‌بینی منطقه' }
]
const advisors = [
  { n: 'سارا محمدی', r: 'مشاور لوکس · زعفرانیه', deals: '۱۲۴', rate: '۴٫۹', img: 'linear-gradient(135deg,#caa86a,#8a6f3e)' },
  { n: 'امیر رضایی', r: 'سرمایه‌گذاری · ونک', deals: '۲۰۳', rate: '۴٫۸', img: 'linear-gradient(135deg,#7a8fae,#465a78)' },
  { n: 'نگار کریمی', r: 'مسکونی · سعادت‌آباد', deals: '۹۷', rate: '۵٫۰', img: 'linear-gradient(135deg,#b07a8a,#6e4754)' },
  { n: 'کاوه اسدی', r: 'تجاری و اداری · میرداماد', deals: '۱۵۶', rate: '۴٫۷', img: 'linear-gradient(135deg,#7aa88f,#476e58)' }
]
const invest = [
  { id: '7', title: 'پیش‌فروش برج آرین', location: 'سعادت‌آباد', roi: '۳۸٪', risk: 'کم', riskColor: '#5fd98a', price: 'از ۱۴ م.د', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
  { id: '8', title: 'مجتمع تجاری ونک‌پارک', location: 'ونک', roi: '۲۹٪', risk: 'متوسط', riskColor: '#e7a14a', price: 'از ۳۴ م.د', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
  { id: '9', title: 'ویلاهای باغ لواسان', location: 'لواسان', roi: '۴۲٪', risk: 'متوسط', riskColor: '#e7a14a', price: 'از ۱۲۰ م.د', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
]
const faqs = [
  { q: 'جستجوی هوشمند ملک‌جت چطور کار می‌کند؟', a: 'کافی‌ست نیازت را به زبان طبیعی بنویسی؛ هوش مصنوعی منظور تو را تحلیل می‌کند، در صورت نیاز سؤال تکمیلی می‌پرسد و بهترین فایل‌ها را همراه با دلیل انتخاب نمایش می‌دهد.' },
  { q: 'تحلیل قیمت ملک‌جت چقدر دقیق است؟', a: 'موتور قیمت‌گذاری ما با اتکا به داده‌های تاریخی، املاک مشابه و روند بازار، ارزش منصفانه را با Confidence Score برآورد می‌کند تا بدانی یک ملک گران است یا ارزان.' },
  { q: 'آیا ثبت آگهی و استفاده رایگان است؟', a: 'پلن رایگان برای جستجو، ذخیره و دریافت پیشنهادهای هوشمند در دسترس است. مشاوران و آژانس‌ها می‌توانند با پلن‌های حرفه‌ای به CRM، اتوماسیون و ابزارهای بازاریابی دسترسی پیدا کنند.' },
  { q: 'دستیار هوشمند چه کارهایی انجام می‌دهد؟', a: 'دستیار همیشگی ملک‌جت در خرید، فروش، اجاره، تحلیل قیمت، مذاکره و راهنمایی حقوقی کنار توست و ۲۴ ساعته پاسخ‌گوست.' }
]
const examples = ['آپارتمان نوساز در زعفرانیه با ویو', 'خانه زیر ۱۰ میلیارد برای سرمایه‌گذاری', 'اجاره ۲ خوابه نزدیک مترو ونک', 'ویلا در شمال با باغ']
const materials = [
  { l: 'آهن و میلگرد', ic: '▭', bg: 'rgba(122,143,174,0.15)', color: '#7a8fae' },
  { l: 'سیمان و گچ', ic: '◳', bg: 'rgba(201,168,76,0.15)', color: 'var(--gold)' },
  { l: 'کاشی و سرامیک', ic: '▦', bg: 'rgba(176,122,138,0.15)', color: '#b07a8a' },
  { l: 'کابینت و دکور', ic: '◫', bg: 'rgba(122,168,143,0.15)', color: '#7aa88f' },
  { l: 'شیرآلات', ic: '◌', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
  { l: 'سرمایش و گرمایش', ic: '❄', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
]

const faToEnDigits = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
function sizeFromItem(it: ContentItem): string {
  const fromMeta = faToEnDigits(it.meta?.['متراژ'] || '').match(/(\d+)/)
  if (fromMeta) return fromMeta[1]
  const m = faToEnDigits(it.title).match(/(\d+)\s*متر/)
  return m ? m[1] : '—'
}
function bedsFromItem(it: ContentItem): string {
  const fromMeta = faToEnDigits(it.meta?.['اتاق خواب'] || '').match(/(\d+)/)
  if (fromMeta) return fromMeta[1]
  const m = faToEnDigits(`${it.title} ${it.excerpt || ''}`).match(/(\d+)\s*(?:خواب|خوابه)/)
  return m ? m[1] : '—'
}

const RISK_LEVELS = [
  { risk: 'کم', riskColor: '#5fd98a' },
  { risk: 'متوسط', riskColor: '#e7a14a' },
  { risk: 'بالا', riskColor: '#e7674a' },
]

export default function HomeClient({ initial }: { initial: HomeData }) {
  // دادهٔ اولیه از سرور می‌آید (SSR با محتوا).
  const { listings, advisorItems, promoFeatured, promoInvest, promoAdvisors, promoTrending, spotlight, sysStats } = initial

  // Prepend promoted items to a listing array, dedup by id.
  const withPromoted = (promo: ContentItem[], normal: ContentItem[]): ContentItem[] => {
    const seen = new Set<string>()
    return [...promo, ...normal].filter((it) => {
      if (seen.has(it.id)) return false
      seen.add(it.id)
      return true
    })
  }

  // Promoted items lead the featured/invest sections (dedup by id).
  const featuredSource = withPromoted(promoFeatured, listings)
  const investSource = withPromoted(promoInvest, listings)
  const advisorSource = withPromoted(promoAdvisors, advisorItems)
  const promotedIds = new Set(promoFeatured.map((p) => p.id))
  const promotedInvestIds = new Set(promoInvest.map((p) => p.id))
  const promotedAdvisorIds = new Set(promoAdvisors.map((p) => p.id))

  // Map real listings into featured cards; fall back to static mockup if empty.
  const featuredCards = featuredSource.length
    ? featuredSource.map((it, i) => ({
        id: it.id,
        title: it.title,
        location: it.location || 'نامشخص',
        price: it.price || '—',
        size: sizeFromItem(it),
        beds: bedsFromItem(it),
        year: undefined as string | undefined,
        tag: promotedIds.has(it.id) ? 'ویژه' : ((it.tags && it.tags[0]) || it.category || 'ویژه'),
        promoKind: promotedIds.has(it.id) ? (it.promoKind || 'ویژه') : undefined,
        score: 80 + (i % 19),
        img: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.id),
      }))
    : []   // بدونِ دادهٔ واقعی، دادهٔ فیک نشان نده (بخش پنهان می‌شود)

  // آگهی‌های ترند/داغ — فقط اگر پروموتِ فعالِ ترند وجود داشته باشد نمایش داده می‌شود.
  const trendingCards = (promoTrending || []).map((it, i) => ({
    id: it.id, title: it.title, location: it.location || 'نامشخص', price: it.price || '—',
    size: sizeFromItem(it), beds: bedsFromItem(it), year: undefined as string | undefined,
    tag: 'ترند', promoKind: it.promoKind || 'ترند', score: 80 + (i % 19),
    img: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.id),
  }))

  // Reuse listings as investment offers; fall back to static mockup if empty.
  const investCards = investSource.length
    ? investSource.slice(0, 3).map((it, i) => {
        const r = RISK_LEVELS[i % RISK_LEVELS.length]
        return {
          id: it.id,
          title: it.title,
          location: it.location || 'نامشخص',
          roi: `${28 + (i * 7) % 20}٪`,
          risk: r.risk,
          riskColor: r.riskColor,
          price: it.price ? `از ${it.price}` : '—',
          img: it.image ? `center/cover no-repeat url(${it.image})` : gradientFor(it.id),
          promoted: promotedInvestIds.has(it.id),
          promoKind: it.promoKind || 'ویژه',
        }
      })
    : []

  // Map real directory entries into advisor cards; fall back to static mockup if empty.
  const advisorCards = advisorSource.length
    ? advisorSource.map((it) => ({
        n: it.title,
        r: [it.category, it.location].filter(Boolean).join(' · ') || 'متخصص',
        deals: '—',
        rate: it.rating || '—',
        img: gradientFor(it.title, 'avatar'),
        initials: initialsFor(it.title),
        promoted: promotedAdvisorIds.has(it.id),
        promoKind: it.promoKind || 'ویژه',
      }))
    : []   // بدونِ متخصصِ واقعی، «مشاوران برتر»ِ فیک نشان نده

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      <main>
      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(52px,7vw,104px) 24px clamp(44px,5vw,80px)' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(900px 460px at 78% -8%,var(--goldDim),transparent 60%)' }}></div>
        <div className="mjh-orb" style={{ position: 'absolute', top: '-12%', insetInlineEnd: '-8%', width: 'clamp(300px,38vw,560px)', height: 'clamp(300px,38vw,560px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,.28), transparent 68%)', filter: 'blur(24px)', pointerEvents: 'none', animation: 'mjfloat 9s ease-in-out infinite' }}></div>
        <div className="mjh-orb" style={{ position: 'absolute', bottom: '-18%', insetInlineStart: '-10%', width: 'clamp(280px,34vw,520px)', height: 'clamp(280px,34vw,520px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(122,143,174,.22), transparent 68%)', filter: 'blur(28px)', pointerEvents: 'none', animation: 'mjfloat 11s ease-in-out infinite reverse' }}></div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px)', backgroundSize: '54px 54px', opacity: 0.35, maskImage: 'radial-gradient(60% 55% at 50% 30%, #000, transparent 80%)', WebkitMaskImage: 'radial-gradient(60% 55% at 50% 30%, #000, transparent 80%)' }}></div>
        <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, border: '1px solid var(--gold)', background: 'var(--goldDim)', fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 0 4px var(--goldDim)', animation: 'glow 2s infinite', display: 'inline-block' }}></span>
            سیستمِ جامعِ املاک، ساختمان و مصالح
          </div>
          <h1 style={{ marginTop: 22, fontSize: 'clamp(34px,6vw,64px)', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
            خانه‌ی بعدی‌ات،<br />
            <span style={{ background: 'linear-gradient(120deg,var(--gold2),var(--gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>هوشمندانه</span> انتخاب می‌شود
          </h1>
          <p style={{ margin: '20px auto 0', maxWidth: 620, fontSize: 'clamp(15px,2vw,18.5px)', lineHeight: 1.85, color: 'var(--muted)' }}>
            به زبان خودت بگو چه می‌خواهی. ملک‌جت بازار را تحلیل می‌کند، دلیل هر پیشنهاد را توضیح می‌دهد و کنارت می‌ماند تا بهترین تصمیم را بگیری.
          </p>

          <HeroSearch examples={examples} />

          {/* دسترسیِ سریع به همهٔ اکوسیستم‌ها */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 26 }}>
            {[
              { l: 'خرید و اجارهٔ ملک', h: '/search', ic: '🏠' },
              { l: 'بازارِ مصالح', h: '/materials-market', ic: '🧱' },
              { l: 'نرخِ روزِ مصالح', h: '/materials-prices', ic: '📊' },
              { l: 'متخصصان', h: '/directory', ic: '👷' },
              { l: 'سازندگان', h: '/builders', ic: '🏗️' },
              { l: 'دستیارِ AI', h: '/plan-ai', ic: '🤖' },
            ].map(p => (
              <Link key={p.l} href={p.h} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <span>{p.ic}</span>{p.l}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* همهٔ خدمات — ویترینِ جامعِ سیستم */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(40px,5vw,64px) 24px 0' }}>
        <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 34px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>◆ یک پلتفرم، همهٔ نیازها</div>
          <h2 style={{ fontSize: 'clamp(24px,3.6vw,36px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>سیستمِ جامعِ املاک و ساختمان</h2>
          <p style={{ fontSize: 'clamp(14px,1.8vw,16px)', color: 'var(--muted)', marginTop: 12, lineHeight: 1.9 }}>از خرید و فروشِ ملک تا بازارِ مصالح، متخصصان، هوشِ مصنوعی و ابزارهای کاملِ کسب‌وکار — همه در ملک‌جت.</p>
        </div>
        <div className="mjh-serv" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
          {[
            { ic: '🏠', t: 'خرید، فروش و اجارهٔ ملک', d: 'جستجوی هوشمند با هزاران فایلِ فعال، تحلیلِ قیمت و مقایسه.', href: '/search', c: '#7a8fae' },
            { ic: '👷', t: 'متخصصان و مشاوران', d: 'دایرکتوریِ مشاور، آژانس، سازنده و مشاورِ حقوقیِ تأییدشده.', href: '/directory', c: '#caa86a' },
            { ic: '🏗️', t: 'بانکِ سازندگان', d: 'دیتابیسِ سازندگان و پروژه‌ها با اطلاعاتِ تماسِ مستقیم.', href: '/builders', c: '#b07a8a' },
            { ic: '🧱', t: 'بازارِ مصالح', d: 'کاتالوگِ کاملِ مصالح با قیمتِ مرجع، جستجو و مقایسهٔ فروشندگان.', href: '/materials-market', c: '#e7a14a' },
            { ic: '🏪', t: 'فروشگاه‌های مصالح', d: 'دایرکتوریِ تأمین‌کنندگان با ویترینِ اختصاصی و استعلامِ مستقیم.', href: '/stores', c: '#5fd98a' },
            { ic: '📊', t: 'نرخِ روزِ مصالح', d: 'قیمتِ روزِ آهن، سیمان و مصالح با نمودارِ روندِ تاریخی.', href: '/materials-prices', c: '#4ec4e8' },
            { ic: '🤖', t: 'دستیارِ هوشِ مصنوعی', d: 'مشاورِ ۲۴ساعته برای خرید، قیمت‌گذاری، مذاکره و راهنماییِ حقوقی.', href: '/plan-ai', c: '#a77fd4' },
            { ic: '📐', t: 'استودیو پلان و سه‌بعدی', d: 'طراحیِ نقشه و رندرِ سه‌بعدیِ واحد با کمکِ هوشِ مصنوعی.', href: '/plan-ai', c: '#7aa88f' },
            { ic: '💼', t: 'ابزارِ کسب‌وکار', d: 'CRM، بازاریابی، اتوماسیون و سایت‌سازِ اختصاصی برای متخصصان.', href: '/pricing', c: '#c9a84c' },
            { ic: '📰', t: 'بلاگ و راهنما', d: 'مقالاتِ تخصصیِ خرید، سرمایه‌گذاری و ساخت‌وساز.', href: '/blog', c: '#7a8fae' },
            { ic: '📈', t: 'تحلیل و نقشهٔ بازار', d: 'ارزشِ واقعی، رشد و پیش‌بینیِ قیمتِ هر محله.', href: '/search', c: '#e7674a' },
            { ic: '👑', t: 'پنل‌های تخصصی', d: 'داشبوردِ اختصاصیِ سازنده، مصالح‌فروش، مشاور، آژانس و مالک.', href: '/auth', c: '#caa86a' },
          ].map(s => (
            <Link key={s.t} href={s.href} className="mjh-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 18px', textDecoration: 'none', color: 'inherit', transition: 'transform .16s, box-shadow .16s, border-color .16s' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `${s.c}22`, border: `1px solid ${s.c}55` }}>{s.ic}</div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>{s.t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.85, flex: 1 }}>{s.d}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>ورود ↗</div>
            </Link>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section style={{ marginTop: 'clamp(40px,5vw,64px)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '26px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 18 }}>
          {(() => {
            const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
            const live = sysStats ? [
              { n: `${fa(sysStats.listings)}+`, l: 'آگهیِ فعالِ ملک' },
              { n: `${fa(sysStats.products)}+`, l: 'محصولِ مصالح' },
              { n: `${fa(sysStats.shops)}+`, l: 'فروشگاهِ مصالح' },
              { n: `${fa(sysStats.advisors)}+`, l: 'متخصص و مشاور' },
              { n: `${fa(sysStats.builders)}+`, l: 'سازنده در دیتابیس' },
            ] : stats
            return live.map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: 'var(--gold)', letterSpacing: '-.5px' }}>{s.n}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))
          })()}
        </div>
      </section>

      {/* PROMOTED SPOTLIGHT — بنرِ خودکار از پروموت‌های فعال */}
      {(spotlight || []).length > 0 && (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px clamp(20px,3vw,32px)' }}>
          <PromoSpotlight items={spotlight} />
        </section>
      )}

      {/* AD BANNER */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <HomeBanner />
      </section>

      {/* FEATURED */}
      {featuredCards.length > 0 && (
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>★ منتخب ملک‌جت</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>املاک ویژه و لوکس</h2></div>
          <Link href="/search" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>مشاهده همه ←</Link>
        </div>
        <div className="mj-feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 18 }}>
          {featuredCards.map(p => (
            <PropertyCard key={p.id} {...p} />
          ))}
        </div>
      </section>
      )}

      {/* TRENDING — فقط با پروموتِ فعالِ ترند */}
      {trendingCards.length > 0 && (
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px clamp(48px,6vw,80px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: '#f08a6e', marginBottom: 8 }}>🔥 داغِ این روزها</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>آگهی‌های ترند</h2></div>
          </div>
          <div className="mj-feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 18 }}>
            {trendingCards.map(p => <PropertyCard key={p.id} {...p} />)}
          </div>
        </section>
      )}

      {/* INVESTMENT */}
      {investCards.length > 0 && (
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px clamp(48px,6vw,80px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>◈ بازده بالا</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>فرصت‌های سرمایه‌گذاری</h2></div>
          <Link href="/owner" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>میز کار سرمایه‌گذار ←</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
          {investCards.map(o => (
            <Link key={o.id} href={listingHref(o.id, o.title, o.location)} style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 150, background: o.img }}>
                {o.promoted && <span style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}><PromoBadge kind={o.promoKind} /></span>}
                <span style={{ position: 'absolute', top: 12, right: 12, padding: '5px 11px', borderRadius: 999, background: 'rgba(95,217,138,0.9)', color: '#0a2a16', fontSize: 12, fontWeight: 800 }}>بازده {o.roi}</span>
                <span style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(20,18,14,0.7)', backdropFilter: 'blur(6px)', color: o.riskColor, fontSize: 11, fontWeight: 700 }}>ریسک {o.risk}</span>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{o.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{o.location}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{o.price}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* AI MODULES */}
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>✦ هوش مصنوعی ملک‌جت</div>
            <h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>تصمیم بگیر، نه حدس بزن</h2>
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.85, color: 'var(--muted)' }}>سه موتور هوشمند که قبل از هر تصمیم، تصویر کاملی از ارزش، بازار و آینده‌ی ملک به تو می‌دهند.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
            {modules.map(m => (
              <div key={m.ic} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 26 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--goldDim)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--gold)' }}>{m.ic}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginTop: 18 }}>{m.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--muted)', marginTop: 10 }}>{m.d}</p>
                <Link href="/search" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>{m.cta} ←</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEIGHBORHOODS */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>◴ نقشه بازار</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>محله‌های محبوب تهران</h2></div>
          <Link href="/search" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>نقشه کامل ←</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
          {hoods.map(h => (
            <Link key={h.n} href={`/neighborhood/${encodeURIComponent(h.n)}`} style={{ position: 'relative', display: 'block', height: 148, borderRadius: 16, overflow: 'hidden', background: h.img, textDecoration: 'none', border: '1px solid var(--line)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.6),transparent 60%)' }}></div>
              <span style={{ position: 'absolute', top: 10, left: 10, padding: '4px 9px', borderRadius: 999, background: 'rgba(63,191,111,0.18)', color: '#5fd98a', fontSize: 11, fontWeight: 700, border: '1px solid rgba(63,191,111,0.4)' }}>{h.g}</span>
              <div style={{ position: 'absolute', bottom: 12, right: 12, left: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{h.n}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>میانگین {h.p} / متر</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ADVISORS — فقط با متخصصِ واقعی (پروموت‌شده/ثبت‌شده)؛ بدونِ دادهٔ فیک */}
      {advisorCards.length > 0 && (
      <section style={{ background: 'var(--bg2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>♛ تأییدشده</div><h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>مشاوران برتر</h2></div>
            <Link href="/directory" style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)', textDecoration: 'none', padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 11 }}>همه مشاوران ←</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
            {advisorCards.map(a => (
              <div key={a.n} style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22, textAlign: 'center' }}>
                {a.promoted && <span style={{ position: 'absolute', top: 12, left: 12 }}><PromoBadge kind={a.promoKind} size="sm" /></span>}
                <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto', background: a.img, border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>{a.initials}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 14 }}>{a.n}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{a.r}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{a.deals}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}>معامله</div></div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>★ {a.rate}</div><div style={{ fontSize: 11, color: 'var(--faint)' }}>امتیاز</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* MATERIALS */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(48px,6vw,80px) 24px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, border: '1px solid var(--line)', background: 'var(--bg2)', padding: 'clamp(28px,4vw,44px)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>⛓ بازار B2B</div>
              <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>بازار مصالح ساختمانی</h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, maxWidth: 460, lineHeight: 1.7 }}>خرید عمده، استعلام قیمت و سفارش مستقیم از تأمین‌کنندگان معتبر.</p>
            </div>
            <Link href="/materials" style={{ flexShrink: 0, padding: '0 18px', height: 44, display: 'flex', alignItems: 'center', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>ورود به بازار مصالح ←</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {materials.map(m => (
              <Link key={m.l} href="/materials" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 14, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--line)', textDecoration: 'none' }}>
                <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.ic}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.l}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(40px,5vw,72px) 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)', marginBottom: 32 }}>سوال‌های پرتکرار</h2>
        <FaqAccordion faqs={faqs} />
      </section>

      {/* چرا ملک‌جت */}
      <section style={{ borderTop: '1px solid var(--line)', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(40px,5vw,64px) 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            { ic: '🧠', t: 'هوشِ مصنوعیِ همه‌جا', d: 'از جستجو و قیمت‌گذاری تا مذاکره، محتوا و تصویر — دستیارِ هوشمند کنارِ توست.' },
            { ic: '🔗', t: 'زنجیرهٔ کامل', d: 'خریدار، مالک، مشاور، آژانس، سازنده و مصالح‌فروش، همه در یک اکوسیستمِ متصل.' },
            { ic: '📉', t: 'دادهٔ واقعی', d: 'نرخِ روزِ مصالح، تحلیلِ قیمتِ ملک و دیتابیسِ سازندگان — بر پایهٔ دادهٔ واقعی.' },
            { ic: '🛠️', t: 'ابزارِ حرفه‌ای', d: 'CRM، بازاریابی، اتوماسیون و سایت‌سازِ اختصاصی برای رشدِ کسب‌وکارت.' },
          ].map(x => (
            <div key={x.t} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 6px' }}>
              <div style={{ fontSize: 30 }}>{x.ic}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{x.t}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA پایانی */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(40px,5vw,72px) 24px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, border: '1px solid var(--gold)', background: 'linear-gradient(120deg, var(--goldDim), transparent 55%), var(--surface)', padding: 'clamp(32px,5vw,56px) clamp(24px,4vw,48px)', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '-30%', insetInlineStart: '-6%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,.25), transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
          <h2 style={{ position: 'relative', fontSize: 'clamp(24px,3.6vw,38px)', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--text)' }}>همین حالا به ملک‌جت بپیوند</h2>
          <p style={{ position: 'relative', fontSize: 'clamp(14px,1.8vw,16.5px)', color: 'var(--muted)', maxWidth: 560, margin: '14px auto 0', lineHeight: 1.9 }}>ثبت‌نامِ رایگان؛ بعد نقشت را انتخاب کن و داشبوردِ اختصاصیِ خودت را با همهٔ ابزارها تحویل بگیر.</p>
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 26 }}>
            <Link href="/auth" style={{ padding: '13px 30px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 12px 28px -12px var(--gold)' }}>شروعِ رایگان →</Link>
            <Link href="/pricing" style={{ padding: '13px 28px', borderRadius: 13, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>مشاهدهٔ پلن‌ها</Link>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 22 }}>
            {['سازنده', 'مصالح‌فروش', 'مشاورِ املاک', 'آژانس', 'مالک', 'مشاورِ حقوقی'].map(r => (
              <span key={r} style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 14px' }}>{r}</span>
            ))}
          </div>
        </div>
      </section>
      </main>

      <Footer />
      <HomeAssistant />
    </div>
  )
}
