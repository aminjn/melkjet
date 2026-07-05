import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// Dependency-free JSON-file store for saved automation workflows.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.workflow-data.json')
const KV_KEY = 'workflow'

export interface WorkflowNode {
  id: string
  label: string
  type: string
  x: number
  y: number
  config: Record<string, string>
}

export interface WorkflowConnection {
  from: string
  to: string
}

export interface Workflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  owner?: string
  enabled?: boolean   // تا فعال نشود، اتوماسیون اجرا نمی‌شود (پیش‌فرض: خاموش)
  updatedAt: number
}

interface DB { workflows: Workflow[]; seeded?: string[] }

function id() { return randomBytes(6).toString('hex') }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { workflows: [] }
}

function fileSave(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { workflows: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { workflows: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

export async function listWorkflows(owner: string): Promise<Workflow[]> {
  return (await load()).workflows
    .filter(w => w.owner === owner)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getWorkflow(owner: string, workflowId: string): Promise<Workflow | null> {
  return (await load()).workflows.find(w => w.id === workflowId && w.owner === owner) ?? null
}

// همهٔ گردش‌کارها (برای موتورِ اجرا) — مستقل از مالک.
export async function allWorkflows(): Promise<Workflow[]> { return (await load()).workflows }

export async function saveWorkflow(owner: string, input: {
  id?: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  enabled?: boolean
}): Promise<Workflow> {
  return mutate((db) => {
    const existing = input.id && input.id.trim()
      ? db.workflows.find(w => w.id === input.id && w.owner === owner)
      : undefined
    const wf: Workflow = {
      id: existing ? existing.id : id(),
      name: String(input.name || '').trim() || 'گردش کار بدون نام',
      nodes: Array.isArray(input.nodes) ? input.nodes : [],
      connections: Array.isArray(input.connections) ? input.connections : [],
      owner,
      enabled: input.enabled !== undefined ? !!input.enabled : (existing?.enabled ?? false),
      updatedAt: Date.now(),
    }
    if (existing) {
      const idx = db.workflows.findIndex(w => w.id === existing.id)
      db.workflows[idx] = wf
    } else {
      db.workflows.unshift(wf)
    }
    return wf
  })
}

export async function removeWorkflow(owner: string, workflowId: string): Promise<void> {
  await mutate((db) => {
    db.workflows = db.workflows.filter(w => !(w.id === workflowId && w.owner === owner))
  })
}

// اتوماسیون‌های پیش‌فرضِ صنفی را یک‌بار برای هر کاربر می‌سازد (خاموش). با «seeded» علامت می‌زنیم
// تا اگر کاربر همه را حذف کرد، دوباره ساخته نشوند.
export async function ensureDefaultWorkflows(owner: string, dash: string): Promise<void> {
  const { roleDefaultWorkflows } = await import('./workflow-defaults')
  await mutate((db) => {
    const seeded = db.seeded || (db.seeded = [])
    if (seeded.includes(owner)) return
    seeded.push(owner)
    const now = Date.now()
    for (const d of roleDefaultWorkflows(dash)) {
      db.workflows.unshift({ id: id(), name: d.name, nodes: d.nodes, connections: d.connections, owner, enabled: false, updatedAt: now })
    }
  })
}
