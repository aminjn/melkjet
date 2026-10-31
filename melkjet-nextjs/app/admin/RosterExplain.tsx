'use client'
import { useState } from 'react'

// فاز ۳۴۴ (پورت از خودروجت، فاز ۳۴۸–۳۵۲) — ابزارِ «دیدن و سنجیدن» برای مالک در پنلِ رُستر:
//   • NameStatsLine: آمارِ آخرین سینک — AI روشن بود؟ با کدام مدل؟ هر نام از کجا آمد؟ + شاخص‌های قرمز
//   • SrcBadge: منبعِ تصمیمِ هر مشاور (AI / امضا / ماشین / چسبیده)
//   • UnnamedExplain: «🔍 چرا بی‌نام؟» — همان متنی که به AI رفته، جوابِ AI، حدسِ ماشین، علت، و «✅ این نام است»
const fa = (n: number) => Number(n || 0).toLocaleString('fa-IR')
const chip: React.CSSProperties = { fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }
const RED: React.CSSProperties = { ...chip, background: 'rgba(231,103,74,.14)', color: '#e7674a', fontWeight: 800 }

export interface NameStatsLite {
  aiOn: boolean; model?: string; rows: number; aiAnswered: number; aiNamed: number; aiRejected: number
  byAI: number; bySig: number; byMachine: number; byClaim: number; unnamed: number
  skippedSig?: number; failedBatches: number; gaveUp: boolean; budgetHit: boolean; metaText?: number; textMissing?: number; unnamedSigLike?: number
}

export function NameStatsLine({ st }: { st?: NameStatsLite }) {
  if (!st) return null
  const pending = st.rows - st.aiAnswered - (st.skippedSig || 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5 }}>
      {st.aiOn
        ? <span style={{ ...chip, background: 'rgba(95,217,138,.12)', color: '#5fd98a' }} title="مدلِ RosterAgent یا مدلِ محتوا/چت">🤖 AI روشن{st.model ? ` · ${st.model}` : ''} — خواند {fa(st.aiAnswered)}/{fa(st.rows)}</span>
        : <span style={RED} title="پنل → API و مدل‌های AI → مدلِ RosterAgent + روشن‌کردنِ بخشِ روستر">⚠ AI خاموش — نام‌ها را فقط قاعده/ماشین داد</span>}
      {!!st.skippedSig && <span style={{ ...chip, background: 'var(--bg2)', color: 'var(--muted)' }} title="امضای صریح با قاعده حل شد و به AI نرفت">✍ {fa(st.skippedSig)} امضای قطعی</span>}
      <span style={{ ...chip, background: 'var(--bg2)', color: 'var(--muted)' }} title="منبعِ نامِ آگهی‌های نام‌دار">
        منبع: AI {fa(st.byAI)} · امضا {fa(st.bySig)} · ماشین {fa(st.byMachine)}{st.byClaim ? ` · چسبیده ${fa(st.byClaim)}` : ''}
      </span>
      {st.aiRejected > 0 && <span style={{ ...chip, background: 'rgba(231,161,74,.12)', color: '#e7a14a' }} title="نامِ AI که در متن/موضعِ امضا نبود">✗ {fa(st.aiRejected)} نامِ AI رد شد</span>}
      {st.aiOn && pending > 0 && (st.budgetHit || st.gaveUp) && <span style={RED}>⏳ {fa(pending)} آگهی هنوز به AI نرسید{st.gaveUp ? ' (AI پشتِ‌سرِهم جواب نداد)' : ' (سقفِ زمان)'} — سینکِ بعد</span>}
      {!!st.textMissing && <span style={RED} title="دیوار جواب نداد/کند بود؛ سینکِ بعد دوباره می‌خواند">⚠ متنِ {fa(st.textMissing)} آگهی خوانده نشد</span>}
      {!!st.unnamedSigLike && <span style={RED} title="آگهیِ بی‌نامی که خطِ امضا دارد — احتمالاً نامی از دست رفته؛ «چرا بی‌نام؟» را ببین">⚠ {fa(st.unnamedSigLike)} آگهیِ بی‌نام خطِ امضا دارند</span>}
      {!!st.metaText && <span style={{ ...chip, background: 'var(--bg2)', color: 'var(--faint)' }} title="متنِ این آگهی‌ها فقط تاریخِ انتشار/نردبانِ دیوار بود">⛔ {fa(st.metaText)} متن = تاریخِ انتشار</span>}
    </div>
  )
}

export function SrcBadge({ src }: { src?: { ai: number; sig: number; machine: number; claim: number } }) {
  if (!src) return null
  const parts: [string, number, string][] = [['🤖 AI', src.ai, '#5fd98a'], ['✍ امضا', src.sig, '#60a5fa'], ['⚙ ماشین', src.machine, '#e7a14a'], ['🔗 چسبیده', src.claim, 'var(--muted)']]
  const shown = parts.filter(p => p[1] > 0)
  if (!shown.length) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4 }} title="چه کسی این نام را داد (تعدادِ آگهی)">
      {shown.map(([l, n, c]) => <span key={l} style={{ ...chip, fontSize: 10.5, background: 'var(--bg)', color: c, border: '1px solid var(--line2)' }}>{l} {fa(n)}</span>)}
    </span>
  )
}

