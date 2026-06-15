'use client'
import { useState } from 'react'
import Link from 'next/link'
import Nav from '../components/Nav'
import Footer from '../components/Footer'

type Template = {
  id: string
  name: string
  desc: string
  gradient: string
  tag: string
  tagColor: string
  pages: string[]
}

type PageItem = { id: string; label: string; icon: string; active: boolean }
type ComponentItem = { id: string; label: string; icon: string }

const templates: Template[] = [
  {
    id: 'modern',
    name: 'مدرن',
    desc: 'قالب مینیمال با تمرکز بر عکس‌های ملک',
    gradient: 'linear-gradient(135deg,#2a2620,#1a1714)',
    tag: 'محبوب',
    tagColor: 'var(--gold)',
    pages: ['خانه', 'آگهی‌ها', 'درباره ما', 'تماس'],
  },
  {
    id: 'luxury',
    name: 'لوکس',
    desc: 'طراحی پرمایه برای آژانس‌های ممتاز',
    gradient: 'linear-gradient(135deg,#1e2028,#141419)',
    tag: 'پیشنهادی',
    tagColor: '#7a8fae',
    pages: ['خانه', 'ملک‌های لوکس', 'سرمایه‌گذاری', 'مشاوران', 'تماس'],
  },
  {
    id: 'classic',
    name: 'کلاسیک',
    desc: 'قالب اعتمادساز با ساختار سنتی',
    gradient: 'linear-gradient(135deg,#1e2318,#131711)',
    tag: 'ساده',
    tagColor: '#5fd98a',
    pages: ['خانه', 'خرید', 'اجاره', 'مشاوران', 'وبلاگ', 'تماس'],
  },
  {
    id: 'minimal',
    name: 'مینیمال',
    desc: 'ساده و سریع با تجربه کاربری عالی',
    gradient: 'linear-gradient(135deg,#221e2a,#161320)',
    tag: 'سریع',
    tagColor: '#b07a8a',
    pages: ['خانه', 'جستجو', 'تماس'],
  },
]

const pageComponents: ComponentItem[] = [
  { id: 'hero', label: 'بنر اصلی', icon: '▭' },
  { id: 'search', label: 'جستجوی ملک', icon: '◎' },
  { id: 'listings', label: 'لیست آگهی‌ها', icon: '◰' },
  { id: 'stats', label: 'آمار و ارقام', icon: '◈' },
  { id: 'team', label: 'تیم مشاوران', icon: '◧' },
  { id: 'testimonials', label: 'نظرات مشتریان', icon: '◴' },
  { id: 'map', label: 'نقشه تعاملی', icon: '▦' },
  { id: 'contact', label: 'فرم تماس', icon: '◫' },
  { id: 'cta', label: 'دکمه اقدام', icon: '◐' },
  { id: 'gallery', label: 'گالری تصاویر', icon: '▢' },
]

type ActiveTab = 'design' | 'pages' | 'settings' | 'publish'

