'use client'
import { useEffect, useState } from 'react'

// هوشِ بازار — فقط محله‌هایی که خودِ کاربر در آن‌ها فایل دارد، و فقط سنجه‌هایی که
// از آگهی‌های واقعی محاسبه می‌شوند. ستون‌های «تقاضا/نقدشوندگی/سلامت» حذف شدند:
// ۸۰٪ نمرهٔ سلامت روی demand بنا بود و demand از بازدید می‌آمد که ثبت نمی‌شود.
type Cell = {
  city: string; hood: string; deal: string; ptype: string
  listings: number; medianPerM: number; p25PerM: number; p75PerM: number
  medianArea: number; medianDeposit?: number
}
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const m = (n: number) => fa(Math.round((n || 0) / 1e6))
const k = (n: number) => fa(Math.round((n || 0) / 1e3))

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title || 'هوشِ بازار'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {scoped && !all ? 'محله‌هایی که در آن‌ها فایل دارید' : 'کلِ بازار'}
        </span>
        <button
          onClick={() => setAll(v => !v)}
          style={{ marginInlineStart: 'auto', fontSize: 11.5, background: 'transparent',
            border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px',
            color: 'var(--muted)', cursor: 'pointer' }}
        >{all ? 'فقط محله‌های من' : 'دیدنِ کلِ بازار'}</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '18px 0' }}>در حالِ محاسبه…</div>
      ) : !byHood.size ? (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '18px 0' }}>
          هنوز فایلی ثبت نکرده‌اید — با «دیدنِ کلِ بازار» می‌توانید آمارِ کلی را ببینید.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {[...byHood.entries()].map(([hood, list]) => (
            <div key={hood} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{hood}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 8,
                fontSize: 11.5, color: 'var(--muted)', paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
                <span>نوعِ ملک</span><span>معامله</span><span>فایل</span><span>میانه</span><span>بازه</span>
              </div>
              {list.map(c => (
                <div key={c.ptype + c.deal} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto',
                  gap: 8, fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{c.ptype}</span>
                  <span style={{ color: 'var(--muted)' }}>{c.deal}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fa(c.listings)}</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {c.deal === 'اجاره' ? `${k(c.medianPerM)} هزار/متر` : `${m(c.medianPerM)} م/متر`}
                  </span>
                  <span style={{ color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                    {c.deal === 'اجاره'
                      ? `${k(c.p25PerM)}–${k(c.p75PerM)}${c.medianDeposit ? ` · ودیعه ${m(c.medianDeposit)}م` : ''}`
                      : `${m(c.p25PerM)}–${m(c.p75PerM)}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12 }}>
            همهٔ اعداد از آگهی‌های واقعیِ ثبت‌شده محاسبه می‌شوند · «میانه» یعنی نصفِ فایل‌ها بالاتر و نصف پایین‌تر
          </div>
        </div>
      )}
    </div>
  )
}
