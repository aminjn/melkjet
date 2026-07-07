'use client'
import { useEffect, useState } from 'react'

// فیدِ توصیهٔ زندهٔ REOS — «پیشنهادهای مخصوص شما» با امتیازِ تطبیق + دلایل (لایهٔ توضیحِ AI).
type Listing = { title: string; price?: string; image?: string; location?: string; deal?: string; href: string; promoted?: string }
type Card = { id: string; score: number; matchPct: number; reasons: string[]; why: string[]; listing: Listing | null }
type Feed = { forYou: Card[]; hotInArea: Card[]; freshMatches: Card[]; priceDrops: Card[]; investment: Card[] }

const FONT = 'Vazirmatn, system-ui, sans-serif'
const SECTIONS: { key: keyof Feed; label: string; icon: string }[] = [
  { key: 'forYou', label: 'پیشنهادهای مخصوص شما', icon: '✦' },
  { key: 'hotInArea', label: 'داغ‌ترین‌های منطقه', icon: '🔥' },
  { key: 'freshMatches', label: 'تازه‌ترین‌های مناسب شما', icon: '🆕' },
  { key: 'priceDrops', label: 'کاهشِ قیمت', icon: '📉' },
  { key: 'investment', label: 'فرصت‌های سرمایه‌گذاری', icon: '💰' },
]

function pctColor(p: number) { return p >= 80 ? '#e74c3c' : p >= 55 ? '#e7a14a' : 'var(--gold)' }

function Cards({ cards }: { cards: Card[] }) {
  if (!cards.length) return <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '8px 2px' }}>فعلاً موردی نیست — با بازدید/سیوِ چند آگهی، پیشنهادها دقیق‌تر می‌شوند.</div>
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
      {cards.map(c => {
        const l = c.listing
        return (
          <a key={c.id} href={l?.href || '#'} target="_blank" rel="noreferrer" style={{ flex: '0 0 auto', width: 210, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', color: 'inherit', fontFamily: FONT }}>
            <div style={{ position: 'relative', height: 116, background: l?.image ? `center/cover no-repeat url(${l.image})` : 'linear-gradient(135deg,var(--bg2),var(--surface))' }}>
              <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, fontWeight: 900, color: '#fff', background: pctColor(c.matchPct), borderRadius: 8, padding: '2px 8px' }}>{c.matchPct.toLocaleString('fa-IR')}٪ مناسب</span>
              {l?.promoted ? <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 9.5, fontWeight: 900, color: '#16140f', background: 'linear-gradient(135deg,#f7d774,#e7a14a)', borderRadius: 6, padding: '2px 7px' }}>★ {l.promoted}</span> : null}
              {l?.deal ? <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 800, color: '#fff', background: l.deal === 'اجاره' ? '#2dd4bf' : '#60a5fa', borderRadius: 6, padding: '1px 7px' }}>{l.deal}</span> : null}
            </div>
            <div style={{ padding: 11 }}>
              <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l?.title || 'آگهی'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l?.location || ''}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gold)' }}>{l?.price || 'توافقی'}</div>
              {(c.why || c.reasons).slice(0, 2).map((r, i) => (
                <div key={i} style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>✓ {r}</div>
              ))}
            </div>
          </a>
        )
      })}
    </div>
  )
}

// silent=true → اگر واردنشده/بی‌داده بود، چیزی نشان نده (برای صفحهٔ عمومیِ خانه).
export default function ReosFeed({ compact = false, silent = false }: { compact?: boolean; silent?: boolean }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  useEffect(() => {
    let on = true
    fetch('/api/reos/recommendations', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d)))
      .then(d => { if (on) { setFeed(d.feed); setLoading(false) } })
      .catch(d => { if (on) { setErr(d?.error || 'پیشنهادی در دسترس نیست'); setLoading(false) } })
    return () => { on = false }
  }, [])

  if (loading) return silent ? null : <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: FONT }}>در حال ساختِ پیشنهادهای هوشمند…</div>
  if (err) return silent ? null : <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: FONT }}>{err}</div>
  if (!feed) return null
  // در حالتِ silent، اگر هیچ کارتی نبود چیزی نشان نده (خانهٔ عمومی شلوغ نشود).
  if (silent) { const any = SECTIONS.some(s => (feed[s.key] || []).length); if (!any) return null }

  const shown = compact ? SECTIONS.filter(s => s.key === 'forYou') : SECTIONS
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
      {shown.map(sec => {
        const cards = feed[sec.key]
        if (compact && !cards.length) return null
        return (
          <div key={sec.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{sec.icon}</span>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{sec.label}</span>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>({cards.length.toLocaleString('fa-IR')})</span>
            </div>
            <Cards cards={cards} />
          </div>
        )
      })}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', textAlign: 'center' }}>✦ رتبه‌بندی با موتورِ REOS — از رفتارِ شما (بازدید/سیو/تماس) یاد می‌گیرد.</div>
    </div>
  )
}
