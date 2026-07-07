'use client'
import { useEffect, useState } from 'react'

// REOS v7 · لایهٔ اجتماعی: اثباتِ اجتماعی (دنبال‌کننده/اعتبار)، مجموعه‌ها، رتبه‌بندیِ عمومیِ آژانس‌ها.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
type Proof = { followers: number; following: number; comments: number; collections: number; score: number; parts: Record<string, number> }
type Col = { id: string; name: string; public: boolean; count: number }
type Rank = { agentId: string; name: string; score: number; followers: number; dominance: number }

export default function ReosSocialCard({ title = 'اعتبارِ اجتماعی (REOS)' }: { title?: string }) {
  const [proof, setProof] = useState<Proof | null>(null)
  const [collections, setCollections] = useState<Col[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [me, setMe] = useState('')
  const [loading, setLoading] = useState(true)
  const [newCol, setNewCol] = useState('')
  const [tab, setTab] = useState<'me' | 'rankings'>('me')

  const load = () => fetch('/api/reos/community?view=me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.ok) { setProof(d.proof); setCollections(d.collections || []); setMe(d.agentId) } setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load() }, [])
  useEffect(() => { if (tab === 'rankings' && !ranks.length) fetch('/api/reos/community?view=rankings', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.ok) setRanks(d.rankings || []) }).catch(() => {}) }, [tab])

  async function createCol() {
    if (!newCol.trim()) return
    await fetch('/api/reos/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'collection_create', name: newCol }) }).catch(() => {})
    setNewCol(''); load()
  }

  if (loading || !proof) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🌐</span><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 4 }}>
          {(['me', 'rankings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: tab === t ? 'var(--gold)' : 'var(--bg2)', color: tab === t ? '#16140f' : 'var(--muted)' }}>{t === 'me' ? 'من' : 'رتبه‌بندیِ عمومی'}</button>
          ))}
        </div>
      </div>

      {tab === 'me' ? <>
        {/* Social-proof score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#60a5fa' }}>{fa(proof.score)}</div>
            <div style={{ fontSize: 9, color: 'var(--faint)' }}>اعتبارِ اجتماعی</div>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            <Stat label="دنبال‌کننده" value={fa(proof.followers)} />
            <Stat label="دنبال‌شده" value={fa(proof.following)} />
            <Stat label="مجموعه" value={fa(proof.collections)} />
            <Stat label="نظر" value={fa(proof.comments)} />
          </div>
        </div>

        {/* Collections */}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>مجموعه‌های من</div>
        {collections.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 8 }}>هنوز مجموعه‌ای نساخته‌اید — فایل‌های مهم را دسته‌بندی کنید.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {collections.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{c.public ? '🌍' : '🔒'} {c.name}</span>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>{fa(c.count)} مورد</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newCol} onChange={e => setNewCol(e.target.value)} placeholder="نامِ مجموعهٔ جدید" style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12 }} />
          <button onClick={createCol} style={{ fontSize: 12, fontWeight: 700, background: 'var(--gold)', color: '#16140f', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>ساخت</button>
        </div>
      </> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>برترین آژانس‌ها بر اساسِ اعتبارِ اجتماعی + اقتدارِ بازار</div>
          {ranks.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>در حالِ بارگذاری…</div> : ranks.map((r, i) => (
            <div key={r.agentId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderTop: '1px solid var(--line)', fontSize: 12.5, background: r.agentId === me ? 'var(--goldDim)' : 'transparent', borderRadius: r.agentId === me ? 8 : 0 }}>
              <span style={{ width: 24, fontWeight: 900, color: i === 0 ? '#e8c37a' : i === 1 ? '#cbd5e1' : i === 2 ? '#d8a878' : 'var(--faint)' }}>{fa(i + 1)}</span>
              <span style={{ flex: 1, fontWeight: r.agentId === me ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i === 0 && '👑 '}{r.name || 'آژانس'}{r.agentId === me && ' (شما)'}</span>
              <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fa(r.followers)} دنبال‌کننده</span>
              <span style={{ fontWeight: 800, color: '#60a5fa' }}>{fa(r.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 8.5, color: 'var(--faint)' }}>{label}</div>
    </div>
  )
}
