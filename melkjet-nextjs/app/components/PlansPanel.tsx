'use client'
import { useEffect, useState } from 'react'

// پنلِ «پلن‌ها و اشتراک» — مشترک در همهٔ پنل‌ها. گرافیکِ غنی: اشتراک‌های نقش + بسته‌های افزایشی.
const FONT = 'Vazirmatn, system-ui, sans-serif'
type Channel = 'sms' | 'email' | 'token'
interface Plan { id: string; name: string; priceMonthly: number; priceYearly: number; currency?: string; features: string[]; highlighted: boolean; cta?: string; badge?: string }
interface Pkg { id: string; channel: Channel; name: string; credits: number; price: number }
interface Order { id: string; kind: string; name: string; channel?: string; planId?: string; price: number; status: string }
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

const CH: Record<Channel, { label: string; icon: string; unit: string; buyLabel: string }> = {
  token: { label: 'توکن هوش مصنوعی', icon: '🪙', unit: 'توکن', buyLabel: 'تهیهٔ توکن اضافه' },
  sms: { label: 'پیامک', icon: '✆', unit: 'پیامک', buyLabel: 'خریدِ بستهٔ پیامک' },
  email: { label: 'ایمیل', icon: '✉', unit: 'ایمیل', buyLabel: 'خریدِ بستهٔ ایمیل' },
}

export default function PlansPanel({ dashboard, channels = ['token', 'sms', 'email'], title = 'پلن‌ها و اشتراک' }: { dashboard: string; channels?: Channel[]; title?: string }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [packages, setPackages] = useState<Pkg[]>([])
  const [credit, setCredit] = useState<Record<string, number>>({ sms: 0, email: 0, token: 0 })
  const [tokenUsed, setTokenUsed] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
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

  const buyPlan = async (p: Plan) => {
    setBusy('plan_' + p.id); setMsg('')
    try {
      const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'orderPlan', planId: p.id, period }) })
      const d = await r.json()
      setMsg(d.ok ? `✓ سفارشِ «${p.name}» ثبت شد. پس از تأییدِ پرداخت، اشتراک فعال می‌شود.` : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) loadComm()
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy('') }
  }
  const buyPkg = async (p: Pkg) => {
    setBusy('pkg_' + p.id); setMsg('')
    try {
      const r = await fetch('/api/comm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'order', packageId: p.id }) })
      const d = await r.json()
      setMsg(d.ok ? `✓ سفارشِ «${p.name}» ثبت شد. پس از تأییدِ پرداخت، اعتبار شارژ می‌شود.` : `⚠ ${d.error || 'خطا'}`)
      if (d.ok) loadComm()
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy('') }
  }

  const pending = orders.filter(o => o.status === 'pending')
  const usedChannels = channels.filter(ch => packages.some(p => p.channel === ch))

  return (
    <div dir="rtl" style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* قهرمانِ بالای صفحه */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '26px 24px', background: 'linear-gradient(120deg, rgba(212,175,55,.16), rgba(212,175,55,.04) 55%, transparent), var(--surface)', border: '1px solid var(--gold)' }}>
        <div style={{ position: 'absolute', insetInlineEnd: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,.25), transparent 70%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, position: 'relative' }}>
          <span style={{ fontSize: 26 }}>👑</span>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.5px' }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9, maxWidth: 640, position: 'relative' }}>اشتراکِ مناسبِ خود را انتخاب کنید و در صورتِ نیاز، بسته‌های افزایشیِ پیامک، ایمیل و توکنِ هوش مصنوعی را تهیه کنید.</div>
      </div>

      {/* تعرفه ماهانه/سالانه */}
      {plans.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: 4 }}>
            {([['monthly', 'ماهانه'], ['yearly', 'سالانه']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} style={{ padding: '8px 22px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, background: period === k ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'transparent', color: period === k ? '#16140f' : 'var(--muted)' }}>{l}{k === 'yearly' && <span style={{ fontSize: 10.5, marginInlineStart: 5, opacity: .85 }}>۲ ماه هدیه</span>}</button>
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
            const price = period === 'yearly' ? p.priceYearly : p.priceMonthly
            const hl = p.highlighted
            return (
              <div key={p.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 18, padding: 22, background: hl ? 'linear-gradient(160deg, rgba(212,175,55,.1), var(--surface) 60%)' : 'var(--surface)', border: `1.5px solid ${hl ? 'var(--gold)' : 'var(--line)'}`, boxShadow: hl ? '0 12px 36px -12px rgba(212,175,55,.45)' : 'none', transform: hl ? 'translateY(-2px)' : 'none' }}>
                {(p.badge || hl) && <div style={{ position: 'absolute', top: 14, insetInlineStart: 14, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 12px' }}>{p.badge || 'محبوب'}</div>}
                <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 4px' }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--gold)', letterSpacing: '-1px' }}>{price > 0 ? fa(price) : 'رایگان'}</span>
                  {price > 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{p.currency || 'تومان'} / {period === 'yearly' ? 'سال' : 'ماه'}</span>}
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
      {usedChannels.map(ch => {
        const list = packages.filter(p => p.channel === ch)
        const meta = CH[ch]
        return (
          <div key={ch} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>{meta.buyLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>بسته‌های قابلِ تهیه برای شارژِ {meta.label}{ch === 'token' && tokenUsed > 0 ? ` · تاکنون ${fa(tokenUsed)} توکن مصرف شده` : ''}</div>
                </div>
              </div>
              <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '7px 16px', fontSize: 14.5, fontWeight: 900, color: 'var(--gold)' }}>{fa(credit[ch] || 0)} <span style={{ fontSize: 11, fontWeight: 600 }}>{meta.unit}</span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
              {list.map(p => (
                <div key={p.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 14, padding: 15, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fa(p.credits)} {meta.unit}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--gold)', marginTop: 2 }}>{fa(p.price)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>تومان</span></div>
                  <button onClick={() => buyPkg(p)} disabled={!!busy} style={{ marginTop: 6, padding: '9px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: busy === 'pkg_' + p.id ? 0.6 : 1 }}>{busy === 'pkg_' + p.id ? '…' : 'تهیه'}</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

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
