'use client'
import { useEffect, useState } from 'react'
import AreaPicker from '@/app/components/AreaPicker'

// پنلِ «مزایدهٔ محله‌محورِ آگهی» — در صفحهٔ پلن‌ها. برندهٔ هر محله در صدرِ آن محله
// (بالاتر از پروموت‌های عادی) نمایش داده می‌شود؛ مبلغ فقط در صورتِ برنده‌شدن، در پایانِ
// دورِ هفتگی از کیفِ پولِ پروموت کسر می‌شود.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface AuctionConfig { enabled: boolean; minBid: number; step: number; periodDays: number; label: string }
interface MyBid { area: string; amount: number; targetName: string; leading: boolean }
interface AreaStatus {
  cfg: { minBid: number; step: number; periodDays: number; label: string; enabled: boolean }
  area: string; roundEndsAt: number | null; topBid: number; bidCount: number
  myBid: number | null; minNext: number
  lastWinner: { owner: string; targetName: string; amount: number; at: number } | null
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
  const [config, setConfig] = useState<AuctionConfig | null>(null)
  const [myBids, setMyBids] = useState<MyBid[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [busyArea, setBusyArea] = useState('')

  const load = () => fetch('/api/auction').then(r => r.ok ? r.json() : null).then(d => {
    if (d) { setConfig(d.config || null); setMyBids(d.myBids || []) }
    setLoaded(true)
  }).catch(() => setLoaded(true))
  useEffect(() => { load() }, [])

  const cancel = async (area: string) => {
    setBusyArea(area)
    try { await fetch('/api/auction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelBid', area }) }) } catch {}
    setBusyArea('')
    load()
  }

  if (!loaded) return null
  if (config && config.enabled === false) return (
    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>مزایده در حالِ حاضر غیرفعال است</div>
  )
  if (!config) return null

  return (
    <>
      <div style={{ fontSize: 16, fontWeight: 900, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🏆 مزایدهٔ محله‌محورِ آگهی</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -8, lineHeight: 1.9 }}>برندهٔ هر محله در <b style={{ color: 'var(--text)' }}>صدرِ آن محله</b> (بالاتر از پروموت‌های عادی) نمایش داده می‌شود؛ مبلغ فقط در صورتِ برنده‌شدن، در پایانِ دورِ هفتگی از کیفِ پولِ پروموت کسر می‌شود.</div>

      {myBids.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myBids.map(b => (
            <div key={b.area} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(160deg, rgba(212,175,55,.08), var(--surface) 65%)', border: '1px solid var(--gold)', borderRadius: 13, padding: '11px 14px', flexWrap: 'wrap' }}>
              <span style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>📍 {b.area}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.targetName}</b>
                <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>{fa(b.amount)} تومان</span>
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '4px 11px', flexShrink: 0, background: b.leading ? 'rgba(95,217,138,.15)' : 'rgba(231,163,74,.15)', color: b.leading ? '#5fd98a' : '#e7a34a' }}>{b.leading ? '✓ پیشتاز' : '↑ عقب افتاده'}</span>
              <button onClick={() => cancel(b.area)} disabled={busyArea === b.area} style={{ padding: '7px 13px', borderRadius: 9, background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: FONT, flexShrink: 0, opacity: busyArea === b.area ? 0.5 : 1 }}>{busyArea === b.area ? '…' : 'لغو'}</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setModalOpen(true)} style={{ alignSelf: 'flex-start', padding: '11px 20px', borderRadius: 12, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13.5, border: 'none', cursor: 'pointer', fontFamily: FONT }}>＋ ثبتِ پیشنهاد در یک محله</button>

      {modalOpen && <BidModal config={config} onClose={() => setModalOpen(false)} onDone={() => { setModalOpen(false); load() }} />}
    </>
  )
}

