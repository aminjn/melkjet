'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import { type CompareEntry, readCompare, onCompareChange, removeCompare, clearCompare } from '../lib/compare'

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])

interface CItem { kind: string; id: string; title: string; subtitle: string; photo: string; href: string; specs: { label: string; value: string }[] }
interface Analysis { bestIndex: number; summary: string; perItem: { score: number; valuation: string; access: string }[] }

export default function ComparePage() {
  const [entries, setEntries] = useState<CompareEntry[]>([])
  const [items, setItems] = useState<CItem[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => { setEntries(readCompare()); return onCompareChange(() => setEntries(readCompare())) }, [])

  // با تغییرِ فهرست، داده‌ها را از سرور بگیر (بدونِ AI تا سریع باشد).
  useEffect(() => {
    if (!entries.length) { setItems([]); setAnalysis(null); setLoading(false); return }
    let dead = false
    setLoading(true)
    fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: entries.map(e => ({ kind: e.kind, id: e.id })), ai: false }) })
      .then(r => r.json()).then(d => { if (!dead && d.ok) { setItems(d.items); setAnalysis(null) } })
      .catch(() => {}).finally(() => { if (!dead) setLoading(false) })
    return () => { dead = true }
  }, [entries.map(e => e.kind + e.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const runAI = async () => {
    if (!items.length) return
    setAiBusy(true)
    try {
      const r = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: entries.map(e => ({ kind: e.kind, id: e.id })) }) })
      const d = await r.json(); if (d.ok) { setItems(d.items); setAnalysis(d.analysis || null) }
    } catch {} finally { setAiBusy(false) }
  }

  // برچسب‌های مشخصات (اجتماعِ همهٔ گزینه‌ها، با ترتیبِ ظاهر).
  const labels: string[] = []
  for (const it of items) for (const s of it.specs) if (!labels.includes(s.label)) labels.push(s.label)
  const valueOf = (it: CItem, label: string) => it.specs.find(s => s.label === label)?.value || '—'
  const best = analysis?.bestIndex ?? -1

  return (
    <div dir="rtl" style={{
      '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c', '--line': 'rgba(255,255,255,0.08)',
      '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee', '--muted': '#9a9a98', '--faint': '#6a6a68',
      '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif",
    } as React.CSSProperties}>

      <Nav />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '26px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>مقایسه</h1>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{items.length ? `${fa(items.length)} مورد کنارِ هم — تحلیلِ هوشمند بهترین گزینه را پیشنهاد می‌دهد.` : 'موردی برای مقایسه انتخاب نشده.'}</div>
          </div>
          {items.length > 0 && <button onClick={runAI} disabled={aiBusy} style={{ background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>✦ {aiBusy ? 'در حال تحلیل…' : 'تحلیل و پیشنهادِ AI'}</button>}
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '60px 0' }}>در حال بارگذاری…</div>
        ) : !items.length ? (
          <div style={{ color: 'var(--faint)', textAlign: 'center', padding: '70px 0' }}>
            از روی کارت‌ها یا صفحهٔ آگهی/پروژه، گزینهٔ «⇄ مقایسه» را بزنید تا این‌جا کنارِ هم بیایند.
            <div style={{ marginTop: 16 }}><Link href="/builders" style={{ color: 'var(--gold)', textDecoration: 'none' }}>مشاهدهٔ پروژه‌ها →</Link></div>
          </div>
        ) : (
          <>
            {analysis?.summary && (
              <div style={{ background: 'linear-gradient(120deg, rgba(201,169,106,.1), transparent 60%), var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 18, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--gold)', fontSize: 18, flexShrink: 0 }}>✦</span>
                <div><div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>پیشنهادِ هوش مصنوعی</div><p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>{analysis.summary}</p></div>
              </div>
            )}

            {/* جدولِ مقایسه */}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${items.length}, minmax(180px, 1fr))`, gap: 0, minWidth: 160 + items.length * 180 }}>
                {/* سرستون: کارت‌ها */}
                <div />
                {items.map((it, i) => (
                  <div key={it.id} style={{ position: 'relative', padding: 8 }}>
                    <Link href={it.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderRadius: 14, overflow: 'hidden', border: `1px solid ${i === best ? 'var(--gold)' : 'var(--line2)'}`, background: i === best ? 'var(--goldDim)' : 'var(--surface)' }}>
                      <div style={{ height: 110, background: 'var(--bg2)', position: 'relative' }}>
                        {it.photo ? <img src={it.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--faint)' }}>{it.kind === 'project' ? '🏗' : '🏠'}</div>}
                        {i === best && <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: 'var(--gold)', color: '#16140f', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>✦ پیشنهاد AI</span>}
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.6, height: 40, overflow: 'hidden' }}>{it.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{it.subtitle}</div>
                      </div>
                    </Link>
                    <button onClick={() => removeCompare(it.kind, it.id)} title="حذف" style={{ position: 'absolute', top: 14, insetInlineEnd: 14, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(20,18,14,0.7)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ))}

                {/* ردیف‌های مشخصات */}
                {labels.map((label, ri) => (
                  <Row key={label} label={label} bg={ri % 2 === 0}>
                    {items.map(it => <Cell key={it.id} bg={ri % 2 === 0}>{valueOf(it, label)}</Cell>)}
                  </Row>
                ))}

                {/* ردیف‌های AI */}
                {analysis && <>
                  <Row label="✦ امتیاز AI" bg gold>{items.map((_, i) => <Cell key={i} bg gold>{analysis.perItem[i] ? fa(analysis.perItem[i].score) : '—'}</Cell>)}</Row>
                  <Row label="✦ ارزش‌گذاری" gold>{items.map((_, i) => <Cell key={i} gold>{analysis.perItem[i]?.valuation || '—'}</Cell>)}</Row>
                  <Row label="✦ دسترسی" bg gold>{items.map((_, i) => <Cell key={i} bg gold>{analysis.perItem[i]?.access || '—'}</Cell>)}</Row>
                </>}
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={clearCompare} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 11, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>پاک‌کردنِ همه</button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

function Row({ label, children, bg, gold }: { label: string; children: React.ReactNode; bg?: boolean; gold?: boolean }) {
  return (
    <>
      <div style={{ padding: '14px 12px', fontSize: 12.5, fontWeight: 700, color: gold ? 'var(--gold)' : 'var(--muted)', background: bg ? 'rgba(255,255,255,0.02)' : 'transparent', display: 'flex', alignItems: 'center', textAlign: 'right' }}>{label}</div>
      {children}
    </>
  )
}
function Cell({ children, bg, gold }: { children: React.ReactNode; bg?: boolean; gold?: boolean }) {
  return <div style={{ padding: '14px 12px', fontSize: 13, fontWeight: gold ? 800 : 600, color: gold ? 'var(--gold)' : 'var(--text)', textAlign: 'center', background: bg ? 'rgba(255,255,255,0.02)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
}
