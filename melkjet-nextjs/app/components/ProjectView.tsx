'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from './Nav'
import Footer from './Footer'
import StaticMap from './StaticMap'
import NeshanMap from './NeshanMap'
import RevealPhone from './RevealPhone'
import CompareButton from './CompareButton'

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const faNum = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface ViewProject {
  hashId: string; title: string; region: string; phase: string; progress: number
  milestones: { name: string; done: boolean; active: boolean }[]
  statusLabel: string; photos: string[]
  floors: number; subFloors: number; units: number; residentialArea: number; groundArea: number; avgArea: number
  perFloor: { floor: number; count: number }[]
  unitStatus?: Record<string, string> | null; unitCounts?: Record<string, number> | null
  lat: number | null; lng: number | null
  amenities: string[]; plans: { label: string; url: string }[]; usage?: string
  priceText?: string; salesProgress?: number
  builder: { id: string; name: string; hasPhone: boolean; projectCount: number; regions: string[] }
  similar: { hashId: string; address: string; region: string; photo: string; builderName: string; slug?: string }[]
}
interface Intel {
  analysis?: { summary: string; risk: number; riskLabel: string; points: string[] }
  description?: string
  nearby?: { type?: string; name?: string; time: string; meters?: number }[]
  nearbyNote?: string
}

function riskColor(score: number): string { return score >= 70 ? '#5fd98a' : score >= 45 ? '#c9a96a' : '#ff6b6b' }

function RiskGauge({ score, color }: { score: number; color: string }) {
  const r = 40, circ = 2 * Math.PI * r, arc = circ * 0.75, dash = (score / 100) * arc, offset = circ * 0.125
  return (
    <svg width="100" height="80" viewBox="0 0 100 80">
      <circle cx="50" cy="55" r={r} fill="none" stroke="var(--line)" strokeWidth="8" strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={-offset} strokeLinecap="round" />
      <circle cx="50" cy="55" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill={color} fontFamily="Vazirmatn">{fa(score)}</text>
      <text x="50" y="66" textAnchor="middle" fontSize="8" fill="var(--faint)" fontFamily="Vazirmatn">امتیاز</text>
    </svg>
  )
}

