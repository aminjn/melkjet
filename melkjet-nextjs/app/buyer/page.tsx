'use client'

import { useState } from 'react'
import Link from 'next/link'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

/* ─── Data ─────────────────────────────────────────────── */

const needTags = ['آپارتمان', 'سعادت‌آباد', '۱۳۰–۱۵۰ متر', 'زیر ۱۸م', 'آسانسور', 'پارکینگ']

const aiOpportunities = [
  {
    id: 1,
    title: 'آپارتمان ۱۴۰م سعادت‌آباد',
    match: 96,
    price: '۱۷٫۸ میلیارد',
    priceDropLabel: '↓۴۰۰م',
    why: 'متراژ دقیقاً در محدوده نیاز شما، آسانسور و پارکینگ دارد، قیمت ۴۰۰ میلیون کاهش یافته.',
    gradient: 'linear-gradient(135deg,#0d2010 0%,#1a3d1a 60%,#0d2810 100%)',
  },
  {
    id: 2,
    title: 'آپارتمان ۱۳۰م سعادت‌آباد',
    match: 91,
    price: '۱۵٫۲ میلیارد',
    priceDropLabel: null,
    why: 'کمترین قیمت در محدوده سعادت‌آباد برای این متراژ، واحد تازه بازسازی‌شده.',
    gradient: 'linear-gradient(135deg,#0d0d20 0%,#1a1a3d 60%,#0d0d28 100%)',
  },
]

const savedSearches = [
  {
    id: 1,
    name: 'آپارتمان سعادت‌آباد ۱۳۰–۱۵۰م',
    updated: 'امروز ۱۴:۲۲',
    chips: ['سعادت‌آباد', '۱۳۰–۱۵۰م', 'زیر ۱۸م'],
    count: 6,
    newCount: 2,
  },
  {
    id: 2,
    name: 'اجاره ونک ۲ خوابه',
    updated: 'دیروز ۱۰:۰۵',
    chips: ['ونک', '۲ خوابه', 'اجاره'],
    count: 14,
    newCount: 0,
  },
  {
    id: 3,
    name: 'سرمایه‌گذاری لواسان',
    updated: '۳ روز پیش',
    chips: ['لواسان', 'ویلا', 'سرمایه‌گذاری'],
    count: 3,
    newCount: 0,
  },
]

const favorites = [
  { id: 1, title: 'آپارتمان نوساز سعادت‌آباد', location: 'سعادت‌آباد، تهران', price: '۱۷٫۸ میلیارد', score: 96, drop: '↓۴۰۰م', gradient: 'linear-gradient(135deg,#0d2010,#1a3d1a)' },
  { id: 2, title: 'آپارتمان لوکس جردن', location: 'جردن، تهران', price: '۱۴٫۵ میلیارد', score: 88, drop: null, gradient: 'linear-gradient(135deg,#0d0d20,#1a1a3d)' },
  { id: 3, title: 'آپارتمان ونک', location: 'ونک، تهران', price: '۹٫۲ میلیارد', score: 82, drop: null, gradient: 'linear-gradient(135deg,#200d0d,#3d1a1a)' },
  { id: 4, title: 'پنت‌هاوس الهیه', location: 'الهیه، تهران', price: '۴۵ میلیارد', score: 74, drop: '↓۱٫۵ب', gradient: 'linear-gradient(135deg,#1e1a0a,#3d3310)' },
  { id: 5, title: 'آپارتمان نیاوران', location: 'نیاوران، تهران', price: '۲۲ میلیارد', score: 79, drop: null, gradient: 'linear-gradient(135deg,#0a1a1e,#103340)' },
  { id: 6, title: 'آپارتمان فرشته', location: 'فرشته، تهران', price: '۳۱ میلیارد', score: 71, drop: null, gradient: 'linear-gradient(135deg,#1a0d1a,#3a1a3a)' },
]

const journeySteps = [
  { label: 'تعریف نیاز', done: true, active: false },
  { label: 'بررسی گزینه‌ها', done: false, active: true },
  { label: 'بازدید حضوری', done: false, active: false },
  { label: 'قرارداد', done: false, active: false },
]

