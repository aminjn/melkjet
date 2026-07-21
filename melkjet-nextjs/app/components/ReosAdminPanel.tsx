'use client'
import { useEffect, useState } from 'react'
import { ReosExperimentsAdmin, ReosAttributionAdmin, ReosGeoHeat } from '@/app/components/ReosOpsPanels'

// REOS داخلِ سوپرادمین — تب‌بندیِ منطقی به‌جای یک صفحهٔ طولانی:
// نمای کلی · تنظیماتِ موتور · مدل‌ها و AutoML · فلگ‌ها · ابزارها. (تعلیقِ حساب‌ها اینجا نیست — بخشِ کاربران.)
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }
const sub: React.CSSProperties = { fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }

type Tab = 'overview' | 'config' | 'models' | 'flags' | 'tools'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '📊 نمای کلی' },
  { id: 'config', label: '⚙️ تنظیماتِ موتور' },
  { id: 'models', label: '🤖 مدل‌ها و AutoML' },
  { id: 'flags', label: '🚩 فلگ‌های ویژگی' },
  { id: 'tools', label: '🧰 ابزارها و تحلیل' },
]

type Cfg = Record<string, Record<string, unknown>>
type Ev = { id: string; type: string; at: number; userId?: string; propertyId?: string; agentId?: string; leadId?: string }
type Top = { id: string; title: string; engagement: number; clicks: number; saves: number; contacts: number }
type Overview = {
  engine: { publicListings: number; weights: Record<string, Record<string, number>> }
  model: { n: number; auc: number; logloss: number; usedDefault: boolean } | null
  queue: { events: number; features: number }
  graph: { nodes: number; edges: number; byType: Record<string, number>; byRel: Record<string, number> }
  ai: { calls: number; tokens: number; cost: number; cacheHitRate: number; avgMs: number; byModel: Record<string, { calls: number }> }
  events: { total: number; byType: Record<string, number>; recent: Ev[] }
  topProperties: Top[]
  // فاز ۱۸۹ — اثباتِ «واقعاً کار می‌کند»: دفترِ ترین + تازگیِ هر منبعِ رویداد + پرتعامل‌ترین کاربران
  training?: { lastAt: number; runs: Array<{ at: number; kind: string; ok: boolean; ms: number; n?: number; auc?: number; note?: string }>; autoHours: number; enabled: boolean; nextAt: number }
  coverage?: Array<{ type: string; count: number; lastAt: number }>
  topUsers?: Array<{ userId: string; engagement: number }>
}
type UProfile = {
  userId: string; events: number; views: number; saves: number; searches: number; contacts: number
  topHoods: Array<{ hood: string; count: number }>; priceBand: { min: number; median: number; max: number } | null
  recentQueries: string[]; lastActiveAt: number | null; engagement: number; known: boolean
}
const EV_LABEL: Record<string, string> = {
  user_clicked_property: 'بازدید', user_saved_property: 'سیو', user_searched: 'جستجو',
  contact_made: 'تماس', property_created: 'ثبتِ ملک', lead_created: 'لیدِ جدید', agent_assigned: 'تخصیصِ مشاور',
}

