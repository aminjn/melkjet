import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// استورِ لیدهای CRM. دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.leads-data.json')
const KV_KEY = 'leads'

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
const EMPTY: DB = { leads: [] }
const STAGES: Stage[] = ['new', 'review', 'offered', 'contract', 'lost']
function id() { return randomBytes(6).toString('hex') }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8')); return { leads: Array.isArray(raw.leads) ? raw.leads : [] } } catch {}
  }
  return { leads: [] }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { leads: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { leads: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}
void EMPTY

export async function listLeads(owner: string): Promise<Lead[]> {
  return (await load()).leads.filter(l => l.owner === owner).sort((a, b) => b.createdAt - a.createdAt)
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

export async function addLead(owner: string, input: LeadInput): Promise<Lead> {
  return mutate((db) => {
    const now = Date.now()
    const stage: Stage = input.stage && STAGES.includes(input.stage) ? input.stage : 'new'
    const lead: Lead = {
      id: id(), name: String(input.name || '').trim(), phone: input.phone, need: input.need,
      budget: input.budget, stage, score: input.score, note: input.note, owner, createdAt: now, updatedAt: now,
    }
    db.leads.unshift(lead)
    return lead
  })
}

export type LeadPatch = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>

export async function updateLead(owner: string, leadId: string, patch: LeadPatch): Promise<Lead | null> {
  return mutate((db) => {
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
    return lead
  })
}

export async function deleteLead(owner: string, leadId: string): Promise<void> {
  await mutate((db) => { db.leads = db.leads.filter(x => !(x.id === leadId && x.owner === owner)) })
}
