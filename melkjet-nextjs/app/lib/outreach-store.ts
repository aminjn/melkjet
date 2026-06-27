import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ردگیریِ دعوتِ صاحبانِ آگهیِ اسکرپ‌شده (برای جلوگیری از ارسالِ دوباره).
const FILE = join(process.cwd(), '.outreach-data.json')

interface DB { invited: Record<string, number>; total: number }   // phone → زمانِ ارسال

function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { invited: {}, total: 0 } }
function save(db: DB) { writeFileSync(FILE, JSON.stringify(db)) }

export function wasInvited(phone: string): boolean { return !!load().invited[phone] }
export function markInvited(phone: string) { const db = load(); if (!db.invited[phone]) { db.invited[phone] = Date.now(); db.total++; save(db) } }
export function invitedCount(): number { return load().total }
export function invitedSet(): Set<string> { return new Set(Object.keys(load().invited)) }