function BidModal({ config, onClose, onDone }: { config: AuctionConfig; onClose: () => void; onDone: () => void }) {
  const [area, setArea] = useState('')
  const [status, setStatus] = useState<AreaStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [listings, setListings] = useState<OwnListing[]>([])
  const [loadedListings, setLoadedListings] = useState(false)
  const [listingId, setListingId] = useState('')
  const [amount, setAmount] = useState(config.minBid)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // آگهی‌های منتشرشدهٔ خودِ کاربر (شناسه = targetId).
  useEffect(() => {
    fetch('/api/listing-stats?mine=1').then(r => r.ok ? r.json() : null).then(d => {
      setListings((d?.listings || []).map((l: any) => ({ id: l.id, title: l.title, location: l.location, price: l.price, image: l.image })))
      setLoadedListings(true)
    }).catch(() => setLoadedListings(true))
  }, [])

  // با انتخابِ محله، وضعیتِ همان محله را می‌گیریم و مبلغ را روی حداقلِ بعدی می‌گذاریم.
  useEffect(() => {
    if (!area) { setStatus(null); return }
    setLoadingStatus(true); setStatus(null)
    fetch(`/api/auction?area=${encodeURIComponent(area)}`).then(r => r.ok ? r.json() : null).then(d => {
      const st: AreaStatus | null = d?.status || null
      setStatus(st)
      setAmount(st?.minNext ?? config.minBid)
      setLoadingStatus(false)
    }).catch(() => setLoadingStatus(false))
  }, [area, config.minBid])

  const step = status?.cfg.step || config.step
  const minNext = status?.minNext ?? config.minBid

  const submit = async () => {
    if (!area) { setMsg('⚠ محله را انتخاب کنید'); return }
    if (!listingId) { setMsg('⚠ آگهی را انتخاب کنید'); return }
    if (amount < minNext) { setMsg(`⚠ حداقلِ پیشنهاد ${fa(minNext)} تومان است`); return }
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/auction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'placeBid', area, targetId: listingId, amount }) })
      const d = await r.json()
      if (d.ok) { setMsg('✓ پیشنهادِ شما ثبت شد.'); setTimeout(onDone, 1000) }
      else setMsg(`⚠ ${d.error || 'خطا'}`)
    } catch { setMsg('⚠ خطا در ارتباط با سرور') } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 18, maxWidth: 500, width: '100%', margin: '24px 0', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>🏆 ثبتِ پیشنهاد در یک محله</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.8 }}>برندهٔ هر محله در صدرِ آن نمایش داده می‌شود. مبلغ فقط در صورتِ برنده‌شدن، در پایانِ دور از کیفِ پول کسر می‌شود.</div>

        {/* ۱. محله */}
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>۱. محله</div>
        <AreaPicker value={area ? [area] : []} onChange={v => setArea(v[0] || '')} max={1} />

        {/* وضعیتِ محله */}
        {area && (
          <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 12, padding: 14 }}>
            {loadingStatus ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>در حالِ بارگذاریِ وضعیتِ محله…</div> : status ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px' }}>⏳ {timeLeft(status.roundEndsAt)}</span>
                  <span style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px' }}>{fa(status.bidCount)} پیشنهاد</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>بالاترین پیشنهاد:</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--gold)' }}>{status.topBid > 0 ? `${fa(status.topBid)} تومان` : 'هنوز پیشنهادی نیست'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>حداقلِ پیشنهادِ بعدی: <b style={{ color: 'var(--gold)' }}>{fa(status.minNext)} تومان</b></div>
                {status.lastWinner && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>دورِ قبل: «{status.lastWinner.targetName}» با {fa(status.lastWinner.amount)} تومان</div>}
              </>
            ) : <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>وضعیتِ این محله در دسترس نیست.</div>}
          </div>
        )}

        {/* ۲. آگهی */}
        <div style={{ fontSize: 13, fontWeight: 800, margin: '18px 0 8px' }}>۲. آگهیِ موردِ نظر</div>
        {!loadedListings ? <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 12 }}>در حالِ بارگذاری…</div>
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

        {/* ۳. مبلغ */}
        <div style={{ fontSize: 13, fontWeight: 800, margin: '18px 0 8px' }}>۳. مبلغِ پیشنهاد (تومان)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setAmount(a => Math.max(minNext, a - step))} style={{ width: 40, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: FONT }}>−</button>
          <input value={amount} onChange={e => setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))} inputMode="numeric" style={{ flex: 1, height: 42, textAlign: 'center', padding: '0 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 15, fontWeight: 800, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }} />
          <button onClick={() => setAmount(a => a + step)} style={{ width: 40, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', fontFamily: FONT }}>+</button>
        </div>

        {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a', marginTop: 14, textAlign: 'center' }}>{msg}</div>}
        <button onClick={submit} disabled={busy || !area || !listingId} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: 'none', background: (busy || !area || !listingId) ? 'var(--bg2)' : 'linear-gradient(135deg,var(--gold2),var(--gold))', color: (busy || !area || !listingId) ? 'var(--muted)' : '#16140f', fontWeight: 800, fontSize: 14, cursor: (busy || !area || !listingId) ? 'not-allowed' : 'pointer', fontFamily: FONT }}>{busy ? 'در حال ثبت…' : `ثبتِ پیشنهاد (${fa(amount)} تومان)`}</button>
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.8 }}>مبلغ فقط در صورتِ برنده‌شدن، در پایانِ دور از کیفِ پول کسر می‌شود.</div>
      </div>
    </div>
  )
}
