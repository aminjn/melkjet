'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type View = 'articles' | 'media' | 'seo' | 'published' | 'drafts'

interface CmsArticle {
  id: string
  title: string
  excerpt?: string
  image?: string
  category?: string
  sourceName?: string
  scrapedAt: number
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
function faDate(ts?: number): string {
  if (!ts) return ''
  try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts)) } catch { return '' }
}
function toFa(n: number | string): string { return String(n).replace(/\d/g, d => FA_DIGITS[+d]) }

const categories = ['خرید و فروش', 'اجاره', 'سرمایه‌گذاری', 'بازار', 'راهنما']

const articles = [
  { id: 1, title: 'راهنمای خرید آپارتمان در تهران ۱۴۰۳', author: 'علی رضایی', category: 'خرید و فروش', views: '۱۲٬۴۰۰', date: '۱۴۰۳/۰۳/۱۵', status: 'منتشر', statusColor: '#5fd98a' },
  { id: 2, title: 'بهترین مناطق سرمایه‌گذاری در مسکن', author: 'سارا محمدی', category: 'سرمایه‌گذاری', views: '۸٬۷۳۰', date: '۱۴۰۳/۰۳/۱۰', status: 'منتشر', statusColor: '#5fd98a' },
  { id: 3, title: 'قراردادهای اجاره: نکات حقوقی مهم', author: 'نگار کریمی', category: 'اجاره', views: '۶٬۱۵۰', date: '۱۴۰۳/۰۳/۰۸', status: 'منتشر', statusColor: '#5fd98a' },
  { id: 4, title: 'روند بازار مسکن در نیمه دوم ۱۴۰۳', author: 'کاوه اسدی', category: 'بازار', views: '۳٬۲۰۰', date: '۱۴۰۳/۰۳/۲۰', status: 'پیش‌نویس', statusColor: 'var(--muted)' },
  { id: 5, title: 'راهنمای اجاره برای تازه‌کارها', author: 'مریم صادقی', category: 'راهنما', views: '۲٬۸۰۰', date: '۱۴۰۳/۰۳/۱۸', status: 'در بررسی', statusColor: 'var(--gold)' },
  { id: 6, title: 'مالیات بر خرید و فروش ملک', author: 'علی رضایی', category: 'خرید و فروش', views: '۵٬۶۰۰', date: '۱۴۰۳/۰۳/۰۵', status: 'منتشر', statusColor: '#5fd98a' },
]

const mediaItems = [
  { id: 1, name: 'تهران-برج.jpg', type: 'تصویر', size: '۲٫۴ مگ', date: '۱۴۰۳/۰۳/۱۵', color: 'linear-gradient(135deg,#4a6fa5,#2d4a7a)' },
  { id: 2, name: 'آپارتمان-نمونه.jpg', type: 'تصویر', size: '۱٫۸ مگ', date: '۱۴۰۳/۰۳/۱۴', color: 'linear-gradient(135deg,#7a8f6a,#4a6a3e)' },
  { id: 3, name: 'نمودار-بازار.png', type: 'تصویر', size: '۰٫۶ مگ', date: '۱۴۰۳/۰۳/۱۲', color: 'linear-gradient(135deg,#8f6a7a,#6a3e5a)' },
  { id: 4, name: 'ویلا-شمال.jpg', type: 'تصویر', size: '۳٫۱ مگ', date: '۱۴۰۳/۰۳/۱۰', color: 'linear-gradient(135deg,#8a7a4a,#6a5a2a)' },
  { id: 5, name: 'دفتر-مرکزی.jpg', type: 'تصویر', size: '۱٫۲ مگ', date: '۱۴۰۳/۰۳/۰۸', color: 'linear-gradient(135deg,#6a4a8a,#4a2a6a)' },
  { id: 6, name: 'راهنمای-خرید.pdf', type: 'سند', size: '۰٫۹ مگ', date: '۱۴۰۳/۰۳/۰۵', color: 'linear-gradient(135deg,#8a4a4a,#6a2a2a)' },
  { id: 7, name: 'قرارداد-نمونه.pdf', type: 'سند', size: '۰٫۴ مگ', date: '۱۴۰۳/۰۳/۰۳', color: 'linear-gradient(135deg,#4a8a8a,#2a6a6a)' },
  { id: 8, name: 'اینفوگرافیک-بازار.png', type: 'تصویر', size: '۱٫۵ مگ', date: '۱۴۰۳/۰۳/۰۱', color: 'linear-gradient(135deg,#6a8a4a,#4a6a2a)' },
]

