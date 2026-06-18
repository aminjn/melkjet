'use client'
import { useEffect, useState } from 'react'
import { mdToHtml } from '@/app/lib/markdown'
import RichEditor from '@/app/components/RichEditor'

// ویرایشگر مقالهٔ شبیه وردپرس: لیست مقالات + ویرایشگر کامل با سئو، برچسب،
// دسته، تصویر شاخص، پیش‌نویس/انتشار و تولید با هوش مصنوعی (انسان‌نما).

interface Article {
  id: string; title: string; body: string; image: string; category: string; tags: string[]
  slug: string; seoTitle: string; metaDescription: string; focusKeyword: string
  status: 'draft' | 'published'; author: string; excerpt: string; updatedAt: number
}
const empty = (): Omit<Article, 'id' | 'author' | 'updatedAt'> & { id?: string } => ({
  title: '', body: '', image: '', category: '', tags: [], slug: '', seoTitle: '', metaDescription: '', focusKeyword: '', status: 'draft', excerpt: '',
})

const DEFAULT_CATS = ['راهنمای خرید', 'راهنمای اجاره', 'تحلیل بازار', 'سرمایه‌گذاری', 'حقوقی', 'وام و تسهیلات', 'معماری و دکوراسیون', 'اخبار']

export default function ArticleEditor({ compact }: { compact?: boolean }) {
  const [tab, setTab] = useState<'list' | 'edit'>('list')
  const [articles, setArticles] = useState<Article[]>([])
  const [f, setF] = useState(empty())
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [cats, setCats] = useState<string[]>(DEFAULT_CATS)

  const load = () => fetch('/api/cms').then(r => r.ok ? r.json() : { articles: [] }).then(d => setArticles(d.articles || []))
  useEffect(() => { load() }, [])
  useEffect(() => {
    fetch('/api/categories?type=article')
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => { if (Array.isArray(d.categories) && d.categories.length) setCats(d.categories) })
      .catch(() => {})
  }, [])

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const newPost = () => { setF(empty()); setTab('edit'); setMsg('') }
  const editPost = async (id: string) => {
    const d = await fetch(`/api/cms?id=${id}`).then(r => r.json())
    if (d.article) { setF({ ...d.article }); setTab('edit'); setMsg('') }
  }
  const slugFromTitle = () => { if (!f.slug && f.title) set('slug', f.title.trim().replace(/\s+/g, '-').slice(0, 70)) }

  const save = async (status: 'draft' | 'published') => {
    if (!f.title.trim() || !f.body.trim()) { setMsg('⚠ عنوان و متن مقاله الزامی است'); return }
    setBusy('save'); setMsg('')
    const payload = { ...f, status }
    try {
      let res
      if (f.id) res = await fetch('/api/cms', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      else res = await fetch('/api/cms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok || d.error) { setMsg('⚠ ' + (d.error || 'خطا')); return }
      setF({ ...d.article }); setMsg(status === 'published' ? '✓ منتشر شد' : '✓ پیش‌نویس ذخیره شد'); load()
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  const del = async (id: string) => {
    if (!confirm('این مقاله حذف شود؟')) return
    setArticles(a => a.filter(x => x.id !== id))
    await fetch(`/api/cms?id=${id}`, { method: 'DELETE' })
  }

  const addTag = () => { const t = tagInput.trim(); if (t && !f.tags.includes(t)) { set('tags', [...f.tags, t]); setTagInput('') } }

  const aiGenerate = async () => {
    const topic = (aiTopic || f.title).trim()
    if (!topic) { setMsg('⚠ موضوع مقاله را برای هوش مصنوعی بنویس'); return }
    setBusy('ai'); setMsg('')
    try {
      const r = await fetch('/api/cms/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, focusKeyword: f.focusKeyword, category: f.category }) })
      const d = await r.json()
      if (!d.ok) { setMsg('⚠ ' + (d.error || 'خطا در تولید')); return }
      // خروجی AI به‌صورت Markdown است → به HTML تبدیل می‌کنیم تا در ویرایشگر غنی قابل ویرایش باشد
      const htmlBody = d.body ? mdToHtml(d.body) : ''
      setF(p => ({ ...p, title: d.title || p.title, slug: d.slug || p.slug, body: htmlBody || p.body, excerpt: d.excerpt || p.excerpt, metaDescription: d.metaDescription || p.metaDescription, focusKeyword: d.focusKeyword || p.focusKeyword, seoTitle: d.title || p.seoTitle, tags: d.tags?.length ? d.tags : p.tags }))
      setMsg('✓ مقاله توسط هوش مصنوعی نوشته شد — بازبینی و منتشر کن')
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  // تولید سؤالات متداول (FAQ) با گرافیک آکاردئونی و افزودن به انتهای مقاله
  const genFaq = async () => {
    const topic = (f.title || aiTopic).trim()
    if (!topic) { setMsg('⚠ اول عنوان یا موضوع مقاله را وارد کن'); return }
    setBusy('faq'); setMsg('')
    try {
      const r = await fetch('/api/cms/faq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, context: f.body }) })
      const d = await r.json()
      if (!d.ok || !d.faqs?.length) { setMsg('⚠ ' + (d.error || 'سؤالی تولید نشد')); return }
      const esc = (s: string) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const items = d.faqs.map((x: any) => `<details class="mj-faq-item"><summary>${esc(x.q)}</summary><div class="mj-faq-a">${esc(x.a)}</div></details>`).join('')
      const block = `<h2>سؤالات متداول</h2><div class="mj-faq">${items}</div><p><br></p>`
      setF(p => ({ ...p, body: (p.body || '') + block }))
      setMsg(`✓ ${d.faqs.length.toLocaleString('fa-IR')} سؤال متداول به انتهای مقاله اضافه شد`)
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  // بهبود و بازنویسی متنِ موجود (انسان‌نما، حفظ معنا)
  const improveText = async () => {
    const plain = (f.body || '').replace(/<[^>]+>/g, ' ').trim()
    if (plain.length < 40) { setMsg('⚠ ابتدا متنی بنویس یا تولید کن'); return }
    setBusy('improve'); setMsg('')
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'content', input: `این متن مقالهٔ املاک را روان‌تر، حرفه‌ای‌تر و کاملاً انسانی بازنویسی کن (ساختار سئو، تیتر با ## و فهرست حفظ شود، Markdown بده، چیزی اضافه نکن جز بهبود):\n\n${plain.slice(0, 4000)}` }) })
      const d = await r.json()
      if (!d.ok || !d.text) { setMsg('⚠ ' + (d.error || 'خطا')); return }
      setF(p => ({ ...p, body: mdToHtml(d.text) }))
      setMsg('✓ متن بازنویسی و بهبود یافت')
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  // تولید چکیده + توضیح متا از روی متن
  const genMeta = async () => {
    const plain = (f.body || '').replace(/<[^>]+>/g, ' ').trim()
    if (plain.length < 40) { setMsg('⚠ ابتدا متنی بنویس یا تولید کن'); return }
    setBusy('meta'); setMsg('')
    try {
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'content', input: `از این متن یک «توضیح متا» سئو حداکثر ۱۵۵ کاراکتر و یک «چکیدهٔ» دو جمله‌ای بساز. فقط JSON: {"meta":"...","excerpt":"..."}\n\n${plain.slice(0, 2000)}` }) })
      const d = await r.json()
      let t = d.text || ''; const mm = t.match(/\{[\s\S]*\}/); if (mm) t = mm[0]
      const j = JSON.parse(t)
      setF(p => ({ ...p, metaDescription: (j.meta || p.metaDescription).slice(0, 160), excerpt: j.excerpt || p.excerpt }))
      setMsg('✓ چکیده و توضیح متا ساخته شد')
    } catch { setMsg('⚠ خطا در ساخت متا') } finally { setBusy('') }
  }

  // فهرست مطالب از روی تیترها (بدون AI) — با لینک لنگر
  const genToc = () => {
    if (typeof window === 'undefined') return
    const doc = new DOMParser().parseFromString(`<div id="r">${f.body || ''}</div>`, 'text/html')
    const root = doc.getElementById('r')!
    const heads = Array.from(root.querySelectorAll('h2, h3'))
    if (!heads.length) { setMsg('⚠ ابتدا چند تیتر (H2/H3) در متن بساز'); return }
    let n = 0
    const items = heads.map(h => {
      const id = 'h' + (++n); h.setAttribute('id', id)
      return `<li style="margin:.3em 0;${h.tagName === 'H3' ? 'margin-inline-start:18px;' : ''}"><a href="#${id}">${h.textContent}</a></li>`
    }).join('')
    const toc = `<div class="mj-toc"><strong>فهرست مطالب</strong><ul>${items}</ul></div>`
    setF(p => ({ ...p, body: toc + root.innerHTML }))
    setMsg('✓ فهرست مطالب ساخته شد')
  }

  // تصویر شاخص با AI
  const genCover = async () => {
    const title = (f.title || aiTopic).trim()
    if (!title) { setMsg('⚠ اول عنوان مقاله را وارد کن'); return }
    setBusy('cover'); setMsg('')
    try {
      const r = await fetch('/api/cms/cover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const d = await r.json()
      if (!d.ok) { setMsg('⚠ ' + (d.error || 'خطا')); return }
      setF(p => ({ ...p, image: d.url }))
      setMsg('✓ تصویر شاخص ساخته شد')
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  // ابزار متنی عمومی AI: ورودی متن می‌گیرد و طبق دستور بازمی‌گرداند
  const aiText = async (key: string, instruction: string, onText: (t: string) => void, needBody = true) => {
    const plain = (f.body || '').replace(/<[^>]+>/g, ' ').trim()
    if (needBody && plain.length < 40) { setMsg('⚠ ابتدا متنی بنویس یا تولید کن'); return }
    setBusy(key); setMsg('')
    try {
      const ctx = needBody ? `\n\nمتن مقاله:\n${plain.slice(0, 4000)}` : ''
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'content', input: instruction + ctx }) })
      const d = await r.json()
      if (!d.ok || !d.text) { setMsg('⚠ ' + (d.error || 'خطا')); return }
      onText(d.text.trim())
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setBusy('') }
  }

  const optimizeKeyword = () => { if (!f.focusKeyword.trim()) { setMsg('⚠ ابتدا کلمهٔ کلیدی اصلی را وارد کن'); return } aiText('seo', `این مقاله را برای سئوی کلمهٔ کلیدی «${f.focusKeyword}» بهینه کن: کلمه را طبیعی در عنوان‌ها، اول پاراگراف و متن پخش کن، بدون پر شدن بیش از حد. خروجی کامل مقاله به Markdown.`, t => { setF(p => ({ ...p, body: mdToHtml(t) })); setMsg('✓ برای کلمهٔ کلیدی بهینه شد') }) }
  const suggestTitle = () => aiText('title', 'پنج عنوان جذاب، کلیک‌خور و سئو برای این مقاله پیشنهاد بده. هر عنوان در یک خط، بدون شماره.', t => { const opts = t.split('\n').map(x => x.replace(/^[-•\d.\s]+/, '').trim()).filter(Boolean); const pick = prompt('یک عنوان را کپی/انتخاب کن:\n\n' + opts.join('\n'), opts[0] || ''); if (pick) setF(p => ({ ...p, title: pick, seoTitle: pick })); setMsg('✓ پیشنهاد عنوان آماده شد') })
  const genTags = () => aiText('tags', 'برای این مقاله ۶ تا ۸ برچسب (تگ) مرتبط فارسی بده، فقط با کاما جدا شده، بدون توضیح.', t => { const tags = t.split(/[,،\n]/).map(x => x.trim()).filter(Boolean).slice(0, 8); setF(p => ({ ...p, tags: Array.from(new Set([...p.tags, ...tags])) })); setMsg('✓ برچسب‌ها اضافه شد') })
  const genConclusion = () => aiText('concl', 'یک بخش «جمع‌بندی» کوتاه و کاربردی برای این مقاله بنویس (Markdown، با تیتر ## جمع‌بندی).', t => { setF(p => ({ ...p, body: (p.body || '') + mdToHtml(t) })); setMsg('✓ جمع‌بندی اضافه شد') })
  const keyTakeaways = () => aiText('take', 'مهم‌ترین ۴ تا ۵ «نکتهٔ کلیدی» این مقاله را به‌صورت فهرست کوتاه بده، هر نکته یک خط، بدون توضیح اضافه.', t => { const pts = t.split('\n').map(x => x.replace(/^[-•\d.\s]+/, '').trim()).filter(Boolean); const li = pts.map(p => `<li>${p.replace(/</g, '&lt;')}</li>`).join(''); const box = `<div class="mj-takeaways"><strong>✦ نکات کلیدی</strong><ul>${li}</ul></div>`; setF(p => ({ ...p, body: box + (p.body || '') })); setMsg('✓ نکات کلیدی اضافه شد') })
  const fixGrammar = () => aiText('grammar', 'این متن را فقط از نظر نگارشی، املایی و دستوری ویرایش کن؛ معنا و ساختار را تغییر نده. خروجی کامل به Markdown.', t => { setF(p => ({ ...p, body: mdToHtml(t) })); setMsg('✓ ویرایش نگارشی انجام شد') })

  // امتیاز سئو (متن HTML را برای شمارش کلمه پاک می‌کنیم)
  const seo = (() => {
    let score = 0; const tips: string[] = []
    const kw = f.focusKeyword.trim()
    const plain = f.body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    const words = plain.trim().split(/\s+/).filter(Boolean).length
    if (kw) { score += 20; if (f.title.includes(kw)) score += 20; else tips.push('کلمهٔ کلیدی در عنوان نیست'); if (plain.includes(kw)) score += 15; else tips.push('کلمهٔ کلیدی در متن نیست'); if (f.metaDescription.includes(kw)) score += 10; else tips.push('کلمهٔ کلیدی در توضیح متا نیست') } else tips.push('کلمهٔ کلیدی اصلی را وارد کن')
    if (words >= 300) score += 15; else tips.push('متن کوتاه است (زیر ۳۰۰ کلمه)')
    if (f.metaDescription.length >= 70 && f.metaDescription.length <= 160) score += 10; else tips.push('توضیح متا ۷۰ تا ۱۶۰ کاراکتر باشد')
    if (/<h[23]/i.test(f.body)) score += 10; else tips.push('زیرعنوان (تیتر ۲) اضافه کن')
    return { score: Math.min(100, score), tips, words }
  })()
  const seoColor = seo.score >= 80 ? '#5fd98a' : seo.score >= 50 ? 'var(--gold)' : '#e7674a'

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 9, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 5, display: 'block' }
  const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 14, padding: 14 }

  // ── LIST ──
  if (tab === 'list') {
    return (
      <div style={{ animation: 'fade .3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>مقالات <span style={{ color: 'var(--faint)', fontWeight: 400, fontSize: 13 }}>({articles.length})</span></div>
          <button onClick={newPost} style={{ padding: '9px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>＋ مقالهٔ جدید</button>
        </div>
        <div style={box}>
          {articles.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>هنوز مقاله‌ای نیست. «مقالهٔ جدید» را بزن یا با هوش مصنوعی بنویس.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>{['عنوان', 'دسته', 'وضعیت', ''].map(h => <th key={h} style={{ textAlign: 'right', padding: '8px 6px', fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '11px 6px', fontWeight: 600, fontSize: 13 }}>{a.title}<div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 400, direction: 'ltr', textAlign: 'right' }}>/{a.slug}</div></td>
                    <td style={{ padding: '11px 6px', fontSize: 12.5, color: 'var(--muted)' }}>{a.category || '—'}</td>
                    <td style={{ padding: '11px 6px' }}><span style={{ fontSize: 11.5, fontWeight: 700, color: a.status === 'published' ? '#5fd98a' : '#e7a14a' }}>{a.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}</span></td>
                    <td style={{ padding: '11px 6px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {a.status === 'published' && <a href={`/article/${a.slug || a.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, padding: '4px 9px', borderRadius: 8, border: '1px solid var(--line2)', color: 'var(--muted)', textDecoration: 'none' }}>مشاهده</a>}
                        <button onClick={() => editPost(a.id)} style={{ fontSize: 11.5, padding: '4px 11px', borderRadius: 8, border: '1px solid var(--gold)', color: 'var(--gold)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>ویرایش</button>
                        <button onClick={() => del(a.id)} style={{ fontSize: 11.5, padding: '4px 9px', borderRadius: 8, border: '1px solid rgba(231,103,74,.35)', color: '#e7674a', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ── EDIT ──
  return (
    <div style={{ animation: 'fade .3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => { setTab('list'); load() }} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>→ همهٔ مقالات</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith('✓') ? '#5fd98a' : '#e7a14a' }}>{msg}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => save('draft')} disabled={!!busy} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>ذخیرهٔ پیش‌نویس</button>
          <button onClick={() => save('published')} disabled={!!busy} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>{busy === 'save' ? 'در حال ذخیره…' : (f.status === 'published' ? 'به‌روزرسانی' : 'انتشار')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 300px', gap: 16 }} className="mj-editor">
        {/* MAIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={f.title} onChange={e => set('title', e.target.value)} onBlur={slugFromTitle} placeholder="عنوان مقاله را اینجا بنویس…" style={{ ...inp, fontSize: 20, fontWeight: 800, padding: '14px 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ direction: 'ltr' }}>melkjet.com/article/</span>
            <input value={f.slug} onChange={e => set('slug', e.target.value)} placeholder="نشانی-یکتا" style={{ ...inp, padding: '5px 9px', fontSize: 12, direction: 'ltr', textAlign: 'left', flex: 1 }} />
          </div>

          {/* AI writer */}
          <div style={{ ...box, padding: 12, border: '1px solid rgba(212,175,55,.3)', background: 'var(--goldDim)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>✦ نوشتن با هوش مصنوعی (انسان‌نما و سئو)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="موضوع مقاله (مثلاً: راهنمای خرید آپارتمان در سعادت‌آباد)" style={{ ...inp, flex: 1, minWidth: 200 }} />
              <button onClick={aiGenerate} disabled={!!busy} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--gold)', color: '#16140f', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>{busy === 'ai' ? 'در حال نوشتن…' : 'بنویس مقاله کامل'}</button>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {[
                ['faq', '❓ سؤالات متداول', genFaq],
                ['improve', '✦ بهبود و بازنویسی', improveText],
                ['take', '◆ نکات کلیدی', keyTakeaways],
                ['concl', '⊕ جمع‌بندی', genConclusion],
                ['toc', '☰ فهرست مطالب', genToc],
                ['seo', '🎯 بهینه‌سازی کلمهٔ کلیدی', optimizeKeyword],
                ['title', '✎ پیشنهاد عنوان', suggestTitle],
                ['tags', '#️⃣ تولید برچسب', genTags],
                ['meta', '📝 چکیده و متا', genMeta],
                ['grammar', '✓ ویرایش نگارشی', fixGrammar],
                ['cover', '🖼 تصویر شاخص AI', genCover],
              ].map(([k, label, fn]: any) => (
                <button key={k} onClick={fn} disabled={!!busy} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>{busy === k ? 'در حال انجام…' : label}</button>
              ))}
            </div>
          </div>

          {/* WYSIWYG body — مثل وردپرس: قالب‌بندی + عکس/ویدئو */}
          <div>
            <RichEditor value={f.body} onChange={v => set('body', v)} />
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>{seo.words.toLocaleString('fa-IR')} کلمه</div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>دسته‌بندی</div>
            <select value={f.category} onChange={e => set('category', e.target.value)} style={inp}>
              <option value="">— انتخاب —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ ...lab, marginTop: 12 }}>تصویر شاخص (URL)</div>
            <input value={f.image} onChange={e => set('image', e.target.value)} placeholder="https://…" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} />
            {f.image && <img src={f.image} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, marginTop: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
          </div>

          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>برچسب‌ها</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="برچسب + Enter" style={inp} />
              <button onClick={addTag} style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>+</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {f.tags.map(t => <span key={t} onClick={() => set('tags', f.tags.filter(x => x !== t))} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 999, background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--muted)', cursor: 'pointer' }}>{t} ×</span>)}
            </div>
          </div>

          <div style={box}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>سئو</div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: seoColor }}>{seo.score.toLocaleString('fa-IR')}٪</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--line2)', overflow: 'hidden', marginBottom: 10 }}><div style={{ height: '100%', width: `${seo.score}%`, background: seoColor }} /></div>
            <div style={lab}>کلمهٔ کلیدی اصلی</div>
            <input value={f.focusKeyword} onChange={e => set('focusKeyword', e.target.value)} placeholder="مثلاً خرید آپارتمان" style={inp} />
            <div style={{ ...lab, marginTop: 10 }}>عنوان سئو</div>
            <input value={f.seoTitle} onChange={e => set('seoTitle', e.target.value)} placeholder="عنوان برای گوگل" style={inp} />
            <div style={{ ...lab, marginTop: 10 }}>توضیح متا ({f.metaDescription.length.toLocaleString('fa-IR')}/۱۶۰)</div>
            <textarea value={f.metaDescription} onChange={e => set('metaDescription', e.target.value.slice(0, 160))} placeholder="توضیح کوتاه برای نتایج گوگل" style={{ ...inp, height: 60, resize: 'none' }} />
            {seo.tips.length > 0 && <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>{seo.tips.slice(0, 4).map((t, i) => <li key={i} style={{ fontSize: 11, color: 'var(--faint)' }}>• {t}</li>)}</ul>}
          </div>
        </div>
      </div>
    </div>
  )
}
