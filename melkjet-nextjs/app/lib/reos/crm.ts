// REOS v2 · CRM OS — هستهٔ یکپارچهٔ CRM (pipeline/activities/tasks/meetings/automations/
// conversion/timeline). افزایشی و backward-compatible: Sales-OSهای per-role دست‌نخورده می‌مانند.
// طرحِ تک‌جدولی (reos_crm: kind + data jsonb) برای کم‌ریسک‌بودن. Dual-mode PG/file.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import { predictLeadConversion } from './ml'

export type Stage = 'new' | 'contacted' | 'qualified' | 'visit' | 'negotiation' | 'won' | 'lost'
export const STAGES: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'won', 'lost']
export type Kind = 'lead' | 'activity' | 'task' | 'meeting' | 'automation'

export interface Lead { id: string; ownerId: string; name: string; phone?: string; email?: string; source?: string; stage: Stage; score: number; value?: number; tags?: string[]; at: number; updatedAt: number }
export interface Activity { id: string; ownerId: string; leadId: string; type: 'note' | 'call' | 'sms' | 'email' | 'meeting' | 'stage'; text: string; at: number }
export interface Task { id: string; ownerId: string; leadId?: string; title: string; dueAt?: number; done: boolean; at: number }
export interface Meeting { id: string; ownerId: string; leadId?: string; title: string; at: number; location?: string }
export interface Automation { id: string; ownerId: string; trigger: 'new_lead' | 'idle' | 'stage_change'; params: { days?: number; stage?: Stage }; action: 'create_task' | 'move_stage' | 'add_activity'; actionParams: { title?: string; toStage?: Stage; text?: string }; active: boolean; at: number }

interface Row { id: string; kind: Kind; ownerId: string; leadId: string | null; at: number; data: object }
const FILE = join(process.cwd(), '.reos-crm.json')
function uid(p: string) { return p + randomBytes(6).toString('hex') }
function fileLoad(): Row[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }

