'use client'
import { useEffect, useState } from 'react'

// Market Dominance (REOS): جایگاهِ رقابتیِ آژانس — قلمروها، نشان‌ها، زنجیرهٔ فعالیت، و هشدارِ رقابت.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Terr = { territory: string; score: number; rank: number; total: number; tier: string; isOwner: boolean }
type Badge = { key: string; name: string; desc: string; tier: string }
type Streak = { streak: number; longest: number; alive: boolean; bonus: number; atRisk: boolean }
type Profile = { agentId: string; territories: Terr[]; ownedCount: number; badges: Badge[]; nextBadges: (Badge & { hint: string })[]; streak: Streak; battlesWon: number; trust: { score: number } }
type Standing = { rank: number; total: number; score: number; tier: string; toNext: number; nextName?: string; isOwner: boolean }
type Leader = { agentId: string; agentName: string; score: number; rank: number; tier: string; fraud: number }

const tierColor: Record<string, string> = { امپراتور: '#e8c37a', سلطان: '#c084fc', قهرمان: '#34d399', رقیب: '#60a5fa', 'تازه‌وارد': 'var(--faint)' }
const badgeColor: Record<string, string> = { الماس: '#67e8f9', طلا: '#e8c37a', نقره: '#cbd5e1', برنز: '#d8a878' }
const hood = (t: string) => t.replace(/^area:/, '').replace(/^geo:/, '').replace(/_/g, ' ').replace('|', ' · ')

export default function ReosTerritoryCard({ title = 'اقتدارِ بازار (Market Dominance)' }: { title?: string }) {
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [board, setBoard] = useState<{ territory: string; leaderboard: Leader[]; standing?: Standing; fomo?: { level: string; text: string }[] } | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let on = true
    fetch('/api/reos/territory?view=profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(d => { if (on) { setP(d?.ok ? d : null); setLoading(false) } }).catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [])

  async function loadBoard(territory: string) {
    if (open === territory) { setOpen(null); return }
    setOpen(territory); setBoard(null)
    const [lb, st] = await Promise.all([
      fetch(`/api/reos/territory?view=leaderboard&territory=${encodeURIComponent(territory)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/reos/territory?view=standing&territory=${encodeURIComponent(territory)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    setBoard({ territory, leaderboard: lb?.leaderboard || [], standing: st?.standing, fomo: st?.fomo || [] })
  }
  async function touch() {
    const d = await fetch('/api/reos/territory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'touch' }) }).then(r => r.ok ? r.json() : null).catch(() => null)
    if (d?.ok) { setTouched(true); setP(prev => prev ? { ...prev, streak: { ...prev.streak, streak: d.streak.streak, alive: true, atRisk: false } } : prev) }
  }

  if (loading) return null
  if (!p) return null
  const S = p.streak

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🏆</span><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>هر اقدامِ واقعیِ بازار = امتیاز</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        <Kpi label="قلمروِ من" value={fa(p.ownedCount)} color="#e8c37a" />
        <Kpi label="قلمروِ فعال" value={fa(p.territories.length)} color="#60a5fa" />
        <Kpi label="نبردِ برده" value={fa(p.battlesWon)} color="#c084fc" />
        <Kpi label="اعتماد" value={fa(p.trust.score)} color="#34d399" />
      </div>

      {/* Streak */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{S.alive && S.streak > 0 ? '🔥' : '⚪'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>زنجیرهٔ فعالیت: {fa(S.streak)} روز {S.bonus > 0 && <span style={{ color: '#34d399', fontSize: 11 }}>(+{fa(Math.round(S.bonus * 100))}٪ تقویت)</span>}</div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>رکورد: {fa(S.longest)} روز {S.atRisk && <span style={{ color: '#e7a14a' }}>· امروز فعالیت کنید تا نشکند</span>}</div>
        </div>
        {(S.atRisk || S.streak === 0) && !touched && <button onClick={touch} style={{ fontSize: 11.5, fontWeight: 700, background: '#e7a14a', color: '#1a1200', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>ثبتِ فعالیت</button>}
      </div>

      {/* Badges */}
      {p.badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {p.badges.map(b => (
            <span key={b.key} title={b.desc} style={{ fontSize: 11, fontWeight: 700, color: badgeColor[b.tier] || 'var(--text)', border: `1px solid ${badgeColor[b.tier] || 'var(--line)'}`, borderRadius: 99, padding: '3px 10px' }}>🎖 {b.name}</span>
          ))}
        </div>
      )}
      {p.badges.length === 0 && p.nextBadges[0] && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>نشانِ بعدی: <b>{p.nextBadges[0].name}</b> — {p.nextBadges[0].hint}</div>
      )}

      {/* Territories */}
      {p.territories.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز در هیچ قلمروی امتیازی ندارید — با ثبتِ آگهیِ باکیفیت و بستنِ معامله، اقتدارِ خود را بسازید.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 2 }}>قلمروهایِ من (روی هرکدام بزنید تا جدولِ رده را ببینید)</div>
          {p.territories.slice(0, 8).map(t => (
            <div key={t.territory}>
              <button onClick={() => loadBoard(t.territory)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.6fr 0.5fr', gap: 8, alignItems: 'center', padding: '9px 8px', borderTop: '1px solid var(--line)', background: 'none', border: 'none', borderTopColor: 'var(--line)', cursor: 'pointer', color: 'inherit', textAlign: 'right' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.isOwner && '👑 '}{hood(t.territory)}</span>
                <span style={{ fontSize: 11, color: tierColor[t.tier] || 'var(--faint)', fontWeight: 700 }}>{t.tier}</span>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>رتبه {fa(t.rank)}/{fa(t.total)}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#e8c37a', textAlign: 'left' }}>{fa(t.score)}</span>
              </button>
              {open === t.territory && (
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 10, margin: '4px 0 8px' }}>
                  {board?.fomo?.map((f, i) => (
                    <div key={i} style={{ fontSize: 11.5, fontWeight: 700, color: f.level === 'high' ? '#e74c3c' : f.level === 'medium' ? '#e7a14a' : 'var(--muted)', marginBottom: 6 }}>⚠ {f.text}</div>
                  ))}
                  {!board ? <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>در حالِ بارگذاری…</div> : board.leaderboard.slice(0, 8).map(l => (
                    <div key={l.agentId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 12, opacity: l.agentId === p.agentId ? 1 : 0.85 }}>
                      <span style={{ width: 22, color: l.rank === 1 ? '#e8c37a' : 'var(--faint)', fontWeight: 800 }}>{fa(l.rank)}</span>
                      <span style={{ flex: 1, fontWeight: l.agentId === p.agentId ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.rank === 1 && '👑 '}{l.agentName || 'آژانس'}{l.agentId === p.agentId && ' (شما)'}</span>
                      {l.fraud >= 0.5 && <span title="مشکوک به تقلب" style={{ fontSize: 10, color: '#e74c3c' }}>⚑</span>}
                      <span style={{ color: tierColor[l.tier] || 'var(--faint)', fontSize: 10.5 }}>{l.tier}</span>
                      <span style={{ fontWeight: 800, color: '#e8c37a' }}>{fa(l.score)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <a href={`/api/reos/territory/card?agent=${encodeURIComponent(p.agentId)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 11.5, color: '#60a5fa', textDecoration: 'none' }}>🔗 کارتِ اشتراکِ اعتبار</a>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
