// REOS v6 · Unified Wallet — کیفِ پولِ چندسطلی: نقدی + اعتبارِ تبلیغ + اعتبارِ AI + پاداش.
// «نقدی» به Billing (فاکتور/اشتراک) وصل است؛ سطل‌های اعتبار جداگانه با دفترِ تراکنشِ tipe‌دار.
// اتمیک (FOR UPDATE)؛ برداشتِ بیش از موجودی رد می‌شود؛ refund تراکنش را برمی‌گرداند. Dual-mode.
import { pgEnabled, pgTx } from '../db'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { getBalance, credit as cashCredit, debit as cashDebit } from './billing'

export type Bucket = 'cash' | 'promo' | 'ai' | 'reward'
export const BUCKETS: Bucket[] = ['cash', 'promo', 'ai', 'reward']
export const BUCKET_LABEL: Record<Bucket, string> = { cash: 'نقدی', promo: 'اعتبارِ تبلیغ', ai: 'اعتبارِ AI', reward: 'پاداش' }
const CREDIT_BUCKETS: Bucket[] = ['promo', 'ai', 'reward']   // نقدی جدا (Billing)
export interface WalletTxn { id: string; ownerId: string; bucket: Bucket; type: 'credit' | 'debit'; amount: number; reason: string; balanceAfter: number; refundedFrom?: string; at: number }

function uid() { return 'wtx_' + randomBytes(6).toString('hex') }
const FILE = join(process.cwd(), '.reos-wallet.json')
interface WDb { bal: Record<string, number>; txns: WalletTxn[] }   // bal key = owner|bucket
function fileLoad(): WDb { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return { bal: {}, txns: [] } }
function fileSave(d: WDb) { try { writeFileSync(FILE, JSON.stringify(d)) } catch {} }
const bk = (o: string, b: Bucket) => o + '|' + b
let ready = false
async function ensure() { if (ready) return; await pgTx(async c => { await c.query(`CREATE TABLE IF NOT EXISTS reos_wallet (owner_id text NOT NULL, bucket text NOT NULL, balance bigint NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, bucket))`); await c.query(`CREATE TABLE IF NOT EXISTS reos_wallet_txn (id text PRIMARY KEY, owner_id text NOT NULL, bucket text NOT NULL, type text NOT NULL, amount bigint NOT NULL, reason text NOT NULL DEFAULT '', balance_after bigint NOT NULL, refunded_from text, at bigint NOT NULL)`); await c.query(`CREATE INDEX IF NOT EXISTS reos_wallet_txn_owner ON reos_wallet_txn(owner_id, at DESC)`) }); ready = true }

async function logTxn(t: WalletTxn): Promise<WalletTxn> {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`INSERT INTO reos_wallet_txn(id,owner_id,bucket,type,amount,reason,balance_after,refunded_from,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [t.id, t.ownerId, t.bucket, t.type, t.amount, t.reason, t.balanceAfter, t.refundedFrom || null, t.at])) }
  else { const db = fileLoad(); db.txns.push(t); fileSave(db) }
  return t
}

// شارژِ یک سطل. نقدی → Billing.
export async function creditBucket(ownerId: string, bucket: Bucket, amount: number, reason = 'شارژ'): Promise<{ ok: boolean; balance: number; txn?: WalletTxn }> {
  if (amount <= 0 || !ownerId) return { ok: false, balance: await bucketBalance(ownerId, bucket) }
  if (bucket === 'cash') { const r = await cashCredit(ownerId, amount, reason); return { ok: r.ok, balance: r.balance } }
  let balance: number
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`INSERT INTO reos_wallet(owner_id,bucket,balance) VALUES($1,$2,$3) ON CONFLICT(owner_id,bucket) DO UPDATE SET balance=reos_wallet.balance+$3 RETURNING balance`, [ownerId, bucket, amount])); balance = Number(r.rows[0].balance) }
  else { const db = fileLoad(); balance = (db.bal[bk(ownerId, bucket)] || 0) + amount; db.bal[bk(ownerId, bucket)] = balance; fileSave(db) }
  const txn = await logTxn({ id: uid(), ownerId, bucket, type: 'credit', amount, reason, balanceAfter: balance, at: Date.now() })
  return { ok: true, balance, txn }
}

// برداشت از یک سطل (اتمیک؛ اگر موجودی کافی نباشد رد). نقدی → Billing.
export async function debitBucket(ownerId: string, bucket: Bucket, amount: number, reason = 'مصرف'): Promise<{ ok: boolean; balance: number; txn?: WalletTxn }> {
  if (amount <= 0 || !ownerId) return { ok: false, balance: await bucketBalance(ownerId, bucket) }
  if (bucket === 'cash') { const r = await cashDebit(ownerId, amount, reason); return { ok: r.ok, balance: r.balance } }
  let ok = true, balance: number
  if (pgEnabled()) {
    await ensure()
    const res = await pgTx(async c => {
      const cur = await c.query(`SELECT balance FROM reos_wallet WHERE owner_id=$1 AND bucket=$2 FOR UPDATE`, [ownerId, bucket])
      const b = Number(cur.rows[0]?.balance || 0)
      if (b < amount) return { ok: false, balance: b }
      const r = await c.query(`INSERT INTO reos_wallet(owner_id,bucket,balance) VALUES($1,$2,$3) ON CONFLICT(owner_id,bucket) DO UPDATE SET balance=reos_wallet.balance-$4 RETURNING balance`, [ownerId, bucket, -amount, amount])
      return { ok: true, balance: Number(r.rows[0].balance) }
    })
    ok = res.ok; balance = res.balance
  } else {
    const db = fileLoad(); const b = db.bal[bk(ownerId, bucket)] || 0
    if (b < amount) { ok = false; balance = b } else { balance = b - amount; db.bal[bk(ownerId, bucket)] = balance; fileSave(db) }
  }
  if (!ok) return { ok: false, balance: balance! }
  const txn = await logTxn({ id: uid(), ownerId, bucket, type: 'debit', amount, reason, balanceAfter: balance!, at: Date.now() })
  return { ok: true, balance: balance!, txn }
}

export async function bucketBalance(ownerId: string, bucket: Bucket): Promise<number> {
  if (bucket === 'cash') return getBalance(ownerId)
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT balance FROM reos_wallet WHERE owner_id=$1 AND bucket=$2`, [ownerId, bucket])); return Number(r.rows[0]?.balance || 0) }
  return fileLoad().bal[bk(ownerId, bucket)] || 0
}

