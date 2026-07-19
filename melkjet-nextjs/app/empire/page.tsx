'use client'
// Empire · «مسیرِ رشد» — سفرِ سندِ Empire Bible (جلد۲ فصل ۱–۶) مو به مو:
// معرفیِ ملک‌جت → ۵ سؤالِ شخصیتی → Dream Board → حکمِ هویتی → تولد + نام‌گذاری → هدیهٔ سرمایه →
// ۴ فرصتِ واقعی (یکی برجسته) → متن‌های خرید + امضا → «تو مالک هستی» + پاداش → تصمیمِ معنادار → داشبورد.
// قانونِ برندینگِ سند: هرگز «بازی» گفته نمی‌شود — «مسیرِ رشد / امپراتوری / سفرِ مالی».
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NeshanMap from '@/app/components/NeshanMap'
import { sfx, sfxPrefs, setSfxPrefs } from '@/app/lib/empire-sound'
// فاز ۱۵۸ (شهرِ ایزومتریکِ tycoon): توابعِ خالصِ بصری — فاز/هوا/چیدمان/پالت همه از دادهٔ واقعی
import { dayPhaseOf, weatherFxOf, streetLifeOf, cityLayoutOf, towerFloorsOf, towerPaletteOf, type DayPhase } from '@/app/lib/empire-visual'
// فاز ۱۶۳: کلاس‌بندیِ واقعیِ نوعِ ملک (همان تابعِ کانونیِ سایت) → گونهٔ بصریِ ساختمان در شهر
import { ptypeClassOf } from '@/app/lib/listing-similarity'
// فاز ۱۶۴ب: موتورِ اسپرایتِ شهر — گرافیکِ استودیوییِ CC0 (Kenney) از public/empire/sprites؛ نبودِ manifest = صحنهٔ SVG
import { pickStack, isValidManifest, type SpriteManifest, type SpriteDef, type BuildingKind } from '@/app/lib/empire-sprites'
// ☀️ فاز ۱۶۷ — زنگِ صبحگاهی: اشتراکِ پوش با اجازهٔ خودِ کاربر (force=true یعنی بپرس)
import { ensurePushSubscribed } from '@/app/lib/push-client'
import Link from 'next/link'

const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
// فاز ۷۲ (صداقتِ اعداد): «۱۸۶,۱۹۲ روز» بی‌معناست — دوامِ بالای ۳ سال یعنی خرجِ روزانه عملاً صفر
const faDays = (d: number) => d > 1095 ? 'بیش از ۳ سال (خرجِ روزانه ناچیز)' : `${fa(d)} روز`
// روزِ نسبیِ رخدادهای دنیا — «روزِ ۲۰,۶۴۵» گنگ بود؛ فاصله تا امروزِ دنیا معنا دارد
const agoFa = (evDay: number, curDay: number) => { const df = Math.max(0, curDay - evDay); return df === 0 ? 'امروز' : df === 1 ? 'دیروز' : `${fa(df)} روز پیش` }
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : n >= 1e6 ? `${fa(n / 1e6)} میلیون` : fa(n)
// ورودیِ عددی: رقم‌های فارسی/عربی → لاتین، بقیهٔ کاراکترها (نقطه/ویرگول/فاصله) حذف — تا «۲۰.۰۰۰.۰۰۰.۰۰۰» صفر نشود.
const digitsOf = (s: string) => s
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/\D/g, '').slice(0, 15)

// حصارِ خطا (فاز ۳۱): اگر رندرِ بخشی از صفحه کرش کند، به‌جای «صفحهٔ مرده که هیچ دکمه‌ای کار نمی‌کند»
// پیامِ دقیقِ خطا نشان داده می‌شود و خطا به لاگِ سرور هم می‌رود — ریشه‌یابی بدونِ کنسولِ کاربر.
class ErrorFence extends React.Component<{ children: React.ReactNode }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e).slice(0, 300) } }
  componentDidCatch(e: any) {
    try { navigator.sendBeacon?.('/api/client-log', new Blob([JSON.stringify({ msg: 'render: ' + String(e?.stack || e).slice(0, 500), url: location.href })], { type: 'application/json' })) } catch {}
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{ background: '#2a1010', border: '1px solid #a55', borderRadius: 14, padding: 16, color: '#f0c5c5', fontFamily: 'Vazirmatn, sans-serif', direction: 'rtl' as const }}>
        <b>⚠️ بخشی از صفحه به خطا خورد</b>
        <div style={{ fontSize: 11.5, marginTop: 6, direction: 'ltr' as const, textAlign: 'left' as const, opacity: .85 }}>{this.state.err}</div>
        <button onClick={() => location.reload()} style={{ marginTop: 10, padding: '7px 16px', borderRadius: 9, border: '1px solid #a55', background: 'transparent', color: '#f0c5c5', cursor: 'pointer', fontFamily: 'inherit' }}>🔄 بارگذاریِ دوباره</button>
      </div>
    )
  }
}

// شمارشِ معکوسِ ایزوله (فاز ۳۱): فقط همین کامپوننتِ کوچک هر ثانیه رندر می‌شود — نه کلِ صفحهٔ سنگین.
// (رندرِ هرثانیهٔ کلِ صفحه باعث می‌شد کلیک‌ها وسطِ بازسازیِ DOM گم شوند: «ده بار باید بزنم»)
function Countdown({ until, onDone }: { until: number; onDone?: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()))
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, until - Date.now())
      setLeft(l)
      if (l <= 0) { clearInterval(t); onDone?.() }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until])
  const p2 = (n: number) => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2 })
  // فاز ۷۲: شمارشِ چندروزه با «روز و ساعت» خوانا می‌شود؛ ساعت:دقیقه:ثانیه فقط برای زیرِ ۴۸ ساعت (هیجانِ واقعی)
  const dd = Math.floor(left / 864e5)
  if (dd >= 2) return <>{dd.toLocaleString('fa-IR')} روز و {(Math.floor(left / 36e5) % 24).toLocaleString('fa-IR')} ساعت</>
  return <>{p2(Math.floor(left / 36e5))}:{p2(Math.floor(left / 6e4) % 60)}:{p2(Math.floor(left / 1000) % 60)}</>
}

// فاز ۷۲: نوارِ زیرصفحه‌های هر تب — چیپِ فعالِ طلایی + شمارِ واقعی داخلِ پرانتز (نه عددِ ساختگی)
function subNav(items: Array<[string, string, string, number?]>, cur: string, set: (k: any) => void) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '2px 0 2px' }}>
      {items.map(([k, ic, l, cnt]) => (
        <button key={k} onClick={() => { set(k); try { window.scrollTo({ top: 0 }) } catch {} }}
          style={{ fontSize: 11.5, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontWeight: cur === k ? 800 : 500, border: `2px solid ${cur === k ? 'rgba(212,175,55,.55)' : 'rgba(255,255,255,.1)'}`, background: cur === k ? 'linear-gradient(180deg,rgba(255,215,106,.28),rgba(212,175,55,.12))' : 'rgba(255,255,255,.04)', color: cur === k ? '#ffe9a3' : 'var(--muted)', boxShadow: cur === k ? '0 2px 0 rgba(90,60,10,.5)' : '0 2px 0 rgba(5,3,20,.35)' }}>
          {ic} {l}{typeof cnt === 'number' && cnt > 0 ? ` (${fa(cnt)})` : ''}
        </button>
      ))}
    </div>
  )
}

type Opp = { id: string; title: string; hood: string; price: number; priceStr: string; image: string; area: number; rooms: number; ptype: string; kind: string; recommended: boolean; reason: string; locked?: boolean; why?: string[] }
type St = any

// 🎨 پوستهٔ «پروتوتایپِ کامل» (فایلِ طراحیِ کاربر): کارتِ شیشه‌ای، طلاییِ سه‌درجه، قرص‌ها، فونتِ سِریفِ نمایشی.
// فقط ظاهر — هیچ منطقی اینجا نیست.
const DISPLAY = "'Markazi Text', Vazirmatn, serif"   // اگر فونت نبود، به Vazirmatn برمی‌گردد
// 🎮 فاز ۱۶۳ — «پنلِ بازیِ» مشترکِ کلِ امپراتوری: پرکنندهٔ بنفشِ تیرهٔ گرادیانی، خطِ دورِ ۲px، لبهٔ پایینیِ برجسته
const card: React.CSSProperties = { background: 'linear-gradient(180deg, rgba(44,34,92,.5), rgba(20,15,50,.55))', border: '2px solid rgba(255,255,255,.10)', borderRadius: 20, padding: 16, boxShadow: '0 3px 0 rgba(5,3,20,.5), 0 12px 28px -14px rgba(0,0,0,.55)' }
// دکمهٔ طلاییِ chunky (سبکِ موبایل‌گیم): گرادیانِ پر، دورخطِ تیره، بِوِلِ پایین
const btn: React.CSSProperties = { background: 'linear-gradient(180deg,#ffe085,#d4af37)', color: '#1a1503', border: '2px solid rgba(90,60,10,.55)', borderRadius: 14, padding: '10px 18px', fontWeight: 900, cursor: 'pointer', fontSize: 14, boxShadow: '0 3px 0 #8a6d1f, 0 8px 20px rgba(212,175,55,.28)' }
const btnGhost: React.CSSProperties = { background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03))', color: 'var(--text)', border: '2px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '9px 17px', cursor: 'pointer', fontSize: 13.5, boxShadow: '0 2px 0 rgba(5,3,20,.45)' }
const chip = (on: boolean): React.CSSProperties => ({ padding: '9px 16px', borderRadius: 99, border: `2px solid ${on ? 'rgba(212,175,55,.55)' : 'rgba(255,255,255,.12)'}`, background: on ? 'linear-gradient(180deg,rgba(255,215,106,.26),rgba(212,175,55,.1))' : 'rgba(255,255,255,.04)', color: on ? '#ffe9a3' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: on ? 800 : 400, boxShadow: on ? '0 2px 0 rgba(90,60,10,.5)' : '0 2px 0 rgba(5,3,20,.35)' })

// 🎮 فاز ۱۶۰ — پوستهٔ tycoon برای بقیهٔ تب‌ها (فقط ظاهر — صفر منطق):
// سربرگِ بخش با چیپِ رنگی، چیپِ پاداش، مربعِ آیکنِ رنگی، چیپِ وضعیت، نوارِ پیشرفتِ کلفت. رنگ‌ها همیشه hex.
const qSection = (icon: string, label: string, color: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 2px -6px' }}>
    <span style={{ fontSize: 10.5, fontWeight: 800, color, border: `1px solid ${color}55`, background: `${color}14`, borderRadius: 999, padding: '3px 11px', whiteSpace: 'nowrap' }}>{icon} {label}</span>
    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
  </div>
)
const rewardChip: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, color: '#ffd76a', background: 'rgba(255,215,106,.1)', border: '1px solid rgba(255,215,106,.35)', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }
const iconSq = (color: string): React.CSSProperties => ({ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(145deg, ${color}33, ${color}0f)`, border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' })
const tagChip = (color: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, border: `1px solid ${color}55`, color, background: `${color}14`, whiteSpace: 'nowrap' })
const statTile: React.CSSProperties = { ...card, textAlign: 'center', padding: '14px 10px', background: 'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07), 0 8px 24px -12px rgba(0,0,0,.5)' }
const qBar = (progress: number, target: number, done: boolean) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
    <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.4)' }}>
      <div style={{ width: `${Math.min(100, (progress / Math.max(1, target)) * 100)}%`, height: '100%', borderRadius: 99, background: done ? 'linear-gradient(90deg,#5fd98a,#2f9e46)' : 'linear-gradient(90deg,#ffd76a,#ff9d2e)', boxShadow: done ? '0 0 8px rgba(95,217,138,.5)' : '0 0 8px rgba(255,183,77,.5)', transition: 'width .6s ease' }} />
    </div>
    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fa(progress)} از {fa(target)}</span>
  </div>
)
// قرصِ منابعِ HUD (فاز ۱۵۸ — tycoon): چیپِ گردِ براق با گرادیانِ داخلیِ ظریف — طلایی برای کوین
const pill = (gold = false): React.CSSProperties => ({ fontSize: 11, padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, background: (gold ? 'linear-gradient(180deg,rgba(255,215,106,.24),rgba(212,175,55,.08))' : 'linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.03))') + ', linear-gradient(rgba(12,10,34,.8),rgba(12,10,34,.8))', border: `1px solid ${gold ? 'rgba(212,175,55,.5)' : 'rgba(255,255,255,.16)'}`, color: gold ? '#f0d47a' : 'var(--text)', fontWeight: gold ? 700 : 500, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' })

// ملک‌جت — دستیارِ هوشمندِ همراه؛ گفت‌وگوها متنِ قطعیِ سند است.
// شمارشِ متحرکِ اعداد (جلد ۵۶ «پول فقط عدد نیست») — تغییرِ ارزش دیده می‌شود، نه فقط جایگزین.
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [v, setV] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current, to = value
    prev.current = value
    if (from === to) return
    const t0 = performance.now(), dur = 900
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setV(from + (to - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(Math.round(v))}</>
}

// جشنِ موفقیت (جلد ۵۶ «Achievement فقط Badge نیست») — پاشِشِ لحظه‌ای، بدونِ کتابخانه، موقعیت‌ها قطعی از ایندکس.
function Burst({ seed }: { seed: number }) {
  if (!seed) return null
  const N = 14
  return (
    <div key={seed} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2
        const r = 90 + (i % 4) * 36
        return (
          <span key={i} style={{ position: 'absolute', left: '50%', top: '38%', fontSize: 15 + (i % 3) * 7, ['--dx' as any]: `${Math.round(Math.cos(a) * r)}px`, ['--dy' as any]: `${Math.round(Math.sin(a) * r + 50)}px`, animation: 'empBurst .95s ease-out forwards' }}>
            {['✨', '🪙', '⚡', '🎉'][i % 4]}
          </span>
        )
      })}
    </div>
  )
}

function MJ({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),#8a6d1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✨</div>
      <div style={{ ...card, background: 'var(--bg2)', flex: 1, fontSize: 14, lineHeight: 2 }}>{children}</div>
    </div>
  )
}

// 🧮 فاز ۱۶۲ — هشِ قطعی از شناسهٔ واقعیِ دارایی: الگوی پنجره‌های روشن را بدونِ هیچ تصادفی تعیین می‌کند
const seedOf = (id: any) => { const s = String(id ?? ''); let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

// 🏘 فاز ۱۶۳ — گونهٔ بصریِ ساختمان از دادهٔ واقعیِ همان دارایی (kind ذخیره‌شده + کلاس‌بندیِ کانونیِ عنوان)
type BKind = 'apt' | 'shop' | 'villa' | 'office'
const bkindOf = (a: any): BKind => {
  const p = ptypeClassOf(a?.ptype || a?.title)
  if (a?.kind === 'villa' || p === 'villa') return 'villa'
  if (a?.kind === 'commercial' || p === 'shop') return 'shop'
  if (p === 'office' || p === 'industrial') return 'office'
  return 'apt'
}

// 🏙 فاز ۱۶۳ — BuildingSvg: هنرِ ساختمانِ ایزومتریک به سبکِ سیتی‌بیلدرهای بزرگ (صفر تصویر، SVG درون‌خطی).
// چهار گونه از دادهٔ واقعی: آپارتمان (بالکن‌دار)، مغازه (سایه‌بانِ راه‌راه + تابلوی نورانی)، ویلا (بامِ شیروانیِ
// دوپرده + پرچینِ حیاط)، اداری (نمای شیشه‌ای با مولیون و بازتابِ آسمان). نورِ ثابت از بالا-چپ: وجهِ چپ روشن،
// راست تیره، نوارِ AO پای دیوار، رینگ‌لایتِ لبهٔ بام. نگینِ پرتفوی = LANDMARK (اسپایر + قابِ طلایی).
// همهٔ الگوها (پنجرهٔ روشن/خاموش و…) قطعی از هشِ شناسهٔ واقعیِ دارایی — هیچ Math.random.
function BuildingSvg({ w, floors, fh, pal, seed, building, kind, landmark }: {
  w: number; floors: number; fh: number
  pal: { top: string; left: string; right: string; win: string }
  seed: number; building: boolean; kind: BKind; landmark: boolean
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const H = floors * fh, half = w / 2, qh = w / 4
  const hTot = H + w / 2
  const cols = w >= 46 ? 3 : 2
  const faceL = `0,${qh} ${half},${w / 2} ${half},${w / 2 + H} 0,${qh + H}`
  const faceR = `${half},${w / 2} ${w},${qh} ${w},${qh + H} ${half},${w / 2 + H}`
  const roof = `${half},0 ${w},${qh} ${half},${w / 2} 0,${qh}`
  const office = kind === 'office'
  // شبکهٔ پنجره (برای غیرِ اداری): سطر = طبقهٔ واقعی؛ روشن/خاموش قطعی از هش
  const wins: React.ReactNode[] = []
  if (!office) for (let face = 0; face < 2; face++) {
    const step = (half - 6) / cols
    const ww = step * 0.56, wh = fh * 0.4
    for (let r = 0; r < floors; r++) for (let ci = 0; ci < cols; ci++) {
      const k = face * 64 + r * cols + ci
      const on = ((seed + k * 2654435761) >>> 0) % 5 < 3
      const wx = 3 + ci * step + (face ? half : 0) + (step - ww) / 2
      const slope = face ? -0.5 : 0.5
      const yEdge = face ? w / 2 - (wx - half) * 0.5 : qh + wx * 0.5
      const y0 = yEdge + r * fh + fh * 0.3
      wins.push(<polygon key={k} points={`${wx},${y0} ${wx + ww},${y0 + ww * slope} ${wx + ww},${y0 + ww * slope + wh} ${wx},${y0 + wh}`}
        fill={on ? (((seed >> (k % 13)) & 3) === 0 ? '#fff3c4' : pal.win) : 'rgba(10,14,30,.5)'} stroke="rgba(0,0,0,.28)" strokeWidth=".5" opacity={on ? .95 : .8} />)
    }
  }
  // مولیون‌های عمودیِ نمای شیشه‌ای (اداری)
  const mullions: React.ReactNode[] = []
  if (office) {
    for (let mx = 4; mx < half; mx += 5.5) {
      mullions.push(<line key={'l' + mx} x1={mx} y1={qh + mx * 0.5 + 1} x2={mx} y2={qh + mx * 0.5 + H} stroke="rgba(255,255,255,.28)" strokeWidth=".8" />)
      const rx2 = half + mx
      mullions.push(<line key={'r' + mx} x1={rx2} y1={w / 2 - mx * 0.5 + 1} x2={rx2} y2={w / 2 - mx * 0.5 + H} stroke="rgba(255,255,255,.16)" strokeWidth=".8" />)
    }
  }
  // بالکن‌های آپارتمان: هر طبقه یک تیغهٔ بیرون‌زده روی وجهِ چپ (نما)
  const balconies: React.ReactNode[] = []
  if (kind === 'apt') for (let f = 0; f < floors; f++) {
    const yB = f * fh + fh * 0.86
    balconies.push(<polygon key={'b' + f} points={`-2.5,${qh + yB - 1.2} ${half - 1},${w / 2 + yB - 1.2} ${half - 1},${w / 2 + yB + 1.6} -2.5,${qh + yB + 1.6}`} fill="rgba(255,255,255,.42)" stroke="rgba(0,0,0,.2)" strokeWidth=".4" />)
  }
  const groundY = fh * (floors - 1)  // ترازِ طبقهٔ همکف برای سایه‌بان/تابلو
  return (
    <svg width={w} height={hTot} viewBox={`0 0 ${w} ${hTot}`} style={{ position: 'absolute', inset: 0, display: 'block', overflow: 'visible', filter: 'saturate(1.18)' }} aria-hidden>
      <defs>
        <linearGradient id={uid + 'L'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".24" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>
        <linearGradient id={uid + 'R'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".22" /><stop offset="1" stopColor="#000" stopOpacity=".44" /></linearGradient>
        <linearGradient id={uid + 'G'} x1="0" y1="0" x2="1" y2=".7"><stop offset="0" stopColor="#fff" stopOpacity=".6" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id={uid + 'AO'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".4" /></linearGradient>
        <linearGradient id={uid + 'GL'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8e2f2" /><stop offset="1" stopColor="#4a7fae" /></linearGradient>
        <linearGradient id={uid + 'GR'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6f9cc4" /><stop offset="1" stopColor="#28496b" /></linearGradient>
        <pattern id={uid + 'S'} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.5" height="9" fill="rgba(235,190,80,.4)" /></pattern>
        <pattern id={uid + 'AW'} width="8" height="6" patternUnits="userSpaceOnUse"><rect width="8" height="6" fill="#e8e4d8" /><rect width="4" height="6" fill="#e5533d" /></pattern>
        <clipPath id={uid + 'CL'}><polygon points={faceL} /></clipPath>
        <clipPath id={uid + 'CR'}><polygon points={faceR} /></clipPath>
      </defs>
      {/* وجه‌ها — نورِ ثابتِ بالا-چپ: چپ روشن، راست در سایه؛ اداری = شیشهٔ بازتابی + تِینتِ پالتِ واقعی */}
      <polygon points={faceL} fill={office ? `url(#${uid}GL)` : pal.left} />
      {office && <polygon points={faceL} fill={pal.left} opacity=".22" />}
      <polygon points={faceL} fill={`url(#${uid}L)`} />
      <polygon points={faceR} fill={office ? `url(#${uid}GR)` : pal.right} />
      {office && <polygon points={faceR} fill={pal.right} opacity=".22" />}
      <polygon points={faceR} fill={`url(#${uid}R)`} />
      {/* بازتابِ موربِ آسمان روی شیشه (اداری) */}
      {office && <g>
        <polygon clipPath={`url(#${uid}CL)`} points={`-2,${qh + H * 0.3} ${half + 2},${w / 2 + H * 0.06} ${half + 2},${w / 2 + H * 0.2} -2,${qh + H * 0.46}`} fill="#fff" opacity=".3" />
        <polygon clipPath={`url(#${uid}CR)`} points={`${half - 2},${w / 2 + H * 0.5} ${w + 2},${qh + H * 0.28} ${w + 2},${qh + H * 0.38} ${half - 2},${w / 2 + H * 0.62}`} fill="#fff" opacity=".16" />
      </g>}
      {/* خطوطِ باریکِ تفکیکِ طبقات */}
      {Array.from({ length: Math.max(0, floors - 1) }, (_, f) => <g key={f} stroke={office ? 'rgba(20,40,70,.3)' : 'rgba(0,0,0,.16)'} strokeWidth="1">
        <line x1={0} y1={qh + (f + 1) * fh} x2={half} y2={w / 2 + (f + 1) * fh} />
        <line x1={half} y1={w / 2 + (f + 1) * fh} x2={w} y2={qh + (f + 1) * fh} />
      </g>)}
      {wins}
      {mullions}
      {balconies}
      {/* سایه‌بانِ راه‌راه + تابلوی نورانیِ مغازه — روی طبقهٔ همکفِ واقعی */}
      {kind === 'shop' && <g>
        <polygon points={`-3,${qh + groundY + fh * 0.34} ${half + 1},${w / 2 + groundY + fh * 0.34} ${half + 1},${w / 2 + groundY + fh * 0.34 + 5} -3,${qh + groundY + fh * 0.34 + 5}`} fill={`url(#${uid}AW)`} stroke="rgba(0,0,0,.3)" strokeWidth=".5" />
        <polygon points={`${half + 4},${w / 2 + groundY - (4 - half) * 0 + fh * 0.18 - 2} ${half + 4 + 12},${w / 2 + groundY + fh * 0.18 - 8} ${half + 4 + 12},${w / 2 + groundY + fh * 0.18 - 2} ${half + 4},${w / 2 + groundY + fh * 0.18 + 4}`} fill={pal.win} stroke="#1c2237" strokeWidth="1" opacity=".95" style={{ filter: `drop-shadow(0 0 4px ${pal.win})` }} />
      </g>}
      {/* AO — نوارِ تیرهٔ پای دیوار (تماس با زمین) */}
      <polygon points={`0,${qh + H - 7} ${half},${w / 2 + H - 7} ${half},${w / 2 + H} 0,${qh + H}`} fill={`url(#${uid}AO)`} />
      <polygon points={`${half},${w / 2 + H - 7} ${w},${qh + H - 7} ${w},${qh + H} ${half},${w / 2 + H}`} fill={`url(#${uid}AO)`} />
      {/* بام */}
      {kind === 'villa' ? <g>
        {/* شیروانیِ دوپرده + خطِ تیزه + دودکش */}
        <polygon points={`${half},0 ${w},${qh} 0,${qh}`} fill="#d9694f" />
        <polygon points={`0,${qh} ${w},${qh} ${half},${w / 2}`} fill="#a84a36" />
        <line x1={0} y1={qh} x2={w} y2={qh} stroke="#f0b9a4" strokeWidth="1.2" />
        <rect x={half * 1.22} y={qh * 0.34} width={4} height={7} fill="#8a5a40" stroke="rgba(0,0,0,.25)" strokeWidth=".5" />
        {/* پرچینِ حیاط + درختچه — پای دیوارِ نما */}
        {Array.from({ length: 5 }, (_, k) => <rect key={k} x={-5 + k * (half / 5.2)} y={qh + H + (-5 + k * (half / 5.2)) * 0.5 - 5.5} width={1.7} height={5.5} fill="#efe9db" stroke="rgba(0,0,0,.2)" strokeWidth=".3" />)}
        <circle cx={w - 3} cy={qh + H - 4} r={4.4} fill="#2f9e46" />
        <circle cx={w - 4.6} cy={qh + H - 5.8} r={2.6} fill="#5ecf6d" />
      </g> : <g>
        <polygon points={roof} fill={pal.top} />
        <polygon points={roof} fill={`url(#${uid}G)`} />
        {/* رینگ‌لایتِ لبهٔ بام (نور از بالا-چپ) */}
        <polyline points={`0,${qh} ${half},0 ${w},${qh}`} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" />
        <polyline points={`0,${qh} ${half},${w / 2} ${w},${qh}`} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="1" />
        {!office && !landmark && <>
          <polygon points={`${half * 1.18},${qh * 0.72} ${half * 1.18 + 7},${qh * 0.72 + 3.5} ${half * 1.18},${qh * 0.72 + 7} ${half * 1.18 - 7},${qh * 0.72 + 3.5}`} fill="rgba(25,30,55,.8)" />
          <polygon points={`${half * 0.72},${qh * 1.05} ${half * 0.72 + 5},${qh * 1.05 + 2.5} ${half * 0.72},${qh * 1.05 + 5} ${half * 0.72 - 5},${qh * 1.05 + 2.5}`} fill="rgba(255,255,255,.3)" />
        </>}
      </g>}
      {/* LANDMARK — نگینِ پرتفوی: اسپایرِ بام + قابِ طلایی */}
      {landmark && <g>
        <polygon points={roof} fill="none" stroke="#ffd76a" strokeWidth="1.6" />
        <line x1={half} y1={qh - 2} x2={half} y2={-13} stroke="#ffd76a" strokeWidth="1.6" />
        <polygon points={`${half},-16 ${half - 3},${-6} ${half + 3},${-6}`} fill="#ffd76a" style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,106,.8))' }} />
        <circle cx={half} cy={-16.5} r={1.8} fill="#fff3c4" />
      </g>}
      {/* داربستِ کارگاه — فقط وقتی واقعاً در حالِ ساخت است */}
      {building && <>
        <polygon points={faceL} fill={`url(#${uid}S)`} />
        <polygon points={faceR} fill={`url(#${uid}S)`} />
        {kind !== 'villa' && <polygon points={roof} fill={`url(#${uid}S)`} />}
      </>}
    </svg>
  )
}

// 🛣 فاز ۱۶۳ — GroundSvg: زمینِ محله به سبکِ سیتی‌بیلدر — قواره‌های بالاآمده با حاشیهٔ پیاده‌رو، خیابان‌های
// آسفالتِ میانِ قواره‌ها با خط‌کشیِ وسطِ منقطع. یک SVG در صفحهٔ زمین (قبل از چرخشِ ایزو).
function GroundSvg({ G, n }: { G: number; n: number }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const cell = G / n, rw = Math.max(10, cell * 0.24), pad = cell - rw
  const cells: React.ReactNode[] = []
  for (let ci = 0; ci < n; ci++) for (let ri = 0; ri < n; ri++) {
    const x0 = ci * cell + rw / 2, y0 = ri * cell + rw / 2
    cells.push(<g key={ci + '_' + ri}>
      <rect x={x0} y={y0} width={pad} height={pad} rx={3.5} fill="#c3c8d2" />
      <rect x={x0 + 1} y={y0 + 1} width={pad - 2} height={pad - 2} rx={3} fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <rect x={x0 + 3} y={y0 + 3} width={pad - 6} height={pad - 6} rx={2.5} fill={`url(#${uid}g)`} />
    </g>)
  }
  const dashes: React.ReactNode[] = []
  for (let m = 1; m < n; m++) {
    dashes.push(<line key={'v' + m} x1={m * cell} y1={2} x2={m * cell} y2={G - 2} stroke="rgba(255,255,255,.65)" strokeWidth={1.6} strokeDasharray="7 8" />)
    dashes.push(<line key={'h' + m} x1={2} y1={m * cell} x2={G - 2} y2={m * cell} stroke="rgba(255,255,255,.65)" strokeWidth={1.6} strokeDasharray="7 8" />)
  }
  return (
    <svg width={G} height={G} viewBox={`0 0 ${G} ${G}`} aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id={uid + 'g'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#58c96e" /><stop offset="1" stopColor="#2f9e46" /></linearGradient>
        <linearGradient id={uid + 'a'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4d5361" /><stop offset="1" stopColor="#383e4b" /></linearGradient>
      </defs>
      <rect x={0} y={0} width={G} height={G} rx={8} fill={`url(#${uid}a)`} />
      {cells}
      {dashes}
    </svg>
  )
}

// 🚗 فاز ۱۶۳ — خودروی SVG ایزو (شیبِ ۲:۱) — روی خودِ خیابان‌ها حرکت می‌کند؛ dir آینه‌اش می‌کند
function CarSvg({ dir, tone }: { dir: 1 | -1; tone: string }) {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden style={{ display: 'block', transform: dir === -1 ? 'scaleX(-1)' : undefined }}>
      <ellipse cx="12" cy="13.4" rx="9" ry="2" fill="rgba(0,0,0,.3)" />
      <polygon points="2,9 12,4 22,9 12,14" fill={tone} />
      <polygon points="2,9 12,4 12,7 2,12" fill="rgba(255,255,255,.28)" />
      <polygon points="6.5,7.6 11,5.3 15.5,7.6 11,9.9" fill="#cfe8ff" stroke="rgba(0,0,0,.25)" strokeWidth=".5" />
      <circle cx="7" cy="12" r="1.5" fill="#1a1d28" />
      <circle cx="16.5" cy="12.4" r="1.5" fill="#1a1d28" />
    </svg>
  )
}

// ⛲/🪧 فاز ۱۶۳ — پراپ‌های قطعیِ قواره‌های خالی: فواره و بیلبورد (SVG، صفر ادعای داده)
function FountainSvg() {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden style={{ display: 'block' }}>
      <ellipse cx="13" cy="19.5" rx="10" ry="2.2" fill="rgba(0,0,0,.22)" />
      <ellipse cx="13" cy="17" rx="9" ry="3.4" fill="#b9bec9" />
      <ellipse cx="13" cy="16.2" rx="7" ry="2.5" fill="#57c2ff" />
      <rect x="12.2" y="9" width="1.8" height="7" fill="#98a0ad" />
      <ellipse cx="13" cy="9" rx="3.4" ry="1.3" fill="#b9bec9" />
      <circle cx="13" cy="6" r="1.3" fill="#cfeeff" />
      <circle cx="10.8" cy="7.4" r=".8" fill="#cfeeff" opacity=".8" />
      <circle cx="15.2" cy="7.4" r=".8" fill="#cfeeff" opacity=".8" />
    </svg>
  )
}
function BillboardSvg({ win }: { win: string }) {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" aria-hidden style={{ display: 'block' }}>
      <ellipse cx="15" cy="24" rx="8" ry="1.8" fill="rgba(0,0,0,.22)" />
      <rect x="11.5" y="12" width="1.5" height="12" fill="#5b6270" />
      <rect x="17" y="12" width="1.5" height="12" fill="#5b6270" />
      <rect x="3" y="2" width="24" height="11" rx="2" fill="#232a3d" stroke="#5b6270" strokeWidth="1" />
      <rect x="5" y="4" width="20" height="7" rx="1" fill={win} opacity=".92" style={{ filter: `drop-shadow(0 0 4px ${win})` }} />
    </svg>
  )
}

// 🌆 فاز ۱۶۳ — سیلوئتِ خطِ آسمانِ دوردست (دو ردیفِ محو) — عمقِ صحنه؛ ارتفاع‌ها آرایهٔ ثابتِ قطعی
function SkylineSvg({ w, h, fill, o }: { w: number; h: number; fill: string; o: number }) {
  const bars = [12, 20, 9, 16, 24, 11, 18, 8, 15, 22, 10, 17, 13, 21]
  const bw2 = 200 / bars.length
  return (
    <svg width={w} height={h} viewBox="0 0 200 28" preserveAspectRatio="none" aria-hidden style={{ display: 'block', opacity: o }}>
      {bars.map((b, i) => <g key={i}>
        <rect x={i * bw2 + 0.8} y={28 - b} width={bw2 - 1.6} height={b} fill={fill} rx="1" />
        {b > 14 && <rect x={i * bw2 + bw2 / 2 - 0.5} y={28 - b - 3} width="1" height="3" fill={fill} />}
      </g>)}
    </svg>
  )
}

// 🌳 فاز ۱۶۲ — درختِ SVG (تنه + تاجِ دوپرده + سایه) — صرفاً دکورِ قطعیِ زمین، جای همان ایموجی
function TreeSvg({ s, big }: { s: number; big?: boolean }) {
  return (
    <svg width={18 * s} height={22 * s} viewBox="0 0 18 22" aria-hidden style={{ display: 'block' }}>
      <ellipse cx="9" cy="20.6" rx="6.4" ry="1.5" fill="rgba(0,0,0,.24)" />
      <rect x="8.1" y="12" width="1.8" height="8" rx=".9" fill="#7a4f2a" />
      <circle cx="9" cy="8.6" r={big ? 6.4 : 5.4} fill="#2f9e46" />
      <circle cx="6.6" cy="6.6" r={big ? 3.8 : 3.1} fill="#5ecf6d" />
    </svg>
  )
}

// 🎉 فاز ۱۶۲ — جشنِ یک‌بارهٔ دریافتِ جایزه در نمای شهر: کانفتیِ CSS + سه سکهٔ پرنده به‌سمتِ HUD +
// توستِ «+N سکه» (N = پاداشِ واقعیِ همان ادعا؛ صفر = بدونِ توست). ~۱.۲ثانیه؛ reduced-motion همه را خاموش می‌کند.
function CityCelebration({ seed, coins }: { seed: number; coins: number }) {
  if (!seed) return null
  return (
    <div key={seed} aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 70 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="empConf" style={{ position: 'absolute', top: -14, left: `${(8 + i * 83) % 92}%`, width: 7, height: 11, borderRadius: 2, opacity: 0, background: ['#ffd76a', '#ff9d2e', '#7d6ef0', '#5fd98a', '#ff5f4d'][i % 5], animationDelay: `${(i % 6) * 90}ms`, transform: `rotate(${(i * 47) % 360}deg)` }} />
      ))}
      {[0, 1, 2].map(i => (
        <span key={'c' + i} className="empCoinFly" style={{ position: 'absolute', bottom: 170, left: '50%', fontSize: 18, opacity: 0, animationDelay: `${i * 120}ms` }}>🪙</span>
      ))}
      {coins > 0 && <div className="empCoinToast" style={{ position: 'fixed', top: 116, left: '50%', transform: 'translateX(-50%)', opacity: 0, background: 'rgba(12,10,34,.88)', border: '1px solid rgba(255,215,106,.6)', color: '#ffd76a', fontWeight: 900, fontSize: 14, borderRadius: 999, padding: '6px 16px', boxShadow: '0 6px 20px rgba(255,215,106,.35)' }}>+{fa(coins)} سکه</div>}
    </div>
  )
}

// 🏙 فاز ۱۵۸→۱۵۹ — IsoCity «تمام‌صفحه»: کلِ صفحه صحنهٔ شهرِ ایزومتریکِ زنده است (سبکِ tycoon) — CSS خالص، صفر تصویر.
// بازیکن، آسمان = ساعتِ واقعی، جلوه = هوای واقعیِ Open-Meteo، شلوغیِ خیابان = شمارِ دارایی‌ها. هیچ عددِ ساختگی.
// سبزینهٔ حاشیه صرفاً تزئینی و قطعی است (خانه‌های خالیِ همان مارپیچِ چیدمان) — هیچ ادعای داده‌ای ندارد.
function IsoCity({ assets, wx, visual, onTower, bubbleOf, civic, civicHint }: {
  assets: any[]; wx: any; visual: any
  onTower?: (a: any) => void
  bubbleOf?: (a: any) => { icon: string; bounce?: boolean; title: string; onClick: () => void } | null
  // فاز ۱۶۵ — بناهای مدنیِ ناوبری روی نقشه (تالارِ شهر/بازارِ شهر/تالارِ افتخار): ok=false → قفل با چیپِ سطح
  civic?: Array<{ key: string; icon: string; label: string; need: number; ok: boolean; onOpen: () => void }>
  civicHint?: boolean
}) {
  const vis = visual || {}
  // 🖼 فاز ۱۶۴ب — حالتِ اسپرایت: manifest یک‌بار می‌آید و اعتبارسنجی می‌شود؛ نبود/خرابی = صحنهٔ SVG بدونِ هیچ تغییری
  const [man, setMan] = React.useState<SpriteManifest | null>(null)
  React.useEffect(() => {
    let dead = false
    fetch('/empire/sprites/manifest.json').then(r => (r.ok ? r.json() : null)).then(j => { if (!dead && isValidManifest(j) && j.geo && j.stacks) setMan(j) }).catch(() => {})
    return () => { dead = true }
  }, [])
  const phase: DayPhase = vis.dayNight === false ? 'night' : dayPhaseOf(new Date().getHours())
  // فاز ۱۶۳: آسمانِ چندپرده با باندِ گرمِ افق — به سبکِ سیتی‌بیلدرهای بزرگ
  const sky: Record<DayPhase, string> = {
    dawn: 'linear-gradient(180deg,#2e2a63 0%,#b3589e 45%,#ff9a6b 74%,#ffd9a8 100%)',
    day: 'linear-gradient(180deg,#2f9df0 0%,#66c1f5 48%,#a9e0f9 76%,#ffe9c4 100%)',
    dusk: 'linear-gradient(180deg,#3a2f77 0%,#8a4ab0 45%,#ff7e5f 78%,#ffc98e 100%)',
    night: 'linear-gradient(180deg,#151238 0%,#241a4a 52%,#3d2a6d 82%,#4a3560 100%)',
  }
  const skyIcon = phase === 'day' ? '☀️' : phase === 'dawn' ? '🌅' : phase === 'dusk' ? '🌇' : '🌙'
  const fx = vis.weatherFx === false ? null : weatherFxOf(wx?.icon)
  const clouds = vis.weatherFx !== false && wx && ['☁️', '🌤', '⛈', '🌧'].includes(wx.icon)
  const cars = vis.streetLife === false ? 0 : streetLifeOf(assets.length)
  // ارزشِ روزِ واقعی؛ بی‌داده = ۰ → برجِ یک‌طبقه بدونِ برچسب (هیچ عددِ ساختگی/NaN روی صحنه نمی‌آید)
  const vals = assets.map((a: any) => Number(a.current ?? a.buyPrice) || 0)
  const max = Math.max(1, ...vals)
  // فاز ۱۶۳ (شلوغی‌زدایی): برچسبِ ارزش فقط برای ۲ داراییِ باارزش‌تر همیشه روشن است؛ بقیه با hover/لمس
  const labelIdx = new Set(vals.map((v, i) => [v, i] as const).sort((p, q) => q[0] - p[0]).slice(0, 2).map(p => p[1]))
  // فاز ۱۶۶ — قابِ پر و تراکم: شبکهٔ حداقل ۷×۷ قواره؛ خانهٔ هر دارایی همچنان قطعی و پایدار (مارپیچ از مرکز).
  // قواره‌های خالی «محتوای محیطیِ» قطعی می‌گیرند (پایین‌تر) — شهرِ پر، نه شطرنجیِ خالی.
  const usedN = assets.length + 4 + (civic?.length || 0)
  const { gridN, spots } = cityLayoutOf(Math.max(37, usedN))     // ≥۸×۸ قواره — spotهای سرریز استفاده نمی‌شوند
  // فاز ۱۶۳: قوارهٔ بزرگ‌تر — هر خانه = قواره + خیابانِ میانی؛ محله واقعی می‌شود
  const tile = Math.max(48, Math.min(88, Math.floor(470 / gridN)))
  const c = Math.floor(gridN / 2)
  const groundW = Math.round(gridN * tile * 0.72)                    // ضلعِ مربعِ زمین — بعد از چرخشِ ایزو ≈ الماسِ gridN×tile
  // فاز ۱۶۴ب→۱۶۶ — دنیای اسپرایت: بلوک‌های ۲×۲ قواره + خیابان هر «سه» خط (دورهٔ ۳) — به‌جای شطرنجیِ ۷۵٪ آسفالت؛
  // «دوربینِ نزدیک»: ساختمانِ ۴طبقه ≈ ۲۴۰px روی دسکتاپ — زمین از لبه‌های صحنه بیرون می‌زند، جزیرهٔ شناور نداریم.
  const sprite = !!man
  const wOf = (p: number) => p + (p >> 1)                            // قوارهٔ p → خانهٔ دنیا (خیابان‌ها در w≡2 mod 3)
  const pOf = (w: number) => w - Math.floor((w + 1) / 3)             // خانهٔ دنیای غیرخیابان → شمارهٔ قواره
  const M = wOf(gridN - 1) + 1
  const kSp = Math.min(0.78, 9.4 / M)                               // شهرِ خیلی بزرگ → کمی عقب‌تر؛ سقفِ نیم‌ارتفاع ثابت می‌ماند
  const yMidSp = M * 33 * kSp                                        // مرکزِ عمودیِ دنیای اسپرایت برای سنترشدن روی لنگر
  const gHalfH = sprite ? Math.round(M * 33 * kSp) : Math.round(gridN * tile * 0.255)   // نیم‌ارتفاعِ شهر — برای افق/اسکای‌لاین
  const cx = 0, cy = 0                                               // مختصات حولِ لنگرِ صحنه (empIsoAnchor پایینِ صفحه)
  // فاز ۱۶۶ — محتوای محیطیِ قطعی برای قواره‌های خالی: ~۵۵٪ ساختمانِ کوچکِ کم‌رنگ (صرفاً صحنه‌آرایی، بدونِ برچسب/لمس)،
  // بقیه پارک/درخت. چیدمان از هَشِ مختصاتِ قواره — قطعی، هیچ ادعای داده‌ای ندارد.
  const usedPlots = new Set(spots.slice(0, usedN).map(s2 => s2.col + ',' + s2.row))
  type Amb = { kind: 'bld'; floors: number; bk: BuildingKind } | { kind: 'park' }
  const ambient = new Map<string, Amb>()
  if (sprite) for (let pr = 0; pr < gridN; pr++) for (let pc = 0; pc < gridN; pc++) {
    const key = pc + ',' + pr
    if (usedPlots.has(key)) continue
    const h = seedOf('amb:' + key)
    if (h % 100 < 55) ambient.set(key, { kind: 'bld', floors: 1 + ((h >>> 3) % 2), bk: (['apartment', 'shop', 'villa', 'office'] as BuildingKind[])[h % 4] })
    else ambient.set(key, { kind: 'park' })
  }
  // فاز ۱۶۶ — گرمای زمین: کاشیِ بژِ پک سبز می‌شود (در پک کاشیِ تمام‌سبز وجود ندارد — فیلترِ CSS تیون‌شده)؛ خیابان‌ها دست‌نخورده
  const GREEN_F = 'sepia(.9) saturate(1.9) hue-rotate(58deg) brightness(.94)'
  // فاز ۱۶۹ (فیکسِ لمسِ موبایل): مقیاسِ صحنه از پهنای واقعیِ viewport محاسبه می‌شود تا «بلاکِ فعال» شهر
  // (دارایی‌ها + بناهای مدنی) همیشه کامل داخلِ قاب باشد — روی موبایل هیچ بنایی بیرونِ صفحه نمی‌ماند.
  const [vp, setVp] = React.useState({ w: 0, h: 0 })
  React.useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  const vw = vp.w, vh = vp.h
  const interactiveSpots = [...spots.slice(0, assets.length), ...spots.slice(assets.length + 4, assets.length + 4 + (civic?.length || 0))]
  const xCenters = interactiveSpots.map(s2 => sprite ? (wOf(s2.col) - wOf(s2.row)) * (132 * kSp) / 2 : (s2.col - s2.row) * tile / 2)
  const fitHalfW = (sprite ? 132 * kSp : tile) / 2 + 40
  const fitMinX = (xCenters.length ? Math.min(...xCenters) : 0) - fitHalfW
  const fitMaxX = (xCenters.length ? Math.max(...xCenters) : 0) + fitHalfW
  const cityW = Math.max(1, fitMaxX - fitMinX), midX = (fitMinX + fitMaxX) / 2
  const baseK = vw >= 900 ? 1.45 : vw > 480 ? 1.1 : 1
  const railRsv = vw > 0 && vw <= 640 ? 56 : 0                     // ریلِ راست روی موبایل — شهر زیرش نرود
  const kFit = vw > 0 ? Math.max(0.5, Math.min(baseK, (vw - 16 - railRsv) / cityW)) : baseK
  const padMin = Math.ceil(44 / kFit)                              // حداقلِ ۴۴×۴۴ «لمسیِ واقعی» بعد از مقیاسِ صحنه
  // فیتِ عمودی: پایینِ بلاکِ فعال هرگز زیرِ نوارِ مأموریت/تب‌بار نرود — در صورتِ نیاز کلِ صحنه کمی بالا می‌رود
  const yBots = interactiveSpots.map(s2 => sprite
    ? (wOf(s2.col) + wOf(s2.row)) * 33 * kSp - yMidSp + 75 * kSp
    : ((s2.col + s2.row) - 2 * c) * tile / 4 + tile * 0.3)
  const anchorFrac = vw > 0 && vw <= 480 ? 0.62 : vw > 0 && vw <= 900 ? 0.61 : 0.66   // آینهٔ empIsoAnchor در globals.css
  const yBotCity = yBots.length ? Math.max(...yBots) : 0
  const shiftY = vh > 0 ? Math.min(0, ((vh - 150) - (vh * anchorFrac + yBotCity * kFit)) / kFit) : 0
  // 🎯 فاز ۱۸۳ — هندسهٔ بنای مدنی «یک‌جا»: هم لایهٔ نقاشی هم لایهٔ تعاملِ بالایی از همین می‌خوانند
  // (ریشهٔ باگِ «لمس کن کار نمی‌کند»: CTAها pointerEvents:none بودند و پدِ پایه داخلِ wrapperای با zIndex
  // پایین‌تر از برج‌های ردیفِ جلو — پدِ برجِ جلویی کلیک را می‌دزدید. حالا تعامل در لایهٔ بالای همهٔ برج‌هاست.)
  const civicGeoOf = (cv: any, k: number) => {
    const spot = spots[assets.length + 4 + k]
    if (!spot) return null
    const floors = cv.key === 'market' ? 1 : 2
    const stk = sprite ? pickStack(man!, (cv.key === 'world' || cv.key === 'hoods' ? 'landmark' : cv.key === 'market' ? 'shop' : 'office') as BuildingKind, 'civic:' + cv.key) : null
    const geo = man?.geo || { bodyW: 99, step: 34, lift: 10, roofOverlap: 24 }
    const T2 = 132 * kSp
    const tx = cx + (wOf(spot.col) - wOf(spot.row)) * T2 / 2 - T2 / 2
    const ty = cy + (wOf(spot.col) + wOf(spot.row)) * 33 * kSp - yMidSp
    const roofY = ty - (geo.lift + (floors - 1) * geo.step + geo.roofOverlap) * kSp
    const fh = 22, bwC = Math.round(tile * 0.72), H = floors * fh
    const x = (spot.col - spot.row) * tile / 2
    const y = ((spot.col + spot.row) - 2 * c) * tile / 4
    const wrapLeft = stk ? tx + ((132 - geo.bodyW) / 2) * kSp : cx + Math.round(x - bwC / 2)
    const wrapTop = stk ? roofY : Math.round(cy + y - H - bwC / 4)
    const wrapW = stk ? geo.bodyW * kSp : bwC
    const wrapH = stk ? ty + 75 * kSp - roofY : H + bwC / 2
    const zIdx = stk ? 3 + wOf(spot.col) + wOf(spot.row) : 10 + spot.col + spot.row
    const tipC = cv.ok ? cv.label : `${cv.label} — در سطحِ ${fa(cv.need)} باز می‌شود`
    const padHC = Math.max(padMin, Math.round(wrapH * 0.35))
    return { spot, floors, stk, geo, fh, bwC, wrapLeft, wrapTop, wrapW, wrapH, zIdx, tipC, padHC }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: sky[phase], overflow: 'hidden' }}>
      {phase === 'night' && ['8%', '22%', '38%', '57%', '72%', '88%'].map((left, i) => (
        <span key={i} style={{ position: 'absolute', top: `${6 + (i % 3) * 4}%`, left, fontSize: 9, color: '#cfd6ff', animation: `empTwinkle ${2 + i * 0.6}s ease-in-out infinite` }}>✦</span>
      ))}
      <span style={{ position: 'absolute', top: '5%', left: 26, fontSize: 30, filter: 'drop-shadow(0 0 14px rgba(255,240,180,.6))' }}>{skyIcon}</span>
      {clouds && ['14%', '56%', '78%'].map((l, i) => (
        <span key={'c' + i} className="empCloud" style={{ position: 'absolute', top: `${9 + i * 5}%`, left: l, fontSize: 17, opacity: .8, animationDelay: `${i * 4}s` }}>☁️</span>
      ))}
      {/* ذراتِ نورِ محیطی — صرفاً حس؛ با reduced-motion خاموش می‌شوند */}
      {[16, 50, 81].map((l, i) => (
        <span key={'p' + i} aria-hidden className="empDot" style={{ position: 'absolute', left: `${l}%`, bottom: '26%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,230,160,.8)', boxShadow: '0 0 8px rgba(255,230,160,.9)', animationDelay: `${i * 2.3}s` }} />
      ))}
      {/* فاز ۱۶۱ — عمقِ آسمان: دو لکه‌ابرِ خیلی نرمِ محو (فقط وقتی ابرِ هوای واقعی روی صحنه نیست) */}
      {!clouds && [['12%', '10%', 240, 70], ['62%', '20%', 300, 85]].map(([l, t, w2, h2], i) => (
        <div key={'b' + i} aria-hidden className="empCloud" style={{ position: 'absolute', left: l as string, top: t as string, width: w2 as number, height: h2 as number, borderRadius: '50%', background: phase === 'night' ? 'rgba(190,200,255,.05)' : 'rgba(255,255,255,.12)', filter: 'blur(18px)', animationDelay: `${i * 5}s`, pointerEvents: 'none' }} />
      ))}
      {/* فاز ۱۶۳→۱۶۶ — باندِ گرمِ افق: بالا رفت چون آسمان حالا فقط نوارِ باریکِ بالای قاب است */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: '13%', height: 130, background: 'linear-gradient(180deg, transparent, rgba(255,196,130,.22) 50%, transparent)', pointerEvents: 'none' }} />
      {/* صحنهٔ ایزومتریک — فاز ۱۶۶: لنگرِ ۰×۰ پایینِ قاب؛ دنیای شهر بزرگ‌تر از صحنه است و از لبه‌ها بیرون می‌زند */}
      <div className="empIsoAnchor" style={{ position: 'absolute', left: '50%', top: '66%', width: 0, height: 0 }}>
      <div className="empIsoScene" style={{ position: 'absolute', left: 0, top: 0, perspective: 900, transform: `scale(${kFit}) translate(${-Math.round(midX)}px, ${Math.round(shiftY)}px)` }}>
        {/* هالهٔ گرم و پهنِ افق پشتِ شهر */}
        <div style={{ position: 'absolute', left: cx, top: cy - 30, width: 980, height: 520, transform: 'translate(-50%,-50%)', background: 'radial-gradient(closest-side, rgba(255,222,140,.30), rgba(255,190,120,.10) 55%, transparent 75%)', pointerEvents: 'none' }} />
        {/* ✨ ذراتِ نورِ محیطیِ شناور — صرفاً حسِ صحنه؛ prefers-reduced-motion آن‌ها را کامل حذف می‌کند */}
        {[0, 1, 2].map(k => (
          <span key={'du' + k} aria-hidden className="empDustDot" style={{ position: 'absolute', left: cx + (k - 1) * 175 + 40, top: cy - 36 - k * 34, width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,230,160,.8)', boxShadow: '0 0 8px rgba(255,220,140,.85)', animationDuration: `${6 + k * 2}s`, animationDelay: `${k * 1.5}s`, pointerEvents: 'none', zIndex: 1 }} />
        ))}
        {/* فاز ۱۶۳→۱۶۶ — عمق: تپه‌ها و سیلوئتِ شهرِ دوردست پهن‌تر شدند و درست پشتِ بام‌ها نشستند */}
        <div aria-hidden style={{ position: 'absolute', left: cx - 560, top: cy - gHalfH - 44, width: 500, height: 92, borderRadius: '50%', background: 'linear-gradient(180deg,#3f7d63,#2c5a49)', filter: 'blur(6px)', opacity: .55, zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', left: cx + 120, top: cy - gHalfH - 36, width: 540, height: 84, borderRadius: '50%', background: 'linear-gradient(180deg,#3a7159,#284f40)', filter: 'blur(6px)', opacity: .5, zIndex: 0 }} />
        <div aria-hidden style={{ position: 'absolute', left: cx - 720, top: cy - gHalfH - 72, width: 1440, zIndex: 0, filter: 'blur(1.2px)' }}><SkylineSvg w={1440} h={34} fill="#7383ad" o={.34} /></div>
        <div aria-hidden style={{ position: 'absolute', left: cx - 780, top: cy - gHalfH - 48, width: 1560, zIndex: 0, filter: 'blur(.4px)' }}><SkylineSvg w={1560} h={40} fill="#5a6790" o={.5} /></div>
        {/* فاز ۱۶۳ — زمینِ محله (fallback بدونِ اسپرایت): قواره‌ها + خیابان‌های SVG روی صفحهٔ چرخیدهٔ ایزو */}
        {!sprite && <>
        <div style={{ position: 'absolute', left: cx, top: cy, width: groundW, height: groundW, transform: 'translate(-50%,-50%) rotateX(60deg) rotateZ(45deg)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 0 0 3px rgba(24,28,40,.6), 0 22px 36px rgba(0,0,0,.5)', zIndex: 2 }}>
          <GroundSvg G={groundW} n={gridN} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(closest-side at 50% 50%, rgba(255,255,255,.14), transparent 70%)', pointerEvents: 'none' }} />
        </div>
        {/* پراپ‌های قطعیِ قواره‌های خالی: فواره، بیلبورد، درخت — صرفاً دکور، هیچ ادعای داده‌ای */}
        {spots.slice(assets.length, assets.length + 4).map((s2, k) => {
          const dx = (s2.col - s2.row) * tile / 2, dy = ((s2.col + s2.row) - 2 * c) * tile / 4
          const sc = k % 3 === 2 ? 0.85 : 1
          return <span key={'t' + k} aria-hidden style={{ position: 'absolute', left: cx + dx - 13 * sc, top: cy + dy - 20 * sc, zIndex: 9 + s2.col + s2.row, pointerEvents: 'none' }}>
            {k === 0 ? <FountainSvg /> : k === 1 ? <BillboardSvg win="#ffe9a3" /> : <TreeSvg s={sc} big={k % 2 === 0} />}
          </span>
        })}
        </>}
        {/* 🖼 فاز ۱۶۴ب — زمینِ اسپرایتی (Kenney): چمنِ قواره‌ها + نوارهای خیابان بینِ قواره‌ها + تقاطع + کاشیِ درخت
            روی قواره‌های خالیِ مارپیچ. ترتیبِ نقاش با (wc+wr) — همان منطقِ چیدمانِ GroundSvg، این‌بار با کاشیِ واقعی */}
        {sprite && (() => {
          const T = 132 * kSp
          const deco = new Map<string, number>()
          spots.slice(assets.length, assets.length + 4).forEach((s2, i2) => deco.set(s2.col + ',' + s2.row, i2))
          const tiles: React.ReactNode[] = []
          for (let wr = 0; wr < M; wr++) for (let wc = 0; wc < M; wc++) {
            const x = cx + (wc - wr) * T / 2
            const y = cy + (wc + wr) * 33 * kSp - yMidSp
            const odd1 = wc % 3 === 2, odd2 = wr % 3 === 2      // فاز ۱۶۶: خیابان هر سه خط — بلوک‌های ۲×۲ قواره
            let sp: SpriteDef | undefined
            let green = false                                   // فاز ۱۶۶: قواره‌ها سبز می‌شوند؛ خیابان‌ها نه
            if (odd1 && odd2) sp = man!.ground.cross
            else if (odd1) sp = man!.ground.roadNS
            else if (odd2) sp = man!.ground.roadEW
            else {
              const pk = pOf(wc) + ',' + pOf(wr)
              const dk = deco.get(pk)
              const amb = ambient.get(pk)
              // فاز ۱۶۶: قوارهٔ خالیِ «پارک» کاشیِ درخت می‌گیرد — قطعی از هَشِ مختصات؛ صرفاً دکور
              sp = dk != null && man!.props?.length ? man!.props[dk % man!.props.length]
                : amb?.kind === 'park' && man!.props?.length ? man!.props[seedOf('ambp:' + pk) % man!.props.length]
                : man!.ground.grass[(pOf(wc) + pOf(wr)) % man!.ground.grass.length]
              green = true
            }
            if (!sp) sp = man!.ground.grass[0]
            const tall = sp.h > 101
            // maxWidth:none — لنگرِ صحنه ۰×۰ است و max-width سراسریِ img تصویر را به صفر جمع می‌کرد (فاز ۱۶۶)
            tiles.push(<img key={'g' + wc + '_' + wr} src={`/empire/sprites/${sp.file}`} alt="" width={sp.w * kSp} height={sp.h * kSp} draggable={false}
              style={{ position: 'absolute', left: x - (sp.w * kSp) / 2, top: y - (sp.h - 101) * kSp, zIndex: (tall ? 2 : 1) + wc + wr, pointerEvents: 'none', userSelect: 'none', maxWidth: 'none', filter: green ? GREEN_F : undefined }} />)
          }
          return tiles
        })()}
        {/* 🏘 فاز ۱۶۶ — ساختمان‌های محیطیِ قواره‌های خالی: کوچک (۱–۲ طبقه)، کمی کم‌رنگ، بدونِ برچسب و لمس — پر شدنِ قاب،
            صفر ادعای داده. داراییِ خودِ بازیکن با اشباعِ کامل + هالهٔ گرمِ پای برج از این‌ها متمایز می‌ماند. */}
        {sprite && Array.from(ambient.entries()).filter(([, v]) => v.kind === 'bld').map(([key, v]) => {
          const amb = v as { kind: 'bld'; floors: number; bk: BuildingKind }
          const [pc, pr] = key.split(',').map(Number)
          const stk = pickStack(man!, amb.bk, 'amb:' + key)
          if (!stk) return null
          const geo = man!.geo || { bodyW: 99, step: 34, lift: 10, roofOverlap: 24 }
          const T2 = 132 * kSp
          const tx = cx + (wOf(pc) - wOf(pr)) * T2 / 2 - T2 / 2
          const ty = cy + (wOf(pc) + wOf(pr)) * 33 * kSp - yMidSp
          const roofY = ty - (geo.lift + (amb.floors - 1) * geo.step + geo.roofOverlap) * kSp
          return (
            <div key={'amb' + key} aria-hidden style={{ position: 'absolute', left: tx + ((132 - geo.bodyW) / 2) * kSp, top: roofY, width: geo.bodyW * kSp, height: ty + 75 * kSp - roofY, zIndex: 3 + wOf(pc) + wOf(pr), pointerEvents: 'none', filter: 'saturate(.75) brightness(.97)' }}>
              {Array.from({ length: amb.floors }, (_, f) => (
                <img key={'b' + f} src={`/empire/sprites/${stk.body.file}`} alt="" width={stk.body.w * kSp} height={stk.body.h * kSp} draggable={false}
                  style={{ position: 'absolute', left: ((geo.bodyW - stk.body.w) / 2) * kSp, top: ((amb.floors - 1 - f) * geo.step + geo.roofOverlap) * kSp, userSelect: 'none' }} />
              ))}
              <img src={`/empire/sprites/${stk.roof.file}`} alt="" width={stk.roof.w * kSp} height={stk.roof.h * kSp} draggable={false}
                style={{ position: 'absolute', left: ((geo.bodyW - stk.roof.w) / 2) * kSp, top: 0, userSelect: 'none' }} />
            </div>
          )
        })}
        {/* ساختمان‌ها — هر یک داراییِ واقعی؛ گونهٔ بصری از نوعِ واقعیِ ملک، ارتفاع از towerFloorsOf؛ لمس = برگهٔ همان دارایی */}
        {assets.map((a: any, i: number) => {
          const spot = spots[i]
          if (!spot) return null
          const pal = vis.facades === false ? towerPaletteOf('') : towerPaletteOf(a.facade || a.construction?.facade || '')
          const floors = towerFloorsOf(vals[i], max)
          const building = a.construction && !a.construction.done
          const crown = vals[i] === max && assets.length > 1 && !building
          const seed = seedOf(a.id)
          const bkind = bkindOf(a)
          // فاز ۱۶۳: تنوعِ گونه — مغازه پهن و کوتاه‌قد، ویلا جمع‌وجور، آپارتمان با پهنای متغیرِ قطعی، اداری برجِ شیشه‌ای
          const fh = bkind === 'villa' || bkind === 'shop' ? 18 : 22
          const bw = bkind === 'shop' ? Math.round(tile * 0.92) : bkind === 'villa' ? Math.round(tile * 0.7) : Math.round(tile * (0.72 + ((seed >> 4) % 3) * 0.05))
          const H = floors * fh
          const x = (spot.col - spot.row) * tile / 2
          const y = ((spot.col + spot.row) - 2 * c) * tile / 4
          const bub = bubbleOf?.(a) || null
          // فاز ۱۶۳ (شلوغی‌زدایی): حداکثر «یک» نشانگرِ شناور بر فرازِ هر ساختمان — اولویت: حباب > تاج > برچسب
          const showCrown = crown && !bub
          const labelOn = !bub && !showCrown && labelIdx.has(i) && vals[i] > 0
          // 🖼 فاز ۱۶۴ب — استکِ اسپرایتِ Kenney: بدنه×طبقهٔ واقعی + سقف؛ هندسهٔ اثبات‌شدهٔ کاشیِ ۱۳۲ (× مقیاسِ kSp)
          const stk = sprite ? pickStack(man!, (crown ? 'landmark' : bkind === 'apt' ? 'apartment' : bkind) as BuildingKind, String(a.id)) : null
          const geo = man?.geo || { bodyW: 99, step: 34, lift: 10, roofOverlap: 24 }
          const T2 = 132 * kSp
          const tx = cx + (wOf(spot.col) - wOf(spot.row)) * T2 / 2 - T2 / 2
          const ty = cy + (wOf(spot.col) + wOf(spot.row)) * 33 * kSp - yMidSp
          const roofY = ty - (geo.lift + (floors - 1) * geo.step + geo.roofOverlap) * kSp
          const wrapLeft = stk ? tx + ((132 - geo.bodyW) / 2) * kSp : cx + Math.round(x - bw / 2)
          const wrapTop = stk ? roofY : Math.round(cy + y - H - bw / 4)
          const wrapW = stk ? geo.bodyW * kSp : bw
          const wrapH = stk ? ty + 75 * kSp - roofY : H + bw / 2
          const zIdx = stk ? 3 + wOf(spot.col) + wOf(spot.row) : 10 + spot.col + spot.row
          const tip = `${a.nickname ? `«${a.nickname}» — ` : ''}${a.title?.slice(0, 60)} — ${faB(vals[i])} تومان${building ? ' · در حال ساخت' : ''}${crown ? ' · 👑 نگینِ امپراتوری' : ''}`
          // فاز ۱۶۹ (الف): wrapper لمس نمی‌گیرد (حاشیهٔ شفافِ اسپرایتِ بلند کلیکِ برجِ پشتی را می‌دزدید)؛
          // فقط «پدِ پایه» (پایینِ ساختمان، حداقل ۴۴×۴۴ لمسی) کلیک‌خور است — هر برج فقط از پایهٔ خودش.
          const padH = Math.max(padMin, Math.round(wrapH * 0.35))
          return (
            <div key={a.id} className="empTower"
              title={tip}
              style={{ position: 'absolute', left: wrapLeft, top: wrapTop, width: wrapW, height: wrapH, zIndex: zIdx, opacity: building ? .6 : 1, animationDelay: `${i * 70}ms`, pointerEvents: 'none' }}>
              {/* سایهٔ ریختهٔ نرم به‌سمتِ پایین-راست (فقط حالتِ SVG — کاشیِ اسپرایت پایهٔ خودش را دارد) */}
              {!stk && <div aria-hidden style={{ position: 'absolute', left: '58%', top: H + bw / 4 + 4, width: bw * 1.7, height: bw * 0.55, transform: 'translate(-50%,-50%)', background: 'radial-gradient(closest-side, rgba(0,0,0,.3), transparent 72%)', filter: 'blur(2.5px)', pointerEvents: 'none' }} />}
              {/* فاز ۱۶۶ — هالهٔ گرمِ پای برجِ بازیکن: تمایزِ فوری از ساختمان‌های محیطیِ کم‌رنگ */}
              {stk && <div aria-hidden style={{ position: 'absolute', left: '50%', bottom: -6 * kSp, width: 190 * kSp, height: 70 * kSp, transform: 'translateX(-50%)', background: 'radial-gradient(closest-side, rgba(255,214,120,.5), transparent 72%)', filter: 'blur(5px)', pointerEvents: 'none', zIndex: -1 }} />}
              {/* برچسبِ ارزش = چیپِ تیرهٔ خوانا؛ فقط ۲ داراییِ برتر همیشه روشن، بقیه با hover/لمس */}
              {vals[i] > 0 && <span className={'empValTag' + (labelOn ? ' empValOn' : '')} style={{ position: 'absolute', top: crown ? -34 : -21, left: '50%', transform: 'translateX(-50%)', fontSize: 9.5, fontWeight: 700, color: '#ffe9a3', whiteSpace: 'nowrap', background: 'rgba(12,10,34,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 9, padding: '2px 7px', backdropFilter: 'blur(2px)', zIndex: 4 }}>{building ? '🏗 ' : ''}{faB(vals[i])}</span>}
              {showCrown && <span className="empCrownFloat" style={{ position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)', fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(255,215,106,.85))', zIndex: 5 }}>👑</span>}
              {/* حبابِ اقدامِ شناور — فقط از وضعیتِ واقعیِ همین دارایی (نبود = هیچ حبابی) */}
              {bub && <button title={bub.title} className={bub.bounce ? 'empBounce' : undefined} onClick={ev => { ev.stopPropagation(); bub.onClick() }}
                style={{ position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)', width: 26, height: 26, borderRadius: '50%', border: '2px solid rgba(90,60,10,.55)', background: 'linear-gradient(135deg,#ffd76a,#d4af37)', color: '#1a1503', fontSize: 13, fontWeight: 900, cursor: 'pointer', boxShadow: '0 3px 0 #8a6d1f, 0 6px 14px rgba(255,215,106,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 5, pointerEvents: 'auto' }}>{bub.icon}</button>}
              {/* بدنهٔ ساختمان — اسپرایتِ واقعیِ Kenney (بدنه×طبقهٔ واقعی + سقف)؛ نبودِ manifest → هنرِ SVG فاز ۱۶۳ */}
              {stk ? <>
                {Array.from({ length: floors }, (_, f) => (
                  <img key={'b' + f} src={`/empire/sprites/${stk.body.file}`} alt="" width={stk.body.w * kSp} height={stk.body.h * kSp} draggable={false}
                    style={{ position: 'absolute', left: ((geo.bodyW - stk.body.w) / 2) * kSp, top: ((floors - 1 - f) * geo.step + geo.roofOverlap) * kSp, pointerEvents: 'none', userSelect: 'none' }} />
                ))}
                <img src={`/empire/sprites/${stk.roof.file}`} alt="" width={stk.roof.w * kSp} height={stk.roof.h * kSp} draggable={false}
                  style={{ position: 'absolute', left: ((geo.bodyW - stk.roof.w) / 2) * kSp, top: 0, pointerEvents: 'none', userSelect: 'none' }} />
              </> : <BuildingSvg w={bw} floors={floors} fh={fh} pal={pal} seed={seed} building={building} kind={bkind} landmark={crown} />}
              {building && <span aria-hidden style={{ position: 'absolute', top: -7, left: '60%', fontSize: 13, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))', pointerEvents: 'none' }}>🏗</span>}
              {/* فاز ۱۸۱ب — تابلوی «سپرده به مشاور» روی خودِ برج: فقط از دادهٔ واقعیِ sale (نبود = هیچ) */}
              {a.sale && <span aria-hidden title="سپرده به مشاور برای فروش" style={{ position: 'absolute', top: -6, left: '16%', fontSize: 12, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.55))', pointerEvents: 'none', zIndex: 5 }}>🤝</span>}
              {/* پدِ لمسِ پایه — تنها ناحیهٔ کلیک‌خورِ این ساختمان */}
              {onTower && <button type="button" className="empTowerPad" title={tip} aria-label={`جزئیاتِ ${a.nickname || a.hood || a.title?.slice(0, 30) || 'دارایی'}`}
                onClick={() => onTower(a)}
                style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: Math.max(padMin, Math.round(wrapW)), height: padH, background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', pointerEvents: 'auto', zIndex: 6 }} />}
            </div>
          )
        })}
        {/* 🏛 فاز ۱۶۵ — بناهای مدنی: ناوبریِ دنیا/بازار/رتبه‌ها از روی خودِ نقشه؛ قفل = knob سطح (فقط دیده‌شدن)
            فاز ۱۸۳: این بلاک فقط «نقاشیِ» بناست — چیپ/نشان/پد به لایهٔ تعاملِ بالایی رفتند تا هیچ برجی لمس را ندزدد */}
        {(civic || []).map((cv, k) => {
          const g = civicGeoOf(cv, k)
          if (!g) return null
          return (
            <div key={'cv' + cv.key} className="empTower"
              title={g.tipC}
              style={{ position: 'absolute', left: g.wrapLeft, top: g.wrapTop, width: g.wrapW, height: g.wrapH, zIndex: g.zIdx, opacity: cv.ok ? 1 : .55, filter: cv.ok ? undefined : 'grayscale(.7)', animationDelay: `${360 + k * 90}ms`, pointerEvents: 'none' }}>
              {g.stk ? <>
                {Array.from({ length: g.floors }, (_, f) => (
                  <img key={'b' + f} src={`/empire/sprites/${g.stk!.body.file}`} alt="" width={g.stk!.body.w * kSp} height={g.stk!.body.h * kSp} draggable={false}
                    style={{ position: 'absolute', left: ((g.geo.bodyW - g.stk!.body.w) / 2) * kSp, top: ((g.floors - 1 - f) * g.geo.step + g.geo.roofOverlap) * kSp, pointerEvents: 'none', userSelect: 'none' }} />
                ))}
                <img src={`/empire/sprites/${g.stk!.roof.file}`} alt="" width={g.stk!.roof.w * kSp} height={g.stk!.roof.h * kSp} draggable={false}
                  style={{ position: 'absolute', left: ((g.geo.bodyW - g.stk!.roof.w) / 2) * kSp, top: 0, pointerEvents: 'none', userSelect: 'none' }} />
              </> : <BuildingSvg w={g.bwC} floors={g.floors} fh={g.fh} pal={towerPaletteOf('')} seed={seedOf('civic:' + cv.key)} building={false} kind={(cv.key === 'market' ? 'shop' : cv.key === 'ranks' ? 'office' : 'apt') as BKind} landmark={cv.key === 'world' || cv.key === 'hoods'} />}
            </div>
          )
        })}
        {/* 🎯 فاز ۱۸۳ — لایهٔ تعاملِ بناهای مدنی، «بالای همهٔ برج‌ها» (zIndex 35، زیرِ HUD/برگه‌ها):
            بنای مدنی ناوبریِ اصلی است — چیپِ «لمس کن»، چیپِ «⚔️ محله‌ها» و نشانِ طلایی حالا دکمهٔ واقعی‌اند
            و پدِ پایه هم این‌جاست تا پدِ برج‌های ردیفِ جلو (painter's order) نتواند کلیک را بدزدد. قفل = بدونِ کلیک. */}
        {(civic || []).map((cv, k) => {
          const g = civicGeoOf(cv, k)
          if (!g) return null
          return (
            <div key={'cvh' + cv.key} style={{ position: 'absolute', left: g.wrapLeft, top: g.wrapTop, width: g.wrapW, height: g.wrapH, zIndex: 35, pointerEvents: 'none', opacity: cv.ok ? 1 : .55, filter: cv.ok ? undefined : 'grayscale(.7)' }}>
              {/* نشانِ طلاییِ شناور — فاز ۱۶۸: نشانِ «محله‌ها» ضربان‌دار؛ فاز ۱۸۳: وقتی باز است، خودش دکمه است */}
              {cv.ok
                ? <button type="button" title={g.tipC} aria-label={`بازکردنِ ${cv.label}`} onClick={cv.onOpen} className={cv.key === 'hoods' ? 'empPulse' : undefined}
                    style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(180deg,#ffe085,#d4af37)', border: '2px solid rgba(90,60,10,.55)', boxShadow: '0 3px 0 #8a6d1f, 0 6px 14px rgba(255,215,106,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, pointerEvents: 'auto' }}>{cv.icon}</button>
                : <span aria-hidden style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(180deg,#ffe085,#d4af37)', border: '2px solid rgba(90,60,10,.55)', boxShadow: '0 3px 0 #8a6d1f, 0 6px 14px rgba(255,215,106,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, pointerEvents: 'none' }}>{cv.icon}</span>}
              {cv.ok && cv.key === 'hoods' && !civicHint && <button type="button" onClick={cv.onOpen} aria-label="بازکردنِ محله‌ها"
                style={{ position: 'absolute', top: -52, left: '50%', transform: 'translateX(-50%)', fontSize: 9.5, fontWeight: 800, color: '#ffe9a3', whiteSpace: 'nowrap', background: 'rgba(12,10,34,.82)', border: '1px solid rgba(255,215,106,.45)', borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit', pointerEvents: 'auto' }}>⚔️ محله‌ها</button>}
              {!cv.ok && <span style={{ position: 'absolute', top: -52, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#e8e4f5', whiteSpace: 'nowrap', background: 'rgba(12,10,34,.8)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 9, padding: '2px 8px', pointerEvents: 'none' }}>🔒 در سطحِ {fa(cv.need)} باز می‌شود</span>}
              {cv.ok && civicHint && <button type="button" onClick={cv.onOpen} aria-label={`بازکردنِ ${cv.label}`} className="empPulse"
                style={{ position: 'absolute', top: -52 - k * 34, left: '50%', transform: 'translateX(-50%)', fontSize: 9.5, fontWeight: 800, color: '#1a1503', whiteSpace: 'nowrap', background: 'linear-gradient(180deg,#ffe085,#d4af37)', border: 'none', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', zIndex: 6 + k, pointerEvents: 'auto' }}>{cv.label} — لمس کن</button>}
              {/* پدِ لمسِ پایهٔ بنای مدنی — قفل‌بودن = پدِ خاموش */}
              <button type="button" className="empTowerPad" title={g.tipC} aria-label={g.tipC}
                onClick={cv.ok ? cv.onOpen : undefined} disabled={!cv.ok}
                style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: Math.max(padMin, Math.round(g.wrapW)), height: g.padHC, background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: cv.ok ? 'pointer' : 'default', pointerEvents: cv.ok ? 'auto' : 'none', zIndex: 6 }} />
            </div>
          )
        })}
        {/* حالتِ خالی: همان پیامِ واقعیِ قبلی، روی الماسِ سبزِ خالی */}
        {assets.length === 0 && (
          <div style={{ position: 'absolute', left: cx, top: cy - 26, transform: 'translate(-50%,-50%)', zIndex: 30, background: 'rgba(15,12,41,.75)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 14, padding: '10px 16px', fontSize: 12, color: '#e8e4f5', width: 270, textAlign: 'center', lineHeight: 2, pointerEvents: 'none' }}>
            با اولین دارایی، برجِ تو در خطِ آسمان بالا می‌رود و پینش روی نقشهٔ واقعیِ شهر می‌نشیند.
          </div>
        )}
        {/* زندگیِ خیابان (فاز ۱۶۳): خودروهای SVG «روی خودِ خیابان‌ها» — فقط در حالتِ SVG (با اسپرایت ناهم‌سبک بود) */}
        {!sprite && cars > 0 && Array.from({ length: cars }, (_, i) => {
          const axis = i % 2
          const lane = 1 + ((i >> 1) % Math.max(1, gridN - 1))
          const u0 = lane - 0.5 - c
          const R = gridN / 2 + 0.35
          const bx = axis === 0 ? cx + u0 * tile / 2 : cx - u0 * tile / 2
          const by = cy + u0 * tile / 4
          const cvars = (axis === 0
            ? { '--cfx': `${Math.round(R * tile / 2)}px`, '--cfy': `${-Math.round(R * tile / 4)}px`, '--ctx': `${-Math.round(R * tile / 2)}px`, '--cty': `${Math.round(R * tile / 4)}px` }
            : { '--cfx': `${-Math.round(R * tile / 2)}px`, '--cfy': `${-Math.round(R * tile / 4)}px`, '--ctx': `${Math.round(R * tile / 2)}px`, '--cty': `${Math.round(R * tile / 4)}px` }) as React.CSSProperties
          return (
            <span key={'car' + i} aria-hidden className="empCarIso" style={{ position: 'absolute', left: bx - 12, top: by - 10, zIndex: 8, pointerEvents: 'none', animationDuration: `${8 + i * 2.2}s`, animationDelay: `${i * 1.3}s`, ...cvars }}>
              <CarSvg dir={axis === 0 ? -1 : 1} tone={['#e5533d', '#3d7ee5', '#e5b23d', '#58c26a', '#c4c9d4'][i % 5]} />
            </span>
          )
        })}
      </div>
      </div>
      {/* فاز ۱۶۱ — وینیتِ ملایمِ لبه‌ها: روکش‌ها روی هر آسمانی خوانا می‌مانند */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 92% at 50% 45%, transparent 55%, rgba(0,0,0,.18) 100%)', pointerEvents: 'none' }} />
      {/* چیپِ هوای واقعی + راهنمای کوچک — چیپِ تیرهٔ خوانا روی هر آسمانی (فاز ۱۶۱) */}
      {wx && <span title={`هوای واقعیِ ${wx.city} — Open-Meteo`} style={{ position: 'absolute', left: 14, bottom: 'calc(170px + env(safe-area-inset-bottom))', fontSize: 11, color: '#eef1fb', background: 'rgba(12,10,34,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '3px 9px', backdropFilter: 'blur(2px)' }}>{wx.icon} {(Number(wx.tempC) || 0).toLocaleString('fa-IR')}° {wx.label}</span>}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(148px + env(safe-area-inset-bottom))', textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ display: 'inline-block', fontSize: 10, color: 'rgba(240,240,255,.85)', background: 'rgba(12,10,34,.72)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 9, padding: '2px 10px', backdropFilter: 'blur(2px)' }}>ارتفاعِ هر برج = ارزشِ روزِ واقعیِ همان دارایی · لمسِ برج = جزئیات</span>
      </div>
      {/* لایه‌های هوای واقعی — روی کلِ صفحه (نبودِ داده = هیچ جلوه‌ای) */}
      {(fx === 'rain' || fx === 'storm') && <div className="empRain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 35 }} />}
      {fx === 'storm' && <div className="empFlash" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 35 }} />}
      {fx === 'snow' && ['8%', '24%', '41%', '60%', '76%', '92%'].map((l, i) => (
        <span key={'s' + i} className="empSnow" style={{ position: 'absolute', top: -8, left: l, fontSize: 9, color: '#dfe8ff', animationDuration: `${5 + i}s`, animationDelay: `${i * .8}s`, zIndex: 35 }}>❄</span>
      ))}
      {fx === 'mist' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,225,235,.10)', pointerEvents: 'none', zIndex: 35 }} />}
    </div>
  )
}

// 🧾 فاز ۱۵۹ — BottomSheet: برگهٔ پایینیِ سبکِ tycoon — محتوای موجودِ بخش‌ها بدونِ تغییرِ منطق داخلش رندر می‌شود.
// دسته‌بارِ کشیدنی‌نما، پس‌زمینهٔ تیره‌کننده، بستن با لمسِ پس‌زمینه یا دکمهٔ ✕.
function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 58 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(8,6,24,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="empSheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', maxWidth: 860, maxHeight: '80vh', overflowY: 'auto', background: '#1b1440', border: '1px solid rgba(255,255,255,.1)', borderBottom: 'none', borderRadius: '22px 22px 0 0', padding: '8px 16px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -18px 60px rgba(0,0,0,.6)' }}>
        <div style={{ width: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.25)', margin: '4px auto 10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 15, flex: 1 }}>{title}</b>
          <button onClick={onClose} aria-label="بستن" style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', color: 'var(--text)', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  )
}

// 🏢 فاز ۱۶۰ — MiniTower: بندانگشتیِ برجِ ایزومتریک برای کارت‌های پرتفوی — همان پالتِ نمای واقعیِ دارایی،
// طبقه‌ها از towerFloorsOf روی ارزشِ واقعی نسبت به بیشینهٔ پرتفوی. فقط ظاهر.
function MiniTower({ facade, floors }: { facade?: string; floors: number }) {
  const pal = towerPaletteOf(facade || '')
  const bw = 30, H = 8 + floors * 7, skew = 26.57
  const dot: React.CSSProperties = { width: 3, height: 3, borderRadius: '50%', background: pal.win, boxShadow: `0 0 3px ${pal.win}`, flex: 'none' }
  return (
    <div aria-hidden style={{ position: 'relative', width: bw, height: H + bw / 2, flex: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: bw, height: bw / 2, background: pal.top, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', filter: 'brightness(1.12)' }} />
      <div style={{ position: 'absolute', left: 0, top: bw / 4, width: bw / 2, height: H, background: pal.left, transform: `skewY(${skew}deg)`, transformOrigin: '0 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }}>
        {Array.from({ length: Math.min(4, floors) }, (_, f) => <span key={f} style={dot} />)}
      </div>
      <div style={{ position: 'absolute', left: bw / 2, top: bw / 2, width: bw / 2, height: H, background: pal.right, transform: `skewY(-${skew}deg)`, transformOrigin: '0 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }}>
        {Array.from({ length: Math.min(4, floors) }, (_, f) => <span key={f} style={dot} />)}
      </div>
    </div>
  )
}

export default function EmpirePage() {
  const [st, setSt] = useState<St | null>(null)
  const [step, setStep] = useState<string>('load')   // load|pitch|q|dream|verdict|birth|gift|scan|opps|buying|owned|decide|dash
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // پاسخ‌های ۵ سؤالِ سند (فصل ۲)
  const [qi, setQi] = useState(0)
  const [city, setCity] = useState('')
  const [tenB, setTenB] = useState('')
  const [risk, setRisk] = useState(50)
  const [ptype, setPtype] = useState('')
  const [goal, setGoal] = useState('')
  const [dreamPicks, setDreamPicks] = useState<string[]>([])
  const [name, setName] = useState('')
  const [persona, setPersona] = useState('🦁')
  const [pathKey, setPathKey] = useState('')
  const [verdict, setVerdict] = useState<{ title: string; confidence: number; dna: string } | null>(null)

  const [opps, setOpps] = useState<Opp[]>([])
  const [rejects, setRejects] = useState(0)
  const [buyTxt, setBuyTxt] = useState('')
  const [owned, setOwned] = useState<Opp | null>(null)
  const [guessL, setGuessL] = useState<any>(null)
  const [guessVal, setGuessVal] = useState('')
  const [guessRes, setGuessRes] = useState<any>(null)
  const [hunterPair, setHunterPair] = useState<any[]>([])
  const [hunterRes, setHunterRes] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [chestReward, setChestReward] = useState<any>(null)
  const [boards, setBoards] = useState<any>(null)
  // ⚔️ فاز ۱۶۸ — تابلوی محله‌ها (رقابتِ واقعیِ قلمرو): دادهٔ action:'hoodBoard' + چرخانِ تیکرِ روی شهر
  const [hb, setHb] = useState<any>(null)
  const [hbTick, setHbTick] = useState(0)
  const [homeHoodIn, setHomeHoodIn] = useState('')
  // فاز ۱۸۴→۱۸۵ب — خرید/مذاکره/تحلیل داخلِ خودِ دنیا (قاعدهٔ فاز ۸۰: کلیک هرگز از دنیا بیرون نمی‌بَرد)
  const [hoodBuyOk, setHoodBuyOk] = useState<{ id: string; hood: string } | null>(null) // خریدِ موفقِ همین جلسه
  // فاز ۱۸۵ب — مرورگرِ همهٔ آگهی‌های واقعیِ محله داخلِ برگهٔ محله‌ها (action:'hoodListings')
  const [hoodBrowse, setHoodBrowse] = useState('')                                      // محلهٔ باز در مرورگر ('' = تابلو)
  const [hoodL, setHoodL] = useState<any>(null)                                         // پاسخِ hoodListings برای محلهٔ باز
  const [hoodRow, setHoodRow] = useState('')                                            // ردیفِ بازشدهٔ مرورگر (id آگهی)
  // فاز ۱۶۸ (سادگیِ بناهای مدنی): برگهٔ مدنی اول ۳ کارتِ بزرگ نشان می‌دهد؛ «همهٔ امکانات» با این باز می‌شود
  const [allFx, setAllFx] = useState(false)
  const [peek, setPeek] = useState<any>(null)                    // پروفایلِ عمومیِ یک امپراتوریِ دیگر (سند ۱۷)
  const [gtab, setGtab] = useState<'city' | 'world' | 'portfolio' | 'missions' | 'market' | 'ranks' | 'hoods'>('city')   // منوی اصلی (Visual Pass · فاز ۱۶۸: + برگهٔ محله‌ها)
  // فاز ۷۲ (پایانِ اسکرولِ بی‌پایان): هر تب زیرصفحه‌های کوتاه دارد — هر لحظه فقط یک موضوع روی صفحه است
  const [cityV, setCityV] = useState<'today' | 'deals' | 'lands' | 'events' | 'map'>('today')
  // فاز ۱۵۹ (شهرِ تمام‌صفحه): برگهٔ بازِ روی صحنه + برجِ لمس‌شده — فقط حالتِ نمایشی؛ صفر منطقِ تازه
  const [citySheet, setCitySheet] = useState<'' | 'brief' | 'events' | 'deals' | 'lands' | 'map'>('')
  const [towerSel, setTowerSel] = useState<any>(null)
  // فاز ۱۸۰ (۲) — بازسازیِ «واقعی» از برگهٔ برج: بازکردنِ همان گزینه‌های renovOptions پرتفوی (ارزش‌افزودهٔ شفاف)
  const [towerRenov, setTowerRenov] = useState(false)
  // فاز ۱۸۱ب — فروش با چانه‌زنی از برگهٔ برج: پنلِ «سپردن به مشاور» + نتیجهٔ چانه/قبول (فقط UI؛ همهٔ اعداد از state/knob)
  const [towerSale, setTowerSale] = useState(false)
  const [towerAsk, setTowerAsk] = useState('')
  const [saleNote, setSaleNote] = useState<{ kind: 'walk' | 'boost' | 'accepted'; boostPct?: number; price?: number; profit?: number } | null>(null)
  useEffect(() => { setTowerRenov(false); setTowerSale(false); setTowerAsk(''); setSaleNote(null) }, [towerSel?.id])
  // فاز ۱۶۹ (ج): کارتِ مأموریتِ شهر پیش‌فرض «جمع» است (نوارِ باریکِ یک‌خطی) تا شهر را نبلعد؛ لمس = بازشدنِ فرمِ کامل
  const [heroFull, setHeroFull] = useState(false)
  // فاز ۱۶۲: جشنِ یک‌بارهٔ دریافتِ جایزه در نمای شهر — کانفتی + پروازِ سکه + توستِ «+N سکه» (N واقعی)
  const [cityCeleb, setCityCeleb] = useState<{ at: number; coins: number } | null>(null)
  const fireCityCeleb = (coins: number) => { setCityCeleb({ at: Date.now(), coins }); setTimeout(() => setCityCeleb(null), 1450) }
  // فاز ۱۶۵: راهنمای یک‌بارهٔ بناهای مدنی (sessionStorage — فقط UI) + بازکنندهٔ بخش‌ها از روی نقشه
  const [civicHint, setCivicHint] = useState(false)
  useEffect(() => { try { if (!sessionStorage.getItem('empCivicHint')) setCivicHint(true) } catch {} }, [])
  const openCivic = (t: 'world' | 'market' | 'ranks' | 'hoods') => { setGtab(t); setCivicHint(false); try { sessionStorage.setItem('empCivicHint', '1') } catch {} }
  // 🧭 فاز ۱۸۲ب — راهنمای روزهای اول (quest-log سبکِ تراوین): فقط UI؛ داده و شرط‌ها همه از st.tutorial (سرور).
  // بارِ اول برای کاربرِ فعال خودش باز می‌شود (localStorage — فقط UI)؛ active:false ⇒ دکمه و پنل کلاً حذف.
  const [tutOpen, setTutOpen] = useState(false)
  useEffect(() => {
    if (step !== 'dash' || !st?.tutorial?.active) return
    try { if (!localStorage.getItem('mj_tut_seen')) { localStorage.setItem('mj_tut_seen', '1'); setTutOpen(true) } } catch {}
  }, [step, st?.tutorial?.active])
  // مقصدِ CTA «برو»ی هر قدم — فقط بازکردنِ همان برگه‌ها/پنل‌های موجود؛ بدونِ دارایی، towerRenovate/towerSell → فرصت‌ها
  const tutGo = (go: string) => {
    setTutOpen(false)
    const a0 = (st?.empire?.assets || [])[0]
    const g = (go === 'towerRenovate' || go === 'towerSell') && !a0 ? 'deals' : go
    setTowerSel(null); setCitySheet('')
    if (g === 'deals') { setGtab('city'); setCitySheet('deals') }
    else if (g === 'missions') setGtab('missions')
    else if (g === 'hoods') openCivic('hoods')
    else if (g === 'towerRenovate' || g === 'towerSell') {
      setGtab('city'); setTowerSel(a0)
      // بازکردنِ بخشِ بازسازی/فروش بعد از اثرِ ریستِ برگهٔ برج (deps: towerSel.id) — همان پنل‌های موجود
      setTimeout(() => {
        if (g === 'towerRenovate') setTowerRenov(true)
        else { setTowerSale(true); setTowerAsk(String(Math.round(Number(a0.current ?? a0.buyPrice) || 0))) }
      }, 80)
    } else setGtab('city')
    try { window.scrollTo({ top: 0 }) } catch {}
  }
  // ☀️ فاز ۱۶۷ — دعوتِ یک‌بارهٔ زنگِ صبحگاهی: فقط وقتی اجازهٔ نوتیفیکیشن هنوز پرسیده نشده و کاربر قبلاً جواب نداده
  const [morningAsk, setMorningAsk] = useState<'no' | 'ask' | 'ok'>('no')
  useEffect(() => {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
      if (localStorage.getItem('mj-morning-optin')) return
      setMorningAsk('ask')
    } catch {}
  }, [])
  const [mktV, setMktV] = useState<'capital' | 'players' | 'bank' | 'shop'>('capital')
  const [rankV, setRankV] = useState<'compete' | 'hall' | 'clan'>('compete')
  const [misV, setMisV] = useState<'quests' | 'rewards' | 'dreams'>('quests')
  // فاز ۸۰: بازارِ شهر/محله «داخلِ» دنیا — کلیک روی شهر/شایعه دیگر از بازی بیرون نمی‌بَرد
  const [cityMkt, setCityMkt] = useState<{ title: string; total: number; items: any[]; loading?: boolean } | null>(null)
  const openCityMkt = async (q: { city?: string; hood?: string }) => {
    setCityMkt({ title: q.hood || q.city || '', total: 0, items: [], loading: true })
    const d = await api({ action: 'cityMarket', ...q })
    if (d?.ok) setCityMkt({ title: d.title, total: d.total, items: d.items || [] })
    else setCityMkt(null)
  }
  const [boardTab, setBoardTab] = useState('score')
  const [loanVal, setLoanVal] = useState('')
  const [repayVal, setRepayVal] = useState('')
  const [mkt, setMkt] = useState<any>(null)                      // بازار سرمایه (جلد ۴۰)
  const [paper, setPaper] = useState<any>(null)                  // روزنامهٔ ملک‌جت (جلد ۵۲) + آرشیو رکوردها
  const [burst, setBurst] = useState(0)                          // جشنِ موفقیت (جلد ۵۶)
  const [co, setCo] = useState({ name: '', kind: 'مسکونی', color: '#c9a84c' })   // ثبتِ شرکت (جلد ۶۱)
  const [hireL, setHireL] = useState<any>(null)                  // نامزدهای استخدامِ هفته
  const [bplan, setBplan] = useState<any>(null)                  // پیش‌نمایشِ نقشهٔ ساخت (جلد ۶۴)
  const [bgoal, setBgoal] = useState('profit')                   // هدفِ پروژه (GDD فصل ۴): fast / profit / rep
  const [bname, setBname] = useState('')                         // قانونِ ۱۳ (رویاپردازی): نامِ پروژه — انتخابِ خودِ بازیکن
  const [bfacade, setBfacade] = useState('modern')               // سبکِ نما — ظاهری/رویایی، صفر اثرِ اقتصادی
  const [buse, setBuse] = useState('residential')                // فاز ۱۱۲: کاربریِ پروژه — قیمت از آگهی‌های واقعیِ همان کاربری
  const [pu, setPu] = useState<Record<string, string>>({})       // تعدادِ واحدِ پیش‌فروش/فروش
  const [pfKind, setPfKind] = useState('all')                    // فیلترِ پرتفوی (سند ۱۹ — Part 07)
  const [pfSort, setPfSort] = useState<'new' | 'value' | 'growth'>('new')
  // جشن = پاشِش + صدای موفقیت (سند ۲۱ Part 06: مثبت/منفی کاملاً متمایز)
  const celebrate = () => { setBurst(Date.now()); setTimeout(() => setBurst(0), 1100); sfx('success', st?.soundEnabled !== false) }
  const [snd, setSnd] = useState({ on: true, vol: 0.35 })   // 🔊 تنظیمِ صدای کاربر (فاز ۳۲) — از localStorage
  const [sndOpen, setSndOpen] = useState(false)
  useEffect(() => { setSnd(sfxPrefs()) }, [])
  // فاز ۱۵۹: نمای شهر تمام‌صفحه است — اسکرولِ بدنه قفل؛ با ترکِ تب/صفحه برمی‌گردد
  // فاز ۱۶۵: شهر «همیشه» صحنهٔ پایه است — اسکرولِ بدنه در کلِ داشبورد قفل؛ محتوای بخش‌ها داخلِ برگه اسکرول می‌شود
  useEffect(() => {
    if (step === 'dash') {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [step, gtab])
  const [fu, setFu] = useState<Record<string, string>>({})       // تعدادِ واحدِ صندوق (ورودی)
  const [cu, setCu] = useState<Record<string, string>>({})       // تعدادِ واحدِ مشارکت (ورودی)
  const [nego, setNego] = useState<Record<string, any>>({})   // نتیجهٔ مذاکره به‌ازای هر آگهی
  const [deals, setDeals] = useState<any>(null)                // فرصت‌های طلاییِ امروز (سند ۱۴ — Hook)
  const [lands, setLands] = useState<any>(null)                // 🏞 بازارِ زمین (فاز ۲۴) — دروازهٔ موتورِ ساخت
  const [mapL, setMapL] = useState({ assets: true, deals: true, lands: true })   // لایه‌های نقشهٔ شهر (فاز ۲۶)
  const [wx, setWx] = useState<any>(null)   // فاز ۱۰۹ (Visual Pass 2): هوای واقعیِ شهر برای خطِ آسمان — نبود = هیچ
  useEffect(() => {
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'weather' }) })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.weather) setWx(d.weather) }).catch(() => {})
  }, [])
  const [dz, setDz] = useState<any>(null)                      // فرمِ قراردادِ معمار (فاز ۲۹): {assetId, info, floors, upf}
  // (فاز ۳۱: تیکِ سراسری حذف شد — شمارشِ معکوس کامپوننتِ ایزولهٔ خودش را دارد تا کلِ صفحه هر ثانیه رندر نشود)
  const [dealAn, setDealAn] = useState('')                     // تحلیلِ کدام فرصتِ امروز نمایش داده شود
  // فاز ۳۷ — بازارِ امپراتورها + مشارکتِ ساخت + اتحاد (درخواستِ مستقیم؛ همه سطح‌گشا)
  const [pmkt, setPmkt] = useState<any>(null)                  // عرضه‌ها و مشارکت‌های بازِ امپراتورهاِ دیگر
  const [bidIn, setBidIn] = useState<Record<string, string>>({})   // فاز ۶۴: پیشنهادِ من روی مزایدهٔ امپراتورها (میلیون)
  const [clanD, setClanD] = useState<any>(null)                // اتحادِ من / فهرستِ اتحادها
  const [fsIn, setFsIn] = useState<Record<string, string>>({}) // قیمتِ عرضه به امپراتورها (ورودی، به میلیون)
  const [jvIn, setJvIn] = useState<Record<string, { pct: string; amount: string }>>({})
  const [clanName, setClanName] = useState('')
  const [clanMsg, setClanMsg] = useState('')
  const loadPmkt = async () => { const d = await api({ action: 'playerMarket' }); if (d) setPmkt(d) }
  // فاز ۱۰۲ (لایهٔ اجتماعی): دوستان (فالوی دوطرفه) + دوئلِ هفتگی + گفتگو
  const [soc, setSoc] = useState<any>(null)
  const [cht, setCht] = useState<any>(null)      // فاز ۱۱۱: گفت‌وگوی سراسریِ شهر
  const [chtTxt, setChtTxt] = useState('')
  const loadCht = async () => {
    const d = await fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'chat' }) }).then(r => r.ok ? r.json() : null).catch(() => null)
    if (d?.ok) setCht(d)
  }
  const [dmWith, setDmWith] = useState<{ no: number; name: string } | null>(null)
  const [dmMsgs, setDmMsgs] = useState<any[]>([])
  const [dmText, setDmText] = useState('')
  const loadSoc = async () => { const d = await api({ action: 'social' }); if (d) setSoc(d) }
  const loadDm = async (no: number) => { const d = await api({ action: 'dmThread', withNo: no }); if (d) setDmMsgs(d.msgs || []) }
  const loadClan = async () => { const d = await api({ action: 'clanList' }); if (d) setClanD(d) }
  // فاز ۳۹ (سند ۲۶ فصل ۱۶): هوشِ سرمایه‌گذاری — اولویت‌های امروز/سلامتِ مالی/جریانِ نقدی/روندِ محله‌ها
  const [intel, setIntel] = useState<any>(null)
  // فاز ۴۰ (سند ۲۷ Part 13): فرمِ ساختِ قانونِ خودکار — فقط اطلاع/پیشنهاد، هرگز اجرا
  const [ruleKind, setRuleKind] = useState('cashBelow')
  const [ruleTh, setRuleTh] = useState('')
  // فاز ۴۱ (سند ۲۸ Part 07): معاملهٔ بزرگِ هفته — یک ملکِ واقعیِ شهری، یک تلاشِ مذاکره در هفته
  const [bd, setBd] = useState<any>(null)
  // 🤝 برگهٔ قرارداد با مشاور/آژانس (فیدبک: «کاربر نمی‌بیند چه هزینه‌ای می‌دهد») — قبل از فروش/اجاره
  const [aq, setAq] = useState<any>(null)   // { assetId, kind: 'sell'|'rent', via, data }
  const [bdRes, setBdRes] = useState<any>(null)
  const loadBd = async () => { const d = await api({ action: 'bigDeal' }); if (d) setBd(d) }
  // فاز ۵۳ («فعلاً کل سایت با شماره کارت»): چک‌اوتِ کارت‌به‌کارتِ کوین — کارت از تنظیماتِ ادمین + کدِ رهگیری
  const [coinCk, setCoinCk] = useState<any>(null)   // { pack, amount, card }
  const [coinReceipt, setCoinReceipt] = useState('')
  // فاز ۴۸: مسیرِ جوایزِ واقعی — نردبان + کیف‌پولِ پاداش (تبِ مأموریت‌ها)
  const [rw, setRw] = useState<any>(null)
  // فاز ۵۰ (سند ۳۰ Part 20): تالارِ افتخارات — رکوردها/مجموعه‌ها/نشان‌ها (تبِ رتبه‌ها)
  const [hall, setHall] = useState<any>(null)
  // فاز ۶۲ (فصل ۲۰ Part 7): فرمِ رؤیای شخصی — متریکِ واقعی + هدفِ عددی
  const [dreamForm, setDreamForm] = useState({ metric: 'netWorth', target: '', label: '' })
  // فاز ۶۶ (Season v1): فصلِ فعالِ دنیا — جدول + جایزهٔ پایانِ فصل
  const [szn, setSzn] = useState<any>(null)
  // فاز ۶۳ (فصل ۲۱ دنیای زنده): سالِ دنیا + کتابِ تاریخ + شایعاتِ هفته — تنبل، با بازشدنِ تبِ شهر
  const [wd, setWd] = useState<any>(null)
  // فاز ۴۵ (سند ۲۹ Auction Saga): تالارِ مزایدهٔ هفته — لابی، نبردِ زنده، برد/باخت
  const [au, setAu] = useState<any>(null)        // وضعیتِ مزایده از سرور (لابی + ران + برد)
  const [auRun, setAuRun] = useState<any>(null)  // رانِ زنده — بعد از هر حرکت از سرور می‌آید
  const [auNext, setAuNext] = useState<any>(null) // مبلغِ دقیقِ پیشنهاد/حملهٔ بعدی (همان فرمولِ سرور)
  const suspended = useRef(false)

  const api = useCallback(async (body: any) => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'خطا'); return null }
      return d
    } catch { setErr('ارتباط برقرار نشد'); return null } finally { setBusy(false) }
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/empire'); const d = await r.json()
      setSt(d)
      if (d.guest) setStep('pitch')
      else if (!d.enabled) setStep('off')
      else if (!d.empire) setStep('pitch')
      else setStep('dash')
    } catch { setErr('ارتباط برقرار نشد') }
  }, [])
  useEffect(() => { load() }, [load])
  // فاز ۱۶۹ (هـ): اگر state ناسازگار شد (xp به سقفِ سطح رسید ولی level/next قدیمی ماند — مثلاً claim از تبِ دیگر یا
  // XPِ زنگِ صبح)، یک‌بار state را از سرور تازه کن؛ نمایش هم در HUD جداگانه clamp می‌شود. هیچ عدد/مکانیکِ تازه‌ای نیست.
  const lvFixRef = useRef(0)
  useEffect(() => {
    const nx = st?.level?.next, xpv = st?.empire?.xp
    if (step === 'dash' && nx && xpv >= nx && lvFixRef.current !== xpv) { lvFixRef.current = xpv; load() }
  }, [st?.level?.next, st?.empire?.xp, step, load])

  // فرصت‌های طلاییِ امروز (سند ۱۴ — Hook): اولین چیزی که کاربر می‌بیند؛ فردا فرصت‌های دیگری می‌آیند.
  useEffect(() => {
    if (step !== 'dash' || !st?.dealsEnabled || deals) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deals' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setDeals(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, st?.dealsEnabled, deals])
  // فاز ۱۸۰ — بازارِ زنده بدونِ رفرش: تا وقتی برگهٔ فرصت‌ها باز است، هر refreshSec ثانیه (knob از سرور)
  // فهرست بی‌صدا refetch می‌شود تا «این را همین الان یکی دیگر خرید» بدونِ هیچ اسپینری دیده شود.
  useEffect(() => {
    if (step !== 'dash' || citySheet !== 'deals' || !st?.dealsEnabled) return
    const sec = Math.max(5, Math.floor(Number(st?.pulse?.refreshSec) || 20))
    let alive = true
    const t = setInterval(() => {
      fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deals' }) })
        .then(r => r.json()).then(d => { if (alive && d?.ok) setDeals(d) }).catch(() => {})
    }, sec * 1000)
    return () => { alive = false; clearInterval(t) }
  }, [step, citySheet, st?.dealsEnabled, st?.pulse?.refreshSec])
  // فاز ۱۸۰ — برگشت به تب/پنجره → یک‌بار تازه‌سازیِ بی‌صدای کلِ وضعیت (الگوی MissionChip):
  // خرید/فروش/نبضی که در نبودت رخ داده بدونِ رفرشِ دستی روی صفحه می‌نشیند.
  useEffect(() => {
    if (step !== 'dash') return
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [step, load])
  // خطاها هر جای صفحه که باشی دیده شوند (فاز ۳۱): توستِ شناور + پاک‌شدنِ خودکار — «دکمهٔ گیرکرده» تمام.
  useEffect(() => {
    if (!err) return
    sfx('error', st?.soundEnabled !== false)   // صدای رد/خطا — کاملاً متمایز از موفقیت (سند ۲۱)
    const t = setTimeout(() => setErr(''), 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [err])

  // شنودِ خطاهای مرورگر (فاز ۳۱): کرشِ JS = «هیچ دکمه‌ای کار نمی‌کند» — حالا هم روی صفحه دیده می‌شود
  // هم به لاگِ سرور می‌رود (pm2 logs، برچسبِ [client-error]) تا بدونِ کنسولِ کاربر ریشه‌یابی شود.
  useEffect(() => {
    const report = (msg: string) => {
      setErr(`خطای صفحه: ${msg.slice(0, 160)}`)
      try { navigator.sendBeacon?.('/api/client-log', new Blob([JSON.stringify({ msg, url: location.href })], { type: 'application/json' })) } catch {}
    }
    const onErr = (ev: ErrorEvent) => report(String(ev.message || ev.error))
    const onRej = (ev: PromiseRejectionEvent) => report('promise: ' + String(ev.reason?.message || ev.reason))
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])

  // 🪙 بازگشت از درگاهِ کوین (فاز ۲۸): پیامِ نتیجه + پاک‌کردنِ query تا رفرش دوباره پیام ندهد.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const c = q.get('coins')
    if (!c) return
    if (c === 'ok') { sfx('coin'); alert(`🪙 پرداخت موفق — ${Number(q.get('n') || 0).toLocaleString('fa-IR')} ملک‌کوین به کیفت اضافه شد.`) }
    else alert(`پرداخت ناموفق: ${q.get('reason') || 'لغو شد'}`)
    window.history.replaceState({}, '', '/empire')
  }, [])

  // 🏞 بازارِ زمین (فاز ۲۴): زمین‌های واقعیِ قابلِ‌خرید — بدونِ این ورودی، موتورِ ساخت هرگز دیده نمی‌شد.
  useEffect(() => {
    if (step !== 'dash' || lands) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lands' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setLands(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, lands])

  // فاز ۳۷: بازارِ امپراتورها با بازشدنِ تبِ «بازار» و اتحادها با تبِ «رتبه‌ها» بارگذاری می‌شوند (تنبل، یک‌بار)
  useEffect(() => {
    if (step !== 'dash') return
    if (gtab === 'market' && !pmkt) loadPmkt()
    if (gtab === 'market' && mktV === 'players' && !soc) loadSoc()
    if (gtab === 'market' && mktV === 'players' && !cht) loadCht()
    if (gtab === 'ranks' && !clanD) loadClan()
    if (gtab === 'ranks' && !boards) doBoards()   // فاز ۱۶۸: کارتِ «رتبهٔ من / قهرمانان» در اول-نگاهِ تالارِ افتخار
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gtab])

  // ⚔️ فاز ۱۶۸ — تابلوی محله‌ها: یک‌بار با ورود به داشبورد (خوراکِ تیکرِ روی شهر + برگهٔ محله‌ها)
  useEffect(() => {
    if (step !== 'dash' || hb) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hoodBoard' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setHb(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, hb])
  // تیکرِ چرخان: فقط وقتی شهر جلوی چشم است و تابلو بیش از یک محله دارد
  useEffect(() => {
    if (gtab !== 'city' || !((hb?.board || []).length > 1)) return
    const t = setInterval(() => setHbTick(x => x + 1), 5000)
    return () => clearInterval(t)
  }, [gtab, hb])
  // فاز ۱۶۸ (سادگی): با عوض‌شدنِ برگه، «همهٔ امکانات» دوباره جمع می‌شود — اول-نگاه همیشه ساده
  useEffect(() => { setAllFx(false) }, [gtab])

  // فاز ۱۰۲: «زندهٔ» بی‌سرور — تا وقتی بازارِ امپراتورها باز است، هر ۸ ثانیه عرضه/مزایده‌ها و هر ۶ ثانیه گفتگو تازه می‌شود
  useEffect(() => {
    if (gtab !== 'market' || mktV !== 'players') return
    const t = setInterval(() => { loadPmkt(); loadCht() }, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gtab, mktV])
  useEffect(() => {
    if (!dmWith) return
    const t = setInterval(() => { loadDm(dmWith.no) }, 6000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmWith])

  // فاز ۳۹: تحلیلِ هوشمند یک‌بار با ورود به داشبورد (شهر) بارگذاری می‌شود — سبک و فقط‌خواندنی
  useEffect(() => {
    if (step !== 'dash' || intel) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'intel' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setIntel(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, intel])

  // فاز ۴۱: معاملهٔ بزرگِ هفته — یک‌بار با ورود به داشبورد
  useEffect(() => {
    if (step !== 'dash' || bd) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bigDeal' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setBd(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, bd])

  // فاز ۴۸: مسیرِ جوایزِ واقعی — با بازشدنِ تبِ مأموریت‌ها (تنبل، یک‌بار)
  useEffect(() => {
    if (step !== 'dash' || gtab !== 'missions' || rw) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rewards' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setRw(d) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gtab, rw])

  // فاز ۵۰: تالارِ افتخارات — با بازشدنِ تبِ رتبه‌ها (تنبل، یک‌بار)
  useEffect(() => {
    if (step !== 'dash' || gtab !== 'ranks' || hall) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hall' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setHall(d) }).catch(() => {})
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'season' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setSzn(d) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gtab, hall])

  // فاز ۶۳/۷۲: دنیای زنده (سالِ دنیا/کتابِ تاریخ/شایعات) — با بازشدنِ تبِ «دنیا» (تنبل، یک‌بار)
  useEffect(() => {
    if (step !== 'dash' || gtab !== 'world' || wd) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'world' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setWd(d) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, gtab, wd])

  // فاز ۴۵: تالارِ مزایدهٔ هفته — یک‌بار با ورود به داشبورد؛ رانِ نیمه‌کاره هم از همین‌جا برمی‌گردد
  useEffect(() => {
    if (step !== 'dash' || au) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auction' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) { setAu(d); if (d.run) setAuRun(d.run); if (d.nextBid) setAuNext(d.nextBid) } }).catch(() => {})
    return () => { alive = false }
  }, [step, au])

  // «هیچ جلسه‌ای بی‌دلیلِ برگشت تمام نشود» (فصل ۴): با ترکِ صفحه، تعلیقِ فردا ثبت می‌شود.
  useEffect(() => {
    const h = () => { if (st?.empire && !suspended.current) { suspended.current = true; navigator.sendBeacon?.('/api/empire', new Blob([JSON.stringify({ action: 'suspend' })], { type: 'application/json' })) } }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [st?.empire])

  // ── تولد ──
  const questions = [
    { key: 'city', title: 'در کدام شهر دنبالِ آینده‌ات هستی؟', el: <input value={city} onChange={e => setCity(e.target.value)} placeholder="مثلاً تهران" style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} /> , ok: () => !!city.trim() },
    { key: 'tenB', title: 'اگر امروز ۱۰ میلیارد تومان داشتی چه کار می‌کردی؟', el: <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{['خانهٔ خودم را می‌خریدم', 'سرمایه‌گذاری می‌کردم', 'زمین می‌خریدم و می‌ساختم', 'یک کسب‌وکارِ تجاری راه می‌انداختم'].map(o => <button key={o} onClick={() => setTenB(o)} style={chip(tenB === o)}>{o}</button>)}</div>, ok: () => !!tenB },
    { key: 'risk', title: 'چقدر اهلِ ریسک هستی؟', el: <div><input type="range" min={0} max={100} value={risk} onChange={e => setRisk(Number(e.target.value))} style={{ width: '100%' }} /><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}><span>محتاط</span><b style={{ color: 'var(--gold)' }}>{fa(risk)}٪</b><span>جسور</span></div></div>, ok: () => true },
    { key: 'ptype', title: 'کدام نوع ملک بیشتر به دلت می‌نشیند؟', el: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{['آپارتمان', 'ویلا', 'تجاری / مغازه', 'زمین و کلنگی'].map(o => <button key={o} onClick={() => setPtype(o)} style={chip(ptype === o)}>{o}</button>)}</div>, ok: () => !!ptype },
    { key: 'goal', title: 'هدفِ اصلی‌ات در این سفرِ مالی چیست؟', el: <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{['اولین خانهٔ خودم', 'درآمدِ ماهانه از اجاره', 'رشدِ سرمایه', 'ساخت‌وساز و توسعه'].map(o => <button key={o} onClick={() => setGoal(o)} style={chip(goal === o)}>{o}</button>)}</div>, ok: () => !!goal },
  ]

  const DREAMS = [
    { key: 'home', icon: '🏠', t: 'خانهٔ رؤیایی' }, { key: 'company', icon: '🏢', t: 'شرکتِ خودم' },
    { key: 'lifestyle', icon: '🌅', t: 'سبکِ زندگی' }, { key: 'income', icon: '💰', t: 'درآمدِ رؤیایی' }, { key: 'city', icon: '🌆', t: 'شهرِ دلخواه' },
  ]

  async function doCreate() {
    // دعوتِ شراکتی (§7.4): ?ref=<شمارهٔ امپراتوری> — هر دو طرف پاداش می‌گیرند.
    const ref = Number(new URLSearchParams(window.location.search).get('ref')) || 0
    const d = await api({ action: 'create', name, persona, path: pathKey, ref, answers: { city, tenB, risk, ptype, goal }, dreamPicks })
    if (d) { setSt(d); setStep('gift') }
  }
  // اشتراکِ وایرال (§7.12): کارتِ افتخار — از سرِ افتخار، نه جایزه.
  async function doShare(text: string) {
    const url = `${window.location.origin}/empire${st?.empire?.no ? `?ref=${st.empire.no}` : ''}`
    const full = `${text}\n${url}`
    try { if (navigator.share) { await navigator.share({ text: full }); return } } catch {}
    try { await navigator.clipboard.writeText(full); alert('متنِ اشتراک کپی شد — برای دوستانت بفرست 🤝') } catch {}
  }
  async function doSuggest() {
    setStep('scan')
    const t0 = Date.now()
    const d = await api({ action: 'suggest' })
    // «در حال بررسی آیندهٔ مالی شما...» ~۳ ثانیه — تحلیلِ واقعی همین الان انجام شد؛ فقط کمتر از ۳ث را پر می‌کنیم.
    const wait = Math.max(0, 1200 - (Date.now() - t0))   // سقفِ مکثِ نمایشی ~۱.۲ث (سند ۲۰: بدونِ معطلیِ اجباری)
    setTimeout(() => { if (d?.opportunities?.length) { setOpps(d.opportunities); setStep('opps') } else { setErr(d ? 'فعلاً آگهیِ قیمت‌دارِ مناسبی در بازار نیست — به‌محضِ ورودِ فرصتِ تازه همین‌جا می‌بینی' : (err || 'ارتباط با بازار برقرار نشد — دوباره تلاش کن')); setStep(st?.empire ? 'dash' : 'pitch') } }, wait)
  }
  async function doBuy(o: Opp, negotiated = false) {
    setStep('buying'); setOwned(o)
    const texts = ['در حال بررسی سند...', 'در حال بررسی ارزش...', 'در حال تحلیل بازار...', '✍️ امضای قرارداد']
    // سقفِ انیمیشنِ اجباری ۱.۵ ثانیه (سند ۲۰ — Art Direction): ۴ گام × ۳۵۰ms
    for (let i = 0; i < texts.length; i++) { setBuyTxt(texts[i]); await new Promise(r => setTimeout(r, 350)) }
    const d = await api({ action: 'buy', listingId: o.id, negotiated })
    if (d) { setSt(d); setStep('owned'); celebrate() } else setStep(opps.length ? 'opps' : 'dash')
  }
  // خریدِ زمین از بازارِ زمین: خرید + برنامهٔ «ساخت» یکجا — و راهنمایی به قدمِ بعد (پروانه در پرتفوی).
  async function doBuyLand(l: any, negotiated = false) {
    const d = await api({ action: 'buy', listingId: l.id, negotiated })
    if (!d) return
    let d2 = d
    const a = (d.empire?.assets || []).filter((x: any) => x.listingId === l.id).pop()
    if (a) { const r = await api({ action: 'landPlan', assetId: a.id, plan: 'build' }); if (r) d2 = r }
    setSt(d2); celebrate()
    setLands((p: any) => p ? { ...p, lands: (p.lands || []).filter((x: any) => x.id !== l.id) } : p)
    alert('🏞 زمین مالِ توست و برنامه‌اش «ساخت» شد.\nقدمِ بعد: 🏛 درخواستِ پروانهٔ ساخت — در صفحهٔ «پرتفوی» روی همین زمین.')
    setGtab('portfolio')
  }
  async function doReject() {
    const d = await api({ action: 'reject' })
    if (d) { setRejects(d.rejects); if (d.free) setStep('dash'); else doSuggest() }
  }
  async function doDecide(act: string) {
    const asset = st?.empire?.assets?.[st.empire.assets.length - 1]
    if (!asset) { setStep('dash'); return }
    const d = await api({ action: 'assetAction', assetId: asset.id, act })
    if (d) { setSt(d); setStep('dash') }
  }
  async function doGuessNext() { setGuessRes(null); setGuessVal(''); const d = await api({ action: 'guessNext' }); if (d) setGuessL(d.listing) }
  async function doGuess() {
    if (!guessL) return
    const d = await api({ action: 'guess', listingId: guessL.id, guess: Number(digitsOf(guessVal)) })
    if (d) { setGuessRes(d); load() }
  }
  async function doHunter() { setHunterRes(null); const d = await api({ action: 'hunterStart' }); if (d) setHunterPair(d.pair) }
  async function doHunterPick(id: string) { const d = await api({ action: 'hunterAnswer', pick: id }); if (d) { setHunterRes(d); setHunterPair([]); load() } }
  async function doAnalyze(listingId: string) { const d = await api({ action: 'analyze', listingId }); if (d) { setAnalysis(d.analysis); load() } }
  async function doClaim(key: string) { const d = await api({ action: 'claim', key }); if (d) { setSt(d); celebrate() } return d }
  // ── فاز ۱۸۱ب — فروش با چانه‌زنی از طریقِ مشاور (برگهٔ برج): همان اکشن‌های سرور؛ state کامل برمی‌گردد ──
  const towerFresh = (d: any) => { const na = (d?.empire?.assets || []).find((x: any) => x.id === towerSel?.id); if (na) setTowerSel(na); return na }
  async function doSellList() {
    if (!towerSel) return
    const asking = Number(digitsOf(towerAsk)) || Math.round(Number(towerSel.current ?? towerSel.buyPrice) || 0)
    const d = await api({ action: 'sellList', assetId: towerSel.id, asking })
    if (d) { setSt(d); towerFresh(d); setTowerSale(false); setSaleNote(null) }
  }
  async function doSellCancel() {
    if (!towerSel) return
    const d = await api({ action: 'sellCancel', assetId: towerSel.id })
    if (d) { setSt(d); towerFresh(d); setSaleNote(null) }
  }
  async function doSellCounter() {
    if (!towerSel) return
    const d = await api({ action: 'sellCounter', assetId: towerSel.id })
    if (d) { setSt(d); towerFresh(d); setSaleNote(d.walked ? { kind: 'walk' } : { kind: 'boost', boostPct: d.boostPct }) }
  }
  async function doSellAccept() {
    if (!towerSel) return
    const d = await api({ action: 'sellAccept', assetId: towerSel.id })
    if (d) { setSt(d); celebrate(); setSaleNote({ kind: 'accepted', price: d.salePrice, profit: d.profit }) }
  }
  // فروش/اجاره «فقط» از طریقِ مشاور یا آژانسِ املاک — اول برگهٔ قرارداد با نامِ طرف و هزینهٔ تومانی باز می‌شود.
  async function openAgentQuote(a: any, kind: 'sell' | 'rent') {
    const d = await api({ action: 'agentQuote', assetId: a.id, kind })
    if (d) {
      setAq({ assetId: a.id, title: a.title, kind, via: 'advisor', data: d })
      // موبایل: برگه پایینِ کارت باز می‌شود — حتماً جلوی چشم بیاید (فیدبک: «مشاور را نشان نمی‌دهد»)
      setTimeout(() => document.getElementById('agent-quote-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    }
  }
  async function signAgentDeal() {
    if (!aq) return
    const d = aq.kind === 'sell'
      ? await api({ action: 'sell', assetId: aq.assetId, via: aq.via })
      : await api({ action: 'assetAction', assetId: aq.assetId, act: 'rent', via: aq.via })
    if (d) { setSt(d); setAq(null); if (aq.kind === 'sell' ? (d.profit || 0) > 0 : true) celebrate() }
  }
  async function doChest() { const d = await api({ action: 'chest' }); if (d) { setChestReward(d.reward); celebrate(); load() } return d }
  async function doBoards() { const d = await api({ action: 'boards' }); if (d) setBoards(d) }
  async function doMarket() { const d = await api({ action: 'market' }); if (d) setMkt(d) }
  async function doNews() { const d = await api({ action: 'news' }); if (d) setPaper(d) }
  // معاملهٔ بازار سرمایه: بعد از موفقیت، هم وضعیتِ کلی و هم نمای بازار تازه می‌شود.
  async function doTrade(body: any, clear?: () => void) {
    const d = await api(body)
    if (d) { setSt(d); clear?.(); doMarket() }
  }

  // 🎨 تیترِ سِریفِ هر تب (پروتوتایپِ کامل — دسته‌بندیِ روشنِ پنج بخش)
  const tabHead = (icon: string, t: string, d: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 2px -4px' }}>
      <span style={{ ...iconSq('#ffd76a'), width: 40, height: 40, fontSize: 21, borderRadius: 13 }}>{icon}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 26, color: '#f4e7bd', fontWeight: 900, lineHeight: 1 }}>{t}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d}</span>
    </div>
  )

  // فاز ۳۹ (سند ۲۶ Part 03+05): برگهٔ ارزش‌گذاری + «اگر بخری» — یک رندرِ مشترک برای همهٔ جاهایی که تحلیل نشان می‌دهیم.
  // Confidence و سناریوها همیشه با برچسبِ «برآورد» — قولِ قطعی نمی‌دهیم (قانونِ سند + قانونِ ۱: بدونِ عددِ ساختگی).
  const intelView = (an: any) => {
    const v = an?.valuation, d = an?.decision
    if (!v && !d) return null
    const tone = (t: string) => t === 'good' ? '#7ee0b8' : t === 'warn' ? '#e8c37a' : '#e08a7e'
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5 }}>
      {v && !v.ready && v.note && <div style={{ color: 'var(--muted)' }}>🧭 {v.note}</div>}
      {v?.ready && <>
        <div><b style={{ color: tone(v.badge.tone) }}>{v.badge.icon} {v.badge.label}</b> · ارزشِ منصفانه (برآورد): <b style={{ color: 'var(--text)' }}>{faB(v.fair)}</b> تومان · امتیازِ سرمایه‌گذاری: <b style={{ color: 'var(--gold)' }}>{fa(v.score)}/۱۰۰</b></div>
        <div style={{ color: 'var(--muted)' }}>بازهٔ واقعیِ محله: {faB(v.scenarios.pess)} تا {faB(v.scenarios.opt)} · عرضهٔ محله: {v.liquidity.label} · اطمینانِ داده: {fa(v.confidence)}٪</div>
        {v.reasons?.length > 0 && <div style={{ color: 'var(--faint)' }}>{v.reasons.map((r: string, i: number) => <div key={i}>• {r}</div>)}</div>}
      </>}
      {d && <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 4 }}>
        <b style={{ color: 'var(--text)' }}>اگر بخری:</b>{' '}
        {d.can ? <>نقدِ باقی‌مانده {faB(d.afterCapital)} تومان.</> : null}
        {(d.warnings || []).map((w: string, i: number) => <div key={i} style={{ color: '#e8c37a' }}>⚠ {w}</div>)}
        {(d.notes || []).map((n: string, i: number) => <div key={i} style={{ color: 'var(--muted)' }}>· {n}</div>)}
      </div>}
    </div>
  }

  // ══════════ رندر ══════════
  // لایهٔ حس و حرکت (جلد ۵۶): «هیچ چیزی نباید ناگهانی ظاهر نشود» — ورودِ پلکانی، میکرواینترکشن، جشنِ موفقیت.
  const wrap = (children: React.ReactNode) => (
    <main dir="rtl" className="empRoot" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 🎨 فاز ۱۵۸ — پس‌زمینهٔ tycoon: بنفشِ عمیق → ماژنتا-سرمه‌ای؛ ثابت (شب‌پایه) — آسمانِ داخلِ کارتِ شهر خودش روز/شب دارد */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, background: 'radial-gradient(1200px 600px at 50% -10%, #3d2a6d 0%, #241a4a 45%, #17123a 100%)' }} />
      <style>{`
        @keyframes empUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes empBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.35);opacity:0}}
        @keyframes empTwinkle{0%,100%{opacity:.25}50%{opacity:.9}}
        @keyframes empGlow{0%,100%{box-shadow:0 0 14px rgba(212,175,55,.25)}50%{box-shadow:0 0 28px rgba(212,175,55,.55)}}
        @keyframes empShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes empGlowText{0%,100%{text-shadow:0 0 14px rgba(212,175,55,.35)}50%{text-shadow:0 0 26px rgba(212,175,55,.7)}}
        @keyframes empIso{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
        @keyframes empCrownFloat{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-5px)}}
        @keyframes empTabPop{0%{transform:translateY(0) scale(.7)}60%{transform:translateY(-8px) scale(1.12)}100%{transform:translateY(-6px) scale(1)}}
        @keyframes empPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,215,106,.55)}50%{box-shadow:0 0 0 9px rgba(255,215,106,0)}}
        .empTower{animation:empIso .55s ease backwards;transition:transform .2s ease,filter .2s ease}
        .empValTag{opacity:0;transition:opacity .2s ease}
        .empTower:hover .empValTag,.empValOn{opacity:1}
        .empTower:has(.empTowerPad:hover) .empValTag{opacity:1}
        .empTower:has(.empTowerPad:hover){transform:translateY(-4px);filter:brightness(1.15)}
        @keyframes empBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-7px)}}
        .empBounce{animation:empBounce 1.1s ease-in-out infinite}
        @keyframes empDotFloat{0%{transform:translateY(0);opacity:0}25%{opacity:.85}100%{transform:translateY(-130px);opacity:0}}
        .empDot{animation:empDotFloat 7s linear infinite}
        @keyframes empSheetUp{from{transform:translateY(48px);opacity:0}to{transform:none;opacity:1}}
        .empSheet{animation:empSheetUp .28s ease both}
        .empUpOnce{animation:empUp .4s ease both}
        @keyframes empConfFall{0%{transform:translateY(-4vh) rotate(0deg);opacity:1}100%{transform:translateY(104vh) rotate(540deg);opacity:.4}}
        .empConf{animation:empConfFall 1.15s ease-in both}
        @keyframes empCoinFly{0%{transform:translate(-50%,0) scale(1);opacity:0}12%{opacity:1}100%{transform:translate(calc(-50% - 28vw),-62vh) scale(.55);opacity:0}}
        .empCoinFly{animation:empCoinFly 1s ease-in both}
        @keyframes empToastPop{0%{opacity:0;transform:translateX(-50%) translateY(10px) scale(.85)}18%,82%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.95)}}
        .empCoinToast{animation:empToastPop 1.3s ease both}
        @keyframes empCarGo{0%{transform:translate(var(--cfx),var(--cfy))}100%{transform:translate(var(--ctx),var(--cty))}}
        .empCarIso{animation:empCarGo linear infinite}
        .empChunky{border:2px solid rgba(90,60,10,.55)!important;box-shadow:0 3px 0 #8a6d1f,0 8px 18px rgba(0,0,0,.35)!important;transition:transform .1s ease,box-shadow .1s ease!important}
        .empChunky:active{transform:translateY(2px)!important;box-shadow:0 1px 0 #8a6d1f,0 4px 10px rgba(0,0,0,.3)!important}
        .empChunkyDark{border:2px solid rgba(0,0,0,.5)!important;box-shadow:0 3px 0 rgba(5,3,20,.9),0 8px 18px rgba(0,0,0,.4)!important;transition:transform .1s ease,box-shadow .1s ease!important}
        .empChunkyDark:active{transform:translateY(2px)!important;box-shadow:0 1px 0 rgba(5,3,20,.9)!important}
        .empTower:hover{transform:translateY(-4px);filter:brightness(1.15)}
        .empCrownFloat{animation:empCrownFloat 2.6s ease-in-out infinite}
        .empTabActive{animation:empTabPop .3s ease both}
        .empPulse{animation:empPulse 1.6s ease-in-out infinite}
        .empXpBar{transition:width .6s ease}
        @keyframes empGhostPulse{0%,100%{opacity:.35}50%{opacity:.8}}
        .empGhostXp{animation:empGhostPulse 1.8s ease-in-out infinite}
        .empRoot>*{animation:empUp .45s ease both}
        .empRoot>*:nth-child(2){animation-delay:.05s}.empRoot>*:nth-child(3){animation-delay:.1s}
        .empRoot>*:nth-child(4){animation-delay:.15s}.empRoot>*:nth-child(5){animation-delay:.2s}
        .empRoot>*:nth-child(6){animation-delay:.25s}.empRoot>*:nth-child(7){animation-delay:.3s}
        .empRoot>*:nth-child(n+8){animation-delay:.35s}
        .empRoot button{transition:transform .15s ease,filter .15s ease,border-color .15s ease}
        .empRoot button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.07)}
        .empRoot button:active:not(:disabled){transform:scale(.97)}
        .empRoot details>div,.empRoot details>*:not(summary){animation:empUp .35s ease both}
        @keyframes empDust{0%{transform:translateY(0)}12%{opacity:.75}85%{opacity:.35}100%{transform:translateY(-72px);opacity:0}}
        .empDustDot{opacity:0;animation:empDust linear infinite}
        @media (prefers-reduced-motion: reduce){.empRoot *{animation:none!important;transition:none!important}.empDustDot{display:none!important}}
      `}</style>
      <Burst seed={burst} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🏛 امپراتوریِ من</h1>
        <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>← بازگشت به ملک‌جت</Link>
      </div>
      {/* توستِ شناورِ خطا (فاز ۳۱): هر جای صفحه باشی، دلیلِ ردشدنِ اکشن را می‌بینی — «دکمهٔ گیرکرده» بی‌معنا می‌شود */}
      {err && <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 70, background: '#3a1212', border: '1px solid #a55', color: '#f0c5c5', padding: '10px 18px', borderRadius: 12, fontSize: 12.5, maxWidth: '92vw', boxShadow: '0 8px 28px -8px rgba(0,0,0,.6)' }}>⚠️ {err}</div>}
      {/* نشانگرِ درحال‌انجام: کلیکت گرفته شده — منتظرِ پاسخِ سرور است */}
      {busy && <div style={{ position: 'fixed', bottom: 88, right: 14, zIndex: 70, background: 'var(--surface)', border: '1px solid var(--goldDim)', color: 'var(--gold)', padding: '6px 12px', borderRadius: 10, fontSize: 11.5 }}>⏳ در حالِ انجام…</div>}
      <ErrorFence>{children}</ErrorFence>
    </main>
  )

  if (step === 'load') return wrap(<div style={card}>در حال آماده‌سازی...</div>)
  if (step === 'off') return wrap(<div style={card}>این بخش فعلاً برای حسابِ شما فعال نیست.</div>)

  // ── تجربهٔ آغاز (GDD جلد۱): «از بین میلیون‌ها نفر، تو انتخاب شده‌ای... فقط یک فرصت.» ──
  if (step === 'pitch') return wrap(<>
    <div style={{ ...card, textAlign: 'center', padding: '36px 20px', background: '#0a0a0c', borderColor: 'var(--gold)' }}>
      <div style={{ fontSize: 34 }}>🏛</div>
      <div style={{ fontSize: 19, fontWeight: 900, color: '#eee', margin: '14px 0 6px' }}>تبریک.</div>
      <div style={{ fontSize: 14, color: '#bbb', lineHeight: 2.3 }}>
        از بین میلیون‌ها نفر، تو برای برنامهٔ <b style={{ color: 'var(--gold)' }}>امپراتوریِ ملک‌جت</b> انتخاب شده‌ای.<br />
        اما هنوز هیچ‌چیز نداری.<br />
        نه خانه. نه سرمایه. نه اعتبار. نه شرکت.<br />
        <b style={{ color: '#eee' }}>فقط یک فرصت.</b>
      </div>
      <div style={{ fontSize: 11, color: '#777', marginTop: 12 }}>همهٔ اعداد و ملک‌های این مسیر از بازارِ واقعیِ ملک‌جت می‌آیند.</div>
    </div>
    {st?.guest ? (
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/auth" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>👑 شروعِ امپراتوری</Link>
        <Link href="/search" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>فعلاً فقط نگاه می‌کنم</Link>
      </div>
    ) : (
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={btn} onClick={() => setStep('path')}>👑 شروعِ امپراتوری</button>
        <Link href="/buyer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>بعداً</Link>
      </div>
    )}
  </>)

  // ── انتخابِ مسیرِ شخصیت (GDD جلد۱): «این فقط ظاهر نیست — رفتارِ بازی تغییر می‌کند» ──
  if (step === 'path') return wrap(<>
    <MJ><b>اولین تصمیمت:</b> کدام شخصیت را می‌خواهی؟ مسیرِ رشد، مأموریت‌ها و پیشنهادها بر همین اساس شکل می‌گیرد — و هیچ مسیری بسته نیست.</MJ>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
      {[['hunter', '🏠', 'شکارچیِ فرصت'], ['investor', '💰', 'سرمایه‌گذار'], ['builder', '🏗', 'سازنده'], ['negotiator', '🤝', 'مذاکره‌کننده'], ['entrepreneur', '📈', 'کارآفرین'], ['trader', '🎯', 'تاجر']].map(([k, icon, l]) => (
        <button key={k} onClick={() => { setPathKey(k); setQi(0); setStep('q') }}
          style={{ ...card, cursor: 'pointer', textAlign: 'center', borderColor: pathKey === k ? 'var(--gold)' : 'var(--line)' }}>
          <div style={{ fontSize: 28 }}>{icon}</div>
          <div style={{ fontSize: 13, marginTop: 6, fontWeight: 700 }}>{l}</div>
        </button>
      ))}
    </div>
  </>)

  // ── ۵ سؤالِ شخصیتی ──
  if (step === 'q') { const q = questions[qi]; return wrap(<>
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>شناختِ تو · {fa(qi + 1)} از {fa(questions.length)}</div>
    <div style={{ height: 4, background: 'var(--line)', borderRadius: 2 }}><div style={{ height: 4, width: `${((qi + 1) / questions.length) * 100}%`, background: 'var(--gold)', borderRadius: 2, transition: 'width .3s' }} /></div>
    <MJ><b>{q.title}</b></MJ>
    <div style={card}>{q.el}</div>
    <div style={{ display: 'flex', gap: 10 }}>
      <button style={btn} disabled={!q.ok()} onClick={() => qi + 1 < questions.length ? setQi(qi + 1) : setStep('dream')}>{qi + 1 < questions.length ? 'بعدی' : 'ادامه'}</button>
      {qi > 0 && <button style={btnGhost} onClick={() => setQi(qi - 1)}>قبلی</button>}
    </div>
  </>) }

  // ── Dream Board (فصل ۳: اول رؤیا، نه مالکیت) ──
  if (step === 'dream') return wrap(<>
    <MJ><b>قبل از هر عددی، بگو رؤیایت چه شکلی است؟</b><br />هر کدام که به دلت نشست را انتخاب کن.</MJ>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
      {DREAMS.map(d => { const on = dreamPicks.includes(d.key); return (
        <button key={d.key} onClick={() => setDreamPicks(p => on ? p.filter(x => x !== d.key) : [...p, d.key])}
          style={{ ...card, cursor: 'pointer', textAlign: 'center', borderColor: on ? 'var(--gold)' : 'var(--line)', background: on ? 'rgba(212,175,55,.10)' : 'var(--surface)' }}>
          <div style={{ fontSize: 30 }}>{d.icon}</div>
          <div style={{ fontSize: 13, marginTop: 6, color: on ? 'var(--gold)' : 'var(--text)' }}>{d.t}</div>
        </button>
      )})}
    </div>
    <button style={btn} disabled={!dreamPicks.length} onClick={() => {
      // حکمِ هویتی سمتِ کلاینت فقط پیش‌نمایش است؛ نسخهٔ رسمی را سرور موقعِ create می‌سازد.
      const inv = /سرمایه/.test(tenB) ? 70 : 40, bld = /ساخت|زمین/.test(tenB + goal + ptype) ? 65 : 25, com = /تجاری|کسب|درآمد/.test(tenB + goal + ptype) ? 60 : 25, lux = /ویلا/.test(ptype) ? 55 : 25
      const ranked = [[inv, 'Investor Profile', 'Investor'], [bld, 'Builder Profile', 'Builder'], [com, 'Commercial Profile', 'Trader'], [lux, 'Luxury Profile', 'Collector']].sort((a: any, b: any) => b[0] - a[0]) as any[]
      setVerdict({ title: ranked[0][1], confidence: Math.max(55, Math.min(95, 60 + (ranked[0][0] - ranked[1][0]))), dna: risk >= 70 ? 'Explorer' : ranked[0][2] })
      setStep('verdict')
    }}>ادامه</button>
  </>)

  // ── حکمِ هویتی ──
  if (step === 'verdict') return wrap(<>
    <div style={{ ...card, textAlign: 'center', padding: 28 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>هویتِ مالیِ تو</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gold)', margin: '10px 0' }}>{verdict?.title}</div>
      <div style={{ fontSize: 14 }}>اطمینان: <b>{fa(verdict?.confidence || 0)}٪</b> · DNA: <b>{verdict?.dna}</b></div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>این هویت با هر تصمیمِ واقعیِ تو در ملک‌جت به‌روز می‌شود.</div>
    </div>
    <button style={btn} onClick={() => setStep('birth')}>تولدِ امپراتوری</button>
  </>)

  // ── تولد: نام + پرسونا ──
  if (step === 'birth') return wrap(<>
    <MJ><b>وقتشه امپراتوری‌ات متولد شود.</b><br />یک نام برایش انتخاب کن — مثل «Amin Capital» یا هر نامی که نشانِ تو باشد.</MJ>
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="نامِ امپراتوری (اختیاری)" style={{ padding: 12, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} />
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>نشانِ امپراتوری:</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['🦁', '🦅', '🐉', '🏛', '⚜️', '👑', '🌟', '🗿'].map(p => <button key={p} onClick={() => setPersona(p)} style={{ ...chip(persona === p), fontSize: 20, padding: '8px 12px' }}>{p}</button>)}
      </div>
    </div>
    <button style={btn} disabled={busy} onClick={doCreate}>{busy ? '...' : 'متولد شو 🎉'}</button>
  </>)

  // ── هدیهٔ سرمایه + بستهٔ خوش‌آمد (§6.3) ──
  if (step === 'gift') { const e = st?.empire; return wrap(<>
    <div style={{ ...card, textAlign: 'center', padding: 28 }}>
      <div style={{ fontSize: 34 }}>{e?.persona || '🏛'}</div>
      <div style={{ fontSize: 22, fontWeight: 800, margin: '8px 0' }}>{e?.name}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>امپراتوری #{fa(e?.no || 0)}</div>
      <div style={{ margin: '18px 0', fontSize: 15 }}>💎 سرمایهٔ آغازین: <b style={{ color: 'var(--gold)' }}>{faB(e?.capital || 0)} تومان</b></div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ ...card, padding: '6px 12px' }}>🪙 {fa(e?.coins || 0)} ملک‌کوین</span>
        <span style={{ ...card, padding: '6px 12px' }}>⚡ {fa(e?.xp || 0)} XP</span>
        <span style={{ ...card, padding: '6px 12px' }}>🤖 {fa(e?.aiTokens || 0)} ژتونِ تحلیل</span>
        <span style={{ ...card, padding: '6px 12px' }}>🏅 نشانِ Founder</span>
      </div>
    </div>
    <MJ>این سرمایه فقط پول نیست. این اعتبارِ اولیهٔ تو برای ساختِ آینده‌ات است. با هم قدم‌به‌قدم جلو می‌رویم — و همهٔ تمرین‌ها روی بازارِ واقعی است.</MJ>
    <button style={btn} onClick={doSuggest}>اولین قدم: پیدا کردنِ اولین فرصت</button>
  </>) }

  // ── اسکنِ بازار (متنِ سند + تحلیلِ واقعی) ──
  if (step === 'scan') return (
    <main dir="rtl" className="empRoot" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: '#0a0a0c' }}>
      <div style={{ fontSize: 40 }}>🔮</div>
      <div style={{ color: '#eee', fontSize: 17, fontWeight: 700 }}>در حال بررسی آیندهٔ مالی شما...</div>
      <div style={{ color: '#888', fontSize: 12 }}>هوشِ ملک‌جت در همین لحظه فرصت‌های واقعیِ بازار {city || st?.empire?.answers?.city || ''} را می‌سنجد</div>
      <div style={{ width: 180, height: 3, background: '#222', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: '60%', height: 3, background: 'var(--gold)', animation: 'empScan 1.2s infinite alternate ease-in-out' }} /></div>
      <style>{`@keyframes empScan{from{transform:translateX(-60px)}to{transform:translateX(120px)}}`}</style>
    </main>
  )

  // ── ۴ فرصتِ واقعی ──
  if (step === 'opps') return wrap(<>
    {opps.some(o => o.locked)
      ? <MJ><b>الان هیچ آگهیِ بازار در حدِ سرمایهٔ نقدِ تو نیست</b> — این‌ها ارزان‌ترین فرصت‌های واقعیِ فعلی‌اند. با فروشِ دارایی، وامِ بانک یا سرمایه‌گذاریِ جمعی فاصله را پر کن؛ من خبرت می‌کنم.</MJ>
      : <MJ><b>{fa(opps.length)} فرصتِ واقعی برایت پیدا کردم</b> — همه آگهی‌های زندهٔ ملک‌جت و در حدِ سرمایهٔ تو.{rejects === 1 && <><br />باشه، یک دورِ دیگر گشتم — این‌ها را ببین. اگر باز هم نبود، کنترل کاملاً دستِ خودت.</>}</MJ>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
      {opps.map(o => (
        <div key={o.id} style={{ ...card, borderColor: o.recommended ? 'var(--gold)' : 'var(--line)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {o.recommended && <div style={{ position: 'absolute', top: -10, right: 12, background: 'var(--gold)', color: '#1a1503', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 8 }}>پیشنهادِ ملک‌جت</div>}
          {o.image ? <img src={o.image} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ height: 120, borderRadius: 8, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{o.kind === 'land' ? '🏞' : o.kind === 'villa' ? '🏡' : o.kind === 'commercial' ? '🏬' : '🏢'}</div>}
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.7 }}>{o.title.slice(0, 60)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{o.hood}{o.area ? ` · ${fa(o.area)} متر` : ''}</div>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{faB(o.price)} تومان</div>
          <div style={{ fontSize: 11, color: 'var(--faint)' }}>{o.reason}{(o as any).url && <> · <a href={(o as any).url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)' }}>🔗 آگهیِ واقعی</a></>}</div>
          {/* چراییِ پیشنهاد (جلد ۵۴ — AI Explainability): فقط سیگنال‌های واقعی */}
          {(o.why || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {o.why!.map(w => <span key={w} style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px' }}>{w}</span>)}
          </div>}
          {/* مذاکره (GDD جلد۱ مرحلهٔ ۵) — یک‌بار، نتیجه قطعی؛ فرصتِ خارج از بودجه فقط تماشایی است (صادقانه) */}
          {o.locked ? (
            <button style={{ ...btnGhost, padding: '8px 12px', fontSize: 12.5 }} onClick={() => setStep('dash')}>💰 هنوز نمی‌رسد — برو سرمایه بساز</button>
          ) : (<>
            {nego[o.id]
              ? <div style={{ fontSize: 11.5 }}>
                  {nego[o.id].owner && <div style={{ color: 'var(--faint)', fontSize: 10.5 }}>مالک: {nego[o.id].owner.name} ({fa(nego[o.id].owner.age)} ساله) · {nego[o.id].owner.type} — {nego[o.id].owner.desc}</div>}
                  <span style={{ color: nego[o.id].success ? '#7c6' : 'var(--muted)' }}>{nego[o.id].success ? `🤝 ${nego[o.id].owner?.name || 'فروشنده'} ${fa(nego[o.id].discountPct)}٪ تخفیف داد → ${faB(nego[o.id].finalPrice)} تومان` : `🤝 ${nego[o.id].owner?.name || 'فروشنده'} کوتاه نیامد — قیمت همان است.`}</span>
                  {/* حافظهٔ مذاکره (سند ۱۴): بازار سابقهٔ چانه‌زنی‌ات را به یاد دارد */}
                  {nego[o.id].memoryNote && <div style={{ color: '#e7a14a', fontSize: 10.5, marginTop: 3 }}>🧠 {nego[o.id].memoryNote}</div>}
                  {nego[o.id].repBonus > 0 && <div style={{ color: 'var(--gold)', fontSize: 10.5, marginTop: 3 }}>⭐ اعتبارِ برندت {fa(nego[o.id].repBonus)}٪ به شانسِ مذاکره اضافه کرد</div>}
                </div>
              : <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 11.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'negotiate', listingId: o.id }); if (d) setNego(p => ({ ...p, [o.id]: d })) }}>🤝 اول مذاکره کن</button>}
            <button style={{ ...btn, padding: '8px 12px', fontSize: 13 }} disabled={busy} onClick={() => doBuy(o, !!nego[o.id]?.success)}>این را انتخاب می‌کنم{nego[o.id]?.success ? ' (با تخفیف)' : ''}</button>
          </>)}
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <button style={btnGhost} disabled={busy} onClick={doReject}>هیچ‌کدام — {rejects >= 1 ? 'خودم انتخاب می‌کنم' : 'گزینه‌های دیگر'}</button>
    </div>
  </>)

  // ── خرید: متن‌های سند + امضا ──
  if (step === 'buying') return (
    <main dir="rtl" className="empRoot" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: 'var(--bg)' }}>
      <div style={{ fontSize: 36 }}>{buyTxt.includes('امضا') ? '✍️' : '📜'}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{buyTxt}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{owned?.title.slice(0, 60)}</div>
    </main>
  )

  // ── «تو مالک هستی» + پاداش‌ها ──
  if (step === 'owned') { const e = st?.empire; return wrap(<>
    <div style={{ ...card, textAlign: 'center', padding: 30, borderColor: 'var(--gold)' }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: '10px 0' }}>تبریک — اولین ملکِ مسیرت مالِ توست</div>
      <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>از امروز تو فقط بازدیدکننده نیستی. تو مالک هستی.</div>
      <button style={{ ...btnGhost, marginTop: 10, fontSize: 12, padding: '6px 14px' }} onClick={() => doShare(`🏠 اولین ملکِ امپراتوری‌ام را در ملک‌جت انتخاب کردم!\n«${owned?.title?.slice(0, 60) || ''}»\nتو هم امپراتوری‌ات را بساز:`)}>📤 این لحظه را به اشتراک بگذار</button>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16, fontSize: 13 }}>
        <span style={{ ...card, padding: '6px 12px' }}>⚡ +{fa(100)} XP</span>
        <span style={{ ...card, padding: '6px 12px' }}>🏅 Founder</span>
        <span style={{ ...card, padding: '6px 12px' }}>🏠 First Owner</span>
        <span style={{ ...card, padding: '6px 12px' }}>🛠 Builder Potential +۲</span>
        <span style={{ ...card, padding: '6px 12px' }}>📈 Investor Confidence +۱</span>
      </div>
    </div>
    <MJ><b>حالا یک تصمیمِ واقعی:</b> اگر این ملک واقعاً متعلق به تو بود، اولین اقدامت چه بود؟</MJ>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
      <button style={{ ...card, cursor: 'pointer', textAlign: 'center' }} onClick={() => doDecide('renovate')}><div style={{ fontSize: 26 }}>🛠</div><div style={{ marginTop: 6, fontSize: 13 }}>بازسازی می‌کردم</div></button>
      <button style={{ ...card, cursor: 'pointer', textAlign: 'center' }} onClick={() => doDecide('rent')}><div style={{ fontSize: 26 }}>💰</div><div style={{ marginTop: 6, fontSize: 13 }}>اجاره می‌دادم</div></button>
      <button style={{ ...card, cursor: 'pointer', textAlign: 'center' }} onClick={() => doDecide('hold')}><div style={{ fontSize: 26 }}>📈</div><div style={{ marginTop: 6, fontSize: 13 }}>نگه می‌داشتم</div></button>
    </div>
  </>) }

  // ── داشبوردِ امپراتوری ──
  const e = st?.empire
  if (!e) return wrap(<div style={card}>در حال بارگذاری...</div>)
  const lv = st.level || { titleFa: 'شهروند', title: 'Citizen', progress: 0, next: null }
  const ms = st.missions
  // فاز ۱۸۰ (۳) — چیپِ نبضِ امپراتوری: دلتای «واقعیِ» ثروت در بازهٔ pulseHours جاری (عددِ سرور — اجاره/کسب‌وکار +
  // تغییرِ قیمتِ زندهٔ آگهی‌ها + بازسازی)؛ بی‌دلتا = شمارشِ معکوسِ زنده تا نبضِ بعدی. لمس = برگهٔ پرتفوی.
  const pulseChip = (() => {
    const p180 = st.pulse
    if (!p180) return null
    const dv = Number(p180.delta)
    const has180 = p180.delta != null && dv !== 0
    return (
      <button title="نبضِ امپراتوری — تغییرِ واقعیِ ثروتت در بازهٔ جاری" onClick={() => { setGtab('portfolio'); try { window.scrollTo({ top: 0 }) } catch {} }}
        style={{ ...pill(), cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, color: has180 ? (dv > 0 ? '#7ee0b8' : '#e08a7e') : 'var(--muted)' }}>
        {has180 ? <>⚡ {fa(p180.hours)} ساعتِ اخیر: {dv > 0 ? '+' : '−'}{faB(Math.abs(dv))}</>
          : <>⚡ نبضِ بعدی <Countdown until={p180.nextAt || 0} onDone={() => load()} /></>}
      </button>
    )
  })()
  // فاز ۱۵۹: در نمای شهر HUD به‌صورتِ ردیف‌های شناور روی صحنه می‌نشیند — همان محتوا/هندلرها، فقط ظاهر
  // فاز ۱۶۵: شهر همیشه پس‌زمینه است — HUD همیشه شناور روی صحنه
  const hudFloat = true
  return wrap(<>
    {/* سربرگ = HUD چسبان (فصل ۹: همیشه در دسترس، کمتر از ۲۰٪ صفحه) */}
    <div className="empHud" style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', borderRadius: 18, ...(hudFloat
      ? { position: 'fixed' as const, top: 8, left: 10, right: 10, zIndex: 46, maxWidth: 840, margin: '0 auto', background: 'transparent', border: 'none', boxShadow: 'none', padding: '8px 6px' }
      : { position: 'sticky' as const, top: 8, zIndex: 40, background: 'rgba(23,16,58,.85)', border: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(8px)', boxShadow: '0 12px 34px -12px rgba(0,0,0,.6), 0 0 0 1px rgba(212,175,55,.12)' }) }}>
      {/* 🎨 HUD پوستهٔ جدید (پروتوتایپِ کامل): آواتار با حلقهٔ طلاییِ گرادیانی + قرص‌های منابع */}
      {(() => { const ic = (st.cosmetics?.items || []).find((i: any) => i.id === st.cosmetics?.frame)?.icon; return (
        <div className="empHudAv" style={{ width: 50, height: 50, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg,#d4af37,#f4e7bd,#8a6d1f)', flex: 'none', position: 'relative' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1a2030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{e.persona || '🏛'}</div>
          {ic && <span style={{ position: 'absolute', top: -7, left: -7, fontSize: 15 }}>{ic}</span>}
        </div>) })()}
      <div className="empHudInfo" style={{ flex: 1, minWidth: 180, ...(hudFloat ? { background: 'rgba(12,10,34,.8)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 16, padding: '7px 12px', backdropFilter: 'blur(6px)' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="empHudName" style={{ fontWeight: 800, fontSize: 16, fontFamily: DISPLAY }}>{e.name}</span>
          {(() => { const ic = (st.cosmetics?.items || []).find((i: any) => i.id === st.cosmetics?.flair)?.icon; return ic ? <span title="نشانِ ظاهری">{ic}</span> : null })()}
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>#{fa(e.no)}</span>
          <span className="empHudChip" style={{ fontSize: 9.5, color: '#f0d47a', border: '1px solid rgba(212,175,55,.45)', borderRadius: 99, padding: '1px 8px', whiteSpace: 'nowrap' }}>✦ {lv.titleFa}</span>
          {e.title && <span className="empHudChip" style={{ fontSize: 10, padding: '1px 8px', borderRadius: 99, border: '1px solid rgba(212,175,55,.45)', color: '#f0d47a' }}>👑 {e.title}</span>}
        </div>
        <div className="empHudMeta" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{e.profile?.title} · DNA: {e.dna} · دستیار: {e.mentor}</div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#f0d47a', fontWeight: 700, whiteSpace: 'nowrap' }}>سطح {fa(lv.level || 1)}</span>
          <div className="empXpWrap" style={{ flex: 1, height: 10, background: 'rgba(255,255,255,.09)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.4)', position: 'relative' }}>
            <div className="empXpBar" style={{ width: `${(lv.progress || 0) * 100}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#ffd76a,#ff9d2e)', boxShadow: '0 0 10px rgba(255,183,77,.6)' }} />
            {/* ☀️ فاز ۱۶۷ — سگمنتِ شبح: «اگر مأموریت‌های امروز را بزنی تا اینجا می‌رسی» — اندازه از potentialXp واقعی نسبت به بازهٔ سطح؛ pct=0 ⇒ هیچ شبحی */}
            {(() => {
              const tp = st.todayPath
              const prog = Math.max(0, Math.min(1, lv.progress || 0))
              if (!tp || !(tp.pct > 0) || prog >= 1) return null
              const ghost = (Math.min(100, tp.pct) / 100) * (1 - prog)
              if (ghost <= 0.005) return null
              return <div className="empGhostXp" title="اگر مأموریت‌های امروز را انجام بدهی تا اینجا می‌رسی" style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: `${prog * 100}%`, width: `${ghost * 100}%`, borderRadius: 99, background: 'linear-gradient(90deg, rgba(255,215,106,.55), rgba(255,157,46,.3))' }} />
            })()}
          </div>
          {/* فاز ۱۶۹ (هـ): نمایشِ XP — clamp به سقفِ سطح + قالبِ «X از Y» به‌جای «X / Y» که در RTL برعکس خوانده می‌شد
              (ریشهٔ «۱٬۱۱۸ / ۱٬۰۸۵»: bidi جای دو عدد را عوض می‌کرد و xp بزرگ‌تر از سقف دیده می‌شد) */}
          <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>⚡ {fa(lv.next ? Math.min(e.xp, lv.next) : e.xp)}{lv.next ? ` از ${fa(lv.next)}` : ''}</span>
        </div>
      </div>
      <div className="empHudPills" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', fontSize: 12, justifyContent: 'flex-end' }}>
        {pulseChip}
        <span style={pill()} title="Empire Score">🏆 {fa(st.empireScore || 0)}</span>
        <span style={pill(true)}>🪙 {fa(e.coins)}<span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#ffd76a,#d4af37)', color: '#1a1503', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 0 6px rgba(255,215,106,.5)' }}>＋</span></span>
        <span style={pill()}>🤖 {fa(e.aiTokens)}</span>
        {st.streak && st.streak.streak > 0 && <span style={pill()} title="روزهای پیاپیِ حضور">🔥 {fa(st.streak.streak)}</span>}
        {(e.kudos || 0) > 0 && <span style={pill()} title="تحسینِ امپراتورهای واقعی">👏 {fa(e.kudos)}</span>}
        {/* 🔊 تنظیمِ صدا (سند ۲۱ Part 05): خاموش/روشن + حجم، ذخیره روی دستگاه، تغییرِ فوری با صدای تست */}
        {st.soundEnabled !== false && <span style={{ position: 'relative' }}>
          <button title="صدای بازخورد" onClick={() => setSndOpen(o => !o)} style={{ ...pill(), cursor: 'pointer', fontFamily: 'inherit' }}>{snd.on && snd.vol > 0 ? '🔊' : '🔇'}</button>
          {sndOpen && <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 60, ...card, padding: 12, width: 190, boxShadow: '0 10px 28px -8px rgba(0,0,0,.55)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <b>صدای بازخورد</b>
              <button onClick={() => { const on = !snd.on; setSnd(s => ({ ...s, on })); setSfxPrefs({ on }); if (on) sfx('coin') }} style={{ ...btnGhost, padding: '3px 10px', fontSize: 11 }}>{snd.on ? 'خاموش کن' : 'روشن کن'}</button>
            </div>
            <input type="range" min={0} max={100} value={Math.round(snd.vol * 100)}
              onChange={ev => { const vol = Number(ev.target.value) / 100; setSnd(s => ({ ...s, vol })); setSfxPrefs({ vol }) }}
              onPointerUp={() => sfx('coin')}
              style={{ width: '100%', marginTop: 10, accentColor: 'var(--gold)' }} />
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>روی همین دستگاه ذخیره می‌شود · هیچ خبرِ مهمی فقط صوتی نیست</div>
          </div>}
        </span>}
      </div>
    </div>

    {/* 🏙 فاز ۱۶۵ — معماریِ جدید: «شهر خودِ کلِ تجربه است» — صحنه همیشه سوار است؛ بخش‌ها برگه‌هایی روی آن */}
    <>
    {/* 🏙 فاز ۱۵۹ — نمای شهرِ تمام‌صفحه: کلِ صفحه صحنه است؛ زیرصفحه‌های قبلی بدونِ تغییرِ منطق داخلِ برگه‌های پایینی باز می‌شوند */}
    <IsoCity assets={e.assets || []} wx={wx} visual={st.visual}
      civicHint={civicHint}
      civic={(() => {
        // فاز ۱۶۵ — بناهای مدنیِ ناوبری: قفل/بازشدن از knob واقعیِ سطح (st.unlocks.civic* از config)؛ فقط دیده‌شدن
        const lvN = lv.level || 1
        const u = st.unlocks || {}
        return [
          // ⚔️ فاز ۱۶۸ — بنای «محله‌ها»: پرکشش‌ترین بنای نقشه (رقابتِ واقعیِ قلمرو) — از روزِ اول باز است
          { key: 'hoods', icon: '⚔️', label: 'محله‌ها', need: 1, ok: true, onOpen: () => openCivic('hoods') },
          { key: 'world', icon: '🏛', label: 'تالارِ شهر', need: u.civicWorld?.need ?? 3, ok: u.civicWorld ? !!u.civicWorld.ok : lvN >= 3, onOpen: () => openCivic('world') },
          { key: 'market', icon: '🏪', label: 'بازارِ شهر', need: u.civicMarket?.need ?? 2, ok: u.civicMarket ? !!u.civicMarket.ok : lvN >= 2, onOpen: () => openCivic('market') },
          { key: 'ranks', icon: '🏆', label: 'تالارِ افتخار', need: u.civicRanks?.need ?? 4, ok: u.civicRanks ? !!u.civicRanks.ok : lvN >= 4, onOpen: () => openCivic('ranks') },
        ]
      })()}
      onTower={(a: any) => setTowerSel(a)}
      bubbleOf={(a: any) => {
        // حباب فقط از وضعیتِ واقعیِ همین دارایی — نبودِ وضعیت = هیچ حبابی
        if (a.construction?.done) return { icon: '⬆', bounce: true, title: 'پروژه تکمیل شده — مدیریت در پرتفوی', onClick: () => { setGtab('portfolio'); try { window.scrollTo({ top: 0 }) } catch {} } }
        if (bd?.deal?.mine && String(bd.deal.id) === String(a.id)) return { icon: '🏛', title: 'معاملهٔ بزرگ — جزئیات در رویدادها', onClick: () => setCitySheet('events') }
        return null
      }} />
    {/* 🎪 چیپِ رویدادِ زندهٔ واقعی (LiveOps) — فقط وقتی رویدادِ فعالی با مهلتِ واقعی هست؛ لمس = برگهٔ رویدادها */}
    {(() => {
      const lev = (st.liveEvents || []).find((ev: any) => ev.endAt && ev.endAt > Date.now())
      if (!lev) return null
      return (
        <button onClick={() => setCitySheet('events')} style={{ position: 'fixed', top: 118, left: 14, zIndex: 45, display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#ff5f4d,#ff9d2e)', color: '#fff', border: 'none', borderRadius: 999, padding: '6px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(255,95,77,.45)' }}>
          <span>{lev.icon} {lev.title}</span>
          <span style={{ background: 'rgba(0,0,0,.25)', borderRadius: 8, padding: '1px 7px' }}>⏳ <Countdown until={lev.endAt} /></span>
        </button>
      )
    })()}
    {/* ⚔️ فاز ۱۶۸ — تیکرِ رقابتِ محله‌ها روی خودِ شهر: بینِ محله‌های واقعیِ تابلو می‌چرخد؛ لمس = برگهٔ محله‌ها.
        فقط دادهٔ واقعیِ hoodBoard — تابلوی خالی = هیچ تیکری. */}
    {gtab === 'city' && (hb?.board || []).length > 0 && (() => {
      const rows = hb.board
      const s = rows[hbTick % rows.length]
      const hasEv = (st.liveEvents || []).some((ev: any) => ev.endAt && ev.endAt > Date.now())
      return (
        <button onClick={() => openCivic('hoods')} className="empHoodTicker"
          title="تابلوی محله‌ها — چه کسی فرمانروای کدام محله است؟"
          style={{ position: 'fixed', top: hasEv ? 156 : 118, left: '50%', transform: 'translateX(-50%)', zIndex: 47, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'min(92vw, 420px)', background: 'rgba(12,10,34,.82)', color: '#e8e4f5', border: '1px solid rgba(255,215,106,.4)', borderRadius: 999, padding: '5px 13px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(6px)', boxShadow: '0 6px 20px rgba(0,0,0,.45)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span aria-hidden>⚔️</span>
          <span key={hbTick % rows.length} className="empUpOnce" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <b style={{ color: '#ffe9a3' }}>{s.hood}</b>{': '}
            {s.king
              ? s.king.isMe
                ? <>👑 فرمانروا تویی با {fa(s.king.count)} ملک</>
                : <>فرمانروا {s.king.name} با {fa(s.king.count)} ملک — تو {fa(s.mine)}</>
              : <>هنوز فرمانروایی ندارد — اولین فتح مالِ تو</>}
          </span>
        </button>
      )
    })()}
    {/* 🎛 ریلِ اکشنِ لبه — هر دکمه یکی از بخش‌های موجود را به‌صورت برگه باز می‌کند؛ عددِ قرمز = شمارِ واقعی */}
    {(() => {
      const rail: Array<[string, string, number, 'brief' | 'events' | 'deals' | 'lands' | 'map']> = [
        ['🎪', 'رویدادها', (st.liveEvents || []).length + (bd?.deal ? 1 : 0) + (au?.auction ? 1 : 0), 'events'],
        ['🔥', 'فرصت‌های طلاییِ امروز', (st.dealsEnabled && deals?.deals?.length) || 0, 'deals'],
        ['🏗', 'زمین و ساخت', lands?.lands?.length || 0, 'lands'],
        // ☀️ فاز ۱۶۷: نامهٔ روز به زنگِ صبحگاهی گره خورد — ساعت از knob واقعی (todayPath.morningHour)، هاردکد نیست
        ['✉️', st.todayPath?.morningHour != null ? `☀️ گزارشِ ساعتِ ${fa(st.todayPath.morningHour)}` : 'نامهٔ ملک‌جت و امروز', st.brief && !st.brief.openedAt ? 1 : 0, 'brief'],
        ['🗺', 'نقشهٔ شهرِ تو', 0, 'map'],
      ]
      return (
        <div className="empRail" style={{ position: 'fixed', right: 10, top: '36%', zIndex: 45, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rail.map(([ic, lbl, n, key]) => (
            <button key={key} title={lbl} aria-label={lbl} onClick={() => setCitySheet(key)} className="empChunkyDark"
              style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(180deg, rgba(48,38,96,.92), rgba(20,14,48,.92))', backdropFilter: 'blur(6px)', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              {ic}
              {n > 0 && <span style={{ position: 'absolute', top: -4, left: -4, minWidth: 17, height: 17, borderRadius: 9, background: 'linear-gradient(135deg,#ff5f4d,#e02f2f)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 8px rgba(224,47,47,.6)' }}>{fa(n)}</span>}
            </button>
          ))}
        </div>
      )
    })()}
    {/* 🧭 فاز ۱۸۲ب — دکمهٔ شناورِ راهنمای شروع: لبهٔ چپ، قرینهٔ ریل — فقط تا وقتی سرور active بگوید.
        badge قرمز = شمارِ جایزه‌های آماده (done && !claimed)؛ بدونِ جایزهٔ آماده = چیپِ پیشرفتِ «X از Y». */}
    {st.tutorial?.active && (() => {
      const tut = st.tutorial
      const ready = tut.steps.filter((s2: any) => s2.done && !s2.claimed).length
      return (
        <button onClick={() => setTutOpen(true)} title="راهنمای شروع" aria-label="راهنمای شروع" className={ready > 0 ? 'empPulse empChunkyDark' : 'empChunkyDark'}
          style={{ position: 'fixed', left: 10, top: '36%', zIndex: 45, width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(180deg,#ffe085,#d4af37)', border: '2px solid rgba(90,60,10,.55)', boxShadow: '0 3px 0 #8a6d1f, 0 8px 20px rgba(255,215,106,.35)', fontSize: 21, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          🧭
          {ready > 0
            ? <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: 'linear-gradient(135deg,#ff5f4d,#e02f2f)', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 8px rgba(224,47,47,.6)' }}>{fa(ready)}</span>
            : <span style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)', fontSize: 8.5, fontWeight: 800, color: '#ffe9a3', background: 'rgba(12,10,34,.85)', border: '1px solid rgba(255,215,106,.4)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>{fa(tut.doneCount)} از {fa(tut.steps.length)}</span>}
        </button>
      )
    })()}
    {/* 🏢 برگهٔ برجِ لمس‌شده: اطلاعاتِ واقعیِ همان دارایی + مدیریت در پرتفوی */}
    <BottomSheet open={!!towerSel} onClose={() => setTowerSel(null)} title={`${towerSel?.construction && !towerSel?.construction?.done ? '🏗' : '🏢'} ${towerSel?.nickname || towerSel?.construction?.name || towerSel?.hood || towerSel?.title?.slice(0, 40) || 'دارایی'}`}>
      {/* 🎉 فاز ۱۸۱ب — نتیجهٔ قبولِ پیشنهاد: فروش انجام شد؛ سود/زیانِ واقعی از پاسخِ سرور */}
      {towerSel && saleNote?.kind === 'accepted' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ background: 'rgba(126,224,184,.08)', border: '1px solid rgba(126,224,184,.4)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ color: '#7ee0b8', fontSize: 14.5 }}>🎉 فروخته شد — {faB(saleNote.price || 0)} تومان</b>
          <span style={{ fontSize: 12.5, color: (saleNote.profit || 0) >= 0 ? '#7ee0b8' : '#e08a7e' }}>
            {(saleNote.profit || 0) >= 0 ? `سودِ واقعی: +${faB(Math.abs(saleNote.profit || 0))}` : `زیانِ واقعی: −${faB(Math.abs(saleNote.profit || 0))}`} تومان · پول به سرمایهٔ نقدت اضافه شد
          </span>
        </div>
        <button className="empChunky" style={{ ...btn, alignSelf: 'flex-start', padding: '9px 22px', fontSize: 13.5, borderRadius: 999 }} onClick={() => setTowerSel(null)}>باشه 👌</button>
      </div>}
      {towerSel && saleNote?.kind !== 'accepted' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.9 }}>{towerSel.title?.slice(0, 90)}</div>
        <div>ارزشِ روز (زنده از بازارِ واقعی): <b style={{ color: 'var(--gold)' }}>{faB(Number(towerSel.current ?? towerSel.buyPrice) || 0)} تومان</b></div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          وضعیت: {towerSel.construction && !towerSel.construction.done ? '🏗 در حالِ ساخت' : towerSel.construction?.done ? '🏙 پروژهٔ تکمیل‌شده' : (towerSel.income || 0) > 0 ? '💰 دارای درآمد' : '🏛 در مالکیتِ تو'}
          {towerSel.hood ? ` · ${towerSel.hood}` : ''}
        </div>
        {/* فاز ۱۶۵ — اقدام‌های اصلیِ همین دارایی روی خودِ نقشه: همان هندلرهای پرتفوی، دکمه‌های بزرگِ بازی */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {!towerSel.construction && !towerSel.action && towerSel.kind !== 'land' && <>
            {/* فاز ۱۸۰ (۲) — فیکسِ «بازسازی ارزش را بالا نمی‌برد»: این دکمه قبلاً فقط تصمیمِ نمادین (assetAction/renovate،
                صفر ارزش) می‌زد؛ حالا اگر گزینه‌های واقعیِ بازسازی (renovOptions با هزینه/ارزش‌افزوده) موجود باشد،
                همان‌ها را همین‌جا باز می‌کند — دقیقاً همان action `renovate` پرتفوی. بی‌گزینه = رفتارِ قبلی. */}
            <button className="empChunky" style={{ ...btnGhost, fontSize: 13, fontWeight: 800, padding: '11px 10px', ...(towerRenov ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}) }} disabled={busy}
              onClick={async () => {
                if ((towerSel.renovOptions || []).length > 0) { setTowerRenov(o => !o); return }
                const d = await api({ action: 'assetAction', assetId: towerSel.id, act: 'renovate' }); if (d) { setSt(d); const na = (d.empire?.assets || []).find((x2: any) => x2.id === towerSel.id); if (na) setTowerSel(na) }
              }}>🛠 بازسازی{(towerSel.renovBoostPct || 0) > 0 ? ` (+${fa(towerSel.renovBoostPct)}٪ ارزش ✓)` : ''}</button>
            <button className="empChunky" style={{ ...btnGhost, fontSize: 13, fontWeight: 800, padding: '11px 10px' }} disabled={busy}
              onClick={() => { openAgentQuote(towerSel, 'rent'); setTowerSel(null); setGtab('portfolio') }}>💰 اجاره با مشاور</button>
          </>}
          {/* فاز ۱۸۱ب — فروش دیگر یک‌کلیکه نیست: با مشاور و چانه‌زنی؛ این دکمه پنلِ «سپردن» را باز می‌کند */}
          {!towerSel.construction && !towerSel.sale && <button className="empChunky" style={{ ...btnGhost, fontSize: 13, fontWeight: 800, padding: '11px 10px', color: '#7ee0b8', ...(towerSale ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}) }} disabled={busy}
            onClick={() => { setTowerSale(o => !o); if (!towerAsk) setTowerAsk(String(Math.round(Number(towerSel.current ?? towerSel.buyPrice) || 0))) }}>⇄ عرضه و فروش</button>}
          <button className="empChunky" style={{ ...btnGhost, fontSize: 13, fontWeight: 800, padding: '11px 10px' }} disabled={busy || e.aiTokens <= 0}
            onClick={() => doAnalyze(towerSel.listingId)}>🧠 تحلیلِ ملک‌جت (۱ ژتون)</button>
        </div>
        {/* فاز ۱۸۰ (۲) — گزینه‌های واقعیِ بازسازی (همان renovOptions پرتفوی): هزینهٔ الان → ارزش‌افزودهٔ شفاف؛
            بعدِ موفقیت state تازه + جشن و عددِ «ارزشِ روز» بالای همین برگه visibly بالا می‌رود. هیچ عددِ ساختگی. */}
        {towerRenov && (towerSel.renovOptions || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg2)', border: '1px dashed var(--goldDim)', borderRadius: 12, padding: '9px 11px' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>🛠 هر گزینه یک‌بار — هزینه از سرمایهٔ نقد، ارزش‌افزوده روی همین برج:</span>
          {towerSel.renovOptions.map((o: any) => o.done
            ? <span key={o.key} style={{ fontSize: 11.5, color: '#7c6' }}>{o.icon} {o.label} ✓ انجام شد</span>
            : <button key={o.key} className="empChunky" style={{ ...btnGhost, fontSize: 12, fontWeight: 700, padding: '9px 10px', textAlign: 'right' }} disabled={busy}
                onClick={async () => {
                  const d = await api({ action: 'renovate', assetId: towerSel.id, option: o.key })
                  if (d) { setSt(d); celebrate(); const na = (d.empire?.assets || []).find((x2: any) => x2.id === towerSel.id); if (na) setTowerSel(na) }
                }}>{o.icon} {o.label} — هزینه {faB(o.cost)} → <b style={{ color: '#7ee0b8' }}>+{fa(o.valuePct)}٪ ارزش</b></button>)}
        </div>}
        {/* 🤝 فاز ۱۸۱ب — پنلِ «سپردن به مشاور»: قیمتِ پیشنهادیِ خودت؛ راهنمای صادقانه — گران‌تر از بازار = خریدارِ کمتر */}
        {towerSale && !towerSel.sale && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg2)', border: '1px dashed var(--goldDim)', borderRadius: 12, padding: '10px 12px' }}>
          <b style={{ fontSize: 12.5 }}>🤝 سپردن به مشاور</b>
          <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.9 }}>قیمتِ پیشنهادی‌ات را بگذار؛ مشاور خریدار می‌آورد و هر خریدار پیشنهادِ خودش را می‌دهد — قیمتِ خیلی بالاتر از بازار یعنی خریدارِ کمتر.</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={towerAsk ? Number(towerAsk).toLocaleString('fa-IR') : ''} onChange={ev => setTowerAsk(digitsOf(ev.target.value))} inputMode="numeric" aria-label="قیمتِ پیشنهادی (تومان)"
              style={{ flex: 1, minWidth: 150, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', textAlign: 'center' }} />
            <button className="empChunky" style={{ ...btn, padding: '10px 20px', fontSize: 13 }} disabled={busy || !(Number(towerAsk) > 0)} onClick={doSellList}>🤝 بسپار</button>
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>≈ {faB(Number(towerAsk) || 0)} تومان · ارزشِ روزِ بازار: {faB(Number(towerSel.current ?? towerSel.buyPrice) || 0)} تومان</span>
        </div>}
        {/* 🤝 فاز ۱۸۱ب — وضعیتِ سپرده‌شده: پیشنهادِ فعالِ خریدار (قبول/چانه/لغو) یا شمارشِ زنده تا خریدارِ بعدی */}
        {towerSel.sale && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg2)', border: '1px solid var(--goldDim)', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12.5 }}>🤝 سپرده به مشاور</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>قیمتِ پیشنهادیِ تو: <b style={{ color: 'var(--gold)' }}>{faB(towerSel.sale.asking)}</b> تومان</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, padding: '5px 11px', fontSize: 11 }} disabled={busy} onClick={doSellCancel}>✖ لغوِ سپردن</button>
          </div>
          {saleNote?.kind === 'walk' && <div style={{ fontSize: 11.5, color: '#e08a7e', background: 'rgba(224,138,126,.08)', border: '1px dashed rgba(224,138,126,.4)', borderRadius: 9, padding: '6px 10px' }}>🚶 خریدار از معامله رفت — خریدارِ بعدی: ⏳ <Countdown until={towerSel.sale.nextOfferAt || 0} onDone={load} /></div>}
          {saleNote?.kind === 'boost' && <div style={{ fontSize: 11.5, color: '#7ee0b8', background: 'rgba(126,224,184,.07)', border: '1px dashed rgba(126,224,184,.35)', borderRadius: 9, padding: '6px 10px' }}>📈 جواب داد — پیشنهاد +{fa(saleNote.boostPct || 0)}٪ بالا آمد!</div>}
          {towerSel.sale.offer ? (
            <div style={{ background: 'rgba(212,175,55,.07)', border: '1px dashed var(--goldDim)', borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b style={{ fontSize: 13.5 }}>💰 پیشنهادِ خریدار: <span style={{ color: 'var(--gold)' }}>{faB(towerSel.sale.offer.amount)}</span> تومان</b>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="empChunky" style={{ ...btn, padding: '9px 18px', fontSize: 12.5 }} disabled={busy} onClick={doSellAccept}>✅ قبول</button>
                <button className="empChunky" style={{ ...btnGhost, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, opacity: towerSel.sale.offer.countered ? .55 : 1 }} disabled={busy || !!towerSel.sale.offer.countered}
                  title={towerSel.sale.offer.countered ? 'روی این پیشنهاد یک‌بار چانه زده‌ای — قبول کن یا منتظرِ خریدارِ بعدی بمان' : 'ریسک دارد — شاید خریدار برود'}
                  onClick={doSellCounter}>🤝 چانه بزن{towerSel.sale.offer.countered ? ' (یک‌بار زدی)' : ''}</button>
              </div>
            </div>
          ) : saleNote?.kind !== 'walk' ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>⏳ خریدارِ بعدی: <b style={{ color: 'var(--gold)' }}><Countdown until={towerSel.sale.nextOfferAt || 0} onDone={load} /></b></div>
          ) : null}
        </div>}
        {analysis && <div style={{ fontSize: 11.5, color: 'var(--muted)', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
          <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
          {intelView(analysis)}
        </div>}
        <button className="empChunky" style={{ ...btn, alignSelf: 'flex-start', padding: '9px 22px', fontSize: 13.5, borderRadius: 999 }} onClick={() => { setTowerSel(null); setGtab('portfolio'); try { window.scrollTo({ top: 0 }) } catch {} }}>💼 همهٔ جزئیات (مزایده/عرضه به امپراتورها)</button>
      </div>}
    </BottomSheet>
    {/* برگهٔ بخش‌ها — محتوای زیرصفحه‌های قبلی سرِ جای خودش مانده؛ فقط شرطِ نمایش به برگه وصل شده است */}
    <BottomSheet open={citySheet !== ''} onClose={() => setCitySheet('')}
      title={({ brief: st.todayPath?.morningHour != null ? `☀️ گزارشِ ساعتِ ${fa(st.todayPath.morningHour)}` : '⚡ امروز و نامهٔ ملک‌جت', events: '🎪 رویدادها', deals: '🔥 فرصت‌های طلاییِ امروز', lands: '🏗 زمین و ساخت', map: '🗺 نقشهٔ شهرِ تو', '': '' } as Record<string, string>)[citySheet]}>
    {citySheet === 'brief' && <>
    {/* 🧭 اتاقِ تحلیل (فاز ۳۹ — سند ۲۶ فصل ۱۶): اولویت‌های امروز از وضعیتِ واقعی + سلامتِ مالی + جریانِ نقدی.
        فقط پیشنهاد می‌دهد — هیچ کاری را خودش انجام نمی‌دهد (قانونِ سند: تصمیم همیشه با خودت). */}
    {intel?.ok && (intel.priorities?.length > 0 || intel.health) && <div style={card}>
      {/* فاز ۴۱ (سند ۲۸ Part 13): اتاقِ بحران — از سیگنال‌های واقعی؛ خروج از آن نشانِ «ققنوس» دارد */}
      {intel.crisis?.active && <div style={{ border: '1px solid rgba(224,138,126,.5)', background: 'rgba(224,138,126,.08)', borderRadius: 12, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
        <b style={{ color: '#e08a7e' }}>🚨 وضعیتِ بحرانی — سطحِ {intel.crisis.level}</b>
        {intel.crisis.surviveDays !== null && <span style={{ color: 'var(--muted)' }}> · دوامِ نقد: {faDays(intel.crisis.surviveDays)}</span>}
        <div style={{ color: 'var(--muted)', marginTop: 4 }}>{intel.crisis.reasons.map((r41: string, i: number) => <div key={i}>• {r41}</div>)}</div>
        <div style={{ color: 'var(--faint)', marginTop: 4 }}>تصمیم‌های نجات همین پایین‌اند (فروشِ دارایی، پیش‌فروش، تسویهٔ وام…) — از بحران بیرون بیایی، در تایم‌لاینت ثبت می‌شود.</div>
      </div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>🧭 اتاقِ تحلیل</b>
        {intel.health && <span style={{ ...pill(), color: intel.health.score >= 50 ? '#7ee0b8' : '#e8c37a' }}>سلامتِ مالی: {fa(intel.health.score)}/۱۰۰ · {intel.health.band}</span>}
        {intel.flow && (intel.flow.dailyIn > 0 || intel.flow.dailyOut > 0) && <span style={{ ...pill(), color: intel.flow.net >= 0 ? '#7ee0b8' : '#e08a7e' }}>
          جریانِ روزانه: {intel.flow.net >= 0 ? '+' : '−'}{faB(Math.abs(intel.flow.net))} تومان{intel.flow.runwayDays !== null ? ` · دوامِ نقد ${faDays(intel.flow.runwayDays)}` : ''}
        </span>}
      </div>
      {intel.priorities?.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8, fontSize: 12 }}>
        {intel.priorities.map((p: any, i: number) => <div key={i} style={{ display: 'flex', gap: 6 }}><span>{p.icon}</span><span style={{ color: 'var(--text)' }}>{p.text}</span></div>)}
      </div>}
      {/* فاز ۴۰ (سند ۲۷ Part 13): هشدارهای قوانینِ خودِ بازیکن — از وضعیت/قیمت‌های واقعی؛ فقط اطلاع/پیشنهاد */}
      {(intel.rules?.alerts || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8, fontSize: 12 }}>
        {intel.rules.alerts.map((a: any, i: number) => <div key={i} style={{ display: 'flex', gap: 6 }}><span>{a.icon}</span><span style={{ color: '#e8c37a' }}>{a.text}</span></div>)}
      </div>}
      {intel.health?.reasons?.length > 0 && <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}>چرا این ارزیابی؟ (از وضعیتِ واقعیِ خودت)</summary>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{intel.health.reasons.map((r: string, i: number) => <div key={i}>• {r}</div>)}</div>
      </details>}
      {/* ⚙️ قوانینِ خودکارِ من (فاز ۴۰ — سند ۲۷ Part 13): بازیکن خودش قانون می‌سازد؛ سیستم هرگز چیزی اجرا نمی‌کند */}
      {intel.rules && <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--muted)' }}>⚙️ قوانینِ خودکارِ من ({fa((intel.rules.list || []).length)} از {fa(intel.rules.max)}) — فقط هشدار و پیشنهاد؛ هیچ خرید/فروشی خودکار نیست</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 12 }}>
          {(intel.rules.list || []).map((r: any) => {
            const t = (intel.rules.templates || []).find((x: any) => x.kind === r.kind)
            return <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 5, opacity: r.enabled ? 1 : 0.45 }}>
              <span>{t?.icon || '⚙️'}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{(t?.label || r.kind).replace('…', fa(r.threshold))} <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>({r.level === 'recommend' ? 'پیشنهاد بده' : 'فقط خبر بده'})</span></span>
              <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'ruleToggle', ruleId: r.id }); if (d) setIntel((x: any) => ({ ...x, rules: { ...x.rules, list: d.list } })) }}>{r.enabled ? 'توقف' : 'فعال'}</button>
              <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'ruleDel', ruleId: r.id }); if (d) setIntel((x: any) => ({ ...x, rules: { ...x.rules, list: d.list } })) }}>✕</button>
            </div>
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <select value={ruleKind} onChange={ev => setRuleKind(ev.target.value)} style={{ padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11.5, maxWidth: 300 }}>
              {(intel.rules.templates || []).map((t: any) => <option key={t.kind} value={t.kind}>{t.icon} {t.label}</option>)}
            </select>
            <input value={ruleTh} onChange={ev => setRuleTh(digitsOf(ev.target.value))} inputMode="numeric"
              placeholder={String((intel.rules.templates || []).find((t: any) => t.kind === ruleKind)?.defaultThreshold ?? '')}
              style={{ width: 64, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center', fontSize: 12 }} />
            <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{(intel.rules.templates || []).find((t: any) => t.kind === ruleKind)?.unit}</span>
            <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy} onClick={async () => {
              const tpl = (intel.rules.templates || []).find((t: any) => t.kind === ruleKind)
              const th = Number(digitsOf(ruleTh)) || tpl?.defaultThreshold || 0
              const d = await api({ action: 'ruleSet', kind: ruleKind, threshold: th, level: ruleKind === 'profitAbove' ? 'recommend' : 'notify' })
              if (d) { setRuleTh(''); setIntel((x: any) => ({ ...x, rules: { ...x.rules, list: d.list } })) }
            }}>+ افزودنِ قانون</button>
          </div>
          {(intel.rules.log || []).length > 0 && <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>
            <b style={{ color: 'var(--muted)' }}>دفترِ ثبت (آخرین فعال‌شدن‌ها):</b>
            {intel.rules.log.slice(0, 5).map((l: any, i: number) => <div key={i}>{l.icon} {l.text} — {new Date(l.at).toLocaleDateString('fa-IR')}</div>)}
          </div>}
        </div>
      </details>}
    </div>}
    {/* 🎁 پیشنهادِ هوشمند (فاز ۳۳ — سند ۲۲ فصل ۹): حداکثر ۱ در روز، از رفتارِ واقعیِ خودت، با یک لمس بسته می‌شود.
        بدونِ تایمرِ ساختگی و بدونِ پاپ‌آپ — یک کارتِ ساده که «نه» هم جوابِ کاملاً قابلِ‌قبولی است. */}
    {st.offer && <div style={{ ...card, borderColor: 'var(--goldDim)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 22 }}>{st.offer.icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <b style={{ fontSize: 13 }}>{st.offer.title}</b>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{st.offer.text}</div>
      </div>
      <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} onClick={() => { setGtab('market'); setMktV('shop'); setTimeout(() => document.getElementById(st.offer.goto === 'coins' ? 'coin-shop' : 'cosmetic-shop')?.scrollIntoView({ behavior: 'smooth' }), 120) }}>{st.offer.cta}</button>
      <button title="بستن — تا چند روز برنمی‌گردد" style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} disabled={busy}
        onClick={async () => { await api({ action: 'offerDismiss', id: st.offer.id }); setSt((s: any) => ({ ...s, offer: null })) }}>✕</button>
    </div>}

    </>}

    {citySheet === 'events' && <>
    {/* فاز ۷۲ (صداقت): اگر هفتهٔ جاری هنوز رویدادی نساخته، صادقانه بگو — نه کارتِ خالیِ گنگ */}
    {!bd?.deal && !au?.auction && <div style={card}>
      <b style={{ fontSize: 13.5 }}>🎪 رویدادها</b>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>معاملهٔ بزرگ و تالارِ مزایده در هر دوره از آگهی‌های «واقعیِ» همان دوره ساخته می‌شوند — رویدادِ این دوره هنوز شکل نگرفته یا دادهٔ کافی نیامده. سری بعد که بیایی، اینجا خبری هست.</div>
    </div>}
    {/* 🔥 معاملهٔ بزرگِ هفته (فاز ۴۱ — سند ۲۸ فصل ۱۷ Part 07): یک ملکِ واقعیِ گران، برای همهٔ امپراتورها یکی —
        یک تلاشِ مذاکره در هفته با انتخابِ استراتژی؛ اولین برنده‌ای که بخرد مالک می‌شود (مالکیتِ انحصاری). */}
    {bd?.ok && bd.deal && <div style={{ ...card, borderColor: '#e08a7e', background: 'rgba(224,138,126,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>💎 معاملهٔ بزرگِ {bd.deal.periodFa || 'هفته'}</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>برای همه همین یکی است — هر کس زودتر ببرد و بخرد، مالک می‌شود</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: '#e08a7e', fontWeight: 800 }}>⏳ <Countdown until={bd.deal.expiresAt || 0} onDone={() => setBd(null)} /></span>
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <b>{bd.deal.title.slice(0, 70)}</b>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{bd.deal.hood} · مالک: {bd.deal.owner.name} ({bd.deal.owner.type} — {bd.deal.owner.desc})</div>
        <div style={{ fontSize: 15, color: 'var(--gold)', fontWeight: 800, marginTop: 4 }}>{faB(bd.deal.price)} تومان</div>
      </div>
      {bd.deal.soldTo && <div style={{ fontSize: 12, color: '#e8c37a', marginTop: 8 }}>🔒 فروخته شد — «{bd.deal.soldTo.name}» (#{fa(bd.deal.soldTo.no)}) زودتر بست. دورِ بعد معاملهٔ تازه‌ای می‌آید.</div>}
      {bd.deal.mine && <div style={{ fontSize: 12, color: '#7ee0b8', marginTop: 8 }}>👑 مالِ توست — معاملهٔ بزرگِ این هفته را تو بردی.</div>}
      {!bd.deal.soldTo && !bd.deal.mine && !bd.unlocked && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>🔒 از سطحِ {fa(bd.need)} باز می‌شود — با تصمیم‌های واقعی XP بگیر.</div>}
      {!bd.deal.soldTo && !bd.deal.mine && bd.unlocked && !bd.tried && !bdRes && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>استراتژیِ مذاکره‌ات را انتخاب کن — فقط «یک» تلاش در هر دوره داری:</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(bd.strategies || []).map((s41: any) => (
            <button key={s41.key} style={{ ...btnGhost, padding: '7px 12px', fontSize: 12 }} disabled={busy} title={s41.desc}
              onClick={async () => {
                if (!confirm(`استراتژیِ «${s41.label}»؟ ${s41.desc} — تلاشِ این هفته مصرف می‌شود.`)) return
                const d = await api({ action: 'bigDealNego', strategy: s41.key })
                if (d) { setBdRes(d); if (d.success) celebrate(); else sfx('error', st?.soundEnabled !== false) }
              }}>{s41.icon} {s41.label}</button>
          ))}
        </div>
      </div>}
      {(bdRes || (bd.tried && bd.wonPct > 0)) && !bd.deal.soldTo && !bd.deal.mine && (() => {
        const won = bdRes ? bdRes.success : bd.wonPct > 0
        const pct = bdRes ? bdRes.discountPct : bd.wonPct
        const finalPrice = Math.round(bd.deal.price * (1 - pct / 100))
        return won ? <div style={{ marginTop: 10, fontSize: 12.5 }}>
          <div style={{ color: '#7ee0b8', fontWeight: 700 }}>🏆 مذاکره را بردی — {fa(pct)}٪ تخفیف تا آخرِ هفته: <b>{faB(finalPrice)} تومان</b></div>
          <button style={{ ...btn, padding: '7px 16px', fontSize: 12.5, marginTop: 6 }} disabled={busy}
            onClick={async () => {
              if (!confirm(`«${bd.deal.title.slice(0, 40)}» به ${faB(finalPrice)} تومان (+ مالیات و ثبت) خریده شود؟`)) return
              const d = await api({ action: 'buy', listingId: bd.deal.id, bigDeal: true })
              if (d) { setSt(d); celebrate(); setBd(null); setBdRes(null) }
            }}>👑 خریدِ معاملهٔ بزرگ</button>
        </div> : <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>🚪 مالک کوتاه نیامد{bdRes ? ` (شانسِ تو ${fa(bdRes.chancePct)}٪ بود)` : ''} — این دوره از دست رفت؛ دورِ بعد معاملهٔ تازه‌ای می‌آید.</div>
      })()}
      {bd.tried && bd.wonPct === 0 && !bdRes && !bd.deal.soldTo && !bd.deal.mine && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>🚪 مذاکرهٔ این دوره‌ات شکست خورد — دورِ بعد فرصتِ تازه‌ای می‌آید.</div>}
    </div>}

    {/* 🏛 تالارِ مزایدهٔ هفته (فاز ۴۵ — سند ۲۹ Auction Saga): یک ملکِ واقعی برای همه یکی — لابیِ شایعه‌ها،
        نبردِ زندهٔ پیشنهاد با رقبای شخصیت‌دار (بودجهٔ پنهان + حافظه/انتقام)؛ ارزشِ دقیق را هیچ‌کس نمی‌داند. */}
    {au?.ok && au.auction && (() => {
      const A = au.auction
      const run = auRun
      const live = !!(run && !run.done)
      const finished = !!(run && run.done)
      const rivalOf = (k: string) => (A.rivals || []).find((r: any) => r.key === k)
      const leaderName = run ? (run.leader === 'me' ? 'تو' : run.leader ? (rivalOf(run.leader)?.name || 'رقیب') : 'هنوز کسی') : ''
      const capital = Number(au.capital) || 0
      const doMove = async (m: string) => {
        const d = await api({ action: 'auctionMove', move: m })
        if (!d) return
        setAuRun(d.run); setAuNext(d.nextBid)
        setAu((s: any) => s ? { ...s, win: d.win, capital: d.capital ?? s.capital, entered: true } : s)
        if (d.run?.done) { if (d.run.won) celebrate(); else sfx('warn', st?.soundEnabled !== false) }
      }
      return <div style={{ ...card, borderColor: '#9b8cf0', background: 'linear-gradient(165deg, rgba(155,140,240,.08), rgba(155,140,240,.02) 60%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>🏛 تالارِ مزایدهٔ {A.periodFa || 'هفته'}</b>
          <span style={{ fontSize: 11, color: '#b7aef2', border: '1px solid rgba(155,140,240,.4)', borderRadius: 999, padding: '2px 10px', fontWeight: 700 }} title={A.type.desc}>{A.type.icon} {A.type.fa}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: '#9b8cf0', fontWeight: 800 }}>⏳ <Countdown until={A.expiresAt || 0} onDone={() => { setAu(null); setAuRun(null) }} /></span>
        </div>
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <b>{A.title.slice(0, 70)}</b>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{A.hood}{A.area ? ` · ${fa(A.area)} متر` : ''} · {A.type.desc}</div>
          {/* «ارزشِ واقعی هیچ‌وقت گفته نمی‌شود» — فقط برآوردِ بازه‌ای از نمونه‌های واقعیِ محله (قانون ۱) */}
          {A.estBand
            ? <div style={{ fontSize: 13.5, color: 'var(--gold)', fontWeight: 800, marginTop: 5 }}>برآورد: {faB(A.estBand.lo)} تا {faB(A.estBand.hi)} تومان <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>({A.estNote})</span></div>
            : <div style={{ fontSize: 12, color: '#e8c37a', marginTop: 5 }}>برآورد: پنهان 🤫 <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>— {A.estNote}</span></div>}
          <div style={{ fontSize: 12, color: '#7ee0b8', marginTop: 3 }}>🔔 قیمتِ شروعِ تالار: <b>{faB(A.start)} تومان</b> — چکش کجا بایستد، دستِ شماست</div>
        </div>
        {/* لابی (Part 2): رقبا با شخصیت + شایعه‌هایی که شاید دروغ باشند؛ فاز ۵۰: حریفِ قسم‌خورده از بردهای واقعیِ مکرر */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {(A.rivals || []).map((rv: any) => (
            <span key={rv.key} title={`${rv.ceo} — ${rv.desc}${rv.grudge ? ` · ${fa(rv.grudge)} بار از جلویش برده‌ای؛ دنبالِ تلافی است` : ''}`}
              style={{ fontSize: 11, border: `1px solid ${rv.nemesis ? '#e05252' : rv.grudge ? '#e08a7e' : 'var(--line2)'}`, borderRadius: 999, padding: '3px 10px', background: rv.nemesis ? 'rgba(224,82,82,.1)' : 'var(--bg2)', color: rv.nemesis ? '#ff9d9d' : rv.grudge ? '#e08a7e' : 'var(--text)', boxShadow: rv.nemesis ? '0 0 10px rgba(224,82,82,.25)' : undefined, fontWeight: rv.nemesis ? 700 : 400 }}>
              {rv.icon} {rv.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {rv.style}</span>{rv.nemesis ? ' 💢 قسم‌خورده' : rv.grudge ? ' 😤' : ''}
            </span>
          ))}
        </div>
        {au.duel && <div style={{ fontSize: 11.5, color: '#ff9d9d', fontWeight: 700, marginTop: 7 }}>🔥 {au.duel}</div>}
        {!live && !finished && (A.rumors || []).map((t: string, i: number) => (
          <div key={i} style={{ fontSize: 11.5, color: '#b7aef2', fontStyle: 'italic', marginTop: i ? 3 : 8 }}>🤫 {t}</div>
        ))}
        {au.influence?.pct > 0 && <div style={{ fontSize: 11, color: '#7ee0b8', marginTop: 7 }} title={(au.influence.reasons || []).join(' · ')}>
          ⭐ نفوذِ کسب‌شده‌ات: {fa(au.influence.pct)}٪ — {A.type.influence ? 'در این مزایده فروشنده به نامت اعتماد دارد؛ رقبا باید بیشتر خرج کنند' : 'در مزایده‌های دولتی به کارت می‌آید'}
        </div>}
        {A.soldTo && <div style={{ fontSize: 12, color: '#e8c37a', marginTop: 8 }}>🔒 این ملک را «{A.soldTo.name}» (#{fa(A.soldTo.no)}) زودتر خریده — تالارِ این دوره تعطیل شد.</div>}
        {A.mine && <div style={{ fontSize: 12, color: '#7ee0b8', marginTop: 8 }}>👑 مالِ توست — این دوره چیزی برای جنگیدن نمانده.</div>}
        {!A.soldTo && !A.mine && !au.unlocked && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>🔒 از سطحِ {fa(au.need)} باز می‌شود — با تصمیم‌های واقعی XP بگیر.</div>}
        {/* تصمیمِ اول (سند: «آیا اصلاً شرکت کنم؟») — یک ورود در هفته */}
        {!A.soldTo && !A.mine && au.unlocked && !au.entered && !run && <div style={{ marginTop: 10 }}>
          <button style={{ ...btn, padding: '8px 18px', fontSize: 12.5 }} disabled={busy}
            onClick={async () => {
              if (!confirm('فقط «یک» ورود در هر دوره داری — گاهی بهترین تصمیم شرکت‌نکردن است. واردِ تالار شوی؟')) return
              const d = await api({ action: 'auctionEnter' })
              if (d) { setAuRun(d.run); setAuNext(d.nextBid); setAu((s: any) => s ? { ...s, entered: true, capital: d.capital ?? s.capital } : s); sfx('build', st?.soundEnabled !== false) }
            }}>🚪 ورود به تالار</button>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8 }}>نورِ سالن کم می‌شود؛ هر حرکتت خوانده خواهد شد…</span>
        </div>}
        {au.entered && !run && !au.win && !A.soldTo && !A.mine && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>🚪 مزایدهٔ این دوره‌ات تمام شده — دورِ بعد تالار دوباره باز می‌شود.</div>}
        {/* 🎬 سالنِ زنده (Part 4 Live Bidding): هر حرکت یک تصمیم — قیمتِ بزرگ، صدرنشین، چکش، و رفتارِ رقبا به‌جای عدد */}
        {run && live && <div style={{ marginTop: 12, border: '1px solid rgba(155,140,240,.45)', borderRadius: 14, padding: '14px 14px 12px', background: 'radial-gradient(ellipse 120% 90% at 50% 0%, #191330, #0b0916 78%)', boxShadow: '0 10px 34px -12px rgba(90,70,200,.45)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#b7aef2' }}>{`راندِ ${fa((run.round || 0) + 1)} · صدر: ${leaderName}${run.leader === 'me' ? ' ✅' : ''}`}</span>
            <span style={{ flex: 1 }} />
            {!finished && run.calls > 0 && <span style={{ fontSize: 12, color: '#e8c37a', fontWeight: 800 }}>🔨 {run.calls === 1 ? 'بار اول…' : run.calls === 2 ? 'بار دوم…' : 'آخرین لحظه…'}</span>}
          </div>
          <div style={{ textAlign: 'center', margin: '10px 0 4px' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: run.leader === 'me' ? '#f0d47a' : '#fff', textShadow: run.leader === 'me' ? '0 0 22px rgba(240,212,122,.45)' : '0 0 18px rgba(155,140,240,.35)' }}>
              {run.leader ? `${faB(run.price)} تومان` : `${faB(run.start)} تومان`}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{run.leader ? 'آخرین پیشنهادِ روی میز' : 'قیمتِ پایه — مجری منتظرِ اولین دست است'}</div>
          </div>
          {/* رفتارِ رقبا = سرنخ، نه عدد (Reading The Room) */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', margin: '8px 0' }}>
            {(run.rivals || []).map((rv: any) => {
              const d0 = rivalOf(rv.key)
              return <span key={rv.key} style={{ fontSize: 10.5, borderRadius: 999, padding: '2px 9px', border: '1px solid', borderColor: rv.out ? '#5a5a66' : run.leader === rv.key ? '#f0d47a' : 'rgba(155,140,240,.5)', color: rv.out ? '#77778a' : run.leader === rv.key ? '#f0d47a' : '#cfc8f5', textDecoration: rv.out ? 'line-through' : 'none', opacity: rv.out ? .6 : 1 }}>
                {d0?.icon} {d0?.name}{run.leader === rv.key ? ' 👑' : ''}{rv.out ? ' · رفت' : ''}
              </span>
            })}
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '8px 10px' }}>
            {(run.log || []).slice(-9).map((l: any, i: number) => (
              <div key={i} style={{ fontSize: 11.5, color: i === (run.log || []).slice(-9).length - 1 ? '#fff' : 'var(--muted)', lineHeight: 1.8 }}>{l.icon} {l.text}</div>
            ))}
          </div>
          {live && auNext && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
            <button style={{ ...btn, padding: '8px 14px', fontSize: 12 }} disabled={busy || auNext.bid > capital} title={auNext.bid > capital ? 'سرمایه‌ات به این قیمت نمی‌رسد' : 'پیشنهادِ یک گام بالاتر'}
              onClick={() => doMove('bid')}>🖐 پیشنهاد — {faB(auNext.bid)}</button>
            <button style={{ ...btnGhost, padding: '8px 14px', fontSize: 12, borderColor: '#e08a7e', color: '#e08a7e' }} disabled={busy || auNext.power > capital} title="جهشِ بزرگ برای ترساندنِ رقبا — گران ولی مؤثر"
              onClick={() => doMove('power')}>⚡ حملهٔ سنگین — {faB(auNext.power)}</button>
            <button style={{ ...btnGhost, padding: '8px 14px', fontSize: 12 }} disabled={busy} title="بگذار رقبا با هم بجنگند؛ ولی اگر مجری سه بار بشمارد، چکش می‌خورد"
              onClick={() => doMove('wait')}>🤫 صبر</button>
            <button style={{ ...btnGhost, padding: '8px 14px', fontSize: 12, color: 'var(--muted)' }} disabled={busy} title="کنار کشیدن هم یک تصمیمِ حرفه‌ای است"
              onClick={() => { if (confirm('از مزایده بیرون بروی؟ گاهی برندهٔ واقعی همانی است که به‌موقع رفت.')) doMove('quit') }}>🚪 خروج</button>
          </div>}
        </div>}
        {/* فاز ۷۲ (صداقتِ صحنه): مزایدهٔ تمام‌شده دیگر تختهٔ مردهٔ نبرد را نشان نمی‌دهد — فقط نتیجه + وعدهٔ هفتهٔ بعد */}
        {finished && <div style={{ marginTop: 12, textAlign: 'center', background: 'rgba(0,0,0,.22)', border: '1px solid var(--line2)', borderRadius: 12, padding: '12px 14px' }}>
          {run.won && au.win ? <>
            <div style={{ fontSize: 13, color: '#f0d47a', fontWeight: 800 }}>🏆 «{A.title.slice(0, 40)}» با چکشِ {faB(au.win.price)} تومان به نامت خورد</div>
            <div style={{ fontSize: 11, color: (au.win.price <= run.anchor) ? '#7ee0b8' : '#e08a7e', marginTop: 3 }}>
              {au.win.price <= run.anchor ? `زیرِ قیمتِ آگهی (${faB(run.anchor)}) بستی — رسانه‌ها: «با هوش خرید، نه فقط با پول»` : `بالاتر از قیمتِ آگهی (${faB(run.anchor)}) — حالا باید ثابت کنی که می‌ارزید`}
            </div>
            <button style={{ ...btn, padding: '8px 18px', fontSize: 12.5, marginTop: 8 }} disabled={busy}
              onClick={async () => {
                if (!confirm(`سندِ «${A.title.slice(0, 40)}» به ${faB(au.win.price)} تومان (+ مالیات و ثبت) به نامت بخورد؟`)) return
                const d = await api({ action: 'buy', listingId: A.id, auction: true })
                if (d) { setSt(d); celebrate(); setAu(null); setAuRun(null); setAuNext(null) }
              }}>📜 امضای سند و پرداخت</button>
          </> : <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            🔨 مزایدهٔ این دوره‌ات تمام شد{run.leader && run.leader !== 'me' ? ` — چکش روی ${faB(run.price)} تومان برای ${leaderName} خورد` : ''}. تالار داستانت را یادش می‌مانَد؛ بازگشاییِ تالار: ⏳ <Countdown until={A.expiresAt || 0} />
          </div>}
        </div>}
      </div>
    })()}

    </>}

    {citySheet === 'deals' && <>
    {/* 💸 فاز ۱۸۱ب — راهنمای قفلِ سرمایه: نقدِ واقعی از ارزان‌ترین فرصتِ قابلِ‌خرید کمتر است → دو راهِ واقعی */}
    {st.dealsEnabled && (deals?.deals || []).length > 0 && (() => {
      const buyable = (deals.deals || []).filter((dl: any) => !dl.soldTo && dl.price > 0)
      if (!buyable.length) return null
      const cheapest = Math.min(...buyable.map((dl: any) => nego[dl.id]?.success ? nego[dl.id].finalPrice : dl.price))
      if ((e.capital || 0) >= cheapest) return null
      return (
        <div style={{ ...card, borderColor: 'rgba(232,195,122,.5)', background: 'rgba(232,195,122,.07)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px' }}>
          <span style={{ fontSize: 16 }}>💸</span>
          <span style={{ fontSize: 12, flex: 1, minWidth: 180, lineHeight: 1.9 }}>سرمایهٔ نقدت ({faB(e.capital || 0)} تومان) از ارزان‌ترین فرصتِ امروز ({faB(cheapest)} تومان) کمتر است — یکی از ملک‌هایت را به مشاور بسپار یا وام بگیر.</span>
          <button className="empChunky" style={{ ...btnGhost, padding: '7px 13px', fontSize: 11.5, fontWeight: 800 }} onClick={() => { setCitySheet(''); setGtab('portfolio'); try { window.scrollTo({ top: 0 }) } catch {} }}>💼 پرتفوی</button>
          <button className="empChunky" style={{ ...btnGhost, padding: '7px 13px', fontSize: 11.5, fontWeight: 800 }} onClick={() => { setCitySheet(''); setGtab('market'); setMktV('bank') }}>🏦 بانک</button>
        </div>
      )
    })()}
    {(!st.dealsEnabled || !deals || !(deals.deals || []).length) && <div style={card}>
      <b style={{ fontSize: 13.5 }}>🔥 فرصت‌های طلاییِ امروز</b>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>فرصت‌های امروز از آگهی‌های واقعیِ همین روزِ بازار انتخاب می‌شوند — الان فهرستِ تازه‌ای نیست؛ فردا فهرستِ دیگری می‌آید.</div>
    </div>}
    {/* 🔥 فرصت‌های طلاییِ امروز (سند ۱۴ — Hook): آگهی‌های واقعی، شمارشِ معکوسِ واقعی؛ فردا فهرستِ دیگری می‌آید.
        کارت قضاوت نمی‌کند — بعضی واقعاً زیرِ قیمتِ محله‌اند، بعضی نه؛ فکرکردن (یا ژتونِ تحلیل) کارِ بازیکن است. */}
    {st.dealsEnabled && deals && (deals.deals || []).length > 0 && (() => {
      return (
        <div style={{ ...card, borderColor: 'var(--gold)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14 }}>🔥 فرصت‌های طلاییِ امروز</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>بعضی واقعاً زیرِ قیمتِ محله‌اند، بعضی نه — تشخیصش با توست</span>
            <span style={{ flex: 1 }} />
            {/* شمارشِ معکوسِ ایزوله (فاز ۳۱) — فقط همین عدد هر ثانیه رندر می‌شود، نه کلِ صفحه */}
            <span style={{ fontSize: 13, color: '#e7a14a', fontWeight: 800 }}>⏳ <Countdown until={deals.expiresAt || 0} onDone={() => setDeals(null)} /></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8, marginTop: 10 }}>
            {deals.deals.map((dl: any) => {
              // فاز ۱۸۰ — فرصتِ خریده‌شده توسطِ بازیکنِ واقعیِ دیگر (soldTo از دفترِ مالکیتِ سرور):
              // کم‌رنگ ولی دیده‌شود (FOMO واقعی)، بدجِ نامِ خریدار، دکمهٔ خرید/مذاکره حذف — هیچ عددِ ساختگی.
              const sold180 = !!dl.soldTo
              return (
              <div key={dl.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 5, opacity: sold180 ? .62 : 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7 }}>{dl.title.slice(0, 55)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dl.hood}{dl.area ? ` · ${fa(dl.area)} متر` : ''}{dl.perM ? ` · متری ${faB(dl.perM)}` : ''}</div>
                {/* فاز ۴۱ (سند ۲۸ Part 10): درجهٔ کمیابیِ صادقانه — فقط از فاصلهٔ واقعی با میانهٔ محله؛ بی‌داده = بی‌برچسب */}
                {dl.rarity && dl.rarity.stars >= 2 && <div style={{ fontSize: 10.5, color: dl.rarity.stars >= 3 ? '#f0d47a' : '#7ee0b8', fontWeight: 700 }}>
                  {'✦'.repeat(dl.rarity.stars)} {dl.rarity.label} — متری {fa(Math.abs(dl.rarity.diffPct))}٪ زیرِ میانهٔ محله
                </div>}
                <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{faB(dl.price)} تومان</div>
                {sold180 && <div style={{ fontSize: 11, fontWeight: 800, color: '#e8c37a', background: 'rgba(232,195,122,.1)', border: '1px dashed rgba(232,195,122,.45)', borderRadius: 9, padding: '4px 9px' }}>
                  ✔ خریده‌شده توسطِ «{dl.soldTo.name}» #{fa(dl.soldTo.no)}
                </div>}
                {!sold180 && nego[dl.id] && <div style={{ fontSize: 10.5, color: nego[dl.id].success ? '#7c6' : 'var(--muted)' }}>
                  🤝 {nego[dl.id].owner?.name || 'مالک'}: {nego[dl.id].success ? `${fa(nego[dl.id].discountPct)}٪ تخفیف → ${faB(nego[dl.id].finalPrice)}` : 'کوتاه نیامد'}
                  {nego[dl.id].memoryNote && <div style={{ color: '#e7a14a' }}>🧠 {nego[dl.id].memoryNote}</div>}
                </div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
                  {!sold180 && !nego[dl.id] && <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'negotiate', listingId: dl.id }); if (d) setNego(p => ({ ...p, [dl.id]: d })) }}>🤝 مذاکره</button>}
                  <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy || e.aiTokens <= 0} title="میانهٔ متریِ واقعیِ هم‌محله‌ها را نشان می‌دهد"
                    onClick={async () => { setDealAn(dl.id); await doAnalyze(dl.id) }}>🤖 تحلیل (۱ ژتون)</button>
                  {!sold180 && <button style={{ ...btn, padding: '4px 10px', fontSize: 11 }} disabled={busy}
                    onClick={() => doBuy({ id: dl.id, title: dl.title, hood: dl.hood, price: nego[dl.id]?.success ? nego[dl.id].finalPrice : dl.price, area: dl.area } as any, !!nego[dl.id]?.success)}>می‌خرم</button>}
                  {dl.url && <a href={dl.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, textDecoration: 'none' }}>🔗</a>}
                </div>
                {dealAn === dl.id && analysis && <div style={{ fontSize: 10.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                  <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
                  {analysis.samples > 0 && <div>متریِ این ملک {faB(analysis.minePerM)} · میانگینِ هم‌محله‌ها {faB(analysis.avgPerM)} (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
                  {intelView(analysis)}
                </div>}
              </div>
            )})}
          </div>
        </div>
      )
    })()}

    </>}

    {citySheet === 'lands' && <>
    {/* 🧭 مسیرِ برجِ اول (فاز ۲۴): موتورِ ساخت کامل بود اما از UI پیدا نمی‌شد — این کارت قدمِ بعدی را نشان می‌دهد
        (قانونِ ۴ سؤالِ فصل ۹: وضعیت؟ فرصت؟ اقدامِ بعدی؟ کدام دکمه؟). بعد از تحویلِ برجِ اول محو می‌شود. */}
    {(() => {
      const as = e.assets || []
      const s1 = as.some((a: any) => a.kind === 'land' && a.landPlan === 'build')
      const s2 = as.some((a: any) => a.permit?.status === 'granted')
      const s3 = as.some((a: any) => a.construction)
      const s4 = as.some((a: any) => a.construction?.done) || (e.stats?.projectsDelivered || 0) > 0
      if (s4) return null
      const sD = as.some((a: any) => a.design)
      const steps = [
        { t: 'زمین بخر و برنامه‌اش «ساخت» باشد', done: s1, hint: 'از «🏞 بازارِ زمین» همین پایین' },
        { t: 'با معمار نقشه بریز (طبقات و واحدها)', done: sD || s2 || s3, hint: 'در «پرتفوی» روی زمینت → 📐 قراردادِ معمار' },
        { t: 'پروانهٔ ساخت بگیر', done: s2, hint: 'شهرداری روی نقشهٔ معمار پروانه می‌دهد — طبقهٔ مازاد = ماده۱۰۰' },
        { t: 'نقشه بریز و کلنگ بزن', done: s3, hint: 'بعد از صدورِ پروانه: سازه، کیفیت و هدفِ پروژه را انتخاب کن' },
        { t: 'بساز، پیش‌فروش کن، تحویل بده', done: false, hint: 'کارگاهِ زنده در «پرتفوی» — هزینهٔ روزشمار، رویدادها، پیش‌فروش' },
      ]
      const cur = steps.findIndex(x => !x.done)
      return (
        <div style={{ ...card, borderColor: '#e7a14a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14 }}>🧭 مسیرِ برجِ اول</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>از زمینِ خالی تا تحویلِ پروژه — همه با قیمت‌ها و آگهی‌های واقعی</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }}
              onClick={() => { if (cur === 0) document.getElementById('land-market')?.scrollIntoView({ behavior: 'smooth' }); else setGtab('portfolio') }}>
              {cur === 0 ? '🏞 برو به بازارِ زمین' : '💼 برو به پرتفوی'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, opacity: s.done ? 0.65 : i === cur ? 1 : 0.5 }}>
                <span style={{ color: s.done ? '#7c6' : i === cur ? 'var(--gold)' : 'var(--faint)', fontWeight: 800 }}>{s.done ? '✓' : fa(i + 1)}</span>
                <span style={{ fontWeight: i === cur ? 800 : 500 }}>{s.t}</span>
                {i === cur && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>— {s.hint}</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>
            🏗 شرکتِ ساختمانی و تیمِ مهندسی اجباری نیست، اما مذاکره را قوی‌تر و پروانه را سریع‌تر می‌کند — ثبتش در «پرتفوی»{st.unlocks && !st.unlocks.company?.ok ? ` (از سطحِ ${fa(st.unlocks.company?.need || 0)} باز می‌شود)` : ''}.
          </div>
        </div>
      )
    })()}

    {/* 🏞 بازارِ زمین (فاز ۲۴): زمین‌های واقعیِ قیمت‌دار با متراژِ ثبت‌شده — دروازهٔ موتورِ ساخت */}
    {lands && (
      <div id="land-market" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>🏞 بازارِ زمین — برای ساخت</b>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>زمین‌های واقعیِ الانِ بازار؛ خرید = برنامهٔ «ساخت» و شروعِ مسیرِ برج</span>
        </div>
        {(lands.lands || []).length === 0
          ? <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>الان هیچ زمینِ قیمت‌دار با متراژِ ثبت‌شده در بازارِ واقعی نیست — به‌محضِ ورودِ آگهیِ زمینِ تازه، همین‌جا ظاهر می‌شود.</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8, marginTop: 10 }}>
            {lands.lands.map((l: any) => (
              <div key={l.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 5, opacity: l.locked ? 0.75 : 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7 }}>{l.title.slice(0, 55)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.hood}{l.area ? ` · ${fa(l.area)} متر` : ''}{l.perM ? ` · متری ${faB(l.perM)}` : ''}</div>
                <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{faB(l.price)} تومان</div>
                {l.locked && <div style={{ fontSize: 10.5, color: '#e7a14a' }}>🔒 سرمایهٔ نقدت هنوز به این نمی‌رسد (با مالیاتِ انتقال)</div>}
                {nego[l.id] && <div style={{ fontSize: 10.5, color: nego[l.id].success ? '#7c6' : 'var(--muted)' }}>
                  🤝 {nego[l.id].owner?.name || 'مالک'}: {nego[l.id].success ? `${fa(nego[l.id].discountPct)}٪ تخفیف → ${faB(nego[l.id].finalPrice)}` : 'کوتاه نیامد'}
                  {nego[l.id].memoryNote && <div style={{ color: '#e7a14a' }}>🧠 {nego[l.id].memoryNote}</div>}
                </div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
                  {!nego[l.id] && <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'negotiate', listingId: l.id }); if (d) setNego(p => ({ ...p, [l.id]: d })) }}>🤝 مذاکره</button>}
                  <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy || e.aiTokens <= 0} title="میانهٔ متریِ واقعیِ هم‌محله‌ها را نشان می‌دهد"
                    onClick={async () => { setDealAn(l.id); await doAnalyze(l.id) }}>🤖 تحلیل (۱ ژتون)</button>
                  <button style={{ ...btn, padding: '4px 10px', fontSize: 11 }} disabled={busy || l.locked}
                    onClick={() => doBuyLand(l, !!nego[l.id]?.success)}>⛏ می‌خرم برای ساخت</button>
                  {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, textDecoration: 'none' }}>🔗</a>}
                </div>
                {dealAn === l.id && analysis && <div style={{ fontSize: 10.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                  <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
                  {analysis.samples > 0 && <div>متریِ این ملک {faB(analysis.minePerM)} · میانگینِ هم‌محله‌ها {faB(analysis.avgPerM)} (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
                  {intelView(analysis)}
                </div>}
              </div>
            ))}
          </div>}
      </div>
    )}

    </>}

    {citySheet === 'brief' && <>
    {st.suspense && <div style={{ ...card, borderColor: 'var(--gold)', fontSize: 13 }}>⏳ {st.suspense.text}</div>}
    {st.othersBuilding > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>🌍 {fa(st.othersBuilding)} نفرِ دیگر هم همین حالا در حالِ ساختِ امپراتوری‌شان هستند.</div>}
    {/* 🎪 رویدادهای زندهٔ ادمین (سند ۱۸ — LiveOps): بدونِ دیپلوی از پنل ساخته می‌شوند؛ پیشرفت از رفتارِ واقعی */}
    {(st.liveEvents || []).map((ev: any) => (
      <div key={ev.id} style={{ ...card, borderColor: ev.done && !ev.claimed ? 'var(--gold)' : 'var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>{ev.icon}</span>
          <div style={{ flex: 1, minWidth: 160 }}>
            <b style={{ fontSize: 13.5 }}>{ev.title}</b>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ev.desc}</div>
          </div>
          <span style={{ fontSize: 11, color: '#e7a14a' }}>⏳ تا {new Date(ev.endAt).toLocaleDateString('fa-IR')}</span>
          {ev.claimed
            ? <span style={{ fontSize: 11.5, color: '#7c6' }}>✓ پاداش دریافت شد</span>
            : ev.done
              ? <button style={{ ...btn, padding: '6px 14px', fontSize: 12 }} disabled={busy} onClick={() => doClaim('ev_' + ev.id)}>🎁 دریافتِ پاداش{ev.rewardCoins ? ` (${fa(ev.rewardCoins)} کوین)` : ''}</button>
              : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fa(ev.progress)}/{fa(ev.target)}</span>}
        </div>
        <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 8 }}>
          <div style={{ width: `${Math.round((ev.progress / Math.max(1, ev.target)) * 100)}%`, height: 6, borderRadius: 4, background: ev.done ? '#7c6' : 'var(--gold)', transition: 'width .5s ease' }} />
        </div>
      </div>
    ))}

    {/* پیامِ بازگشت (فصل ۴) + هدیهٔ بازگشت + پیام‌آغازیِ دستیار + نردبانِ رؤیا + زمانِ امروز */}
    {st.welcomeBack && <MJ><b>دلمان برایت تنگ شده بود.</b><br />در نبودت بازار حرکت کرده و ارزشِ دارایی‌هایت دوباره از قیمت‌های واقعی محاسبه شد. همهٔ سرمایه‌گذارهای بزرگ وقفه داشته‌اند — مهم برگشتن است.
      {st.away && (st.away.perMDeltaPct !== null || (st.away.happened || []).length > 0) && <div style={{ marginTop: 8, fontSize: 12, lineHeight: 2 }}>
        <b>در نبودِ تو ({fa(st.away.days)} روز):</b>
        {st.away.perMDeltaPct !== null && <div>📈 میانهٔ متریِ بازار {st.away.perMDeltaPct >= 0 ? `${fa(Math.abs(st.away.perMDeltaPct))}٪ رشد کرد` : `${fa(Math.abs(st.away.perMDeltaPct))}٪ افت کرد`}</div>}
        {(st.away.happened || []).map((h: any, i: number) => <div key={i}>{h.icon} {h.title}</div>)}
      </div>}
      {st.welcomeBack.gift && <div style={{ marginTop: 8 }}><button style={{ ...btn, padding: '6px 14px', fontSize: 12.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'comeback' }); if (d) { setSt(d); alert(`🎁 هدیهٔ بازگشت: ${fa(d.coins)} ملک‌کوین`) } }}>🎁 دریافتِ هدیهٔ بازگشت</button></div>}
    </MJ>}
    {st.mentorLine && !st.welcomeBack && <MJ>{st.mentorLine}</MJ>}
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
      <span style={{ ...card, padding: '8px 14px', color: 'var(--gold)' }}>{st.nextDream}</span>
      {st.dayDelta != null && st.dayDelta !== 0 && <span style={{ ...card, padding: '8px 14px', color: st.dayDelta > 0 ? '#7c6' : '#e88' }}>{st.dayDelta > 0 ? '📈' : '📉'} نسبت به دیروز: {st.dayDelta > 0 ? '+' : '−'}{faB(Math.abs(st.dayDelta))} تومان</span>}
      {st.minutesToday > 0 && <span style={{ ...card, padding: '8px 14px', color: 'var(--muted)' }}>⏱ امروز فقط {fa(st.minutesToday)} دقیقه زمان لازم داری</span>}
    </div>

    {/* صندوقچهٔ روزانه — پاداشِ متغیر (هر روز یک‌بار) */}
    {(st.chest?.available || chestReward) && <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--gold)' }}>
      <span style={{ fontSize: 24 }}>🎁</span>
      {chestReward
        ? <div style={{ fontSize: 13 }}><b>صندوقچهٔ امروز باز شد:</b> {chestReward.kind === 'coins' ? `🪙 ${fa(chestReward.amount)} ملک‌کوین` : chestReward.kind === 'xp' ? `⚡ ${fa(chestReward.amount)} XP` : `🤖 ${fa(chestReward.amount)} ژتونِ تحلیل`}</div>
        : <><div style={{ flex: 1, fontSize: 13 }}>صندوقچهٔ امروزت منتظر است — هیچ‌کس نمی‌داند داخلش چیست.</div>
          <button style={{ ...btn, padding: '6px 14px', fontSize: 13 }} disabled={busy} onClick={doChest}>باز کن</button></>}
    </div>}

    {/* نامهٔ روزانهٔ ملک‌جت — از دادهٔ واقعیِ دیشبِ بازار */}
    {st.brief && <details style={{ ...card, borderColor: st.brief.openedAt ? 'var(--line)' : 'var(--gold)' }} open={!st.brief.openedAt}
      onToggle={(ev: any) => { if (ev.currentTarget.open && !st.brief.openedAt) { api({ action: 'briefOpen' }); setSt((s: any) => ({ ...s, brief: { ...s.brief, openedAt: Date.now() } })) } }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>📬 نامهٔ امروزِ ملک‌جت{!st.brief.openedAt && <span style={{ color: 'var(--gold)', fontSize: 11, marginRight: 8 }}>● جدید</span>}</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {st.brief.items.map((it: any, i: number) => <div key={i} style={{ fontSize: 13, lineHeight: 1.9 }}>{it.icon} {it.text}</div>)}
      </div>
    </details>}

    </>}

    {citySheet === 'map' && <>
    {/* 🗺 نقشهٔ شهر (فصل ۹ «City Screen» — نسخهٔ کامل، فاز ۲۶): پینِ متمایز برای هر نوع + لایه‌های قابل‌تغییر
        + زوم/مرکزِ کاربر هرگز نمی‌پَرد (نگهبانِ داخلِ NeshanMap). کلیک روی دارایی → پرتفوی؛ فرصت/زمین → آگهیِ واقعی. */}
    {(() => {
      const aPts = (e.assets || []).filter((a: any) => a.lat && a.lng)
      const dPts = (deals?.deals || []).filter((dl: any) => dl.lat && dl.lng)
      const lPts = (lands?.lands || []).filter((l: any) => l.lat && l.lng)
      if (!aPts.length && !dPts.length && !lPts.length) return null
      const pts: { id: string; lat: number; lng: number; title?: string; price?: string; icon?: string; color?: string }[] = []
      if (mapL.assets) for (const a of aPts) {
        const building = a.construction && !a.construction.done
        pts.push({ id: 'a_' + a.id, lat: a.lat, lng: a.lng, icon: building ? '🏗' : '🏛', color: building ? '#8a6d1f' : '#c9a84c', title: `${building ? '🏗 کارگاهِ تو' : '🏛 مالِ تو'} — ${a.title?.slice(0, 40)}`, price: faB(a.current || a.buyPrice) })
      }
      if (mapL.deals) for (const dl of dPts) pts.push({ id: 'd_' + dl.id, lat: dl.lat, lng: dl.lng, icon: '🔥', color: '#b3611f', title: `🔥 فرصتِ امروز — ${dl.title?.slice(0, 40)}`, price: faB(dl.price) })
      if (mapL.lands) for (const l of lPts) pts.push({ id: 'l_' + l.id, lat: l.lat, lng: l.lng, icon: '🏞', color: '#3f7a4e', title: `🏞 زمین برای ساخت — ${l.title?.slice(0, 40)}`, price: faB(l.price) })
      const chip = (on: boolean, color: string) => ({ fontSize: 10.5, padding: '4px 10px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${on ? color : 'var(--line2)'}`, background: on ? color + '22' : 'transparent', color: on ? 'var(--text)' : 'var(--faint)', fontFamily: 'inherit' } as React.CSSProperties)
      return (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13.5 }}>🗺 نقشهٔ شهرِ تو</b>
            <span style={{ flex: 1 }} />
            {/* لایه‌ها (فصل ۹): هر لایه روشن/خاموش — شمارِ واقعیِ هر نوع روی چیپ */}
            <button style={chip(mapL.assets, '#c9a84c')} onClick={() => setMapL(m => ({ ...m, assets: !m.assets }))}>🏛 دارایی‌های من ({aPts.length < (e.assets || []).length ? `${fa(aPts.length)} از ${fa((e.assets || []).length)}` : fa(aPts.length)})</button>
            <button style={chip(mapL.deals, '#e7a14a')} onClick={() => setMapL(m => ({ ...m, deals: !m.deals }))}>🔥 فرصت‌های امروز ({fa(dPts.length)})</button>
            <button style={chip(mapL.lands, '#5da36f')} onClick={() => setMapL(m => ({ ...m, lands: !m.lands }))}>🏞 زمین برای ساخت ({fa(lPts.length)})</button>
          </div>
          <div style={{ height: 380 }}>
            <NeshanMap theme="night" height={380} zoom={12}
              center={pts.length ? { lat: pts[0].lat, lng: pts[0].lng } : undefined}
              points={pts}
              onSelect={(id: string) => {
                if (id.startsWith('a_')) { setGtab('portfolio'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
                else if (id.startsWith('d_')) { const dl = dPts.find((x: any) => 'd_' + x.id === id); if (dl?.url) window.open(dl.url, '_blank') }
                else { const l = lPts.find((x: any) => 'l_' + x.id === id); if (l?.url) window.open(l.url, '_blank') }
              }} />
          </div>
          <div style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--faint)' }}>پینِ 🏛 دارایی → صفحهٔ پرتفوی · 🏗 کارگاهِ در حالِ ساخت · 🔥/🏞 → آگهیِ واقعی · زوم و مرکزِ نقشه دستِ خودت می‌ماند{aPts.length < (e.assets || []).length ? ` · ${fa((e.assets || []).length - aPts.length)} داراییِ تو روی نقشه نیست چون آگهیِ واقعی‌اش مختصات ثبت نکرده بود` : ''}</div>
        </div>
      )
    })()}
    </>}
    </BottomSheet>
    </>

    {/* 🧭 فاز ۱۸۲ب — پنلِ quest-logِ راهنمای شروع (سبکِ تراوین): ۷ قدم به‌ترتیب؛ claimed = کم‌رنگ با ✓،
        اولین قدمِ ناتمام = فعال (هایلایتِ طلایی + desc + «برو»)، done && !claimed = دکمهٔ 🎁 (اعداد از state)،
        قدم‌های بعدی = قفلِ کم‌رنگ ولی پیدا (نقشهٔ راه). صفر مکانیکِ تازه — claim همان doClaim با کلیدِ tut_. */}
    {st.tutorial?.active && <BottomSheet open={tutOpen} onClose={() => setTutOpen(false)} title={`🧭 راهنمای شروع — ${fa(st.tutorial.daysLeft)} روزِ باقی‌مانده`}>
      {(() => {
        const tut = st.tutorial
        const total = tut.steps.length
        const activeIdx = tut.steps.findIndex((s2: any) => !s2.claimed)
        return (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.09)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,.4)' }}>
              <div style={{ width: `${(tut.doneCount / Math.max(1, total)) * 100}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#ffd76a,#ff9d2e)', boxShadow: '0 0 10px rgba(255,183,77,.5)' }} />
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}><b style={{ color: '#ffd76a' }}>{fa(tut.doneCount)}</b> از {fa(total)}</span>
          </div>
          {tut.steps.map((s2: any, i: number) => {
            const claimable = s2.done && !s2.claimed
            const isActive = i === activeIdx
            const locked = !s2.claimed && !claimable && !isActive
            return (
              <div key={s2.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 14, padding: '10px 12px', border: `1px solid ${claimable ? 'rgba(255,215,106,.55)' : isActive ? 'rgba(255,215,106,.45)' : 'rgba(255,255,255,.08)'}`, background: claimable ? 'rgba(255,215,106,.10)' : isActive ? 'rgba(255,215,106,.06)' : 'rgba(255,255,255,.03)', opacity: s2.claimed ? .5 : locked ? .55 : 1 }}>
                <span aria-hidden style={{ fontSize: 20, flex: 'none', filter: locked ? 'grayscale(.6)' : 'none' }}>{s2.claimed ? '✅' : s2.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: s2.claimed ? 'var(--muted)' : isActive || claimable ? '#ffe9a3' : 'var(--text)' }}>{fa(i + 1)}. {s2.title}</span>
                    {s2.claimed && <span style={{ fontSize: 10.5, color: '#7ee0b8', fontWeight: 700 }}>✓ دریافت شد</span>}
                    {locked && <span aria-hidden style={{ fontSize: 11, color: 'var(--faint)' }}>🔒</span>}
                  </div>
                  {(isActive || claimable) && <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 2, marginTop: 3 }}>{s2.desc}</div>}
                  {claimable
                    ? <button className="empPulse empChunky" disabled={busy} style={{ ...btn, marginTop: 8, padding: '8px 18px', fontSize: 12.5, borderRadius: 999 }}
                        onClick={async () => { const d = await doClaim('tut_' + s2.id); if (d) fireCityCeleb(Number(d.rewardCoins ?? tut.stepCoins) || 0) }}>
                        🎁 دریافتِ {fa(tut.stepCoins)} سکه + {fa(tut.stepXp)} XP</button>
                    : isActive
                      ? <button className="empChunky" style={{ ...btn, marginTop: 8, padding: '8px 20px', fontSize: 12.5, borderRadius: 999 }} onClick={() => tutGo(s2.go)}>برو ←</button>
                      : null}
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>هر قدم را که کامل کنی، جایزه‌اش همین‌جا آماده می‌شود — همهٔ شرط‌ها از رفتارِ واقعی‌ات سنجیده می‌شوند.</div>
        </>)
      })()}
    </BottomSheet>}

    {/* 🗂 فاز ۱۶۵ — همهٔ بخش‌های قدیمی (پرتفوی/دنیا/مأموریت‌ها/بازار/رتبه‌ها) داخلِ «یک» برگهٔ بزرگ روی شهر
        رندر می‌شوند؛ محتوا و شرط‌های داخلی عیناً همان است — بستنِ برگه = بازگشت به شهر */}
    <BottomSheet open={gtab !== 'city'} onClose={() => setGtab('city')}
      title={({ world: '🏛 تالارِ شهر', portfolio: '💼 پرتفوی', missions: '🎯 مأموریت‌ها', market: '🏪 بازارِ شهر', ranks: '🏆 تالارِ افتخار', hoods: '⚔️ محله‌ها', city: '' } as Record<string, string>)[gtab] || ''}>
    {/* ⚔️ فاز ۱۶۸ — تابلوی محله‌ها: رقابتِ واقعیِ قلمرو از دارایی‌های واقعیِ همهٔ امپراتوری‌ها (action:'hoodBoard') */}
    {gtab === 'hoods' && (() => {
      const board: any[] = hb?.board || []
      const home = String(st.homeHood || hb?.homeHood || '').trim()
      const homeRow = home ? board.find(s => s.hood === home) : null
      const rest = board.filter(s => !homeRow || s.hood !== home)
      const near = board.find(s => s.mine > 0 && s.king && !s.king.isMe && s.gap <= 2)
      const submitHome = async () => {
        const h = homeHoodIn.trim()
        if (!h) return
        const d = await api({ action: 'setHomeHood', hood: h })
        if (d?.ok) { setSt((s: any) => ({ ...s, homeHood: d.homeHood })); setHomeHoodIn(''); setHb(null) }
      }
      // 🔎 فاز ۱۸۵ب — مرورگرِ همهٔ آگهی‌های واقعیِ محله، داخلِ همین برگه (فیدبک: «همه آگهی‌ها رو می‌خوام ببینم،
      // نمی‌شه دوباره میره تو سایت») — مسیرِ اصلی داخلِ دنیاست؛ جستجویِ سایت فقط لینکِ ثانویه.
      const openHoodBrowse = async (hood: string, rowId = '') => {
        setHoodBrowse(hood); setHoodRow(rowId); setHoodL({ loading: true })
        const d = await api({ action: 'hoodListings', hood })
        setHoodL(d?.ok ? d : { failed: true })
      }
      if (hoodBrowse) {
        const rows: any[] = hoodL?.listings || []
        const openable = (li: any) => li.saleable && !li.soldTo && !li.mine
        const backToBoard = () => { setHoodBrowse(''); setHoodL(null); setHoodRow('') }
        return (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="empChunky" style={{ ...btnGhost, padding: '6px 13px', fontSize: 12, fontWeight: 800, fontFamily: 'inherit' }} onClick={backToBoard}>→ بازگشت به تابلو</button>
            <b style={{ fontSize: 15, fontWeight: 900 }}>🔎 آگهی‌های واقعیِ {hoodBrowse}</b>
            <span style={{ flex: 1 }} />
            {hoodL?.ok && <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{hoodL.capped ? `${fa(rows.length)} از ${fa(hoodL.total)} آگهی — فروشی‌های قیمت‌دار اول` : `${fa(hoodL.total)} آگهی`}</span>}
            <a href={`/search?hood=${encodeURIComponent(hoodBrowse)}`} target="_blank" rel="noopener" style={{ fontSize: 10.5, color: 'var(--faint)', textDecoration: 'none', whiteSpace: 'nowrap' }}>↗ در جستجوی سایت</a>
          </div>
          {hoodBuyOk?.hood === hoodBrowse && (
            <div style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 700, background: 'rgba(126,224,184,.08)', border: '1px solid rgba(126,224,184,.35)', borderRadius: 12, padding: '7px 11px' }}>
              ✓ به نامت شد — یک قدم به فرمانرواییِ {hoodBrowse} نزدیک‌تر شدی؛ تابلو هم تازه شد.
            </div>
          )}
          {hoodL?.loading && <div style={{ fontSize: 12, color: 'var(--muted)' }}>در حال آوردنِ آگهی‌های واقعیِ محله...</div>}
          {hoodL?.failed && <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)' }}>فهرست نیامد — دوباره تلاش کن. <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, fontFamily: 'inherit' }} onClick={() => openHoodBrowse(hoodBrowse, hoodRow)}>🔄 دوباره</button></div>}
          {hoodL?.ok && rows.length === 0 && <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>فعلاً آگهیِ در دسترسی در این محله ثبت نشده — <a href={`/search?hood=${encodeURIComponent(hoodBrowse)}`} target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>↗ در جستجوی سایت</a></div>}
          {rows.map((li: any) => {
            const open = hoodRow === li.id
            const ng = nego[li.id]
            const payPrice = ng?.success ? ng.finalPrice : li.priceNum
            const lowCap = li.priceNum > 1e6 && (e.capital || 0) < payPrice
            return (
              <div key={li.id} style={{ ...card, padding: '10px 12px', opacity: li.soldTo ? .62 : 1, borderColor: open ? 'rgba(255,215,106,.5)' : li.mine ? 'rgba(126,224,184,.4)' : 'var(--line)' }}>
                <div onClick={() => { if (openable(li)) setHoodRow(open ? '' : li.id) }} role={openable(li) ? 'button' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', cursor: openable(li) ? 'pointer' : 'default' }}>
                  <span style={{ flex: 1, minWidth: 150, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏠 {li.title}</span>
                  {li.area && <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fa(Number(li.area) || 0)} متر</span>}
                  {li.saleable
                    ? <b style={{ color: 'var(--gold)', fontSize: 12, whiteSpace: 'nowrap' }}>{li.price}</b>
                    : <span style={{ fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>بدونِ قیمتِ فروش</span>}
                  {li.soldTo && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#e8c37a', background: 'rgba(232,195,122,.1)', border: '1px dashed rgba(232,195,122,.45)', borderRadius: 9, padding: '3px 8px', whiteSpace: 'nowrap' }}>🤝 خریده‌شده توسطِ {li.soldTo.name} #{fa(li.soldTo.no)}</span>}
                  {li.mine && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7ee0b8', background: 'rgba(126,224,184,.08)', border: '1px solid rgba(126,224,184,.35)', borderRadius: 9, padding: '3px 8px', whiteSpace: 'nowrap' }}>🏛 برجِ توست</span>}
                  {openable(li) && <span aria-hidden style={{ fontSize: 9, color: 'var(--faint)' }}>{open ? '▴' : '▾'}</span>}
                </div>
                {open && openable(li) && (
                  <div style={{ marginTop: 8, borderTop: '1px dashed var(--line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {/* نتیجهٔ مذاکرهٔ واقعی (هر آگهی یک‌بار — حافظهٔ مالک): پرسونای مالک + نتیجهٔ صادقانه */}
                    {ng && (
                      <div style={{ fontSize: 11.5, lineHeight: 1.9, color: ng.success ? '#7ee0b8' : 'var(--muted)' }}>
                        🤝 مالک: <b style={{ color: 'var(--text)' }}>{ng.owner?.name || 'مالک'}</b>{ng.owner?.desc ? <span style={{ color: 'var(--muted)' }}> — {ng.owner.desc}</span> : null}
                        <div>{ng.success
                          ? <>راضی شد: <b>{fa(ng.discountPct)}٪ تخفیف</b> → <b style={{ color: 'var(--gold)' }}>{faB(ng.finalPrice)} تومان</b></>
                          : 'کوتاه نیامد — اگر می‌خواهی، با قیمتِ کامل بخر.'}</div>
                        {ng.memoryNote && <div style={{ color: '#e7a14a' }}>🧠 {ng.memoryNote}</div>}
                      </div>
                    )}
                    {/* تحلیلِ واقعیِ ملک‌جت — همان الگوی فرصت‌ها (verdict/valuation/decision + ژتونِ باقی‌مانده) */}
                    {dealAn === li.id && analysis && (
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                        <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
                        {analysis.samples > 0 && <div>متریِ این ملک {faB(analysis.minePerM)} · میانگینِ هم‌محله‌ها {faB(analysis.avgPerM)} (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
                        {intelView(analysis)}
                        <div style={{ color: 'var(--faint)', marginTop: 3 }}>🤖 ژتون‌های باقی‌مانده: {fa(e.aiTokens)}</div>
                      </div>
                    )}
                    {/* فاز ۱۸۱ب — سرمایه کم است: به‌جای دکمهٔ خریدِ فعال، دو راهِ واقعی */}
                    {lowCap && (
                      <div style={{ borderRadius: 12, border: '1px solid rgba(232,195,122,.5)', background: 'rgba(232,195,122,.07)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px' }}>
                        <span style={{ fontSize: 14 }}>💸</span>
                        <span style={{ fontSize: 11.5, flex: 1, minWidth: 160, lineHeight: 1.9 }}>سرمایهٔ نقدت ({faB(e.capital || 0)} تومان) از قیمتِ این آگهی کمتر است — یکی از ملک‌هایت را به مشاور بسپار یا وام بگیر.</span>
                        <button className="empChunky" style={{ ...btnGhost, padding: '6px 11px', fontSize: 11, fontWeight: 800, fontFamily: 'inherit' }} onClick={() => setGtab('portfolio')}>💼 پرتفوی</button>
                        <button className="empChunky" style={{ ...btnGhost, padding: '6px 11px', fontSize: 11, fontWeight: 800, fontFamily: 'inherit' }} onClick={() => { setGtab('market'); setMktV('bank') }}>🏦 بانک</button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {!ng && <button style={{ ...btnGhost, padding: '5px 11px', fontSize: 11.5, fontFamily: 'inherit' }} disabled={busy}
                        onClick={async () => { const d = await api({ action: 'negotiate', listingId: li.id }); if (d) setNego(p => ({ ...p, [li.id]: d })) }}>🤝 مذاکره</button>}
                      <button style={{ ...btnGhost, padding: '5px 11px', fontSize: 11.5, fontFamily: 'inherit' }} disabled={busy || e.aiTokens <= 0} title="میانهٔ متریِ واقعیِ هم‌محله‌ها را نشان می‌دهد"
                        onClick={async () => { setDealAn(li.id); await doAnalyze(li.id) }}>🧮 تحلیلِ ملک‌جت (۱ ژتون)</button>
                      {!lowCap && <button className="empChunky" style={{ ...btn, padding: '6px 14px', fontSize: 11.5, fontFamily: 'inherit' }} disabled={busy}
                        onClick={async () => {
                          // همان مسیرِ واقعیِ خرید (۱۸۴): تخفیفِ مذاکره سمتِ سرور قطعی اعمال می‌شود
                          const d = await api({ action: 'buy', listingId: li.id, negotiated: !!ng?.success })
                          if (d) { setSt(d); celebrate(); setHoodBuyOk({ id: li.id, hood: hoodBrowse }); setHb(null); const d2 = await api({ action: 'hoodListings', hood: hoodBrowse }); if (d2?.ok) setHoodL(d2) }
                        }}>{ng?.success ? `🛒 خرید با ${fa(ng.discountPct)}٪ تخفیف — ${faB(ng.finalPrice)} تومان` : '🛒 خرید'}</button>}
                      <a href={`/property/${li.id}`} target="_blank" rel="noopener" style={{ ...btnGhost, textDecoration: 'none', padding: '5px 11px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>↗ دیدنِ آگهی</a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>)
      }
      const hoodCard = (s: any, isHome: boolean) => (
        <div key={s.hood} style={{ ...card, borderColor: isHome ? 'rgba(255,215,106,.6)' : s.king?.isMe ? 'rgba(126,224,184,.45)' : 'var(--line)', background: isHome ? 'linear-gradient(180deg, rgba(255,215,106,.10), rgba(255,255,255,.02))' : 'rgba(255,255,255,.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isHome && <span style={tagChip('#ffd76a')}>🏠 محلهٔ خانهٔ تو</span>}
            <b style={{ fontSize: 16, fontWeight: 900 }}>{s.hood}</b>
            <span style={{ flex: 1 }} />
            {s.owners > 0 && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{fa(s.owners)} امپراتوری این‌جا ملک دارند</span>}
          </div>
          <div style={{ marginTop: 7, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {s.king
              ? s.king.isMe
                ? <div style={{ color: '#ffe9a3', fontWeight: 900 }}>👑 تو فرمانروایی! ({fa(s.king.count)} ملک){s.total > s.mine ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> — رقیب‌ها {fa(s.total - s.mine)} ملک دارند؛ قلمرو را نگه دار</span> : null}</div>
                : <div>👑 فرمانروا: <b>{s.king.name}</b> <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>#{fa(s.king.no)}</span> با <b style={{ color: '#ffe9a3' }}>{fa(s.king.count)}</b> ملک</div>
              : <div style={{ color: 'var(--muted)' }}>هنوز فرمانروایی ندارد — اولین ملکِ واقعی، تاج را می‌آورد.</div>}
            <div style={{ color: 'var(--muted)' }}>تو: <b style={{ color: 'var(--text)' }}>{fa(s.mine)}</b> ملک{!s.king?.isMe && <> — تا فرمانروایی: <b style={{ color: '#ff9d6b' }}>{fa(s.gap)}</b> ملک</>}</div>
          </div>
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px dashed var(--line)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5 }}>
            {s.listings > 0 ? <>
              <span style={{ color: '#7ee0b8', fontWeight: 700 }}>🔎 {fa(s.listings)} آگهیِ واقعی در این محله</span>
              {/* فاز ۱۸۵ب — مسیرِ اصلی: مرورگرِ همهٔ آگهی‌ها داخلِ همین برگه (نه سایت) */}
              <button className="empChunky" onClick={() => openHoodBrowse(s.hood)}
                style={{ ...btn, padding: '5px 13px', fontSize: 11.5, fontFamily: 'inherit' }}>دیدنِ همهٔ آگهی‌ها</button>
              {/* چیپِ نمونه (۱۸۴→۱۸۵ب): همان ردیفِ کاملِ مرورگر را باز می‌کند — تحلیل/مذاکره/خرید یک‌جا */}
              {(s.samples || []).map((sm: any) => (
                <button key={sm.id} onClick={() => openHoodBrowse(s.hood, sm.id)} className="empChunky"
                  style={{ ...btnGhost, padding: '5px 11px', fontSize: 11, display: 'inline-flex', gap: 5, alignItems: 'center', maxWidth: 260, fontFamily: 'inherit' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏠 {sm.title?.slice(0, 28)}</span>
                  {sm.price && <b style={{ color: 'var(--gold)', whiteSpace: 'nowrap' }}>{sm.price}</b>}
                  <span aria-hidden style={{ fontSize: 9, color: 'var(--faint)' }}>▾</span>
                </button>
              ))}
              {/* جستجویِ سایت به لینکِ ثانویه تنزل کرد — دنیا هرگز unload نمی‌شود */}
              <a href={`/search?hood=${encodeURIComponent(s.hood)}`} target="_blank" rel="noopener" style={{ color: 'var(--faint)', fontSize: 10.5, textDecoration: 'none', whiteSpace: 'nowrap' }}>↗ در جستجوی سایت</a>
            </> : <span style={{ color: 'var(--faint)' }}>فعلاً آگهیِ در دسترسی این‌جا ثبت نشده — <a href={`/search?hood=${encodeURIComponent(s.hood)}`} target="_blank" rel="noopener" style={{ color: 'var(--gold)' }}>↗ در جستجوی سایت</a></span>}
          </div>
          {/* 🎉 فاز ۱۸۴ — خریدِ موفقِ همین جلسه در این محله: پیام مستقل از سرنوشتِ نمونه در تابلوی تازه */}
          {hoodBuyOk?.hood === s.hood && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#7ee0b8', fontWeight: 700, background: 'rgba(126,224,184,.08)', border: '1px solid rgba(126,224,184,.35)', borderRadius: 12, padding: '7px 11px' }}>
              ✓ به نامت شد — یک قدم به فرمانرواییِ {s.hood} نزدیک‌تر شدی؛ تابلو همین حالا تازه شد.
            </div>
          )}
        </div>
      )
      return (<>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2 }}>هر محله یک قلمرو است: هر ملکِ واقعی که این‌جا به دست بیاوری، یک قدم به فرمانرواییِ محله نزدیک‌تری — همه‌چیز از دارایی‌های واقعیِ امپراتوری‌هاست.</div>
        {!home && (
          <div style={{ ...card, borderColor: 'rgba(255,215,106,.5)', background: 'linear-gradient(180deg, rgba(255,215,106,.08), rgba(255,255,255,.02))' }}>
            <b style={{ fontSize: 14 }}>🏠 خانه‌ات کدام محله است؟</b>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', margin: '5px 0 9px' }}>محلهٔ خانه‌ات را بگو تا نشانت بدهیم چه کسی الان صاحبِ آن است.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={homeHoodIn} onChange={ev => setHomeHoodIn(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') submitHome() }} placeholder="مثلاً سعادت‌آباد"
                style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} maxLength={60} />
              <button className="empChunky" style={{ ...btn, padding: '9px 20px', fontSize: 13 }} disabled={busy || !homeHoodIn.trim()} onClick={submitHome}>ثبتِ محلهٔ خانه</button>
            </div>
          </div>
        )}
        {near && (
          <div className="empPulse" style={{ borderRadius: 14, padding: '10px 14px', fontSize: 13, fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg,#e02f2f,#ff9d2e)', border: '1px solid rgba(255,215,106,.6)', boxShadow: '0 6px 20px rgba(224,47,47,.4)' }}>
            ⚔️ فقط {fa(near.gap)} ملک تا فرمانرواییِ {near.hood}!
          </div>
        )}
        {!hb && <div style={{ fontSize: 12, color: 'var(--muted)' }}>در حال بارگذاریِ تابلوی محله‌ها...</div>}
        {hb && board.length === 0 && <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>هنوز هیچ محله‌ای صاحب ندارد — اولین ملکِ واقعی را بخر تا نامت روی تابلو بنشیند{!home ? '؛ یا اول محلهٔ خانه‌ات را همین بالا ثبت کن' : ''}.</div>}
        {homeRow && hoodCard(homeRow, true)}
        {home && !homeRow && hb && board.length > 0 && null}
        {rest.map((s: any) => hoodCard(s, false))}
      </>)
    })()}
    {gtab === 'portfolio' && <>
    {tabHead('💼', 'پرتفوی', 'هر دارایی یک تکه از رؤیای توست — زنده از بازارِ واقعی')}
    {/* فاز ۱۰۳ (جلد ۳): Prestige + درختِ مهارت — بازتولدِ داوطلبانه با مهارتِ ماندگار */}
    <PrestigeCard api={api} busy={busy} onDone={(d: any) => { setSt(d); celebrate() }} />
    {/* ارزشِ خالص (زنده از بازارِ واقعی) — فاز ۱۶۰: کاشی‌های شیشه‌ایِ آمار؛ همان اعداد با شمارشِ متحرک (جلد ۵۶) */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
      <div style={statTile}><div style={{ fontSize: 11, color: 'var(--muted)' }}>👑 ارزشِ خالص</div><div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)', marginTop: 4, textShadow: '0 0 14px rgba(212,175,55,.35)' }}><CountUp value={st.netWorth || 0} format={faB} /> تومان</div></div>
      <div style={statTile}><div style={{ fontSize: 11, color: 'var(--muted)' }}>💵 سرمایهٔ نقد</div><div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}><CountUp value={e.capital} format={faB} /> تومان</div></div>
      <div style={statTile}><div style={{ fontSize: 11, color: 'var(--muted)' }}>🏙 ارزشِ دارایی‌ها (زنده)</div><div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}><CountUp value={st.assetsValue || 0} format={faB} /> تومان {st.growth ? <span style={{ fontSize: 12, color: st.growth > 0 ? '#7c6' : '#e88' }}>({st.growth > 0 ? '+' : ''}{st.growth.toLocaleString('fa-IR')}٪)</span> : null}</div></div>
      {(e.realized || 0) !== 0 && <div style={statTile}><div style={{ fontSize: 11, color: 'var(--muted)' }}>📈 سودِ تحقق‌یافته (فروش‌ها)</div><div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: e.realized > 0 ? '#7c6' : '#e88' }}>{e.realized > 0 ? '+' : '−'}<CountUp value={Math.abs(e.realized)} format={faB} /> تومان</div></div>}
    </div>
    {/* فاز ۱۸۰ (۳) — نبضِ امپراتوری کنارِ آمارِ پرتفوی: همان چیپِ HUD + دلتای دیروز (هر دو عددِ واقعیِ سرور) */}
    {(pulseChip || (st.dayDelta != null && st.dayDelta !== 0)) && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
      {pulseChip}
      {st.dayDelta != null && st.dayDelta !== 0 && <span style={{ ...pill(), color: st.dayDelta > 0 ? '#7ee0b8' : '#e08a7e', fontWeight: 700 }}>{st.dayDelta > 0 ? '📈' : '📉'} نسبت به دیروز: {st.dayDelta > 0 ? '+' : '−'}{faB(Math.abs(st.dayDelta))} تومان</span>}
    </div>}

    {/* شرکتِ ساختمانی (جلد ۶۱): «از یک اتاقِ کوچک تا امپراتوری» — سطح‌گشا (سند ۱۵: امکانات باز می‌شوند، نه اعداد) */}
    {st.companyEnabled && !st.company && st.unlocks && !st.unlocks.company.ok && (
      <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <span><b style={{ color: 'var(--text)' }}>شرکتِ ساختمانی</b> از سطحِ {fa(st.unlocks.company.need)} باز می‌شود — الان سطحِ {fa(st.unlocks.level)} هستی. با تصمیم‌های واقعی XP بگیر؛ فصلِ تازه‌ای از امپراتوری منتظرت است.</span>
      </div>
    )}
    {st.companyEnabled && (!st.company && st.unlocks?.company.ok ? (
      <div style={{ ...card, borderColor: 'var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>🏗</span>
          <div><b style={{ fontSize: 14 }}>شرکتِ ساختمانی‌ات را ثبت کن</b>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>هنوز هیچ‌چیز نداری — نه برند، نه تیم. از یک دفترِ کوچک شروع کن؛ اعتبار با پروژه‌های واقعی ساخته می‌شود.</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={co.name} onChange={ev => setCo({ ...co, name: ev.target.value })} placeholder="نامِ شرکت (مثلاً آسمان‌سازه)" style={{ flex: 1, minWidth: 170, padding: 9, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
          {['مسکونی', 'تجاری', 'لوکس', 'انبوه‌سازی'].map(k => <button key={k} style={{ ...btnGhost, padding: '6px 10px', fontSize: 12, borderColor: co.kind === k ? 'var(--gold)' : 'var(--line2)', color: co.kind === k ? 'var(--gold)' : 'var(--text)' }} onClick={() => setCo({ ...co, kind: k })}>{k}</button>)}
          {['#c9a84c', '#5b9bd5', '#5fd98a', '#e7674a'].map(c => <button key={c} onClick={() => setCo({ ...co, color: c })} style={{ width: 22, height: 22, borderRadius: 999, background: c, border: co.color === c ? '2px solid var(--text)' : '1px solid var(--line2)', cursor: 'pointer' }} />)}
          <button style={{ ...btn, padding: '8px 16px', fontSize: 13 }} disabled={busy || !co.name.trim()} onClick={async () => { const d = await api({ action: 'company', ...co }); if (d) { setSt(d); celebrate() } }}>ثبتِ شرکت</button>
        </div>
      </div>
    ) : st.company ? (
      <div style={{ ...card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: st.company.color, display: 'inline-block' }} />
          <b style={{ fontSize: 14 }}>🏗 {st.company.name}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{st.company.kind}</span>
          <span title={st.company.reputation.factors.join(' · ')} style={{ fontSize: 13, color: 'var(--gold)' }}>{'⭐'.repeat(st.company.reputation.stars)}<span style={{ fontSize: 10.5, color: 'var(--faint)' }}> اعتبار {fa(st.company.reputation.score)}/۱۰۰</span></span>
          <span style={{ flex: 1 }} />
          <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={async () => { if (hireL) { setHireL(null); return } const d = await api({ action: 'hireList' }); if (d) setHireL(d) }}>👷 استخدامِ مهندس</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{st.company.reputation.factors.join(' · ')}</div>
        {st.company.engineers.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {st.company.engineers.map((en: any) => <span key={en.id} title={en.persona} style={{ ...card, padding: '5px 10px', fontSize: 11.5, background: 'var(--bg2)' }}>👷 {en.name} · مهارت {fa(en.skill)} · {faB(en.salaryMonthly)}/ماه</span>)}
          <span style={{ fontSize: 10.5, color: 'var(--faint)', alignSelf: 'center' }}>مهارتِ تیم مذاکره و پروانه را قوی‌تر می‌کند · حقوقِ پرداختی: {faB(st.company.wagesPaid || 0)}</span>
        </div>}
        {hireL && <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>نامزدهای این هفته ({fa(hireL.team)}/{fa(hireL.maxEngineers)} نفر استخدام‌شده) — هفتهٔ بعد نامزدهای تازه می‌آیند:</div>
          {!(hireL.candidates || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>نامزدِ تازه‌ای نمانده — هفتهٔ بعد برگرد.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
            {(hireL.candidates || []).map((c: any) => (
              <div key={c.id} style={{ ...card, background: 'var(--bg2)' }}>
                <b style={{ fontSize: 13 }}>👷 {c.name}</b>
                <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0' }}>{c.persona}</div>
                <div style={{ fontSize: 12 }}>مهارت <b style={{ color: 'var(--gold)' }}>{fa(c.skill)}</b> · حقوق {faB(c.salaryMonthly)}/ماه</div>
                {(c.effects || []).length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.effects.map((fx: string, i: number) => <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '1px solid var(--line2)', color: '#7c6' }}>{fx}</span>)}
                </div>}
                <button style={{ ...btn, padding: '6px 12px', fontSize: 12, marginTop: 8 }} disabled={busy} onClick={async () => { const d = await api({ action: 'hire', candId: c.id }); if (d) { setSt(d); setHireL(null); celebrate() } }}>استخدام</button>
              </div>
            ))}
          </div>
        </div>}
      </div>
    ) : null)}

    </>}

    {gtab === 'world' && <>
    {tabHead('🌍', 'دنیا', 'کتابِ تاریخ، شایعات، شهرها، شرکت‌ها و روزنامه — همه از رخدادهای واقعی')}
    {/* ⚡ فاز ۱۶۸ — سادگیِ اول-نگاه: یک جمله + حداکثر ۳ کارتِ بزرگ؛ بقیه داخلِ «همهٔ امکانات» */}
    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>اینجا نبضِ شهر دستِ توست: رویدادِ روز را ببین، تاریخِ واقعی را بخوان، رقیب و متحد پیدا کن.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      {(() => {
        const lev = (st.liveEvents || []).find((ev: any) => ev.endAt && ev.endAt > Date.now())
        return (
          <button className="empChunky" onClick={() => { setGtab('city'); setCitySheet('events') }}
            style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={iconSq('#ff9d2e')}>🎪</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13.5 }}>رویدادِ روز</b>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lev ? <>{lev.icon} {lev.title} · ⏳ <Countdown until={lev.endAt} /></> : wd?.gov ? <>🏛 {wd.gov.now}</> : 'رویدادها و مزایده‌های زنده را ببین'}
              </span>
            </span>
          </button>
        )
      })()}
      <button className="empChunky" onClick={() => setAllFx(true)}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#57c2ff')}>🗞</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>کتابِ تاریخِ شهر</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(wd?.history || []).length > 0 ? <>{wd.history[0].icon} {wd.history[0].title}</> : 'رخدادهای واقعیِ امپراتوری‌ها'}
          </span>
        </span>
      </button>
      <button className="empChunky" onClick={() => { setGtab('market'); setMktV('players') }}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#7d6ef0')}>🤝</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>دوئل و اتحاد</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>با امپراتورهای واقعی رقابت یا هم‌پیمانی کن</span>
        </span>
      </button>
    </div>
    <details open={allFx} onToggle={(ev: any) => setAllFx(!!ev.currentTarget.open)} style={{ ...card, padding: '12px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>🧰 همهٔ امکاناتِ تالارِ شهر</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
    {/* 🗞 دنیای زنده (فاز ۶۳ — سند ۳۲ فصل ۲۱): سالِ دنیا + کتابِ تاریخ + شایعاتِ منصفانه — همه از رخدادِ واقعی */}
    {wd?.ok && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* فاز ۱۶۳ — دنیای زنده: دیگر دیوارِ متن نیست؛ هر بخش یک پنلِ بازی با سربرگِ خودش */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px' }}>
        <span style={{ ...iconSq('#7d6ef0'), width: 38, height: 38, fontSize: 19, borderRadius: 12 }}>🗞</span>
        <b style={{ fontSize: 15, fontWeight: 900 }}>دنیای زنده</b>
        <span style={{ ...tagChip('#ffd76a'), fontSize: 11 }}>سالِ {fa(wd.year.year)} — روزِ {fa(wd.year.dayOfYear)}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>دنیا حتی وقتی نیستی هم حرکت می‌کند — این‌ها واقعاً رخ داده‌اند</span>
      </div>
      {/* 🎑 مناسبتِ واقعیِ تقویم (فاز ۷۱ — Real World Integration lite): دنیا با زندگیِ واقعی نفس می‌کشد */}
      {wd.occasion && <div style={{ fontSize: 12, color: 'var(--gold)', background: 'rgba(212,175,55,.07)', border: '1px solid var(--goldDim)', borderRadius: 12, padding: '8px 12px' }}>{wd.occasion.icon} {wd.occasion.text}</div>}

      {/* 🏛 مصوبهٔ شهر (فاز ۷۰) — فاز ۱۶۳: بنرِ فرمانِ کاغذی-طلایی با CTA چانکی؛ همان متن و هندلرها */}
      {wd.gov && <div style={{ background: 'linear-gradient(180deg, rgba(255,215,106,.15), rgba(212,175,55,.05))', border: '2px solid rgba(212,175,55,.45)', borderRadius: 18, padding: '12px 14px', fontSize: 12, lineHeight: 2.1, boxShadow: '0 3px 0 rgba(90,60,10,.35), inset 0 1px 0 rgba(255,255,255,.12)', display: 'flex', gap: 12 }}>
        <span style={{ ...iconSq('#ffd76a'), width: 46, height: 46, fontSize: 23 }}>🏛</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div><b style={{ fontWeight: 900 }}>مصوبهٔ این هفته:</b> {wd.gov.now} <span style={tagChip('#ffd76a')}>مالیاتِ مؤثرِ انتقال: {fa(wd.gov.taxNow)}٪</span></div>
          <div style={{ color: 'var(--muted)' }}>📣 <b>اعلامِ پیشاپیش — هفتهٔ بعد:</b> {wd.gov.next} <span style={{ color: 'var(--faint)', fontSize: 10 }}>· الان برنامه‌ریزی کن</span></div>
          {/* فاز ۷۸: مصوبه فقط خبر نیست — همان‌جا اقدام کن */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button className="empChunky" style={{ ...btn, padding: '6px 14px', fontSize: 11.5 }} onClick={() => { setGtab('city'); setCityV('deals'); try { window.scrollTo({ top: 0 }) } catch {} }}>🔥 با این نرخ برو سراغِ فرصت‌های امروز</button>
            <button style={{ ...btnGhost, padding: '6px 14px', fontSize: 11.5 }} onClick={() => { setGtab('market'); setMktV('players'); try { window.scrollTo({ top: 0 }) } catch {} }}>🏪 بازارِ امپراتورها</button>
          </div>
        </div>
      </div>}
      {(wd.history || []).length > 0 ? <>
        {qSection('🗞', 'روزنامهٔ شهر — رخدادهای واقعی', '#57c2ff')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wd.history.slice(0, 6).map((h: any, i: number) => {
            {/* فاز ۶۷ (World Feed تعاملی): خبرِ دنبال‌شده هایلایت + تبریک و دنبال‌کردن از همان‌جا */}
            const followed = h.no && (wd.following || []).includes(h.no)
            const isPlayer = h.no && h.no < 9000 && h.no !== wd.myNo
            return (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, alignItems: 'center', padding: '6px 10px', borderRadius: 12, background: followed ? 'rgba(212,175,55,.08)' : 'rgba(255,255,255,.04)', border: followed ? '1px solid rgba(212,175,55,.5)' : '1px solid rgba(255,255,255,.07)' }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(87,194,255,.12)', border: '1px solid rgba(87,194,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>{h.icon}</span>
                <span title={h.detail || ''} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{followed && <b style={{ color: 'var(--gold)', fontSize: 9.5 }}>⭐ </b>}{h.title}</span>
                {isPlayer && <button title={(wd.kudosGiven || []).includes(h.no) ? 'قبلاً تبریک گفته‌ای' : 'تبریک به این امپراتوری'} disabled={busy || (wd.kudosGiven || []).includes(h.no)} onClick={async () => { const d = await api({ action: 'kudos', no: h.no }); if (d?.ok) { setWd({ ...wd, kudosGiven: [...(wd.kudosGiven || []), h.no] }); celebrate() } }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, opacity: (wd.kudosGiven || []).includes(h.no) ? 0.4 : 1 }}>👏</button>}
                {h.no && h.no !== wd.myNo && <button title={followed ? 'لغوِ دنبال‌کردن' : 'دنبال‌کردن — خبرهایش در فید هایلایت می‌شود'} disabled={busy} onClick={async () => { const d = await api({ action: 'follow', no: h.no, on: !followed }); if (d?.ok) setWd({ ...wd, following: d.following }) }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: followed ? 'var(--gold)' : 'var(--faint)' }}>{followed ? '★' : '☆'}</button>}
                <span style={tagChip('#9aa0b8')}>{agoFa(h.day, wd.day)}</span>
              </div>
            )
          })}
        </div>
        {(wd.history || []).length > 6 && <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--gold)' }}>📜 کتابِ تاریخِ دنیا ({fa(wd.history.length)} رخداد)</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {wd.history.slice(6).map((h: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline', color: 'var(--muted)' }}>
                <span>{h.icon}</span><span style={{ flex: 1 }}>{h.title}</span><span style={{ color: 'var(--faint)', fontSize: 9.5 }}>{agoFa(h.day, wd.day)}</span>
              </div>
            ))}
          </div>
        </details>}
      </> : <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>کتابِ تاریخِ این دنیا هنوز خالی است — اولین شگفتی، اولین برج، اولین چکش… تاریخ را امپراتورهای واقعی می‌نویسند.</div>}
      {(wd.rumors?.current || []).length > 0 && <>
        {qSection('👂', 'شایعه‌های این هفته — شایعه است، نه خبر', '#e0955f')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wd.rumors.current.map((r: any) => (
            <div key={r.id} style={{ background: 'rgba(255,255,255,.04)', border: '1px dashed rgba(224,149,95,.45)', borderRadius: 14, padding: '9px 12px', fontSize: 11.5, display: 'flex', gap: 10 }}>
              <span style={{ ...iconSq('#e0955f'), width: 30, height: 30, fontSize: 15, borderRadius: 9 }}>👂</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ lineHeight: 1.9 }}>{r.text}</div>
                {/* فاز ۱۶۳ — سنجهٔ اعتبارِ منبع: همان عددِ واقعیِ credPct، حالا به‌صورتِ نوار */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: 9.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>منبع: {r.sourceFa}</span>
                  <div style={{ flex: 1, height: 6, minWidth: 40, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Number(r.credPct) || 0)}%`, height: '100%', background: 'linear-gradient(90deg,#e0955f,#ffd76a)', borderRadius: 3 }} /></div>
                  <b style={{ fontSize: 10, color: '#ffd76a', whiteSpace: 'nowrap' }}>{fa(r.credPct)}٪</b>
                  {r.verdict && <span style={tagChip(r.verdict === 'true' ? '#5fd98a' : '#e08a7e')}>{r.verdict === 'true' ? '✓ درست بود' : '✗ غلط بود'}</span>}
                </div>
                {r.hood && <button onClick={() => openCityMkt({ hood: r.hood })} style={{ color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit', fontSize: 10, padding: 0, marginTop: 4 }}>🔎 خودت قضاوت کن — بازارِ {r.hood} همین‌جا</button>}
              </div>
            </div>
          ))}
        </div>
        {(wd.rumors.trust || []).some((t: any) => t.total > 0) && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {wd.rumors.trust.filter((t: any) => t.total > 0).map((t: any) => (
            <span key={t.source} style={{ fontSize: 10, border: '1px solid var(--line2)', borderRadius: 999, padding: '2px 9px', color: 'var(--muted)' }}>سابقهٔ {t.sourceFa}: {fa(t.truePct)}٪ درست از {fa(t.total)} شایعه</span>
          ))}
        </div>}
      </>}
      {/* 🏙 شهرهای دنیا (فاز ۶۸ — چندشهری v1): آمارِ زندهٔ هر شهر از آگهی‌های واقعی — شهرِ جدید با داده‌اش خودکار ظاهر می‌شود */}
      {(wd.cities || []).length > 0 && <>
        {qSection('🏙', 'شهرهای دنیا — لمس = بازارِ واقعیِ همان شهر', '#7d6ef0')}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {wd.cities.map((c: any) => (
            <button key={c.city} onClick={() => openCityMkt({ city: c.city })} title={`بازارِ ${c.city} همین‌جا باز می‌شود — با مذاکره/تحلیل/خرید`}
              style={{ flex: 'none', minWidth: 122, textAlign: 'center', border: `2px solid ${cityMkt?.title === c.city ? 'rgba(212,175,55,.6)' : 'rgba(255,255,255,.1)'}`, borderRadius: 16, padding: '10px 12px', background: cityMkt?.title === c.city ? 'rgba(212,175,55,.1)' : 'rgba(255,255,255,.04)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 0 rgba(5,3,20,.4)' }}>
              <div style={{ fontSize: 20 }}>🏙</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text)', margin: '3px 0 6px' }}>{c.city}</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                <span style={tagChip('#57c2ff')}>{fa(c.listings)} آگهی</span>
                <span style={tagChip('#ffd76a')}>میانه {faB(c.medianPrice)}</span>
              </div>
            </button>
          ))}
        </div>
      </>}

      {/* فاز ۸۰: بازارِ شهر/محله داخلِ دنیا — آگهیِ واقعی + همان اقدام‌های بازی؛ کاربر هرگز از بازی خارج نمی‌شود */}
      {cityMkt && <div style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--goldDim)', borderRadius: 12, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 12.5 }}>🛒 بازارِ {cityMkt.title}</b>
          {!cityMkt.loading && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{fa(cityMkt.total)} آگهیِ واقعیِ قیمت‌دار{cityMkt.total > cityMkt.items.length ? ` · ${fa(cityMkt.items.length)} تای اول` : ''}</span>}
          <span style={{ flex: 1 }} />
          <button onClick={() => setCityMkt(null)} style={{ ...btnGhost, padding: '2px 10px', fontSize: 11 }}>✕ بستن</button>
        </div>
        {cityMkt.loading && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>در حالِ آوردنِ آگهی‌های واقعی…</div>}
        {!cityMkt.loading && cityMkt.items.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>الان آگهیِ قیمت‌دارِ فعالی این‌جا نیست — با ورودِ آگهیِ تازه همین‌جا پر می‌شود.</div>}
        {!cityMkt.loading && cityMkt.items.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8, marginTop: 8 }}>
          {cityMkt.items.map((dl: any) => (
            <div key={dl.id} style={{ ...card, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.7 }}>{dl.title.slice(0, 55)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{dl.hood}{dl.area ? ` · ${fa(dl.area)} متر` : ''}{dl.perM ? ` · متری ${faB(dl.perM)}` : ''}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700 }}>{faB(dl.price)} تومان</div>
              {nego[dl.id] && <div style={{ fontSize: 10.5, color: nego[dl.id].success ? '#7c6' : 'var(--muted)' }}>
                🤝 {nego[dl.id].owner?.name || 'مالک'}: {nego[dl.id].success ? `${fa(nego[dl.id].discountPct)}٪ تخفیف → ${faB(nego[dl.id].finalPrice)}` : 'کوتاه نیامد'}
              </div>}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
                {!nego[dl.id] && <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy}
                  onClick={async () => { const d = await api({ action: 'negotiate', listingId: dl.id }); if (d) setNego(p => ({ ...p, [dl.id]: d })) }}>🤝 مذاکره</button>}
                <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy || e.aiTokens <= 0} title="میانهٔ متریِ واقعیِ هم‌محله‌ها"
                  onClick={async () => { setDealAn(dl.id); await doAnalyze(dl.id) }}>🤖 تحلیل (۱ ژتون)</button>
                <button style={{ ...btn, padding: '4px 10px', fontSize: 11 }} disabled={busy}
                  onClick={() => doBuy({ id: dl.id, title: dl.title, hood: dl.hood, price: nego[dl.id]?.success ? nego[dl.id].finalPrice : dl.price, area: dl.area } as any, !!nego[dl.id]?.success)}>می‌خرم</button>
                {/* فاز ۱۰۲: خریدِ جمعی با اتحاد — سهم‌گذاری تا سقفِ قیمتِ همین آگهیِ واقعی */}
                <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy} title="کنسرسیومِ اتحاد: با هم‌پیمان‌هایت جمعی بخرید"
                  onClick={async () => {
                    if (!confirm(`کنسرسیومِ اتحاد روی «${dl.title}» (${faB(dl.price)} تومان) باز شود؟ اعضا سهم می‌گذارند؛ با پرشدن، ملک مالِ اتحاد می‌شود.`)) return
                    const d = await api({ action: 'clanProjectStart', listingId: dl.id })
                    if (d) alert('کنسرسیوم باز شد — در تبِ رتبه‌ها → اتحاد سهم بگذارید')
                  }}>🏛 کنسرسیوم</button>
              </div>
              {dealAn === dl.id && analysis && <div style={{ fontSize: 10.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
                {analysis.samples > 0 && <div>متریِ این ملک {faB(analysis.minePerM)} · میانگینِ هم‌محله‌ها {faB(analysis.avgPerM)} (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
              </div>}
            </div>
          ))}
        </div>}
        <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 6 }}>همه آگهی‌های واقعیِ همین لحظهٔ بازارند — خرید یعنی مالکیتِ انحصاری در دنیا؛ داراییِ واقعی در ۲ شهر = مجموعهٔ «فاتحِ شهرها».</div>
      </div>}

      {/* فاز ۱۰۱ (NPC v2): رسانهٔ شهر — تیترها فقط از حرکت‌های واقعاً رخ‌داده */}
      {/* فاز ۱۰۴: هوای واقعیِ شهر — اگر سرویس در دسترس نبود چیزی نشان داده نمی‌شود */}
      {wd.weather && <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 14px', marginTop: 12, fontSize: 12 }}>
        <span style={{ fontSize: 16 }}>{wd.weather.icon}</span>
        <b>{wd.weather.label}</b>
        <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{fa(wd.weather.tempC)}°</span>
        <span style={{ color: 'var(--faint)', fontSize: 9.5 }}>{wd.weather.city} — هوای واقعی</span>
      </div>}
      {(wd.media || []).length > 0 && <div style={{ ...card, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ ...iconSq('#e0955f'), width: 30, height: 30, fontSize: 15, borderRadius: 9 }}>📻</span>
          <b style={{ fontSize: 12.5, fontWeight: 900 }}>رسانهٔ شهر</b>
          <span style={{ fontSize: 9.5, color: 'var(--faint)' }}>از معاملاتِ شرکت‌ها و روندِ واقعیِ محله‌ها</span>
        </div>
        {wd.media.map((m: any, i: number) => <div key={i} style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0', lineHeight: 1.9 }}>{m.icon} {m.text}</div>)}
      </div>}

      {/* فاز ۱۰۱: جنگِ شرکتیِ من — وضعیتِ زنده یا نتیجهٔ آخرین رقابت */}
      {wd.war && <div style={{ background: 'var(--bg2)', border: `1px solid ${wd.war.result === 'win' ? 'rgba(95,217,138,.5)' : wd.war.result === 'loss' ? 'rgba(231,74,74,.4)' : 'var(--gold)'}`, borderRadius: 12, padding: '10px 14px', marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>⚔️ رقابتِ {wd.war.hood}{!wd.war.result && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — در جریان تا روزِ {fa(wd.war.endDay - wd.day)} دیگر</span>}</div>
        {wd.war.result
          ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{wd.war.result === 'win' ? `🏆 بردی! ${fa(wd.war.playerScore || 0)} به ${fa(wd.war.npcScore || 0)} — جایزهٔ XP گرفتی` : `این بار شرکت برد (${fa(wd.war.npcScore || 0)} به ${fa(wd.war.playerScore || 0)}) — با خریدِ واقعی در محله و XP بیشتر دوباره حمله کن`}</div>
          : <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>هر خریدِ واقعی در این محله و هر XPِ تازه امتیازت را بالا می‌برد — امتیازِ شرکت قطعی و قابلِ‌دستکاری نیست.</div>}
      </div>}

      {/* فاز ۱۰۱: شهروندانِ شهر — برآوردِ آماری از قیمت/عرضهٔ «واقعیِ» محله‌ها (هیچ آدمِ ساختگی‌ای معامله نمی‌کند) */}
      {(wd.citizens || []).length > 0 && <>
        {qSection('👥', 'شهروندانِ شهر — تقاضای واقعیِ محله‌ها', '#5fd98a')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
          {wd.citizens.map((seg: any) => (
            <div key={seg.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800 }}>{seg.icon} {seg.name}</div>
              <div style={{ fontSize: 9.5, color: 'var(--muted)', margin: '3px 0 5px' }}>{seg.desc}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {seg.hoods.map((h: string) => <span key={h} style={{ fontSize: 10, background: 'var(--goldDim)', color: 'var(--gold)', borderRadius: 999, padding: '2px 8px' }}>{h}</span>)}
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* 🏢 شرکت‌های زندهٔ شهر (فاز ۶۵ — NPC Civilization v1): رقبای واقعی‌نما که هر روز روی آگهی‌های واقعی معامله می‌کنند */}
      {(wd.companies || []).length > 0 && <>
        {qSection('🏢', 'شرکت‌های شهر — رقبای زنده', '#57c2ff')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
          {wd.companies.map((c: any) => (
            <div key={c.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>{c.styleFa}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
                <span>🏠 {fa(c.assets)} ملک</span>
                <span>💰 نقد {faB(c.capital)}</span>
                {c.realized !== 0 && <span style={{ color: c.realized > 0 ? '#7c6' : '#e88' }}>{c.realized > 0 ? '📈 سود' : '📉 زیانِ'} {faB(Math.abs(c.realized))}</span>}
              </div>
              {/* فاز ۷۳: املاکِ شرکت قابلِ‌خریدند — واگذاریِ شفاف به قیمتِ روزِ همان آگهیِ واقعی (فاز ۶۵ سرورش را ساخته بود، دکمه نداشت) */}
              {(c.holdings || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {c.holdings.map((h: any) => (
                  <div key={h.listingId} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 8px' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.title}>🏠 {h.title}{h.hood ? ` · ${h.hood}` : ''}</span>
                    {h.price > 0
                      ? <>
                        <b style={{ color: 'var(--gold)', whiteSpace: 'nowrap' }}>{faB(h.price)}</b>
                        <button style={{ ...btn, padding: '3px 10px', fontSize: 10 }} disabled={busy} onClick={async () => {
                          if (!confirm(`«${h.title}» از ${c.name} به قیمتِ روزِ آگهی (${faB(h.price)} تومان + مالیات و ثبت) خریده شود؟ واگذاری شفاف است — بدونِ سورپرایزِ قیمتی.`)) return
                          const d = await api({ action: 'buy', listingId: h.listingId })
                          if (d) { setSt(d); celebrate(); setWd(null) }
                        }}>🤝 بخر</button>
                      </>
                      : <span style={{ color: 'var(--faint)', whiteSpace: 'nowrap' }} title="این آگهی فعلاً در بازارِ زنده نیست — واگذاری فقط روی آگهیِ فعال">آگهی فعال نیست</span>}
                  </div>
                ))}
                {c.assets > (c.holdings || []).length && <div style={{ fontSize: 9, color: 'var(--faint)' }}>و {fa(c.assets - c.holdings.length)} ملکِ دیگر…</div>}
              </div>}
              {(c.log || []).slice(0, 2).map((l: any, i: number) => <div key={i} style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 3 }}>{l.icon} {l.text}</div>)}
              {/* فاز ۱۰۱ (NPC v2): رقابتِ محله‌ای + تصاحبِ خصمانه — هر دو با قواعدِ شفاف */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, borderTop: '1px dashed var(--line)', paddingTop: 6 }}>
                {(c.holdings || []).length > 0 && !wd.war && <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10 }} disabled={busy} title="یک دوره رقابت بر سرِ محله‌ای که این شرکت آن‌جا ملک دارد — امتیازت از خریدهای واقعی و XP می‌آید" onClick={async () => {
                  const hoods101 = Array.from(new Set((c.holdings || []).map((h: any) => h.hood).filter(Boolean))) as string[]
                  if (!hoods101.length) { alert('این شرکت فعلاً محلهٔ مشخصی ندارد'); return }
                  let hood = hoods101[0]
                  if (hoods101.length > 1) {
                    const pick = prompt(`رقابت بر سرِ کدام محله؟\n${hoods101.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n(شماره را بنویس)`)
                    const n101 = Number(pick)
                    if (!pick || !(n101 >= 1 && n101 <= hoods101.length)) return
                    hood = hoods101[n101 - 1]
                  }
                  const d = await api({ action: 'npcWarStart', npcId: c.id, hood })
                  if (d) { alert(d.note || 'رقابت آغاز شد'); setWd(null) }
                }}>⚔️ رقابت</button>}
                {wd.npcCfg?.takeoverEnabled && <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10, color: wd.npcCfg.myLevel >= wd.npcCfg.takeoverLevel ? undefined : 'var(--faint)' }} disabled={busy} title={wd.npcCfg.myLevel >= wd.npcCfg.takeoverLevel ? 'کلِ شرکت را با ارزش‌گذاریِ شفاف بخر — همهٔ املاکش مالِ تو می‌شود' : `از سطحِ ${fa(wd.npcCfg.takeoverLevel)} باز می‌شود`} onClick={async () => {
                  const pv = await api({ action: 'npcTakeover', npcId: c.id })
                  if (!pv?.preview) return
                  if (!confirm(`تصاحبِ «${c.name}»:\n• ${fa(pv.assets)} ملک به ارزشِ روزِ ${faB(pv.assetsValue)}\n• خزانهٔ شرکت ${faB(pv.capital)}\n• حقِ تقدم ${fa(pv.premiumPct)}٪\nجمع: ${faB(pv.valuation)} تومان از سرمایهٔ نقدت. همهٔ املاک به قیمتِ روز به پرتفویت می‌آید و شرکت با مدیریتِ تازه از نو شروع می‌کند.`)) return
                  const d = await api({ action: 'npcTakeover', npcId: c.id, confirm: true })
                  if (d) { setSt(d); celebrate(); setWd(null) }
                }}>🏳️ تصاحب</button>}
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>}

    {gtab === 'world' && <>
    {/* روزنامهٔ ملک‌جت (جلد ۵۲) — فاز ۷۲: خانه‌اش تبِ «دنیا»ست، کنارِ کتابِ تاریخ و شایعات */}
    <details style={card} onToggle={(ev: any) => { if (ev.currentTarget.open && !paper) doNews() }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>📰 روزنامهٔ ملک‌جت — اخبارِ زندهٔ دنیا</summary>
      {!paper ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حال بارگذاری...</div> : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(paper.news || []).map((n: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                <div><b>{n.title}</b>{n.detail && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{n.detail}</div>}</div>
              </div>
            ))}
            {!(paper.news || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>امروز اتفاقِ تازه‌ای در دنیا ثبت نشده — خبرها از رویدادهای واقعی ساخته می‌شوند.</div>}
          </div>
          {(paper.records || []).length > 0 && <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>🏆 آرشیوِ رکوردهای دنیا</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(paper.records || []).map((r: any) => (
                <div key={r.label} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
                  <span>{r.icon}</span><span style={{ color: 'var(--muted)', minWidth: 170 }}>{r.label}:</span><b>{r.value}</b>
                </div>
              ))}
            </div>
          </div>}
          <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>هر تیتر از یک اتفاقِ واقعی در بازار یا میانِ امپراتوری‌ها ساخته شده — هیچ خبری از پیش نوشته نشده.</div>
        </div>
      )}
    </details>
    </>}
      </div>
    </details>
    </>}

    {gtab === 'portfolio' && <>
    {/* دارایی‌ها = Empire Map (فهرست) */}
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>💼 پرتفوی امپراتوری</span>
        {/* ارزشِ کلِ پرتفوی همیشه بالای کارت (سند ۱۹ — Part 07) — جمعِ ارزشِ روزِ واقعی */}
        {(e.assets?.length || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, border: '1px solid var(--gold)', color: 'var(--gold)' }}>ارزشِ کل: {faB((e.assets || []).reduce((t: number, a: any) => t + (a.current || a.buyPrice), 0))} تومان</span>}
        {st.unlocks && <span title="ظرفیتِ پروژهٔ همزمانِ شرکت — با سطح رشد می‌کند" style={{ fontSize: 10.5, fontWeight: 400, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--muted)' }}>⛏ ظرفیتِ ساختِ همزمان: {fa(st.unlocks.projects.active)}/{fa(st.unlocks.projects.max)}</span>}
      </div>
      {/* فیلتر و مرتب‌سازیِ پرتفوی (سند ۱۹): «در چند ثانیه بفهم چه داری و کدام مشکل دارد» */}
      {(e.assets?.length || 0) > 1 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, fontSize: 11 }}>
        {[['all', 'همه'], ['land', '🏞 زمین'], ['apartment', '🏢 آپارتمان'], ['commercial', '🏬 تجاری'], ['villa', '🏡 ویلا'], ['issue', '⚠️ مشکل‌دار']].map(([k, l]) => (
          <button key={k} onClick={() => setPfKind(k)} style={{ ...btnGhost, padding: '3px 10px', fontSize: 11, borderColor: pfKind === k ? 'var(--gold)' : 'var(--line2)', color: pfKind === k ? 'var(--gold)' : 'var(--muted)' }}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <select value={pfSort} onChange={ev => setPfSort(ev.target.value as any)} style={{ padding: '3px 8px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11 }}>
          <option value="new">جدیدترین</option>
          <option value="value">باارزش‌ترین</option>
          <option value="growth">بیشترین رشد</option>
        </select>
      </div>}
      {!e.assets?.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>هنوز دارایی نداری — <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={doSuggest}>اولین فرصت را ببین</button></div>}
      {/* فاز ۱۶۰: هر دارایی یک کارتِ ساختمان در گریدِ واکنش‌گرا — همان محتوا و دکمه‌ها، فقط چیدمان و بندانگشتیِ برج */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 10 }}>
        {(() => { const pfMax = Math.max(1, ...(e.assets || []).map((x: any) => Number(x.current ?? x.buyPrice) || 0)); return (e.assets || [])
          .filter((a: any) => {
            // «مشکل‌دار» = تصمیمِ معطل: اتفاقِ کارگاه، اعتراضِ پروانه، یا کارگاهِ ایستاده به‌خاطرِ بی‌پولی
            if (pfKind === 'issue') return !!a.construction?.pendingEvent || (a.permit?.objection && !a.permit.objection.settled) || (a.construction && !a.construction.done && e.capital < (a.build?.dailyCost || 0))
            return pfKind === 'all' || a.kind === pfKind
          })
          .sort((a: any, b: any) => pfSort === 'value' ? (b.current || b.buyPrice) - (a.current || a.buyPrice) : pfSort === 'growth' ? (b.growthPct || 0) - (a.growthPct || 0) : (b.boughtAt || 0) - (a.boughtAt || 0))
          .map((a: any) => (
          <div key={a.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 8,
            // جلوهٔ رشد (پاسِ جذابیتِ ۱۴+): هالهٔ سبز/قرمزِ ملایم از سود/زیانِ «واقعی» — یک نگاه، کلِ قصه
            boxShadow: a.growthPct > 2 ? '0 0 14px rgba(110,220,160,.14)' : a.growthPct < -2 ? '0 0 14px rgba(230,120,110,.12)' : undefined }}>
            {/* سطرِ ۱ — هویت و ارزش (نظمِ کارت، فیدبکِ مستقیم): راست نام و محله، چپ ارزشِ روز — دیگر هیچ‌چیز شناور نیست */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ position: 'relative', flex: 'none', marginTop: 2 }}>
                <MiniTower facade={a.facade || a.construction?.facade} floors={towerFloorsOf(Number(a.current ?? a.buyPrice) || 0, pfMax)} />
                <span style={{ position: 'absolute', bottom: -5, left: -7, fontSize: 13, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}>{a.kind === 'land' ? '🏞' : a.kind === 'villa' ? '🏡' : a.kind === 'commercial' ? '🏬' : '🏢'}</span>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={a.nickname ? { color: '#f0d47a' } : undefined}>{(a.nickname || a.title).slice(0, 55)}</span>
                  {/* قانونِ ۱۳ (رویاپردازی): اسمِ دلخواه روی هر دارایی — هویتی، صفر اثرِ اقتصادی */}
                  <button title="نام‌گذاریِ دارایی" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: .6 }} disabled={busy}
                    onClick={async () => { const n = prompt('چه اسمی روی این دارایی می‌گذاری؟ (خالی = حذفِ نام)', a.nickname || ''); if (n === null) return; const d = await api({ action: 'nickname', assetId: a.id, name: n }); if (d) setSt(d) }}>✏️</button>
                  {/* فاز ۱۰۹ (Visual Pass 2 — جلد ۶۸): سبکِ نمای برج در خطِ آسمان؛ هر کلیک = سبکِ بعدی — فقط ظاهر */}
                  {st.visual?.facades !== false && a.kind !== 'land' && (() => {
                    const fcs = [['', 'پیش‌فرض'], ['modern', 'مدرن'], ['classic', 'کلاسیک'], ['roman', 'رومی'], ['green', 'سبز']]
                    const cur = a.facade || ''
                    const curFa = (fcs.find(f => f[0] === cur) || fcs[0])[1]
                    const next = fcs[(fcs.findIndex(f => f[0] === cur) + 1) % fcs.length]
                    return <button title={`نمای برج در خطِ آسمان: ${curFa} — کلیک: ${next[1]}`} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: .6 }} disabled={busy}
                      onClick={async () => { const d = await api({ action: 'facadeSet', assetId: a.id, facade: next[0] }); if (d) setSt(d) }}>🎨</button>
                  })()}
                </div>
                {a.nickname && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{a.title.slice(0, 55)}</div>}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.hood} · خرید: {faB(a.buyPrice)}{a.income > 0 && <span style={{ color: '#7c6' }}> · درآمد {faB(a.income)}</span>}</div>
              </div>
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{faB(a.current || a.buyPrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>ارزشِ روز{a.growthPct ? <span style={{ color: a.growthPct > 0 ? '#7c6' : '#e88', fontWeight: 700 }}> {a.growthPct > 0 ? '+' : ''}{a.growthPct.toLocaleString('fa-IR')}٪</span> : ''}</div>
              </div>
            </div>
            {/* فاز ۱۶۰ — چیپ‌های وضعیت از همان وضعیتِ واقعیِ دارایی (نبود = هیچ چیپی) */}
            {(a.construction || (a.income || 0) > 0 || (a.kind === 'land' && a.landPlan === 'sell')) && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {a.construction && !a.construction.done && <span style={tagChip('#e8c37a')}>🏗 در حال ساخت</span>}
              {a.construction?.done && <span style={tagChip('#7ee0b8')}>🏙 پروژهٔ تکمیل‌شده</span>}
              {(a.income || 0) > 0 && <span style={tagChip('#7ee0b8')}>💰 درآمدزا</span>}
              {a.kind === 'land' && a.landPlan === 'sell' && <span style={tagChip('#e0955f')}>💸 آمادهٔ فروش</span>}
            </div>}
            {/* سطرِ ۲ — وضعیت و تصمیمِ جاری (مسیرِ زمین/کسب‌وکار/تصمیمِ سه‌گانه) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* زمین (§6.7): سه مسیر با برآوردِ شفاف؛ تجاری (§6.9): انتخابِ کسب‌وکار؛ بقیه: تصمیمِ سه‌گانه */}
            {a.kind === 'land' && !a.landPlan && a.plans
              ? <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{a.plans.map((p: any) => (
                  <button key={p.plan} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }} title={`ریسک ${p.risk}${p.months ? ` · ${fa(p.months)} ماه` : ''}`}
                    onClick={async () => { const d = await api({ action: 'landPlan', assetId: a.id, plan: p.plan }); if (d) setSt(d) }}>
                    {p.label}{p.gainPct ? ` (+${fa(p.gainPct)}٪ برآورد)` : ''}</button>
                ))}</span>
              : a.kind === 'land' && a.landPlan === 'build'
              ? (/* فاز ۲۹: معمار → نقشه → پروانه → پیمانکار/کلنگ — مثلِ دنیای واقعی */
                a.needsDesign
                  ? <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5, color: 'var(--gold)', borderColor: 'var(--goldDim)' }} disabled={busy}
                      onClick={async () => { const d = await api({ action: 'designPlan', assetId: a.id }); if (d) setDz({ assetId: a.id, info: d, floors: String(d.legalFloors), upf: '2', use: 'residential' }) }}>📐 قراردادِ معمار — طراحیِ نقشه</button>
                  : a.design && a.designReadyInDays > 0
                  ? <span style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      📐 {a.design.architect} در حالِ طراحی — {fa(a.designReadyInDays)} روز مانده
                      {st.speed?.enabled && <button style={{ ...btnGhost, padding: '2px 9px', fontSize: 10.5 }} disabled={busy || e.coins < (st.speed.permitCoinsPerDay || 0)}
                        onClick={async () => { const d = await api({ action: 'designBoost', assetId: a.id, days: 1 }); if (d) setSt(d) }}>⚡ جلسهٔ فشرده: ۱− روز (🪙 {fa(st.speed.permitCoinsPerDay)})</button>}
                    </span>
                  : !a.permit
                  ? <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5 }} disabled={busy}
                      onClick={async () => { const d = await api({ action: 'permit', assetId: a.id }); if (d) { setSt(d); alert(`🏛 درخواست ثبت شد — بررسی تا ${fa(d.terms.days)} روز · عوارض ${faB(d.terms.fee)} تومان${d.terms.objection ? `\n⚠️ ${d.terms.objection.text}` : ''}${a.design?.illegalFloors > 0 ? `\n⚠️ پروانه فقط ${fa(a.design.legalFloors)} طبقهٔ قانونی را پوشش می‌دهد — طبقاتِ مازاد بعد از تکمیل به ماده۱۰۰ می‌رود` : ''}`) } }}>🏛 درخواستِ پروانهٔ ساخت{a.design?.illegalFloors > 0 ? ' (نقشه با تخلف!)' : ''}</button>
                  : a.permit.status === 'granted' && !a.construction
                  ? <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#7c6' }}>📜 پروانه ✓</span>
                      <button style={{ ...btn, padding: '4px 12px', fontSize: 11.5 }} disabled={busy}
                        onClick={async () => { const d = await api({ action: 'buildPlan', assetId: a.id }); if (d) { setBplan({ assetId: a.id, ...d }); setBname(d.suggestedName || ''); setBfacade('modern'); setBuse(d.fixedUse || 'residential') } }}>⛏ شروعِ ساخت</button>
                    </span>
                  : a.permit.status === 'granted'
                  ? <span style={{ fontSize: 11, color: '#7c6' }}>📜 پروانه ✓</span>
                  : <span style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                      <span style={{ color: 'var(--gold)' }}>⏳ بررسیِ پروانه — {fa(Math.max(0, Math.ceil(((a.permitDue || 0) - Date.now()) / 864e5)))} روز مانده
                        {/* ⚡ پیگیریِ حضوری (فاز ۲۷): کوین انتظار را کوتاه می‌کند — اعتراض/عوارض سرِ جایشان */}
                        {st.speed?.enabled && Math.ceil(((a.permitDue || 0) - Date.now()) / 864e5) > 0 && <button style={{ ...btnGhost, padding: '2px 9px', fontSize: 10.5, marginRight: 8, color: 'var(--gold)', borderColor: 'var(--goldDim)' }}
                          disabled={busy || e.coins < (st.speed.permitCoinsPerDay || 0)}
                          onClick={async () => { const d = await api({ action: 'permitBoost', assetId: a.id, days: 1 }); if (d) setSt(d) }}>⚡ پیگیریِ حضوری: یک روز جلوتر (🪙 {fa(st.speed.permitCoinsPerDay)})</button>}</span>
                      {/* اعتراض = دوراهیِ واقعی (فیدبک: «دفاع قابلِ کلیک نیست»): توافقِ پولیِ فوری، یا دفاعِ رایگانِ کُند — هر دو دکمهٔ واقعی */}
                      {a.permit.objection && !a.permit.objection.settled && (a.permit.objection.defended
                        ? <span style={{ color: '#b7aef2' }}>⚖️ دفاعت ثبت شد — در انتظارِ رأیِ کمیسیون (+{fa(a.permit.objection.extraDays)} روز به بررسی)</span>
                        : <span style={{ color: '#e7a14a', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>⚠️ {a.permit.objection.text}
                            <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5 }} disabled={busy} title="غرامت بده و اعتراض همین حالا بسته شود"
                              onClick={async () => { const d = await api({ action: 'permitSettle', assetId: a.id }); if (d) setSt(d) }}>🤝 توافق ({faB(a.permit.objection.settleCost)})</button>
                            <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5, color: '#b7aef2', borderColor: '#4d4670' }} disabled={busy} title="رایگان — ولی بررسی طولانی‌تر می‌شود و راهِ توافق بسته می‌شود"
                              onClick={async () => { if (!confirm(`در کمیسیون دفاع کنی؟ رایگان است ولی بررسیِ پروانه +${fa(a.permit.objection.extraDays)} روز طول می‌کشد و دیگر جای توافق نیست.`)) return; const d = await api({ action: 'permitDefend', assetId: a.id }); if (d) setSt(d) }}>⚖️ دفاع در کمیسیون (+{fa(a.permit.objection.extraDays)} روز)</button>
                          </span>)}
                    </span>)
              : a.kind === 'land' && a.landPlan
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.landPlan === 'partner' ? '🤝 مشارکت' : '💸 آمادهٔ فروش'}</span>
              : a.kind === 'commercial' && !a.business
              ? <span style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>چه کسب‌وکاری راه می‌اندازی؟ احتمالِ موفقیت از استقبال و رقبای «واقعیِ» همین محله حساب می‌شود:</span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(st.bizTypes || [{ key: 'کافه', icon: '☕' }, { key: 'رستوران', icon: '🍽' }, { key: 'فروشگاه', icon: '🛍' }, { key: 'کلینیک', icon: '🩺' }, { key: 'دفتر خدماتی', icon: '🗂' }]).map((bz: any) => (
                    <button key={bz.key} style={{ ...btnGhost, padding: '4px 9px', fontSize: 10.5 }}
                      onClick={async () => { const d = await api({ action: 'business', assetId: a.id, biz: bz.key }); if (d) { setSt(d); alert(`احتمالِ موفقیتِ ${bz.key} در ${a.hood || 'این محله'}: ${fa(d.prob)}٪ (از ${fa(d.signals.hoodListings)} آگهیِ فعال و ${fa(d.signals.competitors)} رقیبِ واقعی)`) } }}>{bz.icon} {bz.key}</button>
                  ))}</span>
                </span>
              : a.business
              /* فاز ۴۷ (فیدبک: «کلینیک زدم، معلوم نیست درآمد دارد یا نه»): نرخِ روزشمارِ شفاف + جمعِ تا امروز */
              ? <span style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>🏪 {a.business}{(a.unitsOwned || 1) > 1 && <span style={{ color: '#f0d47a' }}> در {fa(a.unitsOwned)} واحد (درآمد ×{fa(a.unitsOwned)})</span>} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· احتمالِ موفقیت {fa(a.businessProb || 0)}٪</span></span>
                  {a.incomeMonthly > 0
                    ? <span style={{ color: '#7ee0b8' }}>درآمدِ برآوردی: ماهانه {faB(a.incomeMonthly)} · روزشمار روزی {faB(a.incomeDaily)} — تا امروز {faB(a.income || 0)} واریز شده{a.incomeSinceH < 24 ? ` · قسطِ بعدی تا ${fa(24 - a.incomeSinceH)} ساعتِ دیگر` : ''}</span>
                    : <span style={{ color: '#e8c37a' }}>در این محله/شهر نمونهٔ اجارهٔ واقعی نیست — فعلاً درآمدی واریز نمی‌شود (صادقانه)</span>}
                </span>
              : a.action === 'rent'
              /* فاز ۴۷ (فیدبک: «اجاره مبهم است — روزشمار باشد»): اجاره‌بها از میانهٔ واقعیِ محله، واریزِ روزشمار */
              ? <span style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>💰 اجاره‌نامه فعال{(a.unitsOwned || 1) > 1 && <span style={{ color: '#f0d47a' }}> · {fa(a.unitsOwned)} واحد (درآمد ×{fa(a.unitsOwned)})</span>} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· اجاره‌بها از میانهٔ واقعیِ محله</span></span>
                  {a.incomeMonthly > 0
                    ? <span style={{ color: '#7ee0b8' }}>ماهانه {faB(a.incomeMonthly)} · روزشمار روزی {faB(a.incomeDaily)} — تا امروز {faB(a.income || 0)} واریز شده{a.incomeSinceH < 24 ? ` · قسطِ بعدی تا ${fa(24 - a.incomeSinceH)} ساعتِ دیگر` : ''}</span>
                    : <span style={{ color: '#e8c37a' }}>در این محله/شهر نمونهٔ اجارهٔ واقعی نیست — فعلاً واریزی نداریم (صادقانه)</span>}
                </span>
              : a.action
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.action === 'renovate' ? '🛠 بازسازی' : '📈 نگه‌داری — رشدِ ارزش با بازارِ واقعی'}</span>
              : <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{[['renovate', '🛠', 'بازسازی'], ['rent', '💰', 'اجاره با مشاور'], ['hold', '📈', 'نگه‌داشتن']].map(([k, i, t]) => <button key={k} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} onClick={async () => {
                  // اجاره (فاز ۲۹ + فیدبک): اول برگهٔ قراردادِ مشاور/آژانس با هزینهٔ تومانی — بعد امضا
                  if (k === 'rent') { openAgentQuote(a, 'rent'); return }
                  const d = await api({ action: 'assetAction', assetId: a.id, act: k }); if (d) setSt(d)
                }}>{i} {t}</button>)}</span>}
            </div>
            {/* سطرِ ۳ — اکشن‌های همیشگی: همیشه یک‌جا، یک‌شکل (نظمِ کارت — فیدبکِ مستقیم) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5, textDecoration: 'none' }}>🔗 آگهیِ واقعی</a>}
              <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy || e.aiTokens <= 0} onClick={() => doAnalyze(a.listingId)}>🧠 تحلیلِ ملک‌جت (۱ ژتون)</button>
              <span style={{ flex: 1 }} />
              {!a.construction && <button style={{ ...btnGhost, padding: '5px 14px', fontSize: 11.5, color: '#7ee0b8', borderColor: '#3d5c4d', fontWeight: 700 }} disabled={busy} onClick={() => openAgentQuote(a, 'sell')}>🏷 فروش با مشاور/آژانس</button>}
            </div>

            {/* 🤝 برگهٔ قرارداد با مشاور/آژانس — نام + هزینهٔ تومانی، قبل از امضا (فیدبکِ مستقیم) */}
            {aq && aq.assetId === a.id && <div id="agent-quote-sheet" style={{ width: '100%', border: '1px solid var(--gold)', borderRadius: 12, padding: 12, fontSize: 12, background: 'rgba(212,175,55,.07)', boxShadow: '0 6px 22px -8px rgba(212,175,55,.25)' }}>
              <b>🤝 {aq.kind === 'sell' ? 'قراردادِ فروش' : 'قراردادِ اجاره'} — از طریقِ چه کسی؟</b>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                {(aq.data.agents || []).map((g: any) => (
                  <button key={g.via} style={chip(aq.via === g.via)} onClick={() => setAq({ ...aq, via: g.via })}>{g.icon} {g.name}</button>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--muted)' }}>
                {aq.kind === 'sell' ? <>
                  <div>قیمتِ {aq.data.priceIsLive ? 'روزِ واقعیِ آگهی' : 'خرید (آگهی دیگر فعال نیست)'}: <b style={{ color: 'var(--text)' }}>{faB(aq.data.price)} تومان</b></div>
                  <div>کمیسیونِ {aq.via === 'agency' ? 'آژانس' : 'مشاور'} ({fa(aq.data.commissionPct)}٪): <b style={{ color: '#e8c37a' }}>{faB(aq.data.commission)} تومان</b></div>
                  <div>دریافتیِ خالصِ تو: <b style={{ color: '#7ee0b8' }}>{faB(aq.data.net)} تومان</b></div>
                </> : <>
                  <div>اجارهٔ ماهانه (میانهٔ واقعیِ محله): <b style={{ color: 'var(--text)' }}>{faB(aq.data.monthly)} تومان</b></div>
                  <div>کمیسیونِ {aq.via === 'agency' ? 'آژانس' : 'مشاور'} ({fa(aq.data.commissionPct)}٪ از یک ماه — یک‌بار): <b style={{ color: '#e8c37a' }}>{faB(aq.data.fee)} تومان</b></div>
                  <div style={{ color: 'var(--faint)' }}>بعد از امضا، درآمدِ اجاره از میانهٔ واقعیِ محله به‌مرور واریز می‌شود.</div>
                </>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                <button style={{ ...btn, padding: '6px 14px', fontSize: 12 }} disabled={busy} onClick={signAgentDeal}>✍️ امضای قرارداد و {aq.kind === 'sell' ? 'فروش' : 'اجاره'}</button>
                <button style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }} onClick={() => setAq(null)}>انصراف</button>
              </div>
            </div>}

            {/* 🧩 تجمیع و تخریب (فاز ۲۵): تک‌تکِ واحدهای ساختمان را بخر — تا همه مالِ تو نشد، تخریب ممکن نیست */}
            {a.assembly && <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 2 }}>
              <span style={{ color: 'var(--muted)' }}>🧩 واحدهای ساختمان: <b style={{ color: a.assembly.canDemolish ? '#7c6' : 'var(--text)' }}>{fa(a.assembly.owned)} از {fa(a.assembly.total)}</b> مالِ تو{(a.business || a.action === 'rent') && <span style={{ color: '#7ee0b8' }}> · هر واحدِ تازه {a.business ? 'درآمدِ کسب‌وکار' : 'اجاره'} را هم ضرب می‌کند</span>}</span>
              {!a.assembly.canDemolish && <>
                {nego['u' + a.id]
                  ? <span style={{ color: nego['u' + a.id].success ? '#7c6' : 'var(--muted)' }}>🤝 {nego['u' + a.id].owner?.name || 'مالکِ واحد'}: {nego['u' + a.id].success ? `${fa(nego['u' + a.id].discountPct)}٪ تخفیف` : 'کوتاه نیامد'}</span>
                  : <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy}
                      onClick={async () => { const d = await api({ action: 'negotiate', listingId: a.listingId, unit: a.assembly.owned + 1 }); if (d) setNego(p => ({ ...p, ['u' + a.id]: d })) }}>🤝 مذاکره با مالکِ واحدِ بعدی</button>}
                <button style={{ ...btn, padding: '3px 10px', fontSize: 10.5 }} disabled={busy}
                  onClick={async () => { const d = await api({ action: 'buyUnit', assetId: a.id, negotiated: !!nego['u' + a.id]?.success }); if (d) { setSt(d); celebrate(); setNego(p => { const q = { ...p }; delete q['u' + a.id]; return q }) } }}>
                  🧩 خریدِ واحدِ بعدی ({faB(a.assembly.nextPrice)}{nego['u' + a.id]?.success ? ' − تخفیف' : ''})</button>
                <span style={{ color: 'var(--faint)', fontSize: 10 }}>+{fa(a.assembly.premiumPct)}٪ پرمیوم — مالک‌ها می‌فهمند دنبالِ تجمیعی</span>
              </>}
              {a.assembly.canDemolish && <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5, color: '#e7a14a', borderColor: '#7a5a2a' }} disabled={busy}
                onClick={async () => {
                  if (!confirm(`کلِ ساختمان تخریب شود؟ زمینِ ~${fa(a.assembly.landArea)} متری می‌ماند (برآورد از بنا ÷ تراکم). هزینهٔ تخریب ${faB(a.assembly.demolishCost)} تومان.`)) return
                  const d = await api({ action: 'demolish', assetId: a.id }); if (d) { setSt(d); celebrate() }
                }}>🧨 تخریب → زمینِ ~{fa(a.assembly.landArea)} متری ({faB(a.assembly.demolishCost)})</button>}
            </div>}
            {a.villaDemolish && <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, color: '#e7a14a', borderColor: '#7a5a2a' }} disabled={busy}
              onClick={async () => {
                if (!confirm(`ویلا تخریب شود؟ زمینِ ${fa(a.villaDemolish.landArea)} متری (متراژِ خودِ آگهی) می‌ماند. هزینهٔ تخریب ${faB(a.villaDemolish.demolishCost)} تومان.`)) return
                const d = await api({ action: 'demolish', assetId: a.id }); if (d) { setSt(d); celebrate() }
              }}>🧨 تخریب → زمینِ {fa(a.villaDemolish.landArea)} متری ({faB(a.villaDemolish.demolishCost)})</button>}

            {/* 📐 فرمِ قراردادِ معمار (فاز ۲۹): طبقات/واحد با قوانینِ شفاف — طبقهٔ مازاد = تخلفِ آگاهانه با جریمهٔ اعلام‌شده */}
            {dz?.assetId === a.id && (() => {
              const inf = dz.info
              // فاز ۱۲۶ (فیدبک: «برای هر کاربری گزینه‌های متفاوت بیاید»): ضابطه و فرم از مشخصاتِ همان کاربری
              const spec = (inf.uses || []).find((x: any) => x.key === (dz.use || 'residential')) || { legalFloors: inf.legalFloors, maxFloors: inf.maxFloors, minUnitArea: inf.minUnitArea, unitsPerSpot: 1, singleUnit: false, unitFa: 'واحد', label: 'مسکونی' }
              const floors = Math.max(1, Math.round(Number(digitsOf(dz.floors)) || 0))
              const upf = spec.singleUnit ? 1 : Math.max(1, Math.round(Number(digitsOf(dz.upf)) || 0))
              const builtArea = inf.footprint * floors
              const unitArea = spec.singleUnit ? builtArea : Math.floor(inf.footprint / upf)
              const totalUnits = spec.singleUnit ? 1 : floors * upf
              const illegal = Math.max(0, floors - spec.legalFloors)
              const fee = Math.max(1, Math.round(builtArea * inf.costPerM * inf.architectFeePct / 100))
              const fineEst = illegal * inf.footprint * inf.finePerM2
              const spotsNeeded = spec.singleUnit ? 1 : Math.ceil(totalUnits / Math.max(1, spec.unitsPerSpot))
              // دکمه هرگز «بی‌صدا» قفل نمی‌شود (فاز ۳۱): اگر عدد مشکل دارد، دلیلِ دقیق همین‌جا و سرِ کلیک گفته می‌شود.
              const blockReason = floors > spec.maxFloors
                ? `حتی با تخلف، بیشتر از ${fa(spec.maxFloors)} طبقه برای ${spec.label} ممکن نیست (${fa(spec.legalFloors)} قانونی + ${fa(spec.maxFloors - spec.legalFloors)} طبقهٔ تخلف) — شهرداری وسطِ کار متوقف می‌کند`
                : !spec.singleUnit && unitArea < spec.minUnitArea
                ? `با ${fa(upf)} ${spec.unitFa} در طبقه، هر ${spec.unitFa} ${fa(unitArea)} متر می‌شود — کمتر از حدنصابِ ${fa(spec.minUnitArea)} متر برای ${spec.label}؛ تعداد را کم کن`
                : inf.parkingCap && spotsNeeded > inf.parkingCap
                ? `برای ${fa(totalUnits)} ${spec.unitFa} پارکینگ کافی نمی‌شود — ضابطهٔ ${spec.unitsPerSpot > 1 ? `«هر ${fa(spec.unitsPerSpot)} ${spec.unitFa} یک پارکینگ»` : `«هر ${spec.unitFa} یک پارکینگ»`} فقط ${fa(inf.parkingCap * Math.max(1, spec.unitsPerSpot))} ${spec.unitFa} اجازه می‌دهد`
                : ''
              return (
                <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
                  <b>📐 طراحیِ نقشه با {inf.architect}</b>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    زمین {fa(inf.landArea)} متر{inf.areaNote ? <span style={{ color: '#e7a14a' }}> ({inf.areaNote})</span> : null} · سطحِ اشغال {fa(inf.occupancyPct)}٪ → هر طبقه {fa(inf.footprint)} متر · مجازِ قانونی: {fa(inf.legalFloors)} طبقه (حداکثرِ قابل‌ساخت {fa(inf.maxFloors)})
                  </div>
                  {/* ضابطهٔ واقعی (فیدبکِ کاربر): توضیحِ شفافِ اینکه طبقاتِ مجاز از کجا آمد — متراژ + عرفِ واقعیِ محله + پارکینگ */}
                  {inf.ruleNote && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>📐 {inf.ruleNote}{inf.parkingCap ? ` (ظرفیتِ پارکینگ: ${fa(inf.parkingCap)} واحد)` : ''}</div>}
                  {/* فاز ۱۱۳ (فیدبکِ مستقیم): کاربری همین‌جا، سرِ قراردادِ معمار انتخاب می‌شود و تا پروانه/کلنگ/فروش می‌ماند */}
                  {(inf.uses || []).length > 0 && <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>کاربریِ پروژه چه باشد؟ (در نقشه و پروانه ثبت می‌شود — قیمتِ فروش از آگهی‌های واقعیِ همان کاربری)</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {inf.uses.map((u: any) => (
                        <button key={u.key} disabled={!(u.perM > 0)} onClick={() => u.perM > 0 && setDz({ ...dz, use: u.key, floors: String(u.legalFloors || inf.legalFloors), upf: u.singleUnit ? '1' : dz.upf || '2' })}
                          title={u.perM > 0 ? `متریِ ${u.label}: ${faB(u.perM)} تومان (${fa(u.samples)} آگهیِ ${u.scope === 'hood' ? 'همین محله' : 'کلِ بازار'})` : 'نمونهٔ قیمتیِ واقعی نداریم'}
                          style={{ ...btnGhost, padding: '6px 12px', fontSize: 11.5, opacity: u.perM > 0 ? 1 : .4, cursor: u.perM > 0 ? 'pointer' : 'not-allowed', borderColor: (dz.use || 'residential') === u.key ? 'var(--gold)' : 'var(--line2)', color: (dz.use || 'residential') === u.key ? 'var(--gold)' : 'var(--text)' }}>
                          {u.icon} {u.label} <span style={{ fontSize: 10, color: 'var(--faint)' }}>{u.perM > 0 ? `متری ~${faB(u.perM)}` : 'نمونه نداریم'}{u.costFactor !== 1 ? ` · هزینهٔ ساخت ×${(u.costFactor).toLocaleString('fa-IR')}` : ''}</span>
                        </button>
                      ))}
                    </div>
                    {(() => { const u = (inf.uses || []).find((x: any) => x.key === (dz.use || 'residential')); return u && u.scope === 'market' ? <div style={{ fontSize: 10.5, color: '#e8c37a', marginTop: 4 }}>نمونهٔ {u.label} در این محله کم بود — برآورد از {fa(u.samples)} آگهیِ {u.label} کلِ بازار.</div> : null })()}
                  </div>}
                  {spec.singleUnit ? (
                    /* فاز ۱۲۶ — ویلایی: بنایِ تک‌واحدی؛ فقط طبقاتِ ویلا (فلت/دوبلکس/تریپلکس تا سقفِ ضابطه) */
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: 11.5 }}>طبقاتِ ویلا:</span>
                      {Array.from({ length: Math.max(1, spec.maxFloors) }, (_, i) => i + 1).map(n => (
                        <button key={n} onClick={() => setDz({ ...dz, floors: String(n), upf: '1' })}
                          style={{ ...btnGhost, padding: '6px 12px', fontSize: 11.5, borderColor: floors === n ? 'var(--gold)' : 'var(--line2)', color: floors === n ? 'var(--gold)' : 'var(--text)' }}>
                          {fa(n)} {n === 1 ? '(فلت)' : n === 2 ? '(دوبلکس)' : n === 3 ? '(تریپلکس)' : ''}{n > spec.legalFloors ? ' ⚠️' : ''}
                        </button>
                      ))}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>= یک ویلای {fa(floors)} طبقهٔ {fa(builtArea)} متری با محوطهٔ {fa(Math.max(0, inf.landArea - inf.footprint))} متری</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      <label style={{ fontSize: 11.5 }}>طبقات{(dz.use || 'residential') === 'commercial' ? ' (پاساژ)' : ''}: <input value={dz.floors} onChange={ev => setDz({ ...dz, floors: digitsOf(ev.target.value) })} inputMode="numeric" style={{ width: 54, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} /></label>
                      <label style={{ fontSize: 11.5 }}>{spec.unitFa} در طبقه: <input value={dz.upf} onChange={ev => setDz({ ...dz, upf: digitsOf(ev.target.value) })} inputMode="numeric" style={{ width: 54, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} /></label>
                      <span style={{ fontSize: 11, color: unitArea < spec.minUnitArea ? '#e88' : 'var(--muted)' }}>= {fa(totalUnits)} {spec.unitFa}ِ {fa(unitArea)} متری · بنا {fa(builtArea)} متر</span>
                      {spec.unitsPerSpot > 1 && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>🅿 هر {fa(spec.unitsPerSpot)} {spec.unitFa} یک پارکینگ</span>}
                      {(dz.use || 'residential') !== 'residential' && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>حدنصابِ هر {spec.unitFa}: {fa(spec.minUnitArea)} متر</span>}
                    </div>
                  )}
                  {illegal > 0 && floors <= spec.maxFloors && <div style={{ fontSize: 11, color: '#e7a14a', marginTop: 6 }}>⚠️ {fa(illegal)} طبقهٔ مازاد بر تراکمِ قانونیِ {spec.label} — بعد از تکمیل، کمیسیونِ ماده۱۰۰: جریمهٔ برآوردی {faB(fineEst)} تومان یا تخریبِ طبقات</div>}
                  {blockReason && <div style={{ fontSize: 11.5, color: '#e88', marginTop: 6, fontWeight: 700 }}>🛑 {blockReason}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button style={{ ...btn, padding: '6px 14px', fontSize: 12, opacity: blockReason ? 0.55 : 1 }} disabled={busy}
                      onClick={async () => {
                        if (blockReason) { setErr(blockReason); return }
                        const d = await api({ action: 'designStart', assetId: a.id, floors, unitsPerFloor: upf, use: dz.use || 'residential' }); if (d) { setSt(d); setDz(null); celebrate() }
                      }}>
                      ✍️ امضای قرارداد ({faB(fee)} حق‌الزحمه · {fa(inf.designDays)} روز طراحی{illegal > 0 && !blockReason ? ' · با تخلف' : ''})</button>
                    <button style={{ ...btnGhost, padding: '6px 12px', fontSize: 11.5 }} onClick={() => setDz(null)}>انصراف</button>
                  </div>
                </div>
              )
            })()}

            {/* ⚖️ کمیسیونِ ماده۱۰۰ (فاز ۲۹): جریمه به شهرداری / دفاعِ وکیل / تخریبِ طبقاتِ مازاد */}
            {a.m100?.status === 'pending' && <div style={{ width: '100%', ...card, background: 'var(--bg2)', borderColor: '#e7a14a', fontSize: 12 }}>
              ⚖️ <b>کمیسیونِ ماده۱۰۰ شهرداری</b> — {fa(a.m100.illegalUnits)} واحد / {fa(a.m100.illegalArea)} مترِ مازاد بر پروانه · جریمه: <b style={{ color: '#e7a14a' }}>{faB(a.m100.fine)} تومان</b>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', margin: '4px 0 6px' }}>تا حلِ پرونده، واحدهای مازاد سند نمی‌خورند و قابلِ‌فروش نیستند.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={{ ...btn, padding: '5px 12px', fontSize: 11.5 }} disabled={busy}
                  onClick={async () => { const d = await api({ action: 'm100', assetId: a.id, choice: 'pay' }); if (d) { setSt(d); celebrate() } }}>💰 پرداختِ جریمه → شهرداری</button>
                {!a.m100.lawyerTried && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy}
                  onClick={async () => { const d = await api({ action: 'm100', assetId: a.id, choice: 'lawyer' }); if (d) { setSt(d); alert(d.lawyerWon ? '🧑‍⚖️ دفاع پذیرفته شد — جریمه کم شد؛ حالا جریمهٔ جدید را بپرداز.' : '🧑‍⚖️ دفاع رد شد — حق‌الوکاله برنمی‌گردد.') } }}>🧑‍⚖️ وکیل بگیر (~{faB(Math.round(a.m100.fine * (st.pros?.lawyerFeePct || 10) / 100))})</button>}
                <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5, color: '#e88', borderColor: '#644' }} disabled={busy}
                  onClick={async () => { if (!confirm(`طبقاتِ مازاد تخریب شود؟ ${fa(a.m100.illegalUnits)} واحد از دست می‌رود.`)) return; const d = await api({ action: 'm100', assetId: a.id, choice: 'demolish' }); if (d) setSt(d) }}>🧨 تخریبِ طبقاتِ مازاد</button>
              </div>
            </div>}

            {/* 🛠 بازسازیِ واقعی (فاز ۲۹): هزینهٔ الان، ارزش‌افزودهٔ شفاف — هر گزینه یک‌بار */}
            {(a.renovOptions || []).length > 0 && <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 2 }}>
              <span style={{ color: 'var(--muted)' }}>🛠 بازسازی{(a.renovBoostPct || 0) > 0 ? <b style={{ color: '#7c6' }}> (+{fa(a.renovBoostPct)}٪ ارزش)</b> : ''}:</span>
              {a.renovOptions.map((o: any) => o.done
                ? <span key={o.key} style={{ fontSize: 10.5, color: '#7c6' }}>{o.icon} {o.label} ✓</span>
                : <button key={o.key} style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'renovate', assetId: a.id, option: o.key }); if (d) { setSt(d); celebrate() } }}>
                    {o.icon} {o.label} ({faB(o.cost)} · +{fa(o.valuePct)}٪ ارزش)</button>)}
            </div>}

            {/* 🏪/🤝 فاز ۳۷: عرضه به امپراتورها + جذبِ شریکِ ساخت — سطح‌گشا (knob) */}
            {st.unlocks?.trade?.enabled !== false && st.unlocks?.trade?.ok && !a.demolishedAt && <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 2 }}>
              {a.p2pAuction && <span style={{ color: 'var(--gold)' }}>🔨 در مزایدهٔ امپراتورها — پایه {faB(a.p2pAuction.minBid)}{(a.p2pAuction.bids || []).length > 0 ? ` · بالاترین ${faB(a.p2pAuction.bids[0].amount)} (${a.p2pAuction.bids[0].name})` : ' · هنوز پیشنهادی نیامده'} · چکش روزِ {fa(a.p2pAuction.endDay)}
                {!(a.p2pAuction.bids || []).length && <button style={{ ...btnGhost, padding: '2px 8px', fontSize: 10.5, marginInlineStart: 6 }} disabled={busy} onClick={async () => { const d = await api({ action: 'p2pAuctionCancel', assetId: a.id }); if (d) setSt(d) }}>لغو</button>}</span>}
              {!a.p2pAuction && (a.forSale || 0) > 0
                ? <span style={{ color: '#7aa2c9' }}>🏪 در بازارِ امپراتورها به {faB(a.forSale)} — <button style={{ ...btnGhost, padding: '2px 8px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'forSale', assetId: a.id, price: 0 }); if (d) setSt(d) }}>لغوِ عرضه</button></span>
                : !a.p2pAuction && (!a.construction || a.construction.done) && a.m100?.status !== 'pending' && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)' }}>🏪 عرضه به امپراتورها:</span>
                    <input value={fsIn[a.id] || ''} onChange={ev => setFsIn({ ...fsIn, [a.id]: digitsOf(ev.target.value) })} placeholder="قیمت (میلیون)" inputMode="numeric" style={{ width: 96, padding: 5, borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center', fontSize: 11 }} />
                    <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                      const m = Math.round(Number(digitsOf(fsIn[a.id] || '')) || 0)
                      if (!(m > 0)) { setErr('قیمتِ عرضه را به میلیون تومان وارد کن'); return }
                      const d = await api({ action: 'forSale', assetId: a.id, price: m * 1e6 })
                      if (d) { setSt(d); setFsIn({ ...fsIn, [a.id]: '' }) }
                    }}>عرضه</button>
                    <button title="مزایده بینِ امپراتورهای واقعی — همان قیمت به‌عنوانِ پایه، چکش بعد از ۳ روز" style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5, borderColor: 'var(--goldDim)', color: 'var(--gold)' }} disabled={busy} onClick={async () => {
                      const m = Math.round(Number(digitsOf(fsIn[a.id] || '')) || 0)
                      if (!(m > 0)) { setErr('قیمتِ پایهٔ مزایده را به میلیون تومان در همان کادر بنویس'); return }
                      if (!confirm(`«${(a.nickname || a.title).slice(0, 40)}» با پایهٔ ${fa(m)}م تومان به مزایدهٔ امپراتورها برود؟ چکش ۳ روزِ دیگر — بالاترین پیشنهاد می‌بَرد.`)) return
                      const d = await api({ action: 'p2pAuctionOpen', assetId: a.id, minBid: m * 1e6, days: 3 })
                      if (d) { setSt(d); setFsIn({ ...fsIn, [a.id]: '' }); celebrate() }
                    }}>🔨 مزایده</button>
                  </span>}
              {((a.kind === 'land' && a.landPlan === 'build') || (a.construction && !a.construction.done)) && (
                a.jvOffer
                  ? <span style={{ color: '#7c6' }}>🤝 شریک‌خواهی: {fa(a.jvOffer.pct)}٪ ↔ {faB(a.jvOffer.amount)} — <button style={{ ...btnGhost, padding: '2px 8px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'jvOpen', assetId: a.id, pct: 0, amount: 0 }); if (d) setSt(d) }}>لغو</button></span>
                  : <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)' }}>🤝 جذبِ شریک:</span>
                      <input value={jvIn[a.id]?.pct || ''} onChange={ev => setJvIn({ ...jvIn, [a.id]: { pct: digitsOf(ev.target.value), amount: jvIn[a.id]?.amount || '' } })} placeholder="٪ سهم" inputMode="numeric" style={{ width: 56, padding: 5, borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center', fontSize: 11 }} />
                      <input value={jvIn[a.id]?.amount || ''} onChange={ev => setJvIn({ ...jvIn, [a.id]: { pct: jvIn[a.id]?.pct || '', amount: digitsOf(ev.target.value) } })} placeholder="آورده (میلیون)" inputMode="numeric" style={{ width: 96, padding: 5, borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center', fontSize: 11 }} />
                      <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                        const pct = Math.round(Number(digitsOf(jvIn[a.id]?.pct || '')) || 0)
                        const m = Math.round(Number(digitsOf(jvIn[a.id]?.amount || '')) || 0)
                        if (!(pct > 0) || !(m > 0)) { setErr('سهمِ ٪ و آورده (میلیون تومان) را وارد کن'); return }
                        const d = await api({ action: 'jvOpen', assetId: a.id, pct, amount: m * 1e6 })
                        if (d) { setSt(d); setJvIn({ ...jvIn, [a.id]: { pct: '', amount: '' } }) }
                      }}>باز کن</button>
                    </span>)}
              {(a.partners || []).length > 0 && <span style={{ color: 'var(--muted)' }}>شرکا: {a.partners.map((p: any) => `${p.name} ${fa(p.pct)}٪`).join('، ')} — سهمشان از هر فروش خودکار تسویه می‌شود</span>}
            </div>}

            {/* پیش‌نمایشِ نقشهٔ ساخت (جلد ۶۴): سازه/کیفیت با روز و هزینهٔ شفاف */}
            {bplan?.assetId === a.id && !a.construction && <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
              <b style={{ fontSize: 14 }}>⛏ رؤیای این زمین را بساز</b>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>زمین {fa(bplan.landArea)} متر → <b style={{ color: 'var(--gold)' }}>{fa(bplan.builtArea)} مترِ بنا · {fa(bplan.totalUnits)} واحدِ {fa(bplan.unitArea)} متری</b>{bplan.hood ? ` در ${bplan.hood}` : ''}</div>
              {/* قانونِ ۱۳ (رویاپردازی — دستورِ مستقیم): نامِ پروژه و سبکِ نما دستِ خودِ بازیکن؛ صرفاً هویتی (قانون ۵) */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <label style={{ fontSize: 11.5 }}>🏷 نامِ پروژه‌ات: <input value={bname} onChange={ev => setBname(ev.target.value.slice(0, 28))} placeholder={bplan.suggestedName || 'برجِ رؤیایی'} style={{ width: 180, padding: 7, borderRadius: 8, border: '1px solid var(--goldDim)', background: 'var(--bg2)', color: 'var(--gold)', fontWeight: 700 }} /></label>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>🎨 نمای برج:</span>
                {(bplan.facades || []).map((f: any) => (
                  <button key={f.key} style={chip(bfacade === f.key)} onClick={() => setBfacade(f.key)}>{f.icon} {f.label}</button>
                ))}
              </div>
              {/* فاز ۱۱۲ (فیدبکِ مستقیم): کاربریِ پروژه — قیمتِ هر کاربری از آگهی‌های واقعیِ همان نوع؛ بدونِ نمونه = صادقانه بسته */}
              {bplan.fixedUse && (() => { const u = (bplan.uses || []).find((x: any) => x.key === bplan.fixedUse); return <div style={{ marginTop: 8, fontSize: 11.5 }}>
                کاربریِ ثبت‌شده در نقشه و پروانه: <b style={{ color: 'var(--gold)' }}>{u ? `${u.icon} ${u.label}` : bplan.fixedUse}</b>{u && u.perM > 0 ? <span style={{ color: 'var(--faint)', fontSize: 10.5 }}> · متری ~{faB(u.perM)} ({fa(u.samples)} آگهیِ {u.scope === 'hood' ? 'همین محله' : 'کلِ بازار'})</span> : null} — سرِ کلنگ عوض نمی‌شود.
              </div> })()}
              {!bplan.fixedUse && (bplan.uses || []).length > 0 && <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>کاربریِ پروژه چه باشد؟ (قیمتِ فروش از آگهی‌های واقعیِ همان کاربری — هزینهٔ ساخت هم فرق می‌کند)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bplan.uses.map((u: any) => (
                    <button key={u.key} disabled={!(u.perM > 0)} onClick={() => u.perM > 0 && setBuse(u.key)}
                      title={u.perM > 0 ? `متریِ ${u.label}: ${faB(u.perM)} تومان (${fa(u.samples)} آگهیِ ${u.scope === 'hood' ? 'همین محله' : 'کلِ بازار'})` : 'نمونهٔ قیمتیِ واقعی نداریم'}
                      style={{ ...btnGhost, padding: '6px 12px', fontSize: 11.5, opacity: u.perM > 0 ? 1 : .4, cursor: u.perM > 0 ? 'pointer' : 'not-allowed', borderColor: buse === u.key ? 'var(--gold)' : 'var(--line2)', color: buse === u.key ? 'var(--gold)' : 'var(--text)' }}>
                      {u.icon} {u.label} <span style={{ fontSize: 10, color: 'var(--faint)' }}>{u.perM > 0 ? `متری ~${faB(u.perM)}` : 'نمونه نداریم'}{u.costFactor !== 1 ? ` · هزینه ×${(u.costFactor).toLocaleString('fa-IR')}` : ''}</span>
                    </button>
                  ))}
                </div>
                {(() => { const u = (bplan.uses || []).find((x: any) => x.key === buse); return u && u.scope === 'market' ? <div style={{ fontSize: 10.5, color: '#e8c37a', marginTop: 4 }}>در «{bplan.hood}» نمونهٔ {u.label} کم بود — برآورد از {fa(u.samples)} آگهیِ {u.label} کلِ بازار است.</div> : null })()}
              </div>}
              {(bname || bfacade) && <div style={{ fontSize: 11.5, color: '#f4e7bd', marginTop: 7 }}>
                🌆 «{bname || bplan.suggestedName}» — {fa(bplan.totalUnits)} واحد با نمای {(bplan.facades || []).find((f: any) => f.key === bfacade)?.label || ''}{bplan.hood ? ` در قلبِ ${bplan.hood}` : ''}؛ حالا فقط انتخابِ سازه مانده تا کلنگ بخورد.
              </div>}
              {/* هدفِ پروژه (GDD فصل ۴ بخش ۸): تصمیمِ استراتژیک قبل از کلنگ — اثرش شفاف است */}
              {(bplan.goals || []).length > 0 && <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>هدفِ این پروژه چیست؟ (روی قیمت‌گذاری و پیش‌فروش اثر دارد)</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bplan.goals.map((g: any) => (
                    <button key={g.key} title={g.desc} onClick={() => setBgoal(g.key)}
                      style={{ ...btnGhost, padding: '6px 12px', fontSize: 11.5, borderColor: bgoal === g.key ? 'var(--gold)' : 'var(--line2)', color: bgoal === g.key ? 'var(--gold)' : 'var(--text)' }}>
                      {g.icon} {g.label} <span style={{ fontSize: 10, color: 'var(--faint)' }}>قیمت {fa(g.pricePct)}٪{g.presaleBonusPp ? ` · پیش‌فروش +${fa(g.presaleBonusPp)}٪` : ''}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{(bplan.goals.find((g: any) => g.key === bgoal) || {}).desc}</div>
              </div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 6, marginTop: 8 }}>
                {(bplan.options || []).map((o: any) => {
                  // فاز ۱۱۲: برآوردِ نمایشیِ گزینه با کاربریِ انتخابی — عددِ قطعیِ هزینه را سرور موقعِ کلنگ می‌سازد
                  const u = (bplan.uses || []).find((x: any) => x.key === buse)
                  const cost = u ? Math.round(o.costTotal * (u.costFactor || 1)) : o.costTotal
                  const estSale = u && u.perM > 0 ? Math.round(u.perM * bplan.unitArea * o.qualityFactor) * (bplan.sellableUnits ?? bplan.totalUnits) : o.estSale
                  const estProfit = estSale > 0 ? estSale - cost : 0
                  return (
                  <button key={o.structure + o.quality} style={{ ...btnGhost, textAlign: 'right', padding: '8px 10px', fontSize: 11.5 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'startBuild', assetId: a.id, structure: o.structure, quality: o.quality, goal: bgoal, name: bname, facade: bfacade, use: buse }); if (d) { setSt(d); setBplan(null); celebrate() } }}>
                    <b>{o.structureLabel} · {o.qualityLabel}</b>
                    <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>{fa(o.days)} روز · هزینهٔ کل {faB(cost)} تومان</div>
                    {estSale > 0 && <div style={{ color: estProfit > 0 ? '#7ee0b8' : '#e8c37a', fontSize: 10.5 }}>فروشِ برآوردی ~{faB(estSale)} · {estProfit > 0 ? `سودِ برآوردی ~${faB(estProfit)}` : `زیر هزینه (${faB(Math.abs(estProfit))}−)`}</div>}
                  </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>{bplan.estNote ? `📊 ${bplan.estNote} · ` : ''}هزینه روزشمار از سرمایهٔ نقد کم می‌شود — پول تمام شود، کارگاه می‌ایستد (خودِ ساخت، مدیریتِ پول است).</div>
            </div>}

            {/* کارگاهِ زنده (جلد ۶۴–۷۲): پیشرفت، مرحله، رویداد، پیش‌فروش، فروشِ واحد */}
            {a.construction && <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{a.construction.done ? `🏙 ${a.construction.name ? `«${a.construction.name}» تکمیل شد` : 'ساختمان تکمیل شد'}` : `🏗 ${a.construction.name ? `«${a.construction.name}» — ` : ''}${a.build?.stage || 'کارگاه'}`}</b>
                {a.construction.facade && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--muted)' }}>🎨 نمای {({ modern: 'مدرن', classic: 'کلاسیک', roman: 'رومی', green: 'سبز' } as any)[a.construction.facade] || a.construction.facade}</span>}
                {a.build?.goalLabel && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--gold)' }}>🎯 {a.build.goalLabel}</span>}
                {(a.build?.amenities || []).map((am: string) => <span key={am} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: '#7c6' }}>{am} ✓</span>)}
                <span style={{ color: 'var(--muted)' }}>{fa(a.construction.paidDays)}/{fa(a.construction.days)} روز · هزینهٔ روزانه {faB(a.build?.dailyCost || 0)}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--muted)' }}>پرداختی: {faB(a.construction.paid)} از {faB(a.construction.costTotal)}</span>
              </div>
              {/* استپرِ بصریِ مراحلِ ساخت (سند ۲۰ — Part 03): «هر مرحله از ظاهر قابلِ تشخیص باشد» — از پیشرفتِ واقعی */}
              <div style={{ display: 'flex', gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
                {['تجهیز', 'خاکبرداری', 'فونداسیون', 'اسکلت', 'تأسیسات', 'نما', 'نازک‌کاری'].map((stg, si) => {
                  const cur = a.construction.done ? 7 : Math.min(6, Math.floor(((a.build?.progressPct || 0) / 100) * 7))
                  const done = si < cur, active = si === cur && !a.construction.done
                  return <span key={stg} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, border: `1px solid ${active ? 'var(--gold)' : done ? '#5a6' : 'var(--line2)'}`, color: active ? 'var(--gold)' : done ? '#7c6' : 'var(--faint)', fontWeight: active ? 700 : 400 }}>{done ? '✓ ' : ''}{stg}</span>
                })}
              </div>
              <div style={{ height: 7, background: 'var(--line)', borderRadius: 4, marginTop: 6 }}>
                <div style={{ width: `${a.build?.progressPct || 0}%`, height: 7, borderRadius: 4, background: a.construction.done ? '#7c6' : 'var(--gold)', transition: 'width .6s ease' }} />
              </div>
              {!a.construction.done && e.capital < (a.build?.dailyCost || 0) && <div style={{ color: '#e88', fontSize: 11.5, marginTop: 6 }}>🛑 بحرانِ نقدینگی — سرمایهٔ نقد به هزینهٔ روزانه نمی‌رسد؛ کارگاه ایستاده. پیش‌فروش کن، وام بگیر یا دارایی بفروش.</div>}
              {/* 🛡 بیمهٔ کارگاه (فاز ۷۰): حقِ بیمهٔ شفاف → پوششِ ٪ هزینهٔ اتفاق‌های کارگاه */}
              {a.construction && !a.construction.done && !a.construction.insured && <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 10.5, borderColor: 'var(--goldDim)', color: 'var(--gold)' }} disabled={busy} onClick={async () => {
                if (!confirm(`کارگاهِ «${(a.nickname || a.title).slice(0, 40)}» بیمه شود؟ حقِ بیمه ≈ ${faB(Math.round((a.construction.costTotal || 0) * 0.03))} تومان — هزینهٔ اتفاق‌های کارگاه تا ۷۰٪ پوشش داده می‌شود.`)) return
                const d = await api({ action: 'insureBuild', assetId: a.id }); if (d) { setSt(d); celebrate() }
              }}>🛡 بیمهٔ کارگاه</button>}
              {a.construction && !a.construction.done && a.construction.insured && <span style={{ fontSize: 10.5, color: '#7c6' }}>🛡 کارگاه بیمه است</span>}
              {/* ⚡ شیفتِ شبانه (فاز ۲۷ — قانون ۵ «پرداخت فقط برای سرعت»): کوین زمان می‌خرد، هزینهٔ تومانیِ روز سرِ جایش */}
              {!a.construction.done && !a.construction.pendingEvent && st.speed?.enabled && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <button style={{ ...btnGhost, padding: '4px 12px', fontSize: 11, color: 'var(--gold)', borderColor: 'var(--goldDim)' }}
                    disabled={busy || e.coins < (st.speed.buildCoinsPerDay || 0) || e.capital < (a.build?.dailyCost || 0)}
                    onClick={async () => { const d = await api({ action: 'buildBoost', assetId: a.id, days: 1 }); if (d) { setSt(d); celebrate() } }}>
                    ⚡ شیفتِ شبانه: ۱ روزِ کاری همین حالا (🪙 {fa(st.speed.buildCoinsPerDay)} + هزینهٔ روز)</button>
                  <span style={{ fontSize: 10, color: 'var(--faint)' }}>کوین فقط زمان می‌خرد — هزینهٔ ساخت و رویدادهای کارگاه سرِ جایشان‌اند</span>
                </div>
              )}
              {a.construction.pendingEvent && <div style={{ ...card, background: 'var(--bg2)', borderColor: '#e7a14a', marginTop: 8, fontSize: 12 }}>
                ⚠️ <b>{a.construction.pendingEvent.text}</b> — تا تصمیم نگیری کارگاه ایستاده:
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button style={{ ...btn, padding: '5px 12px', fontSize: 11.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'buildEvent', assetId: a.id, choice: 'pay' }); if (d) setSt(d) }}>🛠 حلِ فوری ({faB(a.construction.pendingEvent.payCost)})</button>
                  <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'buildEvent', assetId: a.id, choice: 'wait' }); if (d) setSt(d) }}>⏳ صبر (+{fa(a.construction.pendingEvent.extraDays)} روز)</button>
                </div>
              </div>}
              {/* امکاناتِ میان‌ساخت (GDD فصل ۴ بخش ۴): تصمیمِ وسطِ ساخت — هزینهٔ الان، ارزشِ شفافِ بعداً */}
              {!a.construction.done && (a.build?.amenityOptions || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>ارتقای پروژه:</span>
                {a.build.amenityOptions.map((op: any) => (
                  <button key={op.key} style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} disabled={busy || e.capital < op.cost}
                    title={`هزینه ${faB(op.cost)} تومان · ارزشِ فروش/اجارهٔ هر واحد +${fa(op.valuePct)}٪`}
                    onClick={async () => { const d = await api({ action: 'amenity', assetId: a.id, key: op.key }); if (d) { setSt(d); celebrate() } }}>
                    {op.icon} {op.label} <span style={{ color: 'var(--faint)', fontSize: 10 }}>({faB(op.cost)} · ارزش +{fa(op.valuePct)}٪)</span>
                  </button>
                ))}
              </div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ color: 'var(--muted)' }}>واحدها: {fa(a.construction.totalUnits)} کل · {fa(a.construction.presold)} پیش‌فروش · {fa(a.construction.sold)} فروخته{(a.build?.rented || 0) > 0 ? ` · ${fa(a.build.rented)} اجاره` : ''}</span>
                <input value={pu[a.id] ? Number(pu[a.id]).toLocaleString('fa-IR') : ''} onChange={ev => setPu({ ...pu, [a.id]: digitsOf(ev.target.value) })} placeholder="تعداد" inputMode="numeric" dir="ltr" style={{ width: 70, padding: 6, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }} />
                {!a.construction.done && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy || !Number(pu[a.id])}
                  onClick={async () => { const d = await api({ action: 'presell', assetId: a.id, units: Number(pu[a.id]) }); if (d) { setSt(d); setPu({ ...pu, [a.id]: '' }); alert(`📝 پیش‌فروش انجام شد: ${faB(d.revenue)} تومان (قیمتِ واحد ${faB(d.unitPrice)} — از ${fa(d.samples)} نمونهٔ واقعیِ محله)`) } }}>📝 پیش‌فروش</button>}
                {a.construction.done && <button style={{ ...btn, padding: '5px 12px', fontSize: 11.5 }} disabled={busy || !Number(pu[a.id])}
                  onClick={async () => { const d = await api({ action: 'sellUnit', assetId: a.id, units: Number(pu[a.id]) }); if (d) { setSt(d); setPu({ ...pu, [a.id]: '' }); if (d.completed) celebrate(); alert(`🔑 فروش انجام شد: ${faB(d.proceeds)} تومان${d.bulkDiscounted > 0 ? `\n📉 فروشِ یکجای ${fa(Number(pu[a.id]) || 0)} واحد بازارِ خودت را اشباع کرد — ${fa(d.bulkDiscounted)} واحدِ آخر ارزان‌تر رفت` : ''}${d.completed ? '\n🎉 پروژه به‌طورِ کامل تحویل شد!' : ''}`) } }}>🔑 فروشِ واحد</button>}
                {/* «بفروش یا نگه‌دار و اجاره بده» (GDD فصل ۴ بخش ۴) — درآمد از میانهٔ اجارهٔ واقعیِ هم‌محله */}
                {a.construction.done && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy || !Number(pu[a.id])}
                  title="به‌جای فروش، درآمدِ ماهانه از میانهٔ اجارهٔ واقعیِ هم‌محله"
                  onClick={async () => { const d = await api({ action: 'rentUnits', assetId: a.id, units: Number(pu[a.id]) }); if (d) { setSt(d); setPu({ ...pu, [a.id]: '' }) } }}>🏠 اجاره بده</button>}
                {a.construction.done && (a.build?.rented || 0) > 0 && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11.5 }} disabled={busy || !Number(pu[a.id])}
                  onClick={async () => { const d = await api({ action: 'stopRent', assetId: a.id, units: Number(pu[a.id]) }); if (d) { setSt(d); setPu({ ...pu, [a.id]: '' }) } }}>🔓 فسخِ اجاره</button>}
              </div>
              {/* فاز ۴۹ (فیدبک: «۱۲ واحد را اجاره دادم ولی نشان نمی‌دهد»): درآمدِ اجارهٔ واحدهای برج — همان عددِ واریز */}
              {a.construction.done && (a.build?.rented || 0) > 0 && (a.incomeMonthly > 0
                ? <div style={{ fontSize: 11.5, color: '#7ee0b8', marginTop: 6 }}>💰 اجارهٔ {fa(a.build.rented)} واحد: ماهانه {faB(a.incomeMonthly)} · روزشمار روزی {faB(a.incomeDaily)} — تا امروز {faB(a.income || 0)} واریز شده{a.incomeSinceH < 24 ? ` · قسطِ بعدی تا ${fa(24 - a.incomeSinceH)} ساعتِ دیگر` : ''}</div>
                : <div style={{ fontSize: 11.5, color: '#e8c37a', marginTop: 6 }}>در این محله/شهر نمونهٔ اجارهٔ واقعی نیست — فعلاً واریزی نداریم (صادقانه)</div>)}
              {a.construction.done && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>تصمیمِ توست: بفروش (سودِ یکجا) یا نگه‌دار و اجاره بده (جریانِ ماهانه از میانهٔ واقعیِ محله) — فروشِ یکجای تعدادِ زیاد، بازارِ خودت را اشباع می‌کند و ارزان‌تر می‌رود.</div>}
              {/* خروج از پروژهٔ نیمه‌کاره (سند ۱۵ — فصل ۵): پروژهٔ در حالِ ساخت هم دارایی است؛ با پیش‌فروشِ فعال ممنوع */}
              {!a.construction.done && a.construction.presold === 0 && <div style={{ marginTop: 8 }}>
                <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 10.5, color: '#e88', borderColor: '#644' }} disabled={busy}
                  onClick={async () => {
                    const est = Math.round((a.buyPrice + a.construction.paid) * (st.unlocks?.projects?.exitPct || 85) / 100)
                    if (!confirm(`از این پروژه خارج شوی؟ زمین و کارگاه یکجا به ~${faB(est)} تومان (${fa(st.unlocks?.projects?.exitPct || 85)}٪ بهای تمام‌شده، قبل از مالیات) واگذار می‌شود.`)) return
                    const d = await api({ action: 'sellProject', assetId: a.id })
                    if (d) { setSt(d); alert(`🏳 خروج انجام شد: ${faB(d.proceeds)} تومان نقد شد (${d.pnl >= 0 ? 'سود' : 'زیان'} ${faB(Math.abs(d.pnl))})`) }
                  }}>🏳 فروشِ پروژهٔ نیمه‌کاره ({fa(st.unlocks?.projects?.exitPct || 85)}٪ بهای تمام‌شده)</button>
              </div>}
            </div>}
          </div>
        )) })()}
      </div>
      {analysis && <div style={{ ...card, background: 'var(--bg2)', marginTop: 10, fontSize: 13 }}>
        <b>🤖 تحلیلِ ملک‌جت — {analysis.hood || 'محله'}:</b> {analysis.verdict}
        {analysis.samples > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>میانگینِ متری هم‌محله‌ها: {faB(analysis.avgPerM)} تومان · این ملک: {faB(analysis.minePerM)} تومان (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
        <div style={{ fontSize: 11 }}>{intelView(analysis)}</div>
      </div>}
      {e.assets?.length > 0 && <div style={{ marginTop: 10 }}><button style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={doSuggest}>+ فرصتِ بعدی</button></div>}
    </div>

    {/* کارنامهٔ پروژه‌ها (GDD فصل ۴): تحلیلِ پس از تحویل — هر پروژه یک درس، همه از اعدادِ واقعیِ خودش */}
    {(st.projectHist || []).length > 0 && <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>🎓 کارنامهٔ پروژه‌های تحویل‌شده</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {st.projectHist.map((r: any, i: number) => (
          <div key={i} style={{ ...card, background: 'var(--bg2)', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <b>🏙 {r.title}</b>
              <span style={{ color: 'var(--muted)' }}>{r.hood}</span>
              {r.goalLabel && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--gold)' }}>🎯 {r.goalLabel}</span>}
              <span style={{ flex: 1 }} />
              <b style={{ color: r.pnl >= 0 ? '#7c6' : '#e88' }}>{r.pnl >= 0 ? 'سود' : 'زیان'} {faB(Math.abs(r.pnl))} تومان</b>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {fa(r.units)} واحد · هزینهٔ کل {faB(r.landCost + r.buildCost)} · فروش {faB(r.revenue)} · {fa(r.daysReal)} روز (برنامه: {fa(r.daysPlanned)})
            </div>
            <ul style={{ margin: '6px 0 0', paddingRight: 18, fontSize: 11.5, color: 'var(--text)' }}>
              {(r.lessons || []).map((l: string, j: number) => <li key={j} style={{ marginBottom: 2 }}>{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>}

    </>}

    {gtab === 'missions' && <>
    {tabHead('🎯', 'مأموریت‌ها', 'پاداش فقط از کارِ واقعی')}
    {subNav([
      ['quests', '🎯', 'مأموریت‌ها'],
      ['rewards', '🎁', 'جوایزِ واقعی'],
      ['dreams', '🌠', 'رؤیاها', (st.endgame?.dreams || []).length],
    ], misV, setMisV)}
    {/* ☀️ فاز ۱۶۷ — «مأموریت = موتورِ پیشرفت»: اعدادِ واقعی از st.todayPath (منحنیِ سطح + پاداشِ knob) — pct=0 ⇒ هیچ */}
    {st.todayPath && st.todayPath.pct > 0 && (
      <div style={{ ...card, borderColor: 'rgba(255,215,106,.45)', background: 'linear-gradient(160deg, rgba(255,215,106,.10), rgba(255,157,46,.03) 70%)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, padding: '12px 14px' }}>
        <span style={{ fontSize: 20 }} aria-hidden>🚀</span>
        <span style={{ flex: 1, minWidth: 200, lineHeight: 2 }}>
          تا سطحِ بعد <b style={{ color: 'var(--gold)' }}>{fa(st.todayPath.xpToNext)}</b> امتیاز مانده — مأموریت‌های امروز <b style={{ color: 'var(--gold)' }}>{fa(st.todayPath.potentialXp)}</b> امتیاز می‌دهند (<b style={{ color: '#ffd76a' }}>{fa(st.todayPath.pct)}٪</b> از راه)
        </span>
      </div>
    )}
    {/* ☀️ فاز ۱۶۷ — دعوتِ یک‌بارهٔ زنگِ صبحگاهی: فقط وقتی permission هنوز default است و کاربر قبلاً جواب نداده */}
    {st.todayPath?.morningEnabled && morningAsk !== 'no' && (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12.5, borderColor: 'var(--goldDim)', padding: '12px 14px' }}>
        <span style={{ fontSize: 20 }} aria-hidden>☀️</span>
        {morningAsk === 'ok'
          ? <span style={{ color: '#7ee0b8', fontWeight: 800 }}>✓ تنظیم شد — هر روز ساعتِ {fa(st.todayPath.morningHour)} صبح مأموریتِ روز به گوشی‌ات می‌رسد</span>
          : <>
            <span style={{ flex: 1, minWidth: 190, lineHeight: 2 }}>هر روز ساعتِ <b style={{ color: 'var(--gold)' }}>{fa(st.todayPath.morningHour)}</b> صبح مأموریتِ روز را برایت بفرستیم؟</span>
            <button className="empChunky" style={{ ...btn, padding: '8px 18px', fontSize: 12.5, borderRadius: 999 }} disabled={busy} onClick={async () => {
              const r = await ensurePushSubscribed(true)
              try { localStorage.setItem('mj-morning-optin', '1') } catch {}
              setMorningAsk(r.ok ? 'ok' : 'no')
            }}>باشه، خبرم کن</button>
            <button style={{ ...btnGhost, padding: '8px 14px', fontSize: 12 }} onClick={() => { try { localStorage.setItem('mj-morning-optin', '1') } catch {}; setMorningAsk('no') }}>نه</button>
          </>}
      </div>
    )}

    {misV === 'rewards' && <>
    {/* 🎁 مسیرِ جوایزِ واقعی (فاز ۴۸): ارزشِ خالصت را بالا ببر → جایزهٔ تومانیِ «واقعی» به کیف‌پولِ ملک‌جت.
        استخرِ جوایز از درآمدِ واقعیِ خودِ سایت پر می‌شود؛ پرداختِ نهایی با تأییدِ ملک‌جت. */}
    {rw?.ok && (rw.steps || []).length > 0 && (() => {
      const next = rw.steps.find((s: any) => s.status === 'claimable' || s.status === 'locked')
      const pct = next ? Math.min(100, Math.round(rw.netWorth / next.threshold * 100)) : 100
      const stChip: Record<string, [string, string]> = { paid: ['✓ واریز شد', '#7ee0b8'], pending: ['⏳ در انتظارِ تأیید', '#e8c37a'], rejected: ['✕ تأیید نشد', '#e88'], locked: ['🔒', 'var(--faint)'] }
      return <div style={{ ...card, borderColor: 'var(--gold)', background: 'linear-gradient(160deg, rgba(212,175,55,.08), rgba(212,175,55,.02) 65%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>🎁 مسیرِ جوایزِ واقعی</b>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>امپراتوری‌ات را بزرگ کن — جایزهٔ تومانیِ واقعی بگیر</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, border: '1px solid var(--goldDim)', borderRadius: 999, padding: '3px 12px', color: 'var(--gold)', fontWeight: 800 }}>👛 کیف‌پول: {faB(rw.rewardBalance || 0)} تومان</span>
        </div>
        {rw.gate && <div style={{ fontSize: 11.5, color: '#e8c37a', marginTop: 8 }}>🔒 {rw.gate}</div>}
        {next && <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            <span>ارزشِ خالصِ الان: <b style={{ color: 'var(--text)' }}>{faB(rw.netWorth)}</b></span>
            <span>هدفِ بعدی: <b style={{ color: 'var(--gold)' }}>{faB(next.threshold)}</b></span>
          </div>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: 8, background: 'linear-gradient(90deg, var(--goldDim), var(--gold))', borderRadius: 4, boxShadow: '0 0 10px rgba(212,175,55,.4)' }} />
          </div>
          {/* فاز ۵۰ (سند ۳۰ Ch19 Part 6 — Reward Forecast): «فقط X مانده» + برآوردِ روز از رشدِ واقعیِ همین هفته */}
          {rw.forecast && rw.forecast.left > 0 && <div style={{ fontSize: 11, color: '#e8c37a', marginTop: 5 }}>
            ⚡ فقط <b>{faB(rw.forecast.left)}</b> مانده{rw.forecast.days ? <span style={{ color: 'var(--muted)' }}> · با سرعتِ رشدِ همین هفته‌ات (روزی ~{faB(rw.forecast.perDay)})، برآورد <b style={{ color: '#e8c37a' }}>~{fa(Math.min(365, rw.forecast.days))} روز</b> تا این مرحله</span> : ''}
          </div>}
        </div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {rw.steps.map((s: any) => (
            <div key={s.step} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, padding: '6px 8px', borderRadius: 10, background: s.status === 'claimable' ? 'rgba(212,175,55,.08)' : 'var(--bg2)', border: s.status === 'claimable' ? '1px solid var(--gold)' : '1px solid transparent' }}>
              <span style={{ color: 'var(--muted)', width: 62 }}>مرحلهٔ {fa(s.step)}</span>
              <span style={{ flex: 1, minWidth: 150 }}>ارزشِ خالصِ {faB(s.threshold)} تومان</span>
              <b style={{ color: 'var(--gold)' }}>🏆 {faB(s.reward)} تومانِ واقعی</b>
              {s.status === 'claimable'
                ? <button style={{ ...btn, padding: '5px 14px', fontSize: 11.5 }} disabled={busy}
                    onClick={async () => {
                      if (!confirm(`درخواستِ جایزهٔ مرحلهٔ ${fa(s.step)} (${faB(s.reward)} تومان) ثبت شود؟ پس از تأییدِ ملک‌جت به کیف‌پولت واریز می‌شود.`)) return
                      const d = await api({ action: 'rewardClaim', step: s.step })
                      if (d) { celebrate(); setRw(null) }
                    }}>دریافتِ جایزه</button>
                : <span style={{ fontSize: 11, color: stChip[s.status]?.[1] || 'var(--faint)', fontWeight: 700 }}>{stChip[s.status]?.[0] || ''}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>جوایز پس از تأییدِ ملک‌جت به سطلِ «پاداشِ» کیف‌پولت واریز می‌شوند · مراحل به‌ترتیب باز می‌شوند · ظرفیتِ جوایز دوره‌ای است و از درآمدِ واقعیِ ملک‌جت تأمین می‌شود.</div>
      </div>
    })()}
    </>}

    {misV === 'quests' && <>
    {/* 🔥 پاداشِ نقاطِ عطفِ استریک (سند ۱۸ بخش ۱) — فاز ۱۶۰: کارتِ تختهٔ مأموریت با پالسِ طلایی؛ همان داده/هندلر */}
    {(st.streakBonuses || []).some((sb: any) => sb.done && !sb.claimed) && <>
    {qSection('🔥', 'استریک و پاداشِ فوری', '#ff9d2e')}
    <div style={{ ...card, borderColor: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={iconSq('#ff9d2e')}>🔥</span>
      <b style={{ fontSize: 13 }}>پاداشِ استریکِ {fa(st.streak?.streak || 0)} روزه آماده است</b>
      <span style={{ flex: 1 }} />
      {st.streakBonuses.filter((sb: any) => sb.done && !sb.claimed).map((sb: any) => (
        <button key={sb.claimKey} className="empPulse" style={{ ...btn, padding: '8px 16px', fontSize: 12, borderRadius: 999 }} disabled={busy}
          onClick={() => doClaim(sb.claimKey)}>🎁 روزِ {fa(sb.days)} → {fa(sb.coins)} کوین</button>
      ))}
    </div>
    </>}
    {/* 🎪 رویدادهای زندهٔ LiveOps روی تختهٔ مأموریت — همان دادهٔ st.liveEvents و همان doClaim؛ فقط نمایش */}
    {(st.liveEvents || []).length > 0 && <>
    {qSection('🎪', 'رویدادهای زنده', '#ff5f4d')}
    {(st.liveEvents || []).map((ev: any) => (
      <div key={ev.id} style={{ ...card, borderColor: ev.done && !ev.claimed ? 'var(--gold)' : 'var(--line)', display: 'flex', gap: 12, opacity: ev.claimed ? .65 : 1 }}>
        <span style={iconSq('#ff5f4d')}>{ev.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13 }}>{ev.title}</b>
            <span style={{ fontSize: 10.5, color: '#e7a14a' }}>⏳ تا {new Date(ev.endAt).toLocaleDateString('fa-IR')}</span>
            <span style={{ flex: 1 }} />
            {ev.rewardCoins ? <span style={rewardChip}>🪙 {fa(ev.rewardCoins)}</span> : null}
            {ev.rewardXp ? <span style={rewardChip}>⚡ {fa(ev.rewardXp)}</span> : null}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{ev.desc}</div>
          {qBar(ev.progress, ev.target, !!ev.done)}
          <div style={{ marginTop: 8 }}>
            {ev.claimed ? <span style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 800 }}>✅ پاداش دریافت شد</span>
              : ev.done ? <button className="empPulse" style={{ ...btn, padding: '7px 18px', fontSize: 12, borderRadius: 999 }} disabled={busy} onClick={() => doClaim('ev_' + ev.id)}>🎁 دریافتِ پاداش</button>
              : <span style={tagChip('#9aa0b8')}>در جریان…</span>}
          </div>
        </div>
      </div>
    ))}
    </>}

    </>}

    {misV === 'dreams' && <>
    {/* 🌠 تختهٔ رؤیاها (فاز ۶۲ — فصل ۲۰ Part 7 Dreams Engine): «هر بازیکن همیشه یک رؤیای بزرگ جلوی چشمش داشته باشد»
        — رؤیای شخصیِ خودت را بساز؛ پیشرفت از عددِ واقعیِ امپراتوری اندازه می‌خورد؛ تحقق = نشانِ اختصاصی. */}
    {st.endgame && <div style={{ ...card, borderColor: 'var(--goldDim)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🌠 تختهٔ رؤیاها</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>رؤیای خودت را تعریف کن — سیستم فقط اندازه می‌گیرد و جشن؛ تحمیل نمی‌کند</span>
      </div>
      {(st.endgame.dreams || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {st.endgame.dreams.map((d: any) => (
          <div key={d.id} style={{ background: d.done ? 'rgba(212,175,55,.08)' : 'var(--bg2)', border: `1px solid ${d.done ? 'var(--goldDim)' : 'var(--line)'}`, borderRadius: 12, padding: '9px 12px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <span style={{ fontWeight: 700, flex: 1, minWidth: 160 }}>{d.done ? '✅' : '🌠'} {d.label}</span>
              <span style={{ fontSize: 10.5, color: d.done ? 'var(--gold)' : 'var(--muted)' }}>{d.done ? 'محقق شد — نشانش در تالارِ افتخارات است' : `${d.unit === 'toman' ? faB(d.have) : fa(d.have)} از ${d.unit === 'toman' ? faB(d.target) : fa(d.target)}${d.unit === 'toman' ? ' ت' : ''}`}</span>
            </div>
            {!d.done && <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, marginTop: 7, overflow: 'hidden' }}>
              <div style={{ width: `${d.pct}%`, height: 5, background: 'linear-gradient(90deg, var(--goldDim), var(--gold))', borderRadius: 3 }} />
            </div>}
          </div>
        ))}
      </div>}
      {(st.endgame.suggestions || []).length > 0 && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>پیشنهاد از سبکِ واقعیِ خودت (قدمِ بعدیِ همان کاری که بیشتر کرده‌ای):</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {st.endgame.suggestions.map((sg: any, i: number) => (
            <button key={i} disabled={busy} onClick={async () => { const d = await api({ action: 'dreamAdd', metric: sg.metric, target: sg.target, label: sg.label }); if (d?.ok) load() }}
              style={{ fontSize: 11, border: '1px solid var(--goldDim)', color: 'var(--gold)', background: 'transparent', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>＋ {sg.label}</button>
          ))}
        </div>
      </div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 12, background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 12, padding: 10 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>رؤیای شخصیِ خودت — روی چه چیزی؟</div>
          <select value={dreamForm.metric} onChange={ev => setDreamForm({ ...dreamForm, metric: ev.target.value })} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 9, padding: '7px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}>
            {(st.endgame.metrics || []).map((m: any) => <option key={m.key} value={m.key}>{m.fa}</option>)}
          </select>
        </div>
        <div style={{ width: 130 }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>هدف (عدد{(st.endgame.metrics || []).find((m: any) => m.key === dreamForm.metric)?.unit === 'toman' ? '، تومان' : ''})</div>
          <input value={dreamForm.target} onChange={ev => setDreamForm({ ...dreamForm, target: ev.target.value })} inputMode="numeric" placeholder="مثلاً ۱۰"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 9, padding: '7px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <button disabled={busy} onClick={async () => {
          const t = Math.floor(Number(String(dreamForm.target).replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[^\d]/g, '')))
          if (!(t > 0)) { setErr('هدفِ رؤیا را عددی بنویس'); return }
          const d = await api({ action: 'dreamAdd', metric: dreamForm.metric, target: t, label: dreamForm.label })
          if (d?.ok) { setDreamForm({ metric: dreamForm.metric, target: '', label: '' }); load() }
        }} style={{ ...btn, padding: '8px 16px', fontSize: 12 }}>🌠 ثبتِ رؤیا</button>
        <div style={{ width: '100%', fontSize: 10, color: 'var(--faint)' }}>حداکثر {fa(st.endgame.dreamsMax)} رؤیای فعال · تحققِ هر رؤیا یک نشانِ اختصاصی به تالارِ افتخاراتت اضافه می‌کند.</div>
      </div>
    </div>}

    </>}

    {misV === 'quests' && <>
    {/* مأموریت‌ها — پیشرفت از رفتارِ واقعی؛ فاز ۱۶۰: تختهٔ مأموریتِ سبکِ tycoon — همان آیتم‌ها و هندلرها */}
    {ms && <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {qSection('🌅', 'کوئست‌های دوره‌ای', '#ffd76a')}
        {/* کوئستِ روزانه/هفتگیِ شخصی (GDD جلد۲) — هر روز/هفته برای هر کاربر متفاوت */}
        {st.quests && [['🌅', 'کوئستِ امروزِ تو', st.quests.daily, '#ffb74d'], ['📅', 'کوئستِ این هفته', st.quests.weekly, '#7d6ef0']].map(([ic, lbl, q, clr]: any) => (
          <div key={q.claimKey} style={{ ...card, display: 'flex', gap: 12, opacity: q.claimed ? .65 : 1, position: 'relative' }}>
            <span style={iconSq(clr)}>{ic}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13 }}>{lbl}: {q.title}</b>
                <span style={{ flex: 1 }} />
                <span style={rewardChip}>🪙 {fa(q.rewardCoins)}</span>
                <span style={rewardChip}>⚡ {fa(q.rewardXp)}</span>
              </div>
              {qBar(q.progress, q.target, !!q.done)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                {q.claimed ? <span style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 800 }}>✅ دریافت شد</span>
                  : q.done ? <button className="empPulse" style={{ ...btn, padding: '7px 18px', fontSize: 12, borderRadius: 999 }} onClick={() => doClaim(q.claimKey)}>🎁 دریافتِ پاداش</button>
                  : <span style={tagChip('#9aa0b8')}>در جریان…</span>}
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>پیشرفت از رفتارِ واقعی‌ات در <Link href="/search" style={{ color: 'var(--gold)' }}>جستجوی ملک‌جت</Link> شمرده می‌شود.</span>
              </div>
            </div>
          </div>
        ))}
        {qSection('🎯', 'مأموریت‌های مسیر', '#7d6ef0')}
        {/* M1 */}
        <div style={{ ...card, opacity: ms.m1.claimed ? .65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...iconSq('#57c2ff'), width: 36, height: 36, fontSize: 18, borderRadius: 11 }}>🧭</span>
            <b style={{ fontSize: 13, flex: 1 }}>M1 · شهرت را کشف کن</b>
            {ms.m1.claimed ? <span style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 800 }}>✅ دریافت شد</span>
              : ms.m1.done ? <><span style={rewardChip}>🪙 {fa(ms.m1.rewardCoins)}</span><span style={rewardChip}>⚡ {fa(ms.m1.rewardXp)}</span><button className="empPulse" style={{ ...btn, padding: '7px 16px', fontSize: 12, borderRadius: 999 }} onClick={() => doClaim('m1_explore')}>🎁 دریافتِ پاداش</button></>
              : <><span style={rewardChip}>🪙 {fa(ms.m1.rewardCoins)}</span><span style={rewardChip}>⚡ {fa(ms.m1.rewardXp)}</span></>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            <span>👁 دیدنِ ۵ آگهی: <b style={{ color: ms.m1.views >= 5 ? '#7c6' : 'var(--text)' }}>{fa(ms.m1.views)}/۵</b></span>
            <span>🗺 ۲ محلهٔ متفاوت: <b style={{ color: ms.m1.hoods >= 2 ? '#7c6' : 'var(--text)' }}>{fa(ms.m1.hoods)}/۲</b></span>
            <span>❤️ ۱ ذخیره: <b style={{ color: ms.m1.saved ? '#7c6' : 'var(--text)' }}>{fa(ms.m1.saved)}/۱</b></span>
            <span>🤖 ۱ تحلیلِ AI: <b style={{ color: ms.m1.ai ? '#7c6' : 'var(--text)' }}>{fa(ms.m1.ai)}/۱</b></span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>پیشرفت از رفتارِ واقعیِ تو در جستجوی ملک‌جت شمرده می‌شود — <Link href="/search" style={{ color: 'var(--gold)' }}>برو به جستجو</Link></div>
        </div>
        {/* M2 */}
        <div style={{ ...card, opacity: ms.m2.claimed ? .65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...iconSq('#e0955f'), width: 36, height: 36, fontSize: 18, borderRadius: 11 }}>🎨</span>
            <b style={{ fontSize: 13, flex: 1 }}>M2 · سبکِ خودت را پیدا کن</b>
            {ms.m2.claimed ? <span style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 800 }}>✅ دریافت شد</span>
              : ms.m2.done ? <><span style={rewardChip}>🪙 {fa(ms.m2.rewardCoins)}</span><span style={rewardChip}>⚡ {fa(ms.m2.rewardXp)}</span><button className="empPulse" style={{ ...btn, padding: '7px 16px', fontSize: 12, borderRadius: 999 }} onClick={() => doClaim('m2_style')}>🎁 دریافتِ پاداش</button></>
              : <span style={tagChip('#9aa0b8')}>حداقل ۳ سبک انتخاب کن</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {['مدرن', 'کلاسیک', 'مینیمال', 'لوکس', 'صنعتی', 'سنتی'].map(sk => { const on = (e.stylePicks || []).includes(sk); return (
              <button key={sk} style={chip(on)} onClick={async () => { const next = on ? (e.stylePicks || []).filter((x: string) => x !== sk) : [...(e.stylePicks || []), sk]; const d = await api({ action: 'style', picks: next }); if (d) load() }}>{sk}</button>
            )})}
          </div>
        </div>
        {/* M3 · Beat AI */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...iconSq('#ffd76a'), width: 36, height: 36, fontSize: 18, borderRadius: 11 }}>🎯</span>
            <b style={{ fontSize: 13, flex: 1 }}>M3 · قیمت را حدس بزن (هوشِ ملک‌جت را شکست بده)</b>
            <span style={tagChip('#9aa0b8')}>دقتِ تو: {fa(ms.m3.correct)}/{fa(ms.m3.tries)}</span>
            <span style={rewardChip}>هر حدسِ درست 🪙 {fa(ms.m3.rewardCoins)} + ⚡ {fa(ms.m3.rewardXp)}</span>
          </div>
          {!guessL ? <button style={{ ...btnGhost, marginTop: 8, fontSize: 12, padding: '6px 12px' }} disabled={busy} onClick={doGuessNext}>یک ملکِ واقعی نشانم بده</button> : (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{guessL.title.slice(0, 70)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{guessL.location}{guessL.area ? ` · ${fa(guessL.area)} متر` : ''}{guessL.rooms ? ` · ${fa(guessL.rooms)} خواب` : ''}</div>
              {!guessRes ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={guessVal ? Number(guessVal).toLocaleString('fa-IR') : ''} onChange={ev => setGuessVal(digitsOf(ev.target.value))} placeholder="حدسِ تو (تومان)" inputMode="numeric" dir="ltr" style={{ flex: 1, minWidth: 160, padding: 10, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, textAlign: 'center', letterSpacing: 1 }} />
                    <button style={{ ...btn, padding: '8px 14px', fontSize: 13 }} disabled={busy || !guessVal} onClick={doGuess}>ثبتِ حدس</button>
                  </div>
                  {Number(guessVal) > 0 && <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 6 }}>حدسِ تو: <b>{faB(Number(guessVal))} تومان</b></div>}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {guessRes.correct ? <b style={{ color: '#7c6' }}>🎯 درست حدس زدی! (+⚡{fa(guessRes.rewardXp)} +🪙{fa(guessRes.rewardCoins)})</b> : <b style={{ color: '#e88' }}>این بار نشد — اختلاف {fa(guessRes.deltaPct)}٪</b>}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>قیمتِ واقعی: {faB(guessRes.actual)} تومان</div>
                  <button style={{ ...btnGhost, marginTop: 6, fontSize: 12, padding: '6px 12px' }} onClick={doGuessNext}>یکی دیگر</button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Property Hunter (§6.4) */}
        <div style={{ ...card, opacity: ms.hunter.claimed ? .65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...iconSq('#5fd98a'), width: 36, height: 36, fontSize: 18, borderRadius: 11 }}>🕵️</span>
            <b style={{ fontSize: 13, flex: 1 }}>شکارچیِ ملک — کدام بهتر است؟</b>
            {ms.hunter.claimed ? <span style={{ fontSize: 12, color: '#7ee0b8', fontWeight: 800 }}>✅ پاداش دریافت شد</span> : <span style={rewardChip}>تحلیلِ درست: 🪙 {fa(ms.hunter.rewardCoins)} + ⚡ {fa(ms.hunter.rewardXp)}</span>}
          </div>
          {!hunterPair.length && !hunterRes && <button style={{ ...btnGhost, marginTop: 8, fontSize: 12, padding: '6px 12px' }} disabled={busy} onClick={doHunter}>شروعِ مقایسه</button>}
          {hunterPair.length === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              {hunterPair.map((h: any) => (
                <button key={h.id} style={{ ...card, cursor: 'pointer', textAlign: 'right' }} onClick={() => doHunterPick(h.id)}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{h.title.slice(0, 50)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{h.hood}{h.area ? ` · ${fa(h.area)} متر` : ''} · {faB(h.price)} تومان</div>
                </button>
              ))}
            </div>
          )}
          {hunterRes && <div style={{ marginTop: 8, fontSize: 13 }}>
            {hunterRes.correct ? <b style={{ color: '#7c6' }}>✅ درست تشخیص دادی{hunterRes.rewardXp ? ` (+⚡${fa(hunterRes.rewardXp)} +🪙${fa(hunterRes.rewardCoins)})` : ''}</b> : <b style={{ color: '#e88' }}>بازار نظرِ دیگری داشت — ملاکِ «بهتر»، استقبالِ واقعیِ کاربرانِ ملک‌جت بود.</b>}
            <button style={{ ...btnGhost, marginRight: 8, fontSize: 12, padding: '4px 10px' }} onClick={doHunter}>دوباره</button>
          </div>}
        </div>
      </div>
    </div>}

    </>}
    </>}

    {gtab === 'market' && <>
    {tabHead('📊', 'بازار', 'سرمایه، صندوق‌ها، فروشگاه‌ها و بازارِ امپراتورها')}
    {/* ⚡ فاز ۱۶۸ — سادگیِ اول-نگاه: یک جمله + حداکثر ۳ کارتِ بزرگ؛ بقیه داخلِ «همهٔ امکانات» */}
    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>اینجا جای معامله است: فرصتِ واقعیِ امروز را شکار کن، خودت جستجو کن، یا با امپراتورهای واقعی داد‌وستد کن.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      <button className="empChunky" onClick={() => { setGtab('city'); setCitySheet('deals') }}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#ff5f4d')}>🔥</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>فرصت‌های طلاییِ امروز</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
            {((st.dealsEnabled && deals?.deals?.length) || 0) > 0 ? `${fa(deals.deals.length)} آگهیِ واقعیِ زیرِ قیمتِ محله` : 'شکارِ آگهی‌های واقعیِ زیرِ قیمت'}
          </span>
        </span>
      </button>
      <Link href="/search" className="empChunky"
        style={{ ...card, cursor: 'pointer', textDecoration: 'none', textAlign: 'right', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#7ee0b8')}>🔎</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>جستجوی ملکِ واقعی</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>بازارِ واقعیِ ملک‌جت — هر بازدید مأموریت‌هایت را هم جلو می‌برد</span>
        </span>
      </Link>
      <button className="empChunky" onClick={() => { setMktV('players'); setAllFx(true) }}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#ffd76a')}>🏪</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>بازارِ امپراتورها</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>عرضه و مزایدهٔ دارایی‌ها میانِ بازیکنانِ واقعی</span>
        </span>
      </button>
    </div>
    <details open={allFx} onToggle={(ev: any) => setAllFx(!!ev.currentTarget.open)} style={{ ...card, padding: '12px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>🧰 همهٔ امکاناتِ بازارِ شهر</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
    {subNav([
      ['capital', '📈', 'سرمایه و روندها'],
      ['players', '🏪', 'بازارِ امپراتورها'],
      ['bank', '🏦', 'بانک'],
      ['shop', '🪙', 'فروشگاه'],
    ], mktV, setMktV)}
    {/* فاز ۱۶۳ — سربرگِ بخشِ فعالِ بازار با چیپِ رنگی؛ صرفاً ظاهر */}
    {qSection(({ capital: '📈', players: '🏪', bank: '🏦', shop: '🪙' } as Record<string, string>)[mktV] || '📊',
      ({ capital: 'سرمایه و روندهای واقعی', players: 'بازارِ امپراتورهای واقعی', bank: 'بانک و اعتبار', shop: 'فروشگاه' } as Record<string, string>)[mktV] || 'بازار', '#5fd98a')}

    {mktV === 'capital' && <>
    {/* 🧭 روندِ محله‌ها (فاز ۳۹ — سند ۲۶ Part 04): از تاریخچهٔ روزانهٔ واقعیِ رصدخانه — تا دو اسنپ‌شات نباشد، هیچ روندی ادعا نمی‌شود. */}
    {intel?.ok && intel.market && <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>🧭 روندِ بازارِ واقعی</b>
        {intel.market.ready && intel.market.city.pct !== null && <span style={{ ...pill(), color: intel.market.city.pct >= 0 ? '#7ee0b8' : '#e08a7e' }}>
          میانهٔ متریِ شهر در {fa(intel.market.sinceDays)} روز: {intel.market.city.pct >= 0 ? '▲' : '▼'} {fa(Math.abs(intel.market.city.pct))}٪
        </span>}
      </div>
      {!intel.market.ready && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{intel.market.note}</div>}
      {intel.market.ready && (intel.market.rising.length > 0 || intel.market.falling.length > 0) && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8, marginTop: 10, fontSize: 12 }}>
        {intel.market.rising.map((h: any) => <div key={'r' + h.hood} style={{ ...card, background: 'var(--bg2)', padding: 10 }}>
          <b style={{ color: '#7ee0b8' }}>▲ {h.hood}</b>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>متری {faB(h.perM)} تومان · رشدِ {fa(h.pct)}٪ در {fa(intel.market.sinceDays)} روز</div>
        </div>)}
        {intel.market.falling.map((h: any) => <div key={'f' + h.hood} style={{ ...card, background: 'var(--bg2)', padding: 10 }}>
          <b style={{ color: '#e08a7e' }}>▼ {h.hood}</b>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>متری {faB(h.perM)} تومان · افتِ {fa(Math.abs(h.pct))}٪ در {fa(intel.market.sinceDays)} روز</div>
        </div>)}
      </div>}
      {intel.market.ready && intel.market.rising.length === 0 && intel.market.falling.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>در این بازه هیچ محله‌ای با نمونهٔ کافی جابه‌جاییِ معنادار نداشته — بازار آرام است.</div>}
    </div>}
    </>}

    {mktV === 'shop' && <>
    {/* 🪙 فروشگاهِ ملک‌کوین (فاز ۲۸): پولِ واقعی فقط «زمان/تحلیل» می‌خرد — هرگز قدرت (بدونِ P2W) */}
    {st.coinShop?.enabled && (st.coinShop.packs || []).length > 0 && <div id="coin-shop" style={{ ...card, borderColor: 'var(--goldDim)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🪙 فروشگاهِ ملک‌کوین</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>کوین فقط سرعت (پیگیری/شیفتِ شبانه)، ژتونِ تحلیل و ظاهر می‌خرد — هرگز قدرت یا XP</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 8, marginTop: 10 }}>
        {st.coinShop.packs.map((p: any) => (
          <div key={p.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
            <b style={{ fontSize: 13 }}>{p.label}</b>
            {/* بستهٔ زمان‌دار (فاز ۳۳ — سند ۲۲ فصل ۷): تاریخِ واقعیِ پایان، شفاف — نه تایمرِ نمایشی */}
            {p.until && <span style={{ fontSize: 10, color: '#e7a14a' }}>⏳ فقط تا {new Date(p.until + 'T23:59:59').toLocaleDateString('fa-IR')}</span>}
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>🪙 {fa(p.coins)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{faB(p.priceToman)} تومان</div>
            <button style={{ ...btn, padding: '5px 16px', fontSize: 12 }} disabled={busy} onClick={async () => {
              setBusy(true)
              try {
                const r = await fetch('/api/empire/coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId: p.id }) })
                const d = await r.json().catch(() => null)
                if (d?.card2card) { setCoinCk({ pack: p, amount: d.amount, card: d.card, zarinpal: !!d.zarinpal }); setCoinReceipt(''); return }
                if (d?.redirect) { window.location.href = d.redirect; return }
                alert(d?.error || 'خطا در شروعِ پرداخت')
              } finally { setBusy(false) }
            }}>خرید</button>
          </div>
        ))}
      </div>
      {/* فاز ۵۳: چک‌اوتِ کارت‌به‌کارتِ کوین */}
      {coinCk && <div style={{ border: '1px solid var(--gold)', borderRadius: 14, padding: 14, marginTop: 10, background: 'rgba(212,175,55,.06)' }}>
        <b style={{ fontSize: 13 }}>💳 پرداختِ کارت‌به‌کارت — {coinCk.pack.label} ({fa(coinCk.pack.coins)} کوین)</b>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>مبلغِ قابلِ‌واریز: <b style={{ color: 'var(--gold)' }}>{faB(coinCk.amount)} تومان</b></div>
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 10, padding: 10, marginTop: 8, fontSize: 12.5, lineHeight: 2.1 }}>
          {coinCk.card.cardNumber && <div>شمارهٔ کارت: <b dir="ltr" style={{ letterSpacing: 2, color: 'var(--gold)', userSelect: 'all' }}>{coinCk.card.cardNumber}</b></div>}
          {coinCk.card.iban && <div>شبا: <b dir="ltr" style={{ userSelect: 'all' }}>{coinCk.card.iban}</b></div>}
          {coinCk.card.holderName && <div>به نامِ: <b>{coinCk.card.holderName}</b>{coinCk.card.bank ? ` — ${coinCk.card.bank}` : ''}</div>}
          {coinCk.card.note && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{coinCk.card.note}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input value={coinReceipt} onChange={ev => setCoinReceipt(ev.target.value)} placeholder="کدِ رهگیری / ۴ رقمِ آخرِ کارتِ خودت" style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5 }} />
          <button style={{ ...btn, padding: '8px 16px', fontSize: 12 }} disabled={busy || !coinReceipt.trim()} onClick={async () => {
            const r = await fetch('/api/empire/coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId: coinCk.pack.id, receipt: coinReceipt.trim() }) })
            const d = await r.json().catch(() => null)
            if (d?.pending) { setCoinCk(null); alert(`✓ ${d.message || 'درخواستت ثبت شد — پس از تأییدِ واریزی، کوین‌ها خودکار اضافه می‌شوند.'}`) }
            else alert(d?.error || 'ثبتِ سفارش ناموفق بود')
          }}>واریز کردم — ثبت</button>
          <button style={{ ...btnGhost, padding: '8px 12px', fontSize: 12 }} onClick={() => setCoinCk(null)}>انصراف</button>
        </div>
        {/* فاز ۶۹: اگر درگاهِ زرین‌پال هم فعال است، پرداختِ آنلاینِ فوری */}
        {coinCk.zarinpal && <button style={{ width: '100%', marginTop: 8, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', borderRadius: 10, padding: '9px 0', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} disabled={busy} onClick={async () => {
          const r = await fetch('/api/empire/coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId: coinCk.pack.id, gateway: 'zarinpal' }) })
          const d = await r.json().catch(() => null)
          if (d?.redirect) { window.location.href = d.redirect; return }
          alert(d?.error || 'خطا در اتصال به درگاه')
        }}>⚡ پرداختِ آنلاین و شارژِ فوری (زرین‌پال)</button>}
      </div>}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>پرداختِ کارت‌به‌کارت با کدِ رهگیری (پس از تأییدِ ملک‌جت، کوین خودکار اضافه می‌شود) — همه‌چیز در تایم‌لاینت ثبت است.</div>
    </div>}

    {/* 🎨 فروشگاهِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳): قاب و نشان با ملک‌کوین — «هیچ آیتمِ ظاهری روی اقتصاد،
        سرعتِ ساخت یا قدرتِ رقابتی اثر نمی‌گذارد»؛ ارزشش این است که دیگران در لیدربورد می‌بینند. */}
    {st.cosmetics?.enabled && (st.cosmetics.items || []).length > 0 && <div id="cosmetic-shop" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🎨 فروشگاهِ ظاهری</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>قاب و نشان کنارِ نامت در لیدربورد و پروفایل دیده می‌شود — فقط ظاهر، صفر اثرِ اقتصادی</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>🪙 {fa(e.coins)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginTop: 10 }}>
        {st.cosmetics.items.map((it: any) => {
          const owned = (st.cosmetics.owned || []).includes(it.id)
          const active = st.cosmetics[it.kind] === it.id
          return <div key={it.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', borderColor: active ? 'var(--gold)' : undefined }}>
            <span style={{ fontSize: 24 }}>{it.icon}</span>
            <b style={{ fontSize: 12.5 }}>{it.label}</b>
            <span style={{ fontSize: 10, color: 'var(--faint)' }}>{it.kind === 'frame' ? 'قابِ پروفایل' : 'نشانِ کنارِ نام'}</span>
            {!owned && <button style={{ ...btn, padding: '4px 14px', fontSize: 12 }} disabled={busy} onClick={async () => {
              const d = await api({ action: 'cosmeticBuy', id: it.id })
              if (d) { setSt(d); celebrate() }
            }}>🪙 {fa(it.priceCoins)}</button>}
            {owned && <button style={{ ...(active ? btn : btnGhost), padding: '4px 14px', fontSize: 12 }} disabled={busy} onClick={async () => {
              const d = await api({ action: 'cosmeticSet', kind: it.kind, id: active ? '' : it.id })
              if (d) setSt(d)
            }}>{active ? 'فعال ✓ (بردار)' : 'فعال کن'}</button>}
          </div>
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>خرید با ملک‌کوینِ کیفِ خودت انجام می‌شود و در تایم‌لاینت ثبت است · آیتمِ خریداری‌شده دائمی است.</div>
    </div>}

    {/* 🎨 فروشگاهِ سازندگان (فاز ۱۰۷ — سند ۲۲ Creator Store): طرحِ خودت را بساز؛ پس از تأییدِ ملک‌جت
        در همین فروشگاه فروخته می‌شود و سهمِ هر فروش به کوینت می‌آید. فقط ظاهر — صفر اثرِ اقتصادی. */}
    {st.cosmetics?.enabled && st.creator?.enabled && <CreatorStudioCard st={st} api={api} busy={busy} />}

    </>}

    {mktV === 'players' && <>
    {/* 💬 گفت‌وگوی سراسریِ شهر (فاز ۱۱۱ — فصل‌های ۸/۱۰): polling سبک؛ ضدِ اسپم + گزارش + نظارتِ ملک‌جت */}
    {cht?.enabled && <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>💬 گفت‌وگوی شهر</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>حرفِ همهٔ فعالانِ شهر — با احترام؛ گزارش‌ها را ملک‌جت بررسی می‌کند</span>
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} disabled={busy} onClick={loadCht}>↻</button>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {(cht.msgs || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز حرفی زده نشده — تو شروع کن.</div>}
        {(cht.msgs || []).map((m: any) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, padding: '5px 8px', borderRadius: 10, background: m.mine ? 'rgba(212,175,55,.07)' : 'var(--bg2)' }}>
            <b style={{ color: m.mine ? 'var(--gold)' : 'var(--text)', whiteSpace: 'nowrap' }}>{m.name} <span style={{ color: 'var(--faint)', fontSize: 9.5, fontWeight: 400 }}>#{fa(m.no)}</span></b>
            <span style={{ flex: 1, lineHeight: 1.8, wordBreak: 'break-word' }}>{m.text}</span>
            <span style={{ color: 'var(--faint)', fontSize: 9 }}>{new Date(m.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
            {!m.mine && <button title={m.reported ? 'گزارش شد' : 'گزارش به ملک‌جت'} style={{ background: 'none', border: 'none', cursor: m.reported ? 'default' : 'pointer', fontSize: 10, opacity: m.reported ? .9 : .45, color: m.reported ? '#e7a14a' : 'inherit' }} disabled={busy || m.reported}
              onClick={async () => { const d = await api({ action: 'chatReport', id: m.id }); if (d?.ok) setCht({ ...cht, ...d }) }}>⚑</button>}
          </div>
        ))}
      </div>
      {cht.mutedUntil > 0 && <div style={{ fontSize: 11, color: '#e7a14a', marginTop: 8 }}>به تشخیصِ ملک‌جت فعلاً امکانِ ارسال نداری (تا {new Date(cht.mutedUntil).toLocaleDateString('fa-IR')}) — خواندن آزاد است.</div>}
      {!cht.canPost && !cht.mutedUntil && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>ارسالِ پیام از سطحِ {fa(cht.minLevel)} باز می‌شود — خواندن آزاد است.</div>}
      {cht.canPost && !cht.mutedUntil && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={chtTxt} onChange={e => setChtTxt(e.target.value)} maxLength={cht.maxLen || 240} placeholder={`پیام به شهر… (هر ${fa(cht.cooldownSec || 15)} ثانیه یکی)`}
          style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
          onKeyDown={async e => { if (e.key === 'Enter' && chtTxt.trim()) { const d = await api({ action: 'chatSend', text: chtTxt }); if (d?.ok) { setCht({ ...cht, ...d }); setChtTxt('') } } }} />
        <button style={{ ...btn, padding: '8px 18px', fontSize: 12.5 }} disabled={busy || !chtTxt.trim()} onClick={async () => {
          const d = await api({ action: 'chatSend', text: chtTxt })
          if (d?.ok) { setCht({ ...cht, ...d }); setChtTxt('') }
        }}>ارسال</button>
      </div>}
    </div>}

    {/* فاز ۱۰۲: دوستان (فالوی دوطرفه) + دوئلِ هفتگی + گفتگوی دوستان */}
    <div style={{ ...card, borderColor: '#7ac9a2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>👥 دوستان و دوئلِ هفته</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>دوست = دنبال‌کردنِ دوطرفه (از فیدِ دنیا یا رتبه‌ها دنبال کن)</span>
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} disabled={busy} onClick={loadSoc}>↻</button>
      </div>
      {!soc && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>در حالِ بارگذاری…</div>}
      {soc && <>
        {(soc.friends || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>هنوز دوستی نداری — در «دنیا» یا «رتبه‌ها» امپراتوری‌ها را دنبال کن؛ هر که تو را متقابل دنبال کند دوستت می‌شود.</div>}
        {(soc.friends || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {soc.friends.map((f: any) => (
            <span key={f.no} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 10px', fontSize: 11 }}>
              <b>{f.name}</b><span style={{ color: 'var(--faint)', fontSize: 9.5 }}>#{fa(f.no)}</span>
              <button style={{ ...btnGhost, padding: '1px 7px', fontSize: 10 }} disabled={busy} title="گفتگو" onClick={async () => { setDmWith({ no: f.no, name: f.name }); await loadDm(f.no) }}>💬</button>
              {soc.duelCfg?.enabled && <button style={{ ...btnGhost, padding: '1px 7px', fontSize: 10 }} disabled={busy} title="دوئلِ رشدِ این هفته" onClick={async () => {
                if (!confirm(`دوئلِ این هفته با «${f.name}»؟ متریک = رشدِ ارزشِ خالص از لحظهٔ پذیرش تا پایانِ هفته — برد ${fa(soc.duelCfg.xpWin)} XP`)) return
                const d = await api({ action: 'duelStart', opponentNo: f.no }); if (d) { alert(d.note || 'دعوت رفت'); loadSoc() }
              }}>⚔️</button>}
            </span>
          ))}
        </div>}
        {(soc.duels || []).map((d: any) => (
          <div key={d.id} style={{ marginTop: 8, fontSize: 11.5, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 11px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>🥊 {d.a.name} در برابرِ {d.b?.name || d.npcName || 'شرکت'}</span>
            {d.status === 'pending' && d.b?.no === soc.myNo && <button style={{ ...btn, padding: '2px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const r = await api({ action: 'duelAccept', id: d.id }); if (r) loadSoc() }}>می‌پذیرم</button>}
            {d.status === 'pending' && d.b?.no !== soc.myNo && <span style={{ color: 'var(--muted)' }}>در انتظارِ پذیرشِ حریف…</span>}
            {d.status === 'active' && <span style={{ color: 'var(--gold)' }}>در جریان تا پایانِ هفته — رشدِ واقعی برنده را تعیین می‌کند</span>}
            {d.status === 'done' && <span style={{ color: d.winner === 'tie' ? 'var(--muted)' : '#7c6' }}>{d.winner === 'tie' ? 'مساوی/منتفی' : `برنده: ${d.winner === 'a' ? d.a.name : (d.b?.name || d.npcName)} (${fa(d.aGrowth ?? 0)}٪ در برابرِ ${fa(d.bGrowth ?? 0)}٪)`}</span>}
          </div>
        ))}
        {dmWith && <div style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 12 }}>💬 گفتگو با {dmWith.name}</b>
            <span style={{ fontSize: 9.5, color: 'var(--faint)' }}>هر ۶ ثانیه تازه می‌شود</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, padding: '2px 8px', fontSize: 10 }} onClick={() => { setDmWith(null); setDmMsgs([]) }}>بستن</button>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
            {dmMsgs.length === 0 && <div style={{ fontSize: 11, color: 'var(--faint)' }}>هنوز پیامی نیست — سلام کن!</div>}
            {dmMsgs.map((m: any, i: number) => (
              <div key={i} style={{ alignSelf: m.no === soc.myNo ? 'flex-start' : 'flex-end', background: m.no === soc.myNo ? 'var(--goldDim)' : 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '4px 10px', fontSize: 11.5, maxWidth: '85%' }}>{m.text}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={dmText} onChange={ev => setDmText(ev.target.value)} onKeyDown={async ev => { if (ev.key === 'Enter' && dmText.trim()) { const d = await api({ action: 'dmSend', withNo: dmWith.no, text: dmText }); if (d) { setDmMsgs(d.msgs || []); setDmText('') } } }} placeholder="پیام…" style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 9, padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
            <button style={{ ...btn, padding: '5px 14px', fontSize: 11.5 }} disabled={busy || !dmText.trim()} onClick={async () => { const d = await api({ action: 'dmSend', withNo: dmWith.no, text: dmText }); if (d) { setDmMsgs(d.msgs || []); setDmText('') } }}>ارسال</button>
          </div>
        </div>}
      </>}
    </div>

    {/* 🏪 بازارِ امپراتورها + 🤝 مشارکتِ ساخت (فاز ۳۷ — درخواستِ مستقیم): هر آگهیِ واقعی فقط یک مالک دارد؛
        معامله و شراکت فقط بینِ امپراتورهای واقعی — از سطحِ مشخص (knob) باز می‌شود. */}
    {st.unlocks?.trade?.enabled !== false && <div style={{ ...card, borderColor: '#7aa2c9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🏪 بازارِ امپراتورها و مشارکتِ ساخت</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>ملک‌هایی که امپراتورهای واقعی عرضه کرده‌اند + پروژه‌هایی که شریک می‌خواهند</span>
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} disabled={busy} onClick={loadPmkt}>↻ تازه‌سازی</button>
      </div>
      {!st.unlocks?.trade?.ok && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>🔒 از سطحِ {fa(st.unlocks?.trade?.need || 0)} باز می‌شود — الان سطحِ {fa(st.unlocks?.level || 1)} هستی. با معامله و پروژه XP بگیر.</div>}
      {st.unlocks?.trade?.ok && <>
        {!pmkt && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حالِ بارگذاری…</div>}
        {pmkt && !(pmkt.sales || []).length && !(pmkt.jvs || []).length && !(pmkt.auctions || []).length && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>فعلاً هیچ امپراتوری ملکی عرضه نکرده، مزایده‌ای باز نیست و مشارکتی هم نیست — تو اولین باش: در «پرتفوی» روی دارایی‌ات «🏪 عرضه» یا «🔨 مزایده» را بزن.</div>}
        {(pmkt?.auctions || []).length > 0 && <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🔨 مزایده‌های زندهٔ امپراتورها <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>— بالاترین پیشنهاد سرِ چکش می‌بَرد؛ هر پیشنهاد حداقل {fa(pmkt.auctionStepPct || 5)}٪ بالاتر از قبلی</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pmkt.auctions.map((au: any) => (
              <div key={au.assetId} style={{ ...card, background: 'var(--bg2)', borderColor: au.myTop ? 'var(--gold)' : 'var(--line)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                <span>{au.kind === 'land' ? '🏞' : au.kind === 'commercial' ? '🏪' : '🏠'}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{au.title}</b>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{au.hood} · فروشنده: {au.seller} #{fa(au.no)} · ⏳ {fa(au.daysLeft)} روز تا چکش · {fa(au.bids)} پیشنهاد</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{au.top > 0 ? <>بالاترین: <b style={{ color: au.myTop ? 'var(--gold)' : 'var(--text)' }}>{faB(au.top)}</b> ({au.myTop ? 'تو! 👑' : au.topBy})</> : <>پایه: <b>{faB(au.minBid)}</b></>}</div>
                  {au.check?.note && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>🧾 {au.check.note}</div>}
                </div>
                {au.mine && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', border: '1px solid var(--goldDim)', borderRadius: 999, padding: '3px 10px' }}>👑 مزایدهٔ خودت — لغو از کارتِ دارایی در پرتفوی</span>}
                {!au.mine && <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                  <input value={bidIn[au.assetId] || ''} onChange={ev => setBidIn({ ...bidIn, [au.assetId]: digitsOf(ev.target.value) })} placeholder="پیشنهاد (میلیون)" inputMode="numeric" style={{ width: 104, padding: 6, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'center', fontSize: 11.5 }} />
                  <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} disabled={busy} onClick={async () => {
                    const m = Math.round(Number(digitsOf(bidIn[au.assetId] || '')) || 0)
                    if (!(m > 0)) { setErr('پیشنهادت را به میلیون تومان بنویس'); return }
                    const d = await api({ action: 'p2pAuctionBid', no: au.no, assetId: au.assetId, amount: m * 1e6 })
                    if (d?.ok) { setBidIn({ ...bidIn, [au.assetId]: '' }); celebrate(); loadPmkt() }
                  }}>پیشنهاد</button>
                </span>}
              </div>
            ))}
          </div>
        </div>}
        {(pmkt?.sales || []).length > 0 && <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>عرضه‌های امپراتورها</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pmkt.sales.map((s: any) => (
              <div key={s.assetId} style={{ ...card, background: 'var(--bg2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                <span>{s.kind === 'land' ? '🏞' : s.kind === 'commercial' ? '🏪' : '🏠'}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{s.title}</b>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.hood} · فروشنده: {s.seller} #{fa(s.no)}{s.renov > 0 && ` · بازسازی‌شده +${fa(s.renov)}٪`}{s.designed && ' · با نقشهٔ معمار'}</div>
                  {s.check?.note && <div style={{ fontSize: 10.5, color: (s.check.diffPct ?? 0) > 25 ? '#e8c37a' : 'var(--faint)', marginTop: 2 }}>🧾 {s.check.note}</div>}
                </div>
                <b style={{ color: 'var(--gold)' }}>{faB(s.price)}</b>
                {s.mine ? <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', border: '1px solid var(--goldDim)', borderRadius: 999, padding: '3px 10px' }}>👑 عرضهٔ خودت</span>
                : <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} disabled={busy} onClick={async () => {
                  if (!confirm(`«${s.title}» از ${s.seller} به ${faB(s.price)} تومان (+ مالیاتِ انتقال) خریده شود؟`)) return
                  const d = await api({ action: 'tradeBuy', no: s.no, assetId: s.assetId })
                  if (d) { setSt(d); celebrate(); loadPmkt() }
                }}>خرید</button>}
              </div>
            ))}
          </div>
        </div>}
        {(pmkt?.jvs || []).length > 0 && <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🤝 پروژه‌های شریک‌خواه (مشارکتِ ساخت)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pmkt.jvs.map((j: any) => (
              <div key={j.assetId} style={{ ...card, background: 'var(--bg2)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                <span>{j.building ? '🏗' : '🏞'}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{j.title}</b>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{j.hood} · سازنده: {j.owner} #{fa(j.no)} · {j.building ? 'در حالِ ساخت' : 'آمادهٔ ساخت'}</div>
                  {j.check?.note && <div style={{ fontSize: 10.5, color: (j.check.diffPct ?? 0) > 10 ? '#e8c37a' : 'var(--faint)', marginTop: 2 }}>🧾 {j.check.note}</div>}
                </div>
                <span style={{ fontSize: 12 }}><b style={{ color: 'var(--gold)' }}>{fa(j.pct)}٪ سهم</b> در برابرِ <b>{faB(j.amount)}</b> آورده</span>
                {j.mine ? <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', border: '1px solid var(--goldDim)', borderRadius: 999, padding: '3px 10px' }}>👑 پروژهٔ خودت</span>
                : <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} disabled={busy} onClick={async () => {
                  if (!confirm(`شریکِ ${fa(j.pct)}٪ پروژهٔ «${j.title}» شوی؟ آورده: ${faB(j.amount)} تومان. سهمت از هر فروش/پیش‌فروش خودکار واریز می‌شود؛ هزینهٔ روزانهٔ کارگاه با سازنده است.`)) return
                  const d = await api({ action: 'jvJoin', no: j.no, assetId: j.assetId })
                  if (d) { setSt(d); celebrate(); loadPmkt() }
                }}>شریک شو</button>}
              </div>
            ))}
          </div>
        </div>}
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>قانونِ شهر: هر آگهیِ واقعی فقط یک مالک دارد — اگر ملکی را امپراتورِ دیگری خریده باشد، فقط از خودش می‌توانی بخری. مالیاتِ انتقال با خریدار، کمیسیونِ مشاور با فروشنده.</div>
      </>}
    </div>}

    </>}

    {mktV === 'bank' && <>
    {/* بانک (جلد ۱۶): امتیازِ اعتباری + وام */}
    {st.bank && <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ fontSize: 14 }}>🏦 بانکِ امپراتوری</b>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>امتیازِ اعتباری: <b style={{ color: st.bank.credit.score > 600 ? '#7c6' : st.bank.credit.score > 300 ? 'var(--gold)' : '#e88' }}>{fa(st.bank.credit.score)}</b> / ۱٬۰۰۰ · {st.bank.credit.band}</span>
        <div style={{ flex: 1, minWidth: 120, height: 6, background: 'var(--line)', borderRadius: 3 }}><div style={{ width: `${st.bank.credit.score / 10}%`, height: 6, borderRadius: 3, background: st.bank.credit.score > 600 ? '#7c6' : st.bank.credit.score > 300 ? 'var(--gold)' : '#e88' }} /></div>
      </div>
      {st.bank.loan ? (
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ fontSize: 13 }}>💳 وامِ فعال: ماندهٔ <b style={{ color: 'var(--gold)' }}>{faB(st.bank.loan.balance)} تومان</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}> · نرخ {st.bank.loan.ratePctYear.toLocaleString('fa-IR')}٪ سالانه (روزشمار) · سررسید {new Date(st.bank.loan.dueAt).toLocaleDateString('fa-IR')}{Date.now() > st.bank.loan.dueAt && <b style={{ color: '#e88' }}> — دیرکرد! نرخ ×۱.۵</b>}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input value={repayVal ? Number(repayVal).toLocaleString('fa-IR') : ''} onChange={ev => setRepayVal(digitsOf(ev.target.value))} placeholder="مبلغِ بازپرداخت (تومان)" inputMode="numeric" dir="ltr" style={{ flex: 1, minWidth: 150, padding: 9, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, textAlign: 'center' }} />
            <button style={{ ...btn, padding: '8px 14px', fontSize: 13 }} disabled={busy || !repayVal} onClick={async () => { const d = await api({ action: 'repay', amount: Number(repayVal) }); if (d) { setSt(d); setRepayVal(''); if (d.settled) alert('🎉 وام کامل تسویه شد — خوش‌حسابی‌ات در سابقهٔ اعتباری ثبت شد.') } }}>بازپرداخت</button>
            <button style={{ ...btnGhost, padding: '8px 12px', fontSize: 12 }} disabled={busy} onClick={async () => { const d = await api({ action: 'repay', amount: st.bank.loan.balance }); if (d) { setSt(d); if (d.settled) alert('🎉 وام کامل تسویه شد.') } }}>تسویهٔ کامل</button>
          </div>
        </div>
      ) : st.bank.terms?.eligible ? (
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>با اعتبارِ فعلی‌ات تا <b style={{ color: 'var(--gold)' }}>{faB(st.bank.terms.maxLoan)} تومان</b> وام می‌گیری · نرخ {st.bank.terms.ratePctYear.toLocaleString('fa-IR')}٪ سالانه · بازپرداخت تا {fa(st.bank.terms.termDays)} روز. اعتبارِ بالاتر = نرخِ بهتر و سقفِ بیشتر.
            {st.bank.terms.repCutPct ? <span style={{ color: 'var(--gold)' }}> ⭐ اعتبارِ برندِ شرکتت {fa(st.bank.terms.repCutPct)}٪ از نرخ کم کرد.</span> : null}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input value={loanVal ? Number(loanVal).toLocaleString('fa-IR') : ''} onChange={ev => setLoanVal(digitsOf(ev.target.value))} placeholder="مبلغِ وام (تومان)" inputMode="numeric" dir="ltr" style={{ flex: 1, minWidth: 150, padding: 9, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, textAlign: 'center' }} />
            <button style={{ ...btn, padding: '8px 14px', fontSize: 13 }} disabled={busy || !loanVal} onClick={async () => { const d = await api({ action: 'loan', amount: Number(loanVal) }); if (d) { setSt(d); setLoanVal('') } }}>دریافتِ وام</button>
          </div>
          {Number(loanVal) > 0 && <div style={{ fontSize: 11.5, color: 'var(--gold)', marginTop: 6 }}>درخواستِ تو: {faB(Number(loanVal))} تومان</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>با این امتیازِ اعتباری هنوز وام تعلق نمی‌گیرد — با حضورِ منظم، تسویهٔ به‌موقع و سودِ واقعی اعتبارت را بساز.</div>
      )}
    </div>}
    </>}

    {gtab === 'market' && mktV === 'capital' && <>
    {/* بازار سرمایه (جلد ۴۰): صندوقِ شاخصی + مشارکتِ جمعی + شاخص‌ها — همه از بازارِ واقعی */}
    {/* سطح‌گشایی (سند ۱۵): بازارِ سرمایه از سطحِ مشخصی باز می‌شود — قفل شفاف است، نه پنهان */}
    {st.capitalEnabled && st.unlocks && !st.unlocks.capital.ok && <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>🔒</span>
      <span><b style={{ color: 'var(--text)' }}>📊 بازارِ سرمایه</b> از سطحِ {fa(st.unlocks.capital.need)} باز می‌شود — الان سطحِ {fa(st.unlocks.level)} هستی.</span>
    </div>}
    {st.capitalEnabled && (!st.unlocks || st.unlocks.capital.ok) && <details style={card} onToggle={(ev: any) => { if (ev.currentTarget.open && !mkt) doMarket() }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>📊 بازار سرمایه — صندوق‌ها و مشارکت‌ها</summary>
      {!mkt ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حال بارگذاری...</div> : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* پرتفوی (فصل ۱۳) */}
          {mkt.portfolio.total > 0 && <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, fontSize: 12 }}>
              <b>🧺 پرتفوی تو</b>
              <span style={{ color: 'var(--muted)' }}>شاخصِ تنوع: <b style={{ color: mkt.portfolio.diversification >= 40 ? '#7c6' : 'var(--gold)' }}>{fa(mkt.portfolio.diversification)}</b>/۱۰۰</span>
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
              {mkt.portfolio.parts.filter((p: any) => p.value > 0).map((p: any) => (
                <div key={p.key} title={p.label} style={{ width: `${p.pct}%`, background: p.key === 'cash' ? 'var(--gold)' : p.key === 'properties' ? '#7c6' : p.key === 'funds' ? '#69c' : '#c9a' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: 'var(--muted)' }}>
              {mkt.portfolio.parts.filter((p: any) => p.value > 0).map((p: any) => (
                <span key={p.key}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.key === 'cash' ? 'var(--gold)' : p.key === 'properties' ? '#7c6' : p.key === 'funds' ? '#69c' : '#c9a', marginLeft: 4 }} />{p.label} {fa(p.pct)}٪ ({faB(p.value)})</span>
              ))}
            </div>
          </div>}
          {/* شاخص‌ها (فصل ۱۲) + روان‌شناسیِ بازار (فصل ۱۶) */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
            {mkt.indices.samples > 0 && <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)' }}>📈 شاخصِ کل: <b style={{ color: 'var(--gold)' }}>{faB(mkt.indices.overallPerM)}</b> ت/متر <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>({fa(mkt.indices.samples)} آگهیِ واقعی)</span></span>}
            {mkt.indices.rentSamples > 0 && <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)' }}>🔑 شاخصِ اجاره: <b style={{ color: 'var(--gold)' }}>{faB(mkt.indices.rentPerM)}</b> ت/متر</span>}
            {/* فاز ۱۰۰ (جلد ۴۳): شاخصِ مصالح از قیمت‌های واقعیِ بازارِ مصالحِ سایت — روی هزینهٔ ساخت اثر دارد */}
            {mkt.materials?.ok
              ? <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)' }}>🧱 شاخصِ مصالح: <b style={{ color: 'var(--gold)' }}>{fa(mkt.materials.index)}</b>
                {typeof mkt.materials.weekDeltaPct === 'number' && <b style={{ color: mkt.materials.weekDeltaPct > 0 ? '#e88' : mkt.materials.weekDeltaPct < 0 ? '#7c6' : 'var(--muted)', marginInlineStart: 4 }}>{mkt.materials.weekDeltaPct > 0 ? '▲' : mkt.materials.weekDeltaPct < 0 ? '▼' : ''}{fa(Math.abs(mkt.materials.weekDeltaPct))}٪ هفته</b>}
                <span style={{ color: 'var(--faint)', fontSize: 10.5 }}> ({fa(mkt.materials.items)} کالای واقعی{mkt.materials.factor !== 1 ? ` · ضریبِ ساخت ×${mkt.materials.factor.toLocaleString('fa-IR')}` : ''})</span></span>
              : mkt.materials?.enabled && <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)', color: 'var(--faint)' }}>🧱 شاخصِ مصالح: هنوز دادهٔ قیمتیِ کافی از بازارِ مصالح ثبت نشده</span>}
            <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)' }}>🌡 نبضِ بازار: <b style={{ color: mkt.psychology.score >= 55 ? '#7c6' : mkt.psychology.score <= 45 ? '#e88' : 'var(--muted)' }}>{mkt.psychology.label}</b> ({fa(mkt.psychology.score)}/۱۰۰) <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>از رفتارِ واقعیِ ۱۴ روز</span></span>
            {/* فاز ۴۷ (فیدبک): جمعِ کلِ سود/زیانِ صندوق‌ها و مشارکت‌ها — یک نگاه، کلِ قصه */}
            {(() => {
              const hs = [...(mkt.funds || []).map((f: any) => f.my), ...(mkt.pools || []).map((p: any) => p.my)].filter(Boolean)
              if (!hs.length) return null
              const cost = hs.reduce((t: number, h: any) => t + h.cost, 0), val = hs.reduce((t: number, h: any) => t + h.value, 0)
              const d = val - cost, pct = cost > 0 ? Math.round(d / cost * 1000) / 10 : 0
              return <span style={{ ...card, padding: '6px 12px', background: d >= 0 ? 'rgba(110,220,160,.07)' : 'rgba(230,120,110,.08)', borderColor: d >= 0 ? '#3d5c4d' : '#5c3d3d' }}>
                💼 کلِ سرمایه‌گذاری‌هایت: دادی {faB(cost)} → الان <b style={{ color: 'var(--gold)' }}>{faB(val)}</b> · <b style={{ color: d >= 0 ? '#7ee0b8' : '#e88' }}>{d >= 0 ? '📈 سود' : '📉 زیان'} {faB(Math.abs(d))} ({fa(Math.abs(pct))}٪)</b>
              </span>
            })()}
          </div>
          {/* صندوق‌های شاخصی (فصل ۸): هر واحد = یک مترِ مجازی از بازارِ واقعی */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏦 صندوق‌های املاک <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>— هر واحد، یک «مترِ مجازی» از بازارِ واقعی؛ قیمتش با میانهٔ متریِ آگهی‌های واقعی بالا و پایین می‌رود و سودِ دوره‌ای از اجاره‌بهای واقعی می‌گیرد.</span></div>
            {(mkt.funds || []).map((f: any) => (
              <div key={f.id} style={{ ...card, background: 'var(--bg2)', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                  <b>{f.name}</b><span style={{ color: 'var(--faint)', fontSize: 11 }}>{f.seg || 'کلِ بازار'}</span>
                  {f.quote ? <>
                    <span style={{ color: 'var(--muted)' }}>واحد: <b style={{ color: 'var(--gold)' }}>{faB(f.quote.unit)} ت</b></span>
                    <span style={{ ...card, padding: '2px 8px', fontSize: 10.5, background: 'var(--surface)' }}>رتبه {f.quote.rating}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>بازدهِ اجاره {Number(f.quote.yieldPctYear).toLocaleString('fa-IR')}٪ سالانه · کارمزد {Number(f.feePctYear).toLocaleString('fa-IR')}٪ · {fa(f.quote.samples)} نمونهٔ واقعی</span>
                  </> : <span style={{ color: '#e88', fontSize: 11.5 }}>فعلاً نمونهٔ واقعیِ کافی برای قیمت‌گذاری نیست</span>}
                </div>
                {/* فاز ۴۷ (فیدبک: «معلوم نیست سود می‌کنم یا ضرر»): جعبهٔ صریحِ سود/زیان — دادی/الان/فرق */}
                {f.my && (() => { const d47 = f.my.value - f.my.cost; const pct47 = f.my.cost > 0 ? Math.round(d47 / f.my.cost * 1000) / 10 : 0; return (
                  <div style={{ marginTop: 8, border: `1px solid ${d47 >= 0 ? '#3d5c4d' : '#5c3d3d'}`, background: d47 >= 0 ? 'rgba(110,220,160,.06)' : 'rgba(230,120,110,.07)', borderRadius: 10, padding: '7px 10px', fontSize: 11.5, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>سهمِ تو: <b>{fa(f.my.units)}</b> واحد</span>
                    <span style={{ color: 'var(--muted)' }}>پولی که دادی: <b style={{ color: 'var(--text)' }}>{faB(f.my.cost)}</b></span>
                    <span style={{ color: 'var(--muted)' }}>ارزشِ الان: <b style={{ color: 'var(--gold)' }}>{faB(f.my.value)}</b></span>
                    <span style={{ color: d47 >= 0 ? '#7ee0b8' : '#e88', fontWeight: 800 }}>{d47 >= 0 ? '📈 در سودی' : '📉 در زیانی'}: {faB(Math.abs(d47))} ({fa(Math.abs(pct47))}٪)</span>
                    <span style={{ color: 'var(--faint)', fontSize: 10 }}>سودِ دوره‌ایِ اجاره جداگانه و خودکار به نقدت واریز می‌شود</span>
                  </div>
                )})()}
                {f.quote && <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={fu[f.id] ? Number(fu[f.id]).toLocaleString('fa-IR') : ''} onChange={ev => setFu({ ...fu, [f.id]: digitsOf(ev.target.value) })} placeholder="تعدادِ واحد" inputMode="numeric" dir="ltr" style={{ width: 110, padding: 8, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, textAlign: 'center' }} />
                  {Number(fu[f.id]) > 0 && <span style={{ fontSize: 11, color: 'var(--gold)' }}>≈ {faB(Number(fu[f.id]) * f.quote.unit)} ت</span>}
                  {f.enabled && <button style={{ ...btn, padding: '7px 14px', fontSize: 12.5 }} disabled={busy || !Number(fu[f.id])} onClick={() => doTrade({ action: 'fundBuy', fundId: f.id, units: Number(fu[f.id]) }, () => setFu({ ...fu, [f.id]: '' }))}>خرید</button>}
                  {f.my && <button style={{ ...btnGhost, padding: '7px 14px', fontSize: 12.5 }} disabled={busy || !Number(fu[f.id])} onClick={() => doTrade({ action: 'fundSell', fundId: f.id, units: Number(fu[f.id]) }, () => setFu({ ...fu, [f.id]: '' }))}>بازخرید</button>}
                </div>}
              </div>
            ))}
            {!(mkt.funds || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز صندوقی عرضه نشده — به‌محضِ عرضه همین‌جا می‌بینی.</div>}
          </div>
          {/* مشارکتِ جمعی (فصل ۷): مالکیتِ کسریِ آگهی‌های واقعیِ گران */}
          {mkt.crowd?.enabled && <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🤝 سرمایه‌گذاریِ جمعی <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>— ملک‌های واقعیِ بزرگ‌تر از سرمایهٔ یک نفر؛ هر واحد {faB(mkt.crowd.unitToman)} تومان، ارزشِ سهمت با قیمتِ زندهٔ همان آگهی حرکت می‌کند.</span></div>
            {(mkt.pools || []).map((p: any) => (
              <div key={p.listingId} style={{ ...card, background: 'var(--bg2)', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
                  <b>{p.title.slice(0, 55)}</b><span style={{ color: 'var(--faint)', fontSize: 11 }}>{p.hood}</span>
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--gold)' }}>🔗 آگهیِ واقعی</a>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120, height: 6, background: 'var(--line)', borderRadius: 3 }}><div style={{ width: `${Math.min(100, Math.round(p.soldUnits / p.totalUnits * 100))}%`, height: 6, background: 'var(--gold)', borderRadius: 3 }} /></div>
                  <span>{fa(p.soldUnits)}/{fa(p.totalUnits)} واحد · {fa(p.investors)} شریک · واحدِ روز <b style={{ color: 'var(--gold)' }}>{faB(p.unitNow)} ت</b></span>
                </div>
                {/* فاز ۴۷: همان جعبهٔ صریحِ سود/زیان برای استخرِ مشارکت — ارزش با قیمتِ زندهٔ همان آگهیِ واقعی */}
                {p.my && (() => { const d47 = p.my.value - p.my.cost; const pct47 = p.my.cost > 0 ? Math.round(d47 / p.my.cost * 1000) / 10 : 0; return (
                  <div style={{ marginTop: 8, border: `1px solid ${d47 >= 0 ? '#3d5c4d' : '#5c3d3d'}`, background: d47 >= 0 ? 'rgba(110,220,160,.06)' : 'rgba(230,120,110,.07)', borderRadius: 10, padding: '7px 10px', fontSize: 11.5, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>سهمِ تو: <b>{fa(p.my.units)}</b> واحد</span>
                    <span style={{ color: 'var(--muted)' }}>پولی که دادی: <b style={{ color: 'var(--text)' }}>{faB(p.my.cost)}</b></span>
                    <span style={{ color: 'var(--muted)' }}>ارزشِ الان: <b style={{ color: 'var(--gold)' }}>{faB(p.my.value)}</b></span>
                    <span style={{ color: d47 >= 0 ? '#7ee0b8' : '#e88', fontWeight: 800 }}>{d47 >= 0 ? '📈 در سودی' : '📉 در زیانی'}: {faB(Math.abs(d47))} ({fa(Math.abs(pct47))}٪)</span>
                  </div>
                )})()}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={cu[p.listingId] ? Number(cu[p.listingId]).toLocaleString('fa-IR') : ''} onChange={ev => setCu({ ...cu, [p.listingId]: digitsOf(ev.target.value) })} placeholder="تعدادِ واحد" inputMode="numeric" dir="ltr" style={{ width: 110, padding: 8, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, textAlign: 'center' }} />
                  {p.available > 0 && <button style={{ ...btn, padding: '7px 14px', fontSize: 12.5 }} disabled={busy || !Number(cu[p.listingId])} onClick={() => doTrade({ action: 'crowdJoin', listingId: p.listingId, units: Number(cu[p.listingId]) }, () => setCu({ ...cu, [p.listingId]: '' }))}>پیوستن</button>}
                  {p.my && <button style={{ ...btnGhost, padding: '7px 14px', fontSize: 12.5 }} disabled={busy || !Number(cu[p.listingId])} onClick={() => doTrade({ action: 'crowdExit', listingId: p.listingId, units: Number(cu[p.listingId]) }, () => setCu({ ...cu, [p.listingId]: '' }))}>خروج</button>}
                </div>
              </div>
            ))}
            {(mkt.candidates || []).length > 0 && <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>فرصت‌های تازه برای مشارکت (آگهی‌های واقعیِ بزرگ):</div>
              {(mkt.candidates || []).map((c: any) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <b>{c.title.slice(0, 50)}</b><span style={{ color: 'var(--faint)', fontSize: 11 }}>{c.hood} · {faB(c.price)} ت · {fa(c.totalUnits)} واحد</span>
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--gold)' }}>🔗</a>
                  <span style={{ flex: 1 }} />
                  <input value={cu[c.id] ? Number(cu[c.id]).toLocaleString('fa-IR') : ''} onChange={ev => setCu({ ...cu, [c.id]: digitsOf(ev.target.value) })} placeholder="واحد" inputMode="numeric" dir="ltr" style={{ width: 80, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }} />
                  <button style={{ ...btn, padding: '6px 12px', fontSize: 12 }} disabled={busy || !Number(cu[c.id])} onClick={() => doTrade({ action: 'crowdJoin', listingId: c.id, units: Number(cu[c.id]) }, () => setCu({ ...cu, [c.id]: '' }))}>شریک شو</button>
                </div>
              ))}
            </div>}
            {!(mkt.pools || []).length && !(mkt.candidates || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>فعلاً ملکِ واقعیِ بزرگی برای مشارکت در بازار نیست — به‌محضِ ورود، همین‌جا ظاهر می‌شود.</div>}
          </div>}
        </div>
      )}
    </details>}

    </>}
      </div>
    </details>
    </>}

    {gtab === 'portfolio' && <>
    {/* گزارشِ مالیِ شرکت (جلد ۷۴ Economy Engine — Financial Reports): همه از شمارنده‌های واقعی */}
    <details style={card}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>📒 گزارشِ مالیِ شرکت</summary>
      {(() => {
        const buildPaid = (e.assets || []).reduce((s: number, a: any) => s + (a.construction?.paid || 0), 0)
        const presale = (e.assets || []).reduce((s: number, a: any) => s + (a.construction?.presaleRevenue || 0), 0)
        const rentIncome = (e.assets || []).reduce((s: number, a: any) => s + (a.income || 0), 0)
        const rows: Array<[string, number, string]> = [
          ['سودِ تحقق‌یافته (فروش‌ها/واحدها/صندوق)', e.realized || 0, (e.realized || 0) >= 0 ? '#7c6' : '#e88'],
          ['درآمدِ اجاره/کسب‌وکارِ دارایی‌های فعلی', rentIncome, '#7c6'],
          ['پیش‌فروشِ دریافت‌شده (تعهدِ تحویل)', presale, '#69c'],
          ['هزینهٔ ساختِ پرداخت‌شده (پروژه‌های فعال)', -buildPaid, '#e7a14a'],
          ['حقوقِ پرداختیِ تیم', -(e.wagesPaid || 0), '#e7a14a'],
          ['مالیات و عوارض (→ خزانه)', -(e.taxPaid || 0), '#e7a14a'],
          ['بدهیِ بانکی (مانده)', -(e.loan?.balance || 0), '#e88'],
        ]
        return (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.filter(([, v]) => v !== 0).map(([label, v, color]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ flex: 1, color: 'var(--muted)' }}>{label}</span>
                <b style={{ color }}>{v < 0 ? '−' : '+'}{faB(Math.abs(v))} تومان</b>
              </div>
            ))}
            {rows.every(([, v]) => v === 0) && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز جریانِ مالی‌ای ثبت نشده — با اولین معامله پر می‌شود.</div>}
            <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>هیچ عددی تخمینی نیست — همه از تراکنش‌های واقعیِ همین حساب (قانونِ بقای پول).</div>
          </div>
        )
      })()}
    </details>

    </>}


    {gtab === 'ranks' && <>
    {tabHead('🏆', 'رتبه‌ها', 'رقابت و اتحاد با امپراتورهای واقعی')}
    {/* ⚡ فاز ۱۶۸ — سادگیِ اول-نگاه: یک جمله + حداکثر ۳ کارتِ بزرگ؛ بقیه داخلِ «همهٔ امکانات» */}
    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 2 }}>اینجا جای رقابت است: جایگاهِ خودت را ببین و از قهرمانانِ واقعیِ شهر جلو بزن.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      <button className="empChunky" onClick={() => setAllFx(true)}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#ffd76a')}>🏆</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>جایگاهِ من</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
            {(() => { const me = (boards?.boards?.score || []).find((r: any) => r.me); return me ? `رتبهٔ ${fa(me.rank)} · امتیازِ ${fa(st.empireScore || 0)}` : `امتیازِ امپراتوری: ${fa(st.empireScore || 0)}` })()}
          </span>
        </span>
      </button>
      <button className="empChunky" onClick={() => setAllFx(true)}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#c8ccd8')}>🥇</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>قهرمانانِ شهر</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(() => { const top = (boards?.boards?.score || []).filter((r: any) => r.rank <= 3); return top.length ? top.map((r: any) => r.name).join(' · ') : 'سه امپراتوریِ برتر را ببین' })()}
          </span>
        </span>
      </button>
      <button className="empChunky" onClick={() => { setRankV('clan'); setAllFx(true) }}
        style={{ ...card, cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={iconSq('#7d6ef0')}>🏰</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>اتحادها</b>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>با هم‌محله‌ای‌های واقعی هم‌پیمان شو</span>
        </span>
      </button>
    </div>
    <details open={allFx} onToggle={(ev: any) => setAllFx(!!ev.currentTarget.open)} style={{ ...card, padding: '12px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>🧰 همهٔ امکاناتِ تالارِ افتخار</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
    {subNav([
      ['compete', '🏆', 'رقابت و جدول‌ها'],
      ['hall', '🏛', 'تالارِ افتخارات'],
      ['clan', '🏰', 'اتحاد'],
    ], rankV, setRankV)}

    {rankV === 'compete' && <>

    {/* 🌱 فصلِ دنیا (فاز ۶۶ — Season Engine v1): «هیچ متایی دائمی نیست» — هر فصل تم و قهرمانِ خودش */}
    {szn?.enabled && <div style={{ ...card, borderColor: szn.ended ? 'var(--line2)' : 'var(--gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>{szn.icon} {szn.name}</b>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 10px', borderRadius: 10, border: '1px solid var(--goldDim)', color: szn.ended ? 'var(--muted)' : 'var(--gold)' }}>{szn.ended ? 'فصل تمام شد' : `⏳ ${fa(szn.daysLeft)} روز مانده`}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>معیارِ فصل: {szn.metricFa}</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.9 }}>{szn.story}</div>
      {szn.mine && <div style={{ marginTop: 8, fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ padding: '3px 12px', borderRadius: 10, background: 'rgba(212,175,55,.1)', border: '1px solid var(--goldDim)', color: 'var(--gold)', fontWeight: 800 }}>رتبهٔ تو: {fa(szn.mine.rank)}</span>
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>{szn.metricFa}: <b style={{ color: szn.mine.value >= 0 ? 'var(--text)' : '#e88' }}>{szn.unit === 'toman' ? faB(szn.mine.value) : fa(szn.mine.value)}</b></span>
        {szn.ended && szn.myReward > 0 && !szn.claimed && <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} disabled={busy} onClick={async () => { const d = await api({ action: 'seasonClaim' }); if (d?.ok) { setSt(d); setSzn({ ...szn, claimed: true }); celebrate(); alert(`🏁 جایزهٔ فصل: ${fa(d.coins)} ملک‌کوین`) } }}>🏁 دریافتِ جایزهٔ فصل ({fa(szn.myReward)} کوین)</button>}
        {szn.ended && szn.claimed && <span style={{ fontSize: 11, color: '#7c6' }}>✓ جایزهٔ فصل را گرفتی</span>}
      </div>}
      {(szn.table || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10 }}>
        {szn.table.map((r: any) => (
          <div key={r.no} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '4px 10px', borderRadius: 8, background: r.rank <= 3 ? 'rgba(212,175,55,.06)' : 'transparent' }}>
            <b style={{ minWidth: 22, color: r.rank <= 3 ? 'var(--gold)' : 'var(--muted)' }}>{['🥇', '🥈', '🥉'][r.rank - 1] || fa(r.rank)}</b>
            <span style={{ flex: 1 }}>{r.name} <span style={{ color: 'var(--faint)', fontSize: 9.5 }}>#{fa(r.no)}</span></span>
            <b>{szn.unit === 'toman' ? faB(r.value) : fa(r.value)}</b>
          </div>
        ))}
      </div>}
      {!(szn.table || []).length && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>هنوز کسی واردِ این فصل نشده — تو اولین باش؛ پیشرفتت از همین لحظهٔ ورود شمرده می‌شود.</div>}
      {/* 👔 گذرنامهٔ فصل (فاز ۱۱۰ — CEO Pass): فقط آیتم‌های ظاهریِ انحصاریِ همین فصل — No P2W؛ قیمت = پلنِ ادمین */}
      {szn.pass?.enabled && <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, border: '1px dashed var(--goldDim)', background: 'rgba(212,175,55,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 12.5 }}>👔 گذرنامهٔ {szn.name}</b>
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>آیتم‌های ظاهریِ انحصاریِ همین فصل — فقط دیده‌شدن، صفر قدرت</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 14 }}>{szn.pass.frameIcon} {szn.pass.flairIcon}</span>
        </div>
        {!szn.pass.owned && <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>«{szn.pass.frameLabel}» و «{szn.pass.flairLabel}» مخصوصِ دارندگانِ گذرنامه است — بعدِ این فصل هرگز برنمی‌گردند.</span>
          <a href={szn.pass.upgrade || '/pricing'} style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textDecoration: 'none', border: '1px solid var(--goldDim)', borderRadius: 10, padding: '4px 12px' }}>مشاهدهٔ پلن‌ها ←</a>
        </div>}
        {szn.pass.owned && !szn.pass.claimed && !szn.ended && <button style={{ ...btn, padding: '6px 16px', fontSize: 12, marginTop: 8 }} disabled={busy} onClick={async () => {
          const d = await api({ action: 'passClaim' })
          if (d?.ok) { setSt(d); setSzn({ ...szn, pass: { ...szn.pass, claimed: true } }); celebrate() }
        }}>👔 دریافتِ آیتم‌های انحصاریِ فصل</button>}
        {szn.pass.owned && szn.pass.claimed && <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#7c6' }}>✓ آیتم‌های این فصل در مجموعه‌ات است</span>
          <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'cosmeticSet', kind: 'frame', id: szn.pass.frameId }); if (d) setSt(d) }}>{szn.pass.frameIcon} فعال‌کردنِ قاب</button>
          <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => { const d = await api({ action: 'cosmeticSet', kind: 'flair', id: szn.pass.flairId }); if (d) setSt(d) }}>{szn.pass.flairIcon} فعال‌کردنِ نشان</button>
        </div>}
        {szn.pass.owned && !szn.pass.claimed && szn.ended && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>این فصل بسته شد — آیتم‌های فصلِ بعد را از همان روزِ اول بگیر.</div>}
      </div>}
      <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 8 }}>جایزهٔ رتبه‌های ۱ تا ۳: {(szn.rewards || []).map((x: number) => fa(x)).join(' / ')} ملک‌کوین · پیشرفتِ همه از دلتای «واقعیِ» همین فصل است، نه ثروتِ قبلی — شانسِ تازه‌واردها برابر است.</div>
    </div>}

    </>}

    {rankV === 'hall' && <>
    {/* 🏛 تالارِ افتخارات (فاز ۵۰ — سند ۳۰ Part 20 «The Hunt»): هر چیزِ این اتاق را خودت به دست آورده‌ای —
        رکوردهای واقعی، مجموعه‌های قابلِ‌تکمیل با عنوان‌گشایی، و گالریِ نشان‌ها (روان‌شناسیِ کلکسیون). */}
    {hall?.ok && <div style={{ ...card, borderColor: 'var(--gold)', background: 'linear-gradient(165deg, rgba(212,175,55,.1), rgba(212,175,55,.02) 60%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🏛 تالارِ افتخارات</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>هر چیزِ این اتاق را خودت به دست آورده‌ای — هیچ‌کدام خریدنی نیست</span>
      </div>
      {(hall.records || []).length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginTop: 10 }}>
        {hall.records.map((r: any, i: number) => (
          <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--goldDim)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{r.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginTop: 2 }}>{r.unit === 'toman' ? faB(r.value) : fa(r.value)}{r.unit === 'toman' ? ' ت' : ''}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{r.label}</div>
            {r.detail && <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>{r.detail}</div>}
          </div>
        ))}
      </div>}
      {!(hall.records || []).length && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>هنوز رکوردی ثبت نشده — اولین خرید، اولین رکوردت می‌شود.</div>}
      <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>🗃 مجموعه‌ها <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>— تکمیلِ هر مجموعه یک «عنوان» بازمی‌کند که می‌توانی روی نامت بگذاری</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(hall.collections || []).map((c: any) => (
          <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, padding: '6px 8px', borderRadius: 10, background: c.earned ? 'rgba(212,175,55,.08)' : 'var(--bg2)', border: c.earned ? '1px solid var(--goldDim)' : '1px solid transparent' }}>
            <span style={{ fontSize: 16 }}>{c.icon}</span>
            <span style={{ flex: 1, minWidth: 180 }}>{c.fa}</span>
            {c.earned
              ? <span style={{ color: 'var(--gold)', fontWeight: 800 }}>🏆 کامل شد — عنوانِ «{c.titleFa}» باز است</span>
              : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 90, height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
                    <span style={{ display: 'block', width: `${Math.min(100, Math.round(c.have / c.goal * 100))}%`, height: 6, background: 'linear-gradient(90deg, var(--goldDim), var(--gold))' }} />
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>{c.goal >= 1e6 ? `${faB(c.have)} از ${faB(c.goal)}` : `${fa(c.have)} از ${fa(c.goal)}`}</span>
                </span>}
          </div>
        ))}
      </div>
      {(hall.badges || []).length > 0 && <>
        <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>🎖 نشان‌ها ({fa(hall.badges.length)})</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {hall.badges.map((bg: any) => (
            <span key={bg.key} title={bg.key} style={{ fontSize: 10.5, border: '1px solid var(--goldDim)', color: hall.title === bg.key ? '#1a1503' : 'var(--gold)', background: hall.title === bg.key ? 'var(--gold)' : 'transparent', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontWeight: hall.title === bg.key ? 800 : 400 }}
              onClick={async () => { const d = await api({ action: 'setTitle', title: hall.title === bg.key ? '' : bg.key }); if (d) { setSt(d); setHall((h: any) => h ? { ...h, title: h.title === bg.key ? '' : bg.key } : h) } }}>
              {bg.fa}{hall.title === bg.key ? ' ✓ عنوانِ فعال' : ''}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 6 }}>روی هر نشان بزن تا عنوانِ فعالِ کنارِ نامت شود — در لیدربورد و پروفایلِ عمومی دیده می‌شود.</div>
      </>}

      {/* فاز ۶۲ — Part 1 نردبانِ بی‌پایان: لایهٔ نقشِ فعلی + شرطِ واقعیِ لایهٔ بعد */}
      {hall.layer && <div style={{ marginTop: 14, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }}>{hall.layer.icon}</span>
        <span style={{ flex: 1, minWidth: 170 }}>
          <b style={{ fontSize: 13 }}>لایهٔ نقشِ تو: {hall.layer.fa}</b>
          {hall.layer.next
            ? <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>لایهٔ بعد: {hall.layer.next.icon} {hall.layer.next.fa} — ارزشِ خالصِ {faB(hall.layer.next.needToman)} ت{hall.layer.next.extraFa ? ` + ${hall.layer.next.extraFa}${hall.layer.next.extraOk ? ' ✓' : ''}` : ''}</span>
            : <span style={{ display: 'block', fontSize: 10.5, color: 'var(--gold)', marginTop: 2 }}>به بالاترین لایهٔ شناخته‌شده رسیده‌ای — «هر قله فقط تپهٔ قلهٔ بعدی است»</span>}
        </span>
      </div>}

      {/* Part 2 — شاخصِ میراث: «دو نفر با ثروتِ برابر، میراثِ کاملاً متفاوت» */}
      {hall.legacy && <>
        <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>🏛 شاخصِ میراث: <span style={{ color: 'var(--gold)' }}>{fa(hall.legacy.score)}</span> <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>— آنچه برای شهر ساخته‌ای، نه فقط آنچه داری</span></div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {hall.legacy.parts.filter((pp: any) => pp.pts > 0).map((pp: any, i: number) => (
            <span key={i} style={{ fontSize: 10.5, border: '1px solid var(--line2)', borderRadius: 999, padding: '3px 10px', color: 'var(--muted)' }}>{pp.icon} {pp.fa}: <b style={{ color: 'var(--text)' }}>{fa(pp.pts)}</b></span>
          ))}
          {hall.legacy.parts.every((pp: any) => pp.pts <= 0) && <span style={{ fontSize: 11, color: 'var(--muted)' }}>هنوز میراثی ثبت نشده — اولین پروژهٔ تحویلی، اولین امتیازِ میراث است.</span>}
        </div>
      </>}

      {/* Part 4 — شگفتی‌های دنیا: رکوردهای سراسری با پلاکِ دارنده؛ فقط با عددِ اکیداً بزرگ‌تر گرفته می‌شود */}
      {(hall.wonders || []).length > 0 && <>
        <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>🌍 شگفتی‌های دنیا <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>— پلاکِ هر رکورد به نامِ دارنده می‌ماند تا کسی بزرگ‌ترش را بسازد</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8 }}>
          {hall.wonders.map((w: any) => (
            <div key={w.key} style={{ background: w.holder && w.holder.no === hall.myNo ? 'rgba(212,175,55,.1)' : 'var(--bg2)', border: `1px solid ${w.holder && w.holder.no === hall.myNo ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800 }}>{w.icon} {w.fa}</div>
              {w.holder ? <>
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>🏷 {w.holder.name}{w.holder.no === hall.myNo ? ' — تو!' : ''}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{w.unit === 'toman' ? faB(w.holder.value) + ' ت' : fa(w.holder.value)} · از روزِ {fa(w.holder.sinceDay)}</div>
                {(w.formers || []).length > 0 && <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 3 }}>دارندگانِ پیشین: {w.formers.map((f: any) => f.name).join('، ')}</div>}
              </> : <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>هنوز کسی ثبتش نکرده — حداقلِ ثبت: {w.unit === 'toman' ? faB(w.min) + ' ت' : fa(w.min)}</div>}
            </div>
          ))}
        </div>
      </>}

      {/* 📖 کتابِ زندگی (فاز ۷۱ — سند ۳۳ The Biography): روایتِ قاعده‌مند از دادهٔ واقعی — «بازی خاطره را ثبت می‌کند» */}
      {(hall.biography || []).length > 0 && <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>📖 کتابِ زندگیِ تو ({fa(hall.biography.length)} فصل)</summary>
        {/* فاز ۱۰۴: خروجیِ چاپی/PDF — پنجرهٔ چاپِ مرورگر، بدونِ هیچ وابستگی */}
        <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5, marginTop: 6 }} onClick={() => {
          const rows = (hall.biography as any[]).map(ch => `<div class="ch"><div class="t">${ch.icon} ${ch.title}</div><div class="x">${ch.text}</div></div>`).join('')
          const w = window.open('', '_blank')
          if (!w) return
          w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>کتابِ زندگیِ ${st.hud?.name || ''} — ملک‌جت</title><style>body{font-family:'Vazirmatn',Tahoma,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1a1712}h1{font-size:22px;border-bottom:2px solid #b8960e;padding-bottom:10px}.ch{margin:18px 0;page-break-inside:avoid}.t{font-weight:800;font-size:15px;margin-bottom:4px}.x{font-size:13px;line-height:2;color:#444}.f{margin-top:30px;font-size:11px;color:#999;text-align:center}</style></head><body><h1>📖 کتابِ زندگیِ ${st.hud?.name || 'امپراتور'}</h1>${rows}<div class="f">ملک‌جت — melkjet.com · همهٔ فصل‌ها از رویدادهای واقعیِ مسیرِ توست</div><script>window.print()</script></body></html>`)
          w.document.close()
        }}>🖨 نسخهٔ چاپی / PDF</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {hall.biography.map((b2: any, i: number) => (
            <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{b2.icon} {b2.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 2 }}>{b2.text}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 6 }}>هر فصل از رفتار و رخدادهای «واقعیِ» خودت نوشته شده — با هر نقطهٔ عطفِ تازه، فصلِ تازه‌ای اضافه می‌شود.</div>
      </details>}

      {/* Part 2 — مستندِ مسیر (Player History): «انسان‌ها عاشقِ داستانِ خودشان‌اند» — اولین‌های واقعیِ تو */}
      {(hall.story || []).length > 0 && <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>🎞 مستندِ مسیرِ تو ({fa(hall.story.length)} «اولین») — داستانِ واقعیِ خودت را مرور کن</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
          {hall.story.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline' }}>
              <span>{t.icon}</span>
              <span style={{ color: 'var(--text)' }}>{t.title}</span>
              {t.detail && <span style={{ color: 'var(--faint)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.detail}</span>}
              <span style={{ marginInlineStart: 'auto', color: 'var(--faint)', fontSize: 9.5, direction: 'ltr' }}>{new Date(t.at).toLocaleDateString('fa-IR')}</span>
            </div>
          ))}
        </div>
      </details>}
    </div>}
    </>}

    {rankV === 'compete' && <>
    {/* ۵ جدولِ رتبه (فصل ۵) + لیگِ محله (§7.2) */}
    <details style={card} onToggle={(ev: any) => { if (ev.currentTarget.open && !boards) doBoards() }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>🏅 جدول‌های رتبه و لیگِ محله</summary>
      {!boards ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حال بارگذاری...</div> : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['score', '👑 امتیازِ امپراتوری'], ['weekly', '📅 رشدِ این هفته'], ['invest', '💎 سرمایه‌گذارِ برتر'], ['growth', '🚀 رشدِ سریع'], ['builder', '🏗 سازنده'], ['explorer', '🧭 کاوشگر']].map(([k, l]) => (
              <button key={k} onClick={() => setBoardTab(k)} style={chip(boardTab === k)}>{l}</button>
            ))}
          </div>
          {/* 🏆 فاز ۱۶۰ — سکوی قهرمانان: سه رتبهٔ اولِ همین جدول (۲-۱-۳)؛ همان داده و همان کلیکِ «مشاهدهٔ امپراتوری» */}
          {(() => {
            const rows = boards.boards[boardTab] || []
            const by = (rk: number) => rows.find((r: any) => r.rank === rk)
            if (!by(1) || !by(2) || !by(3)) return null
            const val = (r: any) => boardTab === 'invest' || boardTab === 'weekly' ? faB(r.value) : boardTab === 'growth' ? `${Number(r.value).toLocaleString('fa-IR')}٪` : fa(r.value)
            const podium: Array<[number, string, string, number]> = [[2, '🥈', '#c8ccd8', 58], [1, '🥇', '#ffd76a', 84], [3, '🥉', '#e0955f', 46]]
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, margin: '6px 0 16px' }}>
                {podium.map(([rk, medal, clr, h]) => { const r: any = by(rk); return (
                  <div key={rk} title="مشاهدهٔ امپراتوری" onClick={async () => { const d = await api({ action: 'viewEmpire', no: r.no }); if (d) setPeek(d.profile) }}
                    style={{ width: 100, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: rk === 1 ? 50 : 42, height: rk === 1 ? 50 : 42, margin: '0 auto 6px', borderRadius: '50%', background: `linear-gradient(145deg, ${clr}, ${clr}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: rk === 1 ? 24 : 20, border: '2px solid rgba(255,255,255,.3)', boxShadow: `0 6px 18px ${clr}44` }}>{r.persona || '🏛'}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}{r.me ? ' (تو)' : ''}</div>
                    <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, marginTop: 1 }}>{val(r)}</div>
                    <div style={{ height: h, marginTop: 6, borderRadius: '12px 12px 0 0', background: `linear-gradient(180deg, ${clr}cc, ${clr}22)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 5, fontSize: 17, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)' }}>{medal}</div>
                  </div>
                )})}
              </div>
            )
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(boards.boards[boardTab] || []).map((r: any) => (
              <div key={r.no} title="مشاهدهٔ امپراتوری" onClick={async () => { const d = await api({ action: 'viewEmpire', no: r.no }); if (d) setPeek(d.profile) }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', background: r.me ? 'rgba(212,175,55,.10)' : 'var(--bg2)', border: r.me ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
                <b style={{ minWidth: 24, color: r.rank <= 3 ? 'var(--gold)' : 'var(--muted)' }}>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : fa(r.rank)}</b>
                <span style={{ position: 'relative' }}>{r.persona || '🏛'}{r.frame && <span style={{ position: 'absolute', top: -6, left: -7, fontSize: 9 }}>{r.frame}</span>}</span>
                <span style={{ flex: 1 }}>{r.name}{r.flair && <span title="نشانِ ظاهری"> {r.flair}</span>}{r.title && <span style={{ fontSize: 9.5, color: 'var(--gold)', marginRight: 5 }}>👑 {r.title}</span>}{r.me && <span style={{ fontSize: 10, color: 'var(--gold)' }}> (تو)</span>}</span>
                <b style={{ color: 'var(--gold)', fontSize: 12 }}>{boardTab === 'invest' || boardTab === 'weekly' ? faB(r.value) : boardTab === 'growth' ? `${Number(r.value).toLocaleString('fa-IR')}٪` : fa(r.value)}</b>
              </div>
            ))}
            {!(boards.boards[boardTab] || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز رقابتی شکل نگرفته — تو اولین باش!</div>}
          </div>
          {/* پروفایلِ عمومیِ امپراتوری (سند ۱۷ — «بازدید از شهرِ دیگران»): بازیکن و اعدادِ واقعی */}
          {peek && <div style={{ ...card, background: 'var(--bg2)', marginTop: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 24, position: 'relative' }}>{peek.persona || '🏛'}{peek.frame && <span style={{ position: 'absolute', top: -6, left: -8, fontSize: 11 }}>{peek.frame}</span>}</span>
              <div style={{ flex: 1, minWidth: 150 }}>
                <b style={{ fontSize: 14 }}>{peek.name} {peek.flair && <span title="نشانِ ظاهری">{peek.flair} </span>}<span style={{ fontSize: 10.5, color: 'var(--muted)' }}>#{fa(peek.no)}</span></b>
                {peek.title && <span style={{ fontSize: 10, marginRight: 6, padding: '2px 7px', borderRadius: 10, border: '1px solid var(--gold)', color: 'var(--gold)' }}>👑 {peek.title}</span>}
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>سطح {fa(peek.level?.level || 1)} · {peek.level?.titleFa} · عضو از {new Date(peek.memberSince).toLocaleDateString('fa-IR')}</div>
              </div>
              {!peek.mine && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 12 }} disabled={busy || peek.myKudos}
                onClick={async () => { const d = await api({ action: 'kudos', no: peek.no }); if (d) { setPeek({ ...peek, kudos: d.kudos, myKudos: true }); celebrate() } }}>
                👏 {peek.myKudos ? 'تحسین کردی' : 'تحسین'} ({fa(peek.kudos || 0)})</button>}
              <button style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} onClick={() => setPeek(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
              <span>🏆 امتیاز {fa(peek.score || 0)}</span>
              <span>💰 ارزشِ خالص {faB(peek.netWorth || 0)}</span>
              <span>🏠 {fa(peek.assets || 0)} دارایی</span>
              {peek.company && <span>🏗 «{peek.company.name}» {'⭐'.repeat(peek.company.stars || 1)}{peek.company.delivered ? ` · ${fa(peek.company.delivered)} تحویل` : ''}</span>}
            </div>
            {(peek.hoods || []).length > 0 && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>محله‌ها: {peek.hoods.join('، ')}</div>}
            {(peek.skyline || []).length > 0 && (() => {
              const mx = Math.max(...peek.skyline.map((x: any) => x.v))
              return <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 8 }}>
                {peek.skyline.map((x: any, i: number) => <div key={i} title={faB(x.v)} style={{ width: 10, height: Math.max(6, Math.round((x.v / Math.max(1, mx)) * 44)), borderRadius: '2px 2px 0 0', background: x.kind === 'land' ? '#8a7' : 'var(--gold)', opacity: 0.85 }} />)}
              </div>
            })()}
            {(peek.badges || []).length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {peek.badges.slice(0, 10).map((bd: string) => <span key={bd} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--muted)' }}>{bd}</span>)}
            </div>}
            {/* فاز ۶۴ (ممیزی): لایهٔ نقش + میراث + رکوردها + پرتفویِ کاملِ قابلِ‌دیدن — «کاربرها همدیگر را ببینند» */}
            {(peek.layer || peek.legacy > 0) && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }}>
              {peek.layer && <span style={{ padding: '3px 10px', borderRadius: 10, border: '1px solid var(--goldDim)', color: 'var(--gold)' }}>{peek.layer.icon} لایهٔ نقش: {peek.layer.fa}</span>}
              {peek.legacy > 0 && <span style={{ padding: '3px 10px', borderRadius: 10, border: '1px solid var(--line2)', color: 'var(--muted)' }}>🏛 میراث: {fa(peek.legacy)}</span>}
            </div>}
            {(peek.records || []).length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {peek.records.map((r: any, i: number) => <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}>{r.icon} {r.label}: <b style={{ color: 'var(--text)' }}>{r.unit === 'toman' ? faB(r.value) : fa(r.value)}</b></span>)}
            </div>}
            {(peek.portfolio || []).length > 0 && <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--gold)' }}>💼 پرتفویِ {peek.name} ({fa(peek.portfolio.length)} دارایی)</summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 6, marginTop: 8 }}>
                {peek.portfolio.map((pa: any, i: number) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', fontSize: 10.5 }}>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{pa.kind === 'land' ? '🏞' : pa.kind === 'commercial' ? '🏪' : pa.kind === 'villa' ? '🏡' : '🏠'} {pa.title}</div>
                    <div style={{ color: 'var(--muted)', marginTop: 2 }}>{pa.hood}{pa.units > 1 ? ` · ${fa(pa.units)} واحد` : ''}{pa.business ? ` · ${pa.business}` : ''}</div>
                    <div style={{ color: 'var(--gold)', marginTop: 2 }}>{faB(pa.value)} تومان{pa.forSale > 0 ? ' · 🏪 در بازار' : ''}{pa.inAuction ? ' · 🔨 در مزایده' : ''}</div>
                  </div>
                ))}
              </div>
            </details>}
          </div>}
          {boards.hoodLeague?.rows?.length > 0 && <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🏘 لیگِ محلهٔ {boards.hoodLeague.hood}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {boards.hoodLeague.rows.slice(0, 5).map((r: any) => (
                <div key={r.no} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 10px', color: r.me ? 'var(--gold)' : 'var(--text)' }}>
                  <b style={{ minWidth: 20 }}>{fa(r.rank)}</b><span>{r.persona}</span><span style={{ flex: 1 }}>{r.name}</span><b>{fa(r.value)}</b>
                </div>
              ))}
            </div>
          </div>}
          {/* گذرنامهٔ امپراتوری (GDD جلد۶): نفوذِ من در محله‌ها + اشتراک */}
          {boards.passport?.length > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🛂 گذرنامهٔ امپراتوریِ تو</div>
            {boards.passport.map((p: any) => (
              <div key={p.hood} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '5px 10px' }}>
                <b style={{ minWidth: 110 }}>{p.hood}</b>
                <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3 }}><div style={{ width: `${Math.min(100, p.influence)}%`, height: 5, background: 'var(--gold)', borderRadius: 3 }} /></div>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>نفوذ {fa(p.influence)}٪</span>
              </div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8, fontSize: 12, padding: '6px 14px' }} onClick={() => doShare(`🛂 گذرنامهٔ امپراتوریِ من در ملک‌جت:\n${boards.passport.slice(0, 3).map((p: any) => `${p.hood}: نفوذ ${fa(p.influence)}٪`).join('\n')}\nتو هم قلمروِ خودت را بساز:`)}>📤 اشتراکِ گذرنامه</button>
          </div>}
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>رتبه‌ها از {fa(boards.total)} امپراتوریِ فعال — فقط نام و نشان نمایش داده می‌شود.</div>
        </div>
      )}
    </details>

    </>}

    {rankV === 'clan' && <>
    {/* 🏰 اتحاد (فاز ۳۷ — درخواستِ مستقیم): با هم باشید، با هم پیام بگذارید — از سطحِ knob به بعد */}
    {st.unlocks?.clan?.enabled !== false && <div style={{ ...card, borderColor: '#9a7ac9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🏰 اتحاد</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>هم‌پیمان شو — اعضای واقعی، پیام‌های واقعی</span>
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }} disabled={busy} onClick={loadClan}>↻</button>
      </div>
      {!st.unlocks?.clan?.ok && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>🔒 اتحاد از سطحِ {fa(st.unlocks?.clan?.need || 0)} باز می‌شود — الان سطحِ {fa(st.unlocks?.level || 1)} هستی.</div>}
      {st.unlocks?.clan?.ok && <>
        {!clanD && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حالِ بارگذاری…</div>}
        {clanD?.mine ? <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 14, color: '#c9a8f0' }}>🏰 {clanD.mine.name}</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fa(clanD.mine.members.length)} عضو</span>
            <span style={{ fontSize: 11, color: 'var(--gold)' }}>🏦 خزانه: {faB(clanD.mine.treasury || 0)}</span>
            <span style={{ flex: 1 }} />
            <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11, color: '#e88', borderColor: '#644' }} disabled={busy}
              onClick={async () => { if (!confirm('از اتحاد خارج شوی؟')) return; const d = await api({ action: 'clanLeave' }); if (d) loadClan() }}>خروج</button>
          </div>
          {/* فاز ۱۰۲ (هلدینگ): خزانهٔ مشترک با دفترِ شفاف + کنسرسیومِ ملکِ واقعی */}
          <div style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 12 }}>🏦 خزانهٔ اتحاد</b>
              <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>واریزِ اعضا با دفترِ شفاف؛ برداشت فقط بنیان‌گذار</span>
              <span style={{ flex: 1 }} />
              <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                const v = prompt('چند تومان به خزانه واریز شود؟ (از سرمایهٔ نقدت)'); const amt = Number((v || '').replace(/[^\d]/g, ''))
                if (!amt) return
                const d = await api({ action: 'clanDeposit', amount: amt }); if (d) { setSt(d); loadClan() }
              }}>+ واریز</button>
              {clanD.mine.imOwner && <button style={{ ...btnGhost, padding: '3px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                const v = prompt('چند تومان از خزانه برداشت شود؟'); const amt = Number((v || '').replace(/[^\d]/g, ''))
                if (!amt) return
                const d = await api({ action: 'clanWithdraw', amount: amt }); if (d) { if (d.hud) setSt(d); loadClan() }
              }}>− برداشت</button>}
            </div>
            {(clanD.mine.ledger || []).slice(0, 4).map((l: any, i: number) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{l.amount > 0 ? '➕' : '➖'} {l.name}: {faB(Math.abs(l.amount))} تومان</div>
            ))}
          </div>
          {(clanD.mine.projects || []).length > 0 && <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>🏛 کنسرسیوم‌های اتحاد <span style={{ fontSize: 9.5, color: 'var(--faint)', fontWeight: 400 }}>— خریدِ جمعیِ آگهیِ واقعی؛ سهم‌ها و فروش شفاف</span></div>
            {clanD.mine.projects.map((pr: any) => (
              <div key={pr.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 11px', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
                  <b>{pr.title}</b>{pr.hood && <span style={{ color: 'var(--muted)' }}>· {pr.hood}</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: pr.status === 'owned' ? '#7c6' : pr.status === 'sold' ? 'var(--muted)' : 'var(--gold)' }}>{pr.status === 'open' ? 'در حالِ جمع‌آوری' : pr.status === 'owned' ? 'مالِ اتحاد شد' : `فروخته شد (${faB(pr.soldPrice)})`}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, margin: '6px 0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round(pr.funded / pr.price * 100))}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold2),var(--gold))' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 10.5, color: 'var(--muted)' }}>
                  <span>{faB(pr.funded)} از {faB(pr.price)}</span>
                  {pr.myShare > 0 && <span style={{ color: 'var(--gold)' }}>سهمِ من: {faB(pr.myShare)}</span>}
                  <span style={{ flex: 1 }} />
                  {pr.status === 'open' && <button style={{ ...btn, padding: '2px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                    const v = prompt(`چند تومان سهم می‌گذاری؟ (تا سقفِ ${(pr.price - pr.funded).toLocaleString('fa-IR')})`); const amt = Number((v || '').replace(/[^\d]/g, ''))
                    if (!amt) return
                    const d = await api({ action: 'clanProjectJoin', projectId: pr.id, amount: amt })
                    if (d) { if (d.note) alert(d.note); if (d.completed) celebrate(); loadClan(); load() }
                  }}>+ سهم</button>}
                  {pr.status === 'owned' && clanD.mine.imOwner && <button style={{ ...btnGhost, padding: '2px 10px', fontSize: 10.5 }} disabled={busy} onClick={async () => {
                    if (!confirm('به قیمتِ روزِ واقعیِ آگهی فروخته و نسبتی بینِ سهم‌داران تقسیم شود؟')) return
                    const d = await api({ action: 'clanProjectSell', projectId: pr.id })
                    if (d) { alert(`فروخته شد: ${(d.soldFor || 0).toLocaleString('fa-IR')} تومان — سهم‌ها به سرمایهٔ اعضا برگشت`); loadClan(); load() }
                  }}>💰 فروش</button>}
                </div>
              </div>
            ))}
          </div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {clanD.mine.members.map((m: any) => <span key={m.no} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, border: `1px solid ${m.me ? 'var(--gold)' : 'var(--line2)'}` }}>{m.leader && '👑 '}{m.name} <span style={{ color: 'var(--faint)' }}>#{fa(m.no)}</span></span>)}
          </div>
          <div style={{ ...card, background: 'var(--bg2)', marginTop: 10, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!(clanD.mine.msgs || []).length && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>هنوز پیامی نیست — تو شروع کن.</div>}
            {(clanD.mine.msgs || []).map((m: any, i: number) => (
              <div key={i} style={{ fontSize: 12, textAlign: m.me ? 'left' : 'right' }}>
                <span style={{ display: 'inline-block', padding: '5px 10px', borderRadius: 10, background: m.me ? 'rgba(212,175,55,.12)' : 'var(--surface)', border: '1px solid var(--line)' }}>
                  <b style={{ fontSize: 10.5, color: 'var(--gold)' }}>{m.name}</b> {m.text}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={clanMsg} onChange={ev => setClanMsg(ev.target.value)} placeholder="پیام به هم‌پیمان‌ها…" maxLength={240}
              onKeyDown={async ev => { if (ev.key === 'Enter' && clanMsg.trim()) { const d = await api({ action: 'clanPost', text: clanMsg }); if (d) { setClanMsg(''); setClanD({ ...clanD, mine: d.clan }) } } }}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }} />
            <button style={{ ...btn, padding: '6px 14px', fontSize: 12 }} disabled={busy || !clanMsg.trim()}
              onClick={async () => { const d = await api({ action: 'clanPost', text: clanMsg }); if (d) { setClanMsg(''); setClanD({ ...clanD, mine: d.clan }) } }}>ارسال</button>
          </div>
        </div> : clanD && <div style={{ marginTop: 10 }}>
          {(clanD.clans || []).length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {clanD.clans.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                <b style={{ flex: 1 }}>🏰 {c.name}</b>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fa(c.members)} / {fa(clanD.maxMembers)} عضو</span>
                <button style={{ ...btnGhost, padding: '4px 12px', fontSize: 11.5 }} disabled={busy}
                  onClick={async () => { const d = await api({ action: 'clanJoin', id: c.id }); if (d) { celebrate(); loadClan() } }}>پیوستن</button>
              </div>
            ))}
          </div>}
          {!(clanD.clans || []).length && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>هنوز هیچ اتحادی ساخته نشده — اولین اتحادِ شهر را تو بساز.</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={clanName} onChange={ev => setClanName(ev.target.value)} placeholder="نامِ اتحادِ جدید" maxLength={30}
              style={{ flex: 1, minWidth: 160, padding: 8, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }} />
            <button style={{ ...btn, padding: '6px 14px', fontSize: 12 }} disabled={busy || !clanName.trim()} onClick={async () => {
              if (!confirm(`اتحادِ «${clanName.trim()}» با هزینهٔ ثبتِ ${faB(clanD.createFee || 0)} تومان (→ خزانه) ساخته شود؟`)) return
              const d = await api({ action: 'clanCreate', name: clanName })
              if (d) { setClanName(''); celebrate(); loadClan() }
            }}>🏰 ساختِ اتحاد ({faB(clanD.createFee || 0)})</button>
          </div>
        </div>}
      </>}
    </div>}

    </>}

    {rankV === 'hall' && <>
    {/* تایم‌لاینِ زندگی + دفترچهٔ ملک‌جت */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📍 تایم‌لاینِ زندگیِ تو</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...(e.timeline || [])].reverse().slice(0, 12).map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
              <span>{t.icon}</span>
              <div><b>{t.title}</b>{t.detail && <span style={{ color: 'var(--muted)' }}> — {t.detail}</span>}<div style={{ color: 'var(--faint)', fontSize: 11 }}>{new Date(t.at).toLocaleDateString('fa-IR')}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📔 دفترچهٔ ملک‌جت</div>
        {!(e.journal || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز یادداشتی ندارد — با اولین تصمیم‌ها پر می‌شود.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...(e.journal || [])].reverse().slice(0, 8).map((j: any, i: number) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text)' }}>{j.text}<div style={{ color: 'var(--faint)', fontSize: 11 }}>{new Date(j.at).toLocaleDateString('fa-IR')}</div></div>
          ))}
        </div>
      </div>
    </div>

    {/* کلکسیون (جلد ۲۶) + نشان‌ها + مأموریت‌های مخفی + تغییرِ نام */}
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>🗃 کلکسیونِ دارایی‌ها</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(st.collection || []).map((c: any) => (
          <span key={c.kind} style={{ ...card, padding: '8px 14px', fontSize: 13, background: 'var(--bg2)', opacity: c.owned ? 1 : 0.45, borderColor: c.owned ? 'var(--gold)' : 'var(--line)' }}>
            {c.kind === 'apartment' ? '🏢 آپارتمان' : c.kind === 'villa' ? '🏡 ویلا' : c.kind === 'commercial' ? '🏬 تجاری' : '🏞 زمین'} {c.owned ? '✓' : ''}
          </span>
        ))}
      </div>
      {/* استادی‌های چندمحوره (جلد ۴۹ فصل ۵) — از شمارنده‌های واقعیِ رفتار */}
      {(st.mastery || []).some((m: any) => m.level > 0 || m.count > 0) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {(st.mastery || []).map((m: any) => (
          <span key={m.key} title={m.next != null ? `${fa(m.count)} از ${fa(m.next)} تا سطحِ بعد` : 'بالاترین سطح'} style={{ ...card, padding: '6px 12px', fontSize: 12, background: 'var(--bg2)', opacity: m.level > 0 ? 1 : 0.5, borderColor: m.level >= 3 ? 'var(--gold)' : 'var(--line)' }}>
            {m.icon} {m.label} {m.level > 0 && <b style={{ color: 'var(--gold)' }}>{'★'.repeat(Math.min(5, m.level))}</b>}
            <span style={{ color: 'var(--faint)', fontSize: 10.5 }}> ({fa(m.count)})</span>
          </span>
        ))}
      </div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>🏅 نشان‌ها:</span>
        {/* عنوانِ فعال (سند ۱۶): کلیک روی نشانِ کسب‌شده = انتخاب به‌عنوانِ Title — در سربرگ و لیدربوردها دیده می‌شود */}
        {(e.badges || []).map((bd: string) => (
          <button key={bd} disabled={busy} title={e.title === bd ? 'عنوانِ فعال — برای برداشتن دوباره بزن' : 'انتخاب به‌عنوانِ عنوانِ نمایشی'}
            onClick={async () => { const d = await api({ action: 'setTitle', title: e.title === bd ? '' : bd }); if (d) setSt(d) }}
            style={{ ...card, padding: '4px 10px', fontSize: 12, background: e.title === bd ? 'var(--goldDim)' : 'var(--bg2)', borderColor: e.title === bd ? 'var(--gold)' : 'var(--line)', color: e.title === bd ? 'var(--gold)' : 'var(--text)', cursor: 'pointer' }}>
            {e.title === bd ? '👑 ' : ''}{bd}
          </button>
        ))}
        {st.hiddenLeft > 0 && <details style={{ display: 'inline-block' }}>
          <summary style={{ fontSize: 11.5, color: 'var(--faint)', cursor: 'pointer', listStyle: 'none' }}>🎖 {fa(st.hiddenLeft)} مأموریتِ مخفی در انتظارِ کشف... <span style={{ color: 'var(--gold)' }}>(سرنخ‌ها 🤫)</span></summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(st.hiddenHints || []).map((h74: string, i: number) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic', background: 'var(--bg2)', border: '1px dashed var(--line2)', borderRadius: 10, padding: '7px 11px' }}>🕯 {h74}</div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--faint)' }}>هیچ دکمه‌ای ندارند — با خودِ بازی کشف می‌شوند؛ لحظهٔ کشف، نشانش با داستان در تایم‌لاینت ثبت می‌شود.</div>
          </div>
        </details>}
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={async () => { const n = prompt('نامِ جدیدِ امپراتوری:', e.name); if (n != null) { const d = await api({ action: 'rename', name: n }); if (d) load() } }}>تغییرِ نام</button>
      </div>
    </div>
    </>}
      </div>
    </details>
    </>}
    </BottomSheet>

    {/* 🎮 فاز ۱۶۵ — داکِ سه‌تاییِ بازی: شهر (خانه) · مأموریت‌ها · پرتفوی؛ دنیا/بازار/رتبه‌ها فقط از بناهای مدنیِ روی نقشه */}
    <div style={{ height: st.quests?.daily ? (st.quests.daily.claimed || !heroFull ? 128 : 216) : 74 }} />
    {/* 🎉 جشنِ دریافتِ جایزه در نمای شهر (فاز ۱۶۲) — یک‌باره، خالصِ CSS */}
    <CityCelebration seed={cityCeleb?.at || 0} coins={cityCeleb?.coins || 0} />
    {/* 🎯 فاز ۱۶۲ — «مأموریت، قهرمانِ شهر»: تا وقتی جایزهٔ کوئستِ روزانه گرفته نشده، کارتِ بزرگِ مأموریت
        وسطِ پایینِ صحنه است (همان دادهٔ st.quests.daily و همان doClaim/doChest — هیچ مکانیکِ تازه‌ای نیست)؛
        بعد از دریافت به نوارِ باریکِ ✅ + استریک جمع می‌شود. صندوقچه = چیپِ 🎁 کناری. */}
    {st.quests?.daily && (() => {
      const dq = st.quests.daily
      const chestOk = !!st.chest?.available && !chestReward
      const href = dq.metric === 'market' ? '/market' : '/search'
      const chestBtn = chestOk ? (
        <button title="صندوقچهٔ امروزت منتظر است — باز کن" className="empPulse empChunky" disabled={busy}
          onClick={async () => { const d = await doChest(); if (d?.reward) fireCityCeleb(d.reward.kind === 'coins' ? Number(d.reward.amount) || 0 : 0) }}
          style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,215,106,.6)', background: 'linear-gradient(135deg,#ffd76a,#d4af37)', fontSize: 19, cursor: 'pointer', flex: 'none', boxShadow: '0 6px 18px rgba(255,215,106,.4)', padding: 0 }}>🎁</button>
      ) : null
      {/* فاز ۱۶۹ (ج): پیش‌فرض نوارِ باریکِ یک‌خطی — شهرِ پشتش کلیک‌خور می‌ماند؛ لمس = بازشدنِ فرمِ کامل */}
      if (!dq.claimed && !heroFull) return (
        <div style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 49, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 560, width: '100%', background: 'linear-gradient(180deg, rgba(26,20,58,.94), rgba(12,10,34,.94))', border: '1px solid rgba(255,215,106,.4)', borderRadius: 999, padding: 6, boxShadow: '0 10px 30px -8px rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', pointerEvents: 'auto' }}>
            <button onClick={() => setHeroFull(true)} title="جزئیاتِ مأموریتِ امروز" aria-label="بازکردنِ جزئیاتِ مأموریتِ امروز"
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '2px 6px', textAlign: 'right' }}>
              <span aria-hidden style={{ fontSize: 15 }}>🎯</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: '#ffd76a' }}>مأموریتِ امروز:</b> {dq.title} — {fa(dq.progress)} از {fa(dq.target)}</span>
              <span aria-hidden style={{ color: 'var(--faint)', fontSize: 10 }}>▲</span>
            </button>
            {dq.done
              ? <button className="empPulse empChunky" disabled={busy} onClick={async () => { const d = await doClaim(dq.claimKey); if (d) fireCityCeleb(Number(dq.rewardCoins) || 0) }} style={{ ...btn, padding: '7px 16px', fontSize: 12.5, borderRadius: 999, flex: 'none' }}>🎁 بگیر</button>
              : <Link href={href} className="empChunky" style={{ ...btn, textDecoration: 'none', display: 'inline-block', padding: '7px 14px', fontSize: 12, borderRadius: 999, flex: 'none' }}>برو ←</Link>}
            {chestBtn}
          </div>
        </div>
      )
      if (!dq.claimed) return (
        <div style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 49, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 560, width: '100%', background: 'linear-gradient(180deg, rgba(26,20,58,.94), rgba(12,10,34,.94))', border: '2px solid rgba(255,215,106,.4)', borderRadius: 20, padding: '12px 14px', boxShadow: '0 4px 0 rgba(60,42,8,.7), 0 16px 44px -8px rgba(0,0,0,.7)', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
            <button onClick={() => setHeroFull(false)} aria-label="جمع‌کردنِ کارتِ مأموریت" title="جمع کن"
              style={{ position: 'absolute', top: 6, left: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>▼</button>
            <span style={{ ...iconSq('#ffd76a'), width: 52, height: 52, fontSize: 26 }}>🎯</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#ffd76a' }}>مأموریتِ امروز{(st.streak?.streak || 0) > 0 ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · 🔥 روزِ {fa(st.streak.streak)}</span> : null}</div>
              <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>{dq.title}</div>
              {qBar(dq.progress, dq.target, !!dq.done)}
              {/* ☀️ فاز ۱۶۷ — «مسیرِ امروز»: مأموریت = موتورِ پیشرفت؛ عددِ صادق از st.todayPath (منحنیِ واقعیِ سطح) */}
              {(st.todayPath?.pct || 0) > 0 && <div style={{ fontSize: 10.5, fontWeight: 800, color: '#ffd76a', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden>🚀</span> این مأموریت‌ها {fa(st.todayPath.pct)}٪ از راهِ سطحِ بعد را می‌دهند
              </div>}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={rewardChip}>🪙 {fa(dq.rewardCoins)}</span>
                <span style={rewardChip}>⚡ {fa(dq.rewardXp)}</span>
                <span style={{ flex: 1 }} />
                {dq.done
                  ? <button className="empPulse empChunky" disabled={busy} onClick={async () => { const d = await doClaim(dq.claimKey); if (d) fireCityCeleb(Number(dq.rewardCoins) || 0) }} style={{ ...btn, padding: '10px 22px', fontSize: 14, borderRadius: 999 }}>🎁 جایزه‌ات را بگیر</button>
                  : <Link href={href} className="empChunky" style={{ ...btn, textDecoration: 'none', display: 'inline-block', padding: '10px 22px', fontSize: 14, borderRadius: 999 }}>برو انجامش بده ←</Link>}
              </div>
            </div>
            {chestBtn}
          </div>
        </div>
      )
      return (
        <div style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 49, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 560, width: '100%', background: 'rgba(12,10,34,.82)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, padding: '8px 12px', boxShadow: '0 10px 30px -8px rgba(0,0,0,.65)', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#7ee0b8' }}>✅ مأموریتِ امروز انجام شد</span>
            {(st.streak?.streak || 0) > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>🔥 روزِ {fa(st.streak.streak)}</span>}
            <span style={{ flex: 1 }} />
            {chestReward && <span style={{ fontSize: 10.5, color: '#ffd76a' }}>صندوقچه باز شد: {chestReward.kind === 'coins' ? `🪙 ${fa(chestReward.amount)}` : chestReward.kind === 'xp' ? `⚡ ${fa(chestReward.amount)}` : `🤖 ${fa(chestReward.amount)}`}</span>}
            {chestBtn}
          </div>
        </div>
      )
    })()}
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', padding: '8px 10px calc(10px + env(safe-area-inset-bottom))', pointerEvents: 'none' }}>
      {/* 🎨 نوارِ تبِ شناورِ tycoon: شیشهٔ تیرهٔ بنفش + تبِ فعال با نشانِ دایره‌ایِ طلایی */}
      <div style={{ display: 'flex', gap: 4, margin: '0 10px', background: 'linear-gradient(180deg, rgba(30,23,68,.92), rgba(16,12,42,.92))', border: '2px solid rgba(0,0,0,.45)', borderRadius: 22, padding: '6px 8px', boxShadow: '0 3px 0 rgba(5,3,20,.9), 0 14px 44px -8px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.08)', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
        {([['city', '🏙', 'شهر'], ['missions', '🎯', 'مأموریت‌ها'], ['portfolio', '💼', 'پرتفوی']] as const).map(([k, ic, l]) => (
          <button key={k} onClick={() => { setGtab(k); try { window.scrollTo({ top: 0 }) } catch {} }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 48, padding: '4px 7px 6px', borderRadius: 16, border: 'none', cursor: 'pointer', background: gtab === k ? 'linear-gradient(180deg,rgba(255,215,106,.26),rgba(212,175,55,.10))' : 'transparent', color: gtab === k ? '#ffe9a3' : 'var(--muted)', fontFamily: 'inherit', fontSize: 10.5, fontWeight: gtab === k ? 800 : 500, boxShadow: gtab === k ? 'inset 0 0 0 1px rgba(212,175,55,.45)' : 'none' }}>
            <span className={gtab === k ? 'empTabActive' : undefined} style={gtab === k
              ? { fontSize: 16, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#ffe085,#d4af37)', border: '2px solid rgba(90,60,10,.55)', boxShadow: '0 3px 0 #8a6d1f, 0 6px 14px rgba(255,215,106,.45)', transform: 'translateY(-6px)', marginBottom: -6 }
              : { fontSize: 17 }}>{ic}</span>{l}
          </button>
        ))}
      </div>
    </div>

  </>)
}


// فاز ۱۰۳: کارتِ بازتولد و درختِ مهارت — همه‌چیز شفاف: چه می‌ماند، چه صفر می‌شود، هر امتیاز چه می‌کند.
function PrestigeCard({ api, busy, onDone }: { api: (b: object) => Promise<any>; busy: boolean; onDone: (d: any) => void }) {
  const [pv, setPv] = useState<any>(null)
  useEffect(() => { api({ action: 'prestige' }).then(d => { if (d?.preview) setPv(d) }) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!pv) return null
  const hasAny = (pv.me?.count || 0) > 0 || (pv.me?.points || 0) > 0
  if (!pv.eligible && !hasAny) return null   // تا نزدیکِ سطحِ لازم، بی‌سروصدا
  const fa2 = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🌌 بازتولد و مهارت‌های ماندگار</b>
        {pv.me.count > 0 && <span style={{ fontSize: 11, color: 'var(--gold)' }}>دورِ {fa2(pv.me.count + 1)}</span>}
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>امتیازِ آزاد: <b style={{ color: 'var(--gold)' }}>{fa2(pv.me.points)}</b></span>
        <span style={{ flex: 1 }} />
        {pv.eligible && <button disabled={busy} style={{ padding: '6px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }} onClick={async () => {
          if (!confirm(`بازتولد؟\n${pv.keep}\n+${fa2(pv.pointsPer)} امتیازِ مهارتِ دائمی می‌گیری.`)) return
          const d = await api({ action: 'prestige', confirm: true })
          if (d) { onDone(d); const d2 = await api({ action: 'prestige' }); if (d2?.preview) setPv(d2) }
        }}>🌌 بازتولد</button>}
        {!pv.eligible && <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>بازتولدِ بعدی از سطحِ {fa2(pv.minLevel)}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8, marginTop: 10 }}>
        {(pv.branches || []).map((br: any) => {
          const lvl = pv.me.spent?.[br.id] || 0
          const effNow = br.id === 'nego' ? pv.effects.negoPp : br.id === 'build' ? pv.effects.buildCostPct : pv.effects.marketIncomePct
          return (
            <div key={br.id} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{br.icon} {br.name} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>{fa2(lvl)}/{fa2(pv.maxPerBranch)}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', margin: '3px 0 6px' }}>{br.id === 'nego' ? `+${fa2(br.per)} واحد شانسِ مذاکره به‌ازای هر امتیاز` : br.id === 'build' ? `−${fa2(br.per)}٪ هزینهٔ ساخت به‌ازای هر امتیاز` : `+${fa2(br.per)}٪ درآمدِ اجاره به‌ازای هر امتیاز`}{effNow > 0 ? ` — الان: ${fa2(effNow)}` : ''}</div>
              <button disabled={busy || pv.me.points <= 0 || lvl >= pv.maxPerBranch} style={{ padding: '4px 12px', borderRadius: 9, border: '1px solid var(--line2)', background: pv.me.points > 0 && lvl < pv.maxPerBranch ? 'var(--goldDim)' : 'transparent', color: pv.me.points > 0 && lvl < pv.maxPerBranch ? 'var(--gold)' : 'var(--faint)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }} onClick={async () => {
                const d = await api({ action: 'skillSpend', branch: br.id })
                if (d) { onDone(d); const d2 = await api({ action: 'prestige' }); if (d2?.preview) setPv(d2) }
              }}>+ ارتقا</button>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 8 }}>اثرها کوچک و شفاف‌اند و فقط با «بازتولدِ» واقعی به‌دست می‌آیند — خریدنی نیستند.</div>
    </div>
  )
}

// 🎨 فروشگاهِ سازندگان (فاز ۱۰۷): فرمِ ثبتِ طرحِ ظاهری + وضعیتِ طرح‌های خودم — تأییدِ انسانیِ ملک‌جت، سهمِ فروش به کوینِ سازنده.
function CreatorStudioCard({ st, api, busy }: { st: any; api: (b: object) => Promise<any>; busy: boolean }) {
  const [mine, setMine] = useState<any[] | null>(null)
  const [kind, setKind] = useState<'frame' | 'flair'>('frame')
  const [icon, setIcon] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  useEffect(() => { api({ action: 'creatorMine' }).then(d => { if (d?.mine) setMine(d.mine) }) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fa2 = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  const cr = st.creator || {}
  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }
  const stFa: Record<string, [string, string]> = { pending: ['در انتظارِ بررسیِ ملک‌جت', 'var(--gold)'], approved: ['✓ در فروشگاه', '#7ee0b8'], rejected: ['✕ تأیید نشد', '#e88'] }
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>🎨 آیتمِ خودت را بساز</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>طرحت بعد از تأییدِ ملک‌جت در همین فروشگاه فروخته می‌شود — {fa2(cr.sharePct || 0)}٪ هر فروش به کوینت واریز می‌شود</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <select value={kind} onChange={e => setKind(e.target.value === 'flair' ? 'flair' : 'frame')} style={{ ...inp, width: 130 }} aria-label="نوعِ آیتم">
          <option value="frame">قابِ پروفایل</option>
          <option value="flair">نشانِ کنارِ نام</option>
        </select>
        <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="ایموجی (مثلاً 🐆)" style={{ ...inp, width: 120, textAlign: 'center' }} maxLength={4} />
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="نامِ آیتم (۲ تا ۳۰ کاراکتر)" style={{ ...inp, flex: 1, minWidth: 170 }} maxLength={30} />
        <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d۰-۹]/g, ''))} placeholder={`قیمت (${fa2(cr.minPriceCoins || 0)}–${fa2(cr.maxPriceCoins || 0)} کوین)`} style={{ ...inp, width: 160, textAlign: 'center' }} inputMode="numeric" />
        <button style={{ background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }} disabled={busy} onClick={async () => {
          const p = Number(String(price).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
          const d = await api({ action: 'creatorSubmit', kind, icon: icon.trim(), label: label.trim(), priceCoins: p })
          if (d?.ok) { setMine(d.mine || null); setIcon(''); setLabel(''); setPrice(''); alert('طرحت ثبت شد — بعد از بررسیِ ملک‌جت خبرش در دفترچه‌ات می‌آید ✓') }
        }}>ثبتِ طرح</button>
      </div>
      {(mine || []).length > 0 && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>طرح‌های من</div>
        {(mine || []).map((m: any) => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
            <span style={{ fontSize: 17 }}>{m.icon}</span>
            <b>{m.label}</b>
            <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>{m.kind === 'frame' ? 'قاب' : 'نشان'} · {fa2(m.priceCoins)} کوین</span>
            {m.status === 'approved' && m.sales > 0 && <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>{fa2(m.sales)} فروش · +{fa2(m.earnedCoins)} کوین سهمِ تو</span>}
            <span style={{ flex: 1 }} />
            <span style={{ color: stFa[m.status]?.[1] || 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{stFa[m.status]?.[0] || m.status}{m.status === 'rejected' && m.note ? ` — ${m.note}` : ''}</span>
          </div>
        ))}
      </div>}
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>آیتمِ ظاهری فقط دیده‌شدن است — روی اقتصاد، سرعت یا قدرتِ هیچ‌کس اثر ندارد.</div>
    </div>
  )
}
