// REOS v3 · Workflow Builder — موتورِ IF/THEN کاربرساز (مثلِ HubSpot).
// «اگر لید ۳ روز خوابید → پیامک بفرست + تسک بساز + مرحله را جابه‌جا کن». تعمیمِ automationِ CRM
// به یک DSLِ عمومیِ شرط/اقدام. Dual-mode PG/file. اقدام‌های داخلی از هستهٔ CRM اجرا می‌شوند.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import { createTask, moveStage, addActivity, listLeads, type Stage, type Lead } from './crm'

export type WfTrigger = 'lead_idle' | 'lead_created' | 'stage_changed' | 'manual'
export type WfOp = 'eq' | 'neq' | 'gte' | 'lte' | 'contains'
export type WfActionType = 'create_task' | 'move_stage' | 'add_activity' | 'send_sms' | 'increase_priority' | 'notify'
export interface WfCondition { field: string; op: WfOp; value: string | number }
export interface WfAction { type: WfActionType; params: Record<string, unknown> }
export interface Workflow { id: string; ownerId: string; name: string; trigger: WfTrigger; conditions: WfCondition[]; actions: WfAction[]; active: boolean; runs: number; at: number }

const FILE = join(process.cwd(), '.reos-workflows.json')
function uid() { return 'wf_' + randomBytes(6).toString('hex') }
function fileLoad(): Workflow[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }

