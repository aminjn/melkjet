'use client'
import { useEffect, useState } from 'react'

// REOS v6 · گیمیفیکیشن + کیفِ پول: سطح/XP، لیگِ فصلی، مأموریت‌ها (با دریافتِ پاداش)، سطل‌های اعتبار.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Xp = { lifetime: { level: number; title: string; xpInLevel: number; xpForNext: number; progress: number; total: number }; seasonXp: number; season: string; rank: number }
type Mission = { key: string; title: string; cadence: string; target: number; progress: number; complete: boolean; claimable: boolean; claimed: boolean; pct: number; rewardXp: number; rewardCredit: number }
type Wallet = { buckets: Record<string, number>; total: number }
const BUCKET_LABEL: Record<string, string> = { cash: 'نقدی', promo: 'اعتبارِ تبلیغ', ai: 'اعتبارِ AI', reward: 'پاداش' }
const BUCKET_COLOR: Record<string, string> = { cash: '#34d399', promo: '#e7a14a', ai: '#a78bfa', reward: '#60a5fa' }

export default function ReosRewardsCard({ title = 'پیشرفت و پاداش (REOS)' }: { title?: string }) {
  const [xp, setXp] = useState<Xp | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = () => fetch('/api/reos/economy?view=profile', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.ok) { setXp(d.xp); setMissions(d.missions || []); setWallet(d.wallet) } setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load() }, [])

  async function claim(key: string) {
    const d = await fetch('/api/reos/economy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', missionKey: key }) }).then(r => r.json()).catch(() => null)
    if (d?.ok) { setMsg(`پاداش دریافت شد: +${fa(d.rewardXp)} XP و ${fa(d.rewardCredit)} اعتبار ✓`); setTimeout(() => setMsg(''), 4000); load() }
    else { setMsg(d?.error || 'خطا'); setTimeout(() => setMsg(''), 3000) }
  }

  if (loading || !xp) return null
  const L = xp.lifetime
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>⚡</span><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>XP فقط از کارِ واقعی</span>
      </div>
      {msg && <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 9, padding: '7px 11px', fontSize: 12, color: 'var(--gold)', marginBottom: 12 }}>{msg}</div>}

      {/* Level + season */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'conic-gradient(var(--gold) ' + Math.round(L.progress * 360) + 'deg, var(--bg2) 0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--gold)' }}>{fa(L.level)}</span>
            <span style={{ fontSize: 7.5, color: 'var(--faint)' }}>سطح</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{L.title} <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 500 }}>· {fa(L.total)} XP</span></div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>{fa(L.xpForNext)} XP تا سطحِ بعد</div>
          <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${Math.max(2, Math.round(L.progress * 100))}%`, height: 5, background: 'var(--gold)', borderRadius: 99 }} /></div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#c084fc' }}>#{fa(xp.rank)}</div>
          <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>لیگِ {xp.season}</div>
          <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{fa(xp.seasonXp)} XP</div>
        </div>
      </div>

      {/* Wallet buckets */}
      {wallet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
          {Object.keys(BUCKET_LABEL).map(b => (
            <div key={b} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: BUCKET_COLOR[b] }}>{fa(wallet.buckets[b] || 0)}</div>
              <div style={{ fontSize: 8.5, color: 'var(--faint)', marginTop: 2 }}>{BUCKET_LABEL[b]}</div>
            </div>
          ))}
        </div>
      )}

      {/* Missions */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>مأموریت‌ها</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missions.map(m => (
          <div key={m.key} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{m.title}</span>
              <span style={{ fontSize: 9.5, color: 'var(--faint)', border: '1px solid var(--line)', borderRadius: 99, padding: '1px 7px' }}>{m.cadence === 'daily' ? 'روزانه' : 'هفتگی'}</span>
              <span style={{ fontSize: 10, color: '#e8c37a' }}>+{fa(m.rewardXp)} XP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${Math.round(m.pct * 100)}%`, height: 5, background: m.complete ? '#34d399' : '#60a5fa', borderRadius: 99 }} /></div>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', minWidth: 34, textAlign: 'left' }}>{fa(m.progress)}/{fa(m.target)}</span>
              {m.claimable ? <button onClick={() => claim(m.key)} style={{ fontSize: 10.5, fontWeight: 700, background: '#e7a14a', color: '#1a1200', border: 'none', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>دریافت</button>
                : m.claimed ? <span style={{ fontSize: 10, color: '#34d399' }}>✓ دریافت‌شده</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
