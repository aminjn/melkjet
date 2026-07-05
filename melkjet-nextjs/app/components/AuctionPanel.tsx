'use client'
import { useEffect, useState } from 'react'

// پنلِ «مزایدهٔ جایگاهِ ویژه» — در صفحهٔ پلن‌ها. سیستمِ خودگردان: کاربر برای آگهیِ خود
// پیشنهاد می‌دهد؛ در پایانِ دور، بالاترین پیشنهاد از کیفِ پول تسویه و آگهی ویژه می‌شود.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface AuctionStatus {
  slot: { id: string; label: string; minBid: number; step: number; periodDays: number; kind: string }
  roundEndsAt: number | null; topBid: number; bidCount: number; myBid: number | null; minNext: number
  lastWinner: { targetName: string; amount: number } | null
}
type OwnListing = { id: string; title: string; location?: string; price?: string; image?: string }

function timeLeft(end: number | null): string {
  if (!end) return 'دوری فعال نیست'
  const ms = end - Date.now()
  if (ms <= 0) return 'در حالِ تسویه…'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  if (d > 0) return `${fa(d)} روز و ${fa(h)} ساعت`
  const m = Math.floor((ms % 3600000) / 60000)
  return `${fa(h)} ساعت و ${fa(m)} دقیقه`
}

export default function AuctionPanel() {
  const [auctions, setAuctions] = useState<AuctionStatus[]>([])
  const [bidFor, setBidFor] = useState<AuctionStatus | null>(null)
  const load = () => fetch('/api/auction').then(r => r.ok ? r.json() : null).then(d => { if (d) setAuctions(d.auctions || []) }).catch(() => {})
  useEffect(() => { load() }, [])
  if (auctions.length === 0) return null
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>🏆 مزایدهٔ جایگاهِ ویژه</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -8, lineHeight: 1.8 }}>برای گران‌ترین جایگاه‌ها رقابت کنید. در پایانِ هر دور، بالاترین پیشنهاد <b style={{ color: 'var(--text)' }}>از کیفِ پولِ پروموت</b> تسویه و آگهی‌اش برای آن مدت ویژه می‌شود. (کیفِ پولتان را از بخشِ «اعتبارِ پروموت» شارژ کنید.)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        {auctions.map(a => {
          const leading = a.myBid != null && a.myBid >= a.topBid && a.topBid > 0
          return (
            <div key={a.slot.id} style={{ background: 'linear-gradient(160deg, rgba(212,175,55,.08), var(--surface) 65%)', border: '1.5px solid var(--gold)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>{a.slot.label}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px' }}>⏳ {timeLeft(a.roundEndsAt)}</span>
                <span style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px' }}>{fa(a.bidCount)} پیشنهاد</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>بالاترین پیشنهاد:</span>
                <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--gold)' }}>{a.topBid > 0 ? `${fa(a.topBid)} تومان` : 'هنوز پیشنهادی نیست'}</span>
              </div>
              {a.myBid != null && (
                <div style={{ fontSize: 12, fontWeight: 700, color: leading ? '#5fd98a' : '#e7a34a' }}>
                  {leading ? '✓ پیشنهادِ شما پیشتاز است' : '↑ پیشنهادِ شما عقب افتاده'} ({fa(a.myBid)} تومان)
                </div>
              )}
              {a.lastWinner && <div style={{ fontSize: 11, color: 'var(--muted)' }}>دورِ قبل: «{a.lastWinner.targetName}» با {fa(a.lastWinner.amount)} تومان</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <button onClick={() => setBidFor(a)} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 12.5, border: 'none', cursor: 'pointer', fontFamily: FONT }}>{a.myBid != null ? 'افزایشِ پیشنهاد' : 'ثبتِ پیشنهاد'}</button>
                {a.myBid != null && <button onClick={async () => { await fetch('/api/auction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelBid', slot: a.slot.id }) }); load() }} style={{ padding: '9px 12px', borderRadius: 10, background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>لغو</button>}
              </div>
            </div>
          )
        })}
      </div>
      {bidFor && <BidModal auction={bidFor} onClose={() => setBidFor(null)} onDone={() => { setBidFor(null); load() }} />}
    </>
  )
}