export default function ProjectView({ p }: { p: ViewProject }) {
  const [activeImg, setActiveImg] = useState(0)
  const [lightboxSrc, setLightboxSrc] = useState('')
  const [intel, setIntel] = useState<Intel | null>(null)
  const [intelLoading, setIntelLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [reqName, setReqName] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqSent, setReqSent] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState('')

  useEffect(() => {
    let dead = false
    fetch(`/api/public/project-access?hashId=${encodeURIComponent(p.hashId)}`)
      .then(r => r.ok ? r.json() : null).then(d => { if (!dead && d?.ok) setIntel(d) })
      .catch(() => {}).finally(() => { if (!dead) setIntelLoading(false) })
    return () => { dead = true }
  }, [p.hashId])

  const cover = p.photos[activeImg] || p.photos[0] || ''
  const risk = intel?.analysis?.risk ?? 0
  const rColor = riskColor(risk || 60)
  const devLogo = (p.builder.name || 'س').charAt(0)
  const inpSt: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 11, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '11px 13px', outline: 'none', boxSizing: 'border-box' }

  const sendRequest = () => {
    fetch('/api/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `درخواست بازدید/تماس — ${p.title}`,
        description: [`پروژه: ${p.title}`, `سازنده: ${p.builder.name}`, `کدِ پروژه: ${p.hashId}`, selectedUnit && `واحدِ انتخابی: ${selectedUnit}`, `نام: ${reqName || '—'}`].filter(Boolean).join('\n'),
        phone: reqPhone || undefined, owner: reqName || undefined,
      }),
    }).catch(() => {})
    // ثبت در گزارشِ تماس‌های سازنده (با واحدِ انتخابی، اگر باشد)
    fetch('/api/unit-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ builderId: p.builder.id, projectHash: p.hashId, projectName: p.title, unit: selectedUnit || undefined, name: reqName, phone: reqPhone }) }).catch(() => {})
    setReqSent(true)
  }

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }
  const h: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }

  return (
    <div dir="rtl" style={{
      '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c', '--line': 'rgba(255,255,255,0.08)',
      '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee', '--muted': '#9a9a98', '--faint': '#6a6a68',
      '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif",
    } as React.CSSProperties}>
      <Nav />

      {/* Hero */}
      <div style={{ position: 'relative', height: 320, background: 'var(--bg2)', overflow: 'hidden' }}>
        {cover ? <img src={cover} alt={p.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a2535,#0d1520)' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 35%,rgba(13,13,15,0.92) 100%)' }} />
        <div style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(13,13,15,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', border: '1px solid rgba(201,169,106,0.35)' }}>● {p.statusLabel}</div>
        {!!p.photos.length && <div style={{ position: 'absolute', top: 18, left: 18, background: 'rgba(13,13,15,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '7px 14px', fontSize: 12, color: 'var(--muted)', border: '1px solid var(--line)' }}>{fa(p.photos.length)} عکسِ واقعی</div>}
        <div style={{ position: 'absolute', bottom: 24, right: 24, left: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontSize: 18, fontWeight: 900 }}>{devLogo}</div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.builder.name}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(19px,3vw,30px)', fontWeight: 900, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)', lineHeight: 1.5 }}>{p.title}</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'rgba(255,255,255,0.65)' }}>📍 {p.region}{p.phase ? ` · مرحله: ${p.phase}` : ''}</div>
        </div>
      </div>

      {/* Key stats bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { v: p.units ? faNum(p.units) : '—', l: 'تعداد واحد', ic: '▦' },
            { v: p.floors ? `${faNum(p.floors)} طبقه` : '—', l: 'طبقات', ic: '↑' },
            { v: p.residentialArea ? `${faNum(p.residentialArea)} م²` : '—', l: 'زیربنا', ic: '▢' },
            { v: p.groundArea ? `${faNum(p.groundArea)} م²` : '—', l: 'متراژ زمین', ic: '◰' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '18px 16px', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 6 }}>{s.ic} {s.l}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)' }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="mjpr-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 100px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* LEFT */}
        <div style={{ display: 'grid', gap: 22, minWidth: 0 }}>

          {/* Gallery */}
          {p.photos.length > 0 && (
            <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ height: 320, position: 'relative', cursor: 'zoom-in' }} onClick={() => setLightboxSrc(cover)}>
                <img src={cover} alt={p.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {p.photos.length > 1 && (
                <div style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto' }}>
                  {p.photos.map((ph, i) => (
                    <div key={i} onClick={() => setActiveImg(i)} style={{ width: 80, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${activeImg === i ? 'var(--gold)' : 'transparent'}` }}>
                      <img src={ph} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* AI investment analysis + risk */}
          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>تحلیلِ سرمایه‌گذاریِ هوش مصنوعی</span>
                </div>
                {intelLoading ? (
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--faint)', lineHeight: 2 }}>در حال تحلیلِ پروژه برای سرمایه‌گذاری…</p>
                ) : intel?.analysis?.summary ? (
                  <>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2 }}>{intel.analysis.summary}</p>
                    {!!intel.analysis.points?.length && (
                      <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 7 }}>
                        {intel.analysis.points.map((pt, i) => (
                          <li key={i} style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--gold)', flexShrink: 0 }}>◆</span>{pt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)', lineHeight: 1.9 }}>تحلیلِ هوش مصنوعی برای این پروژه در دسترس نیست (نیازمندِ تنظیمِ مدلِ AI در پنل).</p>
                )}
              </div>
              {!intelLoading && intel?.analysis?.summary && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <RiskGauge score={risk} color={rColor} />
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: rColor, marginTop: 4 }}>{intel.analysis.riskLabel}</div>
                </div>
              )}
            </div>
          </section>

          {/* Construction progress */}
          <section style={card}>
            <div style={h}>پیشرفتِ ساخت</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>مرحلهٔ فعلی: {p.phase || '—'}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{fa(p.progress)}٪</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', marginBottom: 24 }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${p.progress}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.milestones.length},1fr)`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 11, right: 0, left: 0, height: 2, background: 'var(--line)', zIndex: 0 }} />
              {p.milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, border: `2px solid ${m.done || m.active ? 'var(--gold)' : 'var(--line)'}`, background: m.done ? 'var(--gold)' : m.active ? 'var(--goldDim)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: m.done ? '#16140f' : m.active ? 'var(--gold)' : 'var(--faint)' }}>{m.done ? '✓' : m.active ? '◉' : '○'}</div>
                  <div style={{ fontSize: 11, fontWeight: m.active ? 700 : 400, color: m.active ? 'var(--gold)' : m.done ? 'var(--text)' : 'var(--faint)', textAlign: 'center' }}>{m.name}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Units & floors — selectable grid */}
          {p.units > 0 && p.perFloor.length > 0 && (
            <section style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div style={h as any}>انتخابِ واحد</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{faNum(p.units)} واحد در {faNum(p.floors)} طبقه{p.avgArea ? ` · میانگین ${faNum(p.avgArea)} م²` : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>طبقه و واحدِ موردِنظر را انتخاب کنید تا در «درخواستِ بازدید» ثبت شود.</div>
              <UnitGrid perFloor={p.perFloor} avgArea={p.avgArea} selected={selectedUnit} onSelect={setSelectedUnit} statusMap={p.unitStatus || null} />
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>توزیعِ واحدها بر اساسِ تعدادِ طبقه و واحدِ واقعیِ پروژه برآورد شده است؛ موجودیِ نهایی را سازنده تأیید می‌کند.</div>
            </section>
          )}

          {/* Plans (نقشه/پلانِ طبقات — آپلودِ سازنده، چند سبک) */}
          {p.plans.length > 0 && (
            <section style={card}>
              <div style={h}>نقشهٔ پلان</div>
              <div className="mjpr-units" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {p.plans.map((pl, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in' }} onClick={() => setLightboxSrc(pl.url)}>
                    <img src={pl.url} alt={pl.label} loading="lazy" style={{ width: '100%', height: 180, objectFit: 'contain', background: 'var(--bg2)', display: 'block' }} />
                    <div style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, textAlign: 'center' }}>{pl.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Amenities (امکانات — ورودیِ سازنده) */}
          {p.amenities.length > 0 && (
            <section style={card}>
              <div style={h}>امکانات و تجهیزات</div>
              <div className="mjpr-units" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 10 }}>
                {p.amenities.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)' }}>
                    <span style={{ color: 'var(--gold)', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Nearby / access (real Neshan) */}
          <section style={card}>
            <div style={{ ...h, display: 'flex', alignItems: 'center', gap: 8 }}>
              دسترسی‌ها و امکاناتِ اطراف
              <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 600, background: 'var(--bg2)', borderRadius: 6, padding: '2px 7px' }}>فاصلهٔ واقعی (نشان)</span>
            </div>
            {intel?.description && <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>{intel.description}</p>}
            {intelLoading ? (
              <div style={{ color: 'var(--faint)', fontSize: 13 }}>در حال محاسبهٔ دسترسی‌های اطراف…</div>
            ) : intel?.nearby?.length ? (
              <div className="mjpr-units" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {intel.nearby.map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name || n.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{n.type}</div>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{n.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--faint)', fontSize: 12.5 }}>{intel?.nearbyNote || 'دسترسی‌های اطراف برای این موقعیت ثبت نشد.'}</div>
            )}
          </section>

          {/* Builder profile */}
          <section style={card}>
            <div style={h}>پروفایلِ سازنده</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16140f', fontSize: 22, fontWeight: 900 }}>{devLogo}</div>
              <div style={{ minWidth: 0 }}>
                <Link href={`/builders/${encodeURIComponent(p.builder.id)}`} style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', textDecoration: 'none' }}>{p.builder.name}</Link>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{p.builder.regions.length ? `فعال در ${p.builder.regions.join('، ')}` : 'سازنده / انبوه‌ساز'}</div>
              </div>
              <div style={{ marginRight: 'auto', display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{faNum(p.builder.projectCount)}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>پروژه</div>
                </div>
              </div>
            </div>
          </section>

          {/* Similar */}
          {p.similar.length > 0 && (
            <section style={card}>
              <div style={h}>پروژه‌های مرتبط</div>
              <div className="mjpr-units" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {p.similar.map((s) => (
                  <Link key={s.hashId} href={s.slug ? `/projects/${s.slug}` : `/proje/${s.hashId}`} style={{ textDecoration: 'none', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', display: 'block', color: 'inherit' }}>
                    <div style={{ height: 96, background: 'var(--bg2)' }}>
                      {s.photo ? <img src={s.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--faint)' }}>🏗</div>}
                    </div>
                    <div style={{ padding: '11px 13px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.6, height: 40, overflow: 'hidden' }}>{s.address || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>📍 {s.region}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 80 }}>
          {/* Contact builder CTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 20, padding: 22 }}>
            {p.priceText && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>قیمت از</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', marginTop: 2 }}>{p.priceText}</div>
                {p.salesProgress != null && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>پیشرفتِ فروش: {fa(p.salesProgress)}٪</div>}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>سازندهٔ پروژه</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>{p.builder.name}</div>
            <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 18 }}>{faNum(p.builder.projectCount)} پروژه{p.builder.regions.length ? ` · ${p.builder.regions[0]}` : ''}</div>
            {p.builder.hasPhone && <div style={{ marginBottom: 9 }}><RevealPhone builderId={p.builder.id} projectHashId={p.hashId} projectName={p.title} label="نمایشِ شمارهٔ سازنده" /></div>}
            <button onClick={() => { setModalOpen(true); setReqSent(false) }} style={{ width: '100%', padding: '12px', borderRadius: 13, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', marginBottom: 9 }}>درخواستِ بازدید / تماس</button>
            <CompareButton variant="full" entry={{ kind: 'project', id: p.hashId, title: p.title, photo: p.photos[0], subtitle: p.region }} />
          </div>

          {/* Specs */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>مشخصاتِ پروژه</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {[
                ['منطقه', p.region || '—'],
                ...(p.usage ? [['کاربری', p.usage]] as [string, string][] : []),
                ['مرحلهٔ ساخت', p.phase || '—'],
                ['طبقاتِ روی‌زمین', p.floors ? faNum(p.floors) : '—'],
                ...(p.subFloors ? [['طبقاتِ زیرزمین', faNum(p.subFloors)]] as [string, string][] : []),
                ['تعداد واحد', p.units ? faNum(p.units) : '—'],
                ['زیربنا', p.residentialArea ? `${faNum(p.residentialArea)} م²` : '—'],
                ['متراژ زمین', p.groundArea ? `${faNum(p.groundArea)} م²` : '—'],
                ['کدِ پروژه', p.hashId],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 10 }}>
                  <span style={{ color: 'var(--muted)' }}>{l}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, direction: l === 'کدِ پروژه' ? 'ltr' : undefined }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>موقعیتِ مکانی</div>
            {p.lat != null && p.lng != null
              ? <NeshanMap points={[{ id: p.hashId, lat: Number(p.lat), lng: Number(p.lng), title: p.title }]} center={{ lat: Number(p.lat), lng: Number(p.lng) }} zoom={15} height={200}
                  fallback={<StaticMap points={[{ lat: Number(p.lat), lng: Number(p.lng) }]} aspect={1.5} />} />
              : <StaticMap points={[]} aspect={1.5} />}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>📍 {p.region}</div>
          </div>

          {/* AI risk badge */}
          {!intelLoading && intel?.analysis?.summary && (
            <div style={{ background: `${rColor}12`, border: `1px solid ${rColor}44`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <RiskGauge score={risk} color={rColor} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: rColor }}>{intel.analysis.riskLabel}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>امتیازِ سرمایه‌گذاری<br />توسطِ هوش مصنوعیِ ملک‌جت</div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc('')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={lightboxSrc} alt="" style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={e => { e.stopPropagation(); setLightboxSrc('') }} style={{ position: 'fixed', top: 18, insetInlineEnd: 18, background: 'rgba(255,255,255,.12)', color: '#fff', border: 'none', width: 42, height: 42, borderRadius: 21, fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Request modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 460 }}>
            {reqSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 60, height: 60, borderRadius: 20, background: 'rgba(95,217,138,0.12)', border: '1px solid rgba(95,217,138,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26, color: '#5fd98a' }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>درخواست ثبت شد</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, margin: '0 0 20px' }}>درخواستِ شما برای پروژهٔ «{p.title}» ثبت شد و به‌زودی پیگیری می‌شود.</p>
                <button onClick={() => setModalOpen(false)} style={{ padding: '11px 30px', borderRadius: 13, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>بستن</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>درخواستِ بازدید / تماس</div>
                  <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>پروژه: {p.title} · سازنده: {p.builder.name}</div>
                <div style={{ display: 'grid', gap: 11 }}>
                  <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="نام و نام‌خانوادگی" style={inpSt} />
                  <input value={reqPhone} onChange={e => setReqPhone(e.target.value)} placeholder="شماره موبایل" style={{ ...inpSt, direction: 'ltr' }} />
                  <button onClick={sendRequest} disabled={!reqName || !reqPhone} style={{ padding: '13px', borderRadius: 13, border: 'none', background: reqName && reqPhone ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)', color: reqName && reqPhone ? '#16140f' : 'var(--faint)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: reqName && reqPhone ? 'pointer' : 'default' }}>ثبتِ درخواست</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

// شبکهٔ انتخابِ واحد — هر سلول یک واحد (طبقه-شماره). اگر سازنده موجودیِ واقعی ثبت کرده باشد،
// وضعیتِ واقعی (موجود/رزرو/فروخته/مشارکت) نشان داده می‌شود؛ وگرنه همه «موجود».
type USt = 'available' | 'reserved' | 'sold' | 'owner'
const U_STYLE: Record<USt, { bg: string; bd: string; fg: string; label: string }> = {
  available: { bg: 'rgba(95,217,138,0.14)', bd: 'rgba(95,217,138,0.5)', fg: '#8fd9a8', label: 'موجود' },
  reserved: { bg: 'var(--goldDim)', bd: 'rgba(201,169,106,0.6)', fg: 'var(--gold)', label: 'رزرو' },
  sold: { bg: 'rgba(231,103,74,0.14)', bd: 'rgba(231,103,74,0.5)', fg: '#e7674a', label: 'فروخته' },
  owner: { bg: 'rgba(154,122,208,0.14)', bd: 'rgba(154,122,208,0.5)', fg: '#b69ae0', label: 'مشارکت/مالک' },
}
function UnitGrid({ perFloor, avgArea, selected, onSelect, statusMap }: { perFloor: { floor: number; count: number }[]; avgArea: number; selected: string; onSelect: (u: string) => void; statusMap: Record<string, string> | null }) {
  const maxFloor = perFloor.reduce((m, f) => Math.max(m, f.floor), 0)
  const ranges: { label: string; lo: number; hi: number }[] = []
  if (maxFloor > 6) for (let lo = 1; lo <= maxFloor; lo += 6) ranges.push({ label: `${fa(lo)}-${fa(Math.min(lo + 5, maxFloor))}`, lo, hi: Math.min(lo + 5, maxFloor) })
  const [range, setRange] = useState<{ lo: number; hi: number } | null>(null)
  const floors = perFloor.filter(f => !range || (f.floor >= range.lo && f.floor <= range.hi))
  const legend: USt[] = statusMap ? ['available', 'reserved', 'sold', 'owner'] : ['available']

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
        {legend.map(s => <span key={s} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: U_STYLE[s].bg, border: `1px solid ${U_STYLE[s].bd}` }} /> {U_STYLE[s].label}</span>)}
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--gold)' }} /> انتخابِ شما</span>
      </div>
      {ranges.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setRange(null)} style={chipBtn(!range)}>همه</button>
          {ranges.map(r => <button key={r.lo} onClick={() => setRange({ lo: r.lo, hi: r.hi })} style={chipBtn(!!range && range.lo === r.lo)}>{r.label}</button>)}
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
        {floors.map(f => (
          <div key={f.floor} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 56, flexShrink: 0, fontSize: 11.5, color: 'var(--muted)', textAlign: 'left' }}>طبقهٔ {fa(f.floor)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(f.count, 40) }, (_, i) => {
                const numKey = `${f.floor}-${i + 1}`               // کلیدِ لاتین (هم‌راستا با شمارهٔ واحدِ سازنده)
                const label = `${fa(f.floor)}-${fa(i + 1)}`
                const st = ((statusMap?.[numKey] as USt) || 'available')
                const sel = selected === label
                const clickable = st === 'available'
                const sty = U_STYLE[st]
                return (
                  <button key={i} onClick={() => clickable && onSelect(sel ? '' : label)} disabled={!clickable} title={st !== 'available' ? sty.label : (avgArea ? `~${avgArea} م²` : undefined)} style={{
                    minWidth: 46, padding: '7px 4px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: clickable ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                    background: sel ? 'var(--gold)' : sty.bg,
                    border: `1px solid ${sel ? 'var(--gold)' : sty.bd}`,
                    color: sel ? '#16140f' : sty.fg,
                    opacity: clickable || sel ? 1 : 0.7,
                  }}>{label}</button>
                )
              })}
              {f.count > 40 && <span style={{ fontSize: 11, color: 'var(--faint)', alignSelf: 'center' }}>+{fa(f.count - 40)}</span>}
            </div>
          </div>
        ))}
      </div>
      {selected && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text)', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 10, padding: '10px 14px' }}>واحدِ انتخابی: <strong style={{ color: 'var(--gold)' }}>{selected}</strong>{avgArea ? ` · ~${faNum(avgArea)} م²` : ''} — برای رزرو، «درخواستِ بازدید/رزرو» را ثبت کنید.</div>}
    </div>
  )
}
const chipBtn = (on: boolean): React.CSSProperties => ({ background: on ? 'var(--gold)' : 'var(--bg2)', color: on ? '#16140f' : 'var(--muted)', border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
