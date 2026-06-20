import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Per-owner (per-profile) store for saved floor-plans from the offline plan editor.
// Mirrors the file-based persistence style of materials-store.ts: file-based JSON in
// process.cwd(), every plan keyed by the owner's phone so each profile sees only its own.
// Domestic-only — survives even if Iran goes national-internet-only (it's our own server).
const DATA_FILE = join(process.cwd(), '.floorplan-data.json')

export interface PlanDoor { x: number; y: number; side: 'N' | 'S' | 'E' | 'W' }
export interface PlanRoomRec { name: string; type: string; x: number; y: number; w: number; h: number }

export interface SavedPlan {
  id: string
  name: string
  area: number
  cols: number
  rows: number
  rooms: PlanRoomRec[]
  doors?: PlanDoor[]
  updatedAt: number
}

interface DB { plans: Record<string, SavedPlan[]> }

function id() { return 'fp_' + randomBytes(5).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { plans: {} }
}
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

const clampi = (n: any, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)))

// چیدمان واردشده را به ساختار معتبر و محدودشده در گرید تبدیل می‌کند (دفاع از داده).
function sanitize(input: { area?: any; cols?: any; rows?: any; rooms?: any; doors?: any }) {
  const cols = clampi(input.cols, 2, 8), rows = clampi(input.rows, 2, 8)
  const area = Math.max(1, Math.round(Number(input.area) || 100))
  const rooms: PlanRoomRec[] = (Array.isArray(input.rooms) ? input.rooms : []).map((r: any) => {
    const x = clampi(r.x, 0, cols - 1), y = clampi(r.y, 0, rows - 1)
    return {
      name: String(r.name || '').slice(0, 32),
      type: String(r.type || 'other').slice(0, 16),
      x, y, w: clampi(r.w, 1, cols - x), h: clampi(r.h, 1, rows - y),
    }
  }).filter((r: PlanRoomRec) => r.name)
  const doors: PlanDoor[] = (Array.isArray(input.doors) ? input.doors : [])
    .map((d: any) => ({ x: clampi(d.x, 0, cols - 1), y: clampi(d.y, 0, rows - 1), side: (['N', 'S', 'E', 'W'].includes(d.side) ? d.side : 'N') as PlanDoor['side'] }))
    .slice(0, 60)
  return { cols, rows, area, rooms, doors }
}

export function listPlans(owner: string): SavedPlan[] {
  const db = load()
  return (db.plans[owner] || []).slice().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getPlan(owner: string, planId: string): SavedPlan | null {
  const db = load()
  return (db.plans[owner] || []).find(p => p.id === planId) || null
}

// ایجاد یا به‌روزرسانی؛ هر دو حالت پلانِ ذخیره‌شده را برمی‌گرداند. کاملاً محدود به owner.
export function savePlan(owner: string, input: { id?: string; name?: string; area?: any; cols?: any; rows?: any; rooms?: any; doors?: any }): SavedPlan {
  const db = load()
  if (!db.plans[owner]) db.plans[owner] = []
  const list = db.plans[owner]
  const s = sanitize(input)
  const name = String(input.name || 'پلان من').slice(0, 60) || 'پلان من'
  let plan: SavedPlan
  const existing = input.id ? list.find(p => p.id === input.id) : null
  if (existing) {
    existing.name = name; existing.area = s.area; existing.cols = s.cols; existing.rows = s.rows
    existing.rooms = s.rooms; existing.doors = s.doors; existing.updatedAt = Date.now()
    plan = existing
  } else {
    plan = { id: id(), name, area: s.area, cols: s.cols, rows: s.rows, rooms: s.rooms, doors: s.doors, updatedAt: Date.now() }
    list.unshift(plan)
  }
  // سقف منطقی برای جلوگیری از رشد بی‌حد
  if (list.length > 100) db.plans[owner] = list.slice(0, 100)
  save(db)
  return plan
}

export function deletePlan(owner: string, planId: string) {
  const db = load()
  if (!db.plans[owner]) return
  db.plans[owner] = db.plans[owner].filter(p => p.id !== planId)
  save(db)
}
