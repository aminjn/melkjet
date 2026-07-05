'use client'
import { useEffect, useState, useCallback } from 'react'

// ویرایشگرِ پروفایلِ عمومیِ سازنده در پنل — وصل به /api/builder (action‌های public).
// آنچه این‌جا پر می‌شود، دقیقاً در صفحهٔ عمومی /builders/[id] نمایش داده می‌شود.

const inp: React.CSSProperties = { width: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6, display: 'block' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }
const btn: React.CSSProperties = { background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line2)', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }


export default function BuilderPublicView() {
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(false)
  const [builderId, setBuilderId] = useState('')
  const [name, setName] = useState('')
  const [pub, setPub] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/builder?public=1', { cache: 'no-store' })
      const d = await r.json()
      setLinked(!!d.linked)
      if (d.linked) { setBuilderId(d.builderId); setName(d.name || ''); setPub(d.public || {}) }
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  const send = async (body: any): Promise<any> => {
    setBusy(true)
    try { const r = await fetch('/api/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json() } finally { setBusy(false) }
  }

  const saveProfile = async () => {
    const patch = {
      tagline: pub.tagline || '', sinceYear: pub.sinceYear || '', activeRegionsText: pub.activeRegionsText || '',
      website: pub.website || '', officeAddress: pub.officeAddress || '', phonePublic: pub.phonePublic || '',
      about: pub.about || '', tags: typeof pub.tagsText === 'string' ? pub.tagsText.split(/[,،]/).map((s: string) => s.trim()).filter(Boolean) : (pub.tags || []),
    }
    const d = await send({ action: 'publicProfile', patch })
    if (d.ok) flash('پروفایل ذخیره شد ✓')
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '60px 0', textAlign: 'center' }}>در حال بارگذاری…</div>

  if (!linked) return (
    <div style={{ ...card, maxWidth: 620, lineHeight: 2 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>پروفایلِ عمومی</div>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>
        حسابِ شما هنوز به پایگاهِ سازنده‌های ملک‌جت متصل نشده است. پس از اتصال (تطبیقِ شمارهٔ شما با
        پروفایلِ سازنده)، می‌توانید پروفایلِ عمومی و پروژه‌هایتان را این‌جا مدیریت کنید و صفحهٔ عمومی
        برایتان فعال می‌شود.
      </p>
    </div>
  )

  const tagsText = pub.tagsText != null ? pub.tagsText : (pub.tags || []).join('، ')

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1000, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>پروفایلِ عمومیِ سازنده</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{name} · این اطلاعات در صفحهٔ عمومیِ شما نمایش داده می‌شود</div>
        </div>
        <a href={`/builders/${encodeURIComponent(builderId)}`} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>مشاهدهٔ صفحهٔ عمومی ↗</a>
      </div>

      {/* Profile fields */}
      <section style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>معرفی و اطلاعاتِ تماس</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
          <div><label style={lbl}>عنوان/تخصص (مثلاً انبوه‌ساز لوکس)</label><input style={inp} value={pub.tagline || ''} onChange={e => setPub({ ...pub, tagline: e.target.value })} /></div>
          <div><label style={lbl}>فعال از سال (شمسی)</label><input style={inp} inputMode="numeric" value={pub.sinceYear || ''} onChange={e => setPub({ ...pub, sinceYear: e.target.value.replace(/\D/g, '') })} placeholder="مثلاً ۱۳۸۸" /></div>
          <div><label style={lbl}>مناطقِ فعالیت</label><input style={inp} value={pub.activeRegionsText || ''} onChange={e => setPub({ ...pub, activeRegionsText: e.target.value })} placeholder="تهران و البرز" /></div>
          <div><label style={lbl}>تلفنِ تماسِ عمومی</label><input style={{ ...inp, direction: 'ltr' }} value={pub.phonePublic || ''} onChange={e => setPub({ ...pub, phonePublic: e.target.value })} placeholder="۰۲۱-..." /></div>
          <div><label style={lbl}>وب‌سایت</label><input style={{ ...inp, direction: 'ltr' }} value={pub.website || ''} onChange={e => setPub({ ...pub, website: e.target.value })} placeholder="example.com" /></div>
          <div><label style={lbl}>دفترِ مرکزی</label><input style={inp} value={pub.officeAddress || ''} onChange={e => setPub({ ...pub, officeAddress: e.target.value })} placeholder="تهران، سعادت‌آباد…" /></div>
        </div>
        <div style={{ marginTop: 14 }}><label style={lbl}>درباره</label><textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={pub.about || ''} onChange={e => setPub({ ...pub, about: e.target.value })} placeholder="معرفیِ کوتاهِ مجموعه…" /></div>
        <div style={{ marginTop: 14 }}><label style={lbl}>برچسب‌ها (با ویرگول جدا کنید)</label><input style={inp} value={tagsText} onChange={e => setPub({ ...pub, tagsText: e.target.value })} placeholder="ساخت لوکس، انبوه‌سازی، تحویل به‌موقع" /></div>
        <div style={{ marginTop: 16 }}><button style={btn} disabled={busy} onClick={saveProfile}>ذخیرهٔ پروفایل</button></div>
      </section>

      <div style={{ ...card, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>
        برای افزودن یا ویرایشِ پروژه‌ها (عکس، پلان، امکانات، مرحلهٔ ساخت و…) به بخشِ <b style={{ color: 'var(--gold)' }}>«پروژه‌ها»</b> در منو بروید.
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, insetInlineStart: 24, background: 'var(--surface)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 12, padding: '12px 20px', fontSize: 13.5, fontWeight: 700, zIndex: 200 }}>{toast}</div>}
    </div>
  )
}

