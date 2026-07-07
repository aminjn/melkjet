'use client'
import { useEffect, useState } from 'react'

// مرکزِ کنترلِ REOS برای سوپرادمین — تنظیماتِ واقعیِ همهٔ موتورها + دکمه‌های اکشن.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, marginTop: 16, fontFamily: FONT, direction: 'rtl' }
type Cfg = Record<string, Record<string, unknown>>

export default function ReosControlCenter() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [vId, setVId] = useState(''); const [vKind, setVKind] = useState('identity')
  const [models, setModels] = useState<{ id: string; version: number; status: string; metrics: Record<string, number> }[]>([])
  const [catalog, setCatalog] = useState<{ key: string; name: string; purpose: string; type: string; status: string; metric?: string }[]>([])

  const loadCfg = () => fetch('/api/reos/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(d.config) }).catch(() => {})
  const loadModels = () => fetch('/api/reos/models?name=engage', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setModels(d.versions || []) }).catch(() => {})
  const loadCatalog = () => fetch('/api/reos/catalog', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setCatalog(d.models || []) }).catch(() => {})
  useEffect(() => { loadCfg(); loadModels(); loadCatalog() }, [])

  const setPath = (section: string, key: string, val: string, sub?: string) => {
    setCfg(c => { if (!c) return c; const n = JSON.parse(JSON.stringify(c)); const num = val === '' ? '' : (isNaN(Number(val)) ? val : Number(val)); if (sub) n[section][key][sub] = num; else n[section][key] = num; return n })
  }
  const save = async () => {
    setBusy('save')
    const d = await fetch('/api/reos/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: cfg }) }).then(r => r.json()).catch(() => null)
    setBusy(''); setMsg(d?.ok ? 'تنظیمات ذخیره شد ✓ (روی موتورها اعمال شد)' : 'خطا در ذخیره'); setTimeout(() => setMsg(''), 3000)
  }
  const reset = async () => { setBusy('reset'); await fetch('/api/reos/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) }); await loadCfg(); setBusy(''); setMsg('به پیش‌فرض بازگشت ✓'); setTimeout(() => setMsg(''), 3000) }
  const action = async (label: string, url: string, key: string) => {
    setBusy(key); const d = await fetch(url, { method: 'POST' }).then(r => r.json()).catch(() => null)
    setBusy(''); setMsg(`${label}: ${d?.message || (d?.ok ? 'انجام شد ✓' : d?.error || 'خطا')}`); setTimeout(() => setMsg(''), 4000); if (url.includes('/train')) loadModels()
  }
  const verify = async () => {
    if (!vId) return; setBusy('verify')
    const d = await fetch('/api/reos/trust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', entityId: vId, verification: vKind, on: true }) }).then(r => r.json()).catch(() => null)
    setBusy(''); setMsg(d?.ok ? `تأیید شد ✓ (اعتماد: ${d.trust?.score})` : d?.error || 'خطا'); setTimeout(() => setMsg(''), 4000)
  }
  const promote = async (id: string) => { setBusy('promote' + id); await fetch('/api/reos/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promote', id }) }); await loadModels(); setBusy('') }
  const syncTerritory = async () => {
    setBusy('terr'); const d = await fetch('/api/reos/territory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) }).then(r => r.json()).catch(() => null)
    setBusy(''); setMsg(d?.ok ? `اقتدارِ بازار همگام شد ✓ (${(d.result?.records || 0).toLocaleString('fa-IR')} رکورد در ${(d.result?.territories || 0).toLocaleString('fa-IR')} قلمرو)` : d?.error || 'خطا'); setTimeout(() => setMsg(''), 5000)
  }

  const inp = (section: string, key: string, sub?: string) => {
    const v = cfg ? (sub ? (cfg[section][key] as Record<string, unknown>)[sub] : cfg[section][key]) : ''
    return <input value={String(v ?? '')} onChange={e => setPath(section, key, e.target.value, sub)} style={{ width: 74, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12, textAlign: 'center' }} />
  }
  const row = (label: string, node: React.ReactNode) => <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 120 }}>{label}</span>{node}</div>
  const btn = (label: string, onClick: () => void, key: string, primary = false) => <button onClick={onClick} disabled={!!busy} style={{ padding: '8px 14px', borderRadius: 9, border: primary ? 'none' : '1px solid var(--line2)', background: primary ? 'linear-gradient(140deg,var(--gold2),var(--gold))' : 'var(--bg2)', color: primary ? '#16140f' : 'var(--muted)', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: FONT, fontSize: 12.5 }}>{busy === key ? '…' : label}</button>

  return (
    <div>
      <div style={{ ...card, borderColor: 'var(--gold)' }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>⚙️ مرکزِ کنترلِ REOS (سوپرادمین)</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14 }}>این تنظیمات مستقیماً روی موتورهای زنده اعمال می‌شوند.</div>
        {msg && <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, color: 'var(--gold)', marginBottom: 12 }}>{msg}</div>}

        {/* اکشن‌ها */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {btn('↻ آموزشِ مدل', () => action('آموزشِ مدل', '/api/reos/train', 'train'), 'train', true)}
          {btn('بازمحاسبهٔ هوشِ بازار', () => action('هوشِ بازار', '/api/reos/market-intel', 'mi'), 'mi')}
          {btn('بازمحاسبهٔ ویژگی‌های بازار', () => action('ویژگی‌های بازار', '/api/reos/market', 'mf'), 'mf')}
          {btn('همگام‌سازیِ گراف', () => action('گراف', '/api/reos/graph', 'gr'), 'gr')}
          {btn('🏆 همگام‌سازیِ اقتدارِ بازار', syncTerritory, 'terr')}
        </div>

        {/* تنظیمات */}
        {cfg && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>یادگیریِ آنلاین (RL)</div>
              {row('نرخِ یادگیری (lr)', inp('rl', 'lr'))}
              {row('اکتشاف (epsilon)', inp('rl', 'epsilon'))}
              {row('پاداشِ تماس', inp('rl', 'rewards', 'contact'))}
              {row('پاداشِ قرارداد', inp('rl', 'rewards', 'contract'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>تبلیغات (Boost)</div>
              {row('نردبان', inp('promotion', 'boost'))}
              {row('ویژه', inp('promotion', 'featured'))}
              {row('VIP', inp('promotion', 'vip'))}
              {row('گیتِ کیفیت (۱/۰)', inp('promotion', 'trustGate'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>آموزش + Gateway</div>
              {row('آموزشِ خودکار هر (ساعت)', inp('training', 'autoHours'))}
              {row('آموزشِ خودکار فعال (۱/۰)', inp('training', 'enabled'))}
              {row('مدلِ لیدِ آموزش‌دیده (۱/۰)', inp('training', 'useLearnedLead'))}
              {row('کشِ AI (دقیقه)', inp('gateway', 'cacheTtlMin'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>وزن‌های اعتماد</div>
              {row('تأیید', inp('trust', 'weights', 'verified'))}
              {row('معاملات', inp('trust', 'weights', 'deals'))}
              {row('امتیاز', inp('trust', 'weights', 'rating'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>وزن‌های رتبه‌بندیِ فید</div>
              {row('تطابقِ کاربر', inp('feed', 'rankWeights', 'userMatch'))}
              {row('کیفیت', inp('feed', 'rankWeights', 'quality'))}
              {row('تعامل', inp('feed', 'rankWeights', 'engagement'))}
              {row('تازگی', inp('feed', 'rankWeights', 'freshness'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>وزن‌های امتیازِ Global</div>
              {row('بودجه', inp('scoring', 'budget'))}
              {row('موقعیت', inp('scoring', 'location'))}
              {row('رفتار', inp('scoring', 'behavior'))}
              {row('نیت', inp('scoring', 'intent'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>اقتدارِ بازار (Market Dominance)</div>
              {row('وزنِ معاملات', inp('territory', 'weights', 'transactions'))}
              {row('وزنِ تبدیلِ لید', inp('territory', 'weights', 'leadConversion'))}
              {row('وزنِ کیفیتِ آگهی', inp('territory', 'weights', 'listingQuality'))}
              {row('روزهای نبرد', inp('territory', 'battleDays'))}
              {row('آستانهٔ تقلب', inp('territory', 'fraudThreshold'))}
              {row('وزنِ اعتبار در فید', inp('territory', 'feedAuthority'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>اقتصادِ پاداش + XP</div>
              {row('کمیسیونِ معامله', inp('economy', 'commissionPct'))}
              {row('پورسانتِ معرف', inp('economy', 'affiliatePct'))}
              {row('پاداشِ وفاداری', inp('economy', 'loyaltyBonusPct'))}
              {row('XP پاداشِ مأموریت', inp('economy', 'missionRewardXp'))}
              {row('اعتبارِ مأموریت', inp('economy', 'missionRewardCredit'))}
              {row('پایهٔ منحنیِ سطح', inp('xp', 'levelBase'))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--gold)' }}>اعتبارِ اجتماعی (Community)</div>
              {row('وزنِ دنبال‌کننده', inp('community', 'weights', 'followers'))}
              {row('وزنِ اقتدار', inp('community', 'weights', 'dominance'))}
              {row('وزنِ اعتماد', inp('community', 'weights', 'trust'))}
              {row('وزنِ سطح', inp('community', 'weights', 'level'))}
              {row('حداکثر طولِ نظر', inp('community', 'commentMaxLen'))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {btn('💾 ذخیرهٔ تنظیمات', save, 'save', true)}
          {btn('بازگردانی به پیش‌فرض', reset, 'reset')}
        </div>
      </div>

      {/* تأییدِ اعتماد */}
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

      {/* Model Catalog / Marketplace */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>مدل‌های REOS (شفافیت: کدام آموزش‌دیده، کدام فرمول)</div>
        {catalog.map(m => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: m.type === 'trained' ? '#34d399' : m.type === 'online' ? '#60a5fa' : m.type === 'embedding' ? '#a78bfa' : 'var(--muted)', background: 'var(--bg2)' }}>{m.type === 'trained' ? 'آموزش‌دیده' : m.type === 'online' ? 'آنلاین' : m.type === 'embedding' ? 'برداری' : 'فرمول'}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700 }}>{m.name}</div><div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{m.purpose}</div></div>
            <span style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'left' }}>{m.status}{m.metric ? ` · ${m.metric}` : ''}</span>
          </div>
        ))}
      </div>

      {/* Model Registry */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Model Registry — نسخه‌های مدلِ engage</div>
        {models.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز نسخه‌ای ثبت نشده — «آموزشِ مدل» را بزنید.</div> :
          models.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              <span style={{ fontWeight: 800, color: 'var(--gold)' }}>v{m.version.toLocaleString('fa-IR')}</span>
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: m.status === 'champion' ? '#34d399' : m.status === 'retired' ? 'var(--faint)' : '#e7a14a', background: 'var(--bg2)' }}>{m.status === 'champion' ? 'قهرمان' : m.status === 'challenger' ? 'چالش‌گر' : m.status === 'retired' ? 'بازنشسته' : 'نامزد'}</span>
              <span style={{ color: 'var(--muted)', flex: 1 }}>AUC {(m.metrics.auc || 0).toLocaleString('fa-IR')} · n {(m.metrics.n || 0).toLocaleString('fa-IR')}</span>
              {m.status !== 'champion' && btn('ارتقا به قهرمان', () => promote(m.id), 'promote' + m.id)}
            </div>
          ))}
      </div>
    </div>
  )
}
