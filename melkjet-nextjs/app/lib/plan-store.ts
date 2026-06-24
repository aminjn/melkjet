import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file subscription-plan store.
// Mirrors the persistence style of crm-store.ts / promo-store.ts.
const DATA_FILE = join(process.cwd(), '.plan-data.json')

export interface Plan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  currency?: string
  features: string[]
  highlighted: boolean
  cta?: string
  order: number
  active: boolean
  roleId?: string       // نقشی که این پلن برای آن است (خالی = عمومی، برای همه)
  badge?: string        // برچسبِ کوچک روی کارت (مثلاً «محبوب»)
  createdAt: number
}

interface DB { plans: Plan[] }

function id() { return randomBytes(6).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try {
      const db = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as DB
      if (db && Array.isArray(db.plans) && db.plans.length > 0) return db
    } catch {}
  }
  // Seed sensible Persian default plans on first load when empty.
  const db = seed()
  save(db)
  return db
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

function seed(): DB {
  const now = Date.now()
  const plans: Plan[] = [
    {
      id: id(),
      name: 'پایه',
      priceMonthly: 290000,
      priceYearly: 2784000,
      currency: 'تومان',
      features: [
        'آگهی نامحدود',
        'پنل مدیریت آگهی',
        'آمار بازدید هر آگهی',
        'پشتیبانی ایمیلی',
      ],
      highlighted: false,
      cta: 'شروع آزمایشی',
      order: 1,
      active: true,
      createdAt: now,
    },
    {
      id: id(),
      name: 'حرفه‌ای',
      priceMonthly: 590000,
      priceYearly: 5664000,
      currency: 'تومان',
      features: [
        'همه امکانات پایه',
        'آگهی ویژه در نتایج',
        'تحلیل قیمت هوشمند AI',
        'CRM پیشرفته مشتریان',
        'پشتیبانی تلفنی اولویت‌دار',
      ],
      highlighted: true,
      cta: 'شروع آزمایشی',
      order: 2,
      active: true,
      createdAt: now + 1,
    },
    {
      id: id(),
      name: 'سازمانی',
      priceMonthly: 1990000,
      priceYearly: 19104000,
      currency: 'تومان',
      features: [
        'همه امکانات حرفه‌ای',
        'کاربران نامحدود',
        'استقرار ابری اختصاصی',
        'یکپارچه‌سازی ERP/CRM',
        'پشتیبانی اختصاصی ۲۴/۷',
      ],
      highlighted: false,
      cta: 'تماس با فروش',
      order: 3,
      active: true,
      createdAt: now + 2,
    },
  ]
  return { plans }
}

// All plans, sorted by `order` ascending.
export function listPlans(): Plan[] {
  return load().plans.sort((a, b) => a.order - b.order)
}

// Active plans only, sorted by `order` ascending (public surface).
export function listActive(): Plan[] {
  return load().plans.filter(p => p.active).sort((a, b) => a.order - b.order)
}

export interface PlanInput {
  name: string
  priceMonthly: number
  priceYearly: number
  currency?: string
  features?: string[]
  highlighted?: boolean
  cta?: string
  order?: number
  active?: boolean
  roleId?: string
  badge?: string
}

export function addPlan(input: PlanInput): Plan {
  const db = load()
  const maxOrder = db.plans.reduce((m, p) => Math.max(m, p.order), 0)
  const plan: Plan = {
    id: id(),
    name: String(input.name || '').trim(),
    priceMonthly: Number(input.priceMonthly) || 0,
    priceYearly: Number(input.priceYearly) || 0,
    currency: input.currency ? String(input.currency) : 'تومان',
    features: Array.isArray(input.features) ? input.features.map(f => String(f)) : [],
    highlighted: !!input.highlighted,
    cta: input.cta ? String(input.cta) : undefined,
    order: input.order != null ? Number(input.order) : maxOrder + 1,
    active: input.active !== false,
    roleId: input.roleId ? String(input.roleId) : undefined,
    badge: input.badge ? String(input.badge) : undefined,
    createdAt: Date.now(),
  }
  db.plans.push(plan)
  save(db)
  return plan
}

export type PlanPatch = Partial<Omit<Plan, 'id' | 'createdAt'>>

export function updatePlan(id: string, patch: PlanPatch): Plan | null {
  const db = load()
  const p = db.plans.find(x => x.id === id)
  if (!p) return null
  if (patch.name !== undefined) p.name = String(patch.name).trim()
  if (patch.priceMonthly !== undefined) p.priceMonthly = Number(patch.priceMonthly) || 0
  if (patch.priceYearly !== undefined) p.priceYearly = Number(patch.priceYearly) || 0
  if (patch.currency !== undefined) p.currency = patch.currency ? String(patch.currency) : undefined
  if (patch.features !== undefined) p.features = Array.isArray(patch.features) ? patch.features.map(f => String(f)) : []
  if (patch.highlighted !== undefined) p.highlighted = !!patch.highlighted
  if (patch.cta !== undefined) p.cta = patch.cta ? String(patch.cta) : undefined
  if (patch.order !== undefined) p.order = Number(patch.order) || 0
  if (patch.active !== undefined) p.active = !!patch.active
  if (patch.roleId !== undefined) p.roleId = patch.roleId ? String(patch.roleId) : undefined
  if (patch.badge !== undefined) p.badge = patch.badge ? String(patch.badge) : undefined
  save(db)
  return p
}

export function deletePlan(id: string): void {
  const db = load()
  db.plans = db.plans.filter(x => x.id !== id)
  save(db)
}
