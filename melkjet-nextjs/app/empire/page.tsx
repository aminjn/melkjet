'use client'
// Empire · «مسیرِ رشد» — سفرِ سندِ Empire Bible (جلد۲ فصل ۱–۶) مو به مو:
// معرفیِ ملک‌جت → ۵ سؤالِ شخصیتی → Dream Board → حکمِ هویتی → تولد + نام‌گذاری → هدیهٔ سرمایه →
// ۴ فرصتِ واقعی (یکی برجسته) → متن‌های خرید + امضا → «تو مالک هستی» + پاداش → تصمیمِ معنادار → داشبورد.
// قانونِ برندینگِ سند: هرگز «بازی» گفته نمی‌شود — «مسیرِ رشد / امپراتوری / سفرِ مالی».
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : n >= 1e6 ? `${fa(n / 1e6)} میلیون` : fa(n)
// ورودیِ عددی: رقم‌های فارسی/عربی → لاتین، بقیهٔ کاراکترها (نقطه/ویرگول/فاصله) حذف — تا «۲۰.۰۰۰.۰۰۰.۰۰۰» صفر نشود.
const digitsOf = (s: string) => s
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/\D/g, '').slice(0, 15)

type Opp = { id: string; title: string; hood: string; price: number; priceStr: string; image: string; area: number; rooms: number; ptype: string; kind: string; recommended: boolean; reason: string; locked?: boolean }
type St = any

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }
const btn: React.CSSProperties = { background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 14 }
const chip = (on: boolean): React.CSSProperties => ({ padding: '10px 14px', borderRadius: 12, border: `1px solid ${on ? 'var(--gold)' : 'var(--line2)'}`, background: on ? 'rgba(212,175,55,.12)' : 'var(--bg2)', color: on ? 'var(--gold)' : 'var(--text)', cursor: 'pointer', fontSize: 13 })

