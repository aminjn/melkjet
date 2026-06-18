'use client'
import { useEffect, useRef, useState } from 'react'

// ویرایشگر متن غنی (WYSIWYG) شبیه وردپرس: قالب‌بندی + افزودن عکس/ویدئو (آپلود یا لینک).
// مقدار را به‌صورت HTML نگه می‌دارد.
export default function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [uploading, setUploading] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const pendingKind = useRef<'image' | 'video'>('image')

  // مقدار اولیه را فقط یک‌بار ست کن تا مکان‌نما نپرد
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || '' }, []) // eslint-disable-line

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML) }
  const exec = (cmd: string, val?: string) => { ref.current?.focus(); document.execCommand(cmd, false, val); emit() }
  const insertHTML = (html: string) => { ref.current?.focus(); document.execCommand('insertHTML', false, html); emit() }

  const onUpload = async (file: File | null) => {
    if (!file) return
    setUploading('در حال آپلود…')
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/media', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.ok) { setUploading('⚠ ' + (d.error || 'خطا')); setTimeout(() => setUploading(''), 2500); return }
      if (d.kind === 'video') insertHTML(`<video src="${d.url}" controls style="max-width:100%;border-radius:10px;margin:12px 0"></video><p><br></p>`)
      else insertHTML(`<img src="${d.url}" alt="" style="max-width:100%;border-radius:10px;margin:12px 0"/><p><br></p>`)
      setUploading('')
    } catch { setUploading('⚠ خطا'); setTimeout(() => setUploading(''), 2500) }
  }

  const insertByUrl = (kind: 'image' | 'video') => {
    const url = prompt(kind === 'image' ? 'آدرس تصویر (URL):' : 'آدرس ویدئو (mp4) یا لینک یوتیوب/آپارات:')
    if (!url) return
    if (kind === 'image') { insertHTML(`<img src="${url}" alt="" style="max-width:100%;border-radius:10px;margin:12px 0"/><p><br></p>`); return }
    // embed برای یوتیوب/آپارات
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
    const ap = url.match(/aparat\.com\/v\/([\w-]+)/)
    if (yt) insertHTML(`<div style="position:relative;padding-bottom:56%;margin:12px 0"><iframe src="https://www.youtube.com/embed/${yt[1]}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px" allowfullscreen></iframe></div><p><br></p>`)
    else if (ap) insertHTML(`<div style="position:relative;padding-bottom:56%;margin:12px 0"><iframe src="https://www.aparat.com/video/video/embed/videohash/${ap[1]}/vt/frame" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px" allowfullscreen></iframe></div><p><br></p>`)
    else insertHTML(`<video src="${url}" controls style="max-width:100%;border-radius:10px;margin:12px 0"></video><p><br></p>`)
  }

  const link = () => { const u = prompt('آدرس لینک:'); if (u) exec('createLink', u) }

  const btn: React.CSSProperties = { minWidth: 30, height: 30, padding: '0 8px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }
  const tools: [string, () => void, string][] = [
    ['B', () => exec('bold'), 'پررنگ'],
    ['I', () => exec('italic'), 'مورب'],
    ['U', () => exec('underline'), 'زیرخط'],
    ['H2', () => exec('formatBlock', 'h2'), 'تیتر ۲'],
    ['H3', () => exec('formatBlock', 'h3'), 'تیتر ۳'],
    ['¶', () => exec('formatBlock', 'p'), 'پاراگراف'],
    ['• فهرست', () => exec('insertUnorderedList'), 'فهرست نقطه‌ای'],
    ['۱. فهرست', () => exec('insertOrderedList'), 'فهرست عددی'],
    ['❝', () => exec('formatBlock', 'blockquote'), 'نقل‌قول'],
    ['🔗', link, 'لینک'],
    ['🖼 عکس', () => { pendingKind.current = 'image'; fileRef.current?.click() }, 'آپلود عکس'],
    ['🎬 ویدئو', () => { pendingKind.current = 'video'; fileRef.current?.click() }, 'آپلود ویدئو'],
    ['🌐 لینک رسانه', () => insertByUrl('image'), 'تصویر از URL'],
    ['▶ امبد', () => insertByUrl('video'), 'ویدئو/یوتیوب/آپارات از لینک'],
    ['✕ قالب', () => exec('removeFormat'), 'حذف قالب‌بندی'],
  ]

  return (
    <div style={{ border: '1px solid var(--line2)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 8, borderBottom: '1px solid var(--line)', background: 'var(--bg2)' }}>
        {tools.map(([label, fn, title], i) => <button key={i} title={title} onMouseDown={e => e.preventDefault()} onClick={fn} style={btn}>{label}</button>)}
        {uploading && <span style={{ fontSize: 12, color: uploading.startsWith('⚠') ? '#e7674a' : 'var(--gold)', alignSelf: 'center', marginInlineStart: 6 }}>{uploading}</span>}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        className="mj-article-body"
        style={{ minHeight: 320, padding: 16, fontSize: 14.5, lineHeight: 2, outline: 'none', direction: 'rtl' }}
        data-placeholder="متن مقاله را اینجا بنویس… (عکس و ویدئو هم می‌توانی اضافه کنی)"
      />
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { onUpload(e.target.files?.[0] || null); e.target.value = '' }} />
    </div>
  )
}
