import { listAgencyMembers } from './agency-link-store'
import { getAdvisor } from './advisor-store'
import { getCommissionConfig, type CommMode } from './agency-store'
import { getProfile } from './profile-store'

// تجمیعِ فایل‌ها (آگهی‌ها) و کمیسیونِ مشاورانِ عضوِ یک آژانس — از پنلِ خودِ مشاوران (advisor-store).
export interface AgencyAdvisorListing { id: string; title: string; location: string; price: number; deal: 'sale' | 'rent'; status: 'active' | 'sold' | 'rented'; ptype: string; createdAt: number }
export interface MonthPoint { key: string; label: string; amount: number; deals: number }
export interface AgencyAdvisorRow {
  advisorPhone: string
  advisorName: string
  photo: string
  listings: AgencyAdvisorListing[]
  counts: { total: number; active: number; sold: number; rented: number }
  advisorCommission: number   // کلِ کمیسیونِ گزارش‌شدهٔ مشاور
  paidCommission: number
  pendingCommission: number
  closedCount: number         // معاملاتِ بسته‌شده (فروخته/اجاره‌رفته)
  dealCount: number           // تعدادِ معاملاتِ کمیسیون‌دار (مبنای مبلغِ ثابت)
  monthly: MonthPoint[]       // درآمدِ آژانس از این مشاور به‌تفکیکِ ماه
  rate: { mode: CommMode; value: number; isDefault: boolean }
  agencyCut: number           // سهمِ آژانس بر اساسِ نرخِ تعریف‌شده
}

// کلیدِ ماه (سال-ماهِ محلی) + برچسبِ شمسیِ ماه.
function monthKey(ts: number): string { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function persianMonth(ts: number): string { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(new Date(ts)) } catch { return '' } }
function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) { const dd = new Date(d.getFullYear(), d.getMonth() - i, 15); out.push({ key: monthKey(dd.getTime()), label: persianMonth(dd.getTime()) }) }
  return out
}

export function agencyAdvisorFiles(agencyPhone: string): { rows: AgencyAdvisorRow[]; totals: { listings: number; active: number; sold: number; rented: number; advisorCommission: number; agencyCut: number }; income: MonthPoint[] } {
  const cfg = getCommissionConfig(agencyPhone)
  const frame = lastMonths(6)
  const overall: Record<string, { amount: number; deals: number }> = {}
  const rows: AgencyAdvisorRow[] = listAgencyMembers(agencyPhone).map(m => {
    const phone = m.advisorPhone
    const per = cfg.perAgent[phone]
    const mode: CommMode = per?.mode || cfg.defaultMode
    const value = per ? per.value : cfg.defaultValue
    let listings: AgencyAdvisorListing[] = []
    let advisorCommission = 0, paidCommission = 0, pendingCommission = 0, dealCount = 0
    const perMonth: Record<string, { amount: number; deals: number }> = {}
    try {
      const ad = getAdvisor(phone)
      listings = (ad.listings || []).map(l => ({ id: l.id, title: l.title, location: l.location, price: l.price, deal: l.deal, status: l.status, ptype: l.ptype, createdAt: l.createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt)
      for (const c of (ad.commissions || [])) {
        const amt = c.amount || 0
        advisorCommission += amt; if (c.status === 'paid') paidCommission += amt; else pendingCommission += amt
        dealCount++
        const cut = mode === 'percent' ? Math.round(amt * value / 100) : value
        const k = monthKey(c.createdAt || Date.now())
        if (!perMonth[k]) perMonth[k] = { amount: 0, deals: 0 }
        perMonth[k].amount += cut; perMonth[k].deals += 1
        if (!overall[k]) overall[k] = { amount: 0, deals: 0 }
        overall[k].amount += cut; overall[k].deals += 1
      }
    } catch {}
    const counts = {
      total: listings.length,
      active: listings.filter(l => l.status === 'active').length,
      sold: listings.filter(l => l.status === 'sold').length,
      rented: listings.filter(l => l.status === 'rented').length,
    }
    const closedCount = counts.sold + counts.rented
    const agencyCut = mode === 'percent' ? Math.round(advisorCommission * value / 100) : Math.round(value * dealCount)
    const monthly: MonthPoint[] = frame.map(f => ({ key: f.key, label: f.label, amount: perMonth[f.key]?.amount || 0, deals: perMonth[f.key]?.deals || 0 }))
    let photo = ''
    try { const pr = getProfile(phone); photo = pr.logo || '' } catch {}
    return { advisorPhone: phone, advisorName: m.advisorName, photo, listings, counts, advisorCommission, paidCommission, pendingCommission, closedCount, dealCount, monthly, rate: { mode, value, isDefault: !per }, agencyCut }
  })
  const totals = rows.reduce((t, r) => ({
    listings: t.listings + r.counts.total,
    active: t.active + r.counts.active,
    sold: t.sold + r.counts.sold,
    rented: t.rented + r.counts.rented,
    advisorCommission: t.advisorCommission + r.advisorCommission,
    agencyCut: t.agencyCut + r.agencyCut,
  }), { listings: 0, active: 0, sold: 0, rented: 0, advisorCommission: 0, agencyCut: 0 })
  const income: MonthPoint[] = frame.map(f => ({ key: f.key, label: f.label, amount: overall[f.key]?.amount || 0, deals: overall[f.key]?.deals || 0 }))
  return { rows, totals, income }
}
