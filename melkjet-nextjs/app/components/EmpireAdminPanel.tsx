'use client'
// Empire Control Center (GDD جلد ۹) — مرکزِ فرماندهیِ بازی داخلِ سوپرادمین، با منو و زیربخش‌های مستقل:
// نمای کلی · بازیکنان · اقتصاد و ارزها · مأموریت‌ها و پاداش · دنیا و بازارِ واقعی · LiveOps · دسترسی.
// همهٔ اعداد واقعی‌اند (از store بازیکنان + بازارِ زنده)؛ همهٔ تنظیمات مستقیم روی موتورِ زنده اعمال می‌شوند.
import { useCallback, useEffect, useState } from 'react'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : n >= 1e6 ? `${fa(Math.round(n / 1e6))} میلیون` : fa(Math.round(n))
const faDate = (t: number) => t ? new Date(t).toLocaleDateString('fa-IR') : '—'
// قانونِ digitsOf (تراکر §۱۰): رقمِ فارسی/عربی → لاتین، ٫ → نقطه، جداکنندهٔ هزارگان حذف — تا «۲۵» یا «۱٫۵» در knobها NaN نشود.
const deFa = (s: string) => {
  let t = s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.').replace(/[٬,\s]/g, '')
  if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '')   // چند نقطه = جداکنندهٔ هزارگان
  return t
}
const numOf = (v: string) => Number(deFa(v))
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }
const sub: React.CSSProperties = { fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }
const btn: React.CSSProperties = { background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 9, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5 }
const inpS: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12.5 }

export type EmpireSection = 'overview' | 'players' | 'economy' | 'capital' | 'missions' | 'engage' | 'world' | 'liveops' | 'access'

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--gold)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

