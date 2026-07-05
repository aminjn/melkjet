'use client'
import { useEffect, useState } from 'react'

// پنلِ «پلن‌ها و اشتراک» — مشترک در همهٔ پنل‌ها. گرافیکِ غنی: اشتراک‌های نقش + بسته‌های افزایشی.
const FONT = 'Vazirmatn, system-ui, sans-serif'
type Channel = 'sms' | 'email' | 'token'
interface Plan { id: string; name: string; priceMonthly: number; price3m?: number; price6m?: number; priceYearly: number; currency?: string; features: string[]; highlighted: boolean; cta?: string; badge?: string }
type Period = 'monthly' | '3m' | '6m' | 'yearly'
const PERIODS: [Period, string, string][] = [['monthly', 'ماهانه', 'ماه'], ['3m', '۳ماهه', '۳ ماه'], ['6m', '۶ماهه', '۶ ماه'], ['yearly', 'سالانه', 'سال']]
interface Pkg { id: string; channel: Channel; name: string; credits: number; price: number }
interface Order { id: string; kind: string; name: string; channel?: string; planId?: string; price: number; status: string }
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

const CH: Record<Channel, { label: string; icon: string; unit: string; buyLabel: string }> = {
  token: { label: 'هوش مصنوعی', icon: '🤖', unit: 'عملیات', buyLabel: 'افزایش اعتبارِ هوش مصنوعی' },
  sms: { label: 'پیامک', icon: '✆', unit: 'پیامک', buyLabel: 'خریدِ بستهٔ پیامک' },
  email: { label: 'ایمیل', icon: '✉', unit: 'ایمیل', buyLabel: 'خریدِ بستهٔ ایمیل' },
}
// هر «عملیاتِ هوش مصنوعی» ≈ این تعداد توکن (هم‌راستا با comm-store.TOKENS_PER_OP). کاربر «عملیات» می‌بیند.
const TOKENS_PER_OP = 2000
const toOps = (t: number) => Math.max(0, Math.floor((Number(t) || 0) / TOKENS_PER_OP))
// مقدارِ نمایشی برای هر کانال: توکن → عملیات؛ بقیه بدونِ تغییر.
const disp = (ch: Channel, val: number) => ch === 'token' ? toOps(val) : (Number(val) || 0)

