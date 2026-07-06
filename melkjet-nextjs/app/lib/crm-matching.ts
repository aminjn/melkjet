import type { Lead } from './leads-store'
import type { Item } from './scraper-store'

// ── موتورِ تطبیق (Matching Engine) — پیشنهادِ ملک به لید و لید به ملک ──
// معیارها: بودجه (نزدیکی)، نوعِ معامله (خرید/اجاره)، منطقه/محله، متراژ.

const FA = '۰۱۲۳۴۵۶۷۸۹'
export function parseToman(s?: string): number {
  if (!s) return 0
  if (/رایگان|توافقی|مجانی/.test(s)) return 0
  const latin = String(s).replace(/[۰-۹]/g, d => String(FA.indexOf(d))).replace(/٬/g, '').replace(/٫/g, '.')
  const m = latin.match(/[\d][\d,.]*/); if (!m) return 0
  const base = parseFloat(m[0].replace(/,/g, '')) || 0
  if (/میلیارد/.test(s)) return Math.round(base * 1e9)
  if (/میلیون/.test(s)) return Math.round(base * 1e6)
  return Math.round(base)
}

function listingPrice(it: Item): number {
  return parseToman(it.price) || parseToman(it.meta?.['قیمت']) || parseToman(it.meta?.__price) || 0
}
function listingDeal(it: Item): 'sale' | 'rent' | '' {
  const t = `${it.category || ''} ${it.meta?.['نوع آگهی'] || ''} ${it.price || ''} ${it.title || ''}`
  if (/rent|اجاره|رهن|ودیعه/i.test(t)) return 'rent'
  if (/sale|sell|فروش|خرید/i.test(t)) return 'sale'
  return ''
}
const norm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()

export interface MatchResult { listing: Item; score: number; reasons: string[] }

// امتیازِ تطبیقِ یک لید با یک آگهی (۰..۱۰۰).
export function matchScore(lead: Lead, it: Item): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  // نوعِ معامله
  const ld = listingDeal(it)
  if (lead.dealType && ld) { if (lead.dealType === ld) { score += 25; reasons.push('نوعِ معامله می‌خواند') } else return { score: 0, reasons: ['نوعِ معامله فرق دارد'] } }
  // بودجه
  const price = listingPrice(it)
  if (lead.budget && price) {
    const ratio = price / lead.budget
    if (ratio <= 1.02) { score += 40; reasons.push('در بودجه') }
    else if (ratio <= 1.15) { score += 26; reasons.push('کمی بالاتر از بودجه') }
    else if (ratio <= 1.35) { score += 12; reasons.push('بالاتر از بودجه') }
    else reasons.push('خیلی بالاتر از بودجه')
  } else if (!lead.budget) { score += 8 }
  // منطقه/محله
  if (lead.region) {
    const loc = norm(`${it.location || ''} ${it.meta?.['محله'] || ''} ${it.meta?.['شهر'] || ''}`)
    if (loc && norm(lead.region).split(/[،,\s]+/).some(w => w.length > 1 && loc.includes(w))) { score += 22; reasons.push('در منطقهٔ موردنظر') }
  }
  // متراژ
  if (lead.area) {
    const a = Number((it.meta?.['متراژ'] || '').replace(/[^\d]/g, '')) || 0
    if (a) { const d = Math.abs(a - lead.area) / lead.area; if (d <= 0.15) { score += 13; reasons.push('متراژ نزدیک') } else if (d <= 0.35) score += 6 }
  }
  return { score: Math.min(100, Math.round(score)), reasons }
}

// آگهی‌های پیشنهادی برای یک لید (مرتب‌شده).
export function matchListingsForLead(lead: Lead, listings: Item[], limit = 12): MatchResult[] {
  return listings
    .map(it => ({ listing: it, ...matchScore(lead, it) }))
    .filter(r => r.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface LeadMatch { lead: Lead; score: number; reasons: string[] }
// لیدهای پیشنهادی برای یک آگهی (مرتب‌شده).
export function matchLeadsForListing(listing: Item, leads: Lead[], limit = 12): LeadMatch[] {
  return leads
    .filter(l => l.stage !== 'lost' && l.stage !== 'contract')
    .map(l => ({ lead: l, ...matchScore(l, listing) }))
    .filter(r => r.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
