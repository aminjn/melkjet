import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file promo-code store.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.promo-data.json')

export type PromoType = 'percent' | 'amount'

export interface Promo {
  id: string
  code: string            // always stored UPPERCASE, unique
  type: PromoType
  value: number
  description?: string
  maxUses?: number
  used: number
  active: boolean
  expiresAt?: number
  createdAt: number
}

interface DB { promos: Promo[] }

function id() { return randomBytes(6).toString('hex') }

function norm(code: unknown): string {
  return String(code || '').trim().toUpperCase()
}

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { promos: [] }
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export function listPromos(): Promo[] {
  return load().promos.sort((a, b) => b.createdAt - a.createdAt)
}

export interface PromoInput {
  code: string
  type: PromoType
  value: number
  description?: string
  maxUses?: number
  active?: boolean
  expiresAt?: number
}

export function addPromo(input: PromoInput): Promo {
  const db = load()
  const promo: Promo = {
    id: id(),
    code: norm(input.code),
    type: input.type === 'amount' ? 'amount' : 'percent',
    value: Number(input.value) || 0,
    description: input.description ? String(input.description) : undefined,
    maxUses: input.maxUses != null ? Number(input.maxUses) : undefined,
    used: 0,
    active: input.active !== false,
    expiresAt: input.expiresAt != null ? Number(input.expiresAt) : undefined,
    createdAt: Date.now(),
  }
  db.promos.unshift(promo)
  save(db)
  return promo
}

export type PromoPatch = Partial<Omit<Promo, 'id' | 'createdAt'>>

export function updatePromo(id: string, patch: PromoPatch): Promo | null {
  const db = load()
  const p = db.promos.find(x => x.id === id)
  if (!p) return null
  if (patch.code !== undefined) p.code = norm(patch.code)
  if (patch.type !== undefined) p.type = patch.type === 'amount' ? 'amount' : 'percent'
  if (patch.value !== undefined) p.value = Number(patch.value) || 0
  if (patch.description !== undefined) p.description = patch.description ? String(patch.description) : undefined
  if (patch.maxUses !== undefined) p.maxUses = patch.maxUses != null ? Number(patch.maxUses) : undefined
  if (patch.active !== undefined) p.active = !!patch.active
  if (patch.expiresAt !== undefined) p.expiresAt = patch.expiresAt != null ? Number(patch.expiresAt) : undefined
  if (patch.used !== undefined) p.used = Number(patch.used) || 0
  save(db)
  return p
}

export function deletePromo(id: string): void {
  const db = load()
  db.promos = db.promos.filter(x => x.id !== id)
  save(db)
}

export function findByCode(code: string): Promo | null {
  const c = norm(code)
  if (!c) return null
  return load().promos.find(x => x.code === c) || null
}

export interface RedeemResult {
  ok: boolean
  promo?: Promo
  error?: string
}

export function redeemPromo(code: string): RedeemResult {
  const db = load()
  const c = norm(code)
  const p = db.promos.find(x => x.code === c)
  if (!p) return { ok: false, error: 'کد تخفیف یافت نشد' }
  if (!p.active) return { ok: false, error: 'کد تخفیف غیرفعال است' }
  if (p.expiresAt != null && Date.now() > p.expiresAt) return { ok: false, error: 'کد تخفیف منقضی شده است' }
  if (p.maxUses != null && p.used >= p.maxUses) return { ok: false, error: 'ظرفیت استفاده از کد به پایان رسیده است' }
  p.used += 1
  save(db)
  return { ok: true, promo: p }
}
