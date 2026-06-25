'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Nav from '@/app/components/Nav'
import BannerSlot from '@/app/components/BannerSlot'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'
import { readLoc } from '@/app/components/LocationDetector'
import { readCity } from '@/app/components/CitySelector'
import { PROPERTY_KINDS } from '@/app/lib/taxonomy'

function seedNum(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const FA_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}
function faToEn(s: string): string { return (s || '').replace(/[۰-۹٠-٩]/g, d => FA_DIGITS[d] ?? d) }
function toPersianDigits(n: number | string): string { return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) }
function faNum(n: number): string { return (Number(n) || 0).toLocaleString('fa-IR') }

function firstInt(s?: string): number | null { const m = faToEn(s || '').match(/(\d{1,4})/); return m ? parseInt(m[1], 10) : null }

// همهٔ امکاناتِ قابلِ تشخیص (برای فیلتر + تشخیصِ متن)
const AMENITY_ALL = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'مبله', 'روف گاردن', 'استخر', 'سونا', 'جکوزی', 'لابی', 'سند تک‌برگ', 'بازسازی', 'نوساز']
const AMENITY_FILTER = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'مبله', 'روف گاردن', 'استخر', 'لابی', 'نوساز']
const PRICE_MAX = 500 // «بدون سقف»
// گزینه‌های آمادهٔ فیلتر (دراپ‌داون — کاربر تایپ نمی‌کند)
const PRICE_OPTS = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 200, 300]
const AREA_OPTS = [40, 50, 60, 75, 90, 100, 120, 150, 180, 200, 250, 300, 400, 500]
const FLOOR_OPTS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20]
const YEAR_OPTS = Array.from({ length: 30 }, (_, i) => 1404 - i) // ۱۴۰۴ تا ۱۳۷۵
const priceLabel = (n: number) => n < 1 ? `${(n * 1000).toLocaleString('fa-IR')} میلیون` : `${n.toLocaleString('fa-IR')} میلیارد`
// کشِ سمتِ کلاینتِ مختصاتِ هر شهر/محله — تا نقشهٔ هر شهر فقط یک‌بار geocode شود
const GEO_CACHE = new Map<string, { lat: number; lng: number }>()

// واحدِ ملک (آپارتمان/ویلا/…) را از متن تشخیص می‌دهد
function detectKind(text: string): string {
  for (const k of PROPERTY_KINDS) {
    for (const seg of k.split('/')) { if (seg && text.includes(seg)) return k }
  }
  return ''
}

function toProperty(it: ContentItem) {
  const h = seedNum(it.id)
  const enTitle = faToEn(it.title)
  const rawPrice = parseFloat(faToEn(it.price || '').replace(/[^\d.]/g, '')) || 0
  const ptxt = it.price || ''
  const priceNum = /میلیارد/.test(ptxt) ? rawPrice : /میلیون/.test(ptxt) ? rawPrice / 1000 : rawPrice / 1e9
  const bedsNum = (() => { const m = faToEn(`${it.title} ${it.excerpt || ''} ${it.meta?.['اتاق خواب'] || ''}`).match(/(\d+)\s*خواب/); return m ? parseInt(m[1], 10) : null })()
  const searchText = [it.title, it.location, it.excerpt, it.category, ...(it.tags || [])].filter(Boolean).join(' ').toLowerCase()
  const dealTxt = `${it.price || ''} ${it.title || ''} ${it.category || ''} ${it.meta?.['نوع معامله'] || ''} ${(it.tags || []).join(' ')}`
  const deal: 'sale' | 'rent' | 'presale' =
    /پیش[‌\s]?فروش/.test(dealTxt) ? 'presale'
      : (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(dealTxt)) ? 'rent'
        : 'sale'
  const areaNum = firstInt(it.meta?.['متراژ']) ?? (enTitle.match(/(\d+)\s*متر/) ? parseInt(enTitle.match(/(\d+)\s*متر/)![1], 10) : 0)
  const floorNum = firstInt(it.meta?.['طبقه'])
  const yearNum = (() => { const y = firstInt(it.meta?.['سال ساخت']) ?? firstInt(it.meta?.['ساخت']); return y && y > 50 ? y : 0 })()
  const kind = detectKind(`${it.title} ${it.category || ''} ${it.meta?.['نوع ملک'] || ''}`)
  const lat = Number(it.meta?.['__lat']) || undefined
  const lng = Number(it.meta?.['__lng']) || undefined
  return {
    id: it.id, deal, title: it.title, location: it.location || 'نامشخص',
    price: it.price || '—', priceNum,
    beds: bedsNum != null ? toPersianDigits(bedsNum) : '—', bedsNum,
    size: areaNum ? toPersianDigits(areaNum) : '—', areaNum,
    floorNum, yearNum, kind, lat, lng,
    year: yearNum ? toPersianDigits(yearNum) : '—',
    tag: '', score: 80 + (h % 19),
    img: it.image ? '' : gradientFor(it.title), image: it.image, url: it.url,
    category: it.category || '', searchText,
  }
}
type PropertyT = ReturnType<typeof toProperty>