let ready = false
async function ensure() {
  if (ready) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_crm (
      id text PRIMARY KEY, kind text NOT NULL, owner_id text NOT NULL, lead_id text, at bigint NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_crm_kind_owner ON reos_crm(kind, owner_id)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_crm_lead ON reos_crm(lead_id)`)
  })
  ready = true
}

// ── CRUDِ عمومیِ dual-mode ──
async function put(row: Row): Promise<void> {
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_crm(id,kind,owner_id,lead_id,at,data) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, lead_id=EXCLUDED.lead_id`, [row.id, row.kind, row.ownerId, row.leadId, row.at, JSON.stringify(row.data)]))
  } else { const db = fileLoad(); const i = db.findIndex(r => r.id === row.id); if (i >= 0) db[i] = row; else db.push(row); fileSave(db) }
}
async function query(kind: Kind, ownerId?: string, leadId?: string): Promise<Row[]> {
  if (pgEnabled()) {
    await ensure()
    const cond = ['kind=$1'], params: unknown[] = [kind]
    if (ownerId) { params.push(ownerId); cond.push(`owner_id=$${params.length}`) }
    if (leadId) { params.push(leadId); cond.push(`lead_id=$${params.length}`) }
    const r = await pgTx(c => c.query(`SELECT * FROM reos_crm WHERE ${cond.join(' AND ')} ORDER BY at DESC LIMIT 2000`, params))
    return r.rows.map(x => ({ id: x.id, kind: x.kind, ownerId: x.owner_id, leadId: x.lead_id, at: Number(x.at), data: x.data || {} }))
  }
  return fileLoad().filter(r => r.kind === kind && (!ownerId || r.ownerId === ownerId) && (!leadId || r.leadId === leadId)).sort((a, b) => b.at - a.at)
}
async function byId(id: string): Promise<Row | null> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_crm WHERE id=$1`, [id])); const x = r.rows[0]; return x ? { id: x.id, kind: x.kind, ownerId: x.owner_id, leadId: x.lead_id, at: Number(x.at), data: x.data || {} } : null }
  return fileLoad().find(r => r.id === id) || null
}

// ── Leads + pipeline ──
const rowToLead = (r: Row): Lead => ({ id: r.id, ownerId: r.ownerId, at: r.at, ...(r.data as object) } as Lead)

export async function createLead(input: { ownerId: string; name: string; phone?: string; email?: string; source?: string; stage?: Stage; value?: number; tags?: string[] }): Promise<Lead> {
  const now = Date.now()
  const stage = input.stage || 'new'
  const score = leadScore({ phone: input.phone, email: input.email, stage, activityCount: 0 })
  const lead: Lead = { id: uid('lead_'), ownerId: input.ownerId, name: input.name, phone: input.phone, email: input.email, source: input.source, stage, score, value: input.value, tags: input.tags || [], at: now, updatedAt: now }
  await put({ id: lead.id, kind: 'lead', ownerId: lead.ownerId, leadId: lead.id, at: now, data: lead })
  await runAutomationsFor('new_lead', lead).catch(() => {})
  return lead
}

function leadScore(l: { phone?: string; email?: string; stage: Stage; activityCount: number }): number {
  return Math.round(predictLeadConversion({ phone: l.phone, email: l.email, stage: l.stage, activityCount: l.activityCount }).value * 100)
}

export async function listLeads(ownerId: string, opts: { stage?: Stage } = {}): Promise<Lead[]> {
  const rows = await query('lead', ownerId)
  const leads = rows.map(rowToLead)
  return opts.stage ? leads.filter(l => l.stage === opts.stage) : leads
}
export async function getLead(id: string): Promise<Lead | null> { const r = await byId(id); return r && r.kind === 'lead' ? rowToLead(r) : null }

export async function moveStage(leadId: string, toStage: Stage): Promise<Lead | null> {
  const r = await byId(leadId); if (!r || r.kind !== 'lead') return null
  const lead = rowToLead(r); const from = lead.stage
  lead.stage = toStage; lead.updatedAt = Date.now()
  const acts = (await listActivities(leadId)).length
  lead.score = leadScore({ phone: lead.phone, email: lead.email, stage: toStage, activityCount: acts })
  await put({ id: lead.id, kind: 'lead', ownerId: lead.ownerId, leadId: lead.id, at: r.at, data: lead })
  await addActivity({ ownerId: lead.ownerId, leadId, type: 'stage', text: `مرحله: ${from} → ${toStage}` })
  await runAutomationsFor('stage_change', lead).catch(() => {})
  return lead
}

// ── Activities + timeline ──
export async function addActivity(input: { ownerId: string; leadId: string; type: Activity['type']; text: string }): Promise<Activity> {
  const a: Activity = { id: uid('act_'), ownerId: input.ownerId, leadId: input.leadId, type: input.type, text: input.text, at: Date.now() }
  await put({ id: a.id, kind: 'activity', ownerId: a.ownerId, leadId: a.leadId, at: a.at, data: a })
  // به‌روزرسانیِ امتیازِ لید با هر فعالیت
  const r = await byId(input.leadId)
  if (r && r.kind === 'lead') { const lead = rowToLead(r); const acts = (await listActivities(input.leadId)).length; lead.score = leadScore({ phone: lead.phone, email: lead.email, stage: lead.stage, activityCount: acts }); lead.updatedAt = Date.now(); await put({ id: lead.id, kind: 'lead', ownerId: lead.ownerId, leadId: lead.id, at: r.at, data: lead }) }
  return a
}
export async function listActivities(leadId: string): Promise<Activity[]> { return (await query('activity', undefined, leadId)).map(r => r.data as unknown as Activity) }

// خطِ زمانِ ادغام‌شده (activity + task + meeting) برای یک لید.
export async function timeline(leadId: string): Promise<{ kind: string; text: string; at: number }[]> {
  const [acts, tasks, meets] = await Promise.all([listActivities(leadId), query('task', undefined, leadId), query('meeting', undefined, leadId)])
  const items = [
    ...acts.map(a => ({ kind: 'activity:' + a.type, text: a.text, at: a.at })),
    ...tasks.map(t => ({ kind: 'task', text: (t.data as unknown as Task).title, at: t.at })),
    ...meets.map(m => ({ kind: 'meeting', text: (m.data as unknown as Meeting).title, at: m.at })),
  ]
  return items.sort((a, b) => b.at - a.at)
}

// ── Tasks ──
export async function createTask(input: { ownerId: string; leadId?: string; title: string; dueAt?: number }): Promise<Task> {
  const t: Task = { id: uid('task_'), ownerId: input.ownerId, leadId: input.leadId, title: input.title, dueAt: input.dueAt, done: false, at: Date.now() }
  await put({ id: t.id, kind: 'task', ownerId: t.ownerId, leadId: t.leadId || null, at: t.at, data: t })
  return t
}
export async function completeTask(id: string): Promise<void> { const r = await byId(id); if (r && r.kind === 'task') { const t = r.data as unknown as Task; t.done = true; await put({ ...r, data: t }) } }
export async function listTasks(ownerId: string, opts: { open?: boolean } = {}): Promise<Task[]> {
  const t = (await query('task', ownerId)).map(r => r.data as unknown as Task)
  return opts.open ? t.filter(x => !x.done) : t
}

// ── Meetings ──
export async function createMeeting(input: { ownerId: string; leadId?: string; title: string; at: number; location?: string }): Promise<Meeting> {
  const m: Meeting = { id: uid('meet_'), ownerId: input.ownerId, leadId: input.leadId, title: input.title, at: input.at, location: input.location }
  await put({ id: m.id, kind: 'meeting', ownerId: m.ownerId, leadId: m.leadId || null, at: m.at, data: m })
  return m
}
export async function listMeetings(ownerId: string): Promise<Meeting[]> { return (await query('meeting', ownerId)).map(r => r.data as unknown as Meeting) }

// ── Conversion funnel ──
export async function funnel(ownerId: string): Promise<{ byStage: Record<Stage, number>; total: number; won: number; conversionRate: number }> {
  const leads = await listLeads(ownerId)
  const byStage = Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>
  for (const l of leads) byStage[l.stage] = (byStage[l.stage] || 0) + 1
  const total = leads.length, won = byStage.won || 0
  return { byStage, total, won, conversionRate: total ? Math.round((won / total) * 1000) / 10 : 0 }
}

// ── Automations ──
export async function createAutomation(input: Omit<Automation, 'id' | 'at' | 'active'> & { active?: boolean }): Promise<Automation> {
  const a: Automation = { id: uid('auto_'), active: input.active !== false, at: Date.now(), ownerId: input.ownerId, trigger: input.trigger, params: input.params || {}, action: input.action, actionParams: input.actionParams || {} }
  await put({ id: a.id, kind: 'automation', ownerId: a.ownerId, leadId: null, at: a.at, data: a })
  return a
}
export async function listAutomations(ownerId: string): Promise<Automation[]> { return (await query('automation', ownerId)).map(r => r.data as unknown as Automation) }

// اجرای اتوماسیون‌هایِ رویدادی (new_lead/stage_change) برای یک لید.
async function runAutomationsFor(trigger: 'new_lead' | 'stage_change', lead: Lead): Promise<number> {
  const autos = (await listAutomations(lead.ownerId)).filter(a => a.active && a.trigger === trigger)
  let n = 0
  for (const a of autos) {
    if (trigger === 'stage_change' && a.params.stage && a.params.stage !== lead.stage) continue
    n += await applyAction(a, lead)
  }
  return n
}
async function applyAction(a: Automation, lead: Lead): Promise<number> {
  if (a.action === 'create_task') { await createTask({ ownerId: lead.ownerId, leadId: lead.id, title: a.actionParams.title || 'پیگیری', dueAt: Date.now() + 2 * 864e5 }); return 1 }
  if (a.action === 'add_activity') { await addActivity({ ownerId: lead.ownerId, leadId: lead.id, type: 'note', text: a.actionParams.text || 'یادداشتِ خودکار' }); return 1 }
  if (a.action === 'move_stage' && a.actionParams.toStage && a.actionParams.toStage !== lead.stage) { await moveStage(lead.id, a.actionParams.toStage); return 1 }
  return 0
}

// اجرای زمان‌بندِ اتوماسیونِ idle: لیدهایی که > N روز بی‌فعالیت مانده‌اند (برای cron).
export async function runIdleAutomations(ownerId?: string, now = Date.now()): Promise<number> {
  const owners = ownerId ? [ownerId] : Array.from(new Set((await query('automation')).map(r => r.ownerId)))
  let acted = 0
  for (const oid of owners) {
    const idleRules = (await listAutomations(oid)).filter(a => a.active && a.trigger === 'idle')
    if (!idleRules.length) continue
    const leads = (await listLeads(oid)).filter(l => l.stage !== 'won' && l.stage !== 'lost')
    for (const lead of leads) {
      if (lead.updatedAt > now - (24 * 864e5)) { /* recently touched, skip cheap */ }
      for (const rule of idleRules) {
        const days = rule.params.days || 3
        if (now - lead.updatedAt >= days * 864e5) { acted += await applyAction(rule, lead) }
      }
    }
  }
  return acted
}
