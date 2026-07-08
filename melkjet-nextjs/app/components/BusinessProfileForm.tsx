'use client'
import { useEffect, useState } from 'react'
import ImageUpload from './ImageUpload'
import { buildIdentityRows } from '@/app/lib/identity-labels'

// فرمِ کاملِ پروفایلِ کسب‌وکار — مشترک در همهٔ پنل‌ها. هویتِ رسمی از شاهکار (قفل) + اطلاعاتِ کاملِ کسب‌وکار.
const FONT = 'Vazirmatn, system-ui, sans-serif'
const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, fontFamily: FONT, outline: 'none' }
const lab: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginBottom: 5, display: 'block', fontWeight: 600 }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}><span style={{ fontSize: 18 }}>{icon}</span><div style={{ fontSize: 14.5, fontWeight: 800 }}>{title}</div></div>
      {children}
    </div>
  )
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div style={{ gridColumn: full ? '1 / -1' : undefined }}><label style={lab}>{label}</label>{children}</div>
}
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

// انتخابگرِ چندتایی از لیستِ استاندارد (تخصص‌ها/خدمات/مناطق) — ورودیِ آزاد ممنوع تا داده
// برای ML قابل‌اندازه‌گیری بماند؛ لیست‌ها را سوپرادمین (تخصص/خدمت) یا بازارِ واقعی (محلات) می‌سازد.
function PickTags({ value, onChange, options, placeholder, emptyHint }: { value: string[]; onChange: (v: string[]) => void; options: string[]; placeholder: string; emptyHint?: string }) {
  const [t, setT] = useState('')
  const remaining = options.filter(o => !value.includes(o))
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT('') }
  return (
    <div>
      {remaining.length > 0 || value.length > 0 ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={t} onChange={e => setT(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">{placeholder}</option>
            {remaining.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button type="button" onClick={add} disabled={!t} style={{ padding: '0 14px', borderRadius: 9, background: 'var(--goldDim)', border: '1px solid var(--gold)', color: 'var(--gold)', cursor: t ? 'pointer' : 'default', opacity: t ? 1 : 0.5, fontFamily: FONT, fontWeight: 700, fontSize: 13 }}>افزودن</button>
        </div>
      ) : (
        <div style={{ ...inp, color: 'var(--muted)', fontSize: 12.5 }}>{emptyHint || 'فعلاً گزینه‌ای موجود نیست'}</div>
      )}
      {value.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{value.map(v => <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>{v}<button type="button" onClick={() => onChange(value.filter(x => x !== v))} style={{ background: 'none', border: 'none', color: '#e7674a', cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button></span>)}</div>}
    </div>
  )
}

export default function BusinessProfileForm() {
  const [p, setP] = useState<any>(null)
  const [identity, setIdentity] = useState<any>(null)
  const [pct, setPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  // لیست‌های استاندارد: تخصص/خدمت از سوپرادمین؛ شهر/محله از درختِ geo + آگهی‌های واقعی.
  const [opts, setOpts] = useState<{ specialties: string[]; services: string[] }>({ specialties: [], services: [] })
  const [cities, setCities] = useState<string[]>([])
  const [hoods, setHoods] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => { if (d) { setP(d.profile); setIdentity(d.identity); setPct(d.completeness || 0) } }).catch(() => {})
    fetch('/api/profile/options').then(r => r.ok ? r.json() : null).then(d => { if (d) setOpts({ specialties: d.specialties || [], services: d.services || [] }) }).catch(() => {})
    fetch('/api/locations?cities=1').then(r => r.ok ? r.json() : null).then(d => { if (d) setCities(d.cities || []) }).catch(() => {})
  }, [])
  // محله‌های شهرِ انتخابی — خودگسترنده از آگهی‌های واقعی (مشکلِ «محلاتِ مشهد فقط ۱۰ تاست» را می‌بندد).
  const city = p?.city || ''
  useEffect(() => {
    if (!city) { setHoods([]); return }
    let alive = true
    fetch(`/api/locations?hoods=${encodeURIComponent(city)}`).then(r => r.ok ? r.json() : null).then(d => { if (alive && d) setHoods(d.hoods || []) }).catch(() => {})
    return () => { alive = false }
  }, [city])

  const set = (k: string, v: any) => setP((s: any) => ({ ...s, [k]: v }))
  const setSocial = (k: string, v: any) => setP((s: any) => ({ ...s, social: { ...s.social, [k]: v } }))
  const save = async () => {
    if (saving || !p) return
    setSaving(true); setMsg('')
    try {
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: p }) })
      const d = await r.json()
      if (d.ok) { setPct(d.completeness || 0); setMsg('✓ پروفایل ذخیره شد') } else setMsg('⚠ ' + (d.error || 'خطا'))
    } catch { setMsg('⚠ خطا در ارتباط') } finally { setSaving(false) }
  }

  if (!p) return <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontFamily: FONT }}>در حال بارگذاری پروفایل…</div>

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, maxWidth: 920 }}>
      {/* نوارِ پیشرفت */}
      <div style={{ ...card, background: 'linear-gradient(120deg, rgba(212,175,55,.1), transparent 60%), var(--surface)', borderColor: 'rgba(201,168,76,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 22 }}>🪪</span><div><div style={{ fontSize: 15, fontWeight: 900 }}>پروفایلِ من</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>هرچه کامل‌تر، اعتمادِ بیشتر و دیده‌شدنِ بهتر.</div></div></div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>تکمیل: {fa(pct)}٪</div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold2),var(--gold))', transition: 'width .3s' }} /></div>
      </div>

      {/* هویتِ تأییدشده (قفل) */}
      <Section title="هویتِ احرازشده" icon="🛡">
        {identity?.verified ? (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(95,217,138,.12)', border: '1px solid rgba(95,217,138,.4)', color: '#5fd98a', borderRadius: 999, padding: '5px 14px', fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>✓ هویتِ شما با سامانهٔ شاهکار تأیید شده است</div>
            <div style={grid} className="mjpf-grid">
              {buildIdentityRows(identity).map(r => (
                <Field key={r.label} label={r.label}><input value={r.value} readOnly style={{ ...inp, opacity: 0.85, direction: r.ltr ? 'ltr' : 'rtl', textAlign: r.ltr ? 'left' : 'right' }} /></Field>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.9 }}>هنوز هویتِ شما تأیید نشده است. در صورتِ فعال‌بودنِ احرازِ شاهکار، در ورودِ بعدی هویتتان راستی‌آزمایی می‌شود و این بخش خودکار پر خواهد شد.</div>
        )}
      </Section>

      {/* اطلاعاتِ کسب‌وکار */}
      <Section title="اطلاعاتِ کسب‌وکار" icon="🏢">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['business', 'personal'] as const).map(k => <button key={k} type="button" onClick={() => set('kind', k)} style={{ padding: '7px 16px', borderRadius: 9, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, border: `1px solid ${p.kind === k ? 'var(--gold)' : 'var(--line2)'}`, background: p.kind === k ? 'var(--goldDim)' : 'transparent', color: p.kind === k ? 'var(--gold)' : 'var(--muted)' }}>{k === 'business' ? 'کسب‌وکار' : 'شخصی'}</button>)}
        </div>
        <div style={grid} className="mjpf-grid">
          <Field label="نامِ کسب‌وکار / برند"><input value={p.businessName} onChange={e => set('businessName', e.target.value)} placeholder="مثلاً املاک ملک‌جت" style={inp} /></Field>
          <Field label="نامِ نمایشی"><input value={p.displayName} onChange={e => set('displayName', e.target.value)} placeholder={identity?.name || 'نامِ نمایشیِ شما'} style={inp} /></Field>
          <Field label="نوعِ فعالیت"><input value={p.businessType} onChange={e => set('businessType', e.target.value)} placeholder="مثلاً مشاور املاک / آژانس / سازنده" style={inp} /></Field>
          <Field label="شمارهٔ پروانه / جواز"><input value={p.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="شمارهٔ پروانهٔ کسب" style={inp} /></Field>
          <Field label="شناسهٔ ملیِ شخصِ حقوقی"><input value={p.legalNationalId} onChange={e => set('legalNationalId', e.target.value)} style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="کدِ اقتصادی"><input value={p.economicCode} onChange={e => set('economicCode', e.target.value)} style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="سالِ تأسیس"><input value={p.establishedYear} onChange={e => set('establishedYear', e.target.value)} placeholder="مثلاً ۱۳۹۵" style={inp} /></Field>
          <Field label="تعدادِ پرسنل"><input value={p.employees} onChange={e => set('employees', e.target.value)} placeholder="مثلاً ۱۲" style={inp} /></Field>
        </div>
      </Section>

      {/* معرفی و تصاویر */}
      <Section title="معرفی و تصاویر" icon="✦">
        <div style={grid} className="mjpf-grid">
          <Field label="لوگو"><ImageUpload value={p.logo} onChange={v => set('logo', v)} height={120} /></Field>
          <Field label="تصویرِ کاور"><ImageUpload value={p.cover} onChange={v => set('cover', v)} height={120} /></Field>
          <Field label="معرفیِ کوتاه (شعار)" full><input value={p.tagline} onChange={e => set('tagline', e.target.value)} placeholder="یک جملهٔ کوتاه دربارهٔ کسب‌وکارتان" style={inp} /></Field>
          <Field label="دربارهٔ ما" full><textarea value={p.about} onChange={e => set('about', e.target.value)} rows={4} placeholder="توضیحاتِ کاملِ کسب‌وکار، سابقه، تخصص و خدمات…" style={{ ...inp, resize: 'vertical', lineHeight: 1.9 }} /></Field>
          <Field label="تخصص‌ها"><PickTags value={p.specialties} onChange={v => set('specialties', v)} options={opts.specialties} placeholder="انتخابِ تخصص…" /></Field>
          <Field label="خدمات"><PickTags value={p.services} onChange={v => set('services', v)} options={opts.services} placeholder="انتخابِ خدمت…" /></Field>
          <Field label="مناطقِ فعالیت"><PickTags value={p.areas} onChange={v => set('areas', v)} options={hoods} placeholder={city ? 'انتخابِ محله…' : 'اول شهر را انتخاب کن'} emptyHint={city ? `هنوز محله‌ای برای «${city}» ثبت نشده — با رشدِ آگهی‌های این شهر خودکار کامل می‌شود` : 'اول در بخشِ «تماس و موقعیت» شهر را انتخاب کن'} /></Field>
          <Field label="ساعاتِ کاری"><input value={p.workHours} onChange={e => set('workHours', e.target.value)} placeholder="مثلاً شنبه تا چهارشنبه ۹ تا ۱۸" style={inp} /></Field>
        </div>
      </Section>

      {/* تماس و موقعیت */}
      <Section title="تماس و موقعیت" icon="📍">
        <div style={grid} className="mjpf-grid">
          <Field label="شمارهٔ تماسِ نمایشی"><input value={p.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="۰۹…" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} /></Field>
          <Field label="تلفنِ ثابت"><input value={p.landline} onChange={e => set('landline', e.target.value)} placeholder="۰۲۱…" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} /></Field>
          <Field label="ایمیل"><input value={p.email} onChange={e => set('email', e.target.value)} style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="وب‌سایت"><input value={p.website} onChange={e => set('website', e.target.value)} placeholder="https://" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="استان"><input value={p.province} onChange={e => set('province', e.target.value)} style={inp} /></Field>
          <Field label="شهر">
            <select value={p.city} onChange={e => { set('city', e.target.value); set('neighborhood', ''); set('areas', []) }} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">انتخابِ شهر…</option>
              {p.city && !cities.includes(p.city) && <option value={p.city}>{p.city}</option>}
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="محله">
            <select value={p.neighborhood} onChange={e => set('neighborhood', e.target.value)} style={{ ...inp, cursor: 'pointer' }} disabled={!city}>
              <option value="">{city ? 'انتخابِ محله…' : 'اول شهر را انتخاب کن'}</option>
              {p.neighborhood && !hoods.includes(p.neighborhood) && <option value={p.neighborhood}>{p.neighborhood}</option>}
              {hoods.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="کدِ پستی"><input value={p.postalCode} onChange={e => set('postalCode', e.target.value)} style={{ ...inp, direction: 'ltr', textAlign: 'right' }} /></Field>
          <Field label="آدرسِ کامل" full><textarea value={p.address} onChange={e => set('address', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></Field>
        </div>
      </Section>

      {/* شبکه‌های اجتماعی */}
      <Section title="شبکه‌های اجتماعی" icon="🌐">
        <div style={grid} className="mjpf-grid">
          <Field label="اینستاگرام"><input value={p.social?.instagram || ''} onChange={e => setSocial('instagram', e.target.value)} placeholder="@username" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="تلگرام"><input value={p.social?.telegram || ''} onChange={e => setSocial('telegram', e.target.value)} placeholder="@username" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="واتساپ"><input value={p.social?.whatsapp || ''} onChange={e => setSocial('whatsapp', e.target.value)} placeholder="۰۹…" style={{ ...inp, direction: 'ltr', textAlign: 'right' }} /></Field>
          <Field label="ایتا"><input value={p.social?.eitaa || ''} onChange={e => setSocial('eitaa', e.target.value)} placeholder="@username" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
          <Field label="لینکدین" full><input value={p.social?.linkedin || ''} onChange={e => setSocial('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" style={{ ...inp, direction: 'ltr', textAlign: 'left' }} /></Field>
        </div>
      </Section>

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 -6px 20px -10px rgba(0,0,0,.4)' }}>
        <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 11, background: 'linear-gradient(135deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: FONT, opacity: saving ? 0.6 : 1 }}>{saving ? 'در حال ذخیره…' : 'ذخیرهٔ پروفایل'}</button>
        {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✓') ? '#5fd98a' : '#e7674a' }}>{msg}</span>}
      </div>
    </div>
  )
}