export default function WebsiteBuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(templates[0])
  const [activeTab, setActiveTab] = useState<ActiveTab>('design')
  const [pages, setPages] = useState<PageItem[]>([
    { id: 'home', label: 'خانه', icon: '◈', active: true },
    { id: 'listings', label: 'آگهی‌ها', icon: '◰', active: false },
    { id: 'about', label: 'درباره ما', icon: '◴', active: false },
    { id: 'contact', label: 'تماس', icon: '◧', active: false },
  ])
  const [activePage, setActivePage] = useState('home')
  const [addedComponents, setAddedComponents] = useState<string[]>(['hero', 'search', 'listings'])
  const [primaryColor, setPrimaryColor] = useState('#c9a84c')
  const [fontChoice, setFontChoice] = useState('vazirmatn')
  const [layoutStyle, setLayoutStyle] = useState('rtl')
  const [domain, setDomain] = useState('')
  const [siteName, setSiteName] = useState('آژانس ملکی نمونه')
  const [publishStep, setPublishStep] = useState(0)

  const colorOptions = ['#c9a84c', '#5fd98a', '#7a8fae', '#b07a8a', '#e7a14a', '#e7674a']

  const addComponent = (id: string) => {
    if (!addedComponents.includes(id)) setAddedComponents(prev => [...prev, id])
  }

  const removeComponent = (id: string) => {
    setAddedComponents(prev => prev.filter(c => c !== id))
  }

  const addPage = () => {
    const id = `page_${Date.now()}`
    setPages(prev => [...prev, { id, label: 'صفحه جدید', icon: '◰', active: false }])
  }

  const previewComponents = pageComponents.filter(c => addedComponents.includes(c.id))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* Header */}
      <section style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '36px 24px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, background: 'var(--goldDim)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 20, fontWeight: 700, display: 'inline-block', marginBottom: 12 }}>سازنده وبسایت</div>
              <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-1px' }}>ساخت وبسایت تخصصی ملک ✦</h1>
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>وبسایت اختصاصی آژانس یا مشاور خود را در چند دقیقه بسازید</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ padding: '10px 20px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                پیش‌نمایش
              </button>
              <button
                onClick={() => setPublishStep(1)}
                style={{ padding: '10px 22px', borderRadius: 11, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                انتشار وبسایت
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 24, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
            {([
              ['design', 'طراحی', '◈'],
              ['pages', 'صفحات', '◰'],
              ['settings', 'تنظیمات', '◴'],
              ['publish', 'انتشار', '▦'],
            ] as [ActiveTab, string, string][]).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', border: 'none', background: 'transparent',
                  color: activeTab === id ? 'var(--gold)' : 'var(--muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  borderBottom: `2px solid ${activeTab === id ? 'var(--gold)' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Template Selection (always shown at top if design tab) */}
      {activeTab === 'design' && (
        <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '20px 24px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, fontWeight: 600 }}>قالب‌ها:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  style={{
                    border: `2px solid ${selectedTemplate.id === t.id ? 'var(--gold)' : 'var(--line)'}`,
                    borderRadius: 13, overflow: 'hidden', cursor: 'pointer',
                    boxShadow: selectedTemplate.id === t.id ? '0 0 0 3px rgba(201,168,76,0.15)' : 'none',
                    transition: 'all .2s',
                  }}
                >
                  <div style={{ height: 80, background: t.gradient, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '70%', height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.15)', marginBottom: 8 }} />
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 7px', borderRadius: 8, background: `${t.tagColor}30`, color: t.tagColor, fontWeight: 700 }}>{t.tag}</span>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--surface)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Builder Layout */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 40px' }}>

        {/* Design Tab */}
        {activeTab === 'design' && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 20, marginTop: 24 }}>
            {/* Left Panel - Components */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px', height: 'fit-content' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--muted)' }}>اجزای صفحه</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pageComponents.map(comp => {
                  const isAdded = addedComponents.includes(comp.id)
                  return (
                    <div
                      key={comp.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10,
                        background: isAdded ? 'var(--goldDim)' : 'var(--bg)',
                        border: `1px solid ${isAdded ? 'var(--gold)' : 'var(--line)'}`,
                        cursor: 'pointer', transition: 'all .15s',
                        fontSize: 12.5,
                      }}
                      onClick={() => isAdded ? removeComponent(comp.id) : addComponent(comp.id)}
                    >
                      <span style={{ color: isAdded ? 'var(--gold)' : 'var(--faint)' }}>{comp.icon}</span>
                      <span style={{ flex: 1, color: isAdded ? 'var(--gold)' : 'var(--text)' }}>{comp.label}</span>
                      <span style={{ fontSize: 11, color: isAdded ? 'var(--gold)' : 'var(--faint)' }}>{isAdded ? '✓' : '+'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Center - Preview */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
              {/* Browser mockup bar */}
              <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7674a' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7a14a' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#5fd98a' }} />
                </div>
                <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 7, padding: '4px 12px', fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>
                  {siteName.toLowerCase().replace(/\s/g, '')}.melkjet.ir
                </div>
              </div>
              {/* Preview Content */}
              <div style={{ direction: 'rtl', fontFamily: 'Vazirmatn, sans-serif' }}>
                {/* Mock Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--navbg)', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: primaryColor, opacity: 0.9 }} />
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{siteName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
                    {selectedTemplate.pages.slice(0, 4).map(p => <span key={p}>{p}</span>)}
                  </div>
                </div>

                {/* Preview Blocks */}
                <div>
                  {previewComponents.map(comp => (
                    <div key={comp.id} style={{ borderBottom: '1px dashed var(--line)', padding: '18px 20px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, color: primaryColor }}>{comp.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{comp.label}</span>
                        <button
                          onClick={() => removeComponent(comp.id)}
                          style={{ marginRight: 'auto', width: 22, height: 22, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 12 }}>×</button>
                      </div>
                      {comp.id === 'hero' && (
                        <div style={{ borderRadius: 12, background: selectedTemplate.gradient, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>{siteName}</div>
                            <div style={{ display: 'inline-block', padding: '6px 16px', background: primaryColor, borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#16140f' }}>جستجوی ملک</div>
                          </div>
                        </div>
                      )}
                      {comp.id === 'search' && (
                        <div style={{ display: 'flex', gap: 8, background: 'var(--bg)', padding: 12, borderRadius: 10 }}>
                          <div style={{ flex: 1, height: 32, background: 'var(--surface)', borderRadius: 7, border: '1px solid var(--line)' }} />
                          <div style={{ width: 70, height: 32, background: primaryColor, borderRadius: 7, opacity: 0.8 }} />
                        </div>
                      )}
                      {comp.id === 'listings' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                          {[1,2,3].map(i => (
                            <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
                              <div style={{ height: 50, background: `linear-gradient(135deg,#${(3+i).toString(16)}a3530,#2${i}1e1b)` }} />
                              <div style={{ padding: 8 }}>
                                <div style={{ height: 8, background: 'var(--surface)', borderRadius: 3, marginBottom: 5 }} />
                                <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, width: '60%' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!['hero','search','listings'].includes(comp.id) && (
                        <div style={{ height: 44, background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--faint)' }}>بلوک {comp.label}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {previewComponents.length === 0 && (
                    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--faint)' }}>
                      <span style={{ fontSize: 32 }}>◈</span>
                      <span style={{ fontSize: 13 }}>از پنل سمت راست اجزا را اضافه کنید</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Style Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--muted)' }}>رنگ اصلی</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {colorOptions.map(c => (
                    <div
                      key={c}
                      onClick={() => setPrimaryColor(c)}
                      style={{
                        width: 32, height: 32, borderRadius: 9, background: c, cursor: 'pointer',
                        border: primaryColor === c ? '3px solid var(--text)' : '3px solid transparent',
                        transition: 'all .15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--muted)' }}>فونت</div>
                {['vazirmatn', 'iran-sans', 'dana'].map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="font" checked={fontChoice === f} onChange={() => setFontChoice(f)} style={{ accentColor: 'var(--gold)' }} />
                    <span>{f === 'vazirmatn' ? 'وزیرمتن' : f === 'iran-sans' ? 'ایران سنس' : 'دانا'}</span>
                  </label>
                ))}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--muted)' }}>چیدمان</div>
                {[['rtl', 'راست به چپ (فارسی)'], ['ltr', 'چپ به راست']].map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="layout" checked={layoutStyle === val} onChange={() => setLayoutStyle(val)} style={{ accentColor: 'var(--gold)' }} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--muted)' }}>قالب انتخابی</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selectedTemplate.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{selectedTemplate.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>{selectedTemplate.pages.length} صفحه پیش‌فرض</div>
              </div>
            </div>
          </div>
        )}

        {/* Pages Tab */}
        {activeTab === 'pages' && (
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)' }}>صفحات سایت</div>
                <button onClick={addPage} style={{ padding: '4px 10px', borderRadius: 7, background: 'var(--goldDim)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ افزودن</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pages.map(page => (
                  <div
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11,
                      background: activePage === page.id ? 'var(--goldDim)' : 'var(--bg)',
                      border: `1px solid ${activePage === page.id ? 'var(--gold)' : 'var(--line)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: activePage === page.id ? 'var(--gold)' : 'var(--faint)' }}>{page.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: activePage === page.id ? 700 : 400 }}>{page.label}</span>
                    {activePage === page.id && <span style={{ marginRight: 'auto', fontSize: 10, color: 'var(--gold)' }}>فعال</span>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>تنظیمات صفحه</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>عنوان صفحه</label>
                  <input defaultValue={pages.find(p => p.id === activePage)?.label} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>آدرس URL</label>
                  <input defaultValue={`/${activePage}`} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>توضیحات سئو</label>
                  <textarea rows={3} placeholder="توضیح کوتاه برای موتورهای جستجو..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--gold)' }} />
                    <span>در منوی اصلی نمایش داده شود</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {[
              {
                title: 'اطلاعات سایت',
                fields: [
                  { label: 'نام سایت', value: siteName, setter: setSiteName, type: 'text' },
                  { label: 'توضیحات کوتاه', value: 'بهترین آژانس ملکی منطقه', setter: () => {}, type: 'text' },
                  { label: 'ایمیل تماس', value: 'info@example.com', setter: () => {}, type: 'email' },
                  { label: 'شماره تماس', value: '۰۲۱-۱۲۳۴۵۶۷۸', setter: () => {}, type: 'text' },
                ],
              },
              {
                title: 'آدرس دفتر',
                fields: [
                  { label: 'شهر', value: 'تهران', setter: () => {}, type: 'text' },
                  { label: 'منطقه / محله', value: 'سعادت‌آباد', setter: () => {}, type: 'text' },
                  { label: 'آدرس کامل', value: 'خیابان سرو، پلاک ۱۲', setter: () => {}, type: 'text' },
                  { label: 'کد پستی', value: '۱۴۵۷۹', setter: () => {}, type: 'text' },
                ],
              },
            ].map(section => (
              <div key={section.title} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800 }}>{section.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {section.fields.map(field => (
                    <div key={field.label}>
                      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{field.label}</label>
                      <input defaultValue={field.value} type={field.type} style={{ width: '100%', padding: '9px 13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800 }}>شبکه‌های اجتماعی</h3>
              {[['اینستاگرام', '@ نام کاربری'], ['تلگرام', 't.me/...'], ['واتساپ', '۰۹۱۲...']].map(([label, placeholder]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input placeholder={placeholder} style={{ width: '100%', padding: '9px 13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', direction: 'ltr' }} />
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800 }}>سئو پیشرفته</h3>
              {[['کلمات کلیدی', 'خرید ملک، اجاره آپارتمان...'], ['عنوان در گوگل', `${siteName} | آژانس ملکی`]].map(([label, placeholder]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input placeholder={placeholder} style={{ width: '100%', padding: '9px 13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--gold)' }} />
                  <span>فعال‌سازی Sitemap خودکار</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Publish Tab */}
        {activeTab === 'publish' && (
          <div style={{ marginTop: 24, maxWidth: 600 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 28, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>انتشار وبسایت</h3>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>آدرس وبسایت (زیردامنه ملک‌جت)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="نام-آژانس"
                    style={{ flex: 1, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', direction: 'ltr' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', direction: 'ltr' }}>.melkjet.ir</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'بررسی محتوا', done: publishStep >= 1 },
                  { label: 'ساخت صفحات', done: publishStep >= 2 },
                  { label: 'آپلود فایل‌ها', done: publishStep >= 3 },
                  { label: 'فعال‌سازی دامنه', done: publishStep >= 4 },
                ].map((step, i) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: step.done ? 'rgba(95,217,138,0.15)' : 'var(--bg)',
                      border: `1px solid ${step.done ? '#5fd98a' : 'var(--line)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: step.done ? '#5fd98a' : 'var(--faint)',
                    }}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 14, color: step.done ? 'var(--text)' : 'var(--muted)' }}>{step.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setPublishStep(p => Math.min(p + 1, 4))}
                disabled={publishStep >= 4}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: publishStep >= 4 ? 'rgba(95,217,138,0.15)' : 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  color: publishStep >= 4 ? '#5fd98a' : '#16140f',
                  border: publishStep >= 4 ? '1px solid #5fd98a' : 'none',
                  fontSize: 15, fontWeight: 800, cursor: publishStep >= 4 ? 'default' : 'pointer',
                }}
              >
                {publishStep >= 4 ? '✓ وبسایت منتشر شد!' : 'مرحله بعد'}
              </button>
            </div>

            {publishStep >= 4 && (
              <div style={{ background: 'rgba(95,217,138,0.08)', border: '1px solid rgba(95,217,138,0.3)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6, color: '#5fd98a' }}>وبسایت شما آماده است!</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                  آدرس: <span style={{ direction: 'ltr', display: 'inline-block' }}>{domain || 'agency'}.melkjet.ir</span>
                </div>
                <Link href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#5fd98a', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  مشاهده وبسایت
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
