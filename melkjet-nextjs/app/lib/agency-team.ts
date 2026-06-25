import { listAgencyMembers } from './agency-link-store'
import { getAdvisor } from './advisor-store'
import { getCommissionConfig, type CommMode } from './agency-store'
import { getProfile } from './profile-store'

// تجمیعِ فایل‌ها (آگهی‌ها) و کمیسیونِ مشاورانِ عضوِ یک آژانس — از پنلِ خودِ مشاوران (advisor-store).
export interface AgencyAdvisorListing { id: string; title: string; location: string; price: number; deal: 'sale' | 'rent'; status: 'active' | 'sold' | 'rented'; ptype: string; createdAt: number }
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
  rate: { mode: CommMode; value: number; isDefault: boolean }
  agencyCut: number           // سهمِ آژانس بر اساسِ نرخِ تعریف‌شده
}

export function agencyAdvisorFiles(agencyPhone: string): { rows: AgencyAdvisorRow[]; totals: { listings: number; active: number; sold: number; rented: number; advisorCommission: number; agencyCut: number } } {
  const cfg = getCommissionConfig(agencyPhone)
  const rows: AgencyAdvisorRow[] = listAgencyMembers(agencyPhone).map(m => {
    const phone = m.advisorPhone
    let listings: AgencyAdvisorListing[] = []
    let advisorCommission = 0, paidCommission = 0, pendingCommission = 0
    try {
      const ad = getAdvisor(phone)
      listings = (ad.listings || []).map(l => ({ id: l.id, title: l.title, location: l.location, price: l.price, deal: l.deal, status: l.status, ptype: l.ptype, createdAt: l.createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt)
      for (const c of (ad.commissions || [])) { advisorCommission += c.amount || 0; if (c.status === 'paid') paidCommission += c.amount || 0; else pendingCommission += c.amount || 0 }
    } catch {}
    const counts = {
      total: listings.length,
      active: listings.filter(l => l.status === 'active').length,
      sold: listings.filter(l => l.status === 'sold').length,
      rented: listings.filter(l => l.status === 'rented').length,
    }
    const closedCount = counts.sold + counts.rented
    const per = cfg.perAgent[phone]
    const mode: CommMode = per?.mode || cfg.defaultMode
    const value = per ? per.value : cfg.defaultValue
    const agencyCut = mode === 'percent' ? Math.round(advisorCommission * value / 100) : Math.round(value * closedCount)
    let photo = ''
    try { const pr = getProfile(phone); photo = pr.logo || '' } catch {}
    return { advisorPhone: phone, advisorName: m.advisorName, photo, listings, counts, advisorCommission, paidCommission, pendingCommission, closedCount, rate: { mode, value, isDefault: !per }, agencyCut }
  })
  const totals = rows.reduce((t, r) => ({
    listings: t.listings + r.counts.total,
    active: t.active + r.counts.active,
    sold: t.sold + r.counts.sold,
    rented: t.rented + r.counts.rented,
    advisorCommission: t.advisorCommission + r.advisorCommission,
    agencyCut: t.agencyCut + r.agencyCut,
  }), { listings: 0, active: 0, sold: 0, rented: 0, advisorCommission: 0, agencyCut: 0 })
  return { rows, totals }
}
