// REOS v5 · Autonomous Agent — حلقهٔ Observe→Think→Plan→Execute→Measure.
// دستیارِ خودرانِ مشاور: لیدهای داغ/خوابیده و آگهی‌های ضعیف را می‌بیند، اولویت‌بندی و اقدام می‌کند.
import { listLeads, createTask, addActivity, type Lead } from './crm'

export type AutoActionType = 'follow_hot' | 'revive_stale' | 'fix_listing'
export interface AutoAction { type: AutoActionType; targetId: string; priority: number; reason: string }

export interface ObservedState { hotLeads: { id: string; score: number }[]; staleLeads: { id: string; idleDays: number }[]; weakListings: { id: string; health: number }[] }

// Think + Plan (خالص): از وضعیت، فهرستِ اقدامِ اولویت‌دار می‌سازد. لیدِ داغ اول، بعد احیای خوابیده، بعد اصلاحِ آگهی.
export function planAutonomous(state: ObservedState, limit = 10): AutoAction[] {
  const actions: AutoAction[] = []
  for (const l of state.hotLeads) actions.push({ type: 'follow_hot', targetId: l.id, priority: 90 + Math.min(9, Math.round(l.score / 12)), reason: `لیدِ داغ (امتیاز ${l.score}) — تماسِ فوری` })
  for (const l of state.staleLeads) actions.push({ type: 'revive_stale', targetId: l.id, priority: 50 + Math.min(20, l.idleDays), reason: `${l.idleDays} روز بی‌فعالیت — پیگیری کنید` })
  for (const w of state.weakListings) actions.push({ type: 'fix_listing', targetId: w.id, priority: 30 + Math.round((100 - w.health) / 5), reason: `آگهیِ ضعیف (سلامت ${w.health}) — عنوان/عکس/قیمت را بهبود دهید` })
  return actions.sort((a, b) => b.priority - a.priority).slice(0, limit)
}

// Observe: وضعیتِ مشاور را از CRM جمع می‌کند (آگهی‌های ضعیف اختیاری از بیرون تزریق می‌شوند).
export async function observeState(ownerId: string, now = Date.now(), weakListings: { id: string; health: number }[] = []): Promise<ObservedState> {
  const leads = await listLeads(ownerId)
  const active = leads.filter(l => l.stage !== 'won' && l.stage !== 'lost')
  return {
    hotLeads: active.filter(l => l.score >= 66).map(l => ({ id: l.id, score: l.score })),
    staleLeads: active.filter(l => (now - l.updatedAt) / 864e5 >= 3).map(l => ({ id: l.id, idleDays: Math.floor((now - l.updatedAt) / 864e5) })),
    weakListings,
  }
}

// Execute: اقدام‌های داخلی را اجرا می‌کند (ساختِ تسک + ثبتِ یادداشت). خروجی: تعدادِ اقدامِ اجراشده.
export async function executeAutonomous(ownerId: string, actions: AutoAction[]): Promise<number> {
  let n = 0
  for (const a of actions) {
    const title = a.type === 'follow_hot' ? 'تماسِ فوری با لیدِ داغ' : a.type === 'revive_stale' ? 'پیگیریِ لیدِ خوابیده' : 'بهبودِ آگهیِ ضعیف'
    try {
      await createTask({ ownerId, leadId: a.type === 'fix_listing' ? undefined : a.targetId, title: `${title} — ${a.reason}`, dueAt: Date.now() + 864e5 })
      if (a.type !== 'fix_listing') await addActivity({ ownerId, leadId: a.targetId, type: 'note', text: `🤖 دستیارِ خودران: ${a.reason}` }).catch(() => {})
      n++
    } catch { /* اقدامِ خاص شکست خورد */ }
  }
  return n
}

// حلقهٔ کامل (برای cron/دکمه): observe → plan → execute.
export async function runAutonomous(ownerId: string, weakListings: { id: string; health: number }[] = []): Promise<{ plan: AutoAction[]; executed: number }> {
  const state = await observeState(ownerId, Date.now(), weakListings)
  const plan = planAutonomous(state)
  const executed = await executeAutonomous(ownerId, plan)
  return { plan, executed }
}
