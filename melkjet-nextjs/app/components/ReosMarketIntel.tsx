'use client'
import { useEffect, useState } from 'react'

// هوشِ بازارِ REOS — محله‌های خودِ کاربر، به زبانی که مشاور بدونِ دانشِ آماری بفهمد.
// طراحی: هیچ کارتی داخلِ کارتِ دیگر نیست. هر محله یک قابِ واحد است و بخش‌های
// «فروش» و «اجاره» فقط با یک خطِ نازک از هم جدا می‌شوند — نه با جعبهٔ تودرتو.

type Amenity = { name: string; premiumPct: number; withCount: number }
type Deal = {
  deal: string; ptype: string; listings: number
  medianPerM: number; p25PerM: number; p75PerM: number
  typicalArea: number; typicalTotal: number; areaBand: [number, number]
  typicalDeposit?: number; typicalMonthly?: number; fullRahn?: number
  typicalAge: number | null; agePremiumPct: number | null
  amenities: Amenity[]; topRooms: number | null; medianFloor: number | null
}
type Hood = { city: string; hood: string; deals: Deal[]; totalListings: number; rank?: number; rankOf?: number }

const fa = (n: number) => Math.round(n || 0).toLocaleString('fa-IR')

function money(n: number): string {
  n = Math.round(n || 0)
  if (n >= 1e9) {
    const b = Math.floor(n / 1e9), rem = Math.round((n % 1e9) / 1e6)
    return fa(b) + ' میلیارد' + (rem >= 1 ? ' و ' + fa(rem) + ' میلیون' : '')
  }
  if (n >= 1e6) return fa(n / 1e6) + ' میلیون'
  if (n >= 1e3) return fa(n / 1e3) + ' هزار'
  return fa(n)
}
const perMeter = (n: number) => n >= 1e6 ? fa(n / 1e6) + ' م' : fa(n / 1e3) + ' هزار'

function lines(d: Deal): string[] {
  const out: string[] = []
  if (d.deal === 'اجاره') {
    const dep = d.typicalDeposit || 0, mon = d.typicalMonthly || 0
    if (mon > 0 || dep > 0) out.push('اجارهٔ رایج: ' + money(mon) + ' ماهانه با ' + money(dep) + ' ودیعه')
    if (d.fullRahn) out.push('رهنِ کامل: حدودِ ' + money(d.fullRahn) + ' تومان')
  }
  if (d.agePremiumPct !== null && d.agePremiumPct !== 0) {
    const p = Math.abs(d.agePremiumPct)
    out.push(d.agePremiumPct > 0
      ? 'نوساز ' + fa(p) + '٪ گران‌تر از ۱۵ سال به بالا'
      : 'نوسازی اینجا مزیتِ قیمتی ندارد (' + fa(p) + '٪ کمتر)')
  }
  const good = d.amenities.filter(a => a.premiumPct > 2)
  if (good.length) out.push(good.map(a => a.name + ' +' + fa(a.premiumPct) + '٪').join(' · '))
  const sup: string[] = [fa(d.areaBand[0]) + '–' + fa(d.areaBand[1]) + ' متر']
  if (d.typicalAge !== null) sup.push('سنِ معمول ' + fa(d.typicalAge) + ' سال')
  if (d.topRooms) sup.push(fa(d.topRooms) + ' خوابه')
  if (d.medianFloor !== null) sup.push('طبقهٔ ' + fa(d.medianFloor))
  out.push(sup.join(' · '))
  return out
}

