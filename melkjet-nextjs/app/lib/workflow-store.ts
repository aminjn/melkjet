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

export function listWorkflows(): Workflow[] {
  return load().workflows.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getWorkflow(workflowId: string): Workflow | null {
  return load().workflows.find(w => w.id === workflowId) ?? null
}

export function saveWorkflow(input: {
  id?: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
}): Workflow {
  const db = load()
  const wf: Workflow = {
    id: input.id && input.id.trim() ? input.id : id(),
    name: String(input.name || '').trim() || 'گردش کار بدون نام',
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    connections: Array.isArray(input.connections) ? input.connections : [],
    updatedAt: Date.now(),
  }
  const idx = db.workflows.findIndex(w => w.id === wf.id)
  if (idx >= 0) db.workflows[idx] = wf
  else db.workflows.unshift(wf)
  persist(db)
  return wf
}

export function removeWorkflow(workflowId: string): void {
  const db = load()
  db.workflows = db.workflows.filter(w => w.id !== workflowId)
  persist(db)
}
