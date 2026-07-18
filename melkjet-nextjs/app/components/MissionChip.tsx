'use client'
// فاز ۱۶۲ — چیپِ ماموریتِ شناور روی صفحه‌های واقعیِ سایت (جستجو/آگهی/تحلیل بازار):
// حلقهٔ اصلیِ «امپراتوری» را داخلِ خودِ سایت زنده نگه می‌دارد — کاربر همان‌جا که آگهی می‌بیند،
// پیشرفتِ ماموریتِ روزش را می‌بیند و برای جایزه برمی‌گردد. فقط برای کاربرِ واردشده‌ای که
// امپراتوری دارد؛ برای بقیه هیچ‌چیزی رندر نمی‌شود. دادهٔ کوئست ۱۰۰٪ واقعی از /api/empire?quest=1.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const fa = (n: number) => n.toLocaleString('fa-IR')

export default function MissionChip() {
  const path = usePathname() || ''
  const watch = path.startsWith('/listing') || path.startsWith('/search') || path.startsWith('/market') || path.startsWith('/locations') || path.startsWith('/property')
  const [q, setQ] = useState<{ title: string; progress: number; target: number; done: boolean; claimed: boolean; rewardCoins?: number; pct?: number } | null>(null)
  const [gone, setGone] = useState(false)          // کاربر بست — تا پایانِ سشن ساکت
  const wasDone = useRef(false)
  const [burst, setBurst] = useState(false)        // لحظهٔ کامل‌شدن → جشنِ کوچک

  const load = async () => {
    try {
      const r = await fetch('/api/empire?quest=1', { cache: 'no-store', credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (!d?.daily) { setQ(null); return }
      if (d.daily.done && !wasDone.current && !d.daily.claimed) setBurst(true)
      wasDone.current = !!d.daily.done
      setQ(d.daily)
    } catch { /* آفلاین/مهمان → هیچ */ }
  }

  useEffect(() => {
    if (!watch || gone) return
    try { if (sessionStorage.getItem('mj-mission-hide') === '1') { setGone(true); return } } catch {}
    load()
    // بعد از هر بازدیدِ آگهی، رخداد با تأخیرِ کوتاه فلاش می‌شود → یک بازخوانیِ نرم
    const t = setTimeout(load, 4500)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, watch, gone])

  if (!watch || gone || !q || q.claimed) return null
  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100))
  return (
    <div className="mjmission" style={{ position: 'fixed', bottom: 14, left: 14, zIndex: 60, maxWidth: 300, direction: 'rtl' }}>
      {burst && <span aria-hidden style={{ position: 'absolute', top: -14, right: 10, fontSize: 20, animation: 'mjmPop .9s ease both' }}>🎉</span>}
      <div style={{ background: 'rgba(12,10,34,.92)', border: `1px solid ${q.done ? 'var(--gold)' : 'rgba(255,255,255,.16)'}`, borderRadius: 16, padding: '10px 12px', boxShadow: '0 12px 34px rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', color: '#f3ecdc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <b style={{ fontSize: 12.5, flex: 1, lineHeight: 1.7 }}>{q.done ? 'مأموریتِ امروز کامل شد!' : `مأموریتِ امروز: ${q.title}`}</b>
          <button aria-label="بستن" onClick={() => { setGone(true); try { sessionStorage.setItem('mj-mission-hide', '1') } catch {} }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 13, padding: 2, fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.12)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#ffd76a,#ff9d2e)', transition: 'width .6s ease', boxShadow: '0 0 8px rgba(255,183,77,.55)' }} />
          </div>
          <span style={{ fontSize: 11, color: '#ffe9a3', fontWeight: 700, whiteSpace: 'nowrap' }}>{fa(q.progress)} از {fa(q.target)}</span>
        </div>
        {q.done
          ? <Link href="/empire" style={{ display: 'block', marginTop: 8, textAlign: 'center', background: 'linear-gradient(90deg,#ffd76a,#ff9d2e)', color: '#1b1440', fontWeight: 800, fontSize: 12.5, borderRadius: 12, padding: '7px 10px', textDecoration: 'none' }}>
            🎁 برگرد و جایزه‌ات را بگیر{q.rewardCoins ? ` (${fa(q.rewardCoins)} سکه)` : ''}</Link>
          : <div style={{ marginTop: 6, fontSize: 10.5, color: 'rgba(255,255,255,.65)' }}>
            {q.pct ? <>همین مأموریت <b style={{ color: '#ffe9a3' }}>{fa(q.pct)}٪ از راهِ سطحِ بعد</b> است — </> : null}
            با دیدنِ آگهی‌های واقعی جلو می‌روی.</div>}
      </div>
    </div>
  )
}