// ─── تشخیصِ واقعیِ پارامترها از متنِ جستجو (نه فیک) ───────────────────────────
interface Parsed { kind: string; area: string; sizeNum: number; budgetMax: number; beds: number | null; amenities: string[]; deal: string; tokens: string[] }
const STOP = new Set(['در', 'با', 'و', 'زیر', 'تا', 'حدود', 'حداکثر', 'سقف', 'متری', 'متر', 'میلیارد', 'میلیون', 'تومان', 'خواب', 'خوابه', 'نزدیک', 'حوالی', 'منطقه', 'محله', 'یک', 'دو', 'سه', 'چهار', 'برای', 'فروش', 'اجاره', 'رهن', 'پیش‌فروش', 'پیش'])
function parseQuery(raw: string): Parsed {
  const t = faToEn(raw)
  const out: Parsed = { kind: '', area: '', sizeNum: 0, budgetMax: 0, beds: null, amenities: [], deal: '', tokens: [] }
  if (!raw.trim()) return out
  if (/پیش[‌\s]?فروش/.test(raw)) out.deal = 'presale'
  else if (/اجاره|رهن|ودیعه/.test(raw)) out.deal = 'rent'
  out.kind = detectKind(raw)
  const sm = t.match(/(\d{2,4})\s*متر/); if (sm) out.sizeNum = parseInt(sm[1], 10)
  const bm = t.match(/(\d+)\s*خواب/); if (bm) out.beds = parseInt(bm[1], 10)
  const bg = t.match(/(?:زیر|تا|حداکثر|سقف)\s*([\d.]+)\s*(میلیارد|میلیون)?/)
  if (bg) { const n = parseFloat(bg[1]); out.budgetMax = /میلیون/.test(bg[2] || '') ? n / 1000 : n }
  for (const a of AMENITY_ALL) if (raw.includes(a)) out.amenities.push(a)
  const am = raw.match(/در\s+([^\d،,]+?)(?:\s+(?:زیر|با|تا|حدود|حداکثر)|،|$)/)
  if (am) out.area = am[1].replace(/‌/g, ' ').trim()
  // توکن‌های باقی‌مانده (مثلِ نامِ محله/برج) برای جستجوی متنی
  const consumed = new Set<string>([...out.amenities, ...(out.area ? out.area.split(/\s+/) : []), ...(out.kind ? out.kind.split('/') : [])])
  for (const w of raw.split(/[\s،,]+/)) {
    const word = w.trim()
    if (word.length < 2 || STOP.has(word) || consumed.has(word) || /^\d/.test(faToEn(word))) continue
    out.tokens.push(word)
  }
  return out
}

function bedsMatch(target: number | null, bedsNum: number | null): boolean {
  if (target == null) return true
  if (bedsNum == null) return true
  if (target >= 4) return bedsNum >= 4
  return bedsNum === target
}