export default function ReosAdminPanel() {
  const [tab, setTab] = useState<Tab>('overview')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  // ── دادهٔ تب‌ها ──
  const [ov, setOv] = useState<Overview | null>(null)
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [models, setModels] = useState<{ id: string; version: number; status: string; metrics: Record<string, number> }[]>([])
  const [catalog, setCatalog] = useState<{ key: string; name: string; purpose: string; type: string; status: string; metric?: string }[]>([])
  const [aml, setAml] = useState<{ name: string; champion?: { version: number; metric: number }; challenger?: { version: number; metric: number; samples: number }; wouldPromote: boolean }[]>([])
  const [flags, setFlags] = useState<{ key: string; label: string; enabled: boolean; rolloutPct: number; cities: string[] }[]>([])
  const [vId, setVId] = useState(''); const [vKind, setVKind] = useState('identity')

  const loadOv = () => fetch('/api/reos/admin', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setOv(d) }).catch(() => {})
  const loadCfg = () => fetch('/api/reos/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(d.config) }).catch(() => {})
  const loadModels = () => fetch('/api/reos/models?name=engage', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setModels(d.versions || []) }).catch(() => {})
  const loadCatalog = () => fetch('/api/reos/catalog', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCatalog(d.models || []) }).catch(() => {})
  const loadAml = () => fetch('/api/reos/automl', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setAml(d.status || []) }).catch(() => {})
  const loadFlags = () => fetch('/api/reos/flags', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setFlags(d.flags || []) }).catch(() => {})
  useEffect(() => {
    if (tab === 'overview' && !ov) loadOv()
    if (tab === 'config' && !cfg) loadCfg()
    if (tab === 'models') { loadModels(); loadCatalog(); loadAml() }
    if (tab === 'flags') loadFlags()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── اکشن‌های مشترک ──
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 4000) }
  const action = async (label: string, url: string, key: string) => {
    setBusy(key); const d = await fetch(url, { method: 'POST' }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(`${label}: ${d?.message || (d?.ok ? 'انجام شد ✓' : d?.error || 'خطا')}`)
    if (url.includes('/train')) { loadModels(); loadOv() }
  }
  const setPath = (section: string, key: string, val: string, sk?: string) => {
    setCfg(c => { if (!c) return c; const n = JSON.parse(JSON.stringify(c)); const num = val === '' ? '' : (isNaN(Number(val)) ? val : Number(val)); if (sk) n[section][key][sk] = num; else n[section][key] = num; return n })
  }
  const saveCfg = async () => {
    setBusy('save')
    const d = await fetch('/api/reos/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: cfg }) }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.ok ? 'تنظیمات ذخیره شد ✓ (روی موتورهای زنده اعمال شد)' : 'خطا در ذخیره')
  }
  const resetCfg = async () => { setBusy('reset'); await fetch('/api/reos/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) }); await loadCfg(); setBusy(''); flash('به پیش‌فرض بازگشت ✓') }
  const promote = async (id: string) => { setBusy('promote' + id); await fetch('/api/reos/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promote', id }) }); await loadModels(); setBusy('') }
  const runAutoml = async () => {
    setBusy('automl'); const d = await fetch('/api/reos/automl', { method: 'POST' }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.message || (d?.ok ? 'انجام شد ✓' : 'خطا')); loadAml(); loadModels()
  }
  const saveFlag = async (key: string, patch: Record<string, unknown>) => {
    await fetch('/api/reos/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, patch }) }).catch(() => {})
    loadFlags()
  }
  const verify = async () => {
    if (!vId) return; setBusy('verify')
    const d = await fetch('/api/reos/trust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', entityId: vId, verification: vKind, on: true }) }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.ok ? `تأیید شد ✓ (اعتماد: ${d.trust?.score})` : d?.error || 'خطا')
  }
  const syncTerritory = async () => {
    setBusy('terr'); const d = await fetch('/api/reos/territory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) }).then(r => r.json()).catch(() => null)
    setBusy(''); flash(d?.ok ? `اقتدارِ بازار همگام شد ✓ (${fa(d.result?.records || 0)} رکورد در ${fa(d.result?.territories || 0)} قلمرو)` : d?.error || 'خطا')
  }

  const inp = (section: string, key: string, sk?: string) => {
    const v = cfg ? (sk ? (cfg[section]?.[key] as Record<string, unknown>)?.[sk] : cfg[section]?.[key]) : ''
    return <input value={String(v ?? '')} onChange={e => setPath(section, key, e.target.value, sk)} style={{ width: 74, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12, textAlign: 'center' }} />
  }
  const row = (label: string, node: React.ReactNode) => <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 120 }}>{label}</span>{node}</div>
  const btn = (label: string, onClick: () => void, key: string, primary = false) => <button key={key} onClick={onClick} disabled={!!busy} style={{ padding: '8px 14px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--line2)', background: primary ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: primary ? '#16140f' : 'var(--muted)', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: FONT, fontSize: 12.5 }}>{busy === key ? '…' : label}</button>
  const mini = (l: string, v: string) => <div key={l} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>{v}</div></div>

  return (
    <div style={{ fontFamily: FONT, direction: 'rtl', animation: 'fade .35s ease' }}>
      {/* تب‌ها */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '9px 16px', borderRadius: 10, border: tab === t.id ? '1px solid var(--gold)' : '1px solid var(--line2)', background: tab === t.id ? 'var(--goldDim)' : 'var(--surface)', color: tab === t.id ? 'var(--gold)' : 'var(--muted)', fontWeight: tab === t.id ? 800 : 600, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>{t.label}</button>
        ))}
      </div>
      {msg && <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, color: 'var(--gold)', marginBottom: 12 }}>{msg}</div>}

      {/* ══════ نمای کلی ══════ */}
      {tab === 'overview' && (!ov ? <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>در حال بارگذاری…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
            {[
              { label: 'کلِ رویدادها', value: fa(ov.events.total), c: 'var(--gold)' },
              { label: 'آگهیِ رتبه‌پذیر', value: fa(ov.engine.publicListings), c: '#60a5fa' },
              { label: 'تماس‌ها', value: fa(ov.events.byType.contact_made || 0), c: '#34d399' },
              { label: 'سیوها', value: fa(ov.events.byType.user_saved_property || 0), c: '#e7a14a' },
            ].map(k => <div key={k.label} style={card}><div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>{k.label}</div><div style={{ fontSize: 26, fontWeight: 900, color: k.c }}>{k.value}</div></div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>رویدادها به‌تفکیکِ نوع</div>
              {Object.keys(ov.events.byType).length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز رویدادی ثبت نشده.</div> :
                Object.entries(ov.events.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => {
                  const max = Math.max(...Object.values(ov.events.byType))
                  return <div key={t} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}><span>{EV_LABEL[t] || t}</span><span style={{ fontWeight: 800 }}>{fa(n)}</span></div>
                    <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 99 }}><div style={{ width: `${(n / max) * 100}%`, height: 6, background: 'var(--gold)', borderRadius: 99 }} /></div>
                  </div>
                })}
            </div>
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>پرتعامل‌ترین املاک</div>
              {ov.topProperties.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز داده‌ای نیست.</div> :
                ov.topProperties.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', width: 20 }}>{fa(i + 1)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>👁 {fa(p.clicks)} · ♥ {fa(p.saves)} · ☎ {fa(p.contacts)}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)' }}>{fa(p.engagement)}</span>
                  </div>
                ))}
            </div>
          </div>
          {/* 🏋️ فاز ۱۸۹ — سلامتِ ترین: دفترِ اجراها + ترینِ فوری (اثباتِ زنده‌بودنِ یادگیری) */}
          <Reos189Training ov={ov} reload={loadOv} />
          {/* 👤 فاز ۱۸۹ — شناختِ کاربر از رفتارِ واقعی */}
          <Reos189Users ov={ov} />
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>مصرفِ AI (Gateway) + صفِ رویداد + گرافِ دانش</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
              {mini('فراخوان‌های AI', fa(ov.ai?.calls || 0))}
              {mini('هزینهٔ تقریبی (ت)', fa(ov.ai?.cost || 0))}
              {mini('نرخِ کش', (ov.ai?.cacheHitRate || 0).toLocaleString('fa-IR') + '٪')}
              {mini('صفِ رویداد', fa(ov.queue?.events || 0))}
              {mini('گره‌های گراف', fa(ov.graph?.nodes || 0))}
              {mini('یال‌های گراف', fa(ov.graph?.edges || 0))}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>رویدادهای اخیر (زنده)</div>
            {ov.events.recent.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>—</div> :
              ov.events.recent.slice(0, 12).map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--gold)', minWidth: 90 }}>{EV_LABEL[e.type] || e.type}</span>
                  <span style={{ color: 'var(--muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[e.userId && `کاربر ${e.userId}`, e.propertyId && `ملک ${e.propertyId.slice(0, 8)}`].filter(Boolean).join(' · ')}</span>
                  <span style={{ color: 'var(--faint)' }}>{new Date(e.at).toLocaleString('fa-IR')}</span>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* ══════ تنظیماتِ موتور ══════ */}
      {tab === 'config' && (!cfg ? <div style={{ color: 'var(--muted)', padding: 30, textAlign: 'center' }}>در حال بارگذاری…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>این تنظیمات مستقیماً روی موتورهای زنده اعمال می‌شوند. (قوانینِ تعلیقِ حساب‌ها در بخشِ «تعلیق حساب‌ها»ی منوی کاربران است.)</div>

          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 14 }}>🎯 رتبه‌بندی و امتیازدهی</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
              <div><div style={sub}>وزن‌های رتبه‌بندیِ فید</div>
                {row('تطابقِ کاربر', inp('feed', 'rankWeights', 'userMatch'))}{row('کیفیت', inp('feed', 'rankWeights', 'quality'))}{row('تعامل', inp('feed', 'rankWeights', 'engagement'))}{row('تازگی', inp('feed', 'rankWeights', 'freshness'))}{row('تقاضا', inp('feed', 'rankWeights', 'demand'))}{row('تبلیغ', inp('feed', 'rankWeights', 'promotion'))}</div>
              <div><div style={sub}>وزن‌های امتیازِ Global</div>
                {row('بودجه', inp('scoring', 'budget'))}{row('موقعیت', inp('scoring', 'location'))}{row('رفتار', inp('scoring', 'behavior'))}{row('نیت', inp('scoring', 'intent'))}{row('تاریخچه', inp('scoring', 'historical'))}{row('تقاضا', inp('scoring', 'demand'))}</div>
              <div><div style={sub}>وزن‌های Hybrid</div>
                {row('ML', inp('hybrid', 'ml'))}{row('برداری', inp('hybrid', 'vector'))}{row('قانون', inp('hybrid', 'rule'))}{row('رفتاری', inp('hybrid', 'behavioral'))}{row('boost', inp('hybrid', 'boost'))}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 14 }}>🧠 یادگیری و AI</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
              <div><div style={sub}>یادگیریِ آنلاین (RL)</div>
                {row('نرخِ یادگیری (lr)', inp('rl', 'lr'))}{row('اکتشاف (epsilon)', inp('rl', 'epsilon'))}{row('پاداشِ کلیک', inp('rl', 'rewards', 'click'))}{row('پاداشِ ذخیره', inp('rl', 'rewards', 'save'))}{row('پاداشِ تماس', inp('rl', 'rewards', 'contact'))}{row('پاداشِ بازدید', inp('rl', 'rewards', 'visit'))}{row('پاداشِ قرارداد', inp('rl', 'rewards', 'contract'))}</div>
              <div><div style={sub}>آموزش + AutoML</div>
                {row('آموزشِ خودکار هر (ساعت)', inp('training', 'autoHours'))}{row('آموزشِ خودکار فعال (۱/۰)', inp('training', 'enabled'))}{row('مدلِ لیدِ آموزش‌دیده (۱/۰)', inp('training', 'useLearnedLead'))}{row('AutoML فعال (۱/۰)', inp('automl', 'enabled'))}{row('حاشیهٔ ارتقا (AUC)', inp('automl', 'promoteMargin'))}{row('حداقلِ نمونه', inp('automl', 'minSamples'))}</div>
              <div><div style={sub}>Gateway + نرخِ AI (تومان/۱هزار توکن)</div>
                {row('کشِ AI (دقیقه)', inp('gateway', 'cacheTtlMin'))}{row('نرخِ gpt-4o', inp('gateway', 'rates', 'gpt-4o'))}{row('نرخِ gpt-4o-mini', inp('gateway', 'rates', 'gpt-4o-mini'))}{row('نرخِ پیش‌فرض', inp('gateway', 'rates', 'default'))}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 14 }}>🤝 اعتماد، تبلیغ و دوقلوی دیجیتال</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
              <div><div style={sub}>وزن‌های اعتماد (Trust)</div>
                {row('تأیید', inp('trust', 'weights', 'verified'))}{row('کاملیِ پروفایل', inp('trust', 'weights', 'profile'))}{row('نرخِ پاسخ', inp('trust', 'weights', 'response'))}{row('معاملات', inp('trust', 'weights', 'deals'))}{row('امتیاز', inp('trust', 'weights', 'rating'))}{row('سابقه', inp('trust', 'weights', 'tenure'))}</div>
              <div><div style={sub}>تبلیغات (Boost)</div>
                {row('نردبان', inp('promotion', 'boost'))}{row('ویژه', inp('promotion', 'featured'))}{row('VIP', inp('promotion', 'vip'))}{row('گیتِ کیفیت (۱/۰)', inp('promotion', 'trustGate'))}</div>
              <div><div style={sub}>دوقلوی دیجیتال (Twin)</div>
                {row('پنجرهٔ فروش (روز)', inp('twin', 'saleWindowDays'))}{row('آستانهٔ گران‌بودن (٪)', inp('twin', 'overpricePct'))}{row('آستانهٔ ارزان‌بودن (٪)', inp('twin', 'underpricePct'))}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 14 }}>🏆 لایهٔ رقابتی و اجتماعی</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
              <div><div style={sub}>اقتدارِ بازار — وزن‌ها (جمع=۱)</div>
                {row('معاملات', inp('territory', 'weights', 'transactions'))}{row('تبدیلِ لید', inp('territory', 'weights', 'leadConversion'))}{row('کیفیتِ آگهی', inp('territory', 'weights', 'listingQuality'))}{row('رضایت', inp('territory', 'weights', 'satisfaction'))}{row('محتوا', inp('territory', 'weights', 'content'))}{row('فعالیت', inp('territory', 'weights', 'activity'))}{row('اعتمادِ AI', inp('territory', 'weights', 'aiTrust'))}</div>
              <div><div style={sub}>نبرد و ضدتقلب</div>
                {row('روزهای نبرد', inp('territory', 'battleDays'))}{row('آستانهٔ تقلب', inp('territory', 'fraudThreshold'))}{row('وزنِ اعتبار در فید', inp('territory', 'feedAuthority'))}{row('فاصلهٔ رقابت', inp('territory', 'contestGap'))}</div>
              <div><div style={sub}>اقتصادِ پاداش (Economy)</div>
                {row('کمیسیونِ معامله', inp('economy', 'commissionPct'))}{row('پورسانتِ معرف', inp('economy', 'affiliatePct'))}{row('پاداشِ وفاداری', inp('economy', 'loyaltyBonusPct'))}{row('XP پاداشِ مأموریت', inp('economy', 'missionRewardXp'))}{row('اعتبارِ مأموریت', inp('economy', 'missionRewardCredit'))}</div>
              <div><div style={sub}>XP هر اقدام + منحنیِ سطح</div>
                {row('ثبتِ آگهی', inp('xp', 'actions', 'list_property'))}{row('بستنِ معامله', inp('xp', 'actions', 'close_deal'))}{row('پاسخ به لید', inp('xp', 'actions', 'respond_lead'))}{row('دریافتِ نظر', inp('xp', 'actions', 'get_review'))}{row('انتشارِ محتوا', inp('xp', 'actions', 'publish_content'))}{row('بردِ نبرد', inp('xp', 'actions', 'win_battle'))}{row('پایهٔ سطح', inp('xp', 'levelBase'))}{row('تندیِ منحنی', inp('xp', 'levelExp'))}</div>
              <div><div style={sub}>اعتبارِ اجتماعی (Community)</div>
                {row('وزنِ دنبال‌کننده', inp('community', 'weights', 'followers'))}{row('وزنِ اقتدار', inp('community', 'weights', 'dominance'))}{row('وزنِ اعتماد', inp('community', 'weights', 'trust'))}{row('وزنِ سطح', inp('community', 'weights', 'level'))}{row('حداکثر طولِ نظر', inp('community', 'commentMaxLen'))}</div>
            </div>
          </div>

          <div style={{ ...card, borderColor: 'var(--gold)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>🏛 تنظیماتِ امپراتوری (بازی) به منوی خودش منتقل شد</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>بازی یک محصولِ کامل است — از منوی کناری، گروهِ «امپراتوری (بازی)»: مرکزِ فرماندهی، بازیکنان، اقتصاد و ارزها، مأموریت‌ها، دنیا و بازارِ واقعی، LiveOps و دسترسی.</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {btn('💾 ذخیرهٔ تنظیمات', saveCfg, 'save', true)}
            {btn('بازگردانی به پیش‌فرض', resetCfg, 'reset')}
          </div>
        </div>
      ))}

      {/* ══════ مدل‌ها و AutoML ══════ */}
      {tab === 'models' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {btn('↻ آموزشِ مدل‌ها', () => action('آموزشِ مدل', '/api/reos/train', 'train'), 'train', true)}
            {btn('اجرای دورِ AutoML', runAutoml, 'automl')}
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🤖 AutoML — ارتقای خودکارِ مدل</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>سیستم چالش‌گر را با قهرمان می‌سنجد و در صورتِ برتریِ مطمئن، خودکار ارتقا می‌دهد (هر ۶ ساعت + دستی).</div>
            {aml.map(m => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, minWidth: 60 }}>{m.name === 'engage' ? 'تعامل' : m.name === 'lead' ? 'لید' : m.name}</span>
                <span style={{ color: 'var(--muted)' }}>قهرمان: {m.champion ? `v${fa(m.champion.version)} (AUC ${m.champion.metric.toLocaleString('fa-IR')})` : '—'}</span>
                <span style={{ color: 'var(--muted)', flex: 1 }}>چالش‌گر: {m.challenger ? `v${fa(m.challenger.version)} (AUC ${m.challenger.metric.toLocaleString('fa-IR')})` : '—'}</span>
                {m.wouldPromote ? <span style={{ fontSize: 10.5, fontWeight: 700, color: '#34d399', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 999 }}>آمادهٔ ارتقا</span> : <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>پایدار</span>}
              </div>
            ))}
            {!aml.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هنوز مدلی ثبت نشده — «آموزشِ مدل‌ها» را بزنید.</div>}
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>مدل‌های REOS (شفافیت: آموزش‌دیده / فرمول)</div>
            {catalog.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: m.type === 'trained' ? '#34d399' : m.type === 'online' ? '#60a5fa' : m.type === 'embedding' ? '#a78bfa' : 'var(--muted)', background: 'var(--bg2)' }}>{m.type === 'trained' ? 'آموزش‌دیده' : m.type === 'online' ? 'آنلاین' : m.type === 'embedding' ? 'برداری' : 'فرمول'}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{m.name}</div><div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{m.purpose}</div></div>
                <span style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'left' }}>{m.status}{m.metric ? ` · ${m.metric}` : ''}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Model Registry — نسخه‌های مدلِ engage</div>
            {models.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز نسخه‌ای ثبت نشده.</div> :
              models.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 800, color: 'var(--gold)' }}>v{fa(m.version)}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: m.status === 'champion' ? '#34d399' : m.status === 'retired' ? 'var(--faint)' : '#e7a14a', background: 'var(--bg2)' }}>{m.status === 'champion' ? 'قهرمان' : m.status === 'challenger' ? 'چالش‌گر' : m.status === 'retired' ? 'بازنشسته' : 'نامزد'}</span>
                  <span style={{ color: 'var(--muted)', flex: 1 }}>AUC {(m.metrics.auc || 0).toLocaleString('fa-IR')} · n {fa(m.metrics.n || 0)}</span>
                  {m.status !== 'champion' && btn('ارتقا به قهرمان', () => promote(m.id), 'promote' + m.id)}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ══════ فلگ‌های ویژگی ══════ */}
      {tab === 'flags' && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🚩 فلگ‌های ویژگی</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>هر لایه را مستقل روشن/خاموش یا تدریجی عرضه کنید — مثلاً «اقتدار فقط ۱۰٪ کاربران» یا «فقط تهران».</div>
          {flags.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>در حال بارگذاری…</div>}
          {flags.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)', fontSize: 12.5, flexWrap: 'wrap' }}>
              <button onClick={() => saveFlag(f.key, { enabled: !f.enabled })} style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: f.enabled ? '#34d399' : 'var(--line2)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, insetInlineStart: f.enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'all .15s' }} />
              </button>
              <div style={{ flex: 1, minWidth: 140 }}><div style={{ fontWeight: 700 }}>{f.label}</div><div style={{ fontSize: 10, color: 'var(--faint)' }}>{f.key}</div></div>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>عرضه٪</label>
              <input type="number" min={0} max={100} defaultValue={f.rolloutPct} onBlur={e => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== f.rolloutPct) saveFlag(f.key, { rolloutPct: v }) }} style={{ width: 60, padding: '5px 7px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12, textAlign: 'center' }} />
              <input placeholder="شهرها (با ،)" defaultValue={(f.cities || []).join('،')} onBlur={e => saveFlag(f.key, { cities: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean) })} style={{ width: 130, padding: '5px 8px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 11 }} />
            </div>
          ))}
        </div>
      )}

      {/* ══════ ابزارها و تحلیل ══════ */}
      {tab === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>بازمحاسبه‌ها و همگام‌سازی</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {btn('🏆 همگام‌سازیِ اقتدارِ بازار', syncTerritory, 'terr', true)}
              {btn('بازمحاسبهٔ هوشِ بازار', () => action('هوشِ بازار', '/api/reos/market-intel', 'mi'), 'mi')}
              {btn('بازمحاسبهٔ ویژگی‌های بازار', () => action('ویژگی‌های بازار', '/api/reos/market', 'mf'), 'mf')}
              {btn('همگام‌سازیِ گراف', () => action('گراف', '/api/reos/graph', 'gr'), 'gr')}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>تأییدِ اعتماد (Verified)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={vId} onChange={e => setVId(e.target.value)} placeholder="شمارهٔ کاربر/شناسه" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12 }} />
              <select value={vKind} onChange={e => setVKind(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12 }}>
                {[['identity', 'احرازِ هویت'], ['agency', 'آژانس'], ['builder', 'سازنده'], ['expert', 'کارشناس'], ['property', 'ملک']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              {btn('تأیید کن', verify, 'verify', true)}
            </div>
          </div>
          <ReosExperimentsAdmin />
          <ReosAttributionAdmin />
          <ReosGeoHeat />
        </div>
      )}
    </div>
  )
}

