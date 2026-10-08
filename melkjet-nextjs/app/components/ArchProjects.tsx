'use client'
import { useState } from 'react'
import { gradientFor } from '@/app/lib/content-display'

// فاز ۲۸۹ — نمونه‌کارهای معمار: کارتِ کلیک‌شو + نمای بزرگِ پروژه (مثلِ سایتِ مبدأ):
// عکسِ بزرگ، همهٔ مشخصات، و ورق‌زدنِ قبلی/بعدی.
export interface ArchProject { title?: string; image?: string; city?: string; year?: string; landArea?: number; builtArea?: number; category?: string }

export default function ArchProjects({ projects, name }: { projects: ArchProject[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const fa = (n?: number) => (n ?? 0).toLocaleString('fa-IR')
  const faStr = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
  const pr = open != null ? projects[open] : null
  const facts = (p: ArchProject) => ([
    p.city ? ['شهر', p.city] : null,
    p.year ? ['سال انجام', faStr(p.year)] : null,
    p.builtArea ? ['متراژ زیربنا', `${fa(p.builtArea)} م²`] : null,
    p.landArea ? ['متراژ زمین', `${fa(p.landArea)} م²`] : null,
    p.category ? ['نوع کار', p.category] : null,
  ].filter(Boolean) as [string, string][])
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
        {projects.map((p, i) => (
          <button key={i} onClick={() => setOpen(i)}
            style={{ textAlign: 'inherit', padding: 0, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden', color: 'inherit', fontFamily: 'inherit', display: 'block', width: '100%' }}>
            <div style={{ height: 150, background: p.image ? `center/cover no-repeat url(${p.image})` : gradientFor(p.title || name) }} />
            <div style={{ padding: '11px 13px' }}>
              {p.title && <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{p.title}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                {p.city && <span>📍 {p.city}</span>}
                {p.builtArea ? <span>زیربنا {fa(p.builtArea)} م²</span> : null}
                {p.year && <span>سال {faStr(p.year)}</span>}
              </div>
              {p.category && <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.3)', borderRadius: 999, color: 'var(--gold)' }}>{p.category}</span></div>}
            </div>
          </button>
        ))}
      </div>

      {pr && (
        <div onClick={() => setOpen(null)} role="dialog" aria-modal
          style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(8,8,12,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, backdropFilter: 'blur(3px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 880, width: '100%', maxHeight: '92vh', overflow: 'auto', background: 'var(--bg)', borderRadius: 18, border: '1px solid var(--line)' }}>
            <div style={{ position: 'relative' }}>
              {pr.image
                ? <img src={pr.image} alt={pr.title || ''} style={{ width: '100%', maxHeight: 500, objectFit: 'cover', display: 'block' }} />
                : <div style={{ height: 240, background: gradientFor(pr.title || name) }} />}
              <button onClick={() => setOpen(null)} aria-label="بستن"
                style={{ position: 'absolute', top: 12, insetInlineStart: 12, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 17, cursor: 'pointer' }}>✕</button>
              {projects.length > 1 && (
                <>
                  <button onClick={() => setOpen(((open as number) + 1) % projects.length)} aria-label="بعدی"
                    style={{ position: 'absolute', top: '50%', insetInlineStart: 10, transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>‹</button>
                  <button onClick={() => setOpen(((open as number) - 1 + projects.length) % projects.length)} aria-label="قبلی"
                    style={{ position: 'absolute', top: '50%', insetInlineEnd: 10, transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>›</button>
                </>
              )}
            </div>
            <div style={{ padding: '18px 20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{pr.title || 'نمونه‌کار'}</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fa((open as number) + 1)} از {fa(projects.length)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                {facts(pr).map(([l, v], i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, padding: '9px 13px' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
