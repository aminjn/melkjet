'use client'
import { useEffect, useState } from 'react'

// کیفِ پول و صورتحساب (REOS Billing). به /api/reos/billing وصل است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => Math.round(n || 0).toLocaleString('fa-IR')
type Txn = { id: string; type: 'credit' | 'debit'; amount: number; reason: string; balanceAfter: number; at: number }
type Inv = { id: string; subtotal: number; tax: number; total: number; paid: boolean; at: number }

export default function ReosWallet() {
  const [balance, setBalance] = useState(0)
  const [txns, setTxns] = useState<Txn[]>([])
  const [invoices, setInvoices] = useState<Inv[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => fetch('/api/reos/billing', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setBalance(d.balance || 0); setTxns(d.transactions || []); setInvoices(d.invoices || []) } setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load() }, [])
  const pay = async (id: string) => { await fetch('/api/reos/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay', id }) }); load() }

  if (loading) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>👛</span><span style={{ fontSize: 15, fontWeight: 800 }}>کیفِ پول و صورتحساب</span>
      </div>
      <div style={{ background: 'linear-gradient(135deg,var(--goldDim),transparent)', border: '1px solid var(--gold)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>موجودی</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)' }}>{fa(balance)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>تومان</span></div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>شارژ از طریقِ مدیر/درگاهِ پرداخت</div>
      </div>

      {invoices.filter(i => !i.paid).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>فاکتورهای پرداخت‌نشده</div>
          {invoices.filter(i => !i.paid).map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ flex: 1, fontSize: 12.5 }}>{fa(i.total)} تومان <span style={{ color: 'var(--faint)', fontSize: 11 }}>(با {fa(i.tax)} مالیات)</span></div>
              <button onClick={() => pay(i.id)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>پرداخت</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>تراکنش‌های اخیر</div>
      {txns.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>تراکنشی نیست.</div> :
        txns.slice(0, 8).map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
            <span style={{ color: t.type === 'credit' ? '#34d399' : '#e74c3c', fontWeight: 800 }}>{t.type === 'credit' ? '+' : '−'}{fa(t.amount)}</span>
            <span style={{ flex: 1, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.reason}</span>
            <span style={{ color: 'var(--faint)' }}>{new Date(t.at).toLocaleDateString('fa-IR')}</span>
          </div>
        ))}
    </div>
  )
}