// خلاصهٔ کیفِ پول (همهٔ سطل‌ها + جمعِ کل).
export async function walletSummary(ownerId: string): Promise<{ buckets: Record<Bucket, number>; total: number }> {
  const vals = await Promise.all(BUCKETS.map(b => bucketBalance(ownerId, b)))
  const buckets = Object.fromEntries(BUCKETS.map((b, i) => [b, vals[i]])) as Record<Bucket, number>
  return { buckets, total: vals.reduce((a, b) => a + b, 0) }
}

export async function walletLedger(ownerId: string, limit = 100): Promise<WalletTxn[]> {
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_wallet_txn WHERE owner_id=$1 ORDER BY at DESC LIMIT $2`, [ownerId, limit])); return r.rows.map(x => ({ id: x.id, ownerId: x.owner_id, bucket: x.bucket, type: x.type, amount: Number(x.amount), reason: x.reason, balanceAfter: Number(x.balance_after), refundedFrom: x.refunded_from || undefined, at: Number(x.at) })) }
  return fileLoad().txns.filter(t => t.ownerId === ownerId).sort((a, b) => b.at - a.at).slice(0, limit)
}

// برگشتِ یک تراکنش (refund): جهتِ عکسِ آن را اعمال می‌کند (یک‌بار).
export async function refundTxn(txnId: string): Promise<{ ok: boolean; reason?: string }> {
  let t: WalletTxn | undefined
  if (pgEnabled()) { await ensure(); const r = await pgTx(c => c.query(`SELECT * FROM reos_wallet_txn WHERE id=$1`, [txnId])); const x = r.rows[0]; if (x) t = { id: x.id, ownerId: x.owner_id, bucket: x.bucket, type: x.type, amount: Number(x.amount), reason: x.reason, balanceAfter: Number(x.balance_after), refundedFrom: x.refunded_from || undefined, at: Number(x.at) } }
  else t = fileLoad().txns.find(x => x.id === txnId)
  if (!t) return { ok: false, reason: 'تراکنش یافت نشد' }
  if (t.refundedFrom) return { ok: false, reason: 'خودِ این یک برگشت است' }
  // جلوگیری از دوبار برگشت
  const already = (await walletLedger(t.ownerId, 500)).some(x => x.refundedFrom === txnId)
  if (already) return { ok: false, reason: 'قبلاً برگشت خورده' }
  if (t.type === 'credit') { const d = await debitBucket(t.ownerId, t.bucket, t.amount, `برگشتِ ${txnId}`); if (!d.ok) return { ok: false, reason: 'موجودیِ ناکافی برای برگشت' }; if (d.txn) { d.txn.refundedFrom = txnId; await markRefund(d.txn.id, txnId) } }
  else { const c2 = await creditBucket(t.ownerId, t.bucket, t.amount, `برگشتِ ${txnId}`); if (c2.txn) await markRefund(c2.txn.id, txnId) }
  return { ok: true }
}
async function markRefund(newTxnId: string, fromId: string) {
  if (pgEnabled()) { await ensure(); await pgTx(c => c.query(`UPDATE reos_wallet_txn SET refunded_from=$2 WHERE id=$1`, [newTxnId, fromId])) }
  else { const db = fileLoad(); const t = db.txns.find(x => x.id === newTxnId); if (t) { t.refundedFrom = fromId; fileSave(db) } }
}
