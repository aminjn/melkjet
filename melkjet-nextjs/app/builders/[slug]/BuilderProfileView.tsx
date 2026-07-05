'use client'
import { useState } from 'react'
import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import RevealPhone from '../../components/RevealPhone'

const fa = (n: number | string) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
const faNum = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

interface ProjectCard {
  key: string; hashId?: string; manual: boolean; name: string; location: string
  status: 'presale' | 'building' | 'delivered'; statusLabel: string
  deliveryDate?: string; units?: number; areaRange?: string; priceText?: string
  salesProgress?: number; description?: string; photo?: string
}
interface Review { id: string; name: string; rating: number; text: string; projectName?: string; at: number }
interface Profile {
  id: string; name: string; verified: boolean; tagline: string; sinceYear: string; experienceYears: number | null
  about: string; website: string; officeAddress: string; phone: string; hasPhone: boolean; tags: string[]; activeRegionsText: string
  followers: number; rating: number; reviewsCount: number; unitsDelivered: number; activeCount: number
  current: ProjectCard[]; past: ProjectCard[]; reviews: Review[]
}

const STATUS_COLOR: Record<string, string> = { presale: '#c9a96a', building: '#5b9bd5', delivered: '#5fd98a' }
const AV_COLORS = ['linear-gradient(135deg,#5b9bd5,#2f5f8a)', 'linear-gradient(135deg,#c97a9a,#7a4458)', 'linear-gradient(135deg,#7aa88f,#476e58)', 'linear-gradient(135deg,#9b7ad0,#5e4488)', 'linear-gradient(135deg,#c98a4a,#8a5a2e)']

type Tab = 'current' | 'past' | 'about' | 'reviews'

