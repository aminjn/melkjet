'use client'
import { useCallback, useEffect, useState } from 'react'

// «ایمپورت از دیوار» — قابلِ استفاده در پنلِ مشاور و آژانس. session-scoped است
// (هر کاربر فقط دادهٔ خودش). onChange بعد از ایمپورت/سینک برای رفرشِ فایل‌های والد.

const FONT = 'Vazirmatn, system-ui, sans-serif'
type Sched = 'off' | 'hourly' | '6h' | 'daily'
interface DImport { token: string; listingId: string; title: string; url: string; at: number; published: boolean }
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

export default function DivarImport({ onChange, entity = 'شما' }: { onChange?: () => void; entity?: string }) {
  const [cfg, setCfg] = useState<DivarConfig | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = useCallback(async () => {
    try { const r = await fetch('/api/advisor/divar', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setCfg(d.config) } } catch {}
  }, [])
  useEffect(() => { refresh() }, [refresh])

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
  const SCHEDULES: { v: DivarConfig['schedule']; label: string }[] = [
    { v: 'off', label: 'خاموش (دستی)' }, { v: 'hourly', label: 'هر ساعت' }, { v: '6h', label: 'هر ۶ ساعت' }, { v: 'daily', label: 'روزانه' },
  ]

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, fontFamily: FONT }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        آگهی‌های {entity} را از <b>دیوار</b> مستقیم به ملک‌جت بیاورید — عکس‌ها، قیمت، مشخصات و موقعیت خودکار خوانده می‌شوند.
        محلهٔ آگهی هم خودکار با محله‌های موجودِ سایت تطبیق داده می‌شود.
      </div>

      {/* افزودن با لینک */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>افزودن آگهی‌ها از دیوار</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.9 }}>
          لینکِ <b>صفحهٔ اختصاصیِ {entity} در دیوار</b> (<span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/pro/…</span>) را بچسبانید تا <b>همهٔ آگهی‌ها</b> یکجا وارد شوند. (لینکِ تکیِ <span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/v/…</span> هم پذیرفته می‌شود.)
        </div>
        <textarea value={url} onChange={e => setUrl(e.target.value)} rows={3} placeholder={"https://divar.ir/pro/HLTCumBJ"} style={{ ...inp, direction: 'ltr', textAlign: 'left', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={busy || !url.trim()} onClick={async () => {
            const d = await post({ action: 'importUrl', url: url.trim() })
            if (d?.ok) {
              setUrl('')
              const parts: string[] = []
              if (d.imported) parts.push(`${(d.imported).toLocaleString('fa-IR')} آگهی جدید وارد شد`)
              if (d.updated) parts.push(`${(d.updated).toLocaleString('fa-IR')} آگهی به‌روزرسانی شد`)
              if (d.sold) parts.push(`${(d.sold).toLocaleString('fa-IR')} فروش/اجاره‌رفته`)
              if (d.failed) parts.push(`${(d.failed).toLocaleString('fa-IR')} ناموفق`)
              setMsg('✓ ' + (parts.join(' · ') || 'انجام شد'))
              onChange?.()
            }
          }} style={{ ...gold, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال افزودن…' : 'افزودن'}</button>
        </div>
      </div>

      {/* اسکرپ‌ها (منابعِ متعدد) — هرکدام جدا، ذخیره‌شده و قابلِ همگام‌سازیِ مستقل */}
      {cfg && <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>اسکرپ‌ها (همگام‌سازیِ خودکار) — {cfg.sources.length.toLocaleString('fa-IR')}</div>
          <button disabled={busy} onClick={async () => { const d = await post({ action: 'addSource', name: 'اسکرپِ جدید' }); if (d?.ok) setMsg('✓ اسکرپِ جدید اضافه شد. لینک و تنظیماتش را پر کنید.') }} style={{ ...gold, padding: '7px 14px' }}>＋ افزودنِ اسکرپ</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.8 }}>برای هر دفتر/منطقه یک اسکرپِ جدا بسازید؛ هرکدام لینک، زمان‌بندی و نتیجهٔ خودش را دارد و جدا ذخیره می‌شود.</div>
        {cfg.sources.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', background: 'var(--bg2)', border: '1px dashed var(--line)', borderRadius: 10, padding: '18px 14px', textAlign: 'center' }}>هنوز اسکرپی نساخته‌اید. روی «＋ افزودنِ اسکرپ» بزنید.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cfg.sources.map(src => {
              const set = (patch: Partial<DSource>) => setCfg(c => c ? { ...c, sources: c.sources.map(x => x.id === src.id ? { ...x, ...patch } : x) } : c)
              return (
                <div key={src.id} style={{ ...card, background: 'var(--bg2)', padding: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                    <input value={src.name} onChange={e => set({ name: e.target.value })} placeholder="نامِ اسکرپ" style={{ ...inp, flex: '1 1 160px', width: 'auto', fontWeight: 700 }} />
                    <button disabled={busy} onClick={async () => { if (confirm('این اسکرپ حذف شود؟')) { await post({ action: 'removeSource', id: src.id }) } }} style={{ ...act, color: '#ef4444', borderColor: 'rgba(231,103,74,.4)' }}>حذفِ اسکرپ</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>لینکِ صفحهٔ اختصاصی (پرو) یا جستجو/نقشه</label><input value={src.searchUrl} onChange={e => set({ searchUrl: e.target.value })} placeholder="https://divar.ir/pro/HLTCumBJ" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام در دیوار (برای جستجو)</label><input value={src.divarName} onChange={e => set({ divarName: e.target.value })} placeholder="نامِ زیرِ آگهی‌ها" style={inp} /></div>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>زمان‌بندی</label><select value={src.schedule} onChange={e => set({ schedule: e.target.value as Sched })} style={inp}>{SCHEDULES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoPublish} onChange={e => set({ autoPublish: e.target.checked })} /> انتشار خودکار</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoNeighborhood} onChange={e => set({ autoNeighborhood: e.target.checked })} /> تشخیص خودکار محله</label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button disabled={busy} onClick={async () => { await post({ action: 'updateSource', id: src.id, name: src.name, searchUrl: src.searchUrl, divarName: src.divarName, schedule: src.schedule, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood }); setMsg('✓ اسکرپ ذخیره شد.') }} style={{ ...gold, padding: '8px 16px' }}>ذخیره</button>
                      <button disabled={busy || !src.searchUrl.trim()} onClick={async () => {
                        await post({ action: 'updateSource', id: src.id, name: src.name, searchUrl: src.searchUrl, divarName: src.divarName, schedule: src.schedule, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood })
                        const d = await post({ action: 'syncSource', id: src.id })
                        if (d) { setMsg(d.ok ? `✓ «${src.name}» همگام شد — ${(d.imported || 0).toLocaleString('fa-IR')} جدید، ${(d.updated || 0).toLocaleString('fa-IR')} به‌روزرسانی (از ${(d.scanned || 0).toLocaleString('fa-IR')} آگهی).` : (d.reason || 'همگام‌سازی ناموفق بود')); onChange?.() }
                      }} style={{ ...act, padding: '8px 16px', color: 'var(--gold)', borderColor: 'var(--gold)' }}>{busy ? 'در حال همگام‌سازی…' : 'همگام‌سازیِ این اسکرپ'}</button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                      <span>آخرین اجرا: <b style={{ color: 'var(--text)' }}>{faDate(src.lastRun)}</b></span>
                      {typeof src.lastCount === 'number' && <span>آخرین نتیجه: <b style={{ color: 'var(--text)' }}>{src.lastCount.toLocaleString('fa-IR')} آگهی</b></span>}
                      {src.lastError && <span style={{ color: '#ef4444' }}>خطا: {src.lastError}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>}

      {msg && <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, color: msg.startsWith('✓') ? 'var(--gold)' : 'var(--muted)' }}>{msg}</div>}

      {/* آگهی‌های واردشده */}
      {cfg && cfg.imports.length > 0 && <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>آگهی‌های واردشده ({cfg.imports.length.toLocaleString('fa-IR')})</div>
          <button disabled={busy} onClick={async () => {
            if (!confirm('همهٔ آگهی‌های واردشده از دیوار حذف شوند؟')) return
            const d = await post({ action: 'clearImports' })
            if (d?.ok) { setMsg(`✓ ${(d.removed || 0).toLocaleString('fa-IR')} آگهیِ واردشده حذف شد.`); onChange?.() }
          }} style={{ ...act, color: '#ef4444', borderColor: '#ef4444' }}>پاک‌کردن همهٔ واردشده‌ها</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cfg.imports.map(im => (
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