// ── 🏋️ فاز ۱۸۹ — سلامتِ ترین: دفترِ اجراهای واقعی + دکمهٔ «ترینِ الان» ─────────────────────────
const faT = (at: number) => at ? new Date(at).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const agoFa = (at: number) => { if (!at) return 'هرگز'; const m = Math.floor((Date.now() - at) / 60000); return m < 1 ? 'همین الان' : m < 60 ? `${m.toLocaleString('fa-IR')} دقیقه پیش` : m < 1440 ? `${Math.floor(m / 60).toLocaleString('fa-IR')} ساعت پیش` : `${Math.floor(m / 1440).toLocaleString('fa-IR')} روز پیش` }
const KIND_FA: Record<string, string> = { engage: 'مدلِ تعامل', lead: 'مدلِ لید', graph: 'گرافِ دانش' }
function Reos189Training({ ov, reload }: { ov: Overview; reload: () => void }) {
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState('')
  const t = ov.training
  const stale = !!t && (!t.lastAt || Date.now() - t.lastAt > Math.max(1, t.autoHours) * 2 * 3600e3)
  const trainNow = async () => {
    setBusy(true); setRes('')
    const d = await fetch('/api/reos/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'train' }) }).then(r => r.json()).catch(() => null)
    setBusy(false)
    if (d?.ok) { const e = d.results?.engage, l = d.results?.lead; setRes(`✓ ترین انجام شد — تعامل: ${e?.error ? 'خطا' : `n=${(e?.n || 0).toLocaleString('fa-IR')}، AUC=${e?.auc ?? '—'}${e?.usedDefault ? ' (دادهٔ کم → پیش‌فرض)' : ''}`} · لید: ${l?.error ? 'خطا' : `n=${(l?.n || 0).toLocaleString('fa-IR')}، AUC=${l?.auc ?? '—'}`}`); reload() }
    else setRes('خطا در ترین — لاگِ سرور را ببین')
  }
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>🏋️ سلامتِ یادگیری (ترینِ خودکار)</div>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: stale ? 'rgba(240,82,82,.12)' : 'rgba(52,211,153,.12)', color: stale ? '#f05252' : '#34d399' }}>
          {stale ? `⚠ آخرین ترین: ${agoFa(t?.lastAt || 0)} — عقب است` : `✓ آخرین ترین: ${agoFa(t?.lastAt || 0)}`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>هر {(t?.autoHours || 6).toLocaleString('fa-IR')} ساعت خودکار{t?.enabled === false ? ' (خاموش!)' : ''} · روی اینستنسِ ۰</span>
        <span style={{ flex: 1 }} />
        <button disabled={busy} onClick={trainNow} style={{ background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'در حالِ ترین…' : '🧠 ترینِ الان'}</button>
      </div>
      {res && <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 8 }}>{res}</div>}
      {!t?.runs?.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز هیچ اجرایی ثبت نشده — دکمهٔ «ترینِ الان» را بزن یا منتظرِ چرخهٔ خودکار بمان. (اگر بعدِ چند ساعت هم خالی ماند، کرونِ اینستنسِ ۰ را چک کن.)</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'right' }}><th style={{ padding: '4px 6px' }}>زمان</th><th style={{ padding: '4px 6px' }}>مدل</th><th style={{ padding: '4px 6px' }}>نمونه‌ها</th><th style={{ padding: '4px 6px' }}>AUC</th><th style={{ padding: '4px 6px' }}>مدت</th><th style={{ padding: '4px 6px' }}>وضعیت</th></tr></thead>
            <tbody>
              {t.runs.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{faT(r.at)}</td>
                  <td style={{ padding: '5px 6px' }}>{KIND_FA[r.kind] || r.kind}</td>
                  <td style={{ padding: '5px 6px' }}>{r.n != null ? r.n.toLocaleString('fa-IR') : '—'}</td>
                  <td style={{ padding: '5px 6px' }}>{r.auc != null ? String(r.auc) : '—'}</td>
                  <td style={{ padding: '5px 6px' }}>{Math.round((r.ms || 0) / 100) / 10} ث</td>
                  <td style={{ padding: '5px 6px', color: r.ok ? '#34d399' : '#f05252' }}>{r.ok ? '✓' : '✗'} <span style={{ color: 'var(--muted)' }}>{r.note || ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!ov.coverage?.length && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>🩺 تازگیِ منابعِ یادگیری (هر نوع رویداد آخرین‌بار کی رسید؟)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ov.coverage.map(c => {
              const dead = !c.lastAt || Date.now() - c.lastAt > 48 * 3600e3
              return <span key={c.type} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 99, background: 'var(--bg2)', border: `1px solid ${dead ? 'rgba(240,82,82,.4)' : 'var(--line)'}` }}>
                {EV_LABEL[c.type] || c.type}: <b>{c.count.toLocaleString('fa-IR')}</b> · <span style={{ color: dead ? '#f05252' : '#34d399' }}>{agoFa(c.lastAt)}</span>
              </span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 👤 فاز ۱۸۹ — شناختِ کاربر از رفتارِ واقعی: جستجوی پروفایلِ رفتاری + پرتعامل‌ترین‌ها ────────────
const faB189 = (n: number) => n >= 1e9 ? `${Math.round(n / 1e8) / 10} میلیارد` : n >= 1e6 ? `${Math.round(n / 1e5) / 10} میلیون` : n.toLocaleString('fa-IR')
function Reos189Users({ ov }: { ov: Overview }) {
  const [phone, setPhone] = useState('')
  const [p, setP] = useState<UProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const lookup = async (ph: string) => {
    if (!ph.trim()) return
    setBusy(true)
    const d = await fetch(`/api/reos/admin?profile=${encodeURIComponent(ph.trim())}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    setBusy(false)
    if (d?.ok) setP(d.profile)
  }
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>👤 شناختِ کاربر از رفتارِ واقعی</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>پروفایلِ رفتاری ۱۰۰٪ از رویدادهای واقعی ساخته می‌شود: بازدید/ذخیره/جستجو/تماس، محله‌های محبوب و بازهٔ قیمتیِ واقعاً دیده‌شده.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lookup(phone) }} placeholder="شمارهٔ کاربر (مثلاً ۰۹۱۲…)" dir="ltr"
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
        <button disabled={busy || !phone.trim()} onClick={() => lookup(phone)} style={{ background: 'var(--gold)', color: '#1a1503', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? '…' : 'بشناس'}</button>
      </div>
      {p && (
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <b style={{ fontSize: 13 }} dir="ltr">{p.userId}</b>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: p.known ? 'rgba(52,211,153,.12)' : 'rgba(240,173,78,.12)', color: p.known ? '#34d399' : '#f0ad4e' }}>{p.known ? '✓ شناخته‌شده' : 'هنوز شناختِ کافی نیست'}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>آخرین فعالیت: {agoFa(p.lastActiveAt || 0)} · امتیازِ تعامل: {p.engagement.toLocaleString('fa-IR')}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 8 }}>
            <span>👁 بازدید: <b>{p.views.toLocaleString('fa-IR')}</b></span>
            <span>♥ ذخیره: <b>{p.saves.toLocaleString('fa-IR')}</b></span>
            <span>🔎 جستجو: <b>{p.searches.toLocaleString('fa-IR')}</b></span>
            <span>☎ تماس: <b>{p.contacts.toLocaleString('fa-IR')}</b></span>
          </div>
          {!!p.topHoods.length && <div style={{ fontSize: 12.5, marginBottom: 6 }}>📍 محله‌های محبوب: {p.topHoods.map(h => `${h.hood} (${h.count.toLocaleString('fa-IR')})`).join('، ')}</div>}
          {p.priceBand && <div style={{ fontSize: 12.5, marginBottom: 6 }}>💰 بازهٔ قیمتیِ دیده‌شده: {faB189(p.priceBand.min)} تا {faB189(p.priceBand.max)} (میانه {faB189(p.priceBand.median)})</div>}
          {!!p.recentQueries.length && <div style={{ fontSize: 12.5 }}>⌨️ جستجوهای اخیر: {p.recentQueries.map(q => `«${q}»`).join('، ')}</div>}
          {!p.events && <div style={{ fontSize: 12, color: 'var(--muted)' }}>هیچ رویدادی از این کاربر ثبت نشده.</div>}
        </div>
      )}
      {!!ov.topUsers?.length && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>پرتعامل‌ترین کاربران (امتیازِ یادگرفته‌شده)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ov.topUsers.map(u => <button key={u.userId} onClick={() => { setPhone(u.userId); lookup(u.userId) }} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 99, background: 'var(--bg2)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }} dir="ltr">{u.userId} · {u.engagement.toLocaleString('fa-IR')}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}
