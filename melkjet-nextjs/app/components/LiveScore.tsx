'use client'
import { useEffect, useRef, useState } from 'react'

// امتیاز و تحلیلِ زندهٔ آگهی/پروژه هنگامِ ثبت — با هر تغییرِ فرم (debounce) به‌روز می‌شود.
const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
interface Result { score: number; level: string; strengths: string[]; suggestions: string[]; missing: string[] }
const color = (s: number) => s >= 75 ? '#5fd98a' : s >= 50 ? 'var(--gold)' : '#e7674a'

function Ring({ score }: { score: number }) {
  const r = 30, c = 2 * Math.PI * r, off = c - (score / 100) * c
  return (
    <svg width="76" height="76" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color(score)} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="38" y="42" textAnchor="middle" fontSize="19" fontWeight="800" fill={color(score)} fontFamily="Vazirmatn">{fa(score)}</text>
    </svg>
  )
}

export default function LiveScore({ kind, data, ready = true }: { kind: 'listing' | 'project'; data: Record<string, any>; ready?: boolean }) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<any>(null)
  const key = JSON.stringify(data)

  useEffect(() => {
    if (!ready) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setBusy(true)
      try { const r = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, data }) }); const d = await r.json(); if (d.ok) setResult(d.result) } catch {} finally { setBusy(false) }
    }, 1400)
    return () => timer.current && clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 16, padding: 16 }
  if (!ready) return (
    <div style={{ ...card, color: 'var(--faint)', fontSize: 13, textAlign: 'center' }}>عنوان را وارد کنید تا امتیاز و راهنماییِ هوشمند نمایش داده شود.</div>
  )

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {result ? <Ring score={result.score} /> : <div style={{ width: 76, height: 76, borderRadius: '50%', border: '7px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 12 }}>…</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>✦ امتیازِ هوشمندِ {kind === 'project' ? 'پروژه' : 'آگهی'} {busy && <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 500 }}>در حال بررسی…</span>}</div>
          {result && <div style={{ fontSize: 12, fontWeight: 700, color: color(result.score), marginTop: 4 }}>{result.level}</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>هرچه کامل‌تر پر کنی، امتیاز و جذابیتِ آگهی بالاتر می‌رود.</div>
        </div>
      </div>

      {result && (result.suggestions.length > 0 || result.missing.length > 0 || result.strengths.length > 0) && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {result.missing.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#e7674a', marginBottom: 6 }}>هنوز لازم است</div>
              {result.missing.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}><span style={{ color: '#e7674a', flexShrink: 0 }}>•</span>{s}</div>)}
            </div>
          )}
          {result.suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>پیشنهادِ بهبود</div>
              {result.suggestions.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}><span style={{ color: 'var(--gold)', flexShrink: 0 }}>◆</span>{s}</div>)}
            </div>
          )}
          {result.strengths.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5fd98a', marginBottom: 6 }}>نقاطِ قوت</div>
              {result.strengths.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 4 }}><span style={{ color: '#5fd98a', flexShrink: 0 }}>✓</span>{s}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