export default function SearchPage() {
  return <Suspense fallback={null}><SearchPageInner /></Suspense>
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const typeParam = (searchParams.get('type') || '').toLowerCase()
  const dealFromParam = (t: string) => t === 'rent' || t === 'اجاره' ? 'اجاره'
    : t === 'presale' || t === 'pre-sale' || t === 'پیش‌فروش' ? 'پیش‌فروش'
      : t === 'mortgage' || t === 'rahn' || t === 'رهن' ? 'رهن' : 'خرید'
  // تبِ معامله = state (منبعِ واحدِ حقیقت برای فیلتر). از URL مقداردهیِ اولیه می‌شود،
  // با کلیکِ تب فوراً عوض می‌شود (state) و آدرس‌بار هم با replaceState همگام می‌شود.
  const [dealType, setDealType] = useState<string>(dealFromParam(typeParam))
  useEffect(() => { setDealType(dealFromParam(typeParam)) }, [typeParam])
  // رویدادِ کلیکِ تبِ معامله از نوارِ بالا (تضمینِ عوض‌شدنِ تب وقتی همین‌حالا روی /search هستیم)
  useEffect(() => {
    const onDeal = (e: Event) => {
      const slug = (e as CustomEvent).detail as string
      setDealType(slug === 'rent' ? 'اجاره' : slug === 'presale' ? 'پیش‌فروش' : slug === 'mortgage' ? 'رهن' : 'خرید')
    }
    window.addEventListener('mj-deal', onDeal)
    return () => window.removeEventListener('mj-deal', onDeal)
  }, [])
  const goDeal = (label: string) => {
    setDealType(label)
    const slug = label === 'اجاره' ? 'rent' : label === 'پیش‌فروش' ? 'presale' : label === 'رهن' ? 'mortgage' : ''
    try { window.history.replaceState(null, '', '/search' + (slug ? `?type=${slug}` : '')) } catch {}
  }

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(initialQuery)
  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const [beds, setBeds] = useState<string>('همه')
  const [kind, setKind] = useState('')
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(PRICE_MAX)
  const [areaMin, setAreaMin] = useState(0)
  const [areaMax, setAreaMax] = useState(0)
  const [floorMin, setFloorMin] = useState(0)
  const [yearMin, setYearMin] = useState(0)
  const [checkedAmenities, setCheckedAmenities] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('پیشنهاد ملک‌جت')

  // سوابقِ کاربر/موقعیتِ لحظه‌ای: محلهٔ کاربر + شهرِ انتخابی (یا تشخیص‌داده‌شده)
  const [userArea, setUserArea] = useState('')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedCity, setSelectedCity] = useState('')
  useEffect(() => {
    const upd = () => {
      const l = readLoc()
      setUserArea(l?.neighborhood || '')
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
  const [properties, setProperties] = useState<PropertyT[]>([])
  const [promoted, setPromoted] = useState<PropertyT[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchContent('listing', undefined, 80).then((d) => { if (alive) { setProperties(d.map(toProperty)); setLoading(false) } })
    fetch('/api/promotions?slot=search_top', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { items: [] })).then((d) => { if (alive) setPromoted(((d.items || []) as ContentItem[]).map(toProperty)) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const toggleAmenity = (a: string) => setCheckedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  const parsed = useMemo(() => parseQuery(searchTerm), [searchTerm])

  // مقادیرِ مؤثرِ فیلتر: فیلترِ دستی اولویت دارد، وگرنه از تشخیصِ متن
  const fKind = kind || parsed.kind || ''
  const fBeds = beds !== 'همه' ? parseInt(faToEn(beds), 10) : parsed.beds
  const fBudgetMax = priceMax < PRICE_MAX ? priceMax : (parsed.budgetMax || 0)
  const fSizeMin = areaMin > 0 ? areaMin : (parsed.sizeNum ? Math.floor(parsed.sizeNum * 0.8) : 0)
  const fSizeMax = areaMax > 0 ? areaMax : (parsed.sizeNum ? Math.ceil(parsed.sizeNum * 1.2) : 0)
  const fAmen = useMemo(() => Array.from(new Set([...checkedAmenities, ...parsed.amenities])), [checkedAmenities, parsed.amenities])
  const fAreaName = parsed.area || ''

  const activeFilterCount =
    (dealType !== 'خرید' ? 1 : 0) + (kind ? 1 : 0) + (beds !== 'همه' ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) + (priceMax < PRICE_MAX ? 1 : 0) + (areaMin > 0 ? 1 : 0) + (areaMax > 0 ? 1 : 0) +
    (floorMin > 0 ? 1 : 0) + (yearMin > 0 ? 1 : 0) + checkedAmenities.length

  const filteredProperties = useMemo(() => {
    const tabDeal = dealType === 'پیش‌فروش' ? 'presale' : (dealType === 'اجاره' || dealType === 'رهن') ? 'rent' : 'sale'
    const areaName = fAreaName.toLowerCase()
    return properties.filter(p => {
      if (p.deal !== tabDeal) return false
      if (fKind && p.kind && p.kind !== fKind) {
        // اگر واحدِ تشخیص‌داده‌شده فرق دارد، رد کن (اگر واحدِ آگهی نامشخص است، تحمل کن)
        return false
      }
      if (!bedsMatch(fBeds ?? null, p.bedsNum)) return false
      if (priceMin > 0 && p.priceNum > 0 && p.priceNum < priceMin) return false
      if (fBudgetMax > 0 && p.priceNum > 0 && p.priceNum > fBudgetMax) return false
      if (fSizeMin > 0 && p.areaNum > 0 && p.areaNum < fSizeMin) return false
      if (fSizeMax > 0 && p.areaNum > 0 && p.areaNum > fSizeMax) return false
      if (floorMin > 0 && p.floorNum != null && p.floorNum < floorMin) return false
      if (yearMin > 0 && p.yearNum > 0 && p.yearNum < yearMin) return false
      for (const a of fAmen) { if (p.searchText.trim() && !p.searchText.includes(a.toLowerCase())) return false }
      if (areaName) { const hay = `${p.location} ${p.searchText}`.toLowerCase(); if (!hay.includes(areaName)) return false }
      for (const tok of parsed.tokens) { const hay = `${p.title} ${p.location} ${p.searchText}`.toLowerCase(); if (!hay.includes(tok.toLowerCase())) return false }
      return true
    })
  }, [properties, dealType, fKind, fBeds, priceMin, fBudgetMax, fSizeMin, fSizeMax, floorMin, yearMin, fAmen, fAreaName, parsed.tokens])

  // ─── فیلترِ هوشمندِ مکان ──────────────────────────────────────────────────
  // شهر = فیلترِ قطعی (اگر آگهی نبود، خالی نشان می‌دهد؛ هیچ‌وقت آگهیِ شهرِ دیگر را نشان نمی‌دهد).
  // محله (سوابق/موقعیت) = اولویتِ نرم داخلِ همان شهر؛ اگر در آن محله نبود، به سطحِ شهر برمی‌گردد.
  const scoped = useMemo(() => {
    const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()
    const base = filteredProperties
    const city = selectedCity
    const area = parsed.area ? '' : prefArea
    const inArea = (p: PropertyT) => area ? norm(p.location).includes(norm(area)) : true
    if (city) {
      const inCity = base.filter(p => norm(p.location).includes(norm(city)))
      if (area) { const a = inCity.filter(inArea); return { list: a.length ? a : inCity } }
      return { list: inCity }   // خالی = واقعاً خالی (بدونِ fallbackِ بین‌شهری)
    }
    if (area) { const a = base.filter(inArea); return { list: a.length ? a : base } }
    return { list: base }
  }, [filteredProperties, selectedCity, prefArea, parsed.area])

  const sortedProperties = useMemo(() => {
    const ar = prefArea.replace(/‌/g, '').trim()
    const nearby = (p: { location: string }) => ar ? p.location.replace(/‌/g, '').includes(ar) : false
    return [...scoped.list].sort((a, b) => {
      if (sortBy === 'ارزان‌ترین') return a.priceNum - b.priceNum
      if (sortBy === 'گران‌ترین') return b.priceNum - a.priceNum
      if (sortBy === 'جدیدترین') return (b.yearNum || 0) - (a.yearNum || 0)
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
  const mapArea = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of shownProperties.slice(0, 40)) { const n = (p.location || '').split(/[،,]/)[0].trim(); if (n && n !== 'نامشخص') counts[n] = (counts[n] || 0) + 1 }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  }, [shownProperties])
  // مرکزِ نقشهٔ شهر/محله (geocode، با کش) — برای حالتی که آگهی مختصات ندارد
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    const q = [mapArea, selectedCity].filter(Boolean).join(' ').trim()
    if (!q) { setMapCenter(null); return }
    const cached = GEO_CACHE.get(q)
    if (cached) { setMapCenter(cached); return }
    let alive = true
    fetch(`/api/geo/geocode?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : null).then(d => {
      if (alive && d?.lat) { const c = { lat: d.lat, lng: d.lng }; GEO_CACHE.set(q, c); setMapCenter(c) }
    }).catch(() => {})
    return () => { alive = false }
  }, [mapArea, selectedCity])

  // ── پین‌کردنِ آگهی‌ها روی نقشه: مختصاتِ هر آگهی را از متا یا با geocodeِ محله‌اش می‌گیریم ──
  const [locCoords, setLocCoords] = useState<Record<string, { lat: number; lng: number }>>({})
  const needGeocode = useMemo(() => {
    const set = new Set<string>()
    for (const p of shownProperties.slice(0, 40)) { if (!(p.lat && p.lng) && p.location && p.location !== 'نامشخص') set.add(`${p.location.split(/[،,]/)[0].trim()} ${selectedCity || ''}`.trim()) }
    return Array.from(set)
  }, [shownProperties, selectedCity])
  useEffect(() => {
    const todo = needGeocode.filter(q => !GEO_CACHE.has(q))
    const fromCache: Record<string, { lat: number; lng: number }> = {}
    for (const q of needGeocode) { const c = GEO_CACHE.get(q); if (c) fromCache[q] = c }
    if (Object.keys(fromCache).length) setLocCoords(prev => ({ ...prev, ...fromCache }))
    if (!todo.length) return
    let alive = true
    fetch('/api/geo/geocode-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries: todo }) })
      .then(r => r.ok ? r.json() : null).then(d => {
        if (!alive || !d?.results) return
        const add: Record<string, { lat: number; lng: number }> = {}
        for (const [q, c] of Object.entries(d.results)) { if (c) { GEO_CACHE.set(q, c as any); add[q] = c as any } else GEO_CACHE.set(q, null as any) }
        if (Object.keys(add).length) setLocCoords(prev => ({ ...prev, ...add }))
      }).catch(() => {})
    return () => { alive = false }
  }, [needGeocode])

  // پین‌ها (با jitterِ کوچک تا آگهی‌های هم‌محله روی هم نیفتند)
  const pins = useMemo(() => {
    const out: { id: string; lat: number; lng: number; price: string }[] = []
    for (const p of shownProperties.slice(0, 40)) {
      let lat = p.lat, lng = p.lng
      if (!(lat && lng)) {
        const key = `${(p.location || '').split(/[،,]/)[0].trim()} ${selectedCity || ''}`.trim()
        const c = locCoords[key] || GEO_CACHE.get(key)
        if (c) {
          const h = seedNum(p.id)
          lat = c.lat + (((h % 1000) / 1000 - 0.5) * 0.005)
          lng = c.lng + ((((h >> 10) % 1000) / 1000 - 0.5) * 0.005)
        }
      }
      if (lat && lng) out.push({ id: p.id, lat, lng, price: p.price })
    }
    return out
  }, [shownProperties, locCoords, selectedCity])

  // نمای نقشه (مرکز + زوم) — متناسب با گسترهٔ پین‌ها، وگرنه مرکزِ شهر/محله
  const mapView = useMemo(() => {
    if (pins.length) {
      const lats = pins.map(p => p.lat), lngs = pins.map(p => p.lng)
      const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
      const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
      const span = Math.max(maxLat - minLat, maxLng - minLng, 0.004)
      const zoom = Math.max(11, Math.min(15, Math.floor(Math.log2(360 / span)) - 1))
      return { center, zoom }
    }
    if (mapCenter) return { center: mapCenter, zoom: 13 }
    if (userLoc) return { center: userLoc, zoom: 12 }
    return null
  }, [pins, mapCenter, userLoc])

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

  const resetFilters = () => { setKind(''); setBeds('همه'); setPriceMin(0); setPriceMax(PRICE_MAX); setAreaMin(0); setAreaMax(0); setFloorMin(0); setYearMin(0); setCheckedAmenities([]) }

  const selInput: React.CSSProperties = { height: 36, padding: '0 10px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }
  const lab: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600 }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif" }}>
      <Nav />

      <div style={{ position: 'sticky', top: 68, zIndex: 40, background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }}>
        <div className="mjs-filterbar" style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)', fontSize: 16, pointerEvents: 'none', zIndex: 1 }}>✦</span>
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

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ height: 48, padding: '0 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13.5, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
            <option>پیشنهاد ملک‌جت</option><option>ارزان‌ترین</option><option>گران‌ترین</option><option>جدیدترین</option>
          </select>
        </div>

        {/* چیپ‌های تشخیص AI — فقط وقتی چیزی واقعاً از متن تشخیص داده شده */}
        {aiChips.length > 0 && (
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--faint)', marginLeft: 4 }}>تشخیص هوشمند:</span>
            {aiChips.map(tag => (
              <span key={tag.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 999, background: 'var(--goldDim)', border: '1px solid rgba(201,168,76,0.28)', fontSize: 12.5, color: 'var(--text)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{tag.label}:</span>
                <span style={{ color: 'var(--muted)' }}>{tag.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* کشوی فیلترها */}
        <div style={{ maxHeight: filtersOpen ? 520 : 0, overflow: 'hidden', transition: 'max-height 0.32s cubic-bezier(0.4,0,0.2,1)', borderTop: filtersOpen ? '1px solid var(--line)' : 'none', background: 'var(--surface)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* نوع معامله + نوع ملک */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <span style={lab}>نوع معامله:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['خرید', 'اجاره', 'رهن', 'پیش‌فروش'].map(type => (
                  <button key={type} onClick={() => goDeal(type)} style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${dealType === type ? 'var(--gold)' : 'var(--line2)'}`, background: dealType === type ? 'var(--goldDim)' : 'transparent', color: dealType === type ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>{type}</button>
                ))}
              </div>
              <span style={{ ...lab, marginInlineStart: 12 }}>نوع ملک:</span>
              <select value={kind} onChange={e => setKind(e.target.value)} style={{ height: 36, padding: '0 12px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                <option value="">همه</option>
                {PROPERTY_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            {/* قیمت + متراژ — دراپ‌داون (بدون تایپ) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>قیمت:</span>
                <select value={priceMin || ''} onChange={e => setPriceMin(+e.target.value || 0)} style={selInput}>
                  <option value="">از (حداقل)</option>
                  {PRICE_OPTS.map(v => <option key={v} value={v}>از {priceLabel(v)}</option>)}
                </select>
                <span style={{ color: 'var(--faint)' }}>تا</span>
                <select value={priceMax < PRICE_MAX ? priceMax : ''} onChange={e => { const v = +e.target.value || 0; setPriceMax(v > 0 ? v : PRICE_MAX) }} style={selInput}>
                  <option value="">بدون سقف</option>
                  {PRICE_OPTS.map(v => <option key={v} value={v}>تا {priceLabel(v)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>متراژ:</span>
                <select value={areaMin || ''} onChange={e => setAreaMin(+e.target.value || 0)} style={selInput}>
                  <option value="">از (حداقل)</option>
                  {AREA_OPTS.map(v => <option key={v} value={v}>از {toPersianDigits(v)} متر</option>)}
                </select>
                <span style={{ color: 'var(--faint)' }}>تا</span>
                <select value={areaMax || ''} onChange={e => setAreaMax(+e.target.value || 0)} style={selInput}>
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
                <select value={floorMin || ''} onChange={e => setFloorMin(+e.target.value || 0)} style={selInput}>
                  <option value="">همه</option>
                  {FLOOR_OPTS.map(v => <option key={v} value={v}>طبقه {toPersianDigits(v)} به بالا</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={lab}>ساخت از سال:</span>
                <select value={yearMin || ''} onChange={e => setYearMin(+e.target.value || 0)} style={selInput}>
                  <option value="">همه</option>
                  {YEAR_OPTS.map(v => <option key={v} value={v}>{toPersianDigits(v)} به بعد</option>)}
                </select>
              </div>
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
      <div className="mjs-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'start', minHeight: 'calc(100vh - 200px)' }}>
        <div style={{ paddingTop: 20, paddingLeft: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}><span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>{toPersianDigits(shownProperties.length)}</span> ملک پیدا شد{selectedCity ? <span style={{ color: 'var(--faint)' }}> · {selectedCity}</span> : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--faint)' }}>مرتب‌سازی: <span style={{ color: 'var(--muted)' }}>{sortBy}</span></div>
          </div>

          {(loading || shownProperties.length === 0) && (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14, lineHeight: 1.9 }}>
              {loading ? 'در حال بارگذاری آگهی‌ها…'
                : properties.length === 0 ? 'هنوز آگهی‌ای ثبت نشده.'
                  : selectedCity ? `هنوز آگهی${dealType === 'اجاره' ? 'ِ اجاره‌ای' : dealType === 'رهن' ? 'ِ رهنی' : dealType === 'پیش‌فروش' ? 'ِ پیش‌فروشی' : 'ِ فروشی'} در «${selectedCity}» ثبت نشده است. می‌توانید شهرِ دیگری انتخاب کنید.`
                    : `هیچ آگهی${dealType === 'اجاره' ? 'ِ اجاره‌ای' : dealType === 'رهن' ? 'ِ رهنی' : dealType === 'پیش‌فروش' ? 'ِ پیش‌فروشی' : 'ِ فروشی'} با این فیلترها پیدا نشد.`}
            </div>
          )}

          <div className="mjs-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {shownProperties.map((p, index) => {
              const isHov = hoveredCard === p.id
              const isPromoted = promotedIdSet.has(p.id)
              const cards = []
              if (index === 3) cards.push(<div key="promo" style={{ gridColumn: '1 / -1' }}><BannerSlot placement="search" /></div>)
              cards.push(
                <div key={p.id} onMouseEnter={() => setHoveredCard(p.id)} onMouseLeave={() => setHoveredCard(null)} style={{ borderRadius: 14, border: `1px solid ${isHov ? 'var(--gold)' : 'var(--line)'}`, background: 'var(--surface)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s', transform: isHov ? 'translateY(-4px)' : 'none', boxShadow: isHov ? '0 12px 40px -12px rgba(201,168,76,0.22)' : '0 2px 10px -4px rgba(0,0,0,0.3)' }}>
                  <Link href={`/property/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ height: 156, background: p.image ? `center/cover no-repeat url(${p.image})` : p.img, position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, background: 'linear-gradient(to top,rgba(0,0,0,0.5),transparent)' }} />
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', color: 'var(--gold2)', borderRadius: 8, padding: '4px 8px', fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>✦ {toPersianDigits(p.score)}</div>
                      {isPromoted && <div style={{ position: 'absolute', top: 10, left: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', borderRadius: 8, padding: '4px 9px', fontSize: 11.5, fontWeight: 800 }}>★ ویژه</div>}
                    </div>
                    <div style={{ padding: '13px 14px 15px' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}><path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" strokeWidth="1.2" /><circle cx="6" cy="4.5" r="1.2" fill="currentColor" /></svg>
                        {p.location}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>{p.price}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginRight: 4 }}>تومان</span></div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)' }}>
                        <span>{p.size} م²</span><span style={{ color: 'var(--faint)' }}>·</span>
                        <span>{p.beds} خواب</span><span style={{ color: 'var(--faint)' }}>·</span>
                        <span>ساخت {p.year}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ color: 'var(--gold)', fontSize: 11.5, fontWeight: 600 }}>مشاهده ←</span>
                      </div>
                    </div>
                  </Link>
                </div>
              )
              return cards
            })}
          </div>
        </div>

        {/* نقشهٔ واقعیِ نشان */}
        <div className="map-panel mjs-map" style={{ position: 'sticky', top: 88, height: 'calc(100vh - 108px)', paddingTop: 20, paddingRight: 12 }}>
          <style>{`@media (max-width: 768px) { .map-panel { display: none !important; } }`}</style>
          <SearchMap view={mapView} pins={pins} city={mapArea || selectedCity || userArea} />
        </div>
      </div>
    </div>
  )
}

// تبدیلِ مختصات به پیکسلِ Web-Mercator (هم‌راستا با نقشهٔ استاتیکِ نشان)
function project(lat: number, lng: number, zoom: number) {
  const s = 256 * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * s
  const sin = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s
  return { x, y }
}

// نقشهٔ استاتیکِ نشان + پین‌های قابلِ کلیکِ آگهی‌ها (overlay دقیق با تصویرِ نقشه)
type MapView = { center: { lat: number; lng: number }; zoom: number } | null
function SearchMap({ view, pins, city }: { view: MapView; pins: { id: string; lat: number; lng: number; price: string }[]; city: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [err, setErr] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current; if (!el) return
    const measure = () => { const r = el.getBoundingClientRect(); setSize({ w: Math.min(1000, Math.round(r.width / 10) * 10), h: Math.min(1000, Math.round(r.height / 10) * 10) }) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { setErr(false) }, [view?.center.lat, view?.center.lng, view?.zoom, size.w, size.h])

  const ready = view && size.w > 0 && size.h > 0
  const src = ready ? `/api/geo/static-map?lat=${view!.center.lat.toFixed(5)}&lng=${view!.center.lng.toFixed(5)}&w=${size.w}&h=${size.h}&zoom=${view!.zoom}` : ''
  // محاسبهٔ پیکسلِ هر پین نسبت به مرکزِ نقشه
  const placed = (ready && !err) ? pins.map(p => {
    const pp = project(p.lat, p.lng, view!.zoom), pc = project(view!.center.lat, view!.center.lng, view!.zoom)
    return { ...p, x: size.w / 2 + (pp.x - pc.x), y: size.h / 2 + (pp.y - pc.y) }
  }).filter(p => p.x >= 4 && p.x <= size.w - 4 && p.y >= 4 && p.y <= size.h - 4) : []

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)' }}>
      {src && !err ? (
        <img src={src} alt="نقشهٔ منطقه" onError={() => setErr(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24, lineHeight: 1.9 }}>
          {err ? 'نقشه به «کلید نقشهٔ نشان» (web.…) نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان → کلید نقشه' : 'برای نمایشِ نقشه، موقعیتِ شما یا مختصاتِ آگهی‌ها لازم است.'}
        </div>
      )}

      {/* پین‌های قیمتِ آگهی‌ها */}
      {placed.map(p => {
        const on = active === p.id
        return (
          <a key={p.id} href={`/property/${p.id}`} onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
            style={{ position: 'absolute', left: `${(p.x / size.w) * 100}%`, top: `${(p.y / size.h) * 100}%`, transform: `translate(-50%,-50%) scale(${on ? 1.12 : 1})`, padding: '4px 10px', borderRadius: 20, background: on ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'rgba(10,9,8,0.9)', border: `2px solid ${on ? 'var(--gold2)' : 'var(--gold)'}`, color: on ? '#16140f' : '#f0ede6', fontSize: 11.5, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: '0 2px 12px -3px rgba(0,0,0,.7)', zIndex: on ? 20 : 10, fontFamily: 'inherit' }}>
            {p.price}
          </a>
        )
      })}

      <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(10px)', borderRadius: 9, padding: '6px 12px', fontSize: 12, color: '#f0ede6', border: '1px solid rgba(255,255,255,.12)', pointerEvents: 'none', zIndex: 30 }}>
        {placed.length > 0 ? `${placed.length.toLocaleString('fa-IR')} ملک روی نقشه` : (city ? `نقشهٔ ${city}` : 'نقشهٔ منطقه')}
      </div>
    </div>
  )
}
