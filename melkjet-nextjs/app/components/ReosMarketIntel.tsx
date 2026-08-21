'use client'
import { useEffect, useState } from 'react'

// هوشِ بازارِ REOS — محله‌های خودِ کاربر، به زبانی که یک مشاور بدونِ دانشِ آماری بفهمد.
// اصلِ طراحی: مشاور با «متری ۲۶۵ میلیون» تصمیم نمی‌گیرد، با «این واحد ۲۶ میلیارد
// می‌ارزد» تصمیم می‌گیرد. پس عددِ اول قیمتِ کلِ یک واحدِ نمونه است، نه قیمتِ متری.

type Amenity = { name: string; premiumPct: number; withCount: number }
type Deal = {
  deal: string; ptype: string; listings: number
  medianPerM: number; p25PerM: number; p75PerM: number
  typicalArea: number; typicalTotal: number; areaBand: [number, number]
  typicalDeposit?: number; typicalMonthly?: number; fullRahn?: number
  typicalAge: number | null
  agePremiumPct: number | null
  amenities: Amenity[]
  topRooms: number | null; medianFloor: number | null
}
type Hood = { city: string; hood: string; deals: Deal[]; totalListings: number; rank?: number; rankOf?: number }

const fa = (n: number) => Math.round(n || 0).toLocaleString('fa-IR')

/** تومان به زبانِ آدمیزاد: «۲۶ میلیارد و ۲۰۰ میلیون» نه «۲۶٬۲۰۰٬۰۰۰٬۰۰۰». */
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
const perMeter = (n: number) => n >= 1e6 ? fa(n / 1e6) + ' میلیون' : fa(n / 1e3) + ' هزار'

/** جمله‌های هر بخشِ معامله. هر جمله فقط وقتی ساخته می‌شود که داده‌اش واقعاً هست. */
function lines(d: Deal): string[] {
  const out: string[] = []
  if (d.deal === 'اجاره') {
    const dep = d.typicalDeposit || 0, mon = d.typicalMonthly || 0
    if (mon > 0 || dep > 0) {
      out.push('اجارهٔ رایجِ همین واحد: ' + money(mon) + ' تومان ماهانه با ' + money(dep) + ' تومان ودیعه.')
    }
    if (d.fullRahn) out.push('اگر رهنِ کامل بگیرد، حدودِ ' + money(d.fullRahn) + ' تومان.')
  }
  if (d.agePremiumPct !== null && d.agePremiumPct !== 0) {
    const p = Math.abs(d.agePremiumPct)
    out.push(d.agePremiumPct > 0
      ? 'نوسازها (تا ۵ سال) ' + fa(p) + '٪ گران‌ترند از واحدهای ۱۵ سال به بالا.'
      : 'اینجا نوسازی مزیتِ قیمتی ندارد — واحدهای قدیمی‌تر ' + fa(p) + '٪ بالاترند.')
  }
  const good = d.amenities.filter(a => a.premiumPct > 2)
  if (good.length) {
    out.push(good.map(a => a.name + ' ' + fa(a.premiumPct) + '٪').join(' و ') + ' به قیمت اضافه می‌کند.')
  }
  const sup: string[] = ['بیشترِ فایل‌ها ' + fa(d.areaBand[0]) + ' تا ' + fa(d.areaBand[1]) + ' متر']
  if (d.typicalAge !== null) sup.push('سنِ معمول ' + fa(d.typicalAge) + ' سال')
  if (d.topRooms) sup.push(fa(d.topRooms) + ' خوابه')
  if (d.medianFloor !== null) sup.push('طبقهٔ ' + fa(d.medianFloor))
  out.push(sup.join(' · ') + '.')
  return out
}

const card: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 16, padding: 16,
  display: 'flex', flexDirection: 'column', gap: 12,
}
const chip: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
  border: '1px solid var(--line)', color: 'var(--muted)', whiteSpace: 'nowrap',
}

function DealBlock({ d }: { d: Deal }) {
  const rent = d.deal === 'اجاره'
  return (
    <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ ...chip, color: 'var(--gold)', borderColor: 'var(--gold)' }}>{d.deal}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d.ptype}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{fa(d.listings)} فایل</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 2.1 }}>
        {rent ? 'یک واحدِ ' : 'آپارتمانِ معمولِ اینجا '}
        <b style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{fa(d.typicalArea)} متری</b>
        {rent ? ' در این محله' : ' حدودِ '}
        {!rent && <b style={{ color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{money(d.typicalTotal)} تومان</b>}
        {rent ? '.' : ' می‌ارزد.'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {rent ? 'اجارهٔ مؤثرِ متری ' : 'متری '}{perMeter(d.medianPerM)}
        {' · نیمهٔ میانیِ بازار '}{perMeter(d.p25PerM)}{' تا '}{perMeter(d.p75PerM)}
      </div>
      {lines(d).map((t, i) => (
        <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', opacity: .88, marginTop: 6, lineHeight: 2 }}>— {t}</div>
      ))}
    </div>
  )
}

export default function ReosMarketIntel({ title }: { title?: string } = {}) {
  const [data, setData] = useState<{ scoped: boolean; insights: Hood[]; myHoods: string[] } | null>(null)
  const [all, setAll] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    setLoading(true)
    fetch('/api/reos/area-stats' + (all ? '?all=1' : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (on) { setData(d); setLoading(false) } })
      .catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [all])

  if (loading && !data) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>در حالِ خواندنِ بازارِ محله‌های شما…</div>
  const hoods = data?.insights || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 13 }}>
          {hoods.map(h => (
            <div key={h.city + h.hood} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }} />
                <span style={{ fontSize: 14.5, fontWeight: 800 }}>{h.hood}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{h.city}</span>
                {h.rank && h.rankOf && h.rankOf > 1 ? (
                  <span style={chip}>{h.rank === 1 ? 'گران‌ترین محلهٔ شما' : fa(h.rank) + 'اُم از ' + fa(h.rankOf)}</span>
                ) : null}
              </div>
              {h.deals.map((d, i) => <DealBlock key={i} d={d} />)}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.9 }}>
        همهٔ اعداد از قیمتِ آگهی‌های واقعیِ ثبت‌شده حساب می‌شوند. «میانه» یعنی نصفِ فایل‌ها بالاتر و نصف پایین‌ترند.
        در اجاره، ودیعه با نرخِ عرفیِ هر ۱۰۰ میلیون ≈ ۳ میلیون به اجاره تبدیل می‌شود تا رهنِ کامل و اجاره قابلِ مقایسه شوند.
      </div>
    </div>
  )
}
