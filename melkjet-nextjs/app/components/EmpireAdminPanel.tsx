'use client'
// Empire Control Center (GDD جلد ۹) — مرکزِ فرماندهیِ بازی داخلِ سوپرادمین، با منو و زیربخش‌های مستقل:
// نمای کلی · بازیکنان · اقتصاد و ارزها · مأموریت‌ها و پاداش · دنیا و بازارِ واقعی · LiveOps · دسترسی.
// همهٔ اعداد واقعی‌اند (از store بازیکنان + بازارِ زنده)؛ همهٔ تنظیمات مستقیم روی موتورِ زنده اعمال می‌شوند.
import { useCallback, useEffect, useState } from 'react'

const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : n >= 1e6 ? `${fa(Math.round(n / 1e6))} میلیون` : fa(Math.round(n))
const faDate = (t: number) => t ? new Date(t).toLocaleDateString('fa-IR') : '—'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }
const sub: React.CSSProperties = { fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }
const btn: React.CSSProperties = { background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 9, padding: '8px 16px', fontWeight: 800, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 9, padding: '8px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5 }
const inpS: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12.5 }

export type EmpireSection = 'overview' | 'players' | 'economy' | 'missions' | 'world' | 'liveops' | 'access'

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

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const loadView = useCallback((v: string, extra = '') =>
    fetch(`/api/admin/empire?view=${v}${extra}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null), [])
  const loadCfg = useCallback(() => fetch('/api/reos/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(d.config?.empire || null) }), [])
  const loadFlag = useCallback(() => fetch('/api/reos/flags', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setFlag((d.flags || []).find((f: any) => f.key === 'empire') || null) }), [])

  useEffect(() => {
    setData(null); setSel(null)
    if (section === 'overview') loadView('overview').then(setData)
    if (section === 'players') loadView('players', `&sort=${sort}`).then(setData)
    if (section === 'world') loadView('world').then(setData)
    if (section === 'liveops') { loadView('liveops').then(setData); loadCfg() }
    if (section === 'economy' || section === 'missions') { loadCfg(); loadView('overview').then(setData) }
    if (section === 'access') loadFlag()
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
    const num = val === '' ? '' : (isNaN(Number(val)) ? val : Number(val))
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
      {!data ? loading : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <Mini label="امپراتوری‌ها" value={fa(data.empires)} hint={`${fa(data.newToday)} تولدِ امروز`} />
          <Mini label="فعالِ امروز" value={fa(data.activeToday)} hint={`${fa(data.active7d)} فعالِ ۷ روز`} />
          <Mini label="ارزشِ کلِ اکوسیستم" value={`${faB(data.totals.netWorth)} ت`} hint="نقد + داراییِ زنده" />
          <Mini label="سرمایهٔ نقدِ در گردش" value={`${faB(data.totals.capital)} ت`} />
          <Mini label="ملک‌کوینِ عرضه‌شده" value={fa(data.totals.coins)} hint="Coin Supply" />
          <Mini label="دارایی‌ها (آگهیِ واقعی)" value={fa(data.totals.assets)} />
          <Mini label="سودِ تحقق‌یافتهٔ کل" value={`${faB(data.totals.realized)} ت`} hint="از فروش‌ها" />
          <Mini label="درآمدِ اجاره/کسب‌وکار" value={`${faB(data.totals.incomes)} ت`} />
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
      {!data ? loading : (
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
                if (await post({ action: 'adjust', userId: sel.empire.userId, coins: Number(adj.coins) || 0, xp: Number(adj.xp) || 0, capital: Number(adj.capital) || 0, aiTokens: Number(adj.aiTokens) || 0, reason: adj.reason }, 'اعمال شد ✓')) { setAdj({ coins: '', xp: '', capital: '', aiTokens: '', reason: '' }); openPlayer(sel.empire.userId) }
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
          </div>
        </div>
        <div><button style={btn} disabled={busy === 'cfg'} onClick={saveCfg}>💾 ذخیره و اعمالِ زنده</button></div>
      </>}
    </div>
  )

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

  /* ══════════ 🗺 دنیا و بازارِ واقعی ══════════ */
  if (section === 'world') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, direction: 'rtl' }}>
      {head('🗺 دنیا و بازارِ واقعی', 'مانیتورِ همگام‌سازی بازی↔بازار (Sync Monitor)، نقشهٔ نفوذِ محله‌ها و برترین‌ها — دنیا روی آگهی‌های زندهٔ ملک‌جت نفس می‌کشد.')}
      {!data ? loading : <>
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
      {!data ? loading : <>
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
          {row('عرضهٔ تدریجی (٪ کاربران)', <input value={String(flag.rolloutPct)} onChange={e => setFlag({ ...flag, rolloutPct: Number(e.target.value) || 0 })} style={{ ...inpS, width: 70, textAlign: 'center' }} />, 'سنجشِ قطعی — یک کاربر همیشه یک نتیجه می‌گیرد')}
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
