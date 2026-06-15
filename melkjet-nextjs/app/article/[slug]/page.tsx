'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'

const mockArticle = {
  slug: 'apartment-buying-guide-tehran-1405',
  category: 'راهنمای خرید',
  title: 'راهنمای خرید آپارتمان در تهران ۱۴۰۵',
  subtitle: 'همه چیزی که پیش از خرید اولین یا دومین خانه‌تان در تهران باید بدانید',
  author: 'تحریریه ملک‌جت',
  authorRole: 'تولید با AI · بازبینی‌شده توسط تحلیل‌گر بازار',
  authorBio: 'تیم تحلیلگران ملک‌جت با بهره‌گیری از هوش مصنوعی و داده‌های بیش از ۲۴۰ هزار آگهی فعال، محتوای تخصصی و بروز بازار مسکن ایران را تولید می‌کند.',
  date: '۱۵ خرداد ۱۴۰۵',
  readTime: '۸ دقیقه',
  views: '۱۲٬۴۰۰',
  aiConfidence: 87,
  heroGradient: 'linear-gradient(135deg,#3a3530,#211e1b)',
  aiSummary: {
    points: [
      'میانگین قیمت در مناطق شمالی تهران ۸٪ رشد داشته است',
      'احتمال ادامه رشد قیمت تا پایان سال ۶۸٪ برآورد می‌شود',
      'سعادت‌آباد و دروس بیشترین پتانسیل رشد را دارند',
      'پیش‌فروش با اقساط بهترین فرصت برای ورود به بازار است',
    ]
  },
  tags: ['بازار مسکن', 'تهران', 'سرمایه‌گذاری', 'پیش‌بینی قیمت', 'تحلیل'],
  toc: [
    { id: 'intro', title: 'مقدمه و نگاه کلی' },
    { id: 'factors', title: 'عوامل مؤثر بر قیمت' },
    { id: 'regions', title: 'مناطق پیشتاز' },
    { id: 'buyers', title: 'توصیه برای خریداران' },
    { id: 'investors', title: 'فرصت‌های سرمایه‌گذاری' },
    { id: 'conclusion', title: 'جمع‌بندی' },
  ],
  reactions: { like: 342, save: 128, share: 67 },
  comments: [
    { name: 'محمد رضایی', date: '۱۶ خرداد', text: 'تحلیل بسیار دقیق و کاملی بود. ممنون از تیم ملک‌جت.' },
    { name: 'سارا احمدی', date: '۱۶ خرداد', text: 'آیا این پیش‌بینی برای مناطق جنوبی هم صدق می‌کند؟' },
    { name: 'علی حسینی', date: '۱۷ خرداد', text: 'اطلاعات پیش‌فروش خیلی مفید بود. ممنون.' },
  ],
  related: [
    { tag: 'راهنما', title: '۷ نکته‌ی کلیدی پیش از خرید اولین خانه', gradient: 'linear-gradient(135deg,#2c343a,#1a1f23)', readTime: '۵ دقیقه' },
    { tag: 'سرمایه‌گذاری', title: 'پیش‌فروش یا آماده؟ کدام بازده بهتری دارد؟', gradient: 'linear-gradient(135deg,#2f3a34,#1b211e)', readTime: '۶ دقیقه' },
    { tag: 'محله', title: 'بهترین محله‌های تهران برای سکونت در ۱۴۰۵', gradient: 'linear-gradient(135deg,#3a3630,#221f1b)', readTime: '۱۰ دقیقه' },
    { tag: 'حقوقی', title: 'راهنمای کامل بررسی سند ملکی', gradient: 'linear-gradient(135deg,#34323c,#1e1d23)', readTime: '۷ دقیقه' },
  ],
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

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const article = mockArticle

  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reactions, setReactions] = useState(article.reactions)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(article.comments)
  const [activeSection, setActiveSection] = useState('intro')

  function handleLike() {
    setLiked(l => !l)
    setReactions(r => ({ ...r, like: liked ? r.like - 1 : r.like + 1 }))
  }

  function handleSave() {
    setSaved(s => !s)
    setReactions(r => ({ ...r, save: saved ? r.save - 1 : r.save + 1 }))
  }

  function handleComment() {
    if (!commentText.trim()) return
    setComments(c => [...c, { name: 'شما', date: 'همین الان', text: commentText }])
    setCommentText('')
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
        <span style={{ color: 'var(--text)' }}>{article.category}</span>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 32, alignItems: 'start' }}>

          {/* MAIN ARTICLE CONTENT */}
          <article>

            {/* Article Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{
                  color: 'var(--gold)', fontWeight: 700, fontSize: 12,
                  background: 'var(--goldDim)', border: '1px solid var(--gold)',
                  borderRadius: 999, padding: '3px 13px'
                }}>{article.category}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{article.readTime} مطالعه</span>
                <span style={{ color: 'var(--faint)', fontSize: 11 }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{article.date}</span>
                <span style={{ color: 'var(--faint)', fontSize: 11 }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{article.views} بازدید</span>
              </div>

              <h1 style={{
                fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, lineHeight: 1.3,
                letterSpacing: '-0.8px', color: 'var(--text)', marginBottom: 12
              }}>
                {article.title}
              </h1>

              <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
                {article.subtitle}
              </p>

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
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{article.author}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{article.authorRole}</div>
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
                    {liked ? '❤️' : '🤍'} {reactions.like}
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
                    {saved ? '★' : '☆'} {reactions.save}
                  </button>
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)', color: 'var(--muted)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600
                  }}>
                    ↗ {reactions.share}
                  </button>
                </div>
              </div>
            </div>

            {/* Hero image */}
            <div style={{
              height: 260, borderRadius: 18, marginBottom: 28,
              background: article.heroGradient,
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

            {/* AI Summary Box */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gold)',
              borderRadius: 16, padding: 20, marginBottom: 32,
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', top: -40, left: -40,
                width: 140, height: 140, borderRadius: '50%',
                background: 'var(--gold)', opacity: 0.04
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                  background: 'linear-gradient(140deg,var(--gold2),var(--gold))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#16140f', fontWeight: 800, fontSize: 16
                }}>✦</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>خلاصه هوشمند ملک‌جت</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>AI · اطمینان {article.aiConfidence}٪</div>
                </div>
                <div style={{
                  marginRight: 'auto', fontSize: 11,
                  background: 'rgba(95,217,138,0.1)', border: '1px solid rgba(95,217,138,0.3)',
                  color: '#5fd98a', padding: '3px 10px', borderRadius: 6, fontWeight: 600
                }}>نکات کلیدی</div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {article.aiSummary.points.map((pt, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: 'var(--goldDim)', borderRadius: 10, padding: '10px 14px'
                  }}>
                    <span style={{
                      width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
                      background: 'var(--gold)', color: '#16140f',
                      fontSize: 10, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Article Body */}
            <div style={{ fontSize: 16, lineHeight: 2.1, color: 'var(--text)' }}>

              {/* Section 1 */}
              <div id="intro">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  مقدمه و نگاه کلی
                </h2>
                <p style={{ marginBottom: 18 }}>
                  بازار مسکن تهران در ماه‌های اخیر روند صعودی ملایمی را تجربه کرده است. بر اساس داده‌های جمع‌آوری‌شده از بیش از ۲۴۰ هزار آگهی فعال، میانگین قیمت در مناطق شمالی شهر با رشد حدود ۸ درصدی همراه بوده است.
                </p>
                <p style={{ marginBottom: 18 }}>
                  این روند در حالی شکل گرفته که بازار مسکن در نیمه‌ی اول سال با رکود نسبی روبرو بود. افزایش تقاضا در فصل گرما، بهبود شرایط وام مسکن و کاهش نسبی نرخ بهره از جمله عواملی هستند که این تغییر را رقم زده‌اند.
                </p>
              </div>

              {/* Highlight box */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--gold)',
                borderRadius: 14, padding: 20, margin: '24px 0',
                display: 'flex', gap: 14
              }}>
                <span style={{ color: 'var(--gold)', fontSize: 20, flexShrink: 0 }}>✦</span>
                <div style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text)' }}>
                  <b>تحلیل ملک‌جت:</b> مناطقی با دسترسی به مترو و پروژه‌های نوساز، بیشترین پتانسیل رشد ارزش را دارند. سعادت‌آباد و دروس در صدر فهرست قرار دارند.
                </div>
              </div>

              {/* Section 2 */}
              <div id="factors">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  عوامل مؤثر بر قیمت
                </h2>
                <p style={{ marginBottom: 18 }}>
                  نوسانات نرخ ارز، افزایش هزینه‌ی مصالح ساختمانی و تقاضای فصلی، سه عامل کلیدی در تعیین روند قیمت بوده‌اند. تحلیل هوش مصنوعی ملک‌جت نشان می‌دهد احتمال تداوم رشد قیمت در نیمه‌ی دوم سال حدود ۶۸٪ است.
                </p>

                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '20px 0 12px' }}>
                  ۱. نرخ ارز و تورم
                </h3>
                <p style={{ marginBottom: 16 }}>
                  همبستگی تاریخی بازار مسکن با نرخ دلار همچنان برقرار است. در دوره‌هایی که نرخ ارز بالا می‌رود، سرمایه‌گذاران به سمت ملک به عنوان پوشش در برابر تورم حرکت می‌کنند.
                </p>

                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '20px 0 12px' }}>
                  ۲. هزینه ساخت‌وساز
                </h3>
                <p style={{ marginBottom: 16 }}>
                  قیمت آهن، سیمان و دیگر مصالح ساختمانی طی یک سال گذشته به طور میانگین ۳۲٪ افزایش یافته. این موضوع به طور مستقیم قیمت واحدهای نوساز را متأثر کرده است.
                </p>

                {/* Blockquote */}
                <blockquote style={{
                  borderRight: '4px solid var(--gold)', paddingRight: 20,
                  margin: '24px 0', color: 'var(--muted)', fontStyle: 'italic',
                  fontSize: 15, lineHeight: 1.8
                }}>
                  «بازار مسکن تهران در طول تاریخ نشان داده که حتی در شرایط رکود، ارزش خود را حفظ می‌کند. این یک کلاس دارایی با ریسک نسبتاً پایین است.»
                  <footer style={{ marginTop: 8, fontSize: 12, color: 'var(--faint)', fontStyle: 'normal' }}>
                    — کارشناس ارشد بازار مسکن
                  </footer>
                </blockquote>
              </div>

              {/* Section 3 */}
              <div id="regions">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  مناطق پیشتاز
                </h2>
                <p style={{ marginBottom: 18 }}>
                  تحلیل داده‌های ملک‌جت نشان می‌دهد که مناطق ۱، ۲، ۳ و ۵ تهران بیشترین رشد را تجربه کرده‌اند. در ادامه به بررسی جزئی هر یک می‌پردازیم:
                </p>

                {/* Data cards row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, margin: '20px 0' }}>
                  {[
                    { name: 'سعادت‌آباد', growth: '+۱۲٪', price: '۱۲۷ م/متر', color: '#5fd98a' },
                    { name: 'نیاوران', growth: '+۹٪', price: '۱۸۵ م/متر', color: 'var(--gold)' },
                    { name: 'دروس', growth: '+۱۰٪', price: '۱۴۳ م/متر', color: '#5b9bd5' },
                  ].map(region => (
                    <div key={region.name} style={{
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      borderRadius: 13, padding: 16
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{region.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: region.color, marginBottom: 4 }}>{region.growth}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{region.price}</div>
                    </div>
                  ))}
                </div>

                <p style={{ marginBottom: 16 }}>
                  سعادت‌آباد با دسترسی عالی به مترو و پروژه‌های نوساز متعدد، رتبه‌ی اول را در میان مناطق جذاب برای سرمایه‌گذاری حفظ کرده است. این منطقه در ۶ ماه گذشته شاهد افتتاح دو ایستگاه جدید مترو بوده که تقاضا را به شدت افزایش داده.
                </p>

                {/* Bullet list */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 14, padding: 20, margin: '20px 0'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                    ویژگی‌های مناطق پیشتاز:
                  </div>
                  {[
                    'دسترسی مستقیم به خطوط مترو و اتوبان‌های اصلی',
                    'وجود مراکز خرید، بیمارستان و مدارس باکیفیت',
                    'پروژه‌های ساخت‌وساز نوساز با متریال مرغوب',
                    'امنیت بالا و محیط آرام و سبز',
                    'قیمت ملک در این مناطق با نرخ تاریخی رشد می‌کند',
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      marginBottom: i < 4 ? 10 : 0, fontSize: 14
                    }}>
                      <span style={{
                        color: 'var(--gold)', fontWeight: 700, fontSize: 16,
                        flexShrink: 0, lineHeight: 1.6
                      }}>·</span>
                      <span style={{ color: 'var(--text)', lineHeight: 1.7 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4 */}
              <div id="buyers">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  توصیه برای خریداران
                </h2>
                <p style={{ marginBottom: 18 }}>
                  برای خریداران، بررسی فرصت‌های پیش‌فروش با شرایط اقساطی می‌تواند راهی برای ورود به بازار با سرمایه‌ی کمتر باشد. استفاده از ابزار تحلیل قیمت ملک‌جت پیش از هر تصمیم توصیه می‌شود.
                </p>
                <p style={{ marginBottom: 18 }}>
                  چک‌لیست زیر را قبل از هر خرید ملکی بررسی کنید تا از یک تصمیم آگاهانه اطمینان حاصل کنید:
                </p>

                <div style={{ display: 'grid', gap: 10, margin: '20px 0' }}>
                  {[
                    { step: '۱', title: 'تحقیق درباره محله', desc: 'قیمت‌های منطقه، امکانات و روند رشد تاریخی را بررسی کنید' },
                    { step: '۲', title: 'بررسی سند و اسناد حقوقی', desc: 'سند رسمی را از طریق سامانه ثبت اسناد تأیید کنید' },
                    { step: '۳', title: 'کارشناسی فنی ملک', desc: 'یک کارشناس مستقل برای ارزیابی ساختار و متریال بگمارید' },
                    { step: '۴', title: 'مقایسه با نمونه‌های مشابه', desc: 'ابزار مقایسه ملک‌جت را برای سنجش قیمت عادلانه استفاده کنید' },
                  ].map(item => (
                    <div key={item.step} style={{
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      borderRadius: 12, padding: '14px 16px'
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--goldDim)', border: '1px solid var(--gold)',
                        color: 'var(--gold)', fontSize: 13, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>{item.step}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5 */}
              <div id="investors">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  فرصت‌های سرمایه‌گذاری
                </h2>
                <p style={{ marginBottom: 18 }}>
                  برای سرمایه‌گذاران، واحدهای پیش‌فروش با قرارداد رسمی و تضمین ضمانت بازگشت، جذاب‌ترین گزینه محسوب می‌شوند. با توجه به روند رشد فعلی، می‌توان انتظار داشت که ارزش ملک در طول دوره ساخت ۲۰ تا ۳۵ درصد افزایش یابد.
                </p>

                {/* Investment comparison table */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 14, overflow: 'hidden', margin: '20px 0'
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    background: 'var(--goldDim)', padding: '12px 16px',
                    borderBottom: '1px solid var(--line)'
                  }}>
                    {['نوع سرمایه‌گذاری', 'بازده انتظاری', 'ریسک'].map(h => (
                      <div key={h} style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>{h}</div>
                    ))}
                  </div>
                  {[
                    { type: 'پیش‌فروش نوساز', return: '۲۵-۳۵٪', risk: 'متوسط', riskColor: '#f59e0b' },
                    { type: 'آپارتمان آماده', return: '۸-۱۵٪', risk: 'پایین', riskColor: '#5fd98a' },
                    { type: 'زمین شهری', return: '۱۵-۲۵٪', risk: 'بالا', riskColor: '#e74c3c' },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                      padding: '12px 16px',
                      borderBottom: i < 2 ? '1px solid var(--line)' : 'none',
                      fontSize: 13.5
                    }}>
                      <div style={{ color: 'var(--text)', fontWeight: 600 }}>{row.type}</div>
                      <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{row.return}</div>
                      <div>
                        <span style={{
                          color: row.riskColor,
                          background: `${row.riskColor}18`,
                          border: `1px solid ${row.riskColor}40`,
                          padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>{row.risk}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 6 */}
              <div id="conclusion">
                <h2 style={{
                  fontSize: 22, fontWeight: 800, color: 'var(--text)',
                  margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16 }}>◆</span>
                  جمع‌بندی
                </h2>
                <p style={{ marginBottom: 18 }}>
                  در مجموع، بازار مسکن تهران در نیمه‌ی دوم ۱۴۰۵ چشم‌انداز نسبتاً مثبتی دارد. خریداران و سرمایه‌گذاران باید با دقت و بهره‌گیری از ابزارهای تحلیلی، بهترین تصمیم را برای شرایط خاص خود اتخاذ کنند.
                </p>
                <p>
                  برای دریافت تحلیل شخصی‌سازی‌شده برای ملک مورد نظرتان، از ابزار هوشمند ملک‌جت استفاده کنید.
                </p>
              </div>

            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 8, marginTop: 32, flexWrap: 'wrap' }}>
              {article.tags.map(t => (
                <span key={t} style={{
                  fontSize: 12, color: 'var(--muted)',
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 999, padding: '5px 13px', cursor: 'pointer'
                }}>#{t}</span>
              ))}
            </div>

            {/* Share bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginTop: 28,
              padding: 18, background: 'var(--surface)', borderRadius: 14,
              border: '1px solid var(--line)'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', flex: 1 }}>این مقاله را به اشتراک بگذارید:</span>
              {[
                { label: 'تلگرام', color: '#2AABEE' },
                { label: 'واتساپ', color: '#25D366' },
                { label: 'لینکدین', color: '#0077B5' },
                { label: 'کپی لینک', color: 'var(--gold)' },
              ].map(s => (
                <button key={s.label} style={{
                  padding: '7px 14px', borderRadius: 9,
                  border: `1px solid ${s.color}44`,
                  background: `${s.color}12`,
                  color: s.color, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>{s.label}</button>
              ))}
            </div>

            {/* Author bio card */}
            <div style={{
              marginTop: 32, padding: 24,
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 14, letterSpacing: 1 }}>
                درباره نویسنده
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
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{article.author}</div>
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 10 }}>{article.authorRole}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
                    {article.authorBio}
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
            <div style={{ marginTop: 48 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: '0 0 18px' }}>
                مقالات مرتبط
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {article.related.map((r, i) => (
                  <a key={i} href="/content" style={{
                    display: 'block', textDecoration: 'none',
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 15, overflow: 'hidden', transition: 'border-color 0.2s'
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--gold)'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--line)'}
                  >
                    <div style={{ height: 110, background: r.gradient, position: 'relative' }}>
                      <span style={{
                        position: 'absolute', top: 10, right: 10,
                        background: 'var(--goldDim)', border: '1px solid var(--gold)',
                        color: 'var(--gold)', fontSize: 11, fontWeight: 700,
                        padding: '2px 9px', borderRadius: 6
                      }}>{r.tag}</span>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5, marginBottom: 6 }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.readTime} مطالعه</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </article>

          {/* STICKY SIDEBAR — Table of Contents + extras */}
          <aside style={{ position: 'sticky', top: 88, display: 'grid', gap: 16 }}>

            {/* Table of Contents */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                فهرست مطالب
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {article.toc.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 9,
                      background: activeSection === item.id ? 'var(--goldDim)' : 'transparent',
                      border: `1px solid ${activeSection === item.id ? 'var(--gold)' : 'transparent'}`,
                      color: activeSection === item.id ? 'var(--gold)' : 'var(--muted)',
                      fontSize: 12.5, fontWeight: activeSection === item.id ? 700 : 400,
                      cursor: 'pointer', textAlign: 'right', transition: 'all 0.2s'
                    }}
                  >
                    <span style={{
                      fontSize: 10, width: 18, height: 18, borderRadius: 5,
                      background: activeSection === item.id ? 'var(--gold)' : 'var(--line2)',
                      color: activeSection === item.id ? '#16140f' : 'var(--faint)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontWeight: 700
                    }}>{i + 1}</span>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            {/* AI confidence card */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gold)',
              borderRadius: 16, padding: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <ScoreRing score={article.aiConfidence} size={52} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>اطمینان AI</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>بر اساس داده‌های بازار</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
                این مقاله بر پایه‌ی تحلیل ۲۴۰٬۰۰۰ آگهی فعال و ۳۶ ماه داده تاریخی تهیه شده است.
              </div>
            </div>

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
                { label: 'بازدید', value: article.views },
                { label: 'پسندیده شده', value: `${reactions.like}` },
                { label: 'ذخیره‌شده', value: `${reactions.save}` },
                { label: 'اشتراک‌گذاری', value: `${reactions.share}` },
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
