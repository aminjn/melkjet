'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Nav from '@/app/components/Nav'
import PromoBadge from '@/app/components/PromoBadge'
import BannerSlot from '@/app/components/BannerSlot'
import CompareButton from '@/app/components/CompareButton'
import { IconSvg } from '../components/GlassIcon'
import PhotoFade from '../components/PhotoFade'
import CardImg from '@/app/components/CardImg'
import LikeHeart from '@/app/components/home/LikeHeart'
import TileBase from '@/app/components/TileBase'
import NeighborhoodPicker from '@/app/components/NeighborhoodPicker'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'
import { readLoc } from '@/app/components/LocationDetector'
import { readCity, writeCity } from '@/app/components/CitySelector'
import { canonCity } from '@/app/lib/city-name'
import { openAuth } from '@/app/components/AuthModal'
import { PROPERTY_KINDS } from '@/app/lib/taxonomy'
import { listingHref } from '@/app/lib/listing-url'
import { hoodPartOf, trustedMapCenter } from '@/app/lib/map-pins'
import { parsePoly, encodePoly, canonSpecQs, specLabel, hoodMatch, type LatLng } from '@/app/lib/search-query'
// فاز ۲۰۴: استخراج/فیلترِ آگهی حالا در کتابخانهٔ مشترکِ listing-search است —
// همان منطقی که /api/map/clusters روی کلِ استخر اجرا می‌کند (نقشه و کارت‌ها هم‌زبان).
import { parseQuery, deriveListing, effectiveFiltersOf, matchesListing } from '@/app/lib/listing-search'
import { listingAgeLabel, isFreshListing } from '@/app/lib/fa-time'
// فاز ۲۸۴ — نشانِ «دیده‌اید» روی کارتِ نتایج: خوانشِ گِیت‌شدهٔ بعد از mount از استورِ فاز ۲۵۵ (mj_seen_v1)
import { useSeenSet } from '@/app/lib/seen-listings'

function toPersianDigits(n: number | string): string { return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }
function faNum(n: number): string { return (Number(n) || 0).toLocaleString('fa-IR') }
// برچسبِ کوتاهِ قیمت روی نقشه: خرید/فروش بر اساسِ «میلیارد»، اجاره بر اساسِ «میلیون» (فارسی، بدونِ صفرِ اضافه)
function pinPrice(deal: string, priceB: number): string {
  if (!(priceB > 0)) return '—'
  // فاز ۱۹۰ — اجارهٔ روزانه: قیمتِ هر شب (میلیونی)، نه میلیاردیِ فروش
  if (deal === 'daily') return `${toPersianDigits(Math.round(priceB * 1000))} م/شب`
  if (deal === 'rent') {
    if (priceB >= 1) return `${faNum(Math.round(priceB * 10) / 10)} میلیارد`
    return `${toPersianDigits(Math.round(priceB * 1000))} میلیون`
  }
  return priceB >= 50 ? `${toPersianDigits(Math.round(priceB))} میلیارد` : `${faNum(Math.round(priceB * 10) / 10)} میلیارد`
}

const AMENITY_FILTER = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'مبله', 'روف گاردن', 'استخر', 'لابی', 'نوساز']
const PRICE_MAX = 500 // «بدون سقف»
// فاز ۳۳۷ب — مرتب‌سازی‌های هم‌تراز با رقبا (Zillow/کیلید): تازه‌ترین آگهی، قیمتِ هر متر، متراژ، نوسازی.
// قیمتِ هر متر: priceNum به «میلیارد» است → به میلیون/میلیارد برای خوانایی.
const perMeterLabel = (priceBn: number, area: number) => {
  const m = priceBn * 1000 / area   // میلیون تومان
  return m >= 1000 ? `${(m / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} میلیارد` : `${Math.round(m).toLocaleString('fa-IR')} میلیون`
}
const SORT_OPTS = ['پیشنهاد ملک‌جت', 'جدیدترین آگهی', 'ارزان‌ترین', 'گران‌ترین', 'ارزان‌ترین هر متر', 'بزرگ‌ترین متراژ', 'نوسازترین']
const chip = (on: boolean): React.CSSProperties => ({ padding: '6px 13px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'var(--goldDim)' : 'transparent', color: on ? 'var(--gold)' : 'var(--muted)', fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'inherit' })
// گزینه‌های آمادهٔ فیلتر (دراپ‌داون — کاربر تایپ نمی‌کند)
// چیپِ نوعِ ملک در نوارِ ساختاریافتهٔ همیشه‌جلوی‌چشم.
function chipStyle(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 10, border: `1px solid ${active ? 'var(--gold)' : 'var(--line2)'}`, background: active ? 'var(--goldDim)' : 'var(--surface)', color: active ? 'var(--goldText)' : 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }
}

const PRICE_OPTS = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 200, 300]
const AREA_OPTS = [40, 50, 60, 75, 90, 100, 120, 150, 180, 200, 250, 300, 400, 500]
const FLOOR_OPTS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20]
const YEAR_OPTS = Array.from({ length: 30 }, (_, i) => 1404 - i) // ۱۴۰۴ تا ۱۳۷۵
const priceLabel = (n: number) => n < 1 ? `${(n * 1000).toLocaleString('fa-IR')} میلیون` : `${n.toLocaleString('fa-IR')} میلیارد`
// کشِ سمتِ کلاینتِ مختصاتِ هر شهر/محله — تا نقشهٔ هر شهر فقط یک‌بار geocode شود
const GEO_CACHE = new Map<string, { lat: number; lng: number }>()

// فاصلهٔ هاورساین (کیلومتر) بینِ دو نقطهٔ مختصات — برای فیلترِ «نزدیکِ من».
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toR = Math.PI / 180
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function toProperty(it: ContentItem) {
  // فاز ۲۰۴: فیلدهای فیلترپذیر از کتابخانهٔ مشترک (همان که سرورِ نقشه استفاده می‌کند)؛
  // این‌جا فقط فیلدهای نمایشی اضافه می‌شود. فاز ۲۰۸: scrapedAt برای برچسبِ «کی ثبت شده».
  const d = deriveListing(it)
  const ds = it.meta?.['__dealStatus']
  const dealStatus: 'sold' | 'rented' | '' = ds === 'sold' ? 'sold' : ds === 'rented' ? 'rented' : ''
  return {
    ...d,
    price: it.price || '—',
    beds: d.bedsNum != null ? toPersianDigits(d.bedsNum) : '—',
    size: d.areaNum ? toPersianDigits(d.areaNum) : '—',
    year: d.yearNum ? toPersianDigits(d.yearNum) : '—',
    dealStatus,
    scrapedAt: it.scrapedAt,
    // بدونِ «امتیازِ AI»ِ ساختگی — score فقط برای ترتیبِ پایدارِ «پیشنهاد ملک‌جت» (از هش؛ نمایش داده نمی‌شود)
    tag: '',
    img: it.image ? '' : gradientFor(it.title), image: it.image, url: it.url,
    category: it.category || '', promoKind: (it as any).promoKind || '',
  }
}
type PropertyT = ReturnType<typeof toProperty>

