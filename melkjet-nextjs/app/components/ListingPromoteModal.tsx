'use client'
import { useEffect, useState } from 'react'

// مودالِ خودسرویسِ «پروموتِ آگهی» — دو نقطهٔ ورود، یک مودال:
//  • از رویِ خودِ آگهی (CrmTool «فایل‌ها»): آگهی از پیش انتخاب‌شده، کاربر بستهٔ پروموت را برمی‌گزیند.
//  • از صفحهٔ پلن‌ها (بستهٔ پروموتِ آگهی): بسته از پیش انتخاب‌شده، کاربر آگهی را برمی‌گزیند.
// همیشه فقط آگهی‌های «منتشرشدهٔ» خودِ کاربر پروموت می‌شوند (targetId = شناسهٔ آیتمِ اسکرپر).
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

type Tier = { id: string; target: string; name: string; price: number; desc: string; days: number; kind?: string; where?: string }
type OwnListing = { id: string; title: string; location?: string; price?: string; image?: string }
interface Gateway { id: string; type: string; label: string; cardNumber?: string; iban?: string; accountNumber?: string; holderName?: string; bank?: string; note?: string }

export default function ListingPromoteModal({ preListing, preTierId, onClose, onDone }: {
  preListing?: { id: string; title: string }   // id = شناسهٔ آیتمِ اسکرپر (publicId آگهیِ منتشرشده)
  preTierId?: string
  onClose: () => void
  onDone?: () => void
}) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [discount, setDiscount] = useState(0)
  const [wallet, setWallet] = useState(0)
  const [listings, setListings] = useState<OwnListing[]>([])
  const [loadedListings, setLoadedListings] = useState(false)
  const [tierId, setTierId] = useState(preTierId || '')
  const [listingId, setListingId] = useState(preListing?.id || '')
  const [step, setStep] = useState<'select' | 'pay'>('select')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/comm').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setTiers((d.promoTiers || []).filter((t: Tier) => t.target === 'listing')); setDiscount(Number(d.promoDiscount) || 0); setWallet(Number(d.promoWallet) || 0) }
    }).catch(() => {})
    // آگهی‌های منتشرشدهٔ خودِ کاربر (شناسه = آیتمِ اسکرپر، قابلِ استفاده به‌عنوان targetId).
    if (!preListing) {
      fetch('/api/listing-stats?mine=1').then(r => r.ok ? r.json() : null).then(d => {
        setListings((d?.listings || []).map((l: any) => ({ id: l.id, title: l.title, location: l.location, price: l.price, image: l.image })))
        setLoadedListings(true)
      }).catch(() => setLoadedListings(true))
    }
  }, [preListing])

  const discPrice = (p: number) => Math.round(p * (1 - discount / 100))
  const tier = tiers.find(t => t.id === tierId)
  const listing = preListing || listings.find(l => l.id === listingId)
  const canProceed = !!tier && !!listing

  const submit = async (gateway: string, receipt: string, payFromWallet = false) => {
    if (!tier || !listing) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/comm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'orderPromo', tierId: tier.id, targetId: listing.id, targetName: listing.title, gateway, receipt, payFromWallet }),
      })
      const d = await r.json()
      if (d.ok) { setMsg(d.walletPaid ? '✓ از کیفِ پول پرداخت و بلافاصله فعال شد. آگهیِ شما اکنون ویژه است.' : '✓ سفارشِ پروموت ثبت شد. پس از تأییدِ پرداخت، آگهیِ شما ویژه می‌شود.'); setTimeout(() => { onDone?.(); onClose() }, 1500) }
      else setMsg(`⚠ ${d.error || 'خطا'}`)
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 18, maxWidth: 560, width: '100%', margin: '24px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>🚀 پروموتِ آگهی</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {discount > 0 && <div style={{ fontSize: 11.5, color: 'var(--gold)', marginBottom: 12 }}>٪{fa(discount)} تخفیفِ پلنِ اشتراکِ شما روی این پروموت اعمال شده است.</div>}

        {step === 'select' ? (
          <>
            {/* آگهیِ هدف */}
            <div style={{ fontSize: 13, fontWeight: 800, margin: '10px 0 8px' }}>۱. آگهیِ موردِ نظر</div>
            {preListing ? (
              <div style={{ padding: '11px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{preListing.title}</div>
            ) : !loadedListings ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12 }}>در حالِ بارگذاریِ آگهی‌ها…</div>
            ) : listings.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '12px 14px', background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 12, lineHeight: 1.9 }}>
                آگهیِ منتشرشده‌ای ندارید. ابتدا از پنلِ خود یک فایل ثبت و منتشر کنید، سپس آن را پروموت کنید.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {listings.map(l => {
                  const on = listingId === l.id
                  return (
                    <button key={l.id} onClick={() => setListingId(l.id)} style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, background: on ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}` }}>
                      {l.image ? <img src={l.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>◰</span>}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                        {(l.location || l.price) && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{[l.location, l.price].filter(Boolean).join(' · ')}</span>}
                      </span>
                      {on && <span style={{ color: 'var(--gold)', fontWeight: 900, flexShrink: 0 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* بستهٔ پروموت */}
            <div style={{ fontSize: 13, fontWeight: 800, margin: '18px 0 8px' }}>۲. بستهٔ پروموت</div>
            {preTierId && tier ? (
              <div style={{ padding: '11px 14px', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{tier.name}{tier.kind ? ` · ${tier.kind}` : ''}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--gold)' }}>{fa(discPrice(tier.price))} تومان · {fa(tier.days)} روز</span>
              </div>
            ) : tiers.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12 }}>بستهٔ پروموتی برای نقشِ شما تعریف نشده است.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                {tiers.map(t => {
                  const on = tierId === t.id
                  return (
                    <button key={t.id} onClick={() => setTierId(t.id)} style={{ textAlign: 'right', padding: '12px 14px', borderRadius: 13, cursor: 'pointer', fontFamily: FONT, background: on ? 'var(--goldDim)' : 'var(--surface)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13 }}>{t.name}</b>
                        {t.kind && <span style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--gold)', fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: '2px 8px' }}>{t.kind}</span>}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>{t.desc}</span>
                      {t.where && <span style={{ fontSize: 10, color: 'var(--gold2)' }}>📍 {t.where}</span>}
                      <span style={{ fontSize: 13.5, fontWeight: 900, color: 'var(--gold)', display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                        {discount > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textDecoration: 'line-through' }}>{fa(t.price)}</span>}
                        <span>{fa(discPrice(t.price))}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>تومان · {fa(t.days)} روز</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a', marginTop: 14, textAlign: 'center' }}>{msg}</div>}
            <button onClick={() => setStep('pay')} disabled={!canProceed} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: 'none', background: canProceed ? 'linear-gradient(135deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: canProceed ? '#16140f' : 'var(--muted)', fontWeight: 800, fontSize: 14, cursor: canProceed ? 'pointer' : 'not-allowed', fontFamily: FONT }}>
              ادامه به پرداخت{tier ? ` — ${fa(discPrice(tier.price))} تومان` : ''}
            </button>
          </>
        ) : (
          <PayStep
            title={`${tier?.name || ''} — ${listing?.title || ''}`}
            price={tier ? discPrice(tier.price) : 0}
            wallet={wallet}
            busy={busy}
            msg={msg}
            onBack={() => setStep('select')}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  )
}

// گامِ پرداخت — همان روش‌های پرداختِ /api/payment/methods.
function PayStep({ title, price, wallet, busy, msg, onBack, onSubmit }: { title: string; price: number; wallet: number; busy: boolean; msg: string; onBack: () => void; onSubmit: (gateway: string, receipt: string, payFromWallet?: boolean) => void }) {
  const [gws, setGws] = useState<Gateway[]>([])
  const [sel, setSel] = useState('')
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
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: FONT, padding: '4px 0', marginBottom: 6 }}>‹ بازگشت به انتخاب</button>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>{title} — <b style={{ color: 'var(--gold)' }}>{price > 0 ? fa(price) + ' تومان' : 'رایگان'}</b></div>
      {wallet >= price && price > 0 && (
        <div style={{ marginBottom: 14, padding: 14, background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>💳 پرداخت از کیفِ پولِ پروموت <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(موجودی: {fa(wallet)} تومان)</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.8 }}>پروموت بلافاصله و بدونِ انتظارِ تأییدِ مدیر فعال می‌شود.</div>
          <button onClick={() => onSubmit('wallet', '', true)} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال پرداخت…' : `پرداختِ فوری از کیفِ پول (${fa(price)} تومان)`}</button>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>یا با روشِ دیگری پرداخت کنید:</div>
        </div>
      )}
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
          {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a', marginBottom: 12, textAlign: 'center' }}>{msg}</div>}
          <button onClick={() => onSubmit(g?.id || '', receipt.trim())} disabled={busy || (g?.type === 'card2card' && !receipt.trim())} style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONT, opacity: busy || (g?.type === 'card2card' && !receipt.trim()) ? 0.6 : 1 }}>{busy ? 'در حال ثبت…' : (g?.type === 'card2card' ? 'ثبتِ پرداخت (پس از تأیید فعال می‌شود)' : 'ثبتِ سفارش')}</button>
        </>
      )}
    </div>
  )
}