interface ExRow {
  token: string; title: string; text: string; ai: string; aiAsked: boolean; aiRejected: boolean
  machine: string; signature: boolean; reason: string; sigLine?: string; oldText?: boolean; metaText?: boolean; noText?: boolean
}

export function UnnamedExplain({ id }: { id: string }) {
  const [rows, setRows] = useState<ExRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [openTok, setOpenTok] = useState('')
  const [msg, setMsg] = useState('')
  const load = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/admin/agency-roster?explain=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) setErr(j.error || 'خطا'); else setRows(j.rows || [])
    } catch (e: any) { setErr(String(e?.message || e)) }
    setBusy(false)
  }
  // «✅ این نام است» → فهرستِ سفید (سراسری؛ نقش/لقب را سرور خودش جدا می‌کند — «کارشناس خانم X» ⇒ «X»).
  const whitelist = async (guess: string) => {
    const name = (window.prompt('نامِ مشاور (فقط نام — بدونِ «کارشناس/خانم/آقای»):', guess) || '').trim()
    if (!name) return
    try {
      const cur = await (await fetch('/api/admin/roster-name-rules', { cache: 'no-store' })).json()
      const rules = cur?.rules || { blacklist: [], whitelist: [] }
      const r = await fetch('/api/admin/roster-name-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blacklist: rules.blacklist, whitelist: [...rules.whitelist, name] }) })
      const j = await r.json()
      if (!j.ok) { setMsg(j.error || 'خطا'); return }
      // نامی که واقعاً ذخیره شد (سرور نقش/لقب را جدا می‌کند: «کارشناس خانم X» ⇒ «X»)
      const saved = String((j?.rules?.whitelist || []).find((w: string) => name.includes(w) && w.length > 1) || name)
      // فاز ۳۴۴ب (فیدبکِ مالک: «می‌زنم این نام است، انگار هیچ اتفاقی نمی‌افتد») — همهٔ آگهی‌های همین فهرست که این نام
      // در متنشان هست همان لحظه کنار می‌روند و شمرده می‌شوند، و همگام‌سازیِ همین آژانس فوراً در صف می‌رود تا اثرش دیده شود.
      const words = saved.replace(/\u200c/g, ' ').split(/\s+/).filter(Boolean)
      const has = (t: string) => { const tt = (t || '').replace(/\u200c/g, ' '); return words.every(w => tt.includes(w)) }
      const hit = (rows || []).filter(x => has(x.text)).length
      setRows(rs => (rs || []).filter(x => !has(x.text)))
      let queued = false
      try { const q = await fetch('/api/admin/agency-roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', id }) }); queued = q.ok } catch {}
      setMsg(`✅ «${saved}» در فهرستِ سفید ثبت شد — ${fa(hit)} آگهیِ این فهرست این نام را دارند و به «${saved}» می‌رسند. ${queued ? '🔄 همگام‌سازیِ این آژانس در صف رفت (چند دقیقهٔ دیگر در فهرستِ مشاوران می‌آید).' : 'برای اعمال، «همگام‌سازی الان» را بزن.'}`)
    } catch (e: any) { setMsg(String(e?.message || e)) }
  }
  if (!rows) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={load} disabled={busy} style={{ background: 'transparent', border: '1px solid var(--line2)', borderRadius: 8, padding: '5px 10px', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? '…' : '🔍 چرا بی‌نام؟'}</button>
      {err && <span style={{ fontSize: 11.5, color: '#e06666' }}>{err}</span>}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12.5 }}>🔍 چرا بی‌نام؟</b>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fa(rows.length)} آگهی (آن‌ها که «خطِ امضا» دارند اول)</span>
        <button onClick={() => setRows(null)} style={{ marginInlineStart: 'auto', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 8, padding: '3px 9px', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>بستن</button>
      </div>
      {/* فاز ۳۴۴د (فیدبکِ مالک: «این چیه؟») — آگهی‌هایی که خوانندهٔ قدیمی به‌جای متنِ آگهی «تاریخِ انتشار» را ذخیره کرده بود
          (یا متنشان اصلاً نیامده): توضیحِ ساده + دکمهٔ «همین الان دوباره بخوان» به‌جای برچسبِ فنیِ بی‌توضیح. */}
      {(() => {
        const stale = rows.filter(x => x.metaText || x.noText).length
        const old = rows.filter(x => x.oldText && !x.metaText && !x.noText).length
        if (!stale && !old) return null
        return (
          <div style={{ fontSize: 12.5, lineHeight: 2, background: 'rgba(231,161,74,.09)', border: '1px solid rgba(231,161,74,.35)', borderRadius: 10, padding: '9px 12px', color: 'var(--text)' }}>
            {stale > 0 && <div>⛔ <b>{fa(stale)} آگهی</b> اصلاً «متن» ندارند: خوانندهٔ قدیمیِ دیوار به‌جای توضیحاتِ آگهی فقط خطِ «انتشار آگهی / آخرین نردبان» (تاریخ) را برداشته بود — پس نه AI و نه ماشین چیزی برای پیدا کردنِ نام نداشتند.</div>}
            {old > 0 && <div>📄 <b>{fa(old)} آگهی</b> با خوانندهٔ قدیمی خوانده شده‌اند و ممکن است متنشان ناقص باشد.</div>}
            <div style={{ color: 'var(--muted)' }}>خوانندهٔ جدید متنِ خودِ فروشنده را می‌خواند؛ این آگهی‌ها در همگام‌سازیِ بعد خودکار دوباره خوانده می‌شوند.</div>
            <button onClick={async () => {
              try { const q = await fetch('/api/admin/agency-roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', id }) }); setMsg(q.ok ? '🔄 همگام‌سازیِ این آژانس در صف رفت — متن‌ها از دیوار دوباره خوانده و به AI داده می‌شوند (چند دقیقه).' : 'خطا در صف‌گذاری') } catch (e: any) { setMsg(String(e?.message || e)) }
            }} style={{ marginTop: 6, background: 'var(--gold)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#1a1400', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🔄 همین الان دوباره از دیوار بخوان</button>
          </div>
        )
      })()}
      {msg && <div style={{ fontSize: 12.5, color: '#5fd98a', background: 'rgba(95,217,138,.08)', border: '1px solid rgba(95,217,138,.3)', borderRadius: 8, padding: '7px 10px', lineHeight: 1.9 }}>{msg}</div>}
      {!rows.length && <div style={{ fontSize: 12, color: 'var(--faint)' }}>آگهیِ بی‌نامی نیست.</div>}
      {rows.map(r => (
        <div key={r.token} style={{ border: `1px solid ${r.sigLine ? 'rgba(231,103,74,.45)' : 'var(--line2)'}`, borderRadius: 10, padding: '8px 10px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            <a href={`https://divar.ir/v/${r.token}`} target="_blank" rel="noreferrer" dir="ltr" style={{ color: 'var(--gold)', fontSize: 11.5 }}>{r.token} ↗</a>
            <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{r.title}</span>
            {r.metaText && <span style={RED} title="به‌جای متنِ آگهی فقط تاریخِ انتشار/نردبانِ دیوار ذخیره شده بود">⛔ متن ندارد (فقط تاریخِ انتشار)</span>}
            {r.noText && <span style={RED}>⚠ متن خوانده نشده</span>}
            {r.oldText && <span style={{ ...chip, background: 'var(--bg2)', color: 'var(--faint)' }} title="با خوانشِ قدیمیِ دیوار ذخیره شده — در سینک‌های بعد تازه می‌شود">خوانشِ قدیمی</span>}
            {r.sigLine && <span style={RED} title={r.sigLine}>⚠ خطِ امضا دارد</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5, fontSize: 11.5, color: 'var(--muted)' }}>
            <span>AI: {r.ai ? <b style={{ color: r.aiRejected ? '#e7674a' : '#5fd98a' }}>«{r.ai}»{r.aiRejected ? ' (رد شد)' : ''}</b> : r.aiAsked ? 'بی‌امضا' : <span style={{ color: 'var(--faint)' }}>نپرسیده</span>}</span>
            <span>ماشین: {r.machine ? <b style={{ color: 'var(--text)' }}>«{r.machine}»</b> : '—'}{r.signature ? ' (امضای صریح)' : ''}</span>
          </div>
          {r.sigLine && <div style={{ marginTop: 4, fontSize: 11.5, color: '#e7674a' }}>خطِ امضا: «{r.sigLine}»</div>}
          <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text)', lineHeight: 1.8 }}>علت: {r.reason}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {!!r.text && <button onClick={() => setOpenTok(openTok === r.token ? '' : r.token)} style={{ background: 'transparent', border: '1px solid var(--line2)', borderRadius: 8, padding: '3px 9px', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>{openTok === r.token ? 'بستنِ متن' : 'متنی که به AI رفت'}</button>}
            {!r.metaText && !r.noText && <button onClick={() => whitelist(r.ai || r.machine)} style={{ background: 'transparent', border: '1px solid rgba(95,217,138,.45)', borderRadius: 8, padding: '3px 9px', color: '#5fd98a', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>✅ این نام است</button>}
          </div>
          {openTok === r.token && <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.9, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', maxHeight: 280, overflow: 'auto', direction: 'rtl' }}>{r.text}</pre>}
        </div>
      ))}
    </div>
  )
}