export default function EmpireAdminPanel({ section }: { section: EmpireSection }) {
  const [data, setData] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const [sel, setSel] = useState<any>(null)      // پروندهٔ بازِ یک بازیکن
  const [cfg, setCfg] = useState<any>(null)      // بخشِ empire از کانفیگ
  const [flag, setFlag] = useState<any>(null)
  const [adj, setAdj] = useState({ coins: '', xp: '', capital: '', aiTokens: '', reason: '' })
  const [fnd, setFnd] = useState({ name: '', seg: '', fee: '2' })   // فرمِ ساختِ صندوقِ جدید (جلد ۴۰)

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const loadView = useCallback((v: string, extra = '') =>
    fetch(`/api/admin/empire?view=${v}${extra}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null), [])
  const loadCfg = useCallback(() => fetch('/api/reos/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(d.config?.empire || null) }), [])
  const loadFlag = useCallback(() => fetch('/api/reos/flags', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setFlag((d.flags || []).find((f: any) => f.key === 'empire') || null) }), [])

  useEffect(() => {
    // پاسخِ دیرآمدهٔ بخشِ قبلی نباید در بخشِ فعلی بنشیند (روی دادهٔ بزرگِ پروداکشن،
    // overview چند ثانیه طول می‌کشد؛ جابه‌جاییِ سریعِ منو → دادهٔ اشتباه → کرشِ رندر).
    let alive = true
    const put = (d: any) => { if (alive) setData(d) }
    setData(null); setSel(null)
    if (section === 'overview') loadView('overview').then(put)
    if (section === 'players') loadView('players', `&sort=${sort}`).then(put)
    if (section === 'world') loadView('world').then(put)
    if (section === 'liveops') { loadView('liveops').then(put); loadCfg() }
    if (section === 'economy' || section === 'missions') { loadCfg(); loadView('overview').then(put) }
    if (section === 'capital') { loadView('capital').then(put); loadCfg() }
    if (section === 'engage') loadView('engage').then(put)
    if (section === 'access') loadFlag()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, sort])

  const saveCfg = async () => {
    setBusy('cfg')
    const d = await fetch('/api/reos/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: { empire: cfg } }) }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.ok ? 'ذخیره شد ✓ — همین حالا روی موتورِ زندهٔ بازی اعمال شد' : 'خطا در ذخیره')
  }
  const setC = (key: string, val: string, sk?: string) => setCfg((c: any) => {
    if (!c) return c
    const n = JSON.parse(JSON.stringify(c))
    const dv = deFa(val)
    const num = val === '' ? '' : (dv !== '' && !isNaN(Number(dv)) ? Number(dv) : val)
    if (sk) n[key][sk] = num; else n[key] = num
    return n
  })
  const cin = (key: string, sk?: string, w = 110) => {
    const v = cfg ? (sk ? cfg[key]?.[sk] : cfg[key]) : ''
    return <input value={String(v ?? '')} onChange={e => setC(key, e.target.value, sk)} style={{ ...inpS, width: w, textAlign: 'center' }} />
  }
  const row = (label: string, el: React.ReactNode, hint?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ flex: 1, fontSize: 12.5 }}>{label}{hint && <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{hint}</div>}</span>{el}
    </div>
  )
  const post = async (body: any, okMsg: string) => {
    setBusy(body.action)
    const d = await fetch('/api/admin/empire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.ok ? okMsg : d?.error || 'خطا')
    return d?.ok
  }
  const openPlayer = async (userId: string) => { const d = await loadView('player', `&id=${encodeURIComponent(userId)}`); if (d) setSel(d) }

  const head = (title: string, desc: string) => (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{desc}</div>
      {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gold)' }}>{msg}</div>}
    </div>
  )
  const loading = <div style={{ ...card, color: 'var(--muted)', textAlign: 'center', padding: 30 }}>در حال بارگذاری…</div>

  /* ══════════ 📊 نمای کلی ══════════ */
  if (section === 'overview') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('🏛 مرکزِ فرماندهیِ امپراتوری', 'وضعیتِ زندهٔ کلِ بازی — همهٔ اعداد از دادهٔ واقعیِ بازیکنان و بازار.')}
      {!data?.totals ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <Mini label="امپراتوری‌ها" value={fa(data.empires)} hint={`${fa(data.newToday)} تولدِ امروز`} />
          <Mini label="فعالِ امروز" value={fa(data.activeToday)} hint={`${fa(data.active7d)} فعالِ ۷ روز`} />
          <Mini label="ارزشِ کلِ اکوسیستم" value={`${faB(data.totals.netWorth)} ت`} hint="نقد + داراییِ زنده" />
          <Mini label="سرمایهٔ نقدِ در گردش" value={`${faB(data.totals.capital)} ت`} />
          <Mini label="ملک‌کوینِ عرضه‌شده" value={fa(data.totals.coins)} hint="Coin Supply" />
          <Mini label="دارایی‌ها (آگهیِ واقعی)" value={fa(data.totals.assets)} />
          <Mini label="سودِ تحقق‌یافتهٔ کل" value={`${faB(data.totals.realized)} ت`} hint="از فروش‌ها" />
          <Mini label="درآمدِ اجاره/کسب‌وکار" value={`${faB(data.totals.incomes)} ت`} />
          <Mini label="بدهیِ بانکیِ کل" value={`${faB(data.totals.debt || 0)} ت`} hint="ماندهٔ وام‌های فعال" />
          <Mini label="خزانه (مالیاتِ جمع‌شده)" value={`${faB(data.totals.treasury || 0)} ت`} hint="مالیاتِ نقل‌وانتقال" />
          <Mini label="میانگینِ Empire Score" value={fa(data.avgScore)} />
          <Mini label="نامهٔ امروز" value={`${fa(data.briefs.built)} / ${fa(data.briefs.opened)}`} hint="ساخته / بازشده" />
        </div>
        <div style={card}>
          <div style={sub}>توزیعِ مراحلِ بازیکنان (GDD جلد ۳)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(data.stageDist as Record<string, number>).map(([s, n]) => (
              <span key={s} style={{ background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 14px', fontSize: 12.5 }}>{s}: <b style={{ color: 'var(--gold)' }}>{fa(n)}</b></span>
            ))}
            {!Object.keys(data.stageDist).length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز بازیکنی نیست.</span>}
          </div>
        </div>
        <div style={card}>
          <div style={sub}>تازه‌ترین امپراتوری‌ها</div>
          {data.recent.map((r: any) => (
            <div key={r.no} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
              <span>{r.persona || '🏛'}</span><b style={{ minWidth: 140 }}>{r.name}</b>
              <span style={{ color: 'var(--muted)' }}>#{fa(r.no)} · {r.stage} · {fa(r.assets)} دارایی</span>
              <span style={{ flex: 1 }} /><span style={{ color: 'var(--faint)', fontSize: 11 }}>{faDate(r.createdAt)}</span>
            </div>
          ))}
          {!data.recent.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>}
        </div>
      </>}
    </div>
  )

  /* ══════════ 👥 بازیکنان (Player Command Center) ══════════ */
  if (section === 'players') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('👥 بازیکنان و امپراتوری‌ها', 'جستجو، پروندهٔ کامل (Ghost Mode)، هدیه/جبرانِ منابع و حذف — هر تغییری در تایم‌لاینِ خودِ بازیکن هم شفاف ثبت می‌شود.')}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadView('players', `&q=${encodeURIComponent(q)}&sort=${sort}`).then(setData) }} placeholder="نام / شماره / #شمارهٔ تولد" style={{ ...inpS, flex: 1, minWidth: 200 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} style={inpS as any}>
          <option value="new">تازه‌ترین</option><option value="active">فعال‌ترین</option><option value="score">بیشترین امتیاز</option><option value="netWorth">ثروتمندترین</option>
        </select>
        <button style={btn} onClick={() => loadView('players', `&q=${encodeURIComponent(q)}&sort=${sort}`).then(setData)}>جستجو</button>
      </div>
      {!data?.rows ? loading : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ color: 'var(--muted)', fontSize: 11.5 }}>
              {['بازیکن', 'مرحله', 'دارایی', 'سرمایهٔ نقد', 'ارزشِ خالص', '🪙', '⚡', '🏆', 'تولد', 'آخرین فعالیت', ''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.no} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '9px 12px' }}>{r.persona || '🏛'} <b>{r.name}</b> <span style={{ color: 'var(--faint)', fontSize: 11 }}>#{fa(r.no)} · {r.userId}</span></td>
                  <td style={{ padding: '9px 12px' }}>{r.stage} <span style={{ color: 'var(--faint)' }}>({fa(r.level)})</span></td>
                  <td style={{ padding: '9px 12px' }}>{fa(r.assets)}</td>
                  <td style={{ padding: '9px 12px' }}>{faB(r.capital)}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--gold)', fontWeight: 700 }}>{faB(r.netWorth)}</td>
                  <td style={{ padding: '9px 12px' }}>{fa(r.coins)}</td>
                  <td style={{ padding: '9px 12px' }}>{fa(r.xp)}</td>
                  <td style={{ padding: '9px 12px' }}>{fa(r.score)}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--faint)', fontSize: 11 }}>{faDate(r.createdAt)}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--faint)', fontSize: 11 }}>{faDate(r.updatedAt)}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5 }} onClick={() => openPlayer(r.userId)}>👁 پرونده</button>
                  </td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>بازیکنی یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {/* پروندهٔ بازیکن (Ghost Mode) */}
      {sel && <div style={{ ...card, borderColor: 'var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>{sel.empire.persona || '🏛'}</span>
          <b style={{ fontSize: 15 }}>{sel.empire.name}</b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>#{fa(sel.empire.no)} · {sel.empire.userId} · {sel.level.titleFa} (سطح {fa(sel.level.level)}) · {sel.empire.profile?.title} · DNA: {sel.empire.dna}</span>
          <button style={{ ...btnGhost, fontSize: 11.5, padding: '4px 10px' }} disabled={busy === 'rename'} onClick={async () => {
            const name = prompt('نامِ جدیدِ این امپراتوری:', sel.empire.name)
            if (!name || name.trim() === sel.empire.name) return
            if (await post({ action: 'rename', userId: sel.empire.userId, name: name.trim() }, 'نام عوض شد ✓')) openPlayer(sel.empire.userId)
          }}>✏️ ویرایشِ نام</button>
          <span style={{ flex: 1 }} />
          <button style={{ ...btnGhost, fontSize: 11.5, padding: '4px 10px' }} onClick={() => setSel(null)}>✕ بستن</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, margin: '12px 0' }}>
          <Mini label="سرمایهٔ نقد" value={`${faB(sel.row.capital)} ت`} />
          <Mini label="ارزشِ خالص" value={`${faB(sel.row.netWorth)} ت`} />
          <Mini label="🪙 / ⚡ / 🤖" value={`${fa(sel.row.coins)} / ${fa(sel.row.xp)} / ${fa(sel.row.aiTokens)}`} />
          <Mini label="حدسِ قیمت" value={`${fa(sel.empire.guess.correct)}/${fa(sel.empire.guess.tries)}`} hint="درست/کل" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          <div>
            <div style={sub}>دارایی‌ها ({fa(sel.empire.assets.length)})</div>
            {sel.empire.assets.map((a: any) => (
              <div key={a.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                {a.kind === 'land' ? '🏞' : a.kind === 'villa' ? '🏡' : a.kind === 'commercial' ? '🏬' : '🏢'} {a.title.slice(0, 45)}
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>{a.hood} · خرید {faB(a.buyPrice)} · روز {faB(a.current)}{a.business ? ` · 🏪 ${a.business}` : ''}{a.income ? ` · درآمد ${faB(a.income)}` : ''}</div>
              </div>
            ))}
            {!sel.empire.assets.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>}
          </div>
          <div>
            <div style={sub}>تایم‌لاین (آخرین ۱۰)</div>
            {[...sel.empire.timeline].reverse().slice(0, 10).map((t: any, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>{t.icon} <b>{t.title}</b> <span style={{ color: 'var(--muted)' }}>{t.detail || ''}</span> <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>· {faDate(t.at)}</span></div>
            ))}
          </div>
          <div>
            <div style={sub}>🎁 هدیه / جبرانِ منابع</div>
            {[['coins', 'ملک‌کوین'], ['xp', 'XP'], ['capital', 'سرمایه (تومان)'], ['aiTokens', 'ژتونِ AI']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, flex: 1 }}>{l}</span>
                <input value={(adj as any)[k]} onChange={e => setAdj({ ...adj, [k]: e.target.value })} placeholder="±" inputMode="numeric" style={{ ...inpS, width: 120, textAlign: 'center' }} />
              </div>
            ))}
            <input value={adj.reason} onChange={e => setAdj({ ...adj, reason: e.target.value })} placeholder="دلیل (در تایم‌لاینِ بازیکن ثبت می‌شود)" style={{ ...inpS, width: '100%', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy === 'adjust'} onClick={async () => {
                if (await post({ action: 'adjust', userId: sel.empire.userId, coins: numOf(adj.coins) || 0, xp: numOf(adj.xp) || 0, capital: numOf(adj.capital) || 0, aiTokens: numOf(adj.aiTokens) || 0, reason: adj.reason }, 'اعمال شد ✓')) { setAdj({ coins: '', xp: '', capital: '', aiTokens: '', reason: '' }); openPlayer(sel.empire.userId) }
              }}>اعمال</button>
              <button style={{ ...btnGhost, color: '#e88', borderColor: '#644' }} disabled={busy === 'delete'} onClick={async () => {
                if (!confirm(`امپراتوریِ «${sel.empire.name}» برای همیشه حذف شود؟ برگشت‌ناپذیر است.`)) return
                if (await post({ action: 'delete', userId: sel.empire.userId }, 'حذف شد')) { setSel(null); loadView('players', `&sort=${sort}`).then(setData) }
              }}>🗑 حذفِ امپراتوری</button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  )

  /* ══════════ 💰 اقتصاد و ارزها (Economy Command Center) ══════════ */
  if (section === 'economy') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('💰 اقتصاد و ارزها', 'رئیسِ بانکِ مرکزیِ دنیای ملک‌جت — عرضهٔ پول، بستهٔ خوش‌آمد، درآمد و هزینهٔ مالکیت. تغییرات بلافاصله روی موتورِ زنده اعمال می‌شوند.')}
      {data && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <Mini label="ملک‌کوینِ در گردش" value={fa(data.totals?.coins || 0)} hint="Coin Supply" />
        <Mini label="سرمایهٔ نقدِ بازیکنان" value={`${faB(data.totals?.capital || 0)} ت`} />
        <Mini label="ارزشِ کلِ دارایی‌ها" value={`${faB((data.totals?.netWorth || 0) - (data.totals?.capital || 0))} ت`} hint="از بازارِ واقعی" />
        <Mini label="سودِ تحقق‌یافته" value={`${faB(data.totals?.realized || 0)} ت`} />
        <Mini label="درآمدِ پرداخت‌شده" value={`${faB(data.totals?.incomes || 0)} ت`} hint="اجاره/کسب‌وکار" />
      </div>}
      {!cfg ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          <div style={card}>
            <div style={sub}>🎁 بستهٔ خوش‌آمد (تولدِ امپراتوری)</div>
            {row('سرمایهٔ هدیه (تومان)', cin('giftToman'), 'قدرتِ خریدِ شبیه‌سازی — دارایی = آگهیِ واقعی')}
            {row('ملک‌کوینِ شروع', cin('welcomeCoins'))}
            {row('XP شروع', cin('welcomeXp'))}
            {row('ژتونِ تحلیلِ AI', cin('welcomeAiTokens'))}
          </div>
          <div style={card}>
            <div style={sub}>📈 منحنیِ سطح و رشد</div>
            {row('پایهٔ منحنی (XP)', cin('levelCurve', 'base'), 'XP لازمِ سطحِ L = پایه × (L-1)^تندی')}
            {row('تندیِ منحنی', cin('levelCurve', 'exp'))}
            {row('XP فروشِ سودده', cin('sellProfitXp'))}
            {row('کوینِ پاداشِ هر سطح', cin('levelUpCoins'), 'سند ۱۶ — Level Up باید حس شود')}
          </div>
          <div style={card}>
            <div style={sub}>🏞 سیستمِ زمین (برآوردهای شفاف)</div>
            {row('سودِ مسیرِ ساخت (٪)', cin('land', 'buildGainPct'))}
            {row('سودِ مشارکت (٪)', cin('land', 'partnerGainPct'))}
            {row('مدتِ ساخت (ماه)', cin('land', 'buildMonths'))}
          </div>
          <div style={card}>
            <div style={sub}>♻️ گردشِ اقتصاد (ضدِ احتکار)</div>
            {row('درآمدِ اجاره (۱/۰)', cin('rentIncome'), 'از میانهٔ اجارهٔ واقعیِ هم‌محله‌ها')}
            {row('هزینهٔ مالکیت (٪ سالانه)', cin('maintenancePctYear'), 'نگهداری/مالیات — پول در گردش می‌ماند')}
            {row('مالیاتِ نقل‌وانتقال (٪)', cin('transferTaxPct'), 'روی خرید و فروش → خزانهٔ بازی')}
          </div>
          <div style={card}>
            <div style={sub}>🎲 کوئست و دعوت</div>
            {row('XP کوئستِ روزانه', cin('quests', 'dailyXp'))}
            {row('کوینِ کوئستِ روزانه', cin('quests', 'dailyCoins'))}
            {row('XP کوئستِ هفتگی', cin('quests', 'weeklyXp'))}
            {row('کوینِ کوئستِ هفتگی', cin('quests', 'weeklyCoins'))}
            {row('کوینِ دعوتِ شراکتی (هر طرف)', cin('referralCoins'), '§7.4 — دعوت‌شده و دعوت‌کننده هر دو')}
          </div>
          <div style={card}>
            <div style={sub}>🏗 شرکتِ ساختمانی و پروانه (جلد ۶۱/۶۳)</div>
            {row('ثبتِ شرکت فعال (۱/۰)', cin('company', 'enabled'))}
            {row('هزینهٔ ثبتِ شرکت (تومان)', cin('company', 'regFee', 140), '→ خزانه')}
            {row('پایهٔ حقوقِ مهندس (تومان/ماه)', cin('company', 'engineerSalaryBase', 140), 'حقوق = پایه × (۰٫۶ + مهارت/۱۰۰)')}
            {row('سقفِ تیمِ مهندسی', cin('company', 'maxEngineers'))}
            {(['baseDays', 'extraDaysMax', 'feePct', 'objectionPct', 'engineerSpeedupDays'] as const).map(k => {
              const labels: Record<string, [string, string?]> = { baseDays: ['پروانه: حداقلِ بررسی (روز)'], extraDaysMax: ['پروانه: حداکثر روزِ اضافه (هش)'], feePct: ['پروانه: عوارض (٪ ارزشِ زمین)', '→ خزانه'], objectionPct: ['پروانه: احتمالِ اعتراض (٪)'], engineerSpeedupDays: ['پروانه: تسریعِ مهندسِ ماهر (روز)', 'مهارتِ تیم ≥۶۰'] }
              const v = cfg?.company?.permit?.[k]
              return row(labels[k][0], <input key={k} value={String(v ?? '')} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.company = n.company || {}; n.company.permit = n.company.permit || {}; n.company.permit[k] = ev.target.value === '' ? '' : numOf(ev.target.value); return n })} style={{ ...inpS, width: 110, textAlign: 'center' }} />, labels[k][1])
            })}
          </div>
          <div style={card}>
            <div style={sub}>⛏ موتورِ ساخت (جلد ۶۴–۷۲)</div>
            {row('ساخت فعال (۱/۰)', cin('build', 'enabled'))}
            {row('تراکمِ ساخت (بنا ÷ زمین)', cin('build', 'buildFactor'), 'مثلاً ۲٫۲ = ۲۲۰٪')}
            {row('متراژِ هر واحد (متر)', cin('build', 'unitArea'))}
            {row('هزینهٔ ساختِ هر متر (تومان)', cin('build', 'costPerM', 140), 'روزشمار از نقد کم می‌شود')}
            {row('مدتِ ساختِ پایه (روز)', cin('build', 'buildDays'), 'بتنی ×۱ · فلزی ×۰٫۷۵ · ترکیبی ×۰٫۹')}
            {row('شروعِ پیش‌فروش از (٪ پیشرفت)', cin('build', 'presaleMinPct'))}
            {row('سقفِ پیش‌فروش (٪ واحدها)', cin('build', 'presaleMaxPct'))}
            {row('تخفیفِ پیش‌فروش (٪)', cin('build', 'presaleDiscountPct'), 'قیمت از میانهٔ متریِ واقعیِ محله')}
          </div>
          <div style={card}>
            <div style={sub}>🎯 گیم‌پلی پروژه (GDD فصل ۴)</div>
            {row('هدفِ «فروشِ سریع»: قیمت (٪ میانه)', cin('build', 'goalFastPricePct'), 'ارزان‌تر → نقدینگیِ سریع‌تر')}
            {row('هدفِ «فروشِ سریع»: سقفِ پیش‌فروش (+٪)', cin('build', 'goalFastPresaleBonusPp'))}
            {row('هدفِ «اعتبارِ برند»: قیمت (٪ میانه)', cin('build', 'goalRepPricePct'))}
            {row('هدفِ «اعتبار»: امتیازِ هر تحویل', cin('build', 'repProjectScore'), 'در اعتبارِ ستاره‌ایِ شرکت')}
            {row('فروشِ عمده: واحدهای بدونِ تخفیف', cin('build', 'bulkFreeUnits'), 'اشباعِ عرضهٔ خودِ بازیکن')}
            {row('فروشِ عمده: افتِ هر واحدِ اضافه (٪)', cin('build', 'bulkStepPct'), 'کفِ قیمت ۸۰٪')}
            {row('تیمِ ماهر: کاهشِ هزینهٔ رویداد (٪)', cin('build', 'eventSkillCutPct'), 'مهارتِ تیم ≥۵۰ — روی کارتِ استخدام هم نوشته می‌شود')}
            {([['pool', 'استخر و سونا'], ['roof', 'روف‌گاردن'], ['gym', 'باشگاهِ ورزشی'], ['parking', 'پارکینگِ اضافه']] as const).map(([k, lbl]) => {
              const am = cfg?.build?.amenities?.[k] || {}
              const set = (field: 'costPct' | 'valuePct', val: string) => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.build = n.build || {}; n.build.amenities = n.build.amenities || {}; n.build.amenities[k] = n.build.amenities[k] || {}; n.build.amenities[k][field] = val === '' ? '' : numOf(val); return n })
              return row(`امکانات: ${lbl}`, <span key={k} style={{ display: 'flex', gap: 6 }}>
                <input title="هزینه (٪ کلِ پروژه)" value={String(am.costPct ?? '')} onChange={ev => set('costPct', ev.target.value)} style={{ ...inpS, width: 52, textAlign: 'center' }} />
                <input title="ارزش (+٪ قیمتِ واحد)" value={String(am.valuePct ?? '')} onChange={ev => set('valuePct', ev.target.value)} style={{ ...inpS, width: 52, textAlign: 'center' }} />
              </span>, 'هزینه ٪ کلِ پروژه · ارزش +٪ قیمتِ واحد')
            })}
          </div>
          <div style={card}>
            <div style={sub}>📈 سطح‌گشایی و ظرفیت (سند ۱۵ — Progression)</div>
            {row('بازارِ سرمایه از سطح', cin('unlocks', 'capitalLevel'), '«امکانات باز می‌شوند، نه اعداد»')}
            {row('شرکتِ ساختمانی از سطح', cin('unlocks', 'companyLevel'))}
            {row('سرمایه‌گذاریِ جمعی از سطح', cin('unlocks', 'crowdLevel'))}
            {row('ظرفیتِ پایهٔ پروژهٔ همزمان', cin('unlocks', 'projectsBase'), 'ظرفیت = پایه + سطح ÷ گام')}
            {row('گامِ رشدِ ظرفیت (هر چند سطح +۱)', cin('unlocks', 'projectsPerLevels'))}
            {row('خروج از پروژهٔ نیمه‌کاره (٪ بهای تمام‌شده)', cin('unlocks', 'projectExitPct'), 'با پیش‌فروشِ فعال ممنوع؛ مالیات → خزانه')}
          </div>
          <div style={card}>
            <div style={sub}>🏛 نقش‌های حرفه‌ای (فاز ۲۹ — سیستم بازی می‌کند تا متخصصِ واقعی بیاید)</div>
            {row('دفترخانه: حق‌الثبتِ خرید (٪ قیمت)', cin('pros', 'notaryFeePct'))}
            {row('مشاور: کمیسیونِ اجاره (٪ یک ماه)', cin('pros', 'advisorRentCommissionPct'), 'عرفِ واقعی ~۲۵٪')}
            {row('مشاور: کمیسیونِ فروش (٪ قیمت)', cin('pros', 'advisorSellCommissionPct'))}
            {row('وکیلِ ماده۱۰۰: حق‌الوکاله (٪ جریمه)', cin('pros', 'lawyerFeePct'))}
            {row('وکیل: کاهشِ جریمه اگر برنده شد (٪)', cin('pros', 'lawyerCutPct'))}
            {row('وکیل: شانسِ موفقیت (٪)', cin('pros', 'lawyerWinChancePct'), 'قطعی از هش — یک‌بار برای هر پرونده')}
            {row('کارشناسِ رسمیِ وام (تومان)', cin('pros', 'appraisalFee', 130), 'از مبلغِ وام کسر می‌شود')}
          </div>
          <div style={card}>
            <div style={sub}>📐 طراحیِ معمار و تراکم (فاز ۲۹)</div>
            {row('طراحی پیش از پروانه فعال (۱/۰)', cin('design', 'enabled'), 'معمار → نقشه → پروانه → پیمانکار/کلنگ')}
            {row('سطحِ اشغالِ زمین (٪)', cin('design', 'occupancyPct'), 'هر طبقه = زمین × این')}
            {row('حداکثر طبقهٔ مازادِ قابل‌انتخاب', cin('design', 'maxOverFloors'), 'تخلفِ آگاهانه → ماده۱۰۰')}
            {row('مدتِ طراحی (روز)', cin('design', 'designDays'), 'قابلِ‌تسریع با کوین')}
            {row('حق‌الزحمهٔ معمار (٪ هزینهٔ ساخت)', cin('design', 'architectFeePct'))}
            {row('حداقل متراژِ قانونیِ واحد', cin('design', 'minUnitArea'))}
            {row('ماده۱۰۰: جریمهٔ هر مترِ مازاد (× هزینهٔ ساختِ متر)', cin('m100', 'finePerM2Mult'), 'جریمه → خزانه (شهرداری)')}
          </div>
          <div style={card}>
            <div style={sub}>🛠 بازسازی (فاز ۲۹)</div>
            {row('بازسازی فعال (۱/۰)', cin('renovation', 'enabled'))}
            {row('سقفِ ارزش‌افزوده (٪)', cin('renovation', 'maxBoostPct'))}
            {([['kitchen', 'آشپزخانه و سرویس‌ها'], ['facade', 'نمای ساختمان'], ['full', 'بازسازیِ کامل']] as const).map(([k, lbl]) => {
              const ro = cfg?.renovation?.options?.[k] || {}
              const set = (field: 'costPct' | 'valuePct', val: string) => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.renovation = n.renovation || { options: {} }; n.renovation.options = n.renovation.options || {}; n.renovation.options[k] = n.renovation.options[k] || {}; n.renovation.options[k][field] = val === '' ? '' : numOf(val); return n })
              return row(`گزینه: ${lbl}`, <span key={k} style={{ display: 'flex', gap: 6 }}>
                <input title="هزینه (٪ ارزشِ روز)" value={String(ro.costPct ?? '')} onChange={ev => set('costPct', ev.target.value)} style={{ ...inpS, width: 52, textAlign: 'center' }} />
                <input title="ارزش‌افزوده (+٪)" value={String(ro.valuePct ?? '')} onChange={ev => set('valuePct', ev.target.value)} style={{ ...inpS, width: 52, textAlign: 'center' }} />
              </span>, 'هزینه ٪ ارزش · ارزش‌افزوده +٪')
            })}
          </div>
          <div style={card}>
            <div style={sub}>🔊 صدا (فاز ۳۲ — سند ۲۱ فصل Audio)</div>
            {row('بازخوردِ صوتی فعال (۱/۰)', cin('sound', 'enabled'), 'سنتزِ WebAudio — بدونِ فایل؛ کاربر هم در HUD خاموش/حجم دارد')}
          </div>
          <div style={card}>
            <div style={sub}>⚡ سرعت و زمان (فاز ۲۷ — «پرداخت فقط برای سرعت»)</div>
            {row('زمان‌خری فعال (۱/۰)', cin('speed', 'enabled'), 'کوین فقط انتظار را کوتاه می‌کند، نه نتیجه را')}
            {row('پیگیریِ پروانه (کوین/روز)', cin('speed', 'permitCoinsPerDay'), 'هر روز کوتاه‌شدنِ بررسی')}
            {row('شیفتِ شبانهٔ کارگاه (کوین/روز)', cin('speed', 'buildCoinsPerDay'), 'هزینهٔ تومانیِ روز سرِ جایش می‌ماند + از رویدادها رد نمی‌شود')}
          </div>
          <div style={card}>
            <div style={sub}>🪙 فروشگاهِ ملک‌کوین (فاز ۲۸ — زرین‌پال؛ کوین هرگز قدرت نمی‌خرد)</div>
            {row('فروشگاه فعال (۱/۰)', cin('coinShop', 'enabled'), 'درگاه از «اتصال‌ها → زرین‌پال» تنظیم می‌شود')}
            {(cfg?.coinShop?.packs || []).map((p: any, i: number) => (
              <div key={p.id || i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <input value={p.label || ''} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs[i].label = ev.target.value.slice(0, 40); return n })} placeholder="نامِ بسته" style={{ ...inpS, flex: 1, minWidth: 120 }} />
                <input title="کوین" value={String(p.coins ?? '')} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs[i].coins = numOf(ev.target.value) || 0; return n })} style={{ ...inpS, width: 76, textAlign: 'center' }} />
                <input title="قیمت (تومان)" value={String(p.priceToman ?? '')} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs[i].priceToman = numOf(ev.target.value) || 0; return n })} style={{ ...inpS, width: 110, textAlign: 'center' }} />
                <input title="پایانِ بستهٔ زمان‌دار (YYYY-MM-DD میلادی؛ خالی = دائمی)" value={p.until || ''} placeholder="تا تاریخ" dir="ltr"
                  onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs[i].until = deFa(ev.target.value).replace(/[^\d-]/g, '').slice(0, 10); return n })} style={{ ...inpS, width: 100, textAlign: 'center' }} />
                <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5, color: p.enabled ? '#7c6' : 'var(--faint)' }}
                  onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs[i].enabled = !n.coinShop.packs[i].enabled; return n })}>{p.enabled ? 'فعال ✓' : 'خاموش'}</button>
                <button style={{ ...btnGhost, padding: '4px 8px', fontSize: 11.5, color: '#e88', borderColor: '#644' }}
                  onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop.packs.splice(i, 1); return n })}>🗑</button>
              </div>
            ))}
            <button style={{ ...btnGhost, padding: '6px 14px', fontSize: 12, marginTop: 8 }}
              onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.coinShop = n.coinShop || { enabled: true, packs: [] }; n.coinShop.packs.push({ id: 'p' + Date.now().toString(36), label: 'بستهٔ جدید', coins: 100, priceToman: 100000, enabled: true }); return n })}>+ بستهٔ جدید</button>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>نام · کوین · قیمت (تومان) · تا تاریخ (بستهٔ زمان‌دار — فاز ۳۳؛ خالی = دائمی) — بعد از «ذخیره» بلافاصله در فروشگاهِ بازیکن‌ها اعمال می‌شود. شارژ ایدمپوتنت است (رفرشِ callback دوبار شارژ نمی‌کند)؛ پرداختِ انجام‌شده حتی بعدِ انقضای بسته شارژ می‌شود.</div>
          </div>
          <div style={card}>
            <div style={sub}>🎨 فروشگاهِ ظاهری (فاز ۳۳ — سند ۲۲ فصل ۳: فقط ظاهر، صفر اثرِ اقتصادی)</div>
            {row('فروشگاهِ ظاهری فعال (۱/۰)', cin('cosmetics', 'enabled'), 'قاب/نشان با ملک‌کوین — در لیدربورد و پروفایل دیده می‌شود')}
            {(cfg?.cosmetics?.items || []).map((p: any, i: number) => (
              <div key={p.id || i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <input title="آیکن (اموجی)" value={p.icon || ''} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items[i].icon = ev.target.value.slice(0, 4); return n })} style={{ ...inpS, width: 46, textAlign: 'center' }} />
                <input value={p.label || ''} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items[i].label = ev.target.value.slice(0, 40); return n })} placeholder="نامِ آیتم" style={{ ...inpS, flex: 1, minWidth: 110 }} />
                <select value={p.kind || 'frame'} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items[i].kind = ev.target.value; return n })} style={{ ...inpS, width: 120 }}>
                  <option value="frame">قابِ پروفایل</option><option value="flair">نشانِ کنارِ نام</option>
                </select>
                <input title="قیمت (کوین)" value={String(p.priceCoins ?? '')} onChange={ev => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items[i].priceCoins = numOf(ev.target.value) || 0; return n })} style={{ ...inpS, width: 76, textAlign: 'center' }} />
                <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5, color: p.enabled ? '#7c6' : 'var(--faint)' }}
                  onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items[i].enabled = !n.cosmetics.items[i].enabled; return n })}>{p.enabled ? 'فعال ✓' : 'خاموش'}</button>
                <button style={{ ...btnGhost, padding: '4px 8px', fontSize: 11.5, color: '#e88', borderColor: '#644' }}
                  onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics.items.splice(i, 1); return n })}>🗑</button>
              </div>
            ))}
            <button style={{ ...btnGhost, padding: '6px 14px', fontSize: 12, marginTop: 8 }}
              onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.cosmetics = n.cosmetics || { enabled: true, items: [] }; n.cosmetics.items.push({ id: 'cos' + Date.now().toString(36), label: 'آیتمِ جدید', icon: '⭐', kind: 'frame', priceCoins: 200, enabled: true }); return n })}>+ آیتمِ جدید</button>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>آیکن · نام · نوع · قیمت (کوین) — قانونِ سند ۲۲: هیچ آیتمِ ظاهری روی اقتصاد، سرعتِ ساخت یا قدرتِ رقابتی اثر نمی‌گذارد. آیتمِ خاموش‌شده از دستِ خریدارانِ قبلی درنمی‌آید؛ فقط از فروش می‌افتد.</div>
          </div>
          <div style={card}>
            <div style={sub}>🎁 پیشنهادِ هوشمند (فاز ۳۳ — سند ۲۲ فصل ۹: حداکثر ۱ در روز، قطعی از رفتارِ واقعی)</div>
            {row('پیشنهادها فعال (۱/۰)', cin('offers', 'enabled'), 'کارتِ قابلِ‌بستن بالای صفحهٔ شهر — بدونِ پاپ‌آپ و تایمرِ ساختگی')}
            {row('روزهای پنهان‌ماندن بعدِ بستن', cin('offers', 'cooldownDays'), '«عدمِ نمایشِ مجددِ همان پیشنهاد در مدتِ کوتاه»')}
            {row('حداقل سنِ امپراتوری (روز)', cin('offers', 'minAgeDays'), 'روزهای اول هیچ پیشنهادی نمایش داده نمی‌شود — اول تجربه، بعد فروشگاه')}
          </div>
          <div style={card}>
            <div style={sub}>🛡 فنی (فاز ۳۴ — سند ۲۳ فصل ۱۳)</div>
            {row('سقفِ درخواست در دقیقه (هر بازیکن)', cin('api', 'rateLimitPerMin'), 'سپرِ سوءاستفاده از API مسیرِ رشد — بازیِ عادی به این سقف نمی‌رسد؛ ۰ = خاموش')}
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>Economy QA: هر دیپلوی خودکار knobهای زندهٔ همین صفحه را ممیزی می‌کند (پولِ مجانی/سودِ غیرمنطقی/پاداشِ خارج از تعادل). اجرای دستی روی سرور: <code dir="ltr">node --import ./scripts/reos-loader.mjs scripts/economy-qa.mjs</code></div>
          </div>
          <div style={card}>
            <div style={sub}>🤝 مذاکره (فاز ۲۷ — قبلاً هاردکد بود)</div>
            {row('شانسِ پایه (٪)', cin('nego', 'baseChancePct'), 'شانس = پایه + مهارت ÷ ۲ — قطعی از هش')}
            {row('کفِ تخفیف (٪)', cin('nego', 'discountMin'))}
            {row('سقفِ تخفیف (٪)', cin('nego', 'discountMax'))}
          </div>
          <div style={card}>
            <div style={sub}>🧩 تجمیع و تخریب (فاز ۲۵)</div>
            {row('تجمیع/تخریب فعال (۱/۰)', cin('assembly', 'enabled'), 'خریدِ واحدبه‌واحد → مالکیتِ کامل → تخریب → زمین')}
            {row('حداقلِ واحدهای ساختمان (هش)', cin('assembly', 'unitsMin'), 'وقتی متای «طبقه: X از Y» در آگهی نباشد')}
            {row('حداکثرِ واحدهای ساختمان (هش)', cin('assembly', 'unitsMax'))}
            {row('پرمیومِ هر واحدِ بعدی (٪)', cin('assembly', 'extraUnitPremiumPct'), 'مالک‌ها می‌فهمند دنبالِ تجمیعی')}
            {row('هزینهٔ تخریب (٪ ارزشِ روز)', cin('assembly', 'demolishCostPct'), 'مصرفِ شفافِ پول — demolitionPaid')}
          </div>
          <div style={card}>
            <div style={sub}>🔥 فرصت‌های روزانه و اعتبارِ برند (سند ۱۴)</div>
            {row('فرصت‌های طلاییِ امروز فعال (۱/۰)', cin('deals', 'enabled'), 'Hook — آگهی‌های واقعی + شمارشِ معکوس')}
            {row('تعدادِ فرصت‌های روز', cin('deals', 'count'), 'انتخابِ قطعی از هشِ کاربر+روز')}
            {row('اعتبار: شانسِ مذاکره (+٪ به‌ازای هر ⭐)', cin('reputation', 'negoBonusPerStar'), 'ستاره‌های بالای ۱')}
            {row('اعتبار: کاهشِ نرخِ وام (٪ به‌ازای هر ⭐)', cin('reputation', 'loanRateCutPctPerStar'), 'کفِ نصفِ نرخِ باند')}
          </div>
          <div style={card}>
            <div style={sub}>🏦 بانک و اعتبار (جلد ۱۶)</div>
            {row('بانک فعال (۱/۰)', cin('bank', 'enabled'))}
            {row('سقفِ وام (٪ ارزشِ خالص)', cin('bank', 'maxLoanPctOfNetWorth'), 'باندِ اعتباری روی این سقف ضریب می‌گذارد')}
            {row('نرخِ پایه (٪ سالانه)', cin('bank', 'baseRatePctYear'), 'ممتاز ×۰.۷۵ · معتبر ×۰.۹ · پرریسک ×۱.۴')}
            {row('مهلتِ بازپرداخت (روز)', cin('bank', 'termDays'), 'بعد از سررسید: نرخ ×۱.۵ + ثبتِ دیرکرد')}
            {row('XP تسویهٔ کامل', cin('bank', 'repayXp'))}
          </div>
        </div>
        <div><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره و اعمالِ زنده</button></div>
      </>}
    </div>
  )

  /* ══════════ 📊 کنسولِ سرمایه (جلد ۴۰ فصل ۱۹) ══════════ */
  if (section === 'capital') {
    // تنظیمِ کلیدهای تودرتوی empire.capital (سه سطح) — cin فقط دو سطح را پوشش می‌دهد.
    const setCap = (path: string[], val: string) => setCfg((c: any) => {
      if (!c) return c
      const n = JSON.parse(JSON.stringify(c))
      let o = n.capital = n.capital || {}
      for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {}
      const dv = deFa(val)
      o[path[path.length - 1]] = val === '' ? '' : (dv !== '' && !isNaN(Number(dv)) ? Number(dv) : val)
      return n
    })
    const capIn = (path: string[], w = 110) => {
      let v: any = cfg?.capital
      for (const p of path) v = v?.[p]
      return <input value={String(v ?? '')} onChange={e => setCap(path, e.target.value)} style={{ ...inpS, width: w, textAlign: 'center' }} />
    }
    const reload = () => loadView('capital').then(setData)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
        {head('📊 کنسولِ سرمایه (بازار سرمایه)', 'صندوق‌های شاخصیِ املاک (هر واحد = یک مترِ مجازی از بازارِ واقعی)، سرمایه‌گذاریِ جمعی روی آگهی‌های واقعی، شاخص‌ها و روان‌شناسیِ بازار — همه از دادهٔ زنده.')}
        {!data?.kpis ? loading : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
            <Mini label="ارزشِ کلِ بازار (Market Cap)" value={`${faB(data.kpis.marketCap)} ت`} hint="صندوق‌ها + مشارکت‌ها" />
            <Mini label="داراییِ صندوق‌ها (AUM)" value={`${faB(data.kpis.fundAum)} ت`} />
            <Mini label="سرمایهٔ مشارکت‌ها" value={`${faB(data.kpis.poolsValue)} ت`} />
            <Mini label="سرمایه‌گذارانِ فعال" value={fa(data.kpis.holders)} />
            <Mini label="حجمِ معاملات" value={`${fa(data.kpis.vol.buys)} خرید / ${fa(data.kpis.vol.sells)} فروش`} hint={`${faB(data.kpis.vol.buyToman)} / ${faB(data.kpis.vol.sellToman)} ت`} />
            <Mini label="روان‌شناسیِ بازار" value={`${fa(data.psychology.score)} — ${data.psychology.label}`} hint="از رفتارِ واقعیِ ۱۴ روز" />
            <Mini label="شاخصِ کل (هر متر)" value={data.indices.samples ? `${faB(data.indices.overallPerM)} ت` : '—'} hint={`${fa(data.indices.samples)} نمونهٔ واقعی`} />
            <Mini label="شاخصِ اجاره (هر متر)" value={data.indices.rentSamples ? `${faB(data.indices.rentPerM)} ت` : '—'} hint={`${fa(data.indices.rentSamples)} نمونه`} />
          </div>
          <div style={card}>
            <div style={sub}>🏦 صندوق‌های شاخصیِ املاک (فصل ۸ REIT)</div>
            {data.funds.map((f: any) => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5, flexWrap: 'wrap' }}>
                <b style={{ minWidth: 150 }}>{f.name}</b>
                <span style={{ color: 'var(--muted)' }}>{f.seg || 'کلِ بازار'}</span>
                {f.quote
                  ? <span>واحد <b style={{ color: 'var(--gold)' }}>{faB(f.quote.unit)}</b> · {fa(f.quote.samples)} نمونه · رتبه <b>{f.quote.rating}</b> · بازدهِ اجاره {f.quote.yieldPctYear.toLocaleString('fa-IR')}٪</span>
                  : <span style={{ color: '#e88' }}>نمونهٔ واقعیِ کافی نیست — قابلِ معامله نیست</span>}
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--muted)' }}>AUM {faB(f.aum)} ت · {fa(f.holders)} دارنده · کارمزد {f.feePctYear.toLocaleString('fa-IR')}٪</span>
                <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 11.5 }} disabled={busy === 'fundToggle'} onClick={async () => { if (await post({ action: 'fundToggle', id: f.id, enabled: !f.enabled }, 'اعمال شد ✓')) reload() }}>{f.enabled ? '⏸ غیرفعال' : '▶ فعال'}</button>
                <button style={{ ...btnGhost, color: '#e88', borderColor: '#644', padding: '4px 10px', fontSize: 11.5 }} disabled={busy === 'fundDelete'} onClick={async () => { if (confirm(`صندوقِ «${f.name}» حذف شود؟`) && await post({ action: 'fundDelete', id: f.id }, 'حذف شد')) reload() }}>🗑</button>
              </div>
            ))}
            {!data.funds.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز صندوقی ساخته نشده — از بخش‌های واقعیِ زیر بساز.</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <input value={fnd.name} onChange={e => setFnd({ ...fnd, name: e.target.value })} placeholder="نامِ صندوق (مثلاً صندوقِ املاکِ تهران)" style={{ ...inpS, minWidth: 220 }} />
              <select value={fnd.seg} onChange={e => setFnd({ ...fnd, seg: e.target.value })} style={inpS as any}>
                <option value="">کلِ بازار</option>
                {data.segments.map((s: any) => <option key={s.city} value={s.city}>{s.city} ({fa(s.samples)} نمونه)</option>)}
              </select>
              <input value={fnd.fee} onChange={e => setFnd({ ...fnd, fee: e.target.value })} placeholder="کارمزد ٪" style={{ ...inpS, width: 90, textAlign: 'center' }} />
              <button style={btn} disabled={busy === 'fundCreate'} onClick={async () => {
                if (await post({ action: 'fundCreate', name: fnd.name, seg: fnd.seg, feePctYear: numOf(fnd.fee) || 0 }, 'صندوق ساخته شد ✓')) { setFnd({ name: '', seg: '', fee: '2' }); reload() }
              }}>+ ساختِ صندوق</button>
            </div>
          </div>
          <div style={card}>
            <div style={sub}>🤝 استخرهای سرمایه‌گذاریِ جمعی (فصل ۷) — روی آگهی‌های واقعی</div>
            {data.pools.map((p: any) => (
              <div key={p.listingId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5, flexWrap: 'wrap' }}>
                <b style={{ minWidth: 180 }}>{p.title.slice(0, 45)}</b>
                <span style={{ color: 'var(--muted)' }}>{p.hood}</span>
                <span>{fa(p.soldUnits)}/{fa(p.totalUnits)} واحد ({p.fundedPct.toLocaleString('fa-IR')}٪)</span>
                <span style={{ color: 'var(--muted)' }}>{fa(p.investors)} شریک · هر واحد {faB(p.unitToman)} ت</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: p.live ? 'var(--gold)' : '#e88' }}>{p.live ? `قیمتِ زنده ${faB(p.live)} ت` : 'آگهی حذف شده (ارزش منجمد)'}</span>
              </div>
            ))}
            {!data.pools.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>استخرِ فعالی نیست — بازیکنان از داخلِ «بازار سرمایه» روی آگهی‌های گرانِ واقعی استخر می‌سازند.</div>}
          </div>
          {cfg && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            <div style={card}>
              <div style={sub}>⚙️ تنظیمِ صندوق‌ها</div>
              {row('بازار سرمایه فعال (۱/۰)', capIn(['enabled']))}
              {row('حداقل نمونهٔ واقعی برای قیمت‌گذاری', capIn(['fundMinSamples']), 'کمتر از این → صندوق عرضه نمی‌شود (صادقانه)')}
              {row('کارمزدِ پیش‌فرضِ صندوقِ جدید (٪ سالانه)', capIn(['fundFeePctYear']), 'در بازخرید کسر و به خزانه می‌رود')}
              {row('سودِ دوره‌ای فعال (۱/۰)', capIn(['dividends']), 'از میانهٔ اجارهٔ واقعیِ همان بخش')}
              {row('XP هر سرمایه‌گذاری', capIn(['investRewardXp']))}
            </div>
            <div style={card}>
              <div style={sub}>⚙️ تنظیمِ سرمایه‌گذاریِ جمعی</div>
              {row('فعال (۱/۰)', capIn(['crowd', 'enabled']))}
              {row('ارزشِ هر واحد (تومان)', capIn(['crowd', 'unitToman'], 150), '«پروژهٔ بزرگ، واحدِ کوچک» — فصل ۷')}
              {row('حداقل قیمتِ آگهیِ قابلِ‌مشارکت (تومان)', capIn(['crowd', 'minPrice'], 150), 'فقط ملک‌هایی که از خریدِ انفرادی بزرگ‌ترند')}
              {row('سقفِ استخرهای فعال', capIn(['crowd', 'maxPools']))}
              <div style={{ marginTop: 10 }}><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره و اعمالِ زنده</button></div>
            </div>
          </div>}
        </>}
      </div>
    )
  }

  /* ══════════ 🎯 مأموریت‌ها و پاداش ══════════ */
  if (section === 'missions') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('🎯 مأموریت‌ها و پاداش‌ها', 'پاداشِ مأموریت‌ها، حدسِ قیمت (Beat AI) و صندوقچهٔ روزانه — پیشرفتِ مأموریت‌ها همیشه از رفتارِ واقعیِ کاربر شمرده می‌شود.')}
      {!cfg ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          <div style={card}>
            <div style={sub}>🎯 پاداشِ مأموریت‌ها</div>
            {row('XP مأموریت (M1/شکارچی)', cin('missionRewardXp'), 'M2 نصفِ این مقدار می‌گیرد')}
            {row('کوینِ مأموریت', cin('missionRewardCoins'))}
            {row('XP خریدِ دارایی', cin('buyRewardXp'))}
          </div>
          <div style={card}>
            <div style={sub}>🧠 حدسِ قیمت (Beat AI)</div>
            {row('تلورانسِ حدس (٪)', cin('guessTolerancePct'), 'اختلاف تا این درصد = حدسِ درست')}
            {row('XP حدسِ درست', cin('guessRewardXp'))}
            {row('کوینِ حدسِ درست', cin('guessRewardCoins'))}
          </div>
          <div style={card}>
            <div style={sub}>🎁 صندوقچهٔ روزانه (پاداشِ متغیر)</div>
            {row('فعال (۱/۰)', cin('chest', 'enabled'))}
            {row('سقفِ کوین', cin('chest', 'maxCoins'))}
            {row('سقفِ XP', cin('chest', 'maxXp'))}
          </div>
          <div style={card}>
            <div style={sub}>🤝 دستیارِ همراه</div>
            {row('پیام‌آغازیِ دستیار (۱/۰)', cin('mentorInitiates'))}
          </div>
        </div>
        <div><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره و اعمالِ زنده</button></div>
      </>}
    </div>
  )

  /* ══════════ 📈 تعامل و بازگشت (جلد ۴۹ فصل ۱۹/۲۰) ══════════ */
  if (section === 'engage') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('📈 تعامل و بازگشت', 'DAU/WAU/MAU و Retention از ردِ فعالیتِ واقعیِ بازیکنان (صندوقچه/کوئست/اسنپ‌شات) — هیچ عددِ تخمینی در کار نیست.')}
      {!data?.stats ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Mini label="DAU (فعالِ امروز)" value={fa(data.stats.dau)} hint={`از ${fa(data.total)} بازیکن`} />
          <Mini label="WAU (۷ روز)" value={fa(data.stats.wau)} />
          <Mini label="MAU (۳۰ روز)" value={fa(data.stats.mau)} />
          <Mini label="Retention D1" value={`${fa(data.stats.retention.d1.pct)}٪`} hint={`کوهورت ${fa(data.stats.retention.d1.cohort)} نفر`} />
          <Mini label="Retention D7" value={`${fa(data.stats.retention.d7.pct)}٪`} hint={`کوهورت ${fa(data.stats.retention.d7.cohort)} نفر`} />
          <Mini label="Retention D30" value={`${fa(data.stats.retention.d30.pct)}٪`} hint={`کوهورت ${fa(data.stats.retention.d30.cohort)} نفر`} />
          <Mini label="میانگینِ روزهای فعال" value={fa(data.stats.avgActiveDays)} hint="به‌ازای هر بازیکن" />
          <Mini label="کوئست/صندوقچهٔ امروز" value={`${fa(data.missions.dqToday)} / ${fa(data.missions.chestToday)}`} hint="دریافت‌شده" />
        </div>
        <div style={card}>
          <div style={sub}>فعالانِ ۱۴ روزِ اخیر (هر ستون یک روز)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
            {data.stats.series.map((s: any) => {
              const max = Math.max(1, ...data.stats.series.map((x: any) => x.active))
              return <div key={s.day} title={`${fa(s.active)} فعال`} style={{ flex: 1, height: `${Math.max(4, Math.round(s.active / max * 100))}%`, background: s.day === data.today ? 'var(--gold)' : 'var(--line2)', borderRadius: 4 }} />
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>ردِ فعالیت از کلیدهای تاریخ‌دارِ خودِ بازیکنان ساخته می‌شود — همان چیزی که واقعاً رخ داده.</div>
        </div>
        <div style={card}>
          <div style={sub}>⚠️ ریسکِ ریزش — باارزش‌ترین بازیکنانِ غایب (۷+ روز)</div>
          {(data.churn || []).map((r: any) => (
            <div key={r.no} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5, flexWrap: 'wrap' }}>
              <span>{r.persona || '🏛'}</span><b style={{ minWidth: 140 }}>{r.name}</b>
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>#{fa(r.no)} · {r.userId}</span>
              <span style={{ color: 'var(--muted)' }}>{fa(r.assets)} دارایی · {faB(r.netWorth)} ت</span>
              <span style={{ flex: 1 }} />
              <b style={{ color: '#e88' }}>{fa(r.absentDays)} روز غایب</b>
            </div>
          ))}
          {!(data.churn || []).length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هیچ بازیکنِ باارزشی بیش از ۷ روز غایب نیست ✅</div>}
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 8 }}>از «بازیکنان» می‌توانی با 🎁 هدیه/جبران برایشان انگیزهٔ بازگشت بسازی — در تایم‌لاینِ خودشان هم ثبت می‌شود.</div>
        </div>
      </>}
    </div>
  )

  /* ══════════ 🗺 دنیا و بازارِ واقعی ══════════ */
  if (section === 'world') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('🗺 دنیا و بازارِ واقعی', 'مانیتورِ همگام‌سازی بازی↔بازار (Sync Monitor)، نقشهٔ نفوذِ محله‌ها و برترین‌ها — دنیا روی آگهی‌های زندهٔ ملک‌جت نفس می‌کشد.')}
      {!data?.sync ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <Mini label="داراییِ متصل به آگهیِ زنده" value={fa(data.sync.live)} hint="قیمتِ روز از بازار" />
          <Mini label="داراییِ با آگهیِ حذف‌شده" value={fa(data.sync.dead)} hint="ارزش = قیمتِ خرید (منجمد)" />
          <Mini label="محله‌های دارای نفوذ" value={fa(data.hoods.length)} />
        </div>
        <div style={card}>
          <div style={sub}>🔥 نقشهٔ نفوذِ محله‌ها (بر اساسِ ارزشِ واقعیِ دارایی‌های بازیکنان)</div>
          {data.hoods.map((h: any) => (
            <div key={h.hood} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
              <b style={{ minWidth: 130 }}>{h.hood}</b>
              <span style={{ color: 'var(--muted)' }}>{fa(h.assets)} دارایی · {fa(h.players)} بازیکن</span>
              <span style={{ flex: 1 }} />
              <b style={{ color: 'var(--gold)' }}>{faB(h.value)} ت</b>
            </div>
          ))}
          {!data.hoods.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز دارایی‌ای ثبت نشده.</div>}
        </div>
        <div style={card}>
          <div style={sub}>👑 ده امپراتوریِ برتر (Empire Score)</div>
          {data.top.map((r: any, i: number) => (
            <div key={r.no} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
              <b style={{ minWidth: 26, color: i < 3 ? 'var(--gold)' : 'var(--muted)' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : fa(i + 1)}</b>
              <span>{r.persona || '🏛'}</span><b>{r.name}</b>
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>{r.userId}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: 'var(--muted)' }}>{faB(r.netWorth)} ت</span>
              <b style={{ color: 'var(--gold)' }}>🏆 {fa(r.score)}</b>
            </div>
          ))}
        </div>
      </>}
    </div>
  )

  /* ══════════ ✉️ LiveOps و نامهٔ روزانه ══════════ */
  if (section === 'liveops') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('✉️ LiveOps و نامهٔ روزانه', 'حلقهٔ بازگشتِ روزانه (AI Overnight): نامهٔ صبح از دادهٔ واقعیِ دیشبِ بازار ساخته می‌شود — اینجا نرخِ بازشدن را می‌بینی و دستی اجرا می‌کنی.')}
      {!data?.briefs ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {data.briefs.map((b: any) => <Mini key={b.day} label={`نامهٔ ${b.day}`} value={`${fa(b.built)} / ${fa(b.opened)}`} hint={`ساخته / بازشده${b.built ? ` — ${Math.round(b.opened / b.built * 100).toLocaleString('fa-IR')}٪` : ''}`} />)}
          <Mini label="صندوقچهٔ بازشدهٔ امروز" value={fa(data.chestToday)} hint={`از ${fa(data.empires)} امپراتوری`} />
        </div>
        <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>نامه‌ها هر ۶ ساعت خودکار (cron اینستنس ۰) ساخته می‌شوند — برای تستِ فوری، همین حالا بساز:</div>
          <button style={btn} disabled={busy === 'runBriefs'} onClick={() => post({ action: 'runBriefs' }, 'نامه‌های امروز ساخته شد ✓')}>▶ ساختِ نامه‌های امروز</button>
        </div>
        {cfg && <div style={card}>
          <div style={sub}>تنظیمِ نامهٔ روزانه</div>
          {row('فعال (۱/۰)', cin('dailyBrief'))}
          <div style={{ marginTop: 10 }}><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره</button></div>
        </div>}
        {/* 🎪 استودیوی رویداد (سند ۱۸ — LiveOps): رویدادِ زمان‌دار بدونِ دیپلوی؛ پیشرفت از رفتارِ واقعیِ REOS */}
        {cfg && <div style={card}>
          <div style={sub}>🎪 استودیوی رویداد — بدونِ دیپلوی</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
            رویدادِ زمان‌دار بساز؛ همان لحظه در داشبوردِ همهٔ بازیکنان ظاهر می‌شود. پیشرفت فقط از رفتارِ
            واقعیِ ثبت‌شده (بازدید/ذخیره/جستجو/محله‌های متفاوت) در بازهٔ رویداد سنجیده می‌شود.
          </div>
          {(cfg.events || []).map((ev: any, i: number) => (
            <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--line)', marginBottom: 6, fontSize: 12 }}>
              <span>{ev.icon || '🎪'}</span>
              <b style={{ flex: 1, minWidth: 120 }}>{ev.title}</b>
              <span style={{ color: 'var(--muted)' }}>{({ views: 'بازدید', saves: 'ذخیره', searches: 'جستجو', hoods: 'محله' } as any)[ev.metric] || ev.metric} × {fa(ev.target)}</span>
              <span style={{ color: 'var(--muted)' }}>🎁 {fa(ev.rewardCoins || 0)} کوین{ev.rewardXp ? ` + ${fa(ev.rewardXp)} XP` : ''}</span>
              <span style={{ color: Date.now() < ev.endAt ? '#e7a14a' : 'var(--faint)' }}>{new Date(ev.startAt).toLocaleDateString('fa-IR')} تا {new Date(ev.endAt).toLocaleDateString('fa-IR')}</span>
              <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 11, color: ev.enabled ? '#7c6' : 'var(--muted)' }}
                onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.events[i].enabled = !n.events[i].enabled; return n })}>{ev.enabled ? 'فعال ✓' : 'خاموش'}</button>
              <button style={{ ...btnGhost, padding: '3px 9px', fontSize: 11, color: '#e88' }}
                onClick={() => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.events.splice(i, 1); return n })}>حذف</button>
            </div>
          ))}
          <EventComposer onAdd={(ev: any) => setCfg((c: any) => { const n = JSON.parse(JSON.stringify(c)); n.events = [...(n.events || []), ev]; return n })} />
          <div style={{ marginTop: 10 }}><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره و اجرای زنده</button></div>
        </div>}
        {/* پاداشِ نقاطِ عطفِ استریک (سند ۱۸ بخش ۱) */}
        {cfg && <div style={card}>
          <div style={sub}>🔥 پاداشِ ورودِ پیاپی (کوین)</div>
          {row('روزِ ۷', cin('streakBonus', 'd7'))}
          {row('روزِ ۱۴', cin('streakBonus', 'd14'))}
          {row('روزِ ۲۱', cin('streakBonus', 'd21'))}
          {row('روزِ ۳۰', cin('streakBonus', 'd30'))}
          <div style={{ marginTop: 10 }}><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره</button></div>
        </div>}
      </>}
    </div>
  )

  /* ══════════ 🚩 دسترسی و عرضهٔ تدریجی ══════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('🚩 دسترسی و عرضهٔ تدریجی', 'کلیدِ اصلیِ بازی: روشن/خاموش، درصدِ عرضه (rollout) و محدودسازی به شهر — بدونِ دیپلوی، همان لحظه اعمال می‌شود.')}
      {!flag ? loading : (
        <div style={card}>
          {row('بازی فعال است (۱/۰)', <input value={flag.enabled ? '1' : '0'} onChange={e => setFlag({ ...flag, enabled: e.target.value === '1' })} style={{ ...inpS, width: 70, textAlign: 'center' }} />, 'خاموش = صفحهٔ /empire و کارتِ پنل‌ها برای همه بسته می‌شود')}
          {row('عرضهٔ تدریجی (٪ کاربران)', <input value={String(flag.rolloutPct)} onChange={e => setFlag({ ...flag, rolloutPct: numOf(e.target.value) || 0 })} style={{ ...inpS, width: 70, textAlign: 'center' }} />, 'سنجشِ قطعی — یک کاربر همیشه یک نتیجه می‌گیرد')}
          {row('فقط این شهرها (با ، جدا؛ خالی = همه)', <input value={(flag.cities || []).join('، ')} onChange={e => setFlag({ ...flag, cities: e.target.value.split(/[،,]/).map((x: string) => x.trim()).filter(Boolean) })} style={{ ...inpS, width: 240 }} />)}
          <div style={{ marginTop: 12 }}>
            <button style={btn} disabled={busy === 'flag'} onClick={async () => {
              setBusy('flag')
              const d = await fetch('/api/reos/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'empire', patch: { enabled: flag.enabled, rolloutPct: flag.rolloutPct, cities: flag.cities } }) }).then(r => r.json()).catch(() => null)
              setBusy(''); flash(d?.ok || d?.flag ? 'اعمال شد ✓' : 'خطا')
            }}>💾 اعمالِ فوری</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 🎪 فرمِ ساختِ رویدادِ زنده (سند ۱۸ — LiveOps): عنوان/متریکِ واقعی/هدف/پاداش/مدت — بدونِ دیپلوی.
function EventComposer({ onAdd }: { onAdd: (ev: unknown) => void }) {
  const [t, setT] = useState({ title: '', desc: '', icon: '🎪', metric: 'views', target: '5', rewardCoins: '50', rewardXp: '20', days: '3' })
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--line2)', marginTop: 8 }}>
      <input value={t.icon} onChange={e => setT({ ...t, icon: e.target.value })} style={{ ...inpS, width: 44, textAlign: 'center' }} />
      <input value={t.title} onChange={e => setT({ ...t, title: e.target.value })} placeholder="عنوانِ رویداد (مثلاً هفتهٔ کاوشِ محله‌ها)" style={{ ...inpS, flex: 1, minWidth: 170 }} />
      <input value={t.desc} onChange={e => setT({ ...t, desc: e.target.value })} placeholder="توضیحِ کوتاه" style={{ ...inpS, flex: 1, minWidth: 150 }} />
      <select value={t.metric} onChange={e => setT({ ...t, metric: e.target.value })} style={{ ...inpS, width: 140 }}>
        <option value="views">بازدیدِ آگهیِ واقعی</option>
        <option value="saves">ذخیرهٔ آگهی</option>
        <option value="searches">جستجو</option>
        <option value="hoods">محله‌های متفاوت</option>
      </select>
      <input value={t.target} onChange={e => setT({ ...t, target: e.target.value })} title="هدف" style={{ ...inpS, width: 56, textAlign: 'center' }} />
      <input value={t.rewardCoins} onChange={e => setT({ ...t, rewardCoins: e.target.value })} title="کوینِ پاداش" style={{ ...inpS, width: 62, textAlign: 'center' }} />
      <input value={t.rewardXp} onChange={e => setT({ ...t, rewardXp: e.target.value })} title="XP پاداش" style={{ ...inpS, width: 56, textAlign: 'center' }} />
      <input value={t.days} onChange={e => setT({ ...t, days: e.target.value })} title="مدت (روز)" style={{ ...inpS, width: 56, textAlign: 'center' }} />
      <button style={{ ...btnGhost, padding: '7px 14px' }} disabled={!t.title.trim() || !(numOf(t.target) > 0) || !(numOf(t.days) > 0)} onClick={() => {
        const now = Date.now()
        onAdd({
          id: 'ev' + now.toString(36), title: t.title.trim().slice(0, 60), desc: t.desc.trim().slice(0, 120), icon: t.icon.slice(0, 4) || '🎪',
          metric: t.metric, target: Math.max(1, Math.floor(numOf(t.target) || 1)),
          rewardCoins: Math.max(0, Math.floor(numOf(t.rewardCoins) || 0)), rewardXp: Math.max(0, Math.floor(numOf(t.rewardXp) || 0)),
          startAt: now, endAt: now + Math.max(1, Math.floor(numOf(t.days) || 1)) * 864e5, enabled: true,
        })
        setT({ ...t, title: '', desc: '' })
      }}>+ افزودن</button>
      <div style={{ width: '100%', fontSize: 10.5, color: 'var(--faint)' }}>هدف · کوین · XP · مدت(روز) — بعد از «ذخیره و اجرای زنده» بلافاصله برای بازیکن‌ها فعال می‌شود.</div>
    </div>
  )
}