export default function PlansPanel({ dashboard, channels = ['token', 'sms', 'email'], title = 'پلن‌ها و اشتراک' }: { dashboard: string; channels?: Channel[]; title?: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [credit, setCredit] = useState<Record<string, number>>({ sms: 0, email: 0, token: 0 })
  const [tokenUsed, setTokenUsed] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [period, setPeriod] = useState<Period>('monthly')
  const priceOf = (p: Plan) => period === 'yearly' ? p.priceYearly : period === '3m' ? (p.price3m || p.priceMonthly * 3) : period === '6m' ? (p.price6m || p.priceMonthly * 6) : p.priceMonthly
  const periodLabel = PERIODS.find(x => x[0] === period)![2]
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const loadComm = () => fetch('/api/comm').then(r => r.ok ? r.json() : null).then(d => { if (d) { setCredit(d.credit || { sms: 0, email: 0, token: 0 }); setOrders(d.orders || []); setTokenUsed(d.tokenUsed || 0) } }).catch(() => {})
  const load = () => {
    fetch(`/api/plans?dashboard=${encodeURIComponent(dashboard)}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      setPlans(d.plans || [])
      setPackages((d.packages || []).filter((p: Pkg) => channels.includes(p.channel)))
    }).catch(() => {})
    loadComm()
  }
  useEffect(() => { load() }, [dashboard])

  const [checkout, setCheckout] = useState<{ kind: 'plan' | 'pkg'; id: string; name: string; price: number } | null>(null)
  const buyPlan = (p: Plan) => setCheckout({ kind: 'plan', id: p.id, name: p.name, price: priceOf(p) })
  const buyPkg = (p: Pkg) => setCheckout({ kind: 'pkg', id: p.id, name: p.name, price: p.price })
  const submitOrder = async (gateway: string, receipt: string) => {
    if (!checkout) return
    setBusy('checkout'); setMsg('')
    try {
      const body = checkout.kind === 'plan'
        ? { action: 'orderPlan', planId: checkout.id, period, gateway, receipt }
        : { action: 'order', packageId: checkout.id, gateway, receipt }
      const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      setMsg(d.ok ? `✓ سفارشِ «${checkout.name}» ثبت شد. پس از تأییدِ پرداخت، فعال می‌شود.` : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) { setCheckout(null); loadComm() }
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy('') }
  }

  const pending = orders.filter(o => o.status === 'pending')
  const ORDER: Channel[] = ['token', 'sms', 'email']
  const usedChannels = ORDER.filter(ch => channels.includes(ch) && packages.some(p => p.channel === ch))

  return (
    <div dir="rtl" style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* قهرمانِ بالای صفحه */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 24px', background: 'linear-gradient(120deg, rgba(212,175,55,.16), rgba(212,175,55,.04) 55%, transparent), var(--surface)', border: '1px solid var(--gold)' }}>
        <div style={{ position: 'absolute', insetInlineEnd: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,.25), transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, position: 'relative' }}>
          <span style={{ fontSize: 26 }}>👑</span>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.5px' }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, maxWidth: 640, position: 'relative' }}>اشتراکِ مناسبِ خود را انتخاب کنید و در صورتِ نیاز، بسته‌های افزایشیِ عملیاتِ هوش مصنوعی، پیامک و ایمیل را تهیه کنید.</div>
      </div>

      {/* تعرفه ماهانه/سالانه */}
      {plans.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: 4, flexWrap: 'wrap' }}>
            {PERIODS.map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} style={{ padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, background: period === k ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'transparent', color: period === k ? '#16140f' : 'var(--muted)' }}>{l}{k === 'yearly' && <span style={{ fontSize: 10.5, marginInlineStart: 5, opacity: .85 }}>۲ ماه هدیه</span>}</button>
            ))}
          </div>
        </div>
      )}

      {/* کارت‌های اشتراک */}
      {plans.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 16, padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>هنوز پلنی برای این بخش تعریف نشده است.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, alignItems: 'stretch' }}>
          {plans.map(p => {
            const price = priceOf(p)
            const hl = p.highlighted
            return (
              <div key={p.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 18, padding: 22, background: hl ? 'linear-gradient(160deg, rgba(212,175,55,.1), var(--surface) 60%)' : 'var(--surface)', border: `1.5px solid ${hl ? 'var(--gold)' : 'var(--line)'}`, boxShadow: hl ? '0 12px 36px -12px rgba(212,175,55,.45)' : 'none', transform: hl ? 'translateY(-2px)' : 'none' }}>
                {(p.badge || hl) && <div style={{ position: 'absolute', top: 14, insetInlineStart: 14, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 12px' }}>{p.badge || 'محبوب'}</div>}
                <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 4px' }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--gold)', letterSpacing: '-1px' }}>{price > 0 ? fa(price) : 'رایگان'}</span>
                  {price > 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{p.currency || 'تومان'} / {periodLabel}</span>}
                </div>
                <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7 }}>
                      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, marginTop: 1 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => buyPlan(p)} disabled={!!busy} style={{ marginTop: 'auto', padding: '11px', borderRadius: 11, border: hl ? 'none' : '1px solid var(--gold)', background: hl ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'transparent', color: hl ? '#16140f' : 'var(--gold)', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT, opacity: busy === 'plan_' + p.id ? 0.6 : 1 }}>{busy === 'plan_' + p.id ? 'در حال ثبت…' : (p.cta || 'تهیهٔ اشتراک')}</button>
              </div>
            )
          })}
        </div>
      )}

      {/* بسته‌های افزایشی */}
      {usedChannels.length > 0 && <div style={{ fontSize: 16, fontWeight: 900, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🪙 بسته‌های اعتباریِ افزایشی</div>}
      {usedChannels.map(ch => {
        const list = packages.filter(p => p.channel === ch)
        const meta = CH[ch]
        return (
          <div key={ch} style={{ background: 'var(--surface)', border: `1px solid ${ch === 'token' ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>{meta.buyLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>بسته‌های قابلِ تهیه برای شارژِ {meta.label}{ch === 'token' && toOps(tokenUsed) > 0 ? ` · تاکنون ${fa(toOps(tokenUsed))} عملیات انجام شده` : ''}</div>
                </div>
              </div>
              <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '7px 16px', fontSize: 14.5, fontWeight: 900, color: 'var(--gold)' }}>{fa(disp(ch, credit[ch] || 0))} <span style={{ fontSize: 11, fontWeight: 600 }}>{meta.unit}{ch === 'token' ? '‌ باقی‌مانده' : ''}</span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
              {list.map(p => (
                <div key={p.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fa(disp(ch, p.credits))} {meta.unit}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--gold)', marginTop: 2 }}>{fa(p.price)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>تومان</span></div>
                  <button onClick={() => buyPkg(p)} disabled={!!busy} style={{ marginTop: 6, padding: '9px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: busy === 'pkg_' + p.id ? 0.6 : 1 }}>{busy === 'pkg_' + p.id ? '…' : 'تهیه'}</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {checkout && <CheckoutModal item={checkout} busy={busy === 'checkout'} onClose={() => setCheckout(null)} onSubmit={submitOrder} />}
      {msg && <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a', textAlign: 'center' }}>{msg}</div>}
      {pending.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>سفارش‌های در انتظارِ تأیید</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pending.map(o => <span key={o.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 13px', fontSize: 12 }}>{o.name} · {fa(o.price)} تومان <span style={{ color: '#f59e0b', marginInlineStart: 4 }}>● در انتظار</span></span>)}
          </div>
        </div>
      )}
    </div>
  )
}

interface Gateway { id: string; type: string; label: string; cardNumber?: string; iban?: string; accountNumber?: string; holderName?: string; bank?: string; note?: string }
function CheckoutModal({ item, busy, onClose, onSubmit }: { item: { name: string; price: number }; busy: boolean; onClose: () => void; onSubmit: (gateway: string, receipt: string) => void }) {
  const [gws, setGws] = useState<Gateway[]>([])
  const [sel, setSel] = useState<string>('')
  const [receipt, setReceipt] = useState('')
  const [copied, setCopied] = useState('')
  useEffect(() => { fetch('/api/payment/methods').then(r => r.ok ? r.json() : null).then(d => { if (d?.ok) { setGws(d.gateways || []); setSel(d.gateways?.[0]?.id || '') } }).catch(() => {}) }, [])
  const g = gws.find(x => x.id === sel)
  const copy = (t: string) => { try { navigator.clipboard.writeText(t.replace(/\s/g, '')); setCopied(t); setTimeout(() => setCopied(''), 1500) } catch {} }
  const row = (label: string, val?: string) => val ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b dir="ltr" style={{ fontSize: 14, letterSpacing: '.5px' }}>{val}</b>
        <button onClick={() => copy(val)} style={{ fontSize: 10.5, border: '1px solid var(--line2)', background: 'transparent', color: copied === val ? '#5fd98a' : 'var(--gold)', borderRadius: 7, padding: '3px 8px', cursor: 'pointer', fontFamily: FONT }}>{copied === val ? '✓ کپی شد' : 'کپی'}</button>
      </span>
    </div>
  ) : null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, maxWidth: 460, width: '100%', margin: '30px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>پرداخت</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>{item.name} — <b style={{ color: 'var(--gold)' }}>{item.price > 0 ? fa(item.price) + ' تومان' : 'رایگان'}</b></div>
        {gws.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)', padding: 16, textAlign: 'center' }}>روشِ پرداختی فعال نیست. با پشتیبانی تماس بگیرید.</div> : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {gws.map(x => <button key={x.id} onClick={() => setSel(x.id)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${sel === x.id ? 'var(--gold)' : 'var(--line2)'}`, background: sel === x.id ? 'var(--goldDim)' : 'transparent', color: sel === x.id ? 'var(--gold)' : 'var(--muted)', fontSize: 12.5, fontWeight: sel === x.id ? 700 : 400, cursor: 'pointer', fontFamily: FONT }}>{x.label}</button>)}
            </div>
            {g?.type === 'card2card' && (
              <div style={{ marginBottom: 14 }}>
                {row('شمارهٔ کارت', g.cardNumber)}
                {row('شمارهٔ شبا', g.iban)}
                {row('شمارهٔ حساب', g.accountNumber)}
                {g.holderName && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>به نامِ: <b style={{ color: 'var(--text)' }}>{g.holderName}</b>{g.bank ? ` — ${g.bank}` : ''}</div>}
                {g.note && <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 10 }}>{g.note}</div>}
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>کدِ رهگیری / چهار رقمِ آخرِ کارت *</label>
                <input value={receipt} onChange={e => setReceipt(e.target.value)} placeholder="مثلاً ۱۲۳۴۵۶ یا ۱۲۳۴" style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }} />
              </div>
            )}
            {g?.type === 'zarinpal' && <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12, background: 'var(--bg2)', borderRadius: 10, marginBottom: 14, lineHeight: 1.9 }}>پس از ثبت، به درگاهِ بانکی هدایت می‌شوید.</div>}
            {g?.type === 'wallet' && <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12, background: 'var(--bg2)', borderRadius: 10, marginBottom: 14 }}>از موجودیِ کیفِ پول کسر می‌شود.</div>}
            <button onClick={() => onSubmit(g?.id || '', receipt.trim())} disabled={busy || (g?.type === 'card2card' && !receipt.trim())} style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT, opacity: busy || (g?.type === 'card2card' && !receipt.trim()) ? 0.6 : 1 }}>{busy ? 'در حال ثبت…' : (g?.type === 'card2card' ? 'ثبتِ پرداخت (پس از تأیید فعال می‌شود)' : 'ثبتِ سفارش')}</button>
          </>
        )}
      </div>
    </div>
  )
}
