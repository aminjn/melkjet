import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file store for CRM leads / sales pipeline.
// Mirrors the persistence style of crm-store.ts and pros-store.ts.
const DATA_FILE = join(process.cwd(), '.leads-data.json')

export type Stage = 'new' | 'review' | 'offered' | 'contract' | 'lost'

export interface Lead {
  id: string
  name: string
  phone?: string
  need?: string
  budget?: string
  stage: Stage
  score?: number
  note?: string
  owner?: string
  createdAt: number
  updatedAt: number
}

interface DB { leads: Lead[] }

const STAGES: Stage[] = ['new', 'review', 'offered', 'contract', 'lost']

function id() { return randomBytes(6).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
      return { leads: Array.isArray(raw.leads) ? raw.leads : [] }
    } catch {}
  }
  return { leads: [] }
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function listLeads(owner: string): Lead[] {
  return load().leads
    .filter(l => l.owner === owner)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export interface LeadInput {
  name: string
  phone?: string
  need?: string
  budget?: string
  stage?: Stage
  score?: number
  note?: string
  owner?: string
}

export function addLead(owner: string, input: LeadInput): Lead {
  const db = load()
  const now = Date.now()
  const stage: Stage = input.stage && STAGES.includes(input.stage) ? input.stage : 'new'
  const lead: Lead = {
    id: id(),
    name: String(input.name || '').trim(),
    phone: input.phone,
    need: input.need,
    budget: input.budget,
    stage,
    score: input.score,
    note: input.note,
    owner,
    createdAt: now,
    updatedAt: now,
  }
  db.leads.unshift(lead)
  save(db)
  return lead
}

export type LeadPatch = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>

export function updateLead(owner: string, leadId: string, patch: LeadPatch): Lead | null {
  const db = load()
  const lead = db.leads.find(x => x.id === leadId && x.owner === owner)
  if (!lead) return null
  if (patch.name !== undefined) lead.name = String(patch.name).trim()
  if (patch.phone !== undefined) lead.phone = patch.phone
  if (patch.need !== undefined) lead.need = patch.need
  if (patch.budget !== undefined) lead.budget = patch.budget
  if (patch.stage !== undefined && STAGES.includes(patch.stage)) lead.stage = patch.stage
  if (patch.score !== undefined) lead.score = patch.score
  if (patch.note !== undefined) lead.note = patch.note
  lead.updatedAt = Date.now()
  save(db)
  return lead
}

export function deleteLead(owner: string, leadId: string): void {
  const db = load()
  db.leads = db.leads.filter(x => !(x.id === leadId && x.owner === owner))
  save(db)
}