export default function BuilderProfileView({ profile, initialFollowing, loggedIn }: { profile: Profile; initialFollowing: boolean; loggedIn: boolean }) {
  const [tab, setTab] = useState<Tab>(profile.current.length ? 'current' : profile.past.length ? 'past' : 'about')
  const [following, setFollowing] = useState(initialFollowing)
  const [followers, setFollowers] = useState(profile.followers)
  const [busy, setBusy] = useState(false)
  const [reviews, setReviews] = useState(profile.reviews)
  const [rating, setRating] = useState(profile.rating)
  const [reviewsCount, setReviewsCount] = useState(profile.reviewsCount)
  const [showReview, setShowReview] = useState(false)
  const [rvName, setRvName] = useState('')
  const [rvText, setRvText] = useState('')
  const [rvRating, setRvRating] = useState(5)

  const avatar = (profile.name || 'س').charAt(0)

  const toggleFollow = async () => {
    if (!loggedIn) { window.location.href = '/auth'; return }
    setBusy(true)
    try {
      const r = await fetch('/api/public/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: profile.id, action: following ? 'unfollow' : 'follow' }) })
      const d = await r.json()
      if (d.ok) { setFollowing(d.following); setFollowers(c => c + (d.following ? 1 : -1)) }
    } catch {} finally { setBusy(false) }
  }

  const submitReview = async () => {
    if (!loggedIn) { window.location.href = '/auth'; return }
    if (!rvText.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/public/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: profile.id, action: 'review', name: rvName || 'کاربر', rating: rvRating, text: rvText.trim() }) })
      const d = await r.json()
      if (d.ok && d.review) {
        const next = [d.review, ...reviews]; setReviews(next)
        const cnt = reviewsCount + 1; setReviewsCount(cnt)
        setRating(Math.round((next.reduce((s, x) => s + x.rating, 0) / next.length) * 10) / 10)
        setShowReview(false); setRvText(''); setRvName('')
      }
    } catch {} finally { setBusy(false) }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'current', label: 'پروژه‌های فعلی' },
    { id: 'past', label: 'پروژه‌های قبلی' },
    { id: 'about', label: 'درباره' },
    { id: 'reviews', label: 'نظرات' },
  ]

  const kpis = [
    { v: rating ? `★ ${fa(rating)}` : '—', l: 'رضایت' },
    { v: profile.experienceYears != null ? `${fa(profile.experienceYears)} سال` : '—', l: 'سابقه' },
    { v: profile.unitsDelivered ? `+${faNum(profile.unitsDelivered)}` : '—', l: 'واحد تحویل‌شده' },
    { v: faNum(profile.activeCount), l: 'پروژهٔ فعال' },
  ]

  return (
    <div dir="rtl" style={{
      '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c', '--line': 'rgba(255,255,255,0.08)',
      '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee', '--muted': '#9a9a98', '--faint': '#6a6a68',
      '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', system-ui, sans-serif",
    } as React.CSSProperties}>

      <Nav />

      {/* Hero */}
      <div style={{ position: 'relative', height: 230, background: 'linear-gradient(120deg,#1c1a14,#0d0d0f 70%)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 16px,rgba(255,255,255,0.02) 16px,rgba(255,255,255,0.02) 17px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 80% 0%, rgba(201,169,106,0.10), transparent 60%)' }} />
      </div>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '0 22px 80px' }}>
        {/* Header (overlaps hero) */}
        <div style={{ marginTop: -70, position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ marginTop: 78, order: 3, marginInlineStart: 'auto', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {profile.hasPhone && <div style={{ minWidth: 190 }}><RevealPhone builderId={profile.id} label="تماس با سازنده" /></div>}
            <button onClick={toggleFollow} disabled={busy} style={{ background: following ? 'transparent' : 'var(--bg2)', color: following ? 'var(--gold)' : 'var(--text)', border: `1px solid ${following ? 'var(--gold)' : 'var(--line2)'}`, fontWeight: 800, fontSize: 14, padding: '11px 22px', borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{following ? '✓ دنبال می‌کنید' : '+ دنبال‌کردن'}</button>
          </div>
          <div style={{ order: 2, flex: 1, minWidth: 220, textAlign: 'right', paddingTop: 78 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(20px,3vw,30px)', fontWeight: 900 }}>{profile.name}</h1>
              {profile.verified && <span style={{ fontSize: 12, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', border: '1px solid rgba(95,217,138,0.4)', borderRadius: 999, padding: '4px 12px' }}>✓ تأییدشده</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {[profile.tagline, profile.activeRegionsText && `فعال در ${profile.activeRegionsText}`, profile.sinceYear && `از سال ${fa(profile.sinceYear)}`].filter(Boolean).join(' · ') || 'سازنده / انبوه‌ساز'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end', flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
              {!!rating && <span style={{ color: 'var(--gold)', fontWeight: 700 }}>★ {fa(rating)}</span>}
              {!!reviewsCount && <span>· {fa(reviewsCount)} نظر</span>}
              <span>· {fa(followers)} دنبال‌کننده</span>
            </div>
          </div>
          <div style={{ order: 1, width: 96, height: 96, borderRadius: 22, background: 'linear-gradient(135deg,#3a4a63,#2a3445)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, color: '#fff', flexShrink: 0, border: '3px solid var(--bg)' }}>{avatar}</div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 24 }} className="bp-kpis">
          {kpis.map((k, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '22px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)' }}>{k.v}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', borderBottom: '1px solid var(--line)', marginTop: 28, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`, color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontWeight: tab === t.id ? 800 : 500, fontSize: 14, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ marginTop: 22 }}>
          {tab === 'current' && <ProjectGrid items={profile.current} empty="هنوز پروژهٔ فعالی ثبت نشده است." />}
          {tab === 'past' && <ProjectGrid items={profile.past} past empty="هنوز پروژهٔ تحویل‌شده‌ای ثبت نشده است." />}
          {tab === 'about' && <AboutTab profile={profile} />}
          {tab === 'reviews' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{reviewsCount ? `${fa(reviewsCount)} نظر · میانگین ★ ${fa(rating)}` : 'هنوز نظری ثبت نشده'}</div>
                <button onClick={() => setShowReview(s => !s)} style={{ background: 'var(--goldDim)', color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 11, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>ثبتِ نظر</button>
              </div>
              {showReview && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 16, padding: 18, marginBottom: 16, display: 'grid', gap: 11 }}>
                  <input value={rvName} onChange={e => setRvName(e.target.value)} placeholder="نامِ شما" style={inp} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>امتیاز:</span>
                    {[1, 2, 3, 4, 5].map(n => <span key={n} onClick={() => setRvRating(n)} style={{ cursor: 'pointer', fontSize: 22, color: n <= rvRating ? 'var(--gold)' : 'var(--line2)' }}>★</span>)}
                  </div>
                  <textarea value={rvText} onChange={e => setRvText(e.target.value)} placeholder="تجربهٔ شما از این سازنده…" rows={3} style={{ ...inp, resize: 'vertical' }} />
                  <button onClick={submitReview} disabled={busy || !rvText.trim()} style={{ background: rvText.trim() ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--line)', color: rvText.trim() ? '#16140f' : 'var(--faint)', border: 'none', borderRadius: 11, padding: '11px', fontSize: 14, fontWeight: 700, cursor: rvText.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>{loggedIn ? 'ثبتِ نظر' : 'برای ثبتِ نظر وارد شوید'}</button>
                </div>
              )}
              {reviews.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {reviews.map((rv, i) => (
                    <div key={rv.id} style={{ display: 'flex', gap: 14, padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 13, background: AV_COLORS[i % AV_COLORS.length], flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>{rv.name.charAt(0)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{rv.name}{rv.projectName ? <span style={{ color: 'var(--faint)', fontWeight: 400 }}> · {rv.projectName}</span> : ''}</span>
                          <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>★ {fa(rv.rating)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>{rv.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showReview && <Empty text="هنوز نظری ثبت نشده — اولین نظر را شما بنویسید." />}
            </div>
          )}
        </div>
      </main>

      <style>{`@media(max-width:680px){.bp-kpis{grid-template-columns:repeat(2,1fr)!important}.bp-projects{grid-template-columns:1fr!important}.bp-about{grid-template-columns:1fr!important}}`}</style>
      <Footer />
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 11, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '11px 13px', outline: 'none', boxSizing: 'border-box' }

function Empty({ text }: { text: string }) {
  return <div style={{ color: 'var(--faint)', fontSize: 13.5, textAlign: 'center', padding: '40px 0' }}>{text}</div>
}

function ProjectGrid({ items, past, empty }: { items: ProjectCard[]; past?: boolean; empty: string }) {
  if (!items.length) return <Empty text={empty} />
  return (
    <div className="bp-projects" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      {items.map(p => past ? <PastCard key={p.key} p={p} /> : <CurrentCard key={p.key} p={p} />)}
    </div>
  )
}

function CurrentCard({ p }: { p: ProjectCard }) {
  const inner = (
    <article style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', height: '100%' }}>
      <div style={{ height: 150, position: 'relative', background: 'linear-gradient(135deg,#26201a,#161410)' }}>
        {p.photo && <img src={p.photo} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 30%,rgba(13,13,15,0.88) 100%)' }} />
        <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: 'rgba(13,13,15,0.7)', color: STATUS_COLOR[p.status], border: `1px solid ${STATUS_COLOR[p.status]}66` }}>{p.statusLabel}</span>
        <div style={{ position: 'absolute', bottom: 12, right: 14, left: 14, textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          {p.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{p.location}</div>}
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 12, flexDirection: 'row-reverse' }}>
          {!!p.units && <span>{faNum(p.units)} واحد</span>}
          {p.deliveryDate && <span>تحویل {fa(p.deliveryDate)}</span>}
        </div>
        {p.salesProgress != null && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--faint)', marginBottom: 6, flexDirection: 'row-reverse' }}>
              <span>{fa(p.salesProgress)}٪</span><span>پیشرفتِ فروش</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--line)', marginBottom: 14 }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${p.salesProgress}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))' }} />
            </div>
          </>
        )}
        {p.priceText && <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 900, color: 'var(--gold)' }}>{p.priceText}</div>}
        {p.areaRange && !p.priceText && <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--muted)' }}>متراژ: {fa(p.areaRange)}</div>}
      </div>
    </article>
  )
  return p.hashId ? <Link href={`/proje/${p.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner
}

function PastCard({ p }: { p: ProjectCard }) {
  const inner = (
    <article style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', height: '100%' }}>
      <div style={{ height: 130, position: 'relative', background: 'linear-gradient(135deg,#1a2620,#101610)' }}>
        {p.photo && <img src={p.photo} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 30%,rgba(13,13,15,0.88) 100%)' }} />
        <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: 'rgba(13,13,15,0.7)', color: '#5fd98a', border: '1px solid rgba(95,217,138,0.4)' }}>تحویل‌شده{p.deliveryDate ? ` ${fa(p.deliveryDate)}` : ''}</span>
        <div style={{ position: 'absolute', bottom: 12, right: 14, left: 14, textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          {p.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{p.location}</div>}
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, fontSize: 12, color: 'var(--muted)', marginBottom: 8, flexDirection: 'row-reverse' }}>
          {!!p.units && <span>{faNum(p.units)} واحد</span>}
          {p.areaRange && <span>· {fa(p.areaRange)}</span>}
        </div>
        {p.description && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8, textAlign: 'right' }}>{p.description}</p>}
      </div>
    </article>
  )
  return p.hashId ? <Link href={`/proje/${p.hashId}`} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : inner
}

function AboutTab({ profile }: { profile: Profile }) {
  const hasContact = profile.hasPhone || profile.officeAddress || profile.website
  const hasAbout = profile.about || profile.tags.length
  if (!hasContact && !hasAbout) return <Empty text="اطلاعاتِ معرفیِ این سازنده هنوز تکمیل نشده است." />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: hasContact ? '1fr 360px' : '1fr', gap: 16, alignItems: 'start' }} className="bp-about">
      {/* About */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, textAlign: 'right' }}>دربارهٔ {profile.name}</div>
        {profile.about
          ? <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, textAlign: 'right' }}>{profile.about}</p>
          : <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)', textAlign: 'right' }}>توضیحی ثبت نشده است.</p>}
        {!!profile.tags.length && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, justifyContent: 'flex-end' }}>
            {profile.tags.map((t, i) => <span key={i} style={{ fontSize: 12, color: 'var(--muted)', border: '1px solid var(--line2)', borderRadius: 999, padding: '6px 14px' }}>{t}</span>)}
          </div>
        )}
      </section>
      {/* Contact */}
      {hasContact && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, textAlign: 'right' }}>اطلاعاتِ تماس</div>
          <div style={{ display: 'grid', gap: 14 }}>
            {profile.hasPhone && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 8, textAlign: 'right' }}>تلفنِ تماس</div>
                <RevealPhone builderId={profile.id} variant="ghost" />
              </div>
            )}
            {profile.officeAddress && <ContactRow icon="⚲" label="دفترِ مرکزی" value={profile.officeAddress} />}
            {profile.website && <ContactRow icon="🌐" label="وب‌سایت" value={profile.website} ltr href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} />}
          </div>
        </section>
      )}
    </div>
  )
}

function ContactRow({ icon, label, value, ltr, href }: { icon: string; label: string; value: string; ltr?: boolean; href?: string }) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--faint)' }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, direction: ltr ? 'ltr' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  )
  return href ? <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{content}</a> : content
}
