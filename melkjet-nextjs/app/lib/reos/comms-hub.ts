// REOS v4 · Unified Communication Hub — روترِ واحدِ پیام روی کانال‌ها + لاگِ یکپارچه.
// SMS/Email آمادهٔ ارسال‌اند (از سرویس‌های موجود)؛ WhatsApp/Telegram/Push نیازمندِ یکپارچه‌سازیِ
// بیرونی‌اند و فعلاً pending می‌شوند. همهٔ پیام‌ها در reos_comms لاگ می‌شوند (dual-mode).
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

export type Channel = 'sms' | 'email' | 'whatsapp' | 'telegram' | 'push'
export const CHANNELS: Channel[] = ['sms', 'email', 'whatsapp', 'telegram', 'push']
const READY: Channel[] = ['sms', 'email']   // بقیه: نیازمندِ یکپارچه‌سازیِ بیرونی
export type CommStatus = 'queued' | 'sent' | 'pending' | 'failed'
export interface CommMsg { id: string; channel: Channel; to: string; message: string; subject?: string; status: CommStatus; ownerId?: string; at: number }

const FILE = join(process.cwd(), '.reos-comms.json')
function fileLoad(): CommMsg[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_comms (id text PRIMARY KEY, channel text NOT NULL, to_addr text NOT NULL, message text NOT NULL, subject text, status text NOT NULL, owner_id text, at bigint NOT NULL)`); await c.query(`CREATE INDEX IF NOT EXISTS reos_comms_owner ON reos_comms(owner_id)`) }); ready = true }

export function channels(): { channel: Channel; ready: boolean }[] { return CHANNELS.map(c => ({ channel: c, ready: READY.includes(c) })) }

// ارسال (لاگِ یکپارچه). کانالِ آماده → queued (تحویل توسطِ سرویسِ کانال)؛ کانالِ ناآماده → pending.
export async function send(input: { channel: Channel; to: string; message: string; subject?: string; ownerId?: string }): Promise<CommMsg> {
  const status: CommStatus = READY.includes(input.channel) ? 'queued' : 'pending'
  const msg: CommMsg = { id: 'cm_' + randomBytes(6).toString('hex'), channel: input.channel, to: input.to, message: input.message, subject: input.subject, status, ownerId: input.ownerId, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_comms(id,channel,to_addr,message,subject,status,owner_id,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [msg.id, msg.channel, msg.to, msg.message, msg.subject || null, msg.status, msg.ownerId || null, msg.at])) }
  else { const db = fileLoad(); db.unshift(msg); if (db.length > 5000) db.length = 5000; fileSave(db) }
  return msg
}

export async function commsLog(ownerId?: string, limit = 50): Promise<CommMsg[]> {
  if (pgEnabled()) {
    await ensure()
    const r = ownerId ? await pgTx(c => c.query(`SELECT * FROM reos_comms WHERE owner_id=$1 ORDER BY at DESC LIMIT $2`, [ownerId, limit])) : await pgTx(c => c.query(`SELECT * FROM reos_comms ORDER BY at DESC LIMIT $1`, [limit]))
    return r.rows.map(x => ({ id: x.id, channel: x.channel, to: x.to_addr, message: x.message, subject: x.subject || undefined, status: x.status, ownerId: x.owner_id || undefined, at: Number(x.at) }))
  }
  return fileLoad().filter(m => !ownerId || m.ownerId === ownerId).slice(0, limit)
}
