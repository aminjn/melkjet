import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Dependency-free JSON-file store for saved automation workflows.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.workflow-data.json')

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

interface DB { workflows: Workflow[] }

function id() { return randomBytes(6).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { workflows: [] }
}

function persist(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function listWorkflows(owner: string): Workflow[] {
  return load().workflows
    .filter(w => w.owner === owner)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getWorkflow(owner: string, workflowId: string): Workflow | null {
  return load().workflows.find(w => w.id === workflowId && w.owner === owner) ?? null
}

// همهٔ گردش‌کارها (برای موتورِ اجرا) — مستقل از مالک.
export function allWorkflows(): Workflow[] { return load().workflows }

export function saveWorkflow(owner: string, input: {
  id?: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  enabled?: boolean
}): Workflow {
  const db = load()
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
  persist(db)
  return wf
}

export function removeWorkflow(owner: string, workflowId: string): void {
  const db = load()
  db.workflows = db.workflows.filter(w => !(w.id === workflowId && w.owner === owner))
  persist(db)
}
