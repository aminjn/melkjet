import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ثبت‌نامِ نیمه‌کاره — پس از تأییدِ شاهکار و قبل از تأییدِ OTP. کلید: شماره موبایل.
const DATA_FILE = join(process.cwd(), '.pending-reg-data.json')

export interface PendingReg {
  phone: string; nationalId: string; firstName?: string; lastName?: string
  gender?: string; fatherName?: string; birthDate?: string; birthPlace?: string
  idNumber?: string; idSerial?: string; birthPlaceCode?: string
  matched: boolean; createdAt: number
}
type DB = Record<string, PendingReg>

function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

export function upsertPending(p: PendingReg) { const db = load(); db[p.phone] = { ...p, createdAt: db[p.phone]?.createdAt || Date.now() }; save(db) }
export function getPending(phone: string): PendingReg | null { return load()[phone] || null }
export function deletePending(phone: string) { const db = load(); delete db[phone]; save(db) }
