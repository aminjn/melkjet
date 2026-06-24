'use client'
import { useEffect, useState } from 'react'

// کارتِ اعتبار + پکیج‌های شارژِ پیامک/ایمیل — بالای فرمِ ارسالِ کمپین نمایش داده می‌شود.
const FONT = 'Vazirmatn, system-ui, sans-serif'
interface Pkg { id: string; channel: 'sms' | 'email'; name: string; credits: number; price: number; active: boolean }
interface Order { id: string; name: string; channel: string; credits: number; price: number; status: string; createdAt: number }
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

export default function CommCredit({ channel }: { channel: 'sms' | 'email' }) {
  const [credit, setCredit] = useState<{ sms: number; email: number }>({ sms: 0, email: 0 })
  const [packages, setPackages] = useState<Pkg[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const load = () => fetch('/api/comm').then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return
    setCredit(d.credit || { sms: 0, email: 0 })
    setPackages((d.packages || []).filter((p: Pkg) => p.channel === channel))
    setOrders((d.orders || []).filter((o: Order) => o.channel === channel))
  }).catch(() => {})
  useEffect(() => { load() }, [channel])

  const buy = async (id: string) => {
    setBusy(id); setMsg('')
    try {
      const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'order', packageId: id }) })
      const d = await r.json()
      if (d.ok) { setMsg('✓ سفارش ثبت شد. پس از تأییدِ پرداخت، اعتبار شارژ می‌شود.'); load() }
      else setMsg(`⚠ ${d.error || 'خطا'}`)
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy('') }
  }

  const label = channel === 'sms' ? 'پیامک' : 'ایمیل'
  const bal = credit[channel]
  const pendingOrders = orders.filter(o => o.status === 'pending')
  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT }

  return (
    <div dir="rtl" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: packages.length ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{channel === 'sms' ? '✆' : '✉'}</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>اعتبارِ {label}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>برای ارسالِ کمپین، اعتبارِ کافی لازم است.</div>
          </div>
        </div>
        <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '7px 16px', fontSize: 15, fontWeight: 900, color: 'var(--gold)' }}>{fa(bal)} <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span></div>
      </div>

      {packages.length === 0 ? null : (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>پکیج‌های شارژ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
            {packages.map(p => (
              <div key={p.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fa(p.credits)} {label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--gold)', marginTop: 2 }}>{fa(p.price)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>تومان</span></div>
                <button onClick={() => buy(p.id)} disabled={!!busy} style={{ marginTop: 6, padding: '8px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>{busy === p.id ? '…' : 'تهیه'}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {msg && <div style={{ marginTop: 12, fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</div>}
      {pendingOrders.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          سفارش‌های در انتظارِ تأیید: {pendingOrders.map(o => <span key={o.id} style={{ display: 'inline-block', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', margin: '0 4px', fontSize: 11.5 }}>{o.name} · {fa(o.price)} تومان</span>)}
        </div>
      )}
    </div>
  )
}
