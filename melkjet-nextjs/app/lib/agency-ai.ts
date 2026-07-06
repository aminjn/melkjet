import type { AgencyData, Agent } from './agency-store'

// ── تحلیلِ هوشمندِ آژانس (heuristic-first) ──
// پیش‌بینیِ درآمدِ ماهانه + تشخیصِ مشاورِ ضعیف + پیشنهادِ بهینه‌سازیِ تیم.
// همه بدونِ AI کار می‌کنند؛ متنِ توصیه اختیاری با GapGPT غنی می‌شود.

const budgetNum = (b?: string) => Number(String(b || '').replace(/[^\d]/g, '')) || 0

export interface IncomeForecast {
  nextMonth: number        // برآوردِ فروشِ ماهِ آینده (تومان)
  trendPct: number         // رشد/افتِ روندِ اخیر
  pipelineValue: number    // ارزشِ لیدهای بازِ در جریان
  method: string
  confidence: 'low' | 'medium' | 'high'
}
export function forecastIncome(a: AgencyData): IncomeForecast {
  const months = a.monthlySales || []
  const vals = months.map(m => m.amount)
  const n = vals.length
  // روندِ خطیِ ساده روی ۳ ماهِ اخیر
  const recent = vals.slice(-3)
  let base = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0
  let trendPct = 0
  if (recent.length >= 2) {
    const first = recent[0] || 1, last = recent[recent.length - 1]
    trendPct = first ? Math.round(((last - first) / first) * 100) : 0
  }
  // ارزشِ pipeline: لیدهای باز × نرخِ تبدیلِ تخمینی (بر اساسِ نسبتِ معاملات به لید)
  const openLeads = (a.leads || []).filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const pipelineValue = openLeads.reduce((s, l) => s + budgetNum(l.budget), 0)
  const totalLeads = (a.leads || []).length || 1
  const convRate = Math.min(0.5, (a.deals || []).length / totalLeads)
  // آمیزهٔ روند + سهمی از pipeline (کمیسیونِ آژانس ~ درصدِ فروش، ولی اینجا خودِ فروش را تخمین می‌زنیم)
  const trended = base * (1 + trendPct / 100)
  const nextMonth = Math.round(Math.max(trended, trended * 0.7 + pipelineValue * convRate * 0.3))
  const confidence: IncomeForecast['confidence'] = n >= 4 ? 'high' : n >= 2 ? 'medium' : 'low'
  return { nextMonth, trendPct, pipelineValue, method: n >= 2 ? 'روندِ ۳ماهه + pipeline' : 'pipeline', confidence }
}

export interface AdvisorScore {
  id: string; name: string; deals: number; leads: number; commission: number; active: boolean
  conversion: number       // معامله ÷ لید (٪)
  rank: number
  weak: boolean            // زیرِ میانگینِ تیم یا بدونِ خروجی
  reason?: string
}
export function advisorPerformance(a: AgencyData): { rows: AdvisorScore[]; teamAvgDeals: number; teamAvgConv: number } {
  const agents = a.agents || []
  const active = agents.filter(g => g.active)
  const teamAvgDeals = active.length ? active.reduce((s, g) => s + g.deals, 0) / active.length : 0
  const convOf = (g: Agent) => g.leads > 0 ? Math.round((g.deals / g.leads) * 100) : 0
  const teamAvgConv = active.length ? Math.round(active.reduce((s, g) => s + convOf(g), 0) / active.length) : 0
  const sorted = [...agents].sort((x, y) => y.deals - x.deals || convOf(y) - convOf(x))
  const rows: AdvisorScore[] = sorted.map((g, i) => {
    const conversion = convOf(g)
    let weak = false, reason: string | undefined
    if (g.active) {
      if (g.leads >= 3 && g.deals === 0) { weak = true; reason = 'لیدِ کافی گرفته ولی هیچ معامله‌ای نبسته' }
      else if (teamAvgDeals > 0 && g.deals < teamAvgDeals * 0.5) { weak = true; reason = 'زیرِ نیمهٔ میانگینِ معاملاتِ تیم' }
      else if (conversion > 0 && teamAvgConv > 0 && conversion < teamAvgConv * 0.5) { weak = true; reason = 'نرخِ تبدیلِ پایین' }
    }
    return { id: g.id, name: g.name, deals: g.deals, leads: g.leads, commission: g.commission, active: g.active, conversion, rank: i + 1, weak, reason }
  })
  return { rows, teamAvgDeals: Math.round(teamAvgDeals), teamAvgConv }
}

// پیشنهادهای قانون‌محورِ بهینه‌سازیِ تیم.
export function teamInsights(a: AgencyData): string[] {
  const out: string[] = []
  const { rows } = advisorPerformance(a)
  const active = rows.filter(r => r.active)
  const weak = active.filter(r => r.weak)
  const top = active[0]
  const openLeads = (a.leads || []).filter(l => l.stage !== 'closed' && l.stage !== 'lost')
  const unassigned = openLeads.filter(l => !l.assignedTo)
  if (unassigned.length) out.push(`${unassigned.length} لیدِ تقسیم‌نشده دارید — با «تقسیمِ خودکار» بینِ مشاورها پخش کنید.`)
  if (top && top.deals > 0) out.push(`«${top.name}» بهترین عملکرد را دارد (${top.deals} معامله) — لیدهای باارزش را به او بسپارید.`)
  for (const w of weak.slice(0, 3)) out.push(`«${w.name}»: ${w.reason} — آموزش/کوچینگ یا کاهشِ سهمِ لید.`)
  if (!active.length) out.push('هنوز مشاورِ فعالی ندارید — از تبِ «مشاوران» اضافه کنید.')
  const idle = active.filter(r => r.leads === 0)
  if (idle.length) out.push(`${idle.length} مشاور هیچ لیدی ندارند — ظرفیتِ خالی برای لیدهای جدید.`)
  return out
}
