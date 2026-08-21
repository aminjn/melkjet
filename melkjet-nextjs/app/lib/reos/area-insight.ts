// تحلیلِ محله به زبانِ مشاور، نه به زبانِ آمار: قیمتِ یک واحدِ نمونه، اثرِ سن بنا،
// اثرِ امکانات، و معادلِ رهنِ کامل — همه از آگهی‌های واقعی، بدونِ هیچ سنجهٔ رفتاری.
import { listItems, type Item } from '../scraper-store'
import { parseFaNum, rentPartsOf } from './features'

export const DEAL_SALE = 'فروش'
export const DEAL_RENT = 'اجاره'

// تبدیلِ ودیعه به اجاره — عرفِ بازار: هر ۱۰۰ میلیون ودیعه ≈ ۳ میلیون اجارهٔ ماهانه.
// بدونِ این، «رهنِ کامل» با اجارهٔ اسمیِ ۱۰ هزار تومان «۱۰۰٪ زیرِ میانه» می‌شد و
// ۶۴۲ فایلِ بدونِ اجارهٔ ماهانه (۳۷٪ کلِ اجاره‌ها) کاملاً از آمار می‌افتادند.
export const RENT_CONVERT = 0.03

const NOW_FA = new Date().getFullYear() - 621
const AMENITIES = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی', 'روف‌گاردن', 'نگهبان']

export interface Row {
  city: string; hood: string; deal: string; ptype: string
  area: number; perM: number; deposit: number; monthly: number
  age: number | null; floor: number | null; rooms: number | null; feats: string[]
}

const med = (a: number[]) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : 0
const qnt = (a: number[], f: number) => {
  const s = a.slice().sort((x, y) => x - y)
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))] : 0
}