/** نوارِ بازه: جایگاهِ میانه بینِ ۲۵٪ و ۷۵٪ بازار — یک نگاه، نه خواندنِ سه عدد. */
function RangeBar({ p25, p50, p75 }: { p25: number; p50: number; p75: number }) {
  const span = Math.max(1, p75 - p25)
  const pos = Math.min(96, Math.max(4, ((p50 - p25) / span) * 100))
  return (
    <div style={{ margin: '9px 0 2px' }}>
      <div style={{ position: 'relative', height: 5, borderRadius: 999, background: 'var(--line)' }}>
        <div style={{ position: 'absolute', insetBlock: 0, insetInline: 0, borderRadius: 999,
          background: 'linear-gradient(to left, transparent, var(--gold))', opacity: .3 }} />
        <div style={{ position: 'absolute', top: -3.5, insetInlineStart: 'calc(' + pos + '% - 6px)',
          width: 12, height: 12, borderRadius: 999, background: 'var(--gold)', border: '2px solid var(--bg2)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--faint)',
        marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
        <span>{perMeter(p25)}</span><span>ارزان‌تر ← بازار → گران‌تر</span><span>{perMeter(p75)}</span>
      </div>
    </div>
  )
}

const chip: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
  border: '1px solid var(--line)', color: 'var(--muted)', whiteSpace: 'nowrap',
}

function DealSection({ d, first }: { d: Deal; first: boolean }) {
  const rent = d.deal === 'اجاره'
  return (
    <div style={{ paddingTop: first ? 0 : 14, marginTop: first ? 0 : 14, borderTop: first ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ ...chip, color: 'var(--gold)', borderColor: 'var(--gold)' }}>{d.deal}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d.ptype}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{fa(d.listings)} فایل</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {rent ? 'واحدِ معمولِ این محله' : 'آپارتمانِ معمولِ این محله'} · {fa(d.typicalArea)} متر
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', lineHeight: 1.7,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-.2px' }}>
        {rent ? money(d.typicalMonthly || 0) + ' ماهانه' : money(d.typicalTotal) + ' تومان'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {rent ? 'اجارهٔ مؤثرِ متری ' : 'متری '}{perMeter(d.medianPerM)}
      </div>

      <RangeBar p25={d.p25PerM} p50={d.medianPerM} p75={d.p75PerM} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
        {lines(d).map((t, i) => (
          <span key={i} style={{ fontSize: 11.5, color: 'var(--text)', opacity: .9, background: 'var(--bg)',
            border: '1px solid var(--line)', borderRadius: 9, padding: '5px 9px', lineHeight: 1.9 }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export default function ReosMarketIntel({ title }: { title?: string } = {}) {
  const [data, setData] = useState<{ scoped: boolean; insights: Hood[] } | null>(null)
  const [all, setAll] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true; setLoading(true)
    fetch('/api/reos/area-stats' + (all ? '?all=1' : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (on) { setData(d); setLoading(false) } })
      .catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [all])

  if (loading && !data) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حالِ خواندنِ بازارِ محله‌های شما…</div>
  const hoods = data?.insights || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title || 'هوشِ بازار (REOS)'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {data?.scoped ? 'محله‌هایی که در آن‌ها فایل دارید' : 'کلِ بازار'}
        </span>
        <button onClick={() => setAll(!all)} style={{ ...chip, cursor: 'pointer', background: 'transparent' }}>
          {all ? 'فقط محله‌های من' : 'دیدنِ کلِ بازار'}
        </button>
      </div>

      {!hoods.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>
          هنوز در محله‌های شما فایلِ کافی برای تحلیل نیست. با ثبتِ چند فایل، تحلیلِ همان محله‌ها اینجا ساخته می‌شود.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 12 }}>
          {hoods.map(h => (
            <div key={h.city + h.hood} style={{ background: 'var(--bg2)', border: '1px solid var(--line)',
              borderRadius: 16, padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>{h.hood}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{h.city}</span>
                {h.rank && h.rankOf && h.rankOf > 1 ? (
                  <span style={chip}>{h.rank === 1 ? 'گران‌ترین محلهٔ شما' : fa(h.rank) + 'اُم از ' + fa(h.rankOf)}</span>
                ) : null}
              </div>
              {h.deals.map((d, i) => <DealSection key={i} d={d} first={i === 0} />)}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.9 }}>
        اعداد از قیمتِ آگهی‌های واقعیِ ثبت‌شده حساب می‌شوند. «میانه» یعنی نصفِ فایل‌ها بالاتر و نصف پایین‌ترند.
        در اجاره، ودیعه با نرخِ عرفیِ هر ۱۰۰ میلیون ≈ ۳ میلیون به اجاره تبدیل می‌شود تا رهنِ کامل و اجاره قابلِ مقایسه شوند.
      </div>
    </div>
  )
}
