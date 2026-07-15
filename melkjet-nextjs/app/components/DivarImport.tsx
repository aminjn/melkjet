'use client'
import { useCallback, useEffect, useState } from 'react'

// «ایمپورت از دیوار» — قابلِ استفاده در پنلِ مشاور و آژانس. session-scoped است
// (هر کاربر فقط دادهٔ خودش). onChange بعد از ایمپورت/سینک برای رفرشِ فایل‌های والد.

const FONT = 'Vazirmatn, system-ui, sans-serif'
type Sched = 'off' | 'hourly' | '6h' | 'daily'
interface DImport { token: string; listingId: string; title: string; url: string; at: number; published: boolean; sourceId?: string }
interface DSource { id: string; name: string; searchUrl: string; divarName: string; schedule: Sched; autoPublish: boolean; autoNeighborhood: boolean; lastRun?: number; lastCount?: number; lastError?: string; createdAt: number }
interface DivarConfig {
  divarName: string; searchUrl: string; schedule: Sched
  autoPublish: boolean; autoNeighborhood: boolean
  lastRun?: number; lastCount?: number; lastError?: string
  sources: DSource[]
  imports: DImport[]
}
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: FONT, width: '100%' }
const gold: React.CSSProperties = { padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: FONT }
const act: React.CSSProperties = { padding: '5px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: FONT, whiteSpace: 'nowrap' }
const SCHED_LABEL: Record<Sched, string> = { off: 'دستی', hourly: 'هر ساعت', '6h': 'هر ۶ ساعت', daily: 'روزانه' }

export default function DivarImport({ onChange, entity = 'شما' }: { onChange?: () => void; entity?: string }) {
  const [cfg, setCfg] = useState<DivarConfig | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [selId, setSelId] = useState<string | null>(null)   // اسکرپِ انتخاب‌شده برای ویرایش
  const [showFiles, setShowFiles] = useState(false)
  const [job, setJob] = useState<any>(null)                 // وضعیتِ همگام‌سازیِ پس‌زمینه
  const [probe, setProbe] = useState<any>(null)             // فاز ۱۳۱: نتیجهٔ «تستِ زندهٔ اتصال»
  const [probing, setProbing] = useState(false)
  const [showLog, setShowLog] = useState(true)

  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/advisor/divar', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setCfg(d.config); setJob(d.job || null) } } catch {}
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const finalMsg = (j: any): string => {
    if (j?.error) return '⚠ ' + j.error
    const parts: string[] = []
    if (j?.imported) parts.push(`${(j.imported).toLocaleString('fa-IR')} فایلِ جدید به «فایل‌های من» اضافه شد`)
    if (j?.updated) parts.push(`${(j.updated).toLocaleString('fa-IR')} فایل به‌روزرسانی شد`)
    if (j?.sold) parts.push(`${(j.sold).toLocaleString('fa-IR')} فروش/اجاره‌رفته`)
    if (j?.skipped) parts.push(`${(j.skipped).toLocaleString('fa-IR')} ردشده`)
    return '✓ همگام‌سازی کامل شد — ' + (parts.join(' · ') || 'تغییری نبود')
  }

  // تا وقتی کار «در حال اجرا» یا «هولد» است پیشرفت را بپا (اسکرپِ بزرگ چند دور طول می‌کشد).
  useEffect(() => {
    if (!job?.running && !job?.paused && !job?.queued) return
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/advisor/divar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'jobStatus' }) })
        const d = await r.json().catch(() => ({}))
        if (d?.ok) {
          setJob(d.job)
          // فقط وقتی کاملاً تمام شد (نه هولد) پیام پایان بده.
          if (!d.job.running && !d.job.paused && !d.job.queued) { clearInterval(t); setMsg(finalMsg(d.job)); setShowFiles(true); refresh(); onChange?.() }
        }
      } catch {}
    }, 2500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.running, job?.paused, job?.queued])

  const post = useCallback(async (body: Record<string, unknown>): Promise<any> => {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/advisor/divar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d.error || 'عملیات ناموفق بود'); return null }
      if (d.config) setCfg(d.config)
      return d
    } catch { setMsg('اتصال به سرور برقرار نشد'); return null } finally { setBusy(false) }
  }, [])

  const faDate = (ts?: number) => ts ? new Date(ts).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
  const SCHEDULES: { v: Sched; label: string }[] = [
    { v: 'off', label: 'خاموش (دستی)' }, { v: 'hourly', label: 'هر ساعت' }, { v: '6h', label: 'هر ۶ ساعت' }, { v: 'daily', label: 'روزانه' },
  ]

  const sources = cfg?.sources || []
  const selSrc = sources.find(s => s.id === selId) || sources[0] || null
  const importsOf = (sid: string) => (cfg?.imports || []).filter(i => i.sourceId === sid)
  const sourceIds = new Set(sources.map(s => s.id))
  const manualImports = (cfg?.imports || []).filter(i => !i.sourceId || !sourceIds.has(i.sourceId))

  const setLocal = (id: string, patch: Partial<DSource>) => setCfg(c => c ? { ...c, sources: c.sources.map(x => x.id === id ? { ...x, ...patch } : x) } : c)
  const saveSource = async (src: DSource) => post({ action: 'updateSource', id: src.id, name: src.name, searchUrl: src.searchUrl, divarName: src.divarName, schedule: src.schedule, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood })

  const syncSource = async (src: DSource) => {
    await saveSource(src)
    const d = await post({ action: 'syncSource', id: src.id })
    if (!d) return
    if (d.alreadyRunning) { setMsg('یک همگام‌سازی همین‌حالا در حال اجراست — تا پایان صبر کنید.') }
    else { setMsg('⏳ همگام‌سازی شروع شد — در پس‌زمینه تا پایان ادامه می‌یابد، حتی اگر صفحه را ببندید.') }
    if (d.job) setJob(d.job)   // شروعِ پایشِ پیشرفت
  }

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920, fontFamily: FONT }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        آگهی‌های {entity} را از <b>دیوار</b> مستقیم به ملک‌جت بیاورید — عکس‌ها، قیمت، مشخصات و موقعیت خودکار خوانده می‌شوند و
        به‌صورت <b>فایلِ واقعی در «فایل‌های من»</b> ساخته و منتشر می‌شوند. <b>یک لینک می‌تواند آگهی‌هایی از چند محله داشته باشد</b>؛ محلهٔ
        هر آگهی خودکار تشخیص داده و در محلهٔ درستِ سایت جای‌گذاری می‌شود.
      </div>

      {/* افزودنِ سریع با لینک (دستی، یک‌بار) */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>افزودنِ سریعِ آگهی (یک‌بار)</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.9 }}>
          لینکِ <b>صفحهٔ پروی خودتان در دیوار</b> (<span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/pro/…</span>) یا لینکِ تکِ آگهی (<span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/v/…</span>) را بچسبانید. برای <b>همگام‌سازیِ خودکارِ همیشگی</b>، در بخشِ پایین یک «اسکرپ» بسازید.
        </div>
        <textarea value={url} onChange={e => setUrl(e.target.value)} rows={2} placeholder={"https://divar.ir/pro/HLTCumBJ"} style={{ ...inp, direction: 'ltr', textAlign: 'left', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={busy || !url.trim()} onClick={async () => {
            const d = await post({ action: 'importUrl', url: url.trim() })
            if (d?.ok) {
              setUrl('')
              const parts: string[] = []
              if (d.imported) parts.push(`${(d.imported).toLocaleString('fa-IR')} فایلِ جدید به «فایل‌های من» اضافه شد`)
              if (d.updated) parts.push(`${(d.updated).toLocaleString('fa-IR')} فایل به‌روزرسانی شد`)
              if (d.sold) parts.push(`${(d.sold).toLocaleString('fa-IR')} فروش/اجاره‌رفته`)
              if (d.failed) parts.push(`${(d.failed).toLocaleString('fa-IR')} ناموفق`)
              setMsg('✓ ' + (parts.join(' · ') || 'انجام شد'))
              onChange?.()
            }
          }} style={{ ...gold, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال افزودن…' : 'افزودن به فایل‌ها'}</button>
        </div>
      </div>

      {/* فاز ۱۳۱ — تشخیصِ زنده: تستِ اتصال + ژورنالِ مراحل */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button disabled={probing} onClick={async () => {
          setProbing(true); setProbe(null)
          try { const r = await fetch('/api/advisor/divar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'probe' }) }); setProbe(await r.json()) }
          catch { setProbe({ ok: false, steps: [{ id: 'net', label: 'اتصال به سرورِ ملک‌جت', ok: false, detail: 'پاسخی نیامد' }] }) }
          finally { setProbing(false) }
        }} style={{ background: 'transparent', border: '1px solid var(--line2)', color: 'var(--text)', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {probing ? '🩺 در حال تستِ زنده…' : '🩺 تستِ زندهٔ اتصالِ دیوار'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>اگر همگام‌سازی کار نمی‌کند، این تست دقیقاً می‌گوید کجا می‌شکند</span>
      </div>
      {probe?.steps && (
        <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {probe.steps.map((st: any) => (
            <div key={st.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12.5 }}>
              <span style={{ flexShrink: 0, fontWeight: 800, color: st.ok === true ? '#5fd98a' : st.ok === false ? '#e7674a' : 'var(--faint)' }}>{st.ok === true ? '✓' : st.ok === false ? '✗' : '○'}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}:</span>
              <span style={{ color: st.ok === false ? '#e7674a' : 'var(--muted)', lineHeight: 1.8 }}>{st.detail}{typeof st.ms === 'number' ? ` (${Math.round(st.ms / 100) / 10} ثانیه)` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* نوارِ پیشرفتِ همگام‌سازیِ پس‌زمینه (در صف، در حال اجرا یا هولد) */}
      {(job?.running || job?.paused || job?.queued) && (
        <div style={{ ...card, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ color: job.paused ? '#e7a14a' : 'var(--gold)' }}>{job.queued ? '🕐' : job.paused ? '⏸' : '⏳'} {job.label || 'همگام‌سازیِ دیوار'} {job.queued ? 'در صفِ سرور (تا ۴۵ ثانیه)' : job.paused ? 'متوقفِ موقت' : 'در حال اجرا…'}</span>
            <span style={{ color: 'var(--muted)' }}>{job.total ? `${(job.done || 0).toLocaleString('fa-IR')} از ${(job.total).toLocaleString('fa-IR')}` : 'در حالِ خواندنِ فهرست…'}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: job.total ? `${Math.round(((job.done || 0) / job.total) * 100)}%` : '15%', background: job.paused ? 'linear-gradient(90deg,#e7a14a,#e7c04a)' : 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>{job.note || 'می‌توانید این صفحه را ببندید — همگام‌سازی روی سرور تا پایان ادامه می‌یابد.'}</span>
            <button onClick={() => setShowLog(v => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{showLog ? 'بستنِ ژورنال' : 'ژورنالِ زنده'}</button>
            <span style={{ display: 'flex', gap: 8 }}>
              {job.paused && <button onClick={async () => { const d = await post({ action: 'resumeJob' }); if (d?.job) setJob(d.job) }} style={{ background: 'transparent', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 9, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>ادامهٔ الان</button>}
              <button onClick={async () => { const d = await post({ action: 'stopJob' }); if (d?.job) { setJob(d.job); setMsg('همگام‌سازی متوقف شد. می‌توانید دوباره شروع کنید.') } }} style={{ background: 'transparent', border: '1px solid rgba(231,103,74,.4)', color: '#e7674a', borderRadius: 9, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>توقف و شروعِ مجدد</button>
            </span>
          </div>
          {/* فاز ۱۳۱ — ژورنالِ زندهٔ مراحل: دقیقاً می‌بینی سرور در چه مرحله‌ای است و اگر خطا خورد، کجا */}
          {showLog && (job.log || []).length > 0 && (
            <div dir="rtl" style={{ marginTop: 10, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>
              {[...(job.log as string[])].reverse().map((l, i) => (
                <div key={i} style={{ fontSize: 11.5, lineHeight: 1.9, color: l.includes('❌') || l.includes('⚠️') ? '#e7674a' : l.includes('🏁') || l.includes('✅') ? '#5fd98a' : 'var(--muted)' }}>{l}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ژورنالِ آخرین اجرا حتی بعد از پایان/خطا هم دیدنی بماند — برای تشخیصِ علت */}
      {!(job?.running || job?.paused || job?.queued) && (job?.log || []).length > 0 && (job?.error || job?.finishedAt) && (
        <details style={{ ...card, padding: '10px 14px' }}>
          <summary style={{ fontSize: 12, color: job?.error ? '#e7674a' : 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>
            {job?.error ? `⚠ آخرین اجرا با خطا تمام شد: ${job.error}` : '📜 ژورنالِ آخرین همگام‌سازی'}
          </summary>
          <div dir="rtl" style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(job.log as string[]).map((l, i) => (
              <div key={i} style={{ fontSize: 11.5, lineHeight: 1.9, color: l.includes('❌') || l.includes('⚠️') ? '#e7674a' : l.includes('🏁') || l.includes('✅') ? '#5fd98a' : 'var(--muted)' }}>{l}</div>
            ))}
          </div>
        </details>
      )}
      {msg && <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.7, color: msg.startsWith('✓') || msg.startsWith('⏳') ? 'var(--gold)' : '#ef4444' }}>{msg}</div>}

      {/* اسکرپ‌ها — فهرستِ سمتِ چپ + ویرایشگرِ سمتِ راست */}
      {cfg && <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>اسکرپ‌های ذخیره‌شده — {sources.length.toLocaleString('fa-IR')}</div>
          <button disabled={busy} onClick={async () => { const d = await post({ action: 'addSource', name: 'اسکرپِ جدید' }); if (d?.ok) { const last = d.config?.sources?.[d.config.sources.length - 1]; if (last) { setSelId(last.id); setShowFiles(false) } setMsg('✓ اسکرپِ جدید ساخته شد. لینکِ صفحهٔ پرو را بگذارید و ذخیره/همگام‌سازی کنید.') } }} style={{ ...gold, padding: '7px 14px' }}>＋ اسکرپِ جدید</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.8 }}>
          معمولاً <b>یک اسکرپ کافی است</b>: لینکِ صفحهٔ پروی خودتان را بگذارید تا همهٔ آگهی‌ها (از هر محله) خودکار وارد شوند. فقط اگر چند لینکِ
          جستجوی متفاوت دارید، اسکرپِ جداگانه بسازید. هر اسکرپ، لینک و آگهی‌های خودش را جدا ذخیره می‌کند.
        </div>

        {sources.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', background: 'var(--bg2)', border: '1px dashed var(--line)', borderRadius: 10, padding: '18px 14px', textAlign: 'center' }}>هنوز اسکرپی نساخته‌اید. روی «＋ اسکرپِ جدید» بزنید.</div>
        ) : (
          <div className="divar-twopane" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* ویرایشگرِ اسکرپِ انتخاب‌شده (سمتِ راست) */}
            <div style={{ flex: '1 1 360px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selSrc ? (() => {
                const src = selSrc
                const mine = importsOf(src.id)
                return (
                  <div style={{ ...card, background: 'var(--bg2)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>ویرایشِ اسکرپ</div>
                      <button disabled={busy} onClick={async () => { if (confirm(`اسکرپ «${src.name}» حذف شود؟ (فایل‌های واردشده باقی می‌مانند)`)) { await post({ action: 'removeSource', id: src.id }); setSelId(null) } }} style={{ ...act, color: '#ef4444', borderColor: 'rgba(231,103,74,.4)' }}>حذفِ اسکرپ</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نامِ اسکرپ</label><input value={src.name} onChange={e => setLocal(src.id, { name: e.target.value })} placeholder="مثلاً آگهی‌های دفترِ ما" style={{ ...inp, fontWeight: 700 }} /></div>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>لینکِ صفحهٔ پروی شما در دیوار (یا جستجو/نقشه)</label><input value={src.searchUrl} onChange={e => setLocal(src.id, { searchUrl: e.target.value })} placeholder="https://divar.ir/pro/HLTCumBJ" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                        <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام در دیوار (فقط لینکِ جستجو/نقشه)</label><input value={src.divarName} onChange={e => setLocal(src.id, { divarName: e.target.value })} placeholder="—" style={inp} /></div>
                        <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>همگام‌سازیِ خودکار</label><select value={src.schedule} onChange={e => setLocal(src.id, { schedule: e.target.value as Sched })} style={inp}>{SCHEDULES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoPublish} onChange={e => setLocal(src.id, { autoPublish: e.target.checked })} /> انتشار خودکار روی سایت</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoNeighborhood} onChange={e => setLocal(src.id, { autoNeighborhood: e.target.checked })} /> تشخیصِ خودکارِ محله</label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button disabled={busy} onClick={async () => { await saveSource(src); setMsg('✓ اسکرپ ذخیره شد.') }} style={{ ...gold, padding: '8px 16px' }}>ذخیرهٔ اسکرپ</button>
                        <button disabled={busy || job?.running || !src.searchUrl.trim()} onClick={() => syncSource(src)} style={{ ...act, padding: '8px 16px', color: 'var(--gold)', borderColor: 'var(--gold)' }}>{job?.running ? 'در حال همگام‌سازی…' : 'ذخیره و همگام‌سازی الان'}</button>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                        <span>آخرین اجرا: <b style={{ color: 'var(--text)' }}>{faDate(src.lastRun)}</b></span>
                        {mine.length > 0 && <button onClick={() => setShowFiles(s => !s)} style={{ ...act, padding: '2px 10px', marginRight: 'auto' }}>{showFiles ? 'بستنِ فایل‌ها ▲' : `${mine.length.toLocaleString('fa-IR')} فایلِ این اسکرپ ▼`}</button>}
                      </div>
                      {src.lastError && <div style={{ fontSize: 11, color: '#ef4444' }}>خطا: {src.lastError}</div>}

                      {showFiles && mine.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                        {mine.map(im => (
                          <div key={im.token} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                            <span style={{ fontSize: 13 }}>{im.published ? '🟢' : '⚪'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.title}</div>
                              <div style={{ fontSize: 10, color: 'var(--faint)' }}>{faDate(im.at)} · {im.published ? 'منتشرشده' : 'پیش‌نویس'}</div>
                            </div>
                            <a href={im.url} target="_blank" rel="noreferrer" style={{ ...act, textDecoration: 'none', padding: '4px 10px' }}>دیوار ↗</a>
                            <button disabled={busy} onClick={() => post({ action: 'removeImport', token: im.token })} style={{ ...act, color: '#ef4444', padding: '4px 10px' }}>حذف</button>
                          </div>
                        ))}
                      </div>}
                    </div>
                  </div>
                )
              })() : (
                <div style={{ fontSize: 12.5, color: 'var(--faint)', background: 'var(--bg2)', border: '1px dashed var(--line)', borderRadius: 10, padding: '30px 14px', textAlign: 'center' }}>یک اسکرپ را از فهرستِ کنار انتخاب کنید.</div>
              )}
            </div>

            {/* فهرستِ اسکرپ‌های ذخیره‌شده (سمتِ چپ) */}
            <div style={{ flex: '1 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 700 }}>فهرستِ اسکرپ‌ها</div>
              {sources.map(s => {
                const on = selSrc?.id === s.id
                const cnt = importsOf(s.id).length
                return (
                  <button key={s.id} onClick={() => { setSelId(s.id); setShowFiles(false) }} style={{
                    textAlign: 'right', cursor: 'pointer', borderRadius: 12, padding: '11px 12px', fontFamily: FONT,
                    background: on ? 'rgba(212,175,90,.12)' : 'var(--bg2)',
                    border: on ? '1px solid var(--gold)' : '1px solid var(--line)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: on ? 'var(--gold)' : 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px' }}>{SCHED_LABEL[s.schedule]}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{cnt > 0 ? `${cnt.toLocaleString('fa-IR')} فایل` : 'بدون فایل'}</span>
                      <span>· {s.lastRun ? faDate(s.lastRun) : 'اجرا نشده'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>}

      {/* آگهی‌های واردشدهٔ دستی (بدونِ اسکرپ) */}
      {cfg && manualImports.length > 0 && <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>افزودهٔ دستی ({manualImports.length.toLocaleString('fa-IR')})</div>
          <button disabled={busy} onClick={async () => {
            if (!confirm('همهٔ آگهی‌های افزودهٔ دستی از دیوار حذف شوند؟ (فایل‌ها هم پاک می‌شوند)')) return
            const d = await post({ action: 'clearImports' })
            if (d?.ok) { setMsg(`✓ ${(d.removed || 0).toLocaleString('fa-IR')} فایلِ واردشده حذف شد.`); onChange?.() }
          }} style={{ ...act, color: '#ef4444', borderColor: '#ef4444' }}>پاک‌کردنِ همه</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {manualImports.map(im => (
            <div key={im.token} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--bg2)', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14 }}>{im.published ? '🟢' : '⚪'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{faDate(im.at)} · {im.published ? 'منتشرشده' : 'پیش‌نویس'}</div>
              </div>
              <a href={im.url} target="_blank" rel="noreferrer" style={{ ...act, textDecoration: 'none' }}>دیوار ↗</a>
              <button disabled={busy} onClick={() => post({ action: 'removeImport', token: im.token })} style={{ ...act, color: '#ef4444' }}>حذف از فهرست</button>
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