export function rowOf(it: Item): Row | null {
  const m = it.meta || {}
  const hood = String(m['محله'] || '').trim()
  const city = String(m['شهر'] || '').trim()
  const deal = String(m['نوع معامله'] || '').trim()
  const ptype = String(m['نوع ملک'] || '').trim()
  const area = parseFaNum(String(m['متراژ'] || ''))
  if (!hood || !deal || !ptype || !(area > 0)) return null

  let perM = 0, deposit = 0, monthly = 0
  if (deal === DEAL_SALE) {
    const p = parseFaNum(it.price)
    if (!(p > 0)) return null
    perM = p / area
  } else if (deal === DEAL_RENT) {
    const r = rentPartsOf(it.price)
    deposit = r?.deposit || 0; monthly = r?.monthly || 0
    const eff = monthly + deposit * RENT_CONVERT   // اجارهٔ مؤثر: رهن و اجاره روی یک مقیاس
    if (!(eff > 0)) return null
    perM = eff / area
  } else return null

  const y = parseFaNum(String(m['سال ساخت'] || ''))
  const age = y > 1300 && y <= NOW_FA + 1 ? NOW_FA - y : null
  const fl = parseFaNum(String(m['طبقه'] || ''))
  const rm = parseFaNum(String(m['اتاق خواب'] || ''))
  const feats = String(m['امکانات'] || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
  return { city, hood, deal, ptype, area, perM, deposit, monthly, age, floor: fl > 0 ? fl : null, rooms: rm > 0 ? rm : null, feats }
}

export interface AmenityEffect { name: string; premiumPct: number; withCount: number }

export interface DealInsight {
  deal: string; ptype: string; listings: number
  medianPerM: number; p25PerM: number; p75PerM: number
  /** متراژِ معمولِ این محله و قیمتِ همان واحد — عددی که مشاور واقعاً با آن کار می‌کند */
  typicalArea: number; typicalTotal: number
  areaBand: [number, number]
  typicalDeposit?: number; typicalMonthly?: number; fullRahn?: number
  typicalAge: number | null
  newPerM?: number; oldPerM?: number; agePremiumPct: number | null
  amenities: AmenityEffect[]
  topRooms: number | null; medianFloor: number | null
}

function build(deal: string, ptype: string, rows: Row[]): DealInsight {
  const perM = rows.map(r => r.perM), areas = rows.map(r => r.area)
  const medPerM = med(perM), medArea = med(areas)

  // اثرِ سن بنا: نوساز (≤۵ سال) در برابرِ ۱۵ سال به بالا. هر طرف دستِ‌کم ۴ نمونه لازم دارد.
  const news = rows.filter(r => r.age !== null && r.age <= 5).map(r => r.perM)
  const olds = rows.filter(r => r.age !== null && r.age >= 15).map(r => r.perM)
  const nP = news.length >= 4 ? med(news) : 0
  const oP = olds.length >= 4 ? med(olds) : 0
  const agePremiumPct = nP > 0 && oP > 0 ? Math.round(((nP - oP) / oP) * 100) : null

  // اثرِ هر امکان: میانهٔ متریِ دارا در برابرِ ندارا. زیرِ ۵ نمونه در هر طرف اعلام نمی‌شود.
  const amenities: AmenityEffect[] = []
  for (const a of AMENITIES) {
    const w = rows.filter(r => r.feats.some(f => f.includes(a))).map(r => r.perM)
    const wo = rows.filter(r => !r.feats.some(f => f.includes(a))).map(r => r.perM)
    if (w.length >= 5 && wo.length >= 5) {
      const mw = med(w), mo = med(wo)
      if (mw > 0 && mo > 0) amenities.push({ name: a, premiumPct: Math.round(((mw - mo) / mo) * 100), withCount: w.length })
    }
  }
  amenities.sort((x, y) => Math.abs(y.premiumPct) - Math.abs(x.premiumPct))

  const roomCount = new Map<number, number>()
  for (const r of rows) if (r.rooms) roomCount.set(r.rooms, (roomCount.get(r.rooms) || 0) + 1)
  const top = [...roomCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const ages = rows.map(r => r.age).filter((x): x is number => x !== null)
  const floors = rows.map(r => r.floor).filter((x): x is number => x !== null)

  const out: DealInsight = {
    deal, ptype, listings: rows.length,
    medianPerM: Math.round(medPerM), p25PerM: Math.round(qnt(perM, .25)), p75PerM: Math.round(qnt(perM, .75)),
    typicalArea: Math.round(medArea), typicalTotal: Math.round(medPerM * medArea),
    areaBand: [Math.round(qnt(areas, .25)), Math.round(qnt(areas, .75))],
    typicalAge: ages.length >= 4 ? Math.round(med(ages)) : null,
    newPerM: nP ? Math.round(nP) : undefined, oldPerM: oP ? Math.round(oP) : undefined, agePremiumPct,
    amenities: amenities.slice(0, 3),
    topRooms: top && top[1] >= 4 ? top[0] : null,
    medianFloor: floors.length >= 4 ? Math.round(med(floors)) : null,
  }
  if (deal === DEAL_RENT) {
    const deps = rows.map(r => r.deposit).filter(d => d > 0)
    const mons = rows.map(r => r.monthly).filter(d => d > 0)
    out.typicalDeposit = deps.length ? Math.round(med(deps)) : 0
    out.typicalMonthly = mons.length ? Math.round(med(mons)) : 0
    // رهنِ کاملِ معادل = ودیعه + اجاره ÷ نرخِ تبدیل
    out.fullRahn = Math.round((out.typicalDeposit || 0) + (out.typicalMonthly || 0) / RENT_CONVERT)
  }
  return out
}

export interface HoodInsight {
  city: string; hood: string
  deals: DealInsight[]
  totalListings: number
  /** جایگاهِ گرانیِ این محله میانِ محله‌های خودِ همین مشاور (۱ = گران‌ترین) */
  rank?: number; rankOf?: number
}

export async function hoodInsights(opts: {
  hoods?: string[]; cities?: string[]; minSamples?: number; limit?: number
}): Promise<HoodInsight[]> {
  const min = opts.minSamples ?? 5
  const items = await listItems('listing', { publicOnly: true })
  const wantH = opts.hoods?.length ? new Set(opts.hoods.map(h => h.trim())) : null
  const wantC = opts.cities?.length ? new Set(opts.cities.map(c => c.trim())) : null

  const byHood = new Map<string, Row[]>()
  for (const it of items) {
    const r = rowOf(it); if (!r) continue
    if (wantH && !wantH.has(r.hood)) continue
    if (wantC && r.city && !wantC.has(r.city)) continue   // «شهرک غرب» در دو شهر هست
    const k = r.city + '|' + r.hood
    const g = byHood.get(k); if (g) g.push(r); else byHood.set(k, [r])
  }

  const out: HoodInsight[] = []
  for (const [k, rows] of byHood) {
    const [city, hood] = k.split('|')
    const byDeal = new Map<string, Row[]>()
    for (const r of rows) {
      const dk = r.deal + '|' + r.ptype
      const g = byDeal.get(dk); if (g) g.push(r); else byDeal.set(dk, [r])
    }
    const deals: DealInsight[] = []
    for (const [dk, rs] of byDeal) {
      if (rs.length < min) continue
      const [deal, ptype] = dk.split('|')
      deals.push(build(deal, ptype, rs))
    }
    if (!deals.length) continue
    deals.sort((a, b) => (a.deal === DEAL_SALE ? 0 : 1) - (b.deal === DEAL_SALE ? 0 : 1) || b.listings - a.listings)
    out.push({ city, hood, deals, totalListings: rows.length })
  }

  const saleOf = (h: HoodInsight) => h.deals.find(d => d.deal === DEAL_SALE)?.medianPerM || 0
  const ranked = out.filter(h => saleOf(h) > 0).sort((a, b) => saleOf(b) - saleOf(a))
  ranked.forEach((h, i) => { h.rank = i + 1; h.rankOf = ranked.length })

  out.sort((a, b) => b.totalListings - a.totalListings)
  return out.slice(0, opts.limit ?? 40)
}
