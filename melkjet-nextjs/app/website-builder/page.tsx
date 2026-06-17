'use client'
import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type Device = 'desktop' | 'mobile' | 'tablet'
type ActiveTab = 'seo' | 'settings' | 'pages'

interface Block {
  id: number
  type: string
  heading: string
}

const BLOCK_LIBRARY = [
  { type: 'hero', label: 'هیرو', icon: '◇' },
  { type: 'search', label: 'نوار جستجو', icon: '⌕' },
  { type: 'listings', label: 'آگهی‌های من', icon: '⌂' },
  { type: 'services', label: 'خدمات', icon: '◈' },
  { type: 'about', label: 'درباره ما', icon: '¶' },
  { type: 'stats', label: 'آمار', icon: '◔' },
  { type: 'gallery', label: 'گالری', icon: '▥' },
  { type: 'testimonials', label: 'نظرات مشتریان', icon: '❝' },
  { type: 'cta', label: 'دعوت به اقدام', icon: '➤' },
  { type: 'contact', label: 'فرم تماس', icon: '✉' },
  { type: 'footer', label: 'فوتر', icon: '▬' },
]

const STARTER_TEMPLATES = [
  { id: 'classic', name: 'مشاور کلاسیک', blocks: ['hero', 'listings', 'testimonials', 'contact'], desc: 'هیرو، فایل‌ها، نظرات، تماس' },
  { id: 'modern', name: 'مشاور مدرن', blocks: ['hero', 'stats', 'listings', 'about'], desc: 'هیرو، آمار، فایل‌ها، تیم' },
  { id: 'agency', name: 'آژانس جامع', blocks: ['hero', 'services', 'listings', 'about'], desc: 'هیرو، خدمات، فایل‌ها، تیم' },
  { id: 'presale', name: 'پیش‌فروش', blocks: ['hero', 'gallery', 'contact'], desc: 'هیرو، پروژه‌ها، فرم' },
]

const DEFAULT_HEADINGS: Record<string, string> = {
  hero: 'بهترین ملک را با ما بیابید',
  search: 'جستجوی ملک',
  listings: 'آگهی‌های من',
  services: 'خدمات ما',
  about: 'درباره ما',
  stats: 'آمار و ارقام',
  gallery: 'گالری تصاویر',
  testimonials: 'نظرات مشتریان',
  cta: 'همین امروز با ما تماس بگیرید',
  contact: 'فرم تماس',
  footer: 'ملک‌جت',
}

let nextId = 1

function makeBlock(type: string): Block {
  return { id: nextId++, type, heading: DEFAULT_HEADINGS[type] || type }
}

