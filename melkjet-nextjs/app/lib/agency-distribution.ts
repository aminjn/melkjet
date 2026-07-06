import type { Agent, Lead, Listing } from './agency-store'

// ── موتورِ تقسیمِ خودکارِ لید + مدیریتِ تداخلِ لید (آژانس) ──
// معیارهای تقسیم: عملکردِ مشاور (معاملات) + تعادلِ بار (لیدهای بازِ کمتر) +
// تطبیقِ منطقه/تخصص (از روی فایل‌های همان مشاور).

const norm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const tokens = (s?: string) => norm(s).split(/[،,\s/\-]+/).filter(t => t.length > 1)

// مجموعهٔ منطقه‌ها/نوع‌هایی که یک مشاور با آن‌ها کار کرده (از فایل‌های منتسب به او).
function agentExpertise(agent: Agent, listings: Listing[]): Set<string> {
  const set = new Set<string>()
  for (const l of listings) {
    if (norm(l.agent) !== norm(agent.name)) continue
    tokens(l.location).forEach(t => set.add(t))
    tokens(l.ptype).forEach(t => set.add(t))
    tokens(l.district).forEach(t => set.add(t))
    tokens(l.neighborhood).forEach(t => set.add(t))
  }
  return set
}

export interface DistributeReason { agent: string; score: number; reasons: string[] }

// امتیازِ تخصیصِ یک لید به یک مشاور. openLoad = تعدادِ لیدِ بازِ فعلیِ آن مشاور.
export function assignScore(lead: Lead, agent: Agent, listings: Listing[], openLoad: number): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let s = 0
  // عملکرد (معاملاتِ بسته‌شده)
  const perf = Math.min(30, agent.deals * 5)
  if (perf) { s += perf; reasons.push('عملکردِ خوب') }
  // تعادلِ بار — مشاورِ کم‌بارتر اولویت دارد
  const bal = Math.max(0, 22 - openLoad * 5)
  s += bal
  if (openLoad === 0) reasons.push('ظرفیتِ خالی')
  // تطبیقِ منطقه/تخصص
  const exp = agentExpertise(agent, listings)
  const wants = new Set([...tokens(lead.need), ...tokens(lead.budget)])
  const overlap = [...wants].filter(w => exp.has(w))
  if (overlap.length) { s += Math.min(30, overlap.length * 12); reasons.push('تخصصِ منطقه/نوع می‌خورد') }
  return { score: Math.round(s), reasons }
}

export interface Assignment { leadId: string; leadName: string; agentName: string; score: number; reasons: string[] }

// همهٔ لیدهای تقسیم‌نشده (بدونِ assignedTo یا مرحلهٔ new) را بینِ مشاورانِ فعال پخش می‌کند.
export function planDistribution(leads: Lead[], agents: Agent[], listings: Listing[]): Assignment[] {
  const active = agents.filter(a => a.active)
  if (!active.length) return []
  // بارِ اولیهٔ هر مشاور = لیدهای بازِ منتسب به او
  const load = new Map<string, number>()
  for (const a of active) load.set(a.name, 0)
  for (const l of leads) if (l.assignedTo && l.stage !== 'closed' && l.stage !== 'lost') load.set(l.assignedTo, (load.get(l.assignedTo) || 0) + 1)

  const unassigned = leads.filter(l => !l.assignedTo && l.stage !== 'closed' && l.stage !== 'lost')
  const out: Assignment[] = []
  // لیدهای باارزش‌تر (بودجهٔ بالاتر) اول تقسیم شوند تا به بهترین مشاور برسند.
  const budgetNum = (b?: string) => Number(String(b || '').replace(/[^\d]/g, '')) || 0
  unassigned.sort((a, b) => budgetNum(b.budget) - budgetNum(a.budget))
  for (const lead of unassigned) {
    let best: { agent: Agent; score: number; reasons: string[] } | null = null
    for (const agent of active) {
      const r = assignScore(lead, agent, listings, load.get(agent.name) || 0)
      if (!best || r.score > best.score) best = { agent, score: r.score, reasons: r.reasons }
    }
    if (best) {
      out.push({ leadId: lead.id, leadName: lead.name, agentName: best.agent.name, score: best.score, reasons: best.reasons })
      load.set(best.agent.name, (load.get(best.agent.name) || 0) + 1)  // بار را به‌روز کن تا نفرِ بعدی متعادل پخش شود
    }
  }
  return out
}

export interface ConflictGroup { key: string; kind: 'phone' | 'name'; leads: { id: string; name: string; phone?: string; assignedTo?: string; stage: string }[] }

// تداخلِ لید: لیدهای تکراری (همان شماره، یا همان نام) — تا دو مشاور روی یک نفر کار نکنند.
export function findConflicts(leads: Lead[]): ConflictGroup[] {
  const byPhone = new Map<string, Lead[]>()
  const byName = new Map<string, Lead[]>()
  for (const l of leads) {
    if (l.stage === 'closed' || l.stage === 'lost') continue
    const ph = (l.phone || '').replace(/\D/g, '')
    if (ph.length >= 7) { const a = byPhone.get(ph) || []; a.push(l); byPhone.set(ph, a) }
    const nm = norm(l.name)
    if (nm.length > 2) { const a = byName.get(nm) || []; a.push(l); byName.set(nm, a) }
  }
  const groups: ConflictGroup[] = []
  const seen = new Set<string>()
  for (const [ph, ls] of byPhone) if (ls.length > 1) { ls.forEach(l => seen.add(l.id)); groups.push({ key: ph, kind: 'phone', leads: ls.map(l => ({ id: l.id, name: l.name, phone: l.phone, assignedTo: l.assignedTo, stage: l.stage })) }) }
  for (const [nm, ls] of byName) if (ls.length > 1 && !ls.every(l => seen.has(l.id))) groups.push({ key: nm, kind: 'name', leads: ls.map(l => ({ id: l.id, name: l.name, phone: l.phone, assignedTo: l.assignedTo, stage: l.stage })) })
  return groups
}
