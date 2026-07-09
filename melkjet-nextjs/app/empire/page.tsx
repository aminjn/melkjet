'use client'
// Empire · «مسیرِ رشد» — سفرِ سندِ Empire Bible (جلد۲ فصل ۱–۶) مو به مو:
// معرفیِ ملک‌جت → ۵ سؤالِ شخصیتی → Dream Board → حکمِ هویتی → تولد + نام‌گذاری → هدیهٔ سرمایه →
// ۴ فرصتِ واقعی (یکی برجسته) → متن‌های خرید + امضا → «تو مالک هستی» + پاداش → تصمیمِ معنادار → داشبورد.
// قانونِ برندینگِ سند: هرگز «بازی» گفته نمی‌شود — «مسیرِ رشد / امپراتوری / سفرِ مالی».
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NeshanMap from '@/app/components/NeshanMap'
import { sfx, sfxPrefs, setSfxPrefs } from '@/app/lib/empire-sound'
import Link from 'next/link'

const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
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
  return <>{p2(Math.floor(left / 36e5))}:{p2(Math.floor(left / 6e4) % 60)}:{p2(Math.floor(left / 1000) % 60)}</>
}

type Opp = { id: string; title: string; hood: string; price: number; priceStr: string; image: string; area: number; rooms: number; ptype: string; kind: string; recommended: boolean; reason: string; locked?: boolean; why?: string[] }
type St = any

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }
const btn: React.CSSProperties = { background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 14 }
const chip = (on: boolean): React.CSSProperties => ({ padding: '10px 14px', borderRadius: 12, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'rgba(212,175,55,.12)' : 'var(--bg2)', color: on ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontSize: 13 })

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
  const [peek, setPeek] = useState<any>(null)                    // پروفایلِ عمومیِ یک امپراتوریِ دیگر (سند ۱۷)
  const [gtab, setGtab] = useState<'city' | 'portfolio' | 'missions' | 'market' | 'ranks'>('city')   // منوی بازی (Visual Pass)
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
  const [pu, setPu] = useState<Record<string, string>>({})       // تعدادِ واحدِ پیش‌فروش/فروش
  const [pfKind, setPfKind] = useState('all')                    // فیلترِ پرتفوی (سند ۱۹ — Part 07)
  const [pfSort, setPfSort] = useState<'new' | 'value' | 'growth'>('new')
  // جشن = پاشِش + صدای موفقیت (سند ۲۱ Part 06: مثبت/منفی کاملاً متمایز)
  const celebrate = () => { setBurst(Date.now()); setTimeout(() => setBurst(0), 1100); sfx('success', st?.soundEnabled !== false) }
  const [snd, setSnd] = useState({ on: true, vol: 0.35 })   // 🔊 تنظیمِ صدای کاربر (فاز ۳۲) — از localStorage
  const [sndOpen, setSndOpen] = useState(false)
  useEffect(() => { setSnd(sfxPrefs()) }, [])
  const [fu, setFu] = useState<Record<string, string>>({})       // تعدادِ واحدِ صندوق (ورودی)
  const [cu, setCu] = useState<Record<string, string>>({})       // تعدادِ واحدِ مشارکت (ورودی)
  const [nego, setNego] = useState<Record<string, any>>({})   // نتیجهٔ مذاکره به‌ازای هر آگهی
  const [deals, setDeals] = useState<any>(null)                // فرصت‌های طلاییِ امروز (سند ۱۴ — Hook)
  const [lands, setLands] = useState<any>(null)                // 🏞 بازارِ زمین (فاز ۲۴) — دروازهٔ موتورِ ساخت
  const [mapL, setMapL] = useState({ assets: true, deals: true, lands: true })   // لایه‌های نقشهٔ شهر (فاز ۲۶)
  const [dz, setDz] = useState<any>(null)                      // فرمِ قراردادِ معمار (فاز ۲۹): {assetId, info, floors, upf}
  // (فاز ۳۱: تیکِ سراسری حذف شد — شمارشِ معکوس کامپوننتِ ایزولهٔ خودش را دارد تا کلِ صفحه هر ثانیه رندر نشود)
  const [dealAn, setDealAn] = useState('')                     // تحلیلِ کدام فرصتِ امروز نمایش داده شود
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

  // فرصت‌های طلاییِ امروز (سند ۱۴ — Hook): اولین چیزی که کاربر می‌بیند؛ فردا فرصت‌های دیگری می‌آیند.
  useEffect(() => {
    if (step !== 'dash' || !st?.dealsEnabled || deals) return
    let alive = true
    fetch('/api/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deals' }) })
      .then(r => r.json()).then(d => { if (alive && d?.ok) setDeals(d) }).catch(() => {})
    return () => { alive = false }
  }, [step, st?.dealsEnabled, deals])
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
  async function doClaim(key: string) { const d = await api({ action: 'claim', key }); if (d) { setSt(d); celebrate() } }
  async function doSell(a: any) {
    if (!confirm(`«${a.title.slice(0, 40)}» به قیمتِ روزِ ${faB(a.current || a.buyPrice)} تومان فروخته شود؟`)) return
    const d = await api({ action: 'sell', assetId: a.id })
    if (d) { setSt(d); if ((d.profit || 0) > 0) celebrate() }
  }
  async function doChest() { const d = await api({ action: 'chest' }); if (d) { setChestReward(d.reward); celebrate(); load() } }
  async function doBoards() { const d = await api({ action: 'boards' }); if (d) setBoards(d) }
  async function doMarket() { const d = await api({ action: 'market' }); if (d) setMkt(d) }
  async function doNews() { const d = await api({ action: 'news' }); if (d) setPaper(d) }
  // معاملهٔ بازار سرمایه: بعد از موفقیت، هم وضعیتِ کلی و هم نمای بازار تازه می‌شود.
  async function doTrade(body: any, clear?: () => void) {
    const d = await api(body)
    if (d) { setSt(d); clear?.(); doMarket() }
  }

  // ══════════ رندر ══════════
  // لایهٔ حس و حرکت (جلد ۵۶): «هیچ چیزی نباید ناگهانی ظاهر شود» — ورودِ پلکانی، میکرواینترکشن، جشنِ موفقیت.
  const wrap = (children: React.ReactNode) => (
    <main dir="rtl" className="empRoot" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes empUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes empBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.35);opacity:0}}
        @keyframes empTwinkle{0%,100%{opacity:.25}50%{opacity:.9}}
        .empRoot>*{animation:empUp .45s ease both}
        .empRoot>*:nth-child(2){animation-delay:.05s}.empRoot>*:nth-child(3){animation-delay:.1s}
        .empRoot>*:nth-child(4){animation-delay:.15s}.empRoot>*:nth-child(5){animation-delay:.2s}
        .empRoot>*:nth-child(6){animation-delay:.25s}.empRoot>*:nth-child(7){animation-delay:.3s}
        .empRoot>*:nth-child(n+8){animation-delay:.35s}
        .empRoot button{transition:transform .15s ease,filter .15s ease,border-color .15s ease}
        .empRoot button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.07)}
        .empRoot button:active:not(:disabled){transform:scale(.97)}
        .empRoot details>div,.empRoot details>*:not(summary){animation:empUp .35s ease both}
        @media (prefers-reduced-motion: reduce){.empRoot *{animation:none!important;transition:none!important}}
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
    <main dir="rtl" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: '#0a0a0c' }}>
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
    <main dir="rtl" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
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
  return wrap(<>
    {/* سربرگ = HUD چسبان (فصل ۹: همیشه در دسترس، کمتر از ۲۰٪ صفحه) */}
    <div style={{ ...card, position: 'sticky' as const, top: 8, zIndex: 40, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', boxShadow: '0 8px 24px -10px rgba(0,0,0,.45)' }}>
      {/* قاب/نشانِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳): فقط نمایش؛ همین‌ها در لیدربورد هم کنارِ نامت دیده می‌شوند */}
      {(() => { const ic = (st.cosmetics?.items || []).find((i: any) => i.id === st.cosmetics?.frame)?.icon; return <div style={{ fontSize: 30, position: 'relative' }}>{e.persona || '🏛'}{ic && <span style={{ position: 'absolute', top: -7, left: -9, fontSize: 14 }}>{ic}</span>}</div> })()}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{e.name} {(() => { const ic = (st.cosmetics?.items || []).find((i: any) => i.id === st.cosmetics?.flair)?.icon; return ic ? <span title="نشانِ ظاهری">{ic} </span> : null })()}<span style={{ fontSize: 11, color: 'var(--muted)' }}>#{fa(e.no)}</span>{e.title && <span style={{ fontSize: 10.5, marginRight: 8, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--gold)', color: 'var(--gold)' }}>👑 {e.title}</span>}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.profile?.title} · DNA: {e.dna} · دستیار: {e.mentor}</div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>سطح {fa(lv.level || 1)} · {lv.titleFa} ({lv.title})</span>
          <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3 }}><div style={{ width: `${(lv.progress || 0) * 100}%`, height: 5, background: 'var(--gold)', borderRadius: 3 }} /></div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>⚡ {fa(e.xp)}{lv.next ? ` / ${fa(lv.next)}` : ''}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ ...card, padding: '6px 10px' }} title="Empire Score">🏆 {fa(st.empireScore || 0)}</span>
        <span style={{ ...card, padding: '6px 10px' }}>🪙 {fa(e.coins)}</span>
        <span style={{ ...card, padding: '6px 10px' }}>🤖 {fa(e.aiTokens)}</span>
        {st.streak && st.streak.streak > 0 && <span style={{ ...card, padding: '6px 10px' }} title="روزهای پیاپیِ حضور">🔥 {fa(st.streak.streak)}</span>}
        {(e.kudos || 0) > 0 && <span style={{ ...card, padding: '6px 10px' }} title="تحسینِ امپراتورهای واقعی">👏 {fa(e.kudos)}</span>}
        {/* 🔊 تنظیمِ صدا (سند ۲۱ Part 05): خاموش/روشن + حجم، ذخیره روی دستگاه، تغییرِ فوری با صدای تست */}
        {st.soundEnabled !== false && <span style={{ position: 'relative' }}>
          <button title="صدای بازخورد" onClick={() => setSndOpen(o => !o)} style={{ ...card, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>{snd.on && snd.vol > 0 ? '🔊' : '🔇'}</button>
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

    {gtab === 'city' && <>
    {/* 🎁 پیشنهادِ هوشمند (فاز ۳۳ — سند ۲۲ فصل ۹): حداکثر ۱ در روز، از رفتارِ واقعیِ خودت، با یک لمس بسته می‌شود.
        بدونِ تایمرِ ساختگی و بدونِ پاپ‌آپ — یک کارتِ ساده که «نه» هم جوابِ کاملاً قابلِ‌قبولی است. */}
    {st.offer && <div style={{ ...card, borderColor: 'var(--goldDim)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 22 }}>{st.offer.icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <b style={{ fontSize: 13 }}>{st.offer.title}</b>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{st.offer.text}</div>
      </div>
      <button style={{ ...btn, padding: '5px 14px', fontSize: 12 }} onClick={() => { setGtab('market'); setTimeout(() => document.getElementById(st.offer.goto === 'coins' ? 'coin-shop' : 'cosmetic-shop')?.scrollIntoView({ behavior: 'smooth' }), 120) }}>{st.offer.cta}</button>
      <button title="بستن — تا چند روز برنمی‌گردد" style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }} disabled={busy}
        onClick={async () => { await api({ action: 'offerDismiss', id: st.offer.id }); setSt((s: any) => ({ ...s, offer: null })) }}>✕</button>
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
            {deals.deals.map((dl: any) => (
              <div key={dl.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.7 }}>{dl.title.slice(0, 55)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dl.hood}{dl.area ? ` · ${fa(dl.area)} متر` : ''}{dl.perM ? ` · متری ${faB(dl.perM)}` : ''}</div>
                <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{faB(dl.price)} تومان</div>
                {nego[dl.id] && <div style={{ fontSize: 10.5, color: nego[dl.id].success ? '#7c6' : 'var(--muted)' }}>
                  🤝 {nego[dl.id].owner?.name || 'مالک'}: {nego[dl.id].success ? `${fa(nego[dl.id].discountPct)}٪ تخفیف → ${faB(nego[dl.id].finalPrice)}` : 'کوتاه نیامد'}
                  {nego[dl.id].memoryNote && <div style={{ color: '#e7a14a' }}>🧠 {nego[dl.id].memoryNote}</div>}
                </div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
                  {!nego[dl.id] && <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'negotiate', listingId: dl.id }); if (d) setNego(p => ({ ...p, [dl.id]: d })) }}>🤝 مذاکره</button>}
                  <button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} disabled={busy || e.aiTokens <= 0} title="میانهٔ متریِ واقعیِ هم‌محله‌ها را نشان می‌دهد"
                    onClick={async () => { setDealAn(dl.id); await doAnalyze(dl.id) }}>🤖 تحلیل (۱ ژتون)</button>
                  <button style={{ ...btn, padding: '4px 10px', fontSize: 11 }} disabled={busy}
                    onClick={() => doBuy({ id: dl.id, title: dl.title, hood: dl.hood, price: nego[dl.id]?.success ? nego[dl.id].finalPrice : dl.price, area: dl.area } as any, !!nego[dl.id]?.success)}>می‌خرم</button>
                  {dl.url && <a href={dl.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '4px 9px', fontSize: 11, textDecoration: 'none' }}>🔗</a>}
                </div>
                {dealAn === dl.id && analysis && <div style={{ fontSize: 10.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                  <b style={{ color: 'var(--text)' }}>{analysis.verdict}</b>
                  {analysis.samples > 0 && <div>متریِ این ملک {faB(analysis.minePerM)} · میانگینِ هم‌محله‌ها {faB(analysis.avgPerM)} (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
                </div>}
              </div>
            ))}
          </div>
        </div>
      )
    })()}

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
                </div>}
              </div>
            ))}
          </div>}
      </div>
    )}

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

    {/* خطِ آسمانِ امپراتوری (جلد ۵۶ — قانونِ ۳: «تجربه به‌جای داده») — ارتفاعِ هر برج = ارزشِ روزِ واقعی */}
    {(e.assets?.length || 0) > 0 && (() => {
      const vals = e.assets.map((a: any) => a.current || a.buyPrice)
      const max = Math.max(...vals)
      return (
        <div style={{ ...card, padding: '14px 16px 0', background: 'linear-gradient(180deg,#0a0d1c 0%,#121830 62%,#231803 100%)', borderColor: 'rgba(201,168,76,.5)', overflow: 'hidden', position: 'relative' }}>
          {['12%', '30%', '55%', '74%', '90%'].map((left, i) => (
            <span key={i} style={{ position: 'absolute', top: 10 + (i % 3) * 9, left, fontSize: 8, color: '#cfd6ff', animation: `empTwinkle ${2 + i * 0.6}s ease-in-out infinite` }}>✦</span>
          ))}
          <span style={{ position: 'absolute', top: 12, left: 18, fontSize: 20 }}>🌙</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontSize: 13.5, color: '#ece5d8' }}>🌆 خطِ آسمانِ امپراتوریِ تو</b>
            <span style={{ fontSize: 10.5, color: '#9aa0b8' }}>ارتفاعِ هر برج = ارزشِ روزِ واقعیِ همان دارایی</span>
          </div>
          {/* هر برج = یک دارایی: ارزشِ روز بالای برج، نامِ محله زیرش — دیگر نمودارِ گنگ نیست (فاز ۳۰) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
            {e.assets.map((a: any, i: number) => {
              const h = 26 + Math.round((vals[i] / max) * 70)
              const building = a.construction && !a.construction.done
              return (
                <div key={a.id} title={`${a.title?.slice(0, 60)} — ${faB(vals[i])} تومان${building ? ' · در حال ساخت' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 44 }}>
                  <span style={{ fontSize: 9, color: '#f3d98a', whiteSpace: 'nowrap' }}>{faB(vals[i])}</span>
                  <span style={{ fontSize: 11, lineHeight: 1 }}>{building ? '🏗' : a.kind === 'land' ? '🏞' : a.kind === 'villa' ? '🏡' : a.kind === 'commercial' ? '🏬' : '🏢'}</span>
                  <div style={{
                    width: 30, height: h, borderRadius: '3px 3px 0 0', cursor: 'default',
                    // برجِ در حالِ ساخت از ظاهر قابلِ تشخیص است (سند ۲۰ — Part 03): کم‌نور + قابِ نقطه‌چین + جرثقیل
                    opacity: building ? 0.55 : 1,
                    background: 'linear-gradient(180deg,#262c47,#151827)', border: building ? '1px dashed #8a7c4c' : '1px solid #3c4468', borderBottom: 'none',
                    backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,214,120,.7) 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, transparent 0 5px, rgba(0,0,0,.4) 5px 10px)',
                    animation: 'empUp .6s ease both', animationDelay: `${i * 80}ms`,
                  }} />
                  <span style={{ fontSize: 8.5, color: '#9aa0b8', maxWidth: 56, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(a.hood || a.title || '').slice(0, 12)}</span>
                </div>
              )
            })}
          </div>
          <div style={{ height: 3, margin: '0 -16px', background: 'linear-gradient(90deg,transparent,#c9a84c 30%,#c9a84c 70%,transparent)' }} />
        </div>
      )
    })()}

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
            <button style={chip(mapL.assets, '#c9a84c')} onClick={() => setMapL(m => ({ ...m, assets: !m.assets }))}>🏛 دارایی‌های من ({fa(aPts.length)})</button>
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
          <div style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--faint)' }}>پینِ 🏛 دارایی → صفحهٔ پرتفوی · 🏗 کارگاهِ در حالِ ساخت · 🔥/🏞 → آگهیِ واقعی · زوم و مرکزِ نقشه دستِ خودت می‌ماند</div>
        </div>
      )
    })()}
    </>}

    {gtab === 'portfolio' && <>
    {/* ارزشِ خالص (زنده از بازارِ واقعی) — اعداد با شمارشِ متحرک (جلد ۵۶) */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>ارزشِ خالص</div><div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)' }}><CountUp value={st.netWorth || 0} format={faB} /> تومان</div></div>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>سرمایهٔ نقد</div><div style={{ fontSize: 17, fontWeight: 800 }}><CountUp value={e.capital} format={faB} /> تومان</div></div>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>ارزشِ دارایی‌ها (زنده)</div><div style={{ fontSize: 17, fontWeight: 800 }}><CountUp value={st.assetsValue || 0} format={faB} /> تومان {st.growth ? <span style={{ fontSize: 12, color: st.growth > 0 ? '#7c6' : '#e88' }}>({st.growth > 0 ? '+' : ''}{st.growth.toLocaleString('fa-IR')}٪)</span> : null}</div></div>
      {(e.realized || 0) !== 0 && <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>سودِ تحقق‌یافته (فروش‌ها)</div><div style={{ fontSize: 17, fontWeight: 800, color: e.realized > 0 ? '#7c6' : '#e88' }}>{e.realized > 0 ? '+' : '−'}<CountUp value={Math.abs(e.realized)} format={faB} /> تومان</div></div>}
    </div>

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

    {gtab === 'city' && <>
    {st.suspense && <div style={{ ...card, borderColor: 'var(--gold)', fontSize: 13 }}>⏳ {st.suspense.text}</div>}
    {st.othersBuilding > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>🌍 {fa(st.othersBuilding)} نفرِ دیگر هم همین حالا در حالِ ساختِ امپراتوری‌شان هستند.</div>}

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(e.assets || [])
          .filter((a: any) => {
            // «مشکل‌دار» = تصمیمِ معطل: اتفاقِ کارگاه، اعتراضِ پروانه، یا کارگاهِ ایستاده به‌خاطرِ بی‌پولی
            if (pfKind === 'issue') return !!a.construction?.pendingEvent || (a.permit?.objection && !a.permit.objection.settled) || (a.construction && !a.construction.done && e.capital < (a.build?.dailyCost || 0))
            return pfKind === 'all' || a.kind === pfKind
          })
          .sort((a: any, b: any) => pfSort === 'value' ? (b.current || b.buyPrice) - (a.current || a.buyPrice) : pfSort === 'growth' ? (b.growthPct || 0) - (a.growthPct || 0) : (b.boughtAt || 0) - (a.boughtAt || 0))
          .map((a: any) => (
          <div key={a.id} style={{ ...card, background: 'var(--bg2)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{a.kind === 'land' ? '🏞' : a.kind === 'villa' ? '🏡' : a.kind === 'commercial' ? '🏬' : '🏢'}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{a.title.slice(0, 55)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.hood} · خرید: {faB(a.buyPrice)}</div>
            </div>
            <div style={{ fontSize: 12 }}>ارزشِ روز: <b style={{ color: 'var(--gold)' }}>{faB(a.current || a.buyPrice)}</b> {a.growthPct ? <span style={{ color: a.growthPct > 0 ? '#7c6' : '#e88' }}>({a.growthPct > 0 ? '+' : ''}{a.growthPct.toLocaleString('fa-IR')}٪)</span> : null}
              {a.income > 0 && <span style={{ fontSize: 11, color: '#7c6', marginRight: 6 }}>· درآمد {faB(a.income)}</span>}</div>
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
                      onClick={async () => { const d = await api({ action: 'designPlan', assetId: a.id }); if (d) setDz({ assetId: a.id, info: d, floors: String(d.legalFloors), upf: '2' }) }}>📐 قراردادِ معمار — طراحیِ نقشه</button>
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
                        onClick={async () => { const d = await api({ action: 'buildPlan', assetId: a.id }); if (d) setBplan({ assetId: a.id, ...d }) }}>⛏ شروعِ ساخت</button>
                    </span>
                  : a.permit.status === 'granted'
                  ? <span style={{ fontSize: 11, color: '#7c6' }}>📜 پروانه ✓</span>
                  : <span style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                      <span style={{ color: 'var(--gold)' }}>⏳ بررسیِ پروانه — {fa(Math.max(0, Math.ceil(((a.permitDue || 0) - Date.now()) / 864e5)))} روز مانده
                        {/* ⚡ پیگیریِ حضوری (فاز ۲۷): کوین انتظار را کوتاه می‌کند — اعتراض/عوارض سرِ جایشان */}
                        {st.speed?.enabled && Math.ceil(((a.permitDue || 0) - Date.now()) / 864e5) > 0 && <button style={{ ...btnGhost, padding: '2px 9px', fontSize: 10.5, marginRight: 8, color: 'var(--gold)', borderColor: 'var(--goldDim)' }}
                          disabled={busy || e.coins < (st.speed.permitCoinsPerDay || 0)}
                          onClick={async () => { const d = await api({ action: 'permitBoost', assetId: a.id, days: 1 }); if (d) setSt(d) }}>⚡ پیگیری: ۱− روز (🪙 {fa(st.speed.permitCoinsPerDay)})</button>}</span>
                      {a.permit.objection && !a.permit.objection.settled && <span style={{ color: '#e7a14a' }}>⚠️ {a.permit.objection.text}
                        <button style={{ ...btnGhost, padding: '2px 8px', fontSize: 10.5, marginRight: 6 }} disabled={busy}
                          onClick={async () => { const d = await api({ action: 'permitSettle', assetId: a.id }); if (d) setSt(d) }}>🤝 توافق ({faB(a.permit.objection.settleCost)})</button>
                        <span style={{ color: 'var(--faint)', fontSize: 10 }}> یا دفاع در کمیسیون (+{fa(a.permit.objection.extraDays)} روز)</span></span>}
                    </span>)
              : a.kind === 'land' && a.landPlan
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.landPlan === 'partner' ? '🤝 مشارکت' : '💸 آمادهٔ فروش'}</span>
              : a.kind === 'commercial' && !a.business
              ? <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['کافه', 'رستوران', 'فروشگاه', 'کلینیک', 'دفترِ خدماتی'].map(bz => (
                  <button key={bz} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}
                    onClick={async () => { const d = await api({ action: 'business', assetId: a.id, biz: bz }); if (d) { setSt(d); alert(`احتمالِ موفقیتِ ${bz} در ${a.hood || 'این محله'}: ${fa(d.prob)}٪ (از ${fa(d.signals.hoodListings)} آگهیِ فعال و ${fa(d.signals.competitors)} رقیبِ واقعی)`) } }}>{bz}</button>
                ))}</span>
              : a.business
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>🏪 {a.business} ({fa(a.businessProb || 0)}٪)</span>
              : a.action
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.action === 'renovate' ? '🛠 بازسازی' : a.action === 'rent' ? '💰 اجاره' : '📈 نگه‌داری'}</span>
              : <span style={{ display: 'flex', gap: 4 }}>{[['renovate', '🛠', 'بازسازی'], ['rent', '💰', 'اجاره دادن'], ['hold', '📈', 'نگه داشتن']].map(([k, i, t]) => <button key={k} title={t} style={{ ...btnGhost, padding: '4px 8px', fontSize: 13 }} onClick={async () => {
                  // اجاره (فاز ۲۹): از طریقِ مشاورِ املاک — کمیسیونِ عرفِ واقعی (٪ از یک ماه اجارهٔ میانهٔ محله)
                  if (k === 'rent' && !confirm(`اجاره از طریقِ مشاورِ املاکِ محله انجام می‌شود — کمیسیون ${fa(st.pros?.advisorRentCommissionPct || 25)}٪ از یک ماه اجارهٔ میانهٔ واقعیِ محله. ادامه؟`)) return
                  const d = await api({ action: 'assetAction', assetId: a.id, act: k }); if (d) { setSt(d); if (d.advisorFee) alert(`🤝 مشاور مستأجر پیدا کرد — کمیسیون ${faB(d.advisorFee)} تومان پرداخت شد؛ درآمدِ اجاره از میانهٔ واقعیِ محله شروع شد.`) }
                }}>{i}</button>)}</span>}
            <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} disabled={busy || e.aiTokens <= 0} onClick={() => doAnalyze(a.listingId)}>تحلیلِ ملک‌جت (۱ ژتون)</button>
            {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, textDecoration: 'none' }}>🔗 آگهیِ واقعی</a>}
            {!a.construction && <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, color: '#e88', borderColor: '#644' }} disabled={busy} onClick={() => doSell(a)}>💸 فروش</button>}

            {/* 🧩 تجمیع و تخریب (فاز ۲۵): تک‌تکِ واحدهای ساختمان را بخر — تا همه مالِ تو نشد، تخریب ممکن نیست */}
            {a.assembly && <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, borderTop: '1px dashed var(--line)', paddingTop: 6, marginTop: 2 }}>
              <span style={{ color: 'var(--muted)' }}>🧩 واحدهای ساختمان: <b style={{ color: a.assembly.canDemolish ? '#7c6' : 'var(--text)' }}>{fa(a.assembly.owned)} از {fa(a.assembly.total)}</b> مالِ تو</span>
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
              const floors = Math.max(1, Math.round(Number(digitsOf(dz.floors)) || 0))
              const upf = Math.max(1, Math.round(Number(digitsOf(dz.upf)) || 0))
              const unitArea = Math.floor(inf.footprint / upf)
              const builtArea = inf.footprint * floors
              const illegal = Math.max(0, floors - inf.legalFloors)
              const fee = Math.max(1, Math.round(builtArea * inf.costPerM * inf.architectFeePct / 100))
              const fineEst = illegal * inf.footprint * inf.finePerM2
              // دکمه هرگز «بی‌صدا» قفل نمی‌شود (فاز ۳۱): اگر عدد مشکل دارد، دلیلِ دقیق همین‌جا و سرِ کلیک گفته می‌شود.
              const blockReason = floors > inf.maxFloors
                ? `حتی با تخلف، بیشتر از ${fa(inf.maxFloors)} طبقه ممکن نیست (${fa(inf.legalFloors)} قانونی + ${fa(inf.maxFloors - inf.legalFloors)} طبقهٔ تخلف) — شهرداری وسطِ کار متوقف می‌کند`
                : unitArea < inf.minUnitArea
                ? `با ${fa(upf)} واحد در طبقه، هر واحد ${fa(unitArea)} متر می‌شود — کمتر از حداقلِ قانونیِ ${fa(inf.minUnitArea)} متر؛ تعدادِ واحد را کم کن`
                : ''
              return (
                <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
                  <b>📐 طراحیِ نقشه با {inf.architect}</b>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    زمین {fa(inf.landArea)} متر{inf.areaNote ? <span style={{ color: '#e7a14a' }}> ({inf.areaNote})</span> : null} · سطحِ اشغال {fa(inf.occupancyPct)}٪ → هر طبقه {fa(inf.footprint)} متر · مجازِ قانونی: {fa(inf.legalFloors)} طبقه (حداکثرِ قابل‌ساخت {fa(inf.maxFloors)})
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                    <label style={{ fontSize: 11.5 }}>طبقات: <input value={dz.floors} onChange={ev => setDz({ ...dz, floors: digitsOf(ev.target.value) })} inputMode="numeric" style={{ width: 54, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} /></label>
                    <label style={{ fontSize: 11.5 }}>واحد در طبقه: <input value={dz.upf} onChange={ev => setDz({ ...dz, upf: digitsOf(ev.target.value) })} inputMode="numeric" style={{ width: 54, padding: 7, borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', textAlign: 'center' }} /></label>
                    <span style={{ fontSize: 11, color: unitArea < inf.minUnitArea ? '#e88' : 'var(--muted)' }}>= {fa(floors * upf)} واحدِ {fa(unitArea)} متری · بنا {fa(builtArea)} متر</span>
                  </div>
                  {illegal > 0 && floors <= inf.maxFloors && <div style={{ fontSize: 11, color: '#e7a14a', marginTop: 6 }}>⚠️ {fa(illegal)} طبقهٔ مازاد بر تراکمِ قانونی — بعد از تکمیل، کمیسیونِ ماده۱۰۰: جریمهٔ برآوردی {faB(fineEst)} تومان یا تخریبِ طبقات</div>}
                  {blockReason && <div style={{ fontSize: 11.5, color: '#e88', marginTop: 6, fontWeight: 700 }}>🛑 {blockReason}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button style={{ ...btn, padding: '6px 14px', fontSize: 12, opacity: blockReason ? 0.55 : 1 }} disabled={busy}
                      onClick={async () => {
                        if (blockReason) { setErr(blockReason); return }
                        const d = await api({ action: 'designStart', assetId: a.id, floors, unitsPerFloor: upf }); if (d) { setSt(d); setDz(null); celebrate() }
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

            {/* پیش‌نمایشِ نقشهٔ ساخت (جلد ۶۴): سازه/کیفیت با روز و هزینهٔ شفاف */}
            {bplan?.assetId === a.id && !a.construction && <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
              <b>⛏ نقشهٔ ساخت</b> — زمین {fa(bplan.landArea)} متر → <b style={{ color: 'var(--gold)' }}>{fa(bplan.builtArea)} مترِ بنا · {fa(bplan.totalUnits)} واحدِ {fa(bplan.unitArea)} متری</b>
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
                {(bplan.options || []).map((o: any) => (
                  <button key={o.structure + o.quality} style={{ ...btnGhost, textAlign: 'right', padding: '8px 10px', fontSize: 11.5 }} disabled={busy}
                    onClick={async () => { const d = await api({ action: 'startBuild', assetId: a.id, structure: o.structure, quality: o.quality, goal: bgoal }); if (d) { setSt(d); setBplan(null); celebrate() } }}>
                    <b>{o.structureLabel} · {o.qualityLabel}</b>
                    <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>{fa(o.days)} روز · هزینهٔ کل {faB(o.costTotal)} تومان</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>هزینه روزشمار از سرمایهٔ نقد کم می‌شود — پول تمام شود، کارگاه می‌ایستد (خودِ ساخت، مدیریتِ پول است).</div>
            </div>}

            {/* کارگاهِ زنده (جلد ۶۴–۷۲): پیشرفت، مرحله، رویداد، پیش‌فروش، فروشِ واحد */}
            {a.construction && <div style={{ width: '100%', ...card, background: 'var(--surface)', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{a.construction.done ? '🏙 ساختمان تکمیل شد' : `🏗 ${a.build?.stage || 'کارگاه'}`}</b>
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
        ))}
      </div>
      {analysis && <div style={{ ...card, background: 'var(--bg2)', marginTop: 10, fontSize: 13 }}>
        <b>🤖 تحلیلِ ملک‌جت — {analysis.hood || 'محله'}:</b> {analysis.verdict}
        {analysis.samples > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>میانگینِ متری هم‌محله‌ها: {faB(analysis.avgPerM)} تومان · این ملک: {faB(analysis.minePerM)} تومان (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
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
    {/* 🔥 پاداشِ نقاطِ عطفِ استریک (سند ۱۸ بخش ۱): از ورودِ پیاپیِ واقعی — روزهای ۷/۱۴/۲۱/۳۰ */}
    {(st.streakBonuses || []).some((sb: any) => sb.done && !sb.claimed) && (
      <div style={{ ...card, borderColor: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20 }}>🔥</span>
        <b style={{ fontSize: 13 }}>پاداشِ استریکِ {fa(st.streak?.streak || 0)} روزه آماده است</b>
        <span style={{ flex: 1 }} />
        {st.streakBonuses.filter((sb: any) => sb.done && !sb.claimed).map((sb: any) => (
          <button key={sb.claimKey} style={{ ...btn, padding: '6px 12px', fontSize: 12 }} disabled={busy}
            onClick={() => doClaim(sb.claimKey)}>🎁 روزِ {fa(sb.days)} → {fa(sb.coins)} کوین</button>
        ))}
      </div>
    )}

    {/* مأموریت‌ها — پیشرفت از رفتارِ واقعی */}
    {ms && <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>🎯 مأموریت‌های مسیر</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* کوئستِ روزانه/هفتگیِ شخصی (GDD جلد۲) — هر روز/هفته برای هر کاربر متفاوت */}
        {st.quests && [['🌅 کوئستِ امروزِ تو', st.quests.daily], ['📅 کوئستِ این هفته', st.quests.weekly]].map(([lbl, q]: any) => (
          <div key={q.claimKey} style={{ ...card, background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <b style={{ fontSize: 13 }}>{lbl}: {q.title}</b>
              {q.claimed ? <span style={{ fontSize: 12, color: '#7c6' }}>✓ دریافت شد</span>
                : q.done ? <button style={{ ...btn, padding: '4px 12px', fontSize: 12 }} onClick={() => doClaim(q.claimKey)}>دریافتِ ⚡{fa(q.rewardXp)} + 🪙{fa(q.rewardCoins)}</button>
                : <span style={{ fontSize: 11, color: 'var(--muted)' }}>⚡{fa(q.rewardXp)} + 🪙{fa(q.rewardCoins)}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3 }}><div style={{ width: `${Math.min(100, q.progress / q.target * 100)}%`, height: 5, background: q.done ? '#7c6' : 'var(--gold)', borderRadius: 3 }} /></div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fa(q.progress)}/{fa(q.target)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>پیشرفت از رفتارِ واقعی‌ات در <Link href="/search" style={{ color: 'var(--gold)' }}>جستجوی ملک‌جت</Link> شمرده می‌شود.</div>
          </div>
        ))}
        {/* M1 */}
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontSize: 13 }}>M1 · شهرت را کشف کن</b>
            {ms.m1.claimed ? <span style={{ fontSize: 12, color: '#7c6' }}>✓ دریافت شد</span>
              : ms.m1.done ? <button style={{ ...btn, padding: '4px 12px', fontSize: 12 }} onClick={() => doClaim('m1_explore')}>دریافتِ ⚡{fa(ms.m1.rewardXp)} + 🪙{fa(ms.m1.rewardCoins)}</button>
              : <span style={{ fontSize: 11, color: 'var(--muted)' }}>⚡{fa(ms.m1.rewardXp)} + 🪙{fa(ms.m1.rewardCoins)}</span>}
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
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontSize: 13 }}>M2 · سبکِ خودت را پیدا کن</b>
            {ms.m2.claimed ? <span style={{ fontSize: 12, color: '#7c6' }}>✓ دریافت شد</span>
              : ms.m2.done ? <button style={{ ...btn, padding: '4px 12px', fontSize: 12 }} onClick={() => doClaim('m2_style')}>دریافتِ ⚡{fa(ms.m2.rewardXp)} + 🪙{fa(ms.m2.rewardCoins)}</button>
              : <span style={{ fontSize: 11, color: 'var(--muted)' }}>حداقل ۳ سبک انتخاب کن</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {['مدرن', 'کلاسیک', 'مینیمال', 'لوکس', 'صنعتی', 'سنتی'].map(sk => { const on = (e.stylePicks || []).includes(sk); return (
              <button key={sk} style={chip(on)} onClick={async () => { const next = on ? (e.stylePicks || []).filter((x: string) => x !== sk) : [...(e.stylePicks || []), sk]; const d = await api({ action: 'style', picks: next }); if (d) load() }}>{sk}</button>
            )})}
          </div>
        </div>
        {/* M3 · Beat AI */}
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontSize: 13 }}>M3 · قیمت را حدس بزن (هوشِ ملک‌جت را شکست بده)</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>دقتِ تو: {fa(ms.m3.correct)}/{fa(ms.m3.tries)} · هر حدسِ درست ⚡{fa(ms.m3.rewardXp)} + 🪙{fa(ms.m3.rewardCoins)}</span>
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
        <div style={{ ...card, background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontSize: 13 }}>🕵️ شکارچیِ ملک — کدام بهتر است؟</b>
            {ms.hunter.claimed ? <span style={{ fontSize: 12, color: '#7c6' }}>✓ پاداش دریافت شد</span> : <span style={{ fontSize: 11, color: 'var(--muted)' }}>تحلیلِ درست: ⚡{fa(ms.hunter.rewardXp)} + 🪙{fa(ms.hunter.rewardCoins)}</span>}
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

    {gtab === 'market' && <>
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
                if (d?.redirect) { window.location.href = d.redirect; return }
                alert(d?.error || 'خطا در شروعِ پرداخت')
              } finally { setBusy(false) }
            }}>خرید</button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>پرداختِ امن با زرین‌پال · کوین بلافاصله بعد از تأییدِ درگاه به کیفت اضافه می‌شود و در تایم‌لاینت ثبت است.</div>
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

    {gtab === 'market' && <>
    {/* روزنامهٔ ملک‌جت (جلد ۵۲): خبر از خودِ دنیای واقعی تولید می‌شود، نه اسکریپت + آرشیوِ رکوردها (جلد ۵۱) */}
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
            <span style={{ ...card, padding: '6px 12px', background: 'var(--bg2)' }}>🌡 نبضِ بازار: <b style={{ color: mkt.psychology.score >= 55 ? '#7c6' : mkt.psychology.score <= 45 ? '#e88' : 'var(--muted)' }}>{mkt.psychology.label}</b> ({fa(mkt.psychology.score)}/۱۰۰) <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>از رفتارِ واقعیِ ۱۴ روز</span></span>
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
                {f.my && <div style={{ fontSize: 12, marginTop: 6 }}>سهمِ تو: <b>{fa(f.my.units)}</b> واحد · ارزشِ روز <b style={{ color: 'var(--gold)' }}>{faB(f.my.value)} ت</b> <span style={{ color: f.my.value >= f.my.cost ? '#7c6' : '#e88', fontSize: 11 }}>({f.my.value >= f.my.cost ? '+' : '−'}{faB(Math.abs(f.my.value - f.my.cost))})</span></div>}
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
                {p.my && <div style={{ fontSize: 12, marginTop: 6 }}>سهمِ تو: <b>{fa(p.my.units)}</b> واحد · ارزشِ روز <b style={{ color: 'var(--gold)' }}>{faB(p.my.value)} ت</b> <span style={{ color: p.my.value >= p.my.cost ? '#7c6' : '#e88', fontSize: 11 }}>({p.my.value >= p.my.cost ? '+' : '−'}{faB(Math.abs(p.my.value - p.my.cost))})</span></div>}
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

    {gtab === 'ranks' && <>
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
        {st.hiddenLeft > 0 && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>🎖 {fa(st.hiddenLeft)} مأموریتِ مخفی در انتظارِ کشف...</span>}
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={async () => { const n = prompt('نامِ جدیدِ امپراتوری:', e.name); if (n != null) { const d = await api({ action: 'rename', name: n }); if (d) load() } }}>تغییرِ نام</button>
      </div>
    </div>
    </>}

    {/* 🎮 منوی بازی (فصل ۹ Main Menu — Visual Pass): پنج صفحهٔ اصلی، ثابت در پایین */}
    <div style={{ height: 70 }} />
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', padding: '8px 10px calc(8px + env(safe-area-inset-bottom))', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: 16, padding: 5, boxShadow: '0 10px 34px -8px rgba(0,0,0,.55)', pointerEvents: 'auto' }}>
        {([['city', '🏙', 'شهر'], ['portfolio', '💼', 'پرتفوی'], ['missions', '🎯', 'مأموریت‌ها'], ['market', '📊', 'بازار'], ['ranks', '🏆', 'رتبه‌ها']] as const).map(([k, ic, l]) => (
          <button key={k} onClick={() => { setGtab(k); try { window.scrollTo({ top: 0 }) } catch {} }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 60, padding: '5px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', background: gtab === k ? 'var(--goldDim)' : 'transparent', color: gtab === k ? 'var(--gold)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 10.5, fontWeight: gtab === k ? 800 : 500 }}>
            <span style={{ fontSize: 17 }}>{ic}</span>{l}
          </button>
        ))}
      </div>
    </div>

  </>)
}