// فاز ۹۹ (SSR جستجو): دادهٔ اولیه و شهرِ کوکی از صفحهٔ سروری می‌آید تا کارت‌ها
// و تصویرِ LCP در HTML اولیه باشند؛ رفتارِ بعد از هیدریت عیناً مثلِ قبل است.
export default function SearchClient({ initial, initialCity }: { initial: ContentItem[]; initialCity: string }) {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const typeParam = (searchParams.get('type') || '').toLowerCase()
  const kindParam = searchParams.get('kind') || ''   // نوعِ ملک از URL (برای میان‌بُرهای منو)
  const dealFromParam = (t: string) => t === 'rent' || t === 'اجاره' ? 'اجاره'
    : t === 'presale' || t === 'pre-sale' || t === 'پیش‌فروش' ? 'پیش‌فروش'
      : t === 'mortgage' || t === 'rahn' || t === 'رهن' ? 'رهن'
        : t === 'daily' || t === 'روزانه' ? 'اجارهٔ روزانه' : 'خرید'
  // تبِ معامله = state (منبعِ واحدِ حقیقت برای فیلتر). از URL مقداردهیِ اولیه می‌شود،
  // با کلیکِ تب فوراً عوض می‌شود (state) و آدرس‌بار هم با replaceState همگام می‌شود.
  const [dealType, setDealType] = useState<string>(dealFromParam(typeParam))
  useEffect(() => { setDealType(dealFromParam(typeParam)) }, [typeParam])
  // رویدادِ کلیکِ تبِ معامله از نوارِ بالا (تضمینِ عوض‌شدنِ تب وقتی همین‌حالا روی /search هستیم)
  useEffect(() => {
    const onDeal = (e: Event) => {
      const slug = (e as CustomEvent).detail as string
      setDealType(slug === 'rent' ? 'اجاره' : slug === 'presale' ? 'پیش‌فروش' : slug === 'mortgage' ? 'رهن' : slug === 'daily' ? 'اجارهٔ روزانه' : 'خرید')
    }
    window.addEventListener('mj-deal', onDeal)
    return () => window.removeEventListener('mj-deal', onDeal)
  }, [])
  const goDeal = (label: string) => setDealType(label)   // فاز ۱۷۸: URL را سینکِ واحدِ پایین می‌نویسد

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mapOpenMobile, setMapOpenMobile] = useState(false)   // موبایل: نقشه پیش‌فرض بسته، با دکمهٔ شناور باز می‌شود
  const [search, setSearch] = useState(initialQuery)
  const [searchTerm, setSearchTerm] = useState(initialQuery)
  // فاز ۱۷۸ (فیدبک: «می‌ره تو آگهی برمی‌گرده، کلِ فیلترها و سرچ می‌پره») — همهٔ فیلترها از URL
  // مقداردهی می‌شوند و پایین‌تر با replaceState به URL برمی‌گردند؛ برگشت از آگهی = همان وضعیت.
  const [beds, setBeds] = useState<string>(searchParams.get('beds') || 'همه')
  const [kind, setKind] = useState(kindParam)
  useEffect(() => { if (kindParam) setKind(kindParam) }, [kindParam])
  const [priceMin, setPriceMin] = useState(Number(searchParams.get('pmin')) || 0)
  const [priceMax, setPriceMax] = useState(Number(searchParams.get('pmax')) || PRICE_MAX)
  const [areaMin, setAreaMin] = useState(Number(searchParams.get('amin')) || 0)
  const [areaMax, setAreaMax] = useState(Number(searchParams.get('amax')) || 0)
  const [floorMin, setFloorMin] = useState(Number(searchParams.get('fmin')) || 0)
  const [yearMin, setYearMin] = useState(Number(searchParams.get('ymin')) || 0)
  const [checkedAmenities, setCheckedAmenities] = useState<string[]>((searchParams.get('amen') || '').split('،').filter(Boolean))
  // فاز ۳۳۷ب — فیلترهای هم‌تراز با رقبا (کیلید/دیوار/Zillow): فقط قیمت‌دار، فقط عکس‌دار، آگهی‌دهنده.
  const [pricedOnly, setPricedOnly] = useState(searchParams.get('priced') === '1')
  const [photoOnly, setPhotoOnly] = useState(searchParams.get('photo') === '1')
  const [advertiser, setAdvertiser] = useState<string>(searchParams.get('adv') || '')
  // فاز د — «محدوده را روی نقشه بکش» (زیلو/رایت‌موو): چندضلعی در URL (poly) تا قابلِ اشتراک و ذخیره باشد.
  // شناسه‌های درونِ محدوده را سرور (همان موتورِ نقشه) می‌دهد تا کارت‌ها و پین‌ها دقیقاً یکی باشند.
  const [poly, setPoly] = useState<LatLng[] | null>(() => parsePoly(searchParams.get('poly')))
  const [polyIds, setPolyIds] = useState<Set<string> | null>(null)
  // «جدیدترین» قدیمی (که در واقع سالِ ساخت را مرتب می‌کرد) به «جدیدترین آگهی» نگاشت می‌شود.
  const [sortBy, setSortBy] = useState(() => { const v = searchParams.get('sort') || 'پیشنهاد ملک‌جت'; return v === 'جدیدترین' ? 'جدیدترین آگهی' : v })
  const [hood, setHood] = useState(searchParams.get('hood') || '')   // فیلترِ محله (انتخابِ کاربر)
  // فاز ۱۵۱ (فیدبک: «رفرش می‌کنم می‌رود توی یک محله، ۴ تا آگهی»): «نزدیکِ من» دیگر پیش‌فرض روشن نیست —
  // موقعیت/سوابق فقط با انتخابِ صریحِ کاربر فیلتر می‌کند؛ وگرنه صرفاً مرتب‌سازی.
  const [nearMe, setNearMe] = useState(searchParams.get('near') === '1')

  // سوابقِ کاربر/موقعیتِ لحظه‌ای: محلهٔ کاربر + شهرِ انتخابی (یا تشخیص‌داده‌شده)
  const [userArea, setUserArea] = useState('')
  const [userCity, setUserCity] = useState('')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedCity, setSelectedCity] = useState(initialCity)
  useEffect(() => {
    // فاز د — شهرِ داخلِ URL (لینکِ جستجوی ذخیره‌شده) کوکی را هم‌سو می‌کند تا انتخابگرِ هدر و نتایج یکی باشند.
    const urlCity = canonCity(searchParams.get('city'))
    if (urlCity && urlCity !== readCity()) writeCity(urlCity)
    const upd = () => {
      const l = readLoc()
      setUserArea(l?.neighborhood || '')
      setUserCity(l?.city || '')
      if (l?.lat && l?.lng) setUserLoc({ lat: l.lat, lng: l.lng })
      setSelectedCity(readCity())
    }
    upd()
    window.addEventListener('mj-loc-updated', upd)
    window.addEventListener('mj-city-updated', upd)
    return () => { window.removeEventListener('mj-loc-updated', upd); window.removeEventListener('mj-city-updated', upd) }
  }, [])
  // سوابقِ کاربر (از ترکر): محله‌ای که بیشترین بازدید را داشته → اولویتِ نمایش
  const [histArea, setHistArea] = useState('')
  useEffect(() => { fetch('/api/track/prefs').then(r => r.ok ? r.json() : null).then(d => { if (d?.neighborhood) setHistArea(d.neighborhood) }).catch(() => {}) }, [])
  const prefArea = histArea || userArea   // سوابق > موقعیتِ لحظه‌ای

  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  // فاز ۲۸۴ — شناسه‌های دیده‌شده؛ قبل از mount مقدارش null است (صفحه SSR است → ضدِ hydration mismatch)
  const seenSet = useSeenSet()
  const [properties, setProperties] = useState<PropertyT[]>(() => initial.map(toProperty))
  const [poolTotal, setPoolTotal] = useState(0)          // فاز ۱۵۱: کلِ نتیجهٔ واقعیِ فیلترِ شهر/تب در سرور
  // فاز ۹۲ (پرفورمنس: رندرِ ۱۰۰۰ کارت + ۱۰۰۰ تصویرِ background = ۴۴MB و LCP ~۱۰ث): رندرِ تدریجیِ ۲۴تایی
  const [visN, setVisN] = useState(24)
  const [promoted, setPromoted] = useState<PropertyT[]>([])
  const [loading, setLoading] = useState(initial.length === 0)

  // فاز ۱۸۰ (فیدبک: «همه جای سایت باید رفرش کنی تا تازه شود») — برگشت به تب = تازه‌سازیِ بی‌صدا
  const [fresh180, setFresh180] = useState(0)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setFresh180(n => n + 1) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    let alive = true
    // فاز ۹۴ (LCP ۸ث): واکشیِ دومرحله‌ای — اول ۶۰ تای اول (پاسخِ کوچک → کارت‌ها و تصویرِ LCP فوری)،
    // بعد کلِ استخر در پس‌زمینه برای فیلترها/نقشه. تا وقتی فهرستِ کامل نیامده، همان ۶۰ تا نمایش داده می‌شود.
    let gotFull = false
    // فاز ۹۹: ۶۰ تای اول با SSR آمده؛ این واکشی فقط فالبکِ حالتِ خالی است
    if (!initial.length) fetchContent('listing', undefined, 60, true).then((d) => { if (alive && !gotFull) { setProperties(d.map(toProperty)); setLoading(false) } })
    // فاز ۹۶ (TBT) + فاز ۱۵۱ (فیدبک: «کلی ملک هست چرا ۲۸ تا؟»): استخرِ کامل حالا «فیلترشدهٔ
    // شهر/تبِ همین کاربر» است که سرور روی کلِ آگهی‌ها ساخته — نه ۱۰۰۰ تای آخرِ همهٔ شهرها.
    const tab151 = dealType === 'پیش‌فروش' ? 'presale' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'
    // فاز ۲۰۵ (فیدبک: «اول ۱۰ تا آگهی نشون می‌ده، ۳ ثانیه بعد آگهی‌های درست — غیرحرفه‌ای و آزاردهنده»):
    // تأخیرِ عمدیِ ۲.۵ثانیه‌ایِ فاز ۹۶ (نگرانیِ TBTِ رندرِ ۱۰۰۰ کارت) منسوخ بود — رندر از فاز ۹۲
    // تدریجیِ ۲۴تایی است. استخرِ کامل حالا بلافاصله می‌آید؛ سوییچ در حدِ یک لودِ عادی حس می‌شود.
    const t96 = setTimeout(() => {
      if (!alive) return
      const q = new URLSearchParams({ type: 'listing', limit: '1000', slim: '1', deal: tab151 })
      if (selectedCity) q.set('city', selectedCity)
      fetch(`/api/content?${q.toString()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [], total: 0 }).then((d) => {
        if (alive) { gotFull = true; setProperties((d.items || []).map(toProperty)); setPoolTotal(Number(d.total) || 0); setLoading(false) }
      }).catch(() => { if (alive) setLoading(false) })
    }, 0)
    fetch('/api/promotions?slot=search_top', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (alive) setPromoted(((d.items || []) as ContentItem[]).map(toProperty)) }).catch(() => {})
    return () => { alive = false; clearTimeout(t96) }
  }, [selectedCity, dealType, fresh180])

  // با هر تغییرِ نتیجه‌ها از اول ۲۴ تا؛ نگهبانِ انتهای لیست خودکار ۲۴ تای بعدی را می‌آورد
  useEffect(() => { setVisN(24) }, [dealType, kind, beds, priceMin, priceMax, areaMin, areaMax, floorMin, yearMin, checkedAmenities, searchTerm, selectedCity, pricedOnly, photoOnly, advertiser, sortBy, poly])
  // فاز ۱۷۸ (فیدبک: «۲۵ تا نشان می‌دهد و بقیه گیر می‌کند») — observer با effectِ یک‌باره وصل می‌شد
  // ولی نگهبانِ انتهای لیست آن لحظه هنوز رندر نشده بود (داده نیامده بود) → هرگز وصل نمی‌شد.
  // callback-ref هر بار که نگهبان واقعاً در DOM بیاید/برود، observer را وصل/قطع می‌کند.
  const moreObs = useRef<IntersectionObserver | null>(null)
  const moreRefCb = useCallback((el: HTMLDivElement | null) => {
    moreObs.current?.disconnect(); moreObs.current = null
    if (!el) return
    const io = new IntersectionObserver(es => { if (es[0]?.isIntersecting) setVisN(n => n + 24) }, { rootMargin: '900px' })
    io.observe(el)
    moreObs.current = io
  }, [])
  useEffect(() => () => moreObs.current?.disconnect(), [])

  const toggleAmenity = (a: string) => setCheckedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  const parsed = useMemo(() => parseQuery(searchTerm), [searchTerm])
  // فاز ۱۷۸ — سینکِ کاملِ وضعیتِ جستجو → URL (replaceState، بدونِ رفرش): برگشت از آگهی هیچ‌چیز را نمی‌پراند
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams()
      if (searchTerm) p.set('q', searchTerm)
      const slug = dealType === 'اجاره' ? 'rent' : dealType === 'پیش‌فروش' ? 'presale' : dealType === 'رهن' ? 'mortgage' : dealType === 'اجارهٔ روزانه' ? 'daily' : ''
      if (slug) p.set('type', slug)
      if (kind) p.set('kind', kind)
      if (beds !== 'همه') p.set('beds', beds)
      if (priceMin > 0) p.set('pmin', String(priceMin))
      if (priceMax < PRICE_MAX) p.set('pmax', String(priceMax))
      if (areaMin > 0) p.set('amin', String(areaMin))
      if (areaMax > 0) p.set('amax', String(areaMax))
      if (floorMin > 0) p.set('fmin', String(floorMin))
      if (yearMin > 0) p.set('ymin', String(yearMin))
      if (checkedAmenities.length) p.set('amen', checkedAmenities.join('،'))
      if (hood) p.set('hood', hood)
      if (pricedOnly) p.set('priced', '1')
      if (photoOnly) p.set('photo', '1')
      if (advertiser) p.set('adv', advertiser)
      if (poly) p.set('poly', encodePoly(poly))
      if (sortBy !== 'پیشنهاد ملک‌جت') p.set('sort', sortBy)
      if (nearMe) p.set('near', '1')
      const qs = p.toString()
      try { window.history.replaceState(null, '', '/search' + (qs ? `?${qs}` : '')) } catch { /* URL sync اختیاری */ }
    }, 250)
    return () => clearTimeout(t)
  }, [searchTerm, dealType, kind, beds, priceMin, priceMax, areaMin, areaMax, floorMin, yearMin, checkedAmenities, hood, sortBy, nearMe, pricedOnly, photoOnly, advertiser, poly])
  // 🧠 فاز ۱۸۹ — رویدادِ جستجو بالاخره ثبت می‌شود (ML هرگز رفتارِ جستجو را نمی‌دید و کوئستِ «جستجو بزن»
  // غیرقابلِ‌انجام بود): جستجوی معنادار بعدِ آرام‌شدنِ تایپ، هر امضای یکتا فقط یک‌بار در این بازدید.
  const searchedSigs = useRef<Set<string>>(new Set())
  useEffect(() => {
    const meaningful = searchTerm.trim() || hood || beds !== 'همه' || priceMin > 0 || priceMax < PRICE_MAX
    if (!meaningful) return
    const t = setTimeout(() => {
      const sig = [searchTerm.trim(), hood, dealType, beds, priceMin, priceMax].join('|')
      if (searchedSigs.current.has(sig)) return
      searchedSigs.current.add(sig)
      fetch('/api/reos/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user_searched', meta: { q: searchTerm.trim(), hood, deal: dealType } }) }).catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [searchTerm, hood, dealType, beds, priceMin, priceMax])
  // فاز ۱۷۷ (فیدبک: «از صفحهٔ اصلی سرچ می‌کنم چرت‌وپرت می‌ده») — صفحهٔ اصلی فقط q می‌فرستد؛
  // نیتِ معامله از خودِ متن («اجارهٔ آپارتمان…») تبِ درست را انتخاب می‌کند تا آگهیِ فروش برای کوئریِ اجاره نیاید.
  useEffect(() => {
    if (parsed.deal === 'rent') setDealType('اجاره')
    else if (parsed.deal === 'daily') setDealType('اجارهٔ روزانه')
    else if (parsed.deal === 'presale') setDealType('پیش‌فروش')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  const activeFilterCount =
    (dealType !== 'خرید' ? 1 : 0) + (kind ? 1 : 0) + (beds !== 'همه' ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) + (priceMax < PRICE_MAX ? 1 : 0) + (areaMin > 0 ? 1 : 0) + (areaMax > 0 ? 1 : 0) +
    (floorMin > 0 ? 1 : 0) + (yearMin > 0 ? 1 : 0) + checkedAmenities.length +
    (pricedOnly ? 1 : 0) + (photoOnly ? 1 : 0) + (advertiser ? 1 : 0) + (poly ? 1 : 0)

  // فاز ۲۰۴: همان منطقِ مشترکِ listing-search (فیلترِ دستی اولویت دارد، وگرنه تشخیصِ متن؛
  // predicate عیناً همان فاز ۱۷۷/۱۵۱) — سرورِ نقشه هم دقیقاً همین را روی کلِ استخر اجرا می‌کند.
  const filteredProperties = useMemo(() => {
    const tabDeal = dealType === 'پیش‌فروش' ? 'presale' : dealType === 'اجارهٔ روزانه' ? 'daily' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'
    const eff = effectiveFiltersOf({
      tab: tabDeal, q: searchTerm, kind, bedsLabel: beds,
      priceMin, priceMax: priceMax < PRICE_MAX ? priceMax : 0,
      areaMin, areaMax, floorMin, yearMin, amenities: checkedAmenities,
      pricedOnly, photoOnly, advertiser,
    })
    return properties.filter(p => matchesListing(p, eff) && (!polyIds || polyIds.has(p.id)))
  }, [properties, dealType, searchTerm, kind, beds, priceMin, priceMax, areaMin, areaMax, floorMin, yearMin, checkedAmenities, pricedOnly, photoOnly, advertiser, polyIds])

  // ─── فیلترِ هوشمندِ مکان ──────────────────────────────────────────────────
  // شهر = فیلترِ قطعی (اگر آگهی نبود، خالی نشان می‌دهد؛ هیچ‌وقت آگهیِ شهرِ دیگر را نشان نمی‌دهد).
  // محله (سوابق/موقعیت) = اولویتِ نرم داخلِ همان شهر؛ اگر در آن محله نبود، به سطحِ شهر برمی‌گردد.
  const scoped = useMemo(() => {
    const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()
    // تطبیقِ محله (دوسویه): «جنت‌آباد» و «جنت آباد شمالی» یکدیگر را می‌پذیرند، ولی «نیاوران» نه.
    // چون موقعیتِ GPS کاربر معمولاً دقیق‌تر (جنت آباد شمالی) و برچسبِ فایل کلی‌تر (جنت‌آباد) است،
    // تطبیقِ زیرمجموعه‌ایِ زیررشته کافی نیست و باید هر دو جهت بررسی شود.
    const areaMatch = (loc: string, ar: string) => {
      const na = norm(ar); if (!na) return true
      const nl = norm(loc)
      if (nl.includes(na)) return true
      const parts = nl.split(/[،,]/).map(x => x.trim()).filter(Boolean)
      const hoodPart = parts.length ? parts[parts.length - 1] : nl
      return hoodPart.length >= 2 && (na.includes(hoodPart) || hoodPart.includes(na))
    }
    const base = filteredProperties
    const city = selectedCity
    // فاز ۱۵۱: فقط محلهٔ «انتخابِ صریحِ کاربر» فیلتر می‌کند؛ محلهٔ سوابق/موقعیت (prefArea)
    // دیگر هرگز نتیجه را کم نمی‌کند — فقط در مرتب‌سازی اولویت می‌گیرد (پایین‌تر).
    const area = hood
    const hard = !!hood
    // فاز د — محلهٔ انتخابی با hoodMatchِ مشترک (مرزِ واژه: «ونک» دیگر آگهی‌های «پونک» را نشان نمی‌دهد) —
    // همان تابعی که نقشه و هشدارِ آگهیِ جدید می‌زنند. areaMatch فقط برای «محلهٔ GPSِ کاربر» (رتبه‌بندیِ نرم) ماند.
    const inArea = (p: PropertyT) => area ? hoodMatch(p.location, area, city) : true
    // «نزدیکِ من» فعال است وقتی: GPS داریم، شهرِ انتخابی با شهرِ کاربر یکی است،
    // کاربر محله/مکانِ خاصی نخواسته، و خودش خاموشش نکرده.
    const gpsCityOk = !city || !userCity || norm(city) === norm(userCity) || norm(userCity).includes(norm(city)) || norm(city).includes(norm(userCity))
    const gpsActive = !!userLoc && gpsCityOk && nearMe && !hood && !parsed.area
    // فقط آگهی‌های محدودهٔ کاربر را نگه می‌دارد (شعاعِ تطبیقی)، مرتب بر اساسِ فاصله.
    const applyNear = (list: PropertyT[]): { list: PropertyT[]; near: boolean } => {
      if (!gpsActive || !userLoc) return { list, near: false }
      const withD = list.map(p => ({
        p,
        d: (p.lat && p.lng) ? haversineKm(userLoc.lat, userLoc.lng, p.lat, p.lng)
          : (userArea && areaMatch(p.location, userArea) ? 0.8 : Infinity),
      }))
      let near = withD.filter(x => isFinite(x.d))
      for (const r of [3, 6, 10, 15, 25]) { const f = withD.filter(x => x.d <= r); if (f.length >= 8) { near = f; break } }
      if (!near.length) return { list, near: false }   // هیچ آگهیِ مختصات‌دار نبود → کلِ شهر
      return { list: near.sort((a, b) => a.d - b.d).map(x => x.p), near: true }
    }
    if (city) {
      const inCity = base.filter(p => norm(p.location).includes(norm(city)))
      if (area) { const a = inCity.filter(inArea); return { list: hard ? a : (a.length ? a : inCity), near: false } }
      return applyNear(inCity)   // خالی = واقعاً خالی (بدونِ fallbackِ بین‌شهری)
    }
    if (area) { const a = base.filter(inArea); return { list: hard ? a : (a.length ? a : base), near: false } }
    return applyNear(base)
  }, [filteredProperties, selectedCity, prefArea, parsed.area, hood, userLoc, userCity, userArea, nearMe])

  // گزینه‌های محله از روی آگهی‌های همان شهر (محله‌هایی که واقعاً آگهی دارند).
  const hoodOptions = useMemo(() => {
    const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '')
    const counts = new Map<string, number>()
    for (const p of filteredProperties) {
      if (selectedCity && !norm(p.location).includes(norm(selectedCity))) continue
      // آخرین بخشِ موقعیت = محله (موقعیت به‌صورتِ «شهر، محله» ساخته می‌شود)؛ اگر یک بخش بود، همان.
      const segs = (p.location || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
      const h = segs.length > 1 ? segs[segs.length - 1] : (segs[0] || '')
      if (h && h !== 'نامشخص' && (!selectedCity || norm(h) !== norm(selectedCity))) counts.set(h, (counts.get(h) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([h, c]) => ({ h, c }))
  }, [filteredProperties, selectedCity])

  const sortedProperties = useMemo(() => {
    const ar = prefArea.replace(/‌/g, '').trim()
    const nearby = (p: { location: string }) => ar ? p.location.replace(/‌/g, '').includes(ar) : false
    return [...scoped.list].sort((a, b) => {
      // فاز ۳۳۷ب — آگهیِ «توافقی» (قیمت ۰) در مرتب‌سازیِ قیمتی همیشه ته، نه اولِ «ارزان‌ترین».
      const noP = (x: typeof a) => !(x.priceNum > 0)
      if (sortBy === 'ارزان‌ترین' || sortBy === 'گران‌ترین' || sortBy === 'ارزان‌ترین هر متر') {
        if (noP(a) !== noP(b)) return noP(a) ? 1 : -1
      }
      if (sortBy === 'ارزان‌ترین') return a.priceNum - b.priceNum
      if (sortBy === 'گران‌ترین') return b.priceNum - a.priceNum
      if (sortBy === 'ارزان‌ترین هر متر') {
        const pm = (x: typeof a) => (x.priceNum > 0 && x.areaNum > 0) ? x.priceNum / x.areaNum : Infinity
        return pm(a) - pm(b)
      }
      if (sortBy === 'بزرگ‌ترین متراژ') return (b.areaNum || 0) - (a.areaNum || 0)
      if (sortBy === 'جدیدترین آگهی') return (b.scrapedAt || 0) - (a.scrapedAt || 0)
      if (sortBy === 'نوسازترین') return (b.yearNum || 0) - (a.yearNum || 0)
      const an = nearby(a), bn = nearby(b)
      if (an !== bn) return an ? -1 : 1
      return b.score - a.score
    })
  }, [scoped, sortBy, prefArea])

  const shownProperties = useMemo(() => {
    const ids = new Set(promoted.map(p => p.id))
    const tab = dealType === 'پیش‌فروش' ? 'presale' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'
    const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()
    // آگهی‌های ویژه هم به فیلترِ قطعیِ شهر احترام می‌گذارند (نباید آگهیِ شهرِ دیگر نشت کند)
    const cityOk = (p: PropertyT) => !selectedCity || norm(p.location).includes(norm(selectedCity))
    const promo = promoted.filter(p => p.deal === tab && cityOk(p))
    return [...promo, ...sortedProperties.filter(p => !ids.has(p.id))]
  }, [promoted, sortedProperties, dealType, selectedCity])
  const promotedIdSet = useMemo(() => new Set(promoted.map(p => p.id)), [promoted])

  // پرتکرارترین محلهٔ آگهی‌های نمایش‌داده‌شده (برای مرکزِ نقشه وقتی هیچ پینی نیست)
  // فاز ۲۰۲: روی کلِ نتیجه‌ها، نه ۴۰ تای اول — ۴۰ تای اولِ مرتب‌سازی می‌توانست همه از یک محله باشند
  const mapArea = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of shownProperties) { const n = hoodPartOf(p.location || '', selectedCity || ''); if (n) counts[n] = (counts[n] || 0) + 1 }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  }, [shownProperties, selectedCity])
  // مرکزِ نقشهٔ شهر/محله (geocode، با کش) — برای حالتی که آگهی مختصات ندارد
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    const hoodQ = [mapArea, selectedCity].filter(Boolean).join(' ').trim()
    if (!hoodQ) { setMapCenter(null); return }
    let alive = true
    const geo = async (q: string): Promise<{ lat: number; lng: number } | null> => {
      const cached = GEO_CACHE.get(q)
      if (cached) return cached
      try {
        const d = await fetch(`/api/geo/geocode?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : null)
        if (d?.lat) { const c = { lat: d.lat, lng: d.lng }; GEO_CACHE.set(q, c); return c }
      } catch { /* بدونِ مرکز */ }
      return null
    }
    // فاز ۲۴۷: geocodeِ «محله + شهر» گاهی به شهرِ دیگری می‌پرد («نیلوفر تهران» → کرج!) —
    // مرکزِ خودِ شهر سنجه است؛ نقطهٔ دورتر از ~۳۰کیلومتر بی‌اعتبار و مرکزِ شهر ملاک می‌شود.
    ;(async () => {
      const hood = await geo(hoodQ)
      const cityQ = (selectedCity || '').trim()
      const cityC = cityQ && cityQ !== hoodQ ? await geo(cityQ) : null
      const pick = trustedMapCenter(hood, cityC)
      if (alive && pick) setMapCenter(pick)
    })()
    return () => { alive = false }
  }, [mapArea, selectedCity])

  // ── فاز ۲۰۴ — نقشهٔ سرورساید (معماریِ دیوار برای ۱۲هزار+ آگهی) ──────────────
  // کلاینت دیگر نه آگهی پین می‌کند نه geocode می‌زند: فقط «فیلترهای فعلی» را به
  // /api/map/clusters می‌فرستد؛ سرور روی کلِ استخر خوشه/پینِ همان قاب را برمی‌گرداند.
  const mapQuery = useMemo(() => {
    const tab = dealType === 'پیش‌فروش' ? 'presale' : dealType === 'اجارهٔ روزانه' ? 'daily' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'
    const p = new URLSearchParams({ deal: tab })
    if (selectedCity) p.set('city', selectedCity)
    if (searchTerm.trim()) p.set('q', searchTerm.trim())
    if (kind) p.set('kind', kind)
    if (beds !== 'همه') p.set('beds', beds)
    if (priceMin > 0) p.set('pmin', String(priceMin))
    if (priceMax < PRICE_MAX) p.set('pmax', String(priceMax))
    if (areaMin > 0) p.set('amin', String(areaMin))
    if (areaMax > 0) p.set('amax', String(areaMax))
    if (floorMin > 0) p.set('fmin', String(floorMin))
    if (yearMin > 0) p.set('ymin', String(yearMin))
    if (checkedAmenities.length) p.set('amen', checkedAmenities.join('،'))
    if (pricedOnly) p.set('priced', '1')
    if (photoOnly) p.set('photo', '1')
    if (advertiser) p.set('adv', advertiser)
    // فاز د — محله و محدودهٔ رسم‌شده هم به نقشه می‌روند (قبلاً نقشه محلهٔ انتخابی را نادیده می‌گرفت).
    if (hood) p.set('hood', hood)
    if (poly) p.set('poly', encodePoly(poly))
    return p.toString()
  }, [dealType, selectedCity, searchTerm, kind, beds, priceMin, priceMax, areaMin, areaMax, floorMin, yearMin, checkedAmenities, pricedOnly, photoOnly, advertiser, hood, poly])
  // شناسه‌های درونِ محدوده — مستقل از باز بودنِ نقشه (در موبایل نقشه بسته است ولی فهرست باید فیلتر شود).
  useEffect(() => {
    if (!poly) { setPolyIds(null); return }
    let alive = true
    fetch(`/api/map/clusters?${mapQuery}&zoom=12`).then(r => r.ok ? r.json() : null).then(d => { if (alive && d?.ok) setPolyIds(new Set<string>((d.polyIds || []).map(String))) }).catch(() => {})
    return () => { alive = false }
  }, [poly, mapQuery])

  // نمای اولیهٔ جایگزین وقتی سرور هیچ نقطه‌ای ندارد (شهرِ بی‌آگهی): مرکزِ geocodeشدهٔ شهر/محله
  const mapView = useMemo(() => (mapCenter ? { center: mapCenter, zoom: 13 } : null), [mapCenter])

  // چیپ‌های تشخیصِ AI — فقط مواردِ واقعاً تشخیص‌داده‌شده
  const aiChips = useMemo(() => {
    const c: { label: string; value: string }[] = []
    if (parsed.kind) c.push({ label: 'نوع', value: parsed.kind })
    if (parsed.area) c.push({ label: 'منطقه', value: parsed.area })
    if (parsed.sizeNum) c.push({ label: 'متراژ', value: `~${toPersianDigits(parsed.sizeNum)} متر` })
    if (parsed.budgetMax) c.push({ label: 'بودجه', value: `زیر ${faNum(parsed.budgetMax)} میلیارد` })
    if (parsed.beds != null) c.push({ label: 'خواب', value: `${toPersianDigits(parsed.beds)} خوابه` })
    if (parsed.amenities.length) c.push({ label: 'امکانات', value: parsed.amenities.join('، ') })
    return c
  }, [parsed])

  const resetFilters = () => { setKind(''); setBeds('همه'); setPriceMin(0); setPriceMax(PRICE_MAX); setAreaMin(0); setAreaMax(0); setFloorMin(0); setYearMin(0); setCheckedAmenities([]); setHood(''); setPricedOnly(false); setPhotoOnly(false); setAdvertiser(''); setPoly(null) }

  const selInput: React.CSSProperties = { height: 36, padding: '0 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }
  const lab: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif" }}>
      <Nav />

      <div style={{ position: 'sticky', top: 68, zIndex: 40, background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }}>
        <div className="mjs-filterbar" style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)', pointerEvents: 'none', zIndex: 1, display: 'flex' }}><IconSvg name="spark" size={16} /></span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchTerm(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') setSearchTerm(search) }}
              placeholder="آپارتمان ۱۳۰ متری در سعادت‌آباد زیر ۱۸ میلیارد با آسانسور و پارکینگ"
              style={{ width: '100%', height: 48, paddingRight: 42, paddingLeft: 16, background: 'var(--surface)', border: '1.5px solid var(--gold)', borderRadius: 12, color: 'var(--text)', fontSize: 14, outline: 'none', boxShadow: '0 0 0 3px rgba(201,168,76,0.10)', textAlign: 'right', fontFamily: 'inherit' }}
            />
          </div>

          <button onClick={() => setFiltersOpen(o => !o)} style={{ height: 48, padding: '0 16px', borderRadius: 12, background: filtersOpen ? 'var(--goldDim)' : 'var(--surface)', border: `1px solid ${filtersOpen ? 'var(--gold)' : 'var(--line2)'}`, color: filtersOpen ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            فیلترها
            {activeFilterCount > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: 'var(--gold)', color: '#16140f', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{toPersianDigits(activeFilterCount)}</span>}
          </button>

          {/* فاز ۹۳: دکمهٔ «نزدیکِ من» حذف شد — موقعیتِ تشخیصیِ کاربر نادقیق بود و جای غلط نشان می‌داد */}
          <NeighborhoodPicker value={hood} onChange={setHood} city={selectedCity} fallback={hoodOptions.map(o => o.h)} />
          <select aria-label="مرتب‌سازی" className="mjs-hide-sm" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ height: 48, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
            {SORT_OPTS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* نوارِ ساختاریافتهٔ همیشه‌جلوی‌چشم — حسِ ۲-کلیکیِ دیوار: نوعِ معامله + نوعِ ملک با یک کلیک،
            بدونِ بازکردنِ پنلِ فیلتر. روی موبایل به‌جای شکستن، افقی اسکرول می‌شود. */}
        <div className="mjs-quickbar" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 12px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', flexWrap: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {['خرید', 'اجاره', 'اجارهٔ روزانه', 'پیش‌فروش'].map(type => {
              const on = dealType === type || (type === 'اجاره' && dealType === 'رهن')
              return <button key={type} onClick={() => goDeal(type)} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'var(--goldDim)' : 'var(--surface)', color: on ? 'var(--goldText)' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{type}</button>
            })}
          </div>
          <span style={{ width: 1, height: 22, background: 'var(--line2)', flexShrink: 0, marginInline: 2 }} />
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => setKind('')} style={chipStyle(!kind)}>همهٔ املاک</button>
            {PROPERTY_KINDS.map(k => (
              <button key={k} onClick={() => setKind(kind === k ? '' : k)} style={chipStyle(kind === k)}>{k}</button>
            ))}
          </div>
        </div>

        {/* چیپ‌های تشخیص AI — فقط وقتی چیزی واقعاً از متن تشخیص داده شده */}
        {aiChips.length > 0 && (
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 4 }}>تشخیص هوشمند:</span>
            {aiChips.map(tag => (
              <span key={tag.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 999, background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.28)', fontSize: 12.5, color: 'var(--text)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{tag.label}:</span>
                <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* کشوی فیلترها — وقتی باز است داخلِ خودش اسکرول می‌شود (روی موبایل کوتاه‌تر از ارتفاعِ محتواست
            و قبلاً overflow:hidden محتوا را می‌بُرید و کاربر نمی‌توانست به فیلترهای پایین برسد). */}
        <div style={{ maxHeight: filtersOpen ? 'min(72vh, 560px)' : 0, overflowY: filtersOpen ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1)', borderTop: filtersOpen ? '1px solid var(--line)' : 'none', background: 'var(--surface)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* نوع معامله + نوع ملک */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <span style={lab}>نوع معامله:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['خرید', 'اجاره', 'رهن', 'اجارهٔ روزانه', 'پیش‌فروش'].map(type => (
                  <button key={type} onClick={() => goDeal(type)} style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${dealType === type ? 'var(--gold)' : 'var(--line2)'}`, background: dealType === type ? 'var(--goldDim)' : 'transparent', color: dealType === type ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>{type}</button>
                ))}
              </div>
              <span style={{ ...lab, marginInlineStart: 12 }}>نوع ملک:</span>
              <select aria-label="نوع ملک" value={kind} onChange={e => setKind(e.target.value)} style={{ height: 36, padding: '0 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                <option value="">همه</option>
                {PROPERTY_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            {/* قیمت + متراژ — دراپ‌داون (بدون تایپ) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>قیمت:</span>
                <select aria-label="حداقل قیمت" value={priceMin || ''} onChange={e => setPriceMin(+e.target.value || 0)} style={selInput}>
                  <option value="">از (حداقل)</option>
                  {PRICE_OPTS.map(v => <option key={v} value={v}>از {priceLabel(v)}</option>)}
                </select>
                <span style={{ color: 'var(--muted)' }}>تا</span>
                <select aria-label="حداکثر قیمت" value={priceMax < PRICE_MAX ? priceMax : ''} onChange={e => { const v = +e.target.value || 0; setPriceMax(v > 0 ? v : PRICE_MAX) }} style={selInput}>
                  <option value="">بدون سقف</option>
                  {PRICE_OPTS.map(v => <option key={v} value={v}>تا {priceLabel(v)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>متراژ:</span>
                <select aria-label="حداقل متراژ" value={areaMin || ''} onChange={e => setAreaMin(+e.target.value || 0)} style={selInput}>
                  <option value="">از (حداقل)</option>
                  {AREA_OPTS.map(v => <option key={v} value={v}>از {toPersianDigits(v)} متر</option>)}
                </select>
                <span style={{ color: 'var(--muted)' }}>تا</span>
                <select aria-label="حداکثر متراژ" value={areaMax || ''} onChange={e => setAreaMax(+e.target.value || 0)} style={selInput}>
                  <option value="">تا (حداکثر)</option>
                  {AREA_OPTS.map(v => <option key={v} value={v}>تا {toPersianDigits(v)} متر</option>)}
                </select>
              </div>
            </div>

            {/* خواب + طبقه + سال ساخت */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>تعداد خواب:</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['همه', '۱', '۲', '۳', '+۴'].map(b => (
                    <button key={b} onClick={() => setBeds(b)} style={{ width: 38, height: 36, borderRadius: 9, border: `1px solid ${beds === b ? 'var(--gold)' : 'var(--line2)'}`, background: beds === b ? 'var(--goldDim)' : 'transparent', color: beds === b ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit' }}>{b}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>حداقل طبقه:</span>
                <select aria-label="حداقل طبقه" value={floorMin || ''} onChange={e => setFloorMin(+e.target.value || 0)} style={selInput}>
                  <option value="">همه</option>
                  {FLOOR_OPTS.map(v => <option key={v} value={v}>طبقه {toPersianDigits(v)} به بالا</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>ساخت از سال:</span>
                <select aria-label="حداقل سال ساخت" value={yearMin || ''} onChange={e => setYearMin(+e.target.value || 0)} style={selInput}>
                  <option value="">همه</option>
                  {YEAR_OPTS.map(v => <option key={v} value={v}>{toPersianDigits(v)} به بعد</option>)}
                </select>
              </div>
            </div>

            {/* فاز ۳۳۷ب — آگهی‌دهنده (کیلید/دیوار) + نمایش (حذفِ توافقی/بی‌عکس) + مرتب‌سازی برای موبایل.
                مرتب‌سازیِ نوارِ بالا روی موبایل پنهان است (mjs-hide-sm) و تا امروز هیچ جایگزینی نداشت. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={lab}>آگهی‌دهنده:</span>
              {([['', 'همه'], ['personal', 'شخصی'], ['agency', 'املاک و مشاور']] as const).map(([v, l]) => (
                <button key={v || 'all'} type="button" onClick={() => setAdvertiser(v)} style={chip(advertiser === v)}>{l}</button>
              ))}
              <span style={{ ...lab, marginInlineStart: 8 }}>نمایش:</span>
              <button type="button" onClick={() => setPricedOnly(x => !x)} style={chip(pricedOnly)}>فقط قیمت‌دار (بدونِ توافقی)</button>
              <button type="button" onClick={() => setPhotoOnly(x => !x)} style={chip(photoOnly)}>فقط عکس‌دار</button>
              <label className="mjs-only-sm" style={{ alignItems: 'center', gap: 8 }}>
                <span style={lab}>مرتب‌سازی:</span>
                <select aria-label="مرتب‌سازی" value={sortBy} onChange={e => setSortBy(e.target.value)} style={selInput}>
                  {SORT_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>

            {/* امکانات */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={lab}>امکانات:</span>
              {AMENITY_FILTER.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 9, cursor: 'pointer', border: `1px solid ${checkedAmenities.includes(a) ? 'var(--gold)' : 'var(--line2)'}`, background: checkedAmenities.includes(a) ? 'var(--goldDim)' : 'transparent', color: checkedAmenities.includes(a) ? 'var(--gold)' : 'var(--muted)', fontSize: 13, fontWeight: 500, userSelect: 'none' }}>
                  <input type="checkbox" checked={checkedAmenities.includes(a)} onChange={() => toggleAmenity(a)} style={{ accentColor: 'var(--gold)', cursor: 'pointer' }} />
                  {a}
                </label>
              ))}
              {activeFilterCount > 0 && <button onClick={resetFilters} style={{ marginInlineStart: 'auto', padding: '6px 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردن فیلترها</button>}
            </div>
          </div>
        </div>
      </div>

      {/* محتوای اصلی */}
      <main className="mjs-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'start', minHeight: 'calc(100vh - 200px)' }}>
        <div style={{ paddingTop: 20, paddingLeft: 12 }}>
          {/* روی موبایل نقشه پیش‌فرض نشان داده نمی‌شود (فضای آگهی‌ها را نمی‌گیرد)؛ با دکمهٔ
              شناورِ «نقشه» به‌صورتِ تمام‌صفحه باز می‌شود — مثلِ دیوار. */}
          {/* «آگهی جدید اومد خبرم کن» */}
          {poly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginBottom: 12, borderRadius: 12, border: '1px solid var(--gold)', background: 'var(--goldDim)', fontSize: 12.5, fontWeight: 700 }}>
              <IconSvg name="ruler" size={15} color="var(--gold)" />
              <span style={{ flex: 1 }}>فقط آگهی‌های داخلِ محدوده‌ای که روی نقشه کشیدی{polyIds ? ` — ${toPersianDigits(polyIds.size)} مورد` : '…'}</span>
              <button onClick={() => setPoly(null)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ حذفِ محدوده</button>
            </div>
          )}
          <NotifyBar qs={mapQuery} count={shownProperties.length} criteria={{ city: selectedCity, area: mapArea || prefArea, deal: (dealType === 'پیش‌فروش' ? 'presale' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'), kind: kind || parsed.kind || '', priceMax: priceMax < PRICE_MAX ? priceMax : (parsed.budgetMax || 0) }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}><span style={{ color: 'var(--goldText)', fontWeight: 800, fontSize: 16 }}>{toPersianDigits(shownProperties.length)}</span>{poolTotal > properties.length ? <> از <span style={{ fontWeight: 700 }}>{toPersianDigits(poolTotal)}</span></> : null} ملک پیدا شد{selectedCity ? <span style={{ color: 'var(--muted)' }}> · {selectedCity}</span> : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>مرتب‌سازی: <span style={{ color: 'var(--text)' }}>{sortBy}</span></div>
          </div>

          {(loading || shownProperties.length === 0) && (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14, lineHeight: 1.9 }}>
              {loading ? 'در حال بارگذاری آگهی‌ها…'
                // استخرِ «خالی» با شهرِ انتخابی یعنی همین شهر آگهی ندارد (نه این‌که سایت خالی است) — پیامِ عمومی
                // اینجا گمراه‌کننده بود (باگِ «شهر تهران»: کلِ سایت خالی به‌نظر می‌رسید).
                : properties.length === 0 && selectedCity ? `هنوز آگهی${dealType === 'اجاره' ? 'ِ اجاره‌ای' : dealType === 'رهن' ? 'ِ رهنی' : dealType === 'پیش‌فروش' ? 'ِ پیش‌فروشی' : 'ِ فروشی'} در «${selectedCity}» ثبت نشده است. از دکمهٔ شهر (بالای صفحه) شهرِ دیگری انتخاب کنید.`
                  : properties.length === 0 ? 'هنوز آگهی‌ای ثبت نشده.'
                    : `هیچ آگهی${dealType === 'اجاره' ? 'ِ اجاره‌ای' : dealType === 'رهن' ? 'ِ رهنی' : dealType === 'پیش‌فروش' ? 'ِ پیش‌فروشی' : 'ِ فروشی'}${selectedCity ? ` در «${selectedCity}»` : ''} با این فیلترها پیدا نشد.`}
            </div>
          )}

          <div className="mjs-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {shownProperties.slice(0, visN).map((p, index) => {
              const isHov = hoveredCard === p.id
              const isPromoted = promotedIdSet.has(p.id)
              // فاز ۲۸۴ — کاربر این آگهی را قبلاً باز کرده؟ (روی آگهیِ فروخته/اجاره‌رفته نشان نمی‌دهیم)
              const isSeenCard = !p.dealStatus && !!seenSet?.has(String(p.id))
              const cards = []
              if (index === 3) cards.push(<div key="promo" style={{ gridColumn: '1 / -1' }}><BannerSlot placement="search" /></div>)
              cards.push(
                <div key={p.id} onMouseEnter={() => setHoveredCard(p.id)} onMouseLeave={() => setHoveredCard(null)} style={{ borderRadius: 14, border: `1px solid ${isHov ? 'var(--gold)' : 'var(--line)'}`, background: 'var(--surface)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s', transform: isHov ? 'translateY(-4px)' : 'none', boxShadow: isHov ? '0 12px 40px -12px rgba(201,168,76,0.22)' : '0 2px 10px -4px rgba(0,0,0,0.3)' }}>
                  <Link href={listingHref(p.id, p.title, p.location)} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ height: 156, background: p.img, position: 'relative', overflow: 'hidden', filter: p.dealStatus ? 'grayscale(0.55) brightness(0.7)' : 'none' }}>
                      {p.image && <CardImg src={p.image} alt={p.title} eager={index < 4} priority={index < 2 ? 'high' : 'low'} />}
                      <PhotoFade />
                      {/* فاز ۲۰۸ (فیدبک: «آگهی‌ها معلوم نیست برای کی هست») — سنِ آگهی از مهرِ واقعیِ ثبت */}
                      {p.scrapedAt > 0 && (
                        <span suppressHydrationWarning style={{ position: 'absolute', bottom: 9, insetInlineStart: 10, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3.5px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1px', ...(isFreshListing(p.scrapedAt) ? { background: 'linear-gradient(140deg,var(--gold2,#e8cf7a),var(--gold))', color: '#16140f', boxShadow: '0 2px 10px -2px rgba(201,168,76,0.55)' } : { background: 'rgba(10,9,8,0.72)', color: '#f0ede6', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }) }}>
                          <IconSvg name={isFreshListing(p.scrapedAt) ? 'bolt' : 'clock'} size={11} />
                          {isFreshListing(p.scrapedAt) ? `جدید · ${listingAgeLabel(p.scrapedAt)}` : listingAgeLabel(p.scrapedAt)}
                        </span>
                      )}
                      {!p.dealStatus && <LikeHeart listingId={p.id} />}
                      {/* فاز ۲۸۴ — نشانِ ظریفِ «دیده‌اید»: گوشهٔ پایین-چپِ فیزیکی (insetInlineEnd در RTL) —
                          پایین-راست مالِ چیپِ سنِ آگهی است و بالا مالِ لایک/پرومو */}
                      {isSeenCard && (
                        <span title="این آگهی را دیده‌اید" style={{ position: 'absolute', bottom: 9, insetInlineEnd: 10, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3.5px 9px', borderRadius: 999, background: 'rgba(20,18,14,0.72)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10.5, fontWeight: 700, border: '1px solid rgba(255,255,255,0.16)' }}>
                          <IconSvg name="eye" size={11} /> دیده‌اید
                        </span>
                      )}
                      {isPromoted && !p.dealStatus && <div style={{ position: 'absolute', top: 10, left: 44 }}><PromoBadge kind={p.promoKind || 'ویژه'} /></div>}
                      {p.dealStatus && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ transform: 'rotate(-13deg)', background: p.dealStatus === 'sold' ? 'rgba(231,74,74,0.92)' : 'rgba(74,144,231,0.92)', color: '#fff', fontWeight: 900, fontSize: 17, padding: '7px 20px', borderRadius: 10, border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 6px 22px -6px rgba(0,0,0,0.6)', letterSpacing: '0.5px' }}>
                            {p.dealStatus === 'sold' ? 'فروخته شد' : 'اجاره رفت'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '13px 14px 15px' }}>
                      {/* فاز ۲۸۴ — عنوانِ آگهیِ دیده‌شده کمی کدرتر تا در مرور، تازه‌ها زودتر به چشم بیایند */}
                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: isSeenCard ? 0.72 : 1 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" strokeWidth="1.2" /><circle cx="6" cy="4.5" r="1.2" fill="currentColor" /></svg>
                        {p.location}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--goldText)', marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span>{p.price}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginRight: 4 }}>تومان</span></span>
                        {/* فاز ۳۳۷ب — قیمتِ هر متر (مثلِ Zillow/کیلید) — فقط فروش، فقط با قیمت و متراژِ واقعی */}
                        {p.deal === 'sale' && p.priceNum > 0 && p.areaNum > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>· متری {perMeterLabel(p.priceNum, p.areaNum)}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>
                        <span>{p.size} م²</span><span aria-hidden="true" style={{ color: 'var(--muted)' }}>·</span>
                        <span>{p.beds} خواب</span><span aria-hidden="true" style={{ color: 'var(--muted)' }}>·</span>
                        <span>ساخت {p.year}</span>
                        <div style={{ flex: 1 }} />
                        <CompareButton entry={{ kind: 'item', id: String(p.id), title: p.title, photo: p.image, subtitle: p.location }} />
                        <span style={{ color: 'var(--gold)', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>مشاهده <IconSvg name="arrowLeft" size={12} /></span>
                      </div>
                    </div>
                  </Link>
                </div>
              )
              return cards
            })}
          </div>
          {/* فاز ۹۲: نگهبانِ اسکرول — ۲۴ کارتِ بعدی خودکار می‌آید؛ تصویر/JS فقط به‌اندازهٔ دیده‌شده مصرف می‌شود */}
          {visN < shownProperties.length && (
            <div ref={moreRefCb} style={{ textAlign: 'center', padding: '18px 0', fontSize: 12.5, color: 'var(--muted)' }}>
              <button onClick={() => setVisN(n => n + 48)} style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 10, padding: '9px 22px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                نمایشِ آگهی‌های بیشتر ({(shownProperties.length - visN).toLocaleString('fa-IR')})
              </button>
            </div>
          )}
        </div>

        {/* نقشهٔ واقعیِ نشان — فقط دسکتاپ (کنارِ نتایج، چسبان) */}
        <div className="map-panel mjs-map" style={{ position: 'sticky', top: 88, height: 'calc(100vh - 108px)', paddingTop: 20, paddingRight: 12 }}>
          <style>{`@media (max-width: 768px) { .map-panel { display: none !important; } }`}</style>
          <SearchMap view={mapView} query={mapQuery} city={mapArea || selectedCity || userArea} cityKey={selectedCity} poly={poly} onPoly={setPoly} />
        </div>
      </main>

      {/* موبایل: دکمهٔ شناورِ «نقشه» (فقط وقتی نقشه بسته است) */}
      {!mapOpenMobile && (
        <button className="mjs-mapbtn" onClick={() => setMapOpenMobile(true)}
          // وسطِ پایین (الگوی دیوار/زیلو) — قبلاً پایین‌چپ زیرِ دکمهٔ ✦ دستیار می‌رفت و دو دکمه روی هم دیده می‌شد.
          style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'none', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', boxShadow: '0 8px 24px -6px rgba(0,0,0,.55)', cursor: 'pointer' }}>
          <IconSvg name="map" size={15} /> نقشه
        </button>
      )}
      {/* موبایل: نقشهٔ تمام‌صفحه وقتی باز است */}
      {mapOpenMobile && (
        <div className="mjs-mapfull" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg)', display: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, padding: 8 }}>
            <SearchMap view={mapView} query={mapQuery} city={mapArea || selectedCity || userArea} cityKey={selectedCity} poly={poly} onPoly={setPoly} />
          </div>
          <button onClick={() => setMapOpenMobile(false)}
            style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 999, border: 'none', background: '#e7674a', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 24px -6px rgba(0,0,0,.6)', cursor: 'pointer' }}>
            <IconSvg name="close" size={15} /> بستن نقشه
          </button>
        </div>
      )}
    </div>
  )
}

// «آگهی جدید اومد خبرم کن» — ذخیرهٔ جستجو + خبرِ آگهیِ جدید در گفتگوها و پیامک
type Criteria = { city: string; area: string; deal: 'sale' | 'rent' | 'presale'; kind: string; priceMax: number }
// فاز د — هشدار حالا «کلِ» جستجوی جاری را ذخیره می‌کند (qs = همان mapQuery: همهٔ فیلترها + محله + محدودهٔ نقشه)،
// نه فقط شهر/محله/نوع/سقفِ قیمت. امضا با سرور یکی است (canonSpecQs) تا وضعیتِ روشن/خاموش درست خوانده شود.
function NotifyBar({ count, criteria, qs }: { count: number; criteria: Criteria; qs: string }) {
  const sig = 'q:' + canonSpecQs(new URLSearchParams(qs))
  const label = specLabel(new URLSearchParams(qs))
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // ۸ اکتبر — پیشترها «موفق بودن» از نویسهٔ ✓ ابتدای پیام خوانده می‌شد؛ حالا خودِ state می‌گویدش.
  const [msgOk, setMsgOk] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/saved-search').then(r => r.ok ? r.json() : null).then(d => { if (alive && d?.searches) setOn(d.searches.some((s: any) => s.sig === sig)) }).catch(() => {})
    return () => { alive = false }
  }, [sig])
  const toggle = async () => {
    if (busy) return
    setBusy(true); setMsg(''); setMsgOk(false)
    const next = !on
    try {
      const r = await fetch('/api/saved-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: next ? 'add' : 'remove', qs, city: criteria.city, area: criteria.area, deal: criteria.deal, kind: criteria.kind, priceMax: criteria.priceMax }) })
      const d = await r.json()
      if (r.status === 401) { setMsg('برای فعال‌کردنِ هشدار وارد شوید…'); openAuth('برای دریافتِ هشدارِ آگهیِ جدید وارد شوید'); return }
      if (d.ok) {
        setOn(next)
        if (next) { import('@/app/lib/push-client').then(m => m.ensurePushSubscribed(true)).catch(() => {}) }
        setMsgOk(next)
        setMsg(next ? 'از این پس آگهیِ جدید را با نوتیفیکیشن، گفتگو و پیامک خبر می‌دهیم.' : 'هشدار خاموش شد.')
      }
      else setMsg(d.error || 'خطا')
    } catch { setMsg('خطا در ارتباط') } finally { setBusy(false) }
  }
  return (
    <div className="mjs-notify" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '11px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconSvg name="bell" size={18} color="var(--gold)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>آگهی جدید اومد خبرم کن</div>
          <div className="mjs-notify-desc" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label} — {count > 0 ? `${count.toLocaleString('fa-IR')} ملکِ فعلی؛ ` : ''}آگهیِ جدیدِ مطابق را با نوتیفیکیشن، گفتگو و پیامک خبر می‌دهیم.</div>
        </div>
        <button onClick={toggle} disabled={busy} aria-label="اعلانِ آگهیِ جدید" style={{ position: 'relative', width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'var(--line2)', transition: 'background .2s', flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
          <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
        </button>
      </div>
      {msg && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: msgOk ? '#5fd98a' : 'var(--goldText)' }}>{msgOk && <IconSvg name="check" size={12} />}{msg}</div>}
    </div>
  )
}

// تبدیلِ مختصات ↔ پیکسلِ Web-Mercator (هم‌راستا با نقشهٔ استاتیکِ نشان)
function project(lat: number, lng: number, zoom: number) {
  const s = 256 * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * s
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s
  return { x, y }
}
function unproject(x: number, y: number, zoom: number) {
  const s = 256 * Math.pow(2, zoom)
  const lng = (x / s) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / s
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng }
}
// فاز ۲۰۴: کفِ زوم ۹ تا نمای «کلِ شهر» (زوم ۱۰ از سرور) دست‌یافتنی و قابلِ عقب‌رفتن باشد
const clampZoom = (z: number) => Math.max(9, Math.min(18, z))

// نقشهٔ تعاملیِ نشان (زوم + جابه‌جایی) با پین‌های قیمتِ آگهی‌ها — مثلِ دیوار
type MapView = { center: { lat: number; lng: number }; zoom: number } | null
type MapData = { clusters: { lat: number; lng: number; count: number }[]; singles: { id: string; lat: number; lng: number; deal: string; priceNum: number }[]; total: number }
function SearchMap({ view, query, city, cityKey, poly, onPoly }: { view: MapView; query: string; city: string; cityKey: string; poly: LatLng[] | null; onPoly: (p: LatLng[] | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // فاز د — حالتِ «کشیدنِ محدوده»: درگ به‌جای جابه‌جاییِ نقشه، مسیر می‌کشد؛ رها کردن = بستنِ چندضلعی.
  const [drawing, setDrawing] = useState(false)
  const [path, setPath] = useState<{ x: number; y: number }[]>([])
  const pathRef = useRef<{ x: number; y: number }[] | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [iv, setIv] = useState<MapView>(view)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [err, setErr] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    const el = ref.current; if (!el) return
    // فاز ۱۷۹: مقیاسِ متناسب — تصویرِ ≤۱۰۰۰px با «همان نسبتِ» قاب گرفته می‌شود؛ کششِ یکنواخت = پینِ دقیق.
    // قبلاً هر بُعد جدا سقف/گرد می‌شد → نسبت به‌هم می‌خورد و پین‌ها از جای واقعی می‌لغزیدند («توی کوه و بیابان»).
    const measure = () => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return; const sc = Math.min(1, 1000 / r.width, 1000 / r.height); setSize({ w: Math.max(100, Math.round(r.width * sc)), h: Math.max(100, Math.round(r.height * sc)) }) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // با تغییرِ جستجو/شهر، نمای داخلی را به نمای جدید برگردان
  // فاز ۱۷۹: بعد از اولین تعاملِ کاربر، بازنشانیِ خودکارِ نما (از تغییرِ فیلترها) دیگر نقشه را نمی‌پراند
  const touched = useRef(false)
  // فاز ۲۴۷ («رو تهران هستم نقشه دری‌وری نشون میده»): نمای «سرورِ خوشه‌ها» (گسترهٔ آگهی‌های واقعی)
  // همیشه بر geocodeِ کلاینت مقدم است — geocode دیرتر می‌رسید و نمای درست را با نقطهٔ غلطِ
  // «نیلوفر تهران»→کرج بازنویسی می‌کرد. geocode فقط fallbackِ «سرور هیچ نقطه‌ای نداشت» است.
  const serverView = useRef(false)
  useEffect(() => { if (view && !touched.current && !serverView.current) setIv(view) }, [view?.center.lat, view?.center.lng, view?.zoom])
  useEffect(() => { touched.current = false; serverView.current = false }, [cityKey])   // فقط «شهرِ واقعاً انتخابی» نما را آزاد می‌کند — نه مشتقِ فیلترها
  useEffect(() => { setErr(false) }, [iv?.center.lat, iv?.center.lng, iv?.zoom, size.w, size.h])

  const ready = iv && size.w > 0 && size.h > 0
  // فاز ۲۳۸ — زمینه دیگر تصویرِ staticmap نیست، کاشی‌به‌کاشی از پروکسیِ خودِ سایت است (TileBase):
  // کاشی و پین هر دو از «همان iv» محاسبه می‌شوند → به‌طورِ ساختاری اتمیک‌اند (نگهبانیِ فاز ۱۷۹ لازم نیست).

  // فاز ۲۰۴ — دادهٔ نقشه از سرور: خوشه‌ها/پین‌های «همین قاب با همین زوم و فیلترها» (روی کلِ استخر).
  const [data, setData] = useState<MapData | null>(null)
  // بارِ اول / تغییرِ فیلترها: بدونِ bbox → سرور قابِ پیشنهادی (کلِ گسترهٔ نتیجه‌ها = کلِ شهر) را هم می‌دهد
  useEffect(() => {
    let alive = true
    fetch(`/api/map/clusters?${query}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!alive || !d?.ok) return
      if (d.view) { serverView.current = true; if (!touched.current) setIv(d.view) }
      setData({ clusters: d.clusters || [], singles: d.singles || [], total: d.total || 0 })
    }).catch(() => {})
    return () => { alive = false }
  }, [query])
  // جابه‌جایی/زوم: قابِ فعلی (با ۲۵٪ حاشیه) را بپرس — debounced تا هر درگ یک درخواست نشود
  const lastReq204 = useRef('')
  useEffect(() => {
    if (!iv || !size.w || !size.h) return
    const t = setTimeout(() => {
      const pc = project(iv.center.lat, iv.center.lng, iv.zoom)
      const a = unproject(pc.x - size.w * 0.75, pc.y - size.h * 0.75, iv.zoom)
      const b = unproject(pc.x + size.w * 0.75, pc.y + size.h * 0.75, iv.zoom)
      const bbox = `${Math.min(a.lat, b.lat).toFixed(5)},${Math.min(a.lng, b.lng).toFixed(5)},${Math.max(a.lat, b.lat).toFixed(5)},${Math.max(a.lng, b.lng).toFixed(5)}`
      const url = `/api/map/clusters?${query}&bbox=${bbox}&zoom=${Math.round(iv.zoom)}`
      if (lastReq204.current === url) return
      lastReq204.current = url
      fetch(url).then(r => r.ok ? r.json() : null).then(d => {
        if (d?.ok) setData({ clusters: d.clusters || [], singles: d.singles || [], total: d.total || 0 })
      }).catch(() => {})
    }, 350)
    return () => clearTimeout(t)
  }, [iv?.center.lat, iv?.center.lng, iv?.zoom, size.w, size.h, query])

  // تصویرکردنِ دادهٔ سرور روی قابِ نمایش (کاشی و پین هر دو از همان iv — اتمیک)
  const clusters = useMemo(() => {
    const pv = iv
    if (!pv || !ready || err || !data) return [] as { x: number; y: number; count: number; id: string; label: string; lat: number; lng: number }[]
    const pc = project(pv.center.lat, pv.center.lng, pv.zoom)
    const xy = (lat: number, lng: number) => { const pp = project(lat, lng, pv.zoom); return { x: size.w / 2 + (pp.x - pc.x), y: size.h / 2 + (pp.y - pc.y) } }
    const inFrame = (p: { x: number; y: number }) => p.x >= 0 && p.x <= size.w && p.y >= 6 && p.y <= size.h - 6
    const out: { x: number; y: number; count: number; id: string; label: string; lat: number; lng: number }[] = []
    for (const c of data.clusters) {
      const p = xy(c.lat, c.lng)
      if (inFrame(p)) out.push({ ...p, count: c.count, id: `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`, label: '', lat: c.lat, lng: c.lng })
    }
    const singles: typeof out = []
    for (const s of data.singles) {
      const p = xy(s.lat, s.lng)
      if (inFrame(p)) singles.push({ ...p, count: 1, id: s.id, label: pinPrice(s.deal, s.priceNum), lat: s.lat, lng: s.lng })
    }
    // پین‌های تکی را برای نیفتادن روی هم کمی جدا کن (declutter عمودی).
    const PW = 62, PH = 26
    for (let i = 0; i < singles.length; i++) {
      const p = singles[i]
      let y = p.y, t = 0
      while (t < 8 && singles.some((q, j) => j < i && Math.abs(q.x - p.x) < PW && Math.abs(q.y - y) < PH)) { y += PH; t++ }
      p.y = Math.min(y, size.h - 6)
    }
    return [...out, ...singles]
  }, [data, iv, size, err, ready])
  const zoomToCluster = (lat: number, lng: number) => { touched.current = true; setIv(v => v ? { center: { lat, lng }, zoom: clampZoom(v.zoom + 2) } : v) }

  const pt = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : (e as React.MouseEvent)
    return { x: t.clientX, y: t.clientY }
  }
  // مختصاتِ صفحه → فضای `size` (نقشه با همان نسبت کوچک شده) → lat/lng
  const toSize = (p: { x: number; y: number }) => { const r = ref.current!.getBoundingClientRect(); return { x: ((p.x - r.left) / r.width) * size.w, y: ((p.y - r.top) / r.height) * size.h } }
  const sizeToLL = (q: { x: number; y: number }) => { const pc = project(iv!.center.lat, iv!.center.lng, iv!.zoom); return unproject(pc.x + q.x - size.w / 2, pc.y + q.y - size.h / 2, iv!.zoom) }
  const finishDraw = () => {
    const pts = pathRef.current || []; pathRef.current = null
    if (pts.length >= 6 && iv) { touched.current = true; onPoly(pts.map(sizeToLL)) }
    setPath([]); setDrawing(false)
  }
  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (drawing && iv && size.w) { const q = toSize(pt(e)); pathRef.current = [q]; setPath([q]); return }
    const p = pt(e); drag.current = { x: p.x, y: p.y, moved: false }; movedRef.current = false; setActive(null)
  }
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (pathRef.current) {
      const q = toSize(pt(e)), last = pathRef.current[pathRef.current.length - 1]
      if (Math.hypot(q.x - last.x, q.y - last.y) > 4) { pathRef.current = [...pathRef.current, q]; setPath(pathRef.current) }
      return
    }
    if (!drag.current) return
    const p = pt(e); const dx = p.x - drag.current.x, dy = p.y - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 3) { drag.current.moved = true; movedRef.current = true }
    setOff({ x: dx, y: dy })
  }
  const onUp = () => {
    if (pathRef.current) { finishDraw(); return }
    if (!drag.current || !iv) { drag.current = null; setOff({ x: 0, y: 0 }); return }
    const { moved } = drag.current
    const o = off; drag.current = null
    if (!moved) { setOff({ x: 0, y: 0 }); return }
    const pc = project(iv.center.lat, iv.center.lng, iv.zoom)
    const nc = unproject(pc.x - o.x, pc.y - o.y, iv.zoom)
    touched.current = true
    setIv({ center: nc, zoom: iv.zoom }); setOff({ x: 0, y: 0 })
  }
  const zoomBy = (d: number) => { touched.current = true; setIv(v => v ? { center: v.center, zoom: clampZoom(v.zoom + d) } : v) }
  const polyXY = useMemo(() => {
    if (!poly || !iv || !size.w) return ''
    const pc = project(iv.center.lat, iv.center.lng, iv.zoom)
    return poly.map(q => { const pp = project(q.lat, q.lng, iv.zoom); return `${(size.w / 2 + pp.x - pc.x).toFixed(1)},${(size.h / 2 + pp.y - pc.y).toFixed(1)}` }).join(' ')
  }, [poly, iv, size])

  return (
    <div ref={ref} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)', cursor: drawing ? 'crosshair' : drag.current ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${off.x}px,${off.y}px)` }}>
        {ready && !err ? (
          <TileBase lat={iv!.center.lat} lng={iv!.center.lng} zoom={iv!.zoom} w={size.w} h={size.h} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24, lineHeight: 1.9 }}>
            {err ? 'نقشه در دسترس نیست — «سامانهٔ نقشه» در ادمین → اتصال‌ها را بررسی کن.' : 'برای نمایشِ نقشه، موقعیتِ شما یا مختصاتِ آگهی‌ها لازم است.'}
          </div>
        )}
        {/* محدودهٔ رسم‌شده (و مسیرِ در حالِ کشیدن) — هم‌مختصاتِ پین‌ها، پس با جابه‌جاییِ نقشه همراه است */}
        {ready && (polyXY || path.length > 1) && (
          <svg viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8 }}>
            {polyXY && !path.length && <polygon points={polyXY} fill="rgba(217,173,62,.16)" stroke="#D9AD3E" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {path.length > 1 && <polyline points={path.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')} fill="rgba(217,173,62,.10)" stroke="#D9AD3E" strokeWidth={3} strokeDasharray="7 5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          </svg>
        )}
        {/* حباب‌های شمارش (خوشه) و پین‌های قیمت */}
        {clusters.map(p => {
          const left = `${(p.x / size.w) * 100}%`, top = `${(p.y / size.h) * 100}%`
          if (p.count > 1) {
            // حبابِ شمارشِ منطقه — مثلِ دیوار. کلیک → زوم به همان خوشه.
            const d = Math.min(64, 34 + String(p.count).length * 7)
            return (
              <button key={`c${p.id}`} onClick={e => { if (movedRef.current) { e.preventDefault(); return } zoomToCluster(p.lat, p.lng) }}
                style={{ position: 'absolute', left, top, transform: 'translate(-50%,-50%)', width: d, height: d, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(231,103,74,.98), rgba(198,74,52,.98))', border: '2.5px solid rgba(255,255,255,.85)', color: '#fff', fontSize: p.count > 999 ? 11 : 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 14px -3px rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12, fontFamily: 'inherit' }}
                title={`${toPersianDigits(p.count)} آگهی — برای دیدن، بزرگ‌نمایی کنید`}>
                {toPersianDigits(p.count)}
              </button>
            )
          }
          const on = active === p.id
          return (
            <a key={p.id} href={listingHref(p.id, p.label)} onClick={e => { if (movedRef.current) e.preventDefault() }} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
              style={{ position: 'absolute', left, top, transform: `translate(-50%,-50%) scale(${on ? 1.12 : 1})`, padding: '4px 9px', borderRadius: 14, background: on ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'rgba(10,9,8,0.92)', border: `1.5px solid ${on ? 'var(--gold2)' : 'var(--gold)'}`, color: on ? '#16140f' : '#f0ede6', fontSize: 11, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 2px 10px -3px rgba(0,0,0,.7)', zIndex: on ? 20 : 10, fontFamily: 'inherit' }}>
              {p.label}
            </a>
          )
        })}
      </div>

      {/* فاز د — کشیدنِ محدوده */}
      {ready && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 30, whiteSpace: 'nowrap' }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          {drawing ? (
            <>
              <span style={{ padding: '9px 14px', borderRadius: 999, background: 'rgba(10,9,8,0.88)', color: '#f0ede6', fontSize: 12.5, fontWeight: 700, border: '1px solid var(--gold)' }}>دورِ منطقهٔ دلخواه را بکش و رها کن</span>
              <button onClick={() => { pathRef.current = null; setPath([]); setDrawing(false) }} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'rgba(10,9,8,0.88)', color: '#f0ede6', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>لغو</button>
            </>
          ) : (
            <>
              <button onClick={() => setDrawing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 999, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px -6px rgba(0,0,0,.6)' }}>
                <IconSvg name="ruler" size={15} /> {poly ? 'کشیدنِ دوباره' : 'کشیدنِ محدوده'}
              </button>
              {poly && <button onClick={() => onPoly(null)} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid var(--line2)', background: 'rgba(10,9,8,0.88)', color: '#f0ede6', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕ حذفِ محدوده</button>}
            </>
          )}
        </div>
      )}
      {/* کنترلِ زوم */}
      <div style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6, zIndex: 30 }}>
        {[['+', 1], ['−', -1]].map(([s, d]) => (
          <button key={s as string} onClick={() => zoomBy(d as number)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line2)', background: 'rgba(10,9,8,0.85)', color: '#f0ede6', fontSize: 20, fontWeight: 700, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s}</button>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)', borderRadius: 9, padding: '6px 12px', fontSize: 12, color: '#f0ede6', border: '1px solid rgba(255,255,255,.12)', pointerEvents: 'none', zIndex: 30 }}>
        {data && data.total > 0 ? `${data.total.toLocaleString('fa-IR')} ملک روی نقشه` : (city ? `نقشهٔ ${city}` : 'نقشهٔ منطقه')}
      </div>
    </div>
  )
}
