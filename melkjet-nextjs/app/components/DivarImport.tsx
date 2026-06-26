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
  const [editId, setEditId] = useState<string | null>(null)   // کدام اسکرپ بازِ ویرایش است
  const [openImports, setOpenImports] = useState<Record<string, boolean>>({})  // فهرستِ آگهی‌های هر اسکرپ باز است؟

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
  const SCHEDULES: { v: Sched; label: string }[] = [
    { v: 'off', label: 'خاموش (دستی)' }, { v: 'hourly', label: 'هر ساعت' }, { v: '6h', label: 'هر ۶ ساعت' }, { v: 'daily', label: 'روزانه' },
  ]

  // آگهی‌های هر اسکرپ + آگهی‌های دستی (بدونِ اسکرپ)
  const importsOf = (sid: string) => (cfg?.imports || []).filter(i => i.sourceId === sid)
  const sourceIds = new Set((cfg?.sources || []).map(s => s.id))
  const manualImports = (cfg?.imports || []).filter(i => !i.sourceId || !sourceIds.has(i.sourceId))

  // ذخیرهٔ تنظیماتِ یک اسکرپ
  const saveSource = async (src: DSource) => post({ action: 'updateSource', id: src.id, name: src.name, searchUrl: src.searchUrl, divarName: src.divarName, schedule: src.schedule, autoPublish: src.autoPublish, autoNeighborhood: src.autoNeighborhood })

  // همگام‌سازیِ یک اسکرپ → آگهی‌ها مستقیم به «فایل‌های من» اضافه می‌شوند
  const syncSource = async (src: DSource) => {
    await saveSource(src)
    const d = await post({ action: 'syncSource', id: src.id })
    if (d) {
      if (d.ok) {
        const added = d.imported || 0, upd = d.updated || 0, sold = d.sold || 0
        const parts: string[] = []
        parts.push(`${added.toLocaleString('fa-IR')} فایلِ جدید به «فایل‌های من» اضافه شد`)
        if (upd) parts.push(`${upd.toLocaleString('fa-IR')} فایل به‌روزرسانی شد`)
        if (sold) parts.push(`${sold.toLocaleString('fa-IR')} فروش/اجاره‌رفته`)
        setMsg('✓ «' + src.name + '»: ' + parts.join(' · ') + ` (از ${(d.scanned || 0).toLocaleString('fa-IR')} آگهیِ اسکن‌شده).`)
        setOpenImports(o => ({ ...o, [src.id]: true }))
        onChange?.()
      } else setMsg(d.reason || 'همگام‌سازی ناموفق بود')
    }
  }

  const setLocal = (id: string, patch: Partial<DSource>) => setCfg(c => c ? { ...c, sources: c.sources.map(x => x.id === id ? { ...x, ...patch } : x) } : c)

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, fontFamily: FONT }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        آگهی‌های {entity} را از <b>دیوار</b> مستقیم به ملک‌جت بیاورید — عکس‌ها، قیمت، مشخصات و موقعیت خودکار خوانده می‌شوند و
        به‌صورت <b>فایلِ واقعی در «فایل‌های من»</b> ساخته و منتشر می‌شوند. محلهٔ آگهی هم خودکار با محله‌های موجودِ سایت تطبیق می‌خورد.
      </div>

      {/* افزودنِ سریع با لینک (دستی، یک‌بار) */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>افزودنِ سریعِ آگهی (یک‌بار)</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.9 }}>
          لینکِ <b>صفحهٔ اختصاصیِ {entity} در دیوار</b> (<span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/pro/…</span>) یا لینکِ تکِ آگهی (<span style={{ direction: 'ltr', display: 'inline-block' }}>divar.ir/v/…</span>) را بچسبانید. برای <b>همگام‌سازیِ خودکارِ همیشگی</b>، در بخشِ پایین یک «اسکرپ» بسازید.
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

      {msg && <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.7, color: msg.startsWith('✓') ? 'var(--gold)' : '#ef4444' }}>{msg}</div>}

      {/* اسکرپ‌ها — هرکدام جدا، ذخیره‌شده، قابلِ ویرایش/حذف، با آگهی‌های خودش */}
      {cfg && <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>اسکرپ‌های ذخیره‌شده — {cfg.sources.length.toLocaleString('fa-IR')}</div>
          <button disabled={busy} onClick={async () => { const d = await post({ action: 'addSource', name: 'اسکرپِ جدید' }); if (d?.ok) { const last = d.config?.sources?.[d.config.sources.length - 1]; if (last) setEditId(last.id); setMsg('✓ اسکرپِ جدید ساخته شد. لینک و نامِ آن را پر کرده و ذخیره کنید.') } }} style={{ ...gold, padding: '7px 14px' }}>＋ اسکرپِ جدید</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.8 }}>برای هر دفتر/منطقه/جستجو یک اسکرپِ جدا بسازید. هرکدام لینک، زمان‌بندی و آگهی‌های خودش را دارد و جدا ذخیره می‌شود. با «همگام‌سازی»، آگهی‌ها مستقیم به «فایل‌های من» می‌روند.</div>
        {cfg.sources.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', background: 'var(--bg2)', border: '1px dashed var(--line)', borderRadius: 10, padding: '18px 14px', textAlign: 'center' }}>هنوز اسکرپی نساخته‌اید. روی «＋ اسکرپِ جدید» بزنید.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cfg.sources.map(src => {
              const editing = editId === src.id
              const mine = importsOf(src.id)
              const showImports = !!openImports[src.id]
              return (
                <div key={src.id} style={{ ...card, background: 'var(--bg2)', padding: 14 }}>
                  {/* ── خلاصهٔ اسکرپ ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {src.name}
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 7px' }}>{SCHED_LABEL[src.schedule]}</span>
                        {mine.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold)', background: 'rgba(212,175,90,.12)', borderRadius: 6, padding: '1px 7px' }}>{mine.length.toLocaleString('fa-IR')} فایل</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', direction: 'ltr', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{src.searchUrl || '— لینک تنظیم نشده —'}</div>
                    </div>
                    <button disabled={busy || !src.searchUrl.trim()} onClick={() => syncSource(src)} style={{ ...gold, padding: '7px 14px' }}>{busy ? '…' : 'همگام‌سازی'}</button>
                    <button disabled={busy} onClick={() => setEditId(editing ? null : src.id)} style={act}>{editing ? 'بستن' : 'ویرایش'}</button>
                    <button disabled={busy} onClick={async () => { if (confirm(`اسکرپ «${src.name}» حذف شود؟ (فایل‌های واردشده در «فایل‌های من» باقی می‌مانند)`)) { await post({ action: 'removeSource', id: src.id }); if (editId === src.id) setEditId(null) } }} style={{ ...act, color: '#ef4444', borderColor: 'rgba(231,103,74,.4)' }}>حذف</button>
                  </div>

                  {/* خطِ وضعیت */}
                  <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <span>آخرین اجرا: <b style={{ color: 'var(--text)' }}>{faDate(src.lastRun)}</b></span>
                    {typeof src.lastCount === 'number' && src.lastRun && <span>آخرین نتیجه: <b style={{ color: 'var(--text)' }}>{src.lastCount.toLocaleString('fa-IR')} جدید</b></span>}
                    {src.lastError && <span style={{ color: '#ef4444' }}>خطا: {src.lastError}</span>}
                    {mine.length > 0 && <button onClick={() => setOpenImports(o => ({ ...o, [src.id]: !o[src.id] }))} style={{ ...act, padding: '2px 10px', marginRight: 'auto' }}>{showImports ? 'بستنِ فایل‌ها ▲' : `نمایشِ ${mine.length.toLocaleString('fa-IR')} فایلِ این اسکرپ ▼`}</button>}
                  </div>

                  {/* ── فرمِ ویرایش ── */}
                  {editing && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نامِ اسکرپ</label><input value={src.name} onChange={e => setLocal(src.id, { name: e.target.value })} placeholder="مثلاً دفترِ سعادت‌آباد" style={{ ...inp, fontWeight: 700 }} /></div>
                    <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>لینکِ صفحهٔ اختصاصی (پرو) یا جستجو/نقشه</label><input value={src.searchUrl} onChange={e => setLocal(src.id, { searchUrl: e.target.value })} placeholder="https://divar.ir/pro/HLTCumBJ" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>نام در دیوار (فقط برای لینکِ جستجو/نقشه)</label><input value={src.divarName} onChange={e => setLocal(src.id, { divarName: e.target.value })} placeholder="نامِ زیرِ آگهی‌ها" style={inp} /></div>
                      <div><label style={{ fontSize: 12, color: 'var(--muted)' }}>زمان‌بندیِ خودکار</label><select value={src.schedule} onChange={e => setLocal(src.id, { schedule: e.target.value as Sched })} style={inp}>{SCHEDULES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoPublish} onChange={e => setLocal(src.id, { autoPublish: e.target.checked })} /> انتشار خودکار روی سایت</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={src.autoNeighborhood} onChange={e => setLocal(src.id, { autoNeighborhood: e.target.checked })} /> تشخیصِ خودکارِ محله</label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button disabled={busy} onClick={async () => { await saveSource(src); setMsg('✓ اسکرپ ذخیره شد.'); setEditId(null) }} style={{ ...gold, padding: '8px 16px' }}>ذخیرهٔ اسکرپ</button>
                      <button disabled={busy || !src.searchUrl.trim()} onClick={() => syncSource(src)} style={{ ...act, padding: '8px 16px', color: 'var(--gold)', borderColor: 'var(--gold)' }}>ذخیره و همگام‌سازی الان</button>
                    </div>
                  </div>}

                  {/* ── آگهی‌های این اسکرپ ── */}
                  {showImports && mine.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
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
              )
            })}
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
