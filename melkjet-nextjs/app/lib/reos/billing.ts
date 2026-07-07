// REOS v3 · Billing Engine — کیفِ پول + تراکنش + فاکتور + اشتراک (مالیات/برگشت).
// طرحِ تک‌جدولی (reos_billing: kind + data jsonb). شارژ/برداشتِ اتمیک (FOR UPDATE). Dual-mode.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../db'

export type BillKind = 'wallet' | 'txn' | 'invoice' | 'subscription'
export interface Transaction { id: string; ownerId: string; type: 'credit' | 'debit'; amount: number; reason: string; balanceAfter: number; at: number }
export interface InvoiceItem { desc: string; amount: number }
export interface Invoice { id: string; ownerId: string; items: InvoiceItem[]; subtotal: number; tax: number; total: number; paid: boolean; at: number }

const FILE = join(process.cwd(), '.reos-billing.json')
interface Row { id: string; kind: BillKind; ownerId: string; at: number; data: object }
function uid(p: string) { return p + randomBytes(6).toString('hex') }
function fileLoad(): Row[] { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return [] }
function fileSave(d: unknown) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_billing (id text PRIMARY KEY, kind text NOT NULL, owner_id text NOT NULL, at bigint NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb)`); await c.query(`CREATE INDEX IF NOT EXISTS reos_billing_owner ON reos_billing(kind, owner_id)`) }); ready = true }

const walletId = (ownerId: string) => 'wallet_' + ownerId

// شارژ/برداشتِ اتمیک. برداشت اگر موجودی کافی نباشد → {ok:false}.
async function adjust(ownerId: string, delta: number): Promise<{ ok: boolean; balance: number }> {
  if (pgEnabled()) {
    await ensure()
    return pgTx(async c => {
      const r = await c.query(`SELECT data FROM reos_billing WHERE id=$1 FOR UPDATE`, [walletId(ownerId)])
      const bal = Number((r.rows[0]?.data as { balance?: number })?.balance || 0)
      const next = bal + delta
      if (next < 0) return { ok: false, balance: bal }
      await c.query(`INSERT INTO reos_billing(id,kind,owner_id,at,data) VALUES($1,'wallet',$2,$3,$4)
        ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, at=EXCLUDED.at`, [walletId(ownerId), ownerId, Date.now(), JSON.stringify({ balance: next })])
      return { ok: true, balance: next }
    })
  }
  const db = fileLoad(); const row = db.find(r => r.id === walletId(ownerId))
  const bal = Number((row?.data as { balance?: number })?.balance || 0); const next = bal + delta
  if (next < 0) return { ok: false, balance: bal }
  if (row) row.data = { balance: next }; else db.push({ id: walletId(ownerId), kind: 'wallet', ownerId, at: Date.now(), data: { balance: next } })
  fileSave(db); return { ok: true, balance: next }
}

async function logTxn(ownerId: string, type: 'credit' | 'debit', amount: number, reason: string, balanceAfter: number): Promise<Transaction> {
  const t: Transaction = { id: uid('txn_'), ownerId, type, amount, reason, balanceAfter, at: Date.now() }
  const row: Row = { id: t.id, kind: 'txn', ownerId, at: t.at, data: t }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_billing(id,kind,owner_id,at,data) VALUES($1,'txn',$2,$3,$4)`, [t.id, ownerId, t.at, JSON.stringify(t)])) }
  else { const db = fileLoad(); db.push(row); fileSave(db) }
  return t
}

export async function getBalance(ownerId: string): Promise<number> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_billing WHERE id=$1`, [walletId(ownerId)])); return Number((r.rows[0]?.data as { balance?: number })?.balance || 0) }
  return Number((fileLoad().find(r => r.id === walletId(ownerId))?.data as { balance?: number })?.balance || 0)
}
export async function credit(ownerId: string, amount: number, reason = 'شارژ'): Promise<{ ok: boolean; balance: number; txn?: Transaction }> {
  if (amount <= 0) return { ok: false, balance: await getBalance(ownerId) }
  const r = await adjust(ownerId, amount); if (!r.ok) return r
  return { ...r, txn: await logTxn(ownerId, 'credit', amount, reason, r.balance) }
}
export async function debit(ownerId: string, amount: number, reason = 'برداشت'): Promise<{ ok: boolean; balance: number; txn?: Transaction }> {
  if (amount <= 0) return { ok: false, balance: await getBalance(ownerId) }
  const r = await adjust(ownerId, -amount); if (!r.ok) return r
  return { ...r, txn: await logTxn(ownerId, 'debit', amount, reason, r.balance) }
}
export async function listTransactions(ownerId: string): Promise<Transaction[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_billing WHERE kind='txn' AND owner_id=$1 ORDER BY at DESC LIMIT 500`, [ownerId])); return r.rows.map(x => x.data as Transaction) }
  return fileLoad().filter(r => r.kind === 'txn' && r.ownerId === ownerId).map(r => r.data as unknown as Transaction).sort((a, b) => b.at - a.at)
}

// ── فاکتور (با مالیات) ──
export async function createInvoice(ownerId: string, items: InvoiceItem[], taxRate = 0.1): Promise<Invoice> {
  const subtotal = items.reduce((a, i) => a + (i.amount || 0), 0)
  const tax = Math.round(subtotal * taxRate)
  const inv: Invoice = { id: uid('inv_'), ownerId, items, subtotal, tax, total: subtotal + tax, paid: false, at: Date.now() }
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_billing(id,kind,owner_id,at,data) VALUES($1,'invoice',$2,$3,$4)`, [inv.id, ownerId, inv.at, JSON.stringify(inv)])) }
  else { const db = fileLoad(); db.push({ id: inv.id, kind: 'invoice', ownerId, at: inv.at, data: inv }); fileSave(db) }
  return inv
}
// پرداختِ فاکتور از کیفِ پول (اتمیک: اگر موجودی کافی نبود، پرداخت نمی‌شود).
export async function payInvoice(id: string): Promise<{ ok: boolean; reason?: string; balance?: number }> {
  const inv = await getInvoice(id)
  if (!inv) return { ok: false, reason: 'فاکتور یافت نشد' }
  if (inv.paid) return { ok: false, reason: 'قبلاً پرداخت شده' }
  const d = await debit(inv.ownerId, inv.total, `پرداختِ فاکتور ${id}`)
  if (!d.ok) return { ok: false, reason: 'موجودیِ ناکافی', balance: d.balance }
  inv.paid = true
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_billing SET data=$2 WHERE id=$1`, [id, JSON.stringify(inv)])) }
  else { const db = fileLoad(); const row = db.find(r => r.id === id); if (row) { row.data = inv as unknown as Record<string, unknown>; fileSave(db) } }
  return { ok: true, balance: d.balance }
}
export async function getInvoice(id: string): Promise<Invoice | null> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_billing WHERE id=$1`, [id])); return (r.rows[0]?.data as Invoice) || null }
  return (fileLoad().find(r => r.id === id)?.data as unknown as Invoice) || null
}
export async function listInvoices(ownerId: string): Promise<Invoice[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT data FROM reos_billing WHERE kind='invoice' AND owner_id=$1 ORDER BY at DESC`, [ownerId])); return r.rows.map(x => x.data as Invoice) }
  return fileLoad().filter(r => r.kind === 'invoice' && r.ownerId === ownerId).map(r => r.data as unknown as Invoice)
}