let ready = false
async function ensure() {
  if (ready) return
  await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_workflows (
    id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL, trigger text NOT NULL,
    conditions jsonb NOT NULL DEFAULT '[]'::jsonb, actions jsonb NOT NULL DEFAULT '[]'::jsonb,
    active boolean NOT NULL DEFAULT true, runs integer NOT NULL DEFAULT 0, at bigint NOT NULL )`))
  await pgTx(c => c.query(`CREATE INDEX IF NOT EXISTS reos_workflows_owner ON reos_workflows(owner_id)`))
  ready = true
}
const rowToWf = (r: Record<string, unknown>): Workflow => ({ id: r.id as string, ownerId: r.owner_id as string, name: r.name as string, trigger: r.trigger as WfTrigger, conditions: (r.conditions as WfCondition[]) || [], actions: (r.actions as WfAction[]) || [], active: r.active as boolean, runs: Number(r.runs), at: Number(r.at) })

export async function createWorkflow(input: { ownerId: string; name: string; trigger: WfTrigger; conditions?: WfCondition[]; actions?: WfAction[] }): Promise<Workflow> {
  const wf: Workflow = { id: uid(), ownerId: input.ownerId, name: input.name, trigger: input.trigger, conditions: input.conditions || [], actions: input.actions || [], active: true, runs: 0, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_workflows(id,owner_id,name,trigger,conditions,actions,active,runs,at) VALUES($1,$2,$3,$4,$5,$6,true,0,$7)`, [wf.id, wf.ownerId, wf.name, wf.trigger, JSON.stringify(wf.conditions), JSON.stringify(wf.actions), wf.at])) }
  else { const db = fileLoad(); db.push(wf); fileSave(db) }
  return wf
}
export async function listWorkflows(ownerId: string): Promise<Workflow[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_workflows WHERE owner_id=$1 ORDER BY at DESC`, [ownerId])); return r.rows.map(rowToWf) }
  return fileLoad().filter(w => w.ownerId === ownerId)
}
export async function setWorkflowActive(id: string, active: boolean): Promise<void> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_workflows SET active=$2 WHERE id=$1`, [id, active])) }
  else { const db = fileLoad(); const w = db.find(x => x.id === id); if (w) { w.active = active; fileSave(db) } }
}
async function bumpRuns(id: string) {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_workflows SET runs=runs+1 WHERE id=$1`, [id])).catch(() => {}) }
  else { const db = fileLoad(); const w = db.find(x => x.id === id); if (w) { w.runs++; fileSave(db) } }
}

// ── ارزیابیِ شرط (خالص، تست‌پذیر) ──
export function evalCondition(cond: WfCondition, ctx: Record<string, unknown>): boolean {
  const v = ctx[cond.field]
  switch (cond.op) {
    case 'eq': return String(v) === String(cond.value)
    case 'neq': return String(v) !== String(cond.value)
    case 'gte': return Number(v) >= Number(cond.value)
    case 'lte': return Number(v) <= Number(cond.value)
    case 'contains': return String(v ?? '').includes(String(cond.value))
    default: return false
  }
}
export function matchWorkflow(wf: Workflow, ctx: Record<string, unknown>): boolean { return wf.conditions.every(c => evalCondition(c, ctx)) }

// زمینهٔ یک لید برای ارزیابیِ شرط‌ها.
export function leadContext(lead: Lead, now = Date.now()): Record<string, unknown> {
  return { stage: lead.stage, score: lead.score, source: lead.source || '', value: lead.value || 0, idleDays: Math.floor((now - lead.updatedAt) / 864e5), tags: (lead.tags || []).join(',') }
}

// اجرای یک اقدام روی یک لید. اقدام‌های داخلی از CRM؛ اقدام‌های بیرونی (SMS/notify) در outbox ثبت می‌شوند.
export interface ActionResult { type: WfActionType; ok: boolean; detail?: string }
export async function executeAction(action: WfAction, lead: Lead): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_task': await createTask({ ownerId: lead.ownerId, leadId: lead.id, title: String(action.params.title || 'اقدامِ گردش‌کار'), dueAt: Date.now() + 2 * 864e5 }); return { type: action.type, ok: true }
      case 'move_stage': await moveStage(lead.id, String(action.params.toStage || 'contacted') as Stage); return { type: action.type, ok: true }
      case 'add_activity': await addActivity({ ownerId: lead.ownerId, leadId: lead.id, type: 'note', text: String(action.params.text || 'یادداشتِ گردش‌کار') }); return { type: action.type, ok: true }
      case 'increase_priority': await addActivity({ ownerId: lead.ownerId, leadId: lead.id, type: 'note', text: '⬆️ اولویت افزایش یافت (گردش‌کار)' }); return { type: action.type, ok: true }
      case 'send_sms': await recordOutbox('sms', lead, String(action.params.text || '')); return { type: action.type, ok: true, detail: 'صف‌بندی شد' }
      case 'notify': await recordOutbox('notify', lead, String(action.params.text || '')); return { type: action.type, ok: true, detail: 'صف‌بندی شد' }
      default: return { type: action.type, ok: false, detail: 'اقدامِ ناشناخته' }
    }
  } catch (e) { return { type: action.type, ok: false, detail: (e as Error)?.message } }
}

// outbox برای اقدام‌های ارتباطی (بعداً به SMS/WhatsAppِ واقعی وصل می‌شود).
const OUTBOX = join(process.cwd(), '.reos-wf-outbox.json')
async function recordOutbox(channel: string, lead: Lead, text: string) {
  try { let db: unknown[] = []; if (existsSync(OUTBOX)) db = JSON.parse(readFileSync(OUTBOX, 'utf-8')); db.unshift({ channel, leadId: lead.id, phone: lead.phone, text, at: Date.now() }); if (db.length > 5000) db.length = 5000; writeFileSync(OUTBOX, JSON.stringify(db)) } catch {}
}

// اجرای گردش‌کارها روی لیدهای یک مالک برای یک تریگر — actual runner (cron/رویداد).
export async function runWorkflows(ownerId: string, trigger: WfTrigger, now = Date.now()): Promise<{ matched: number; actions: ActionResult[] }> {
  const wfs = (await listWorkflows(ownerId)).filter(w => w.active && w.trigger === trigger)
  if (!wfs.length) return { matched: 0, actions: [] }
  const leads = (await listLeads(ownerId)).filter(l => l.stage !== 'won' && l.stage !== 'lost')
  let matched = 0; const actions: ActionResult[] = []
  for (const wf of wfs) {
    let firedForWf = false
    for (const lead of leads) {
      if (!matchWorkflow(wf, leadContext(lead, now))) continue
      matched++; firedForWf = true
      for (const a of wf.actions) actions.push(await executeAction(a, lead))
    }
    if (firedForWf) await bumpRuns(wf.id)
  }
  return { matched, actions }
}

// اجرای همهٔ مالکان برای تریگرِ زمان‌بندی‌شده (idle) — برای cron.
export async function runAllIdleWorkflows(now = Date.now()): Promise<number> {
  let owners: string[] = []
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT DISTINCT owner_id FROM reos_workflows WHERE active AND trigger='lead_idle'`)); owners = r.rows.map(x => x.owner_id as string) }
  else owners = Array.from(new Set(fileLoad().filter(w => w.active && w.trigger === 'lead_idle').map(w => w.ownerId)))
  let total = 0
  for (const o of owners) { const r = await runWorkflows(o, 'lead_idle', now); total += r.actions.length }
  return total
}
