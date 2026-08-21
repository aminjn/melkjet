'use client'
import { useEffect, useState } from 'react'

// هوشِ بازار — محله‌های خودِ کاربر، فقط سنجه‌های محاسبه‌شده از آگهی‌های واقعی.
// «تقاضا/نقدشوندگی/سلامت» حذف شدند: ۸۰٪ نمرهٔ سلامت روی demand بنا بود و demand
// از بازدید می‌آمد که عملاً ثبت نمی‌شود.
type Cell = {
  city: string; hood: string; deal: string; ptype: string
  listings: number; medianPerM: number; p25PerM: number; p75PerM: number
  medianArea: number; medianDeposit?: number
}
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const M = (n: number) => fa(Math.round((n || 0) / 1e6))
const K = (n: number) => fa(Math.round((n || 0) / 1e3))

function Tile({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12,
      padding: '11px 13px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        color: gold ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
      {sub ? <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}

function DealBlock({ c }: { c: Cell }) {
  const rent = c.deal === 'اجاره'
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
          background: rent ? 'rgba(96,165,250,.12)' : 'rgba(217,173,62,.14)',
          color: rent ? '#60a5fa' : 'var(--gold)',
        }}>{c.deal}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.ptype}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(112px,1fr))', gap: 9 }}>
        <Tile gold
          label={rent ? 'اجارهٔ میانه' : 'قیمتِ میانه'}
          value={rent ? `${K(c.medianPerM)} هزار/متر` : `${M(c.medianPerM)} م/متر`}
          sub={rent && c.medianDeposit ? `ودیعه ${M(c.medianDeposit)}م` : undefined}
        />
        <Tile
          label="بازهٔ متعارف"
          value={rent ? `${K(c.p25PerM)}–${K(c.p75PerM)}` : `${M(c.p25PerM)}–${M(c.p75PerM)}`}
          sub="نیمهٔ میانیِ بازار"
        />
        <Tile label="فایلِ مقایسه‌شده" value={fa(c.listings)} sub={`میانهٔ متراژ ${fa(c.medianArea)}`} />
      </div>
    </div>
  )
}

export default function ReosMarketIntel({ title }: { title?: string } = {}) {
  const [cells, setCells] = useState<Cell[] | null>(null)
  const [scoped, setScoped] = useState(true)
  const [all, setAll] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    setLoading(true)
    fetch('/api/reos/area-stats' + (all ? '?all=1' : ''))
      .then(r => r.json())
      .then(d => { if (on) { setCells(d?.cells || []); setScoped(!!d?.scoped); setLoading(false) } })
      .catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [all])

  const byHood = new Map<string, Cell[]>()
  for (const c of cells || []) {
    const key = c.city ? `${c.city} · ${c.hood}` : c.hood
    byHood.set(key, [...(byHood.get(key) || []), c])
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title || 'هوشِ بازار'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {scoped && !all ? 'محله‌هایی که در آن‌ها فایل دارید' : 'کلِ بازار'}
        </span>
        <button
          onClick={() => setAll(v => !v)}
          style={{
            marginInlineStart: 'auto', fontSize: 11.5, background: 'transparent',
            border: '1px solid var(--line)', borderRadius: 999, padding: '5px 12px',
            color: 'var(--muted)', cursor: 'pointer',
          }}
        >{all ? 'فقط محله‌های من' : 'دیدنِ کلِ بازار'}</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '22px 0' }}>در حالِ محاسبه…</div>
      ) : !byHood.size ? (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '22px 0' }}>
          هنوز فایلی ثبت نکرده‌اید — با «دیدنِ کلِ بازار» آمارِ کلی را ببینید.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 12, marginTop: 14 }}>
            {[...byHood.entries()].map(([hood, list]) => (
              <div key={hood} style={{
                border: '1px solid var(--line)', borderRadius: 14, padding: 14,
                background: 'var(--surface)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{hood}</span>
                </div>
                {list.map(c => <DealBlock key={c.ptype + c.deal} c={c} />)}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.9 }}>
            همهٔ اعداد از آگهی‌های واقعیِ ثبت‌شده محاسبه می‌شوند · «میانه» یعنی نصفِ فایل‌ها بالاتر و نصف پایین‌ترند
          </div>
        </>
      )}
    </div>
  )
}