function BidModal({ auction, onClose, onDone }: { auction: AuctionStatus; onClose: () => void; onDone: () => void }) {
  const [listings, setListings] = useState<OwnListing[]>([])
  const [loaded, setLoaded] = useState(false)
  const [listingId, setListingId] = useState('')
  const [amount, setAmount] = useState(auction.minNext)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    fetch('/api/listing-stats?mine=1').then(r => r.ok ? r.json() : null).then(d => {
      setListings((d?.listings || []).map((l: any) => ({ id: l.id, title: l.title, location: l.location, price: l.price, image: l.image })))
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])
  const submit = async () => {
    if (!listingId) { setMsg('⚠ آگهی را انتخاب کنید'); return }
    if (amount < auction.minNext) { setMsg(`⚠ حداقلِ پیشنهاد ${fa(auction.minNext)} تومان است`); return }
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/auction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'placeBid', slot: auction.slot.id, targetId: listingId, amount }) })
      const d = await r.json()
      if (d.ok) { setMsg('✓ پیشنهادِ شما ثبت شد.'); setTimeout(onDone, 1000) }
      else setMsg(`⚠ ${d.error || 'خطا'}`)
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 18, maxWidth: 500, width: '100%', margin: '24px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>🏆 پیشنهاد برای «{auction.slot.label}»</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>حداقلِ پیشنهادِ بعدی: <b style={{ color: 'var(--gold)' }}>{fa(auction.minNext)} تومان</b> · مدتِ جایگاه: {fa(auction.slot.periodDays)} روز</div>

        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>۱. آگهیِ موردِ نظر</div>
        {!loaded ? <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12 }}>در حالِ بارگذاری…</div>
          : listings.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '12px 14px', background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 12, lineHeight: 1.9 }}>آگهیِ منتشرشده‌ای ندارید. ابتدا یک فایل ثبت و منتشر کنید.</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {listings.map(l => { const on = listingId === l.id; return (
                  <button key={l.id} onClick={() => setListingId(l.id)} style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, background: on ? 'var(--goldDim)' : 'var(--bg2)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}` }}>
                    {l.image ? <img src={l.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>◰</span>}
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                      {(l.location || l.price) && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{[l.location, l.price].filter(Boolean).join(' · ')}</span>}
                    </span>
                    {on && <span style={{ color: 'var(--gold)', fontWeight: 900 }}>✓</span>}
                  </button>
                )})}
              </div>
            )}

        <div style={{ fontSize: 13, fontWeight: 800, margin: '18px 0 8px' }}>۲. مبلغِ پیشنهاد (تومان)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setAmount(a => Math.max(auction.minNext, a - auction.slot.step))} style={{ width: 40, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: FONT }}>−</button>
          <input value={amount} onChange={e => setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))} inputMode="numeric" style={{ flex: 1, height: 42, textAlign: 'center', padding: '0 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 15, fontWeight: 800, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }} />
          <button onClick={() => setAmount(a => a + auction.slot.step)} style={{ width: 40, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: FONT }}>+</button>
        </div>

        {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a', marginTop: 14, textAlign: 'center' }}>{msg}</div>}
        <button onClick={submit} disabled={busy || !listingId} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: 'none', background: (busy || !listingId) ? 'var(--bg2)' : 'linear-gradient(135deg,var(--gold2),var(--gold))', color: (busy || !listingId) ? 'var(--muted)' : '#16140f', fontWeight: 800, fontSize: 14, cursor: (busy || !listingId) ? 'not-allowed' : 'pointer', fontFamily: FONT }}>{busy ? 'در حال ثبت…' : `ثبتِ پیشنهاد (${fa(amount)} تومان)`}</button>
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.8 }}>مبلغ فقط در صورتِ برنده‌شدن، در پایانِ دور از کیفِ پول کسر می‌شود.</div>
      </div>
    </div>
  )
}
