import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// آمارِ هر آگهی: تعدادِ بازدید (باز شدن) و تعدادِ کلیکِ «اطلاعات تماس».
const DATA_FILE = join(process.cwd(), '.listing-stats-data.json')

export interface LStat { views: number; contacts: number; lastView?: number; lastContact?: number }
interface DB { stats: Record<string, LStat> }

function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { stats: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export function recordView(id: string) { const db = load(); const s = db.stats[id] || { views: 0, contacts: 0 }; s.views++; s.lastView = Date.now(); db.stats[id] = s; save(db) }
export function recordContact(id: string) { const db = load(); const s = db.stats[id] || { views: 0, contacts: 0 }; s.contacts++; s.lastContact = Date.now(); db.stats[id] = s; save(db) }
export function getStat(id: string): LStat { const s = load().stats[id]; return { views: s?.views || 0, contacts: s?.contacts || 0, lastView: s?.lastView, lastContact: s?.lastContact } }
export function forIds(ids: string[]): Record<string, LStat> { const db = load(); const out: Record<string, LStat> = {}; for (const id of ids) out[id] = db.stats[id] || { views: 0, contacts: 0 }; return out }