// ملک‌جت — دستیارِ هوشمندِ همراه؛ گفت‌وگوها متنِ قطعیِ سند است.
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
  const [boardTab, setBoardTab] = useState('score')
  const [loanVal, setLoanVal] = useState('')
  const [repayVal, setRepayVal] = useState('')
  const [mkt, setMkt] = useState<any>(null)                      // بازار سرمایه (جلد ۴۰)
  const [fu, setFu] = useState<Record<string, string>>({})       // تعدادِ واحدِ صندوق (ورودی)
  const [cu, setCu] = useState<Record<string, string>>({})       // تعدادِ واحدِ مشارکت (ورودی)
  const [nego, setNego] = useState<Record<string, any>>({})   // نتیجهٔ مذاکره به‌ازای هر آگهی
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
    const wait = Math.max(0, 3000 - (Date.now() - t0))
    setTimeout(() => { if (d?.opportunities?.length) { setOpps(d.opportunities); setStep('opps') } else { setErr(d ? 'فعلاً آگهیِ قیمت‌دارِ مناسبی در بازار نیست — به‌محضِ ورودِ فرصتِ تازه همین‌جا می‌بینی' : (err || 'ارتباط با بازار برقرار نشد — دوباره تلاش کن')); setStep(st?.empire ? 'dash' : 'pitch') } }, wait)
  }
  async function doBuy(o: Opp, negotiated = false) {
    setStep('buying'); setOwned(o)
    const texts = ['در حال بررسی سند...', 'در حال بررسی ارزش...', 'در حال تحلیل بازار...', '✍️ امضای قرارداد']
    for (let i = 0; i < texts.length; i++) { setBuyTxt(texts[i]); await new Promise(r => setTimeout(r, 900)) }
    const d = await api({ action: 'buy', listingId: o.id, negotiated })
    if (d) { setSt(d); setStep('owned') } else setStep('opps')
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
  async function doClaim(key: string) { const d = await api({ action: 'claim', key }); if (d) setSt(d) }
  async function doSell(a: any) {
    if (!confirm(`«${a.title.slice(0, 40)}» به قیمتِ روزِ ${faB(a.current || a.buyPrice)} تومان فروخته شود؟`)) return
    const d = await api({ action: 'sell', assetId: a.id })
    if (d) setSt(d)
  }
  async function doChest() { const d = await api({ action: 'chest' }); if (d) { setChestReward(d.reward); load() } }
  async function doBoards() { const d = await api({ action: 'boards' }); if (d) setBoards(d) }
  async function doMarket() { const d = await api({ action: 'market' }); if (d) setMkt(d) }
  // معاملهٔ بازار سرمایه: بعد از موفقیت، هم وضعیتِ کلی و هم نمای بازار تازه می‌شود.
  async function doTrade(body: any, clear?: () => void) {
    const d = await api(body)
    if (d) { setSt(d); clear?.(); doMarket() }
  }

  // ══════════ رندر ══════════
  const wrap = (children: React.ReactNode) => (
    <main dir="rtl" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🏛 امپراتوریِ من</h1>
        <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>← بازگشت به ملک‌جت</Link>
      </div>
      {err && <div style={{ ...card, borderColor: '#a33', color: '#e88', fontSize: 13 }}>{err}</div>}
      {children}
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
          {/* مذاکره (GDD جلد۱ مرحلهٔ ۵) — یک‌بار، نتیجه قطعی؛ فرصتِ خارج از بودجه فقط تماشایی است (صادقانه) */}
          {o.locked ? (
            <button style={{ ...btnGhost, padding: '8px 12px', fontSize: 12.5 }} onClick={() => setStep('dash')}>💰 هنوز نمی‌رسد — برو سرمایه بساز</button>
          ) : (<>
            {nego[o.id]
              ? <div style={{ fontSize: 11.5, color: nego[o.id].success ? '#7c6' : 'var(--muted)' }}>{nego[o.id].success ? `🤝 فروشنده ${fa(nego[o.id].discountPct)}٪ تخفیف داد → ${faB(nego[o.id].finalPrice)} تومان` : '🤝 فروشنده کوتاه نیامد — قیمت همان است.'}</div>
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
    {/* سربرگ */}
    <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      <div style={{ fontSize: 30 }}>{e.persona || '🏛'}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{e.name} <span style={{ fontSize: 11, color: 'var(--muted)' }}>#{fa(e.no)}</span></div>
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
      </div>
    </div>

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

    {/* ارزشِ خالص (زنده از بازارِ واقعی) */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>ارزشِ خالص</div><div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)' }}>{faB(st.netWorth || 0)} تومان</div></div>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>سرمایهٔ نقد</div><div style={{ fontSize: 17, fontWeight: 800 }}>{faB(e.capital)} تومان</div></div>
      <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>ارزشِ دارایی‌ها (زنده)</div><div style={{ fontSize: 17, fontWeight: 800 }}>{faB(st.assetsValue || 0)} تومان {st.growth ? <span style={{ fontSize: 12, color: st.growth > 0 ? '#7c6' : '#e88' }}>({st.growth > 0 ? '+' : ''}{st.growth.toLocaleString('fa-IR')}٪)</span> : null}</div></div>
      {(e.realized || 0) !== 0 && <div style={card}><div style={{ fontSize: 11, color: 'var(--muted)' }}>سودِ تحقق‌یافته (فروش‌ها)</div><div style={{ fontSize: 17, fontWeight: 800, color: e.realized > 0 ? '#7c6' : '#e88' }}>{e.realized > 0 ? '+' : '−'}{faB(Math.abs(e.realized))} تومان</div></div>}
    </div>

    {st.suspense && <div style={{ ...card, borderColor: 'var(--gold)', fontSize: 13 }}>⏳ {st.suspense.text}</div>}
    {st.othersBuilding > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>🌍 {fa(st.othersBuilding)} نفرِ دیگر هم همین حالا در حالِ ساختِ امپراتوری‌شان هستند.</div>}

    {/* دارایی‌ها = Empire Map (فهرست) */}
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>🗺 دارایی‌های امپراتوری</div>
      {!e.assets?.length && <div style={{ fontSize: 13, color: 'var(--muted)' }}>هنوز دارایی نداری — <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={doSuggest}>اولین فرصت را ببین</button></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(e.assets || []).map((a: any) => (
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
              : a.kind === 'land' && a.landPlan
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.landPlan === 'build' ? '🏗 در مسیرِ ساخت' : a.landPlan === 'partner' ? '🤝 مشارکت' : '💸 آمادهٔ فروش'}</span>
              : a.kind === 'commercial' && !a.business
              ? <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['کافه', 'رستوران', 'فروشگاه', 'کلینیک', 'دفترِ خدماتی'].map(bz => (
                  <button key={bz} style={{ ...btnGhost, padding: '4px 8px', fontSize: 11 }}
                    onClick={async () => { const d = await api({ action: 'business', assetId: a.id, biz: bz }); if (d) { setSt(d); alert(`احتمالِ موفقیتِ ${bz} در ${a.hood || 'این محله'}: ${fa(d.prob)}٪ (از ${fa(d.signals.hoodListings)} آگهیِ فعال و ${fa(d.signals.competitors)} رقیبِ واقعی)`) } }}>{bz}</button>
                ))}</span>
              : a.business
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>🏪 {a.business} ({fa(a.businessProb || 0)}٪)</span>
              : a.action
              ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.action === 'renovate' ? '🛠 بازسازی' : a.action === 'rent' ? '💰 اجاره' : '📈 نگه‌داری'}</span>
              : <span style={{ display: 'flex', gap: 4 }}>{[['renovate', '🛠'], ['rent', '💰'], ['hold', '📈']].map(([k, i]) => <button key={k} title={k} style={{ ...btnGhost, padding: '4px 8px', fontSize: 13 }} onClick={async () => { const d = await api({ action: 'assetAction', assetId: a.id, act: k }); if (d) setSt(d) }}>{i}</button>)}</span>}
            <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} disabled={busy || e.aiTokens <= 0} onClick={() => doAnalyze(a.listingId)}>تحلیلِ ملک‌جت (۱ ژتون)</button>
            {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, textDecoration: 'none' }}>🔗 آگهیِ واقعی</a>}
            <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, color: '#e88', borderColor: '#644' }} disabled={busy} onClick={() => doSell(a)}>💸 فروش</button>
          </div>
        ))}
      </div>
      {analysis && <div style={{ ...card, background: 'var(--bg2)', marginTop: 10, fontSize: 13 }}>
        <b>🤖 تحلیلِ ملک‌جت — {analysis.hood || 'محله'}:</b> {analysis.verdict}
        {analysis.samples > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>میانگینِ متری هم‌محله‌ها: {faB(analysis.avgPerM)} تومان · این ملک: {faB(analysis.minePerM)} تومان (از {fa(analysis.samples)} آگهیِ واقعی)</div>}
      </div>}
      {e.assets?.length > 0 && <div style={{ marginTop: 10 }}><button style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={doSuggest}>+ فرصتِ بعدی</button></div>}
    </div>

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
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>با اعتبارِ فعلی‌ات تا <b style={{ color: 'var(--gold)' }}>{faB(st.bank.terms.maxLoan)} تومان</b> وام می‌گیری · نرخ {st.bank.terms.ratePctYear.toLocaleString('fa-IR')}٪ سالانه · بازپرداخت تا {fa(st.bank.terms.termDays)} روز. اعتبارِ بالاتر = نرخِ بهتر و سقفِ بیشتر.</div>
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

    {/* بازار سرمایه (جلد ۴۰): صندوقِ شاخصی + مشارکتِ جمعی + شاخص‌ها — همه از بازارِ واقعی */}
    {st.capitalEnabled && <details style={card} onToggle={(ev: any) => { if (ev.currentTarget.open && !mkt) doMarket() }}>
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

    {/* ۵ جدولِ رتبه (فصل ۵) + لیگِ محله (§7.2) */}
    <details style={card} onToggle={(ev: any) => { if (ev.currentTarget.open && !boards) doBoards() }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>🏅 جدول‌های رتبه و لیگِ محله</summary>
      {!boards ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>در حال بارگذاری...</div> : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['score', '👑 امتیازِ امپراتوری'], ['invest', '💎 سرمایه‌گذارِ برتر'], ['growth', '🚀 رشدِ سریع'], ['builder', '🏗 سازنده'], ['explorer', '🧭 کاوشگر']].map(([k, l]) => (
              <button key={k} onClick={() => setBoardTab(k)} style={chip(boardTab === k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(boards.boards[boardTab] || []).map((r: any) => (
              <div key={r.no} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: r.me ? 'rgba(212,175,55,.10)' : 'var(--bg2)', border: r.me ? '1px solid var(--gold)' : '1px solid var(--line)' }}>
                <b style={{ minWidth: 24, color: r.rank <= 3 ? 'var(--gold)' : 'var(--muted)' }}>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : fa(r.rank)}</b>
                <span>{r.persona || '🏛'}</span>
                <span style={{ flex: 1 }}>{r.name}{r.me && <span style={{ fontSize: 10, color: 'var(--gold)' }}> (تو)</span>}</span>
                <b style={{ color: 'var(--gold)', fontSize: 12 }}>{boardTab === 'invest' ? faB(r.value) : boardTab === 'growth' ? `${Number(r.value).toLocaleString('fa-IR')}٪` : fa(r.value)}</b>
              </div>
            ))}
            {!(boards.boards[boardTab] || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز رقابتی شکل نگرفته — تو اولین باش!</div>}
          </div>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>🏅 نشان‌ها:</span>
        {(e.badges || []).map((bd: string) => <span key={bd} style={{ ...card, padding: '4px 10px', fontSize: 12, background: 'var(--bg2)' }}>{bd}</span>)}
        {st.hiddenLeft > 0 && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>🎖 {fa(st.hiddenLeft)} مأموریتِ مخفی در انتظارِ کشف...</span>}
        <span style={{ flex: 1 }} />
        <button style={{ ...btnGhost, fontSize: 12, padding: '6px 12px' }} onClick={async () => { const n = prompt('نامِ جدیدِ امپراتوری:', e.name); if (n != null) { const d = await api({ action: 'rename', name: n }); if (d) load() } }}>تغییرِ نام</button>
      </div>
    </div>
  </>)
}