const seoKeywords = [
  { keyword: 'خرید آپارتمان تهران', volume: '۱۸٬۰۰۰', position: '۴', change: '↑', changeColor: '#5fd98a' },
  { keyword: 'اجاره مسکن', volume: '۲۴٬۵۰۰', position: '۷', change: '↑', changeColor: '#5fd98a' },
  { keyword: 'قیمت زمین', volume: '۹٬۲۰۰', position: '۱۲', change: '↓', changeColor: '#e07070' },
  { keyword: 'سرمایه‌گذاری ملک', volume: '۶٬۸۰۰', position: '۹', change: '↑', changeColor: '#5fd98a' },
  { keyword: 'راهنمای خرید خانه', volume: '۴٬۴۰۰', position: '۳', change: '—', changeColor: 'var(--muted)' },
]

const navItems: { id: View; ic: string; l: string }[] = [
  { id: 'articles', ic: '✦', l: 'مقالات' },
  { id: 'media', ic: '◈', l: 'کتابخانه رسانه' },
  { id: 'seo', ic: '◎', l: 'سئو' },
  { id: 'published', ic: '◍', l: 'منتشرشده' },
  { id: 'drafts', ic: '▦', l: 'پیش‌نویس‌ها' },
]

export default function ContentPage() {
  const [view, setView] = useState<View>('articles')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [mediaFilter, setMediaFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [newArticle, setNewArticle] = useState({
    title: '', content: '', category: '', tags: '',
    metaTitle: '', metaDesc: '', keywords: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState('')
  const [cmsArticles, setCmsArticles] = useState<CmsArticle[]>([])
  const seoScore = 72

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const loadArticles = useCallback(() => {
    fetch('/api/cms', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(d => setCmsArticles(Array.isArray(d.articles) ? d.articles : []))
      .catch(() => {})
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  // Generate article body with the content AI agent
  async function generateWithAI() {
    const topic = newArticle.title.trim() || newArticle.content.trim()
    if (!topic) { flash('ابتدا یک عنوان یا موضوع وارد کنید'); return }
    setGenerating(true)
    try {
      const prompt = `یک مقالهٔ کامل، روان و سئو-محور به فارسی دربارهٔ موضوع زیر بنویس${newArticle.category ? ` (دستهٔ «${newArticle.category}»)` : ''}: ${topic}`
      const r = await fetch('/api/ai/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'content', input: prompt }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) { flash(d.error || 'خطا در تولید محتوا'); return }
      setNewArticle(p => ({ ...p, content: d.text || p.content }))
      flash('محتوا با هوش مصنوعی تولید شد')
    } catch { flash('خطا در ارتباط با هوش مصنوعی') } finally { setGenerating(false) }
  }

  // Publish (create or update) the article to the shared store → public site
  async function publishArticle() {
    const title = newArticle.title.trim()
    const body = newArticle.content.trim()
    if (!title || !body) { flash('عنوان و متن مقاله الزامی است'); return }
    setPublishing(true)
    try {
      const payload = { title, body, category: newArticle.category || undefined }
      const r = editingId
        ? await fetch('/api/cms', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...payload }) })
        : await fetch('/api/cms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json()
      if (!r.ok || !d.ok) { flash(d.error || 'خطا در انتشار'); return }
      flash(editingId ? 'مقاله ویرایش شد' : 'مقاله منتشر شد')
      setNewArticle({ title: '', content: '', category: '', tags: '', metaTitle: '', metaDesc: '', keywords: '' })
      setEditingId(null)
      loadArticles()
    } catch { flash('خطا در ارتباط با سرور') } finally { setPublishing(false) }
  }

  function editArticle(a: CmsArticle) {
    setEditingId(a.id)
    setNewArticle(p => ({ ...p, title: a.title, content: a.excerpt || '', category: a.category || '' }))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    flash('مقاله برای ویرایش بارگذاری شد')
  }

  async function deleteArticle(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('این مقاله حذف شود؟')) return
    try {
      const r = await fetch(`/api/cms?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!r.ok) { flash('خطا در حذف'); return }
      if (editingId === id) { setEditingId(null); setNewArticle({ title: '', content: '', category: '', tags: '', metaTitle: '', metaDesc: '', keywords: '' }) }
      flash('مقاله حذف شد')
      loadArticles()
    } catch { flash('خطا در ارتباط با سرور') }
  }

  const viewTitles: Record<View, string> = {
    articles: 'مدیریت مقالات',
    media: 'کتابخانه رسانه',
    seo: 'بهینه‌سازی سئو',
    published: 'مقالات منتشرشده',
    drafts: 'پیش‌نویس‌ها',
  }

  const navStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: 'none',
    background: active ? 'var(--goldDim)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--muted)',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 700 : 500,
    cursor: 'pointer', width: '100%', textAlign: 'right' as const,
  })

  const th = { padding: '11px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textAlign: 'right' as const, background: 'var(--bg2)', borderBottom: '1px solid var(--line)' }
  const td = { padding: '13px 16px', fontSize: 13, color: 'var(--text)', borderTop: '1px solid var(--line)' }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }
  const smallBtn = { padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
  const goldBtn = { padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#1a1506', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  const inputStyle = {
    width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--line)',
    background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  const cmsRealFiltered = cmsArticles.filter(a =>
    (!selectedCategory || a.category === selectedCategory)
  )

  const filteredMedia = mediaItems.filter(m =>
    (!mediaFilter || m.type === mediaFilter)
  )

  const publishedArticles = articles.filter(a =>
    a.status === 'منتشر' &&
    (!searchText || a.title.includes(searchText) || a.author.includes(searchText))
  )

  const draftArticles = articles.filter(a => a.status !== 'منتشر')

  const circumference = 2 * Math.PI * 80

  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>

      {/* SIDEBAR */}
      <aside className="mjcon-nav" style={{ width: 240, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflow: 'auto', background: 'var(--bg2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '18px 13px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: 'var(--text)', padding: '6px 8px 16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 13, height: 13, background: 'var(--bg2)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }}></span>
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.5px' }}>ملک‌جت</div>
            <div style={{ fontSize: 10.5, color: 'var(--gold)' }}>پنل محتوا</div>
          </div>
        </Link>
        <nav style={{ display: 'grid', gap: 3 }}>
          {navItems.map(m => (
            <button key={m.id} onClick={() => setView(m.id)} style={navStyle(view === m.id)}>
              <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>{m.ic}</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{m.l}</span>
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 6px 4px', borderTop: '1px solid var(--line)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7a8fae,#465a78)', flexShrink: 0 }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>تیم محتوا</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>مدیر محتوا</div>
          </div>
          <button onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); document.documentElement.classList.toggle('light', n === 'light') }} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--navbg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--line)', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.4px' }}>{viewTitles[view]}</div>
          <div style={{ flex: 1 }}></div>
          <Link href="/agency" style={{ display: 'flex', alignItems: 'center', height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>پنل آژانس</Link>
        </header>

        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>

          {/* ─── ARTICLES VIEW ─── */}
          {view === 'articles' && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* Filter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedCategory('')}
                  style={{ ...smallBtn, background: !selectedCategory ? 'var(--goldDim)' : 'var(--bg2)', color: !selectedCategory ? 'var(--gold)' : 'var(--muted)', fontWeight: !selectedCategory ? 700 : 400 }}
                >همه</button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                    style={{ ...smallBtn, background: selectedCategory === cat ? 'var(--goldDim)' : 'var(--bg2)', color: selectedCategory === cat ? 'var(--gold)' : 'var(--muted)', fontWeight: selectedCategory === cat ? 700 : 400 }}
                  >{cat}</button>
                ))}
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{toFa(cmsRealFiltered.length)} مقاله منتشرشده</span>
              </div>

              {/* Articles table — real published articles from the shared store */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th style={th}>عنوان</th>
                        <th style={th}>منبع</th>
                        <th style={th}>دسته‌بندی</th>
                        <th style={th}>تاریخ</th>
                        <th style={th}>وضعیت</th>
                        <th style={th}>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cmsRealFiltered.map(a => (
                        <tr key={a.id}>
                          <td style={{ ...td, fontWeight: 600, maxWidth: 260 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                          </td>
                          <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{a.sourceName || 'تحریریه'}</td>
                          <td style={td}>
                            <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 600 }}>{a.category || '—'}</span>
                          </td>
                          <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{faDate(a.scrapedAt)}</td>
                          <td style={td}>
                            <span style={{ padding: '3px 10px', borderRadius: 999, background: '#5fd98a22', color: '#5fd98a', fontSize: 11.5, fontWeight: 700, border: '1px solid #5fd98a44' }}>منتشر</span>
                          </td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link href={`/article/${a.id}`} target="_blank" style={{ ...smallBtn, textDecoration: 'none', display: 'inline-block' }}>مشاهده</Link>
                              <button style={smallBtn} onClick={() => editArticle(a)}>ویرایش</button>
                              <button style={{ ...smallBtn, color: '#e07070', borderColor: '#e0707044' }} onClick={() => deleteArticle(a.id)}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cmsRealFiltered.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>هنوز مقاله‌ای منتشر نشده است. از فرم پایین یک مقاله بسازید.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Article creation form */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{editingId ? 'ویرایش مقاله' : 'ایجاد مقاله جدید'}</div>
                  {editingId && (
                    <button
                      onClick={() => { setEditingId(null); setNewArticle({ title: '', content: '', category: '', tags: '', metaTitle: '', metaDesc: '', keywords: '' }) }}
                      style={smallBtn}
                    >لغو ویرایش</button>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>عنوان مقاله</label>
                      <input
                        style={inputStyle}
                        placeholder="عنوان مقاله را وارد کنید"
                        value={newArticle.title}
                        onChange={e => setNewArticle(p => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>دسته‌بندی</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        value={newArticle.category}
                        onChange={e => setNewArticle(p => ({ ...p, category: e.target.value }))}
                      >
                        <option value="">انتخاب دسته‌بندی</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>برچسب‌ها</label>
                    <input
                      style={inputStyle}
                      placeholder="برچسب‌ها را با کاما جدا کنید"
                      value={newArticle.tags}
                      onChange={e => setNewArticle(p => ({ ...p, tags: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: 'var(--muted)' }}>محتوای مقاله</label>
                      <button
                        onClick={generateWithAI}
                        disabled={generating}
                        style={{ ...smallBtn, color: 'var(--gold)', borderColor: 'var(--gold)', background: 'var(--goldDim)', opacity: generating ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer' }}
                      >{generating ? 'در حال تولید…' : '✦ تولید با هوش مصنوعی'}</button>
                    </div>
                    <textarea
                      style={{ ...inputStyle, height: 200, resize: 'vertical' }}
                      placeholder="متن مقاله را اینجا بنویسید یا با هوش مصنوعی تولید کنید..."
                      value={newArticle.content}
                      onChange={e => setNewArticle(p => ({ ...p, content: e.target.value }))}
                    />
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 16, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>تنظیمات سئو</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>عنوان سئو</label>
                        <input
                          style={inputStyle}
                          placeholder="عنوان صفحه برای موتورهای جستجو"
                          value={newArticle.metaTitle}
                          onChange={e => setNewArticle(p => ({ ...p, metaTitle: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>توضیحات متا</label>
                        <textarea
                          style={{ ...inputStyle, height: 80, resize: 'vertical' }}
                          placeholder="توضیحات کوتاه برای نمایش در نتایج جستجو"
                          value={newArticle.metaDesc}
                          onChange={e => setNewArticle(p => ({ ...p, metaDesc: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>کلمات کلیدی</label>
                        <input
                          style={inputStyle}
                          placeholder="کلمات کلیدی را با کاما جدا کنید"
                          value={newArticle.keywords}
                          onChange={e => setNewArticle(p => ({ ...p, keywords: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={publishArticle}
                      disabled={publishing}
                      style={{ ...goldBtn, opacity: publishing ? 0.6 : 1, cursor: publishing ? 'wait' : 'pointer' }}
                    >{publishing ? 'در حال انتشار…' : (editingId ? 'ذخیره تغییرات' : 'انتشار مقاله')}</button>
                    {toast && <span style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 600 }}>{toast}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── MEDIA VIEW ─── */}
          {view === 'media' && (
            <div style={{ display: 'grid', gap: 18 }}>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {[
                  { l: 'کل فایل‌ها', v: `${mediaItems.length}`, ic: '◈', c: '#5b9bd5', bg: 'rgba(91,155,213,0.12)' },
                  { l: 'تصاویر', v: `${mediaItems.filter(m => m.type === 'تصویر').length}`, ic: '◎', c: '#5fd98a', bg: 'rgba(95,217,138,0.12)' },
                  { l: 'اسناد', v: `${mediaItems.filter(m => m.type === 'سند').length}`, ic: '▦', c: 'var(--gold)', bg: 'var(--goldDim)' },
                  { l: 'فضای استفاده‌شده', v: '۱۱٫۹ مگ', ic: '◴', c: '#9b7ad0', bg: 'rgba(155,122,208,0.12)' },
                ].map(s => (
                  <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.l}</span>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, color: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{s.ic}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Filter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {['', 'تصویر', 'ویدیو', 'سند'].map(f => (
                  <button
                    key={f || 'all'}
                    onClick={() => setMediaFilter(f)}
                    style={{ ...smallBtn, background: mediaFilter === f ? 'var(--goldDim)' : 'var(--bg2)', color: mediaFilter === f ? 'var(--gold)' : 'var(--muted)', fontWeight: mediaFilter === f ? 700 : 400 }}
                  >{f || 'همه'}</button>
                ))}
                <div style={{ flex: 1 }}></div>
                <button style={goldBtn}>آپلود رسانه +</button>
              </div>

              {/* Media grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {filteredMedia.map(item => (
                  <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: 120, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 32, opacity: 0.55 }}>{item.type === 'سند' ? '📄' : '🖼'}</span>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ padding: '2px 7px', borderRadius: 999, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 10.5, fontWeight: 600 }}>{item.type}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{item.size}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── SEO VIEW ─── */}
          {view === 'seo' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="mjcon-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18 }}>

                {/* Score meter + checklist */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', alignSelf: 'flex-start' }}>امتیاز سئو</div>
                  <svg viewBox="0 0 200 200" width={180} height={180}>
                    {/* Background track arc (135deg → 405deg = 270deg sweep) */}
                    <circle
                      cx={100} cy={100} r={80}
                      fill="none" stroke="var(--bg2)" strokeWidth={14}
                      strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
                      strokeDashoffset={circumference * 0.125}
                      strokeLinecap="round"
                      transform="rotate(135 100 100)"
                    />
                    {/* Score arc */}
                    <circle
                      cx={100} cy={100} r={80}
                      fill="none" stroke="#5fd98a" strokeWidth={14}
                      strokeDasharray={`${circumference * 0.75 * (seoScore / 100)} ${circumference - circumference * 0.75 * (seoScore / 100)}`}
                      strokeDashoffset={circumference * 0.125}
                      strokeLinecap="round"
                      transform="rotate(135 100 100)"
                    />
                    <text x={100} y={94} textAnchor="middle" fill="var(--text)" fontSize={38} fontWeight={800}>{seoScore}</text>
                    <text x={100} y={116} textAnchor="middle" fill="var(--muted)" fontSize={13}>از ۱۰۰</text>
                    <text x={100} y={136} textAnchor="middle" fill="#5fd98a" fontSize={12} fontWeight={700}>خوب</text>
                  </svg>

                  {/* Checklist */}
                  <div style={{ width: '100%', display: 'grid', gap: 9 }}>
                    {[
                      { icon: '✓', text: 'عنوان صفحه بهینه شد', color: '#5fd98a' },
                      { icon: '✓', text: 'توضیحات متا اضافه شد', color: '#5fd98a' },
                      { icon: '✓', text: 'کلمات کلیدی تعریف شدند', color: '#5fd98a' },
                      { icon: '⚠', text: 'تصاویر بدون متن جایگزین', color: 'var(--gold)' },
                      { icon: '✗', text: 'لینک‌های داخلی کافی نیست', color: '#e07070' },
                      { icon: '✗', text: 'سرعت صفحه پایین است', color: '#e07070' },
                    ].map(item => (
                      <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 9, background: 'var(--bg2)' }}>
                        <span style={{ color: item.color, fontSize: 14, fontWeight: 700, flexShrink: 0, minWidth: 16, textAlign: 'center' }}>{item.icon}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SEO form + keywords table */}
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={cardStyle}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>تنظیمات متا</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>عنوان متا</label>
                        <input style={inputStyle} defaultValue="خرید و فروش و اجاره ملک | ملک‌جت" />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>توضیحات متا</label>
                        <textarea style={{ ...inputStyle, height: 78, resize: 'vertical' }} defaultValue="بزرگ‌ترین پلتفرم خرید، فروش و اجاره ملک در ایران. هزاران آگهی معتبر با قیمت مناسب." />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>کلمات کلیدی</label>
                        <input style={inputStyle} defaultValue="خرید ملک، اجاره آپارتمان، فروش زمین، قیمت مسکن" />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>آدرس کانونیکال</label>
                        <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} defaultValue="https://melkjet.ir/" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>داده‌های ساختاریافته (Schema)</span>
                        <div style={{ width: 40, height: 22, borderRadius: 11, background: 'var(--gold)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#1a1506', position: 'absolute', top: 3, right: 3 }}></div>
                        </div>
                      </div>
                      <button style={goldBtn}>ذخیره تنظیمات سئو</button>
                    </div>
                  </div>

                  {/* Popular keywords table */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>کلمات کلیدی محبوب</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={th}>کلمه کلیدی</th>
                          <th style={th}>حجم جستجو</th>
                          <th style={th}>رتبه</th>
                          <th style={th}>تغییر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seoKeywords.map(k => (
                          <tr key={k.keyword}>
                            <td style={{ ...td, fontWeight: 600 }}>{k.keyword}</td>
                            <td style={{ ...td, color: 'var(--muted)' }}>{k.volume}</td>
                            <td style={{ ...td, fontWeight: 700, color: 'var(--gold)' }}>#{k.position}</td>
                            <td style={{ ...td, color: k.changeColor, fontWeight: 700, fontSize: 16 }}>{k.change}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── PUBLISHED VIEW ─── */}
          {view === 'published' && (
            <div style={{ display: 'grid', gap: 18 }}>

              {/* Search */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, maxWidth: 340 }}
                  placeholder="جستجو در مقالات..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                />
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{publishedArticles.length} مقاله منتشرشده</span>
              </div>

              {/* Published cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {publishedArticles.map(a => (
                  <div key={a.id} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.55 }}>{a.title}</div>
                      <span style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--bg2)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{a.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
                      <span>👁 {a.views} بازدید</span>
                      <span>📅 {a.date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#caa86a,#8a6f3e)', flexShrink: 0 }}></div>
                        <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{a.author}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={smallBtn}>مشاهده</button>
                        <button style={smallBtn}>ویرایش</button>
                      </div>
                    </div>
                  </div>
                ))}
                {publishedArticles.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
                    نتیجه‌ای یافت نشد
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── DRAFTS VIEW ─── */}
          {view === 'drafts' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>{draftArticles.length} پیش‌نویس</div>
                <button style={goldBtn}>پیش‌نویس جدید +</button>
              </div>

              {draftArticles.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>▦</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>پیش‌نویسی وجود ندارد</div>
                  <div style={{ fontSize: 12.5 }}>مقاله‌های ذخیره‌نشده اینجا نمایش داده می‌شوند</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {draftArticles.map(a => (
                    <div key={a.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, color: a.statusColor }}>▦</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                          <span>{a.author}</span>
                          <span>•</span>
                          <span>{a.category}</span>
                          <span>•</span>
                          <span>آخرین ویرایش: {a.date}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: `${a.statusColor}22`, color: a.statusColor, fontSize: 11, fontWeight: 700, border: `1px solid ${a.statusColor}44` }}>{a.status}</span>
                        <button style={smallBtn}>ویرایش</button>
                        <button style={{ ...goldBtn, padding: '6px 14px', fontSize: 12 }}>انتشار</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
