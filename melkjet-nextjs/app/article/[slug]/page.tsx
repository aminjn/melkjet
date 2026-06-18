'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display'
import { mdToHtml } from '@/app/lib/markdown'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d])
}
// تاریخ شمسی از تایم‌استمپ میلادی
function faDate(ts?: number): string {
  if (!ts) return ''
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts))
  } catch {
    return ''
  }
}
// زمان مطالعه تقریبی بر اساس طول متن
function readTimeFa(text: string): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length
  const min = Math.max(1, Math.round(words / 200))
  return `${toFa(min)} دقیقه`
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line2)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gold)" strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size < 52 ? 11 : 13, fontWeight: 700, color: 'var(--gold)'
      }}>{score}</div>
    </div>
  )
}

interface LocalComment { name: string; date: string; text: string }

export default function ArticlePage() {
  const params = useParams()
  const rawSlug = (params?.slug as string) || ''
  let slug = rawSlug
  try { slug = decodeURIComponent(rawSlug) } catch { /* keep raw */ }

  const [item, setItem] = useState<ContentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [related, setRelated] = useState<ContentItem[]>([])

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<LocalComment[]>([])

  useEffect(() => {
    let alive = true
    setLoading(true)
    // First try by slug; if no item is found, fall back to id.
    ;(async () => {
      try {
        let found: ContentItem | null = null
        const bySlug = await fetch(`/api/content/item?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { item: null }))
          .catch(() => ({ item: null }))
        found = bySlug?.item || null
        if (!found) {
          const byId = await fetch(`/api/content/item?id=${encodeURIComponent(slug)}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : { item: null }))
            .catch(() => ({ item: null }))
          found = byId?.item || null
        }
        if (alive) { setItem(found); setLoading(false) }
      } catch {
        if (alive) { setItem(null); setLoading(false) }
      }
    })()

    fetchContent('article', undefined, 4 + 1).then((items) => {
      if (alive) setRelated(items.filter((it) => it.id !== slug).slice(0, 4))
    })

    return () => { alive = false }
  }, [slug])

  // counts are local-only (no backend exists for reactions)
  const baseLikes = 0
  const baseSaves = 0
  const likeCount = baseLikes + (liked ? 1 : 0)
  const saveCount = baseSaves + (saved ? 1 : 0)

  function handleLike() { setLiked((l) => !l) }
  function handleSave() { setSaved((s) => !s) }

  function handleCopyLink() {
    if (typeof window === 'undefined') return
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => { /* clipboard unavailable */ })
  }

  function handleComment() {
    if (!commentText.trim()) return
    setComments(c => [...c, { name: 'شما', date: 'همین الان', text: commentText }])
    setCommentText('')
  }

  // ── derived view-model from the real scraped item ──────────────────────────
  const title = item?.title || ''
  const body = item?.excerpt || ''
  const category = item?.category || 'مقاله'
  const sourceName = item?.sourceName || 'منبع'
  const articleDate = faDate(item?.scrapedAt)
  const articleUrl = item?.url || ''
  const readTime = readTimeFa(body || title)
  const heroImage = item?.image || ''
  const heroGradient = gradientFor(item?.id || slug)
  // the item-by-id/slug API returns the full stored Item, which may carry extra rich fields
  const rich = item as ({ aiScore?: number; meta?: { author?: string; metaDescription?: string; slug?: string } } | null)
  const aiScore = rich?.aiScore
  const metaDescription = rich?.meta?.metaDescription || ''
  const author = rich?.meta?.author || ''

  if (loading) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <Nav />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          در حال بارگذاری…
        </div>
        <Footer />
      </div>
    )
  }

  if (!item) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <Nav />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📰</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>یافت نشد</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>این مقاله موجود نیست یا حذف شده است.</p>
          <Link href="/content" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>← بازگشت به بلاگ</Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
        <a href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>خانه</a>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <a href="/content" style={{ color: 'var(--muted)', textDecoration: 'none' }}>بلاگ</a>
        <span style={{ color: 'var(--faint)' }}>›</span>
        <span style={{ color: 'var(--text)' }}>{category}</span>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px' }}>
        <div className="mja-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 32, alignItems: 'start' }}>

          {/* MAIN ARTICLE CONTENT */}
          <article>

            {/* Article Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{
                  color: 'var(--gold)', fontWeight: 700, fontSize: 12,
                  background: 'var(--goldDim)', border: '1px solid var(--gold)',
                  borderRadius: 999, padding: '3px 13px'
                }}>{category}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{readTime} مطالعه</span>
                {articleDate && <span style={{ color: 'var(--faint)', fontSize: 11 }}>·</span>}
                {articleDate && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{articleDate}</span>}
                <span style={{ color: 'var(--faint)', fontSize: 11 }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>منبع: {sourceName}</span>
              </div>

              <h1 style={{
                fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, lineHeight: 1.3,
                letterSpacing: '-0.8px', color: 'var(--text)', marginBottom: 12
              }}>
                {title}
              </h1>

              {articleUrl && (
                <a href={articleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
                  مشاهده در منبع اصلی ↗
                </a>
              )}

              {/* Author row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 20, borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#16140f', fontWeight: 800, fontSize: 18, flexShrink: 0
                  }}>✦</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{author || sourceName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{author ? `نویسنده · ${sourceName}` : 'منبع مقاله · گردآوری ملک‌جت'}</div>
                  </div>
                </div>

                {/* Share actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleLike}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10,
                      border: `1px solid ${liked ? 'rgba(231,76,60,0.5)' : 'var(--line)'}`,
                      background: liked ? 'rgba(231,76,60,0.1)' : 'var(--surface)',
                      color: liked ? '#e74c3c' : 'var(--muted)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                    }}
                  >
                    {liked ? '❤️' : '🤍'} {toFa(likeCount)}
                  </button>
                  <button
                    onClick={handleSave}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10,
                      border: `1px solid ${saved ? 'var(--gold)' : 'var(--line)'}`,
                      background: saved ? 'var(--goldDim)' : 'var(--surface)',
                      color: saved ? 'var(--gold)' : 'var(--muted)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                    }}
                  >
                    {saved ? '★' : '☆'} {toFa(saveCount)}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)', color: 'var(--muted)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}
                  >
                    {copied ? '✓ کپی شد' : '↗ کپی لینک'}
                  </button>
                </div>
              </div>
            </div>

            {/* Hero image */}
            <div style={{
              height: 260, borderRadius: 18, marginBottom: 28,
              background: heroImage ? `url(${heroImage}) center/cover no-repeat` : heroGradient,
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(135deg,transparent,transparent 12px,rgba(255,255,255,0.03) 12px,rgba(255,255,255,0.03) 13px)'
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top,rgba(0,0,0,0.5),transparent 55%)'
              }} />
              <div style={{
                position: 'absolute', bottom: 16, right: 20,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)'
                }}>تصویر شاخص مقاله</span>
              </div>
              <div style={{
                position: 'absolute', top: 16, left: 16,
                background: 'var(--goldDim)', backdropFilter: 'blur(8px)',
                border: '1px solid var(--gold)', borderRadius: 10,
                padding: '6px 13px', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ color: 'var(--gold)', fontSize: 14 }}>✦</span>
                <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>تحلیل هوشمند</span>
              </div>
            </div>

            {/* Summary box — from SEO meta description, when present */}
            {metaDescription && (
              <div style={{
                marginBottom: 24, padding: '14px 18px', borderRadius: 14,
                background: 'var(--goldDim)', border: '1px solid var(--gold)',
                fontSize: 14.5, lineHeight: 1.9, color: 'var(--text)'
              }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>خلاصه: </span>
                {metaDescription}
              </div>
            )}

            {/* Article Body — Markdown rendered to HTML */}
            <div id="intro" style={{ fontSize: 16, lineHeight: 2.1, color: 'var(--text)' }}>
              {body ? (
                <div className="mj-article-body" dangerouslySetInnerHTML={{ __html: /<\/?[a-z][\s\S]*>/i.test(body) ? body : mdToHtml(body) }} />
              ) : (
                <p style={{ marginBottom: 18, color: 'var(--muted)' }}>
                  متن کامل این مقاله در دسترس نیست. برای مطالعه‌ی کامل به منبع اصلی مراجعه کنید.
                </p>
              )}
              {articleUrl && (
                <p style={{ marginTop: 24 }}>
                  <a href={articleUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
                    ادامه‌ی مطلب در منبع اصلی ↗
                  </a>
                </p>
              )}
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
              {item.tags.map(t => (
                <span key={t} style={{
                  fontSize: 12, color: 'var(--muted)',
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 999, padding: '5px 13px', cursor: 'pointer'
                }}>#{t}</span>
              ))}
            </div>
            )}

            {/* Share bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 28,
              padding: 18, background: 'var(--surface)', borderRadius: 14,
              border: '1px solid var(--line)'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', flex: 1 }}>این مقاله را به اشتراک بگذارید:</span>
              {[
                { label: 'تلگرام', color: '#2AABEE', href: (u: string, t: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
                { label: 'واتساپ', color: '#25D366', href: (u: string, t: string) => `https://wa.me/?text=${encodeURIComponent(t + ' ' + u)}` },
                { label: 'لینکدین', color: '#0077B5', href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
              ].map(s => (
                <button key={s.label} onClick={() => { if (typeof window !== 'undefined') window.open(s.href(window.location.href, title), '_blank', 'noopener') }} style={{
                  padding: '7px 14px', borderRadius: 9,
                  border: `1px solid ${s.color}44`,
                  background: `${s.color}12`,
                  color: s.color, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>{s.label}</button>
              ))}
              <button onClick={handleCopyLink} style={{
                padding: '7px 14px', borderRadius: 9,
                border: '1px solid var(--gold)',
                background: 'var(--goldDim)',
                color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>{copied ? '✓ کپی شد' : 'کپی لینک'}</button>
            </div>

            {/* Author bio card */}
            <div style={{
              marginTop: 32, padding: 24,
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 14, letterSpacing: 1 }}>
                درباره منبع
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,var(--gold2),var(--gold))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#16140f', fontWeight: 800, fontSize: 22,
                  border: '2px solid var(--gold)', boxShadow: '0 0 0 4px var(--goldDim)'
                }}>✦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{sourceName}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 10 }}>گردآوری‌شده توسط ملک‌جت</div>
                  <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
                    این مطلب از منبع «{sourceName}» گردآوری و در ملک‌جت بازنشر شده است.
                    {articleUrl && ' برای مطالعه‌ی کامل به منبع اصلی مراجعه کنید.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Comments section */}
            <div style={{ marginTop: 40 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20
              }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  نظرات ({comments.length})
                </h3>
              </div>

              {/* Comment input */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 14, padding: 16, marginBottom: 24
              }}>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="نظر خود را بنویسید..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: 13.5,
                    background: 'var(--bg2)', border: '1px solid var(--line)',
                    borderRadius: 10, color: 'var(--text)', outline: 'none',
                    fontFamily: 'inherit', resize: 'vertical', direction: 'rtl',
                    lineHeight: 1.7, boxSizing: 'border-box', marginBottom: 10
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleComment}
                    style={{
                      padding: '9px 22px', borderRadius: 10,
                      background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                      color: '#16140f', border: 'none', cursor: 'pointer',
                      fontSize: 13.5, fontWeight: 700
                    }}
                  >ارسال نظر</button>
                </div>
              </div>

              {/* Comments list */}
              <div style={{ display: 'grid', gap: 14 }}>
                {comments.map((c, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 13, padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#3a3530,#211e1b)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, color: 'var(--muted)', fontWeight: 700
                        }}>{c.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--faint)' }}>{c.date}</div>
                        </div>
                      </div>
                      <button style={{
                        fontSize: 11, color: 'var(--muted)', background: 'none',
                        border: 'none', cursor: 'pointer'
                      }}>🤍 پسندیدم</button>
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{c.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: '0 0 18px' }}>
                مقالات مرتبط
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {related.map((r) => (
                  <Link key={r.id} href={`/article/${(r as any).meta?.slug || r.id}`} style={{
                    display: 'block', textDecoration: 'none',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 15, overflow: 'hidden', transition: 'border-color 0.2s'
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--gold)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--line)'}
                  >
                    <div style={{ height: 110, background: r.image ? `url(${r.image}) center/cover no-repeat` : gradientFor(r.id), position: 'relative' }}>
                      <span style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'var(--goldDim)', border: '1px solid var(--gold)',
                        color: 'var(--gold)', fontSize: 11, fontWeight: 700,
                        padding: '2px 9px', borderRadius: 6
                      }}>{r.category || r.sourceName || 'مقاله'}</span>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{readTimeFa(r.excerpt || r.title)} مطالعه</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            )}

          </article>

          {/* STICKY SIDEBAR — Table of Contents + extras */}
          <aside style={{ position: 'sticky', top: 88, display: 'grid', gap: 16 }}>

            {/* Table of Contents */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                مشخصات مقاله
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'دسته‌بندی', value: category },
                  { label: 'منبع', value: sourceName },
                  { label: 'تاریخ', value: articleDate || '—' },
                  { label: 'زمان مطالعه', value: readTime },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI confidence card — only when the item carries an AI quality score */}
            {typeof aiScore === 'number' && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gold)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ScoreRing score={Math.round(aiScore)} size={52} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>امتیاز کیفیت</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>ارزیابی هوش مصنوعی ملک‌جت</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
                این امتیاز بر اساس اعتبار منبع و کیفیت محتوای مقاله توسط ملک‌جت تعیین شده است.
              </div>
            </div>
            )}

            {/* CTA box */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                دنبال ملک می‌گردید؟
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
                با جستجوی هوشمند ملک‌جت بهترین گزینه‌های منطقه مورد نظرتان را پیدا کنید.
              </div>
              <a href="/search" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 42, borderRadius: 12, textDecoration: 'none', fontSize: 13.5,
                background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                color: '#16140f', fontWeight: 700
              }}>جستجو در ملک‌جت</a>
            </div>

            {/* Stats mini */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 12, letterSpacing: 0.5 }}>
                آمار مقاله
              </div>
              {[
                { label: 'پسندیده‌اید', value: liked ? 'بله' : 'خیر' },
                { label: 'ذخیره‌شده', value: saved ? 'بله' : 'خیر' },
                { label: 'نظرات', value: toFa(comments.length) },
              ].map(stat => (
                <div key={stat.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderBottom: '1px solid var(--line)'
                }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{stat.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{stat.value}</span>
                </div>
              ))}
            </div>

          </aside>
        </div>
      </main>

      <Footer />

      {/* Fixed home button */}
      <a href="/" style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 60,
        width: 52, height: 52, borderRadius: 16, textDecoration: 'none',
        background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
        color: '#16140f', fontSize: 19, fontWeight: 800,
        boxShadow: '0 14px 34px -10px var(--gold)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.08)'
          ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 18px 40px -10px var(--gold)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 14px 34px -10px var(--gold)'
        }}
      >✦</a>
    </div>
  )
}