function BlockPreview({ block, selected, onSelect, onUp, onDown, onDelete }: {
  block: Block
  selected: boolean
  onSelect: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const showControls = hovered || selected

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        border: selected ? '2px solid var(--gold)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'border-color .15s',
      }}
    >
      {showControls && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center',
          background: selected ? 'var(--gold)' : 'rgba(0,0,0,0.78)',
          padding: '4px 10px', gap: 6,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: selected ? '#16140f' : '#fff', flex: 1 }}>
            {BLOCK_LIBRARY.find(b => b.type === block.type)?.label || block.type}
          </span>
          <button onClick={e => { e.stopPropagation(); onUp() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
          <button onClick={e => { e.stopPropagation(); onDown() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(220,60,60,0.55)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}

      {block.type === 'hero' && (
        <div style={{ background: 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)', padding: '44px 24px', textAlign: 'center', direction: 'rtl' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>{block.heading}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18 }}>مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه</div>
          <span style={{ display: 'inline-block', padding: '8px 22px', background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#16140f' }}>مشاهده ملک‌ها</span>
        </div>
      )}
      {block.type === 'search' && (
        <div style={{ background: '#f5f3ef', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2a2215', marginBottom: 12 }}>{block.heading}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, height: 36, background: '#fff', border: '1px solid #ddd', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
              <span style={{ fontSize: 11, color: '#aaa' }}>منطقه، شهر یا محله را وارد کنید...</span>
            </div>
            <div style={{ width: 80, height: 36, background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16140f' }}>جستجو</span>
            </div>
          </div>
        </div>
      )}
      {block.type === 'listings' && (
        <div style={{ background: '#fff', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 14 }}>{block.heading}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['#2d2215','#1e1a12'],['#1e2215','#141a10'],['#15202d','#101828']].map(([from,to], i) => (
              <div key={i} style={{ background: '#f5f3ef', borderRadius: 10, overflow: 'hidden', border: '1px solid #eee' }}>
                <div style={{ height: 70, background: `linear-gradient(135deg,${from},${to})` }} />
                <div style={{ padding: '10px' }}>
                  <div style={{ height: 8, background: '#e0ddd8', borderRadius: 3, marginBottom: 5, width: '80%' }} />
                  <div style={{ height: 6, background: '#e0ddd8', borderRadius: 3, width: '55%', marginBottom: 8 }} />
                  <div style={{ height: 10, background: 'rgba(201,168,76,0.25)', borderRadius: 3, width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === 'services' && (
        <div style={{ background: '#faf9f7', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 14, textAlign: 'center' }}>{block.heading}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['خرید ملک','◇'],['اجاره','⌂'],['مشاوره','◈']].map(([s,icon]) => (
              <div key={s} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 6, color: '#c9a84c' }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1510' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === 'about' && (
        <div style={{ background: '#fff', padding: '22px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 12 }}>{block.heading}</div>
          {[85, 65, 75, 50, 80].map((w, i) => (
            <div key={i} style={{ height: 7, background: '#ece9e4', borderRadius: 3, marginBottom: 7, width: `${w}%` }} />
          ))}
        </div>
      )}
      {block.type === 'stats' && (
        <div style={{ background: '#f5f3ef', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[['۵۰۰+','ملک فروخته'],['۱۲','سال تجربه'],['۲۰۰','مشتری راضی'],['۹۸٪','رضایت']].map(([num,lbl]) => (
              <div key={lbl} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#c9a84c', marginBottom: 4 }}>{num}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === 'gallery' && (
        <div style={{ background: '#fff', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 12 }}>{block.heading}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[['#2d2215','#1a1510'],['#1e2530','#141c25'],['#252015','#1a1a0d'],['#201528','#150e1e']].map(([from,to], i) => (
              <div key={i} style={{ height: 64, background: `linear-gradient(135deg,${from},${to})`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.18)' }}>▥</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === 'testimonials' && (
        <div style={{ background: '#faf9f7', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 12, textAlign: 'center' }}>{block.heading}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {[['علی رضایی','خرید آپارتمان در نیاوران'],['مریم احمدی','اجاره ویلا در شمال']].map(([name,desc]) => (
              <div key={name} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px' }}>
                <div style={{ fontSize: 16, color: '#c9a84c', marginBottom: 6 }}>❝</div>
                <div style={{ height: 6, background: '#ece9e4', borderRadius: 3, marginBottom: 5, width: '90%' }} />
                <div style={{ height: 6, background: '#ece9e4', borderRadius: 3, marginBottom: 10, width: '70%' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1510' }}>{name}</div>
                <div style={{ fontSize: 9, color: '#aaa' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {block.type === 'cta' && (
        <div style={{ background: 'linear-gradient(135deg,#2d2215,#1a1510)', padding: '30px 24px', textAlign: 'center', direction: 'rtl' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{block.heading}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 18 }}>کارشناسان ما آماده پاسخگویی هستند</div>
          <span style={{ display: 'inline-block', padding: '8px 24px', background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#16140f' }}>تماس با ما</span>
        </div>
      )}
      {block.type === 'contact' && (
        <div style={{ background: '#fff', padding: '20px 24px', direction: 'rtl' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1510', marginBottom: 14 }}>{block.heading}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ height: 32, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7 }} />
            <div style={{ height: 32, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7 }} />
          </div>
          <div style={{ height: 64, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7, marginBottom: 10 }} />
          <div style={{ width: 90, height: 30, background: 'linear-gradient(135deg,#b8922a,#c9a84c)', borderRadius: 7 }} />
        </div>
      )}
      {block.type === 'footer' && (
        <div style={{ background: '#0d0b08', padding: '22px 24px', direction: 'rtl' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>{block.heading}</div>
              {[60,50,45].map((w,i) => <div key={i} style={{ height: 5, background: '#2a2218', borderRadius: 2, marginBottom: 5, width: `${w}%` }} />)}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 8 }}>لینک‌های سریع</div>
              {['خانه','آگهی‌ها','درباره ما','تماس'].map(l => <div key={l} style={{ fontSize: 10, color: '#444', marginBottom: 5 }}>{l}</div>)}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 8 }}>اطلاعات تماس</div>
              {[55,65,50].map((w,i) => <div key={i} style={{ height: 5, background: '#2a2218', borderRadius: 2, marginBottom: 5, width: `${w}%` }} />)}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1a1510', paddingTop: 10, textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: '#333' }}>© ۱۴۰۴ — تمامی حقوق محفوظ است</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WebsiteBuilderPage() {
  const [blocks, setBlocks] = useState<Block[]>([
    makeBlock('hero'),
    makeBlock('search'),
    makeBlock('listings'),
  ])
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [device, setDevice] = useState<Device>('desktop')
  const [activeTab, setActiveTab] = useState<ActiveTab>('seo')
  const [seoTitle, setSeoTitle] = useState('آژانس ملکی نمونه | خرید و فروش ملک')
  const [seoDesc, setSeoDesc] = useState('بهترین آژانس ملکی در تهران با بیش از ۱۰ سال سابقه. خرید، فروش و اجاره ملک با مشاوره رایگان.')
  const [slug, setSlug] = useState('agency-sample')
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [publishedSlug, setPublishedSlug] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [history, setHistory] = useState<Block[][]>([])
  const [pages, setPages] = useState([
    { id: 'home', label: 'صفحه اصلی', active: true },
    { id: 'listings', label: 'فایل‌ها / محصولات', active: false },
    { id: 'about', label: 'درباره ما', active: false },
    { id: 'contact', label: 'تماس', active: false },
  ])
  const [blockHeadingEdit, setBlockHeadingEdit] = useState('')

  const pushHistory = (b: Block[]) => setHistory(h => [...h.slice(-19), b])

  const addBlock = (type: string) => {
    pushHistory(blocks)
    const nb = makeBlock(type)
    setBlocks(prev => [...prev, nb])
    setSelectedBlock(nb.id)
    setBlockHeadingEdit(nb.heading)
    setActiveTab('settings')
  }

  const loadTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    pushHistory(blocks)
    const nb = tpl.blocks.map(t => makeBlock(t))
    setBlocks(nb)
    setSelectedBlock(null)
  }

  const deleteBlock = (id: number) => {
    pushHistory(blocks)
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (selectedBlock === id) setSelectedBlock(null)
  }

  const moveBlock = (id: number, dir: -1 | 1) => {
    pushHistory(blocks)
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  const undo = () => {
    if (history.length === 0) return
    setBlocks(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }

  const updateBlockHeading = (id: number, heading: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, heading } : b))
  }

  const selectedBlockObj = blocks.find(b => b.id === selectedBlock) || null

  const canvasWidth: string | number = device === 'mobile' ? 375 : device === 'tablet' ? 768 : '100%'

  const addPage = () => {
    setPages(prev => [...prev, { id: `page_${Date.now()}`, label: 'صفحه جدید', active: false }])
  }

  // Persist the current site (draft). Returns the server-resolved slug, or null on failure.
  const persistSite = async (): Promise<{ slug: string; url: string } | null> => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: seoTitle,
        blocks: blocks.map(b => ({ id: b.id, type: b.type, heading: b.heading })),
        seo: { title: seoTitle, description: seoDesc },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.slug && data.slug !== slug) setSlug(data.slug)
    return { slug: data.slug, url: data.url }
  }

  const handleSave = async () => {
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      const result = await persistSite()
      if (!result) { setSaveState('error'); return }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    setPublishError('')
    try {
      const result = await persistSite()
      if (!result) {
        setPublishError('برای انتشار ابتدا وارد شوید')
        return
      }
      setPublishedSlug(result.slug)
      setPublishSuccess(true)
    } catch {
      setPublishError('خطا در انتشار سایت')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--text)', direction: 'rtl', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* STICKY TOOLBAR */}
      <div style={{
        flexShrink: 0,
        background: 'var(--navbg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52,
        zIndex: 100,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>‹</span>
          <span>بازگشت</span>
        </Link>

        <div style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 11, height: 11, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>وب‌سایت‌ساز ملک‌جت</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', direction: 'ltr', lineHeight: 1.3 }}>melkjet.com/{slug}</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Device toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 9, padding: 3, gap: 2 }}>
          {([
            ['desktop', '▭', 'دسکتاپ'],
            ['tablet', '▯', 'تبلت'],
            ['mobile', '☐', 'موبایل'],
          ] as [Device, string, string][]).map(([d, icon, label]) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7,
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: device === d ? 'var(--goldDim)' : 'transparent',
                color: device === d ? 'var(--gold)' : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />

        <button
          onClick={undo}
          disabled={history.length === 0}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: history.length > 0 ? 'var(--text)' : 'var(--faint)', cursor: history.length > 0 ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}
        >↩ واگرد</button>
        <button style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--faint)', cursor: 'default', fontSize: 12, fontWeight: 600 }}>
          ↪ بازگرد
        </button>

        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{ padding: '5px 16px', borderRadius: 8, border: '1px solid var(--line)', background: saveState === 'saved' ? 'var(--goldDim)' : 'transparent', color: saveState === 'error' ? '#e7674a' : saveState === 'saved' ? 'var(--gold)' : 'var(--text)', fontSize: 12, fontWeight: 700, cursor: saveState === 'saving' ? 'default' : 'pointer' }}
        >
          {saveState === 'saving' ? 'در حال ذخیره...' : saveState === 'saved' ? 'ذخیره شد ✓' : saveState === 'error' ? 'ورود لازم است' : 'ذخیره'}
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{ padding: '6px 18px', borderRadius: 8, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', border: 'none', color: '#16140f', fontSize: 12, fontWeight: 800, cursor: publishing ? 'default' : 'pointer', opacity: publishing ? 0.7 : 1, flexShrink: 0 }}
        >
          {publishing ? 'در حال انتشار...' : 'انتشار سایت'}
        </button>
        {publishError && (
          <span style={{ fontSize: 11, color: '#e7674a', fontWeight: 600, flexShrink: 0 }}>{publishError}</span>
        )}
      </div>

      {/* THREE-COLUMN BUILDER */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL - Block Library */}
        <div className="mjwb-lib" style={{
          width: 230, flexShrink: 0, borderLeft: '1px solid var(--line)',
          background: 'var(--bg2)', overflowY: 'auto', padding: '16px 0',
        }}>
          <div style={{ padding: '0 14px', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 10 }}>قالب آماده</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STARTER_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl)}
                  style={{
                    textAlign: 'right', padding: '9px 12px', borderRadius: 10,
                    border: '1px solid var(--line)', background: 'var(--surface)',
                    cursor: 'pointer', transition: 'all .15s', width: '100%',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{tpl.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--faint)', lineHeight: 1.4 }}>{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />

          <div style={{ padding: '0 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 10 }}>بلوک‌ها</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {BLOCK_LIBRARY.map(bl => (
                <button
                  key={bl.type}
                  onClick={() => addBlock(bl.type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 9,
                    border: '1px solid var(--line)', background: 'var(--surface)',
                    cursor: 'pointer', transition: 'all .15s', width: '100%', textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--gold)', flexShrink: 0 }}>{bl.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{bl.label}</span>
                  <span style={{ marginRight: 'auto', fontSize: 14, color: 'var(--faint)' }}>+</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER - Canvas */}
        <div style={{
          flex: 1, background: 'var(--bg)', overflowY: 'auto', overflowX: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: device !== 'desktop' ? 'center' : 'stretch',
          padding: device !== 'desktop' ? '20px' : 0,
        }}>
          <div style={{
            width: canvasWidth,
            minHeight: '100%',
            background: '#fff',
            boxShadow: device !== 'desktop' ? '0 8px 40px rgba(0,0,0,0.45)' : 'none',
            borderRadius: device !== 'desktop' ? 16 : 0,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {/* Browser chrome */}
            <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 5 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7674a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7a14a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#5fd98a' }} />
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: 'var(--faint)', textAlign: 'center', direction: 'ltr' }}>
                https://melkjet.com/{slug}
              </div>
            </div>

            {/* Canvas blocks */}
            <div style={{ direction: 'rtl' }}>
              {blocks.length === 0 ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 44, opacity: 0.15 }}>◈</div>
                  <div style={{ fontSize: 14, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.8 }}>
                    از پنل سمت راست یک قالب انتخاب کنید<br />
                    <span style={{ fontSize: 12 }}>یا بلوک‌ها را یکی یکی اضافه نمایید</span>
                  </div>
                </div>
              ) : (
                blocks.map(block => (
                  <BlockPreview
                    key={block.id}
                    block={block}
                    selected={selectedBlock === block.id}
                    onSelect={() => {
                      setSelectedBlock(block.id)
                      setBlockHeadingEdit(block.heading)
                      setActiveTab('settings')
                    }}
                    onUp={() => moveBlock(block.id, -1)}
                    onDown={() => moveBlock(block.id, 1)}
                    onDelete={() => deleteBlock(block.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Inspector */}
        <div className="mjwb-insp" style={{
          width: 288, flexShrink: 0, borderRight: '1px solid var(--line)',
          background: 'var(--bg2)', display: 'flex', flexDirection: 'column',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            {([
              ['seo', 'سئو'],
              ['settings', 'تنظیمات بلوک'],
              ['pages', 'صفحات'],
            ] as [ActiveTab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  flex: 1, padding: '11px 4px', border: 'none', background: 'transparent',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  color: activeTab === t ? 'var(--gold)' : 'var(--muted)',
                  borderBottom: `2px solid ${activeTab === t ? 'var(--gold)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

            {/* SEO Tab */}
            {activeTab === 'seo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--line2)" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--gold)" strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 24 * 0.92} ${2 * Math.PI * 24 * (1 - 0.92)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'var(--gold)' }}>۹۲</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>امتیاز سئو</div>
                    <div style={{ fontSize: 11, color: '#5fd98a', fontWeight: 600 }}>وضعیت: عالی</div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>عنوان صفحه</label>
                  <input
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 10, color: seoTitle.length > 60 ? '#e7674a' : 'var(--faint)', marginTop: 4 }}>{seoTitle.length}/۶۰ کاراکتر</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>توضیح متا</label>
                  <textarea
                    value={seoDesc}
                    onChange={e => setSeoDesc(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 10, color: seoDesc.length > 160 ? '#e7674a' : 'var(--faint)', marginTop: 4 }}>{seoDesc.length}/۱۶۰ کاراکتر</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>آدرس سایت (Slug)</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', direction: 'ltr' }}>
                    <span style={{ padding: '8px 10px', background: 'var(--bg)', borderRight: '1px solid var(--line)', fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>melkjet.com/</span>
                    <input
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                      style={{ flex: 1, padding: '8px 10px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none', direction: 'ltr' }}
                    />
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>بررسی‌های سئو</div>
                  {[
                    'رندرینگ سمت سرور (SSR)',
                    'دامنه اختصاصی فعال',
                    'اسکیما Schema.org',
                    'سرعت بارگذاری ۹۰+',
                    'نقشه سایت (Sitemap)',
                  ].map(label => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 12, color: '#5fd98a', flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                {selectedBlockObj ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                      ویرایش: {BLOCK_LIBRARY.find(b => b.type === selectedBlockObj.type)?.label}
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>عنوان بلوک</label>
                      <input
                        value={blockHeadingEdit}
                        onChange={e => {
                          setBlockHeadingEdit(e.target.value)
                          updateBlockHeading(selectedBlockObj.id, e.target.value)
                        }}
                        style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>رنگ پس‌زمینه</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['#1a1510', '#f5f3ef', '#ffffff', '#0d0b08', '#2d2215', '#1e2530'].map(c => (
                          <div key={c} style={{ width: 28, height: 28, borderRadius: 7, background: c, border: '2px solid var(--line)', cursor: 'pointer', flexShrink: 0 }} />
                        ))}
                      </div>
                    </div>

                    {selectedBlockObj.type === 'hero' && (
                      <>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>زیرعنوان</label>
                          <input
                            defaultValue="مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه"
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>متن دکمه</label>
                          <input
                            defaultValue="مشاهده ملک‌ها"
                            style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </>
                    )}

                    {selectedBlockObj.type === 'cta' && (
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>متن دکمه</label>
                        <input
                          defaultValue="تماس با ما"
                          style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}

                    <div style={{ height: 1, background: 'var(--line)' }} />

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => moveBlock(selectedBlockObj.id, -1)}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                      >▲ بالا</button>
                      <button
                        onClick={() => moveBlock(selectedBlockObj.id, 1)}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                      >▼ پایین</button>
                    </div>

                    <button
                      onClick={() => deleteBlock(selectedBlockObj.id)}
                      style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid rgba(220,60,60,0.4)', background: 'rgba(220,60,60,0.08)', color: '#e05050', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      × حذف بلوک
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.2 }}>◇</div>
                    <div style={{ fontSize: 13, color: 'var(--faint)', lineHeight: 1.8 }}>
                      برای ویرایش<br />یک بلوک را انتخاب کنید
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pages Tab */}
            {activeTab === 'pages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>صفحات سایت</div>
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: idx === 0 ? 'var(--goldDim)' : 'var(--surface)',
                      border: `1px solid ${idx === 0 ? 'var(--gold)' : 'var(--line)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 12, color: idx === 0 ? 'var(--gold)' : 'var(--faint)' }}>◰</span>
                    <span style={{ fontSize: 12, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? 'var(--gold)' : 'var(--text)' }}>{page.label}</span>
                    {idx === 0 && <span style={{ marginRight: 'auto', fontSize: 9, color: 'var(--gold)', background: 'rgba(201,168,76,0.2)', padding: '2px 7px', borderRadius: 10 }}>فعال</span>}
                  </div>
                ))}
                <button
                  onClick={addPage}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginTop: 4 }}
                >
                  <span>+</span><span>صفحه جدید</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PUBLISH SUCCESS MODAL */}
      {publishSuccess && (
        <div
          onClick={() => setPublishSuccess(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 20,
              padding: '40px 44px', textAlign: 'center', maxWidth: 420, width: '90%',
              boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
              direction: 'rtl',
            }}
          >
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(95,217,138,0.12)', border: '2px solid #5fd98a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 30, color: '#5fd98a' }}>✓</div>

            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>سایت شما منتشر شد!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.7 }}>وب‌سایت شما با موفقیت آنلاین شد و در دسترس کاربران است.</div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 16px', marginBottom: 28, direction: 'ltr', fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>
              melkjet.com/{publishedSlug}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a
                href={`/${publishedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 800, textDecoration: 'none', display: 'inline-block' }}
              >
                مشاهده سایت
              </a>
              <button
                onClick={() => setPublishSuccess(false)}
                style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
