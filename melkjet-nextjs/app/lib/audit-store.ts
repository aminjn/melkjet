import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

const FILE = join(process.cwd(), '.audit-data.json')

export interface AuditEntry { id: string; actor: string; action: string; target?: string; at: number }

function load(): AuditEntry[] {
  if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} }
  return []
}
function save(rows: AuditEntry[]) { writeFileSync(FILE, JSON.stringify(rows.slice(0, 1000)), 'utf-8') }

// ثبت یک رویداد ممیزی (اقدام ادمین/کاربر). خطا را بی‌صدا رد می‌کند تا جریان اصلی نشکند.
export function logAudit(actor: string, action: string, target?: string) {
  try {
    const rows = load()
    rows.unshift({ id: randomBytes(5).toString('hex'), actor: actor || 'سیستم', action, target, at: Date.now() })
    save(rows)
  } catch {}
}

export function listAudit(limit = 200): AuditEntry[] {
  return load().slice(0, limit)
}