const notifications = [
  { color: '#e05555', dot: '#e05555', text: 'فایل سعادت‌آباد ۱۴۰م – کاهش قیمت ۴۰۰م', time: '۲ ساعت پیش' },
  { color: '#3dba6e', dot: '#3dba6e', text: 'فایل جدید مطابق جستجوی شما', time: '۵ ساعت پیش' },
  { color: '#5b8dee', dot: '#5b8dee', text: 'یادآور بازدید فردا ۱۴:۰۰', time: '۱ روز پیش' },
  { color: '#e8a84c', dot: '#e8a84c', text: 'دستیار AI: ۳ فرصت جدید پیدا شد', time: '۲ روز پیش' },
]

/* ─── Component ─────────────────────────────────────────── */

export default function BuyerPage() {
  const [heartRemoved, setHeartRemoved] = useState<number[]>([])
  const [compareSet, setCompareSet] = useState<number[]>([])
  const [whyOpen, setWhyOpen] = useState<number | null>(null)
  const [visitCancelled, setVisitCancelled] = useState(false)

  const toggleCompare = (id: number) =>
    setCompareSet(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'Vazirmatn', sans-serif" }}>
      <Nav />

      {/* ── Section breadcrumb bar ── */}
      <div style={{
        background: 'var(--navbg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 68, zIndex: 40,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 40, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          <span>ملک‌جت</span>
          <span style={{ color: 'var(--faint)' }}>›</span>
          <span style={{ color: 'var(--gold)' }}>میز کار خریدار</span>
        </div>
      </div>

      {/* ── Page wrapper ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* ── User Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
              سلام، امیر رضایی 👋
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              آخرین ورود: دیروز ۲۱:۳۰
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 16px', borderRadius: 30,
              background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
              color: '#16140f', fontSize: 13, fontWeight: 700,
            }}>
              <span style={{ fontSize: 15 }}>★</span>
              خریدار حرفه‌ای
            </span>
          </div>
        </div>

        {/* ── 2-col grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 28, alignItems: 'start' }}>

          {/* ══ LEFT COLUMN ══════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── AI Assistant Card ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--gold)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(201,168,76,0.12), 0 8px 32px -12px rgba(201,168,76,0.15)',
            }}>
              {/* Card Header */}
              <div style={{
                padding: '18px 22px', borderBottom: '1px solid var(--line)',
                background: 'var(--goldDim)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: '#16140f', flexShrink: 0,
                  }}>✦</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>دستیار خرید شخصی ملک‌جت</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>هوش مصنوعی اختصاصی شما</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: '#3dba6e',
                    boxShadow: '0 0 8px #3dba6e',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite',
                  }} />
                  <span style={{ fontSize: 12, color: '#3dba6e', fontWeight: 600 }}>پایش بازار ۲۴ ساعته</span>
                </div>
              </div>

              <div style={{ padding: '20px 22px' }}>
                {/* Need Tags */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>نیازهای ذخیره‌شده شما:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {needTags.map(tag => (
                      <span key={tag} style={{
                        padding: '4px 12px', borderRadius: 20,
                        background: 'var(--goldDim)',
                        border: '1px solid rgba(201,168,76,0.3)',
                        fontSize: 12, color: 'var(--gold)', fontWeight: 600,
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* AI Finds */}
                <div>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    ✦ فرصت‌های تازه‌ای که AI پیدا کرد
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {aiOpportunities.map(op => (
                      <div key={op.id} style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--line2)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        display: 'flex',
                        gap: 0,
                      }}>
                        {/* Image placeholder */}
                        <div style={{
                          width: 90, minHeight: 80,
                          background: op.gradient,
                          flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 28, color: 'rgba(255,255,255,0.1)',
                        }}>⌂</div>

                        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{op.title}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{op.price}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {op.priceDropLabel && (
                              <span style={{
                                padding: '3px 9px', borderRadius: 6,
                                background: 'rgba(61,186,110,0.15)',
                                border: '1px solid rgba(61,186,110,0.3)',
                                color: '#3dba6e', fontSize: 12, fontWeight: 700,
                              }}>{op.priceDropLabel}</span>
                            )}
                            <span style={{
                              padding: '3px 10px', borderRadius: 20,
                              background: 'rgba(61,186,110,0.12)',
                              border: '1px solid rgba(61,186,110,0.25)',
                              color: '#3dba6e', fontSize: 12, fontWeight: 700,
                            }}>{op.match}٪ تطابق</span>
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setWhyOpen(whyOpen === op.id ? null : op.id)}
                                style={{
                                  padding: '4px 11px', borderRadius: 7,
                                  border: '1px solid var(--line2)',
                                  background: 'transparent',
                                  color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
                                  fontFamily: "'Vazirmatn', sans-serif",
                                }}
                              >چرا؟</button>
                              {whyOpen === op.id && (
                                <div style={{
                                  position: 'absolute', top: '110%', left: 0,
                                  width: 240, zIndex: 20,
                                  background: 'var(--surface)',
                                  border: '1px solid var(--line2)',
                                  borderRadius: 10, padding: '12px 14px',
                                  fontSize: 12, color: 'var(--muted)', lineHeight: 1.7,
                                  boxShadow: '0 12px 32px -8px rgba(0,0,0,0.5)',
                                }}>
                                  {op.why}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Saved Searches ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>جستجوهای ذخیره‌شده</h2>
                <button style={{
                  padding: '7px 16px', borderRadius: 9,
                  background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                }}>+ جستجوی جدید</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {savedSearches.map(s => (
                  <div key={s.id} style={{
                    background: 'var(--surface)',
                    border: s.newCount > 0 ? '1px solid rgba(61,186,110,0.35)' : '1px solid var(--line)',
                    borderRadius: 14, padding: '16px 20px',
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s.name}</span>
                          {s.newCount > 0 && (
                            <span style={{
                              padding: '2px 10px', borderRadius: 20,
                              background: 'rgba(61,186,110,0.15)',
                              border: '1px solid rgba(61,186,110,0.35)',
                              color: '#3dba6e', fontSize: 11, fontWeight: 700,
                            }}>نتایج جدید: {s.newCount} فایل</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {s.chips.map(chip => (
                            <span key={chip} style={{
                              padding: '3px 10px', borderRadius: 20,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--line2)',
                              fontSize: 11, color: 'var(--muted)',
                            }}>{chip}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--faint)' }}>
                          آخرین بروزرسانی: {s.updated} · {s.count} نتیجه
                        </div>
                      </div>
                      <button style={{
                        padding: '7px 16px', borderRadius: 8,
                        background: 'var(--goldDim)',
                        border: '1px solid rgba(201,168,76,0.25)',
                        color: 'var(--gold)', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                        flexShrink: 0,
                      }}>مشاهده نتایج</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Favorites Grid ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  علاقه‌مندی‌ها
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginRight: 8 }}>({favorites.filter(f => !heartRemoved.includes(f.id)).length} ملک)</span>
                </h2>
                {compareSet.length > 0 && (
                  <button style={{
                    padding: '7px 16px', borderRadius: 9,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    border: 'none', color: '#16140f', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                  }}>مقایسه {compareSet.length} ملک</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {favorites.filter(f => !heartRemoved.includes(f.id)).map(prop => (
                  <Link key={prop.id} href={`/property/${prop.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 14, overflow: 'hidden',
                      transition: 'border-color 0.15s, transform 0.15s',
                      cursor: 'pointer',
                    }}>
                      {/* Image */}
                      <div style={{
                        height: 130,
                        background: prop.gradient,
                        position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 36, color: 'rgba(255,255,255,0.09)',
                      }}>
                        ⌂
                        {/* Heart */}
                        <button
                          onClick={e => { e.preventDefault(); setHeartRemoved(prev => [...prev, prop.id]) }}
                          style={{
                            position: 'absolute', top: 10, left: 10,
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.45)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, color: '#e05555',
                          }}
                        >♥</button>
                        {/* AI Score */}
                        <span style={{
                          position: 'absolute', top: 10, right: 10,
                          padding: '2px 8px', borderRadius: 20,
                          background: 'rgba(0,0,0,0.55)',
                          color: '#3dba6e', fontSize: 11, fontWeight: 700,
                          border: '1px solid rgba(61,186,110,0.3)',
                        }}>{prop.score}٪</span>
                        {/* Price Drop */}
                        {prop.drop && (
                          <span style={{
                            position: 'absolute', bottom: 10, right: 10,
                            padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(61,186,110,0.9)',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                          }}>{prop.drop}</span>
                        )}
                      </div>
                      {/* Body */}
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3, lineHeight: 1.4 }}>{prop.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{prop.location}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: 10 }}>{prop.price}</div>
                        <label
                          onClick={e => e.preventDefault()}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}
                        >
                          <input
                            type="checkbox"
                            checked={compareSet.includes(prop.id)}
                            onChange={() => toggleCompare(prop.id)}
                            style={{ accentColor: 'var(--gold)', width: 13, height: 13 }}
                          />
                          مقایسه
                        </label>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

          </div>
          {/* ══ END LEFT COLUMN ══════════════════════════════════ */}

          {/* ══ RIGHT SIDEBAR ════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 88 }}>

            {/* ── Journey Tracker ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16, padding: '20px 20px 22px',
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>مسیر خرید شما</h3>
              <div style={{ position: 'relative' }}>
                {/* Connecting line */}
                <div style={{
                  position: 'absolute',
                  top: 15, right: 15,
                  width: 2,
                  height: 'calc(100% - 30px)',
                  background: 'var(--line2)',
                }} />
                {journeySteps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    paddingBottom: i < journeySteps.length - 1 ? 22 : 0,
                    position: 'relative', zIndex: 1,
                  }}>
                    {/* Step indicator */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: step.done
                        ? 'linear-gradient(140deg,var(--gold2),var(--gold))'
                        : step.active
                          ? 'var(--goldDim)'
                          : 'var(--bg2)',
                      border: step.active
                        ? '2px solid var(--gold)'
                        : step.done
                          ? 'none'
                          : '2px solid var(--line2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                      color: step.done ? '#16140f' : step.active ? 'var(--gold)' : 'var(--faint)',
                      fontWeight: 700,
                    }}>
                      {step.done ? '✓' : i + 1}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: step.active ? 700 : 500,
                        color: step.done || step.active ? 'var(--text)' : 'var(--muted)',
                      }}>{step.label}</div>
                      {step.active && (
                        <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2, fontWeight: 600 }}>● در حال انجام</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Notifications Feed ── */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>اعلان‌ها</h3>
                <span style={{
                  padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(220,60,60,0.15)',
                  border: '1px solid rgba(220,60,60,0.3)',
                  color: '#e05555', fontSize: 11, fontWeight: 700,
                }}>۴ جدید</span>
              </div>
              <div>
                {notifications.map((n, i) => (
                  <div key={i} style={{
                    padding: '13px 18px',
                    borderBottom: i < notifications.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 11,
                  }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: n.dot, flexShrink: 0, marginTop: 4,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 3 }}>{n.text}</div>
                      <div style={{ fontSize: 10, color: 'var(--faint)' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Upcoming Visit ── */}
            {!visitCancelled && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 16, padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>بازدید پیش‌رو</h3>
                </div>
                <div style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--line2)',
                  borderRadius: 10, padding: '13px 15px', marginBottom: 14,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>آپارتمان سعادت‌آباد</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
                    📅 یکشنبه ۱۲ خرداد · ۱۴:۰۰
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    👤 مشاور: سارا محمدی
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    flex: 1, padding: '8px 0', borderRadius: 9,
                    background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                    border: 'none', color: '#16140f', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                  }}>تغییر زمان</button>
                  <button
                    onClick={() => setVisitCancelled(true)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 9,
                      background: 'transparent',
                      border: '1px solid rgba(220,60,60,0.3)',
                      color: '#e05555', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: "'Vazirmatn', sans-serif",
                    }}>لغو</button>
                </div>
              </div>
            )}

          </div>
          {/* ══ END SIDEBAR ══════════════════════════════════════ */}

        </div>
      </div>

      <Footer />
    </div>
  )
}
