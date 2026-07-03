'use client';

import { useState, useRef, useEffect } from 'react';
import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';
import LocationPicker from '@/app/components/LocationPicker';
import LiveScore from '@/app/components/LiveScore';

interface GeoDistrict { id: string; name: string; neighborhoods: string[] }
interface GeoCity { id: string; name: string; districts: GeoDistrict[] }
interface GeoProvince { id: string; name: string; cities: GeoCity[] }

const STEPS = [
  { id: 1, label: 'معامله' },
  { id: 2, label: 'اطلاعات' },
  { id: 3, label: 'قیمت' },
  { id: 4, label: 'تصاویر' },
  { id: 5, label: 'بررسی' },
];

const DEAL_TYPES = ['فروش', 'اجاره', 'پیش‌فروش'];
const PROPERTY_TYPES = ['آپارتمان', 'خانه', 'ویلا', 'زمین', 'اداری', 'تجاری'];

type ToggleValue = 'yes' | 'no' | null;
type Images = (File | null)[];

interface FormData {
  dealType: string;
  propertyType: string;
  title: string;
  address: string;
  province: string;
  city: string;
  district: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  floor: string;
  totalFloors: string;
  area: string;
  rooms: string;
  buildingAge: string;
  parking: ToggleValue;
  elevator: ToggleValue;
  storage: ToggleValue;
  totalPrice: string;
  rent: string;
  deposit: string;
  images: Images;
  floorPlan: File | null;
}

export default function SubmitPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    dealType: '',
    propertyType: '',
    title: '',
    address: '',
    province: '',
    city: '',
    district: '',
    neighborhood: '',
    lat: null,
    lng: null,
    floor: '',
    totalFloors: '',
    area: '',
    rooms: '',
    buildingAge: '',
    parking: null,
    elevator: null,
    storage: null,
    totalPrice: '',
    rent: '',
    deposit: '',
    images: Array(8).fill(null),
    floorPlan: null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [geo, setGeo] = useState<GeoProvince[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: string; reason: string } | null>(null);

  const submitListing = async () => {
    if (submitting) return;
    if (!form.title.trim()) { alert('لطفاً عنوان آگهی را وارد کنید.'); return; }
    setSubmitting(true); setSubmitResult(null);
    try {
      const r = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, description: aiDescription, images: undefined, floorPlan: undefined }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'خطا در ثبت آگهی'); return; }
      setSubmitResult({ status: d.status, reason: d.reason });
    } catch {
      alert('خطا در ارتباط با سرور');
    } finally { setSubmitting(false); }
  };

  const [me, setMe] = useState<{ name: string } | null>(null);   // نامِ مشاور برای درجِ خودکار در توضیحات

  useEffect(() => {
    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { provinces: [] }))
      .then((d) => setGeo(d.provinces || []))
      .catch(() => {});
    fetch('/api/auth/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const a = d?.account; const nm = a?.fullName || [a?.firstName, a?.lastName].filter(Boolean).join(' ') || d?.name || ''; if (nm) setMe({ name: nm }); })
      .catch(() => {});
  }, []);

  // تطبیقِ نامِ برگشتی از نقشه با گزینه‌های موجودِ ژئو (نرمال‌سازی + شاملِ یکدیگر).
  const same = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const n = (s: string) => s.replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
    const x = n(a), y = n(b);
    return x === y || (x.length > 1 && (x.includes(y) || y.includes(x)));
  };

  // اگر مقدارِ پرشده از نقشه در فهرستِ ژئو نبود، همان را به‌عنوان گزینه نشان بده تا در دراپ‌داون دیده شود.
  const extraOpt = (val: string, names: string[]) => (val && !names.includes(val)) ? <option value={val}>{val}</option> : null;

  // کلیک روی نقشه → پرکردنِ خودکارِ آدرس + استان/شهر/منطقه/محله (تطبیق با ژئو، وگرنه همان مقدارِ نشان).
  const applyGeoPick = (r: { lat: number; lng: number; province?: string; city?: string; district?: string; neighbourhood?: string; address?: string }) => {
    setForm((prev) => {
      const next = { ...prev, lat: r.lat, lng: r.lng };
      if (r.address) next.address = r.address;
      const prov = geo.find((p) => same(p.name, r.province));
      next.province = prov?.name || r.province || next.province;
      const city = prov?.cities.find((c) => same(c.name, r.city));
      next.city = city?.name || r.city || next.city;
      const dist = city?.districts.find((d) => same(d.name, r.district) || d.neighborhoods.some((nb) => same(nb, r.neighbourhood)));
      next.district = dist?.name || r.district || next.district;
      const nb = dist?.neighborhoods.find((x) => same(x, r.neighbourhood));
      next.neighborhood = nb || r.neighbourhood || next.neighborhood;
      return next;
    });
  };

  const geoProvince = geo.find((p) => p.name === form.province);
  const geoCity = geoProvince?.cities.find((c) => c.name === form.city);
  const geoDistrict = geoCity?.districts.find((d) => d.name === form.district);
  const imageRefs = useRef<(HTMLInputElement | null)[]>(Array(8).fill(null));
  const floorPlanRef = useRef<HTMLInputElement | null>(null);

  const set = (key: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pricePerMeter =
    form.area && form.totalPrice
      ? Math.round(Number(form.totalPrice.replace(/,/g, '')) / Number(form.area)).toLocaleString('fa-IR')
      : null;

  const handleImageUpload = (index: number, file: File | null) => {
    const updated = [...form.images];
    updated[index] = file;
    set('images', updated);
  };

  const fallbackDesc = () =>
    `${form.propertyType || 'ملک'} ${form.area ? form.area + ' متری' : ''} در ${form.neighborhood || form.city || 'موقعیت مناسب'}${form.rooms ? '، دارای ' + form.rooms + ' اتاق خواب' : ''}${form.parking === 'yes' ? '، پارکینگ' : ''}${form.elevator === 'yes' ? '، آسانسور' : ''}${form.storage === 'yes' ? '، انباری' : ''}. موقعیت عالی با دسترسی آسان به امکانات شهری.${me?.name ? ` جهتِ هماهنگیِ بازدید با ${me.name} تماس بگیرید.` : ''}`;

  // توضیحاتِ واقعیِ هوش مصنوعی — کامل، حرفه‌ای، با ذکرِ نامِ مشاور. اگر AI در دسترس نبود، قالبِ محلی.
  const handleGenerateDescription = async () => {
    setAiLoading(true);
    try {
      const specs = [
        form.propertyType && `نوعِ ملک: ${form.propertyType}`,
        form.dealType && `نوعِ معامله: ${form.dealType === 'rent' ? 'اجاره' : 'فروش'}`,
        form.area && `متراژ: ${form.area} متر`,
        form.rooms && `اتاقِ خواب: ${form.rooms}`,
        [form.city, form.district, form.neighborhood].filter(Boolean).length && `موقعیت: ${[form.city, form.district, form.neighborhood].filter(Boolean).join('، ')}`,
        form.address && `آدرس: ${form.address}`,
        form.floor && `طبقه: ${form.floor}${form.totalFloors ? ' از ' + form.totalFloors : ''}`,
        form.buildingAge && `سنِ بنا: ${form.buildingAge} سال`,
        form.parking === 'yes' && 'پارکینگ دارد',
        form.elevator === 'yes' && 'آسانسور دارد',
        form.storage === 'yes' && 'انباری دارد',
        form.totalPrice && `قیمتِ کل: ${form.totalPrice} تومان`,
        form.rent && `اجارهٔ ماهانه: ${form.rent} تومان`,
        form.deposit && `ودیعه: ${form.deposit} تومان`,
      ].filter(Boolean).join('\n');
      const input = `برای این ملک یک «توضیحاتِ آگهیِ» حرفه‌ای، جذاب و کاملِ فارسی بنویس (حدودِ ۵ تا ۷ جمله، لحنِ مشاورِ املاکِ حرفه‌ای). ویژگی‌ها را روان و کامل توصیف کن، نقاطِ قوت و موقعیت و دسترسی‌ها را برجسته کن، و در پایان یک دعوت به تماس/بازدید بگذار.${me?.name ? ` حتماً در پایان نامِ «${me.name}» را به‌عنوانِ مشاورِ تنظیم‌کنندهٔ آگهی ذکر کن.` : ''} فقط متنِ توضیحات را بده — بدونِ تیتر، بدونِ علامتِ نقل‌قول، بدونِ فهرست.\n\nمشخصاتِ ملک:\n${specs}`;
      const r = await fetch('/api/ai/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'content', input }) });
      const d = await r.json();
      if (r.ok && d.text && String(d.text).trim()) setAiDescription(String(d.text).trim());
      else setAiDescription(fallbackDesc());
    } catch {
      setAiDescription(fallbackDesc());
    } finally {
      setAiLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: 780,
    margin: '0 auto',
    padding: '32px 16px 64px',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 16,
    padding: 28,
    marginBottom: 24,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg2)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    padding: '10px 14px',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    color: 'var(--muted)',
    marginBottom: 6,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 20,
    color: 'var(--text)',
  };

  // ─── Progress Bar ───────────────────────────────────────────────────────────
  const progressBar = (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
      {STEPS.map((s, i) => {
        const active = step === s.id;
        const done = step > s.id;
        const color = active || done ? 'var(--gold)' : 'var(--line2)';
        return (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {i > 0 && <div style={{ flex: 1, height: 2, background: done ? 'var(--gold)' : 'var(--line)' }} />}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: active || done ? 'var(--gold)' : 'var(--bg2)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
                color: active || done ? '#000' : 'var(--muted)',
                flexShrink: 0,
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : s.id}
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: done ? 'var(--gold)' : 'var(--line)' }} />}
            </div>
            <span style={{ fontSize: 11, marginTop: 6, color: active ? 'var(--gold)' : 'var(--muted)', fontWeight: active ? 700 : 400 }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  // ─── Toggle Button ──────────────────────────────────────────────────────────
  const Toggle = ({ value, onChange }: { value: ToggleValue; onChange: (v: ToggleValue) => void }) => (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['yes', 'no'] as ToggleValue[]).map((v) => (
        <button key={v} onClick={() => onChange(value === v ? null : v)} style={{
          padding: '8px 20px', borderRadius: 8, border: '1px solid',
          borderColor: value === v ? 'var(--gold)' : 'var(--line)',
          background: value === v ? 'var(--gold)' : 'var(--bg2)',
          color: value === v ? '#000' : 'var(--muted)',
          cursor: 'pointer', fontWeight: value === v ? 700 : 400, fontSize: 14,
        }}>
          {v === 'yes' ? 'بله' : 'خیر'}
        </button>
      ))}
    </div>
  );

  // ─── Step 1: Deal & Property Type ───────────────────────────────────────────
  const step1 = (
    <div>
      <div style={cardStyle}>
        <p style={sectionTitle}>نوع معامله</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {DEAL_TYPES.map((t) => (
            <button key={t} onClick={() => set('dealType', t)} style={{
              flex: 1, minWidth: 120, padding: '18px 24px', borderRadius: 12, border: '2px solid',
              borderColor: form.dealType === t ? 'var(--gold)' : 'var(--line)',
              background: form.dealType === t ? 'rgba(var(--gold-rgb,212,175,55),0.08)' : 'var(--bg2)',
              color: form.dealType === t ? 'var(--gold)' : 'var(--text)',
              cursor: 'pointer', fontSize: 17, fontWeight: 700, transition: 'all 0.2s',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={cardStyle}>
        <p style={sectionTitle}>نوع ملک</p>
        <div className="mjsub-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {PROPERTY_TYPES.map((t) => (
            <button key={t} onClick={() => set('propertyType', t)} style={{
              padding: '22px 12px', borderRadius: 12, border: '2px solid',
              borderColor: form.propertyType === t ? 'var(--gold)' : 'var(--line)',
              background: form.propertyType === t ? 'rgba(var(--gold-rgb,212,175,55),0.08)' : 'var(--bg2)',
              color: form.propertyType === t ? 'var(--gold)' : 'var(--text)',
              cursor: 'pointer', fontSize: 16, fontWeight: 600, transition: 'all 0.2s',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Step 2: Basic Info ──────────────────────────────────────────────────────
  const step2 = (
    <div style={cardStyle}>
      <p style={sectionTitle}>اطلاعات ملک</p>
      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <label style={labelStyle}>عنوان آگهی</label>
          <input style={inputStyle} placeholder="مثلاً: آپارتمان ۱۲۰ متری نوساز در سعادت‌آباد" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>آدرس کامل</label>
          <textarea style={{ ...inputStyle, height: 80, resize: 'none' }} placeholder="استان، شهر، خیابان، کوچه..." value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="mjsub-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>استان</label>
            <select style={inputStyle} value={form.province} onChange={(e) => { set('province', e.target.value); set('city', ''); set('district', ''); set('neighborhood', ''); }}>
              <option value="">انتخاب کنید</option>
              {extraOpt(form.province, geo.map((p) => p.name))}
              {geo.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>شهر</label>
            <select style={inputStyle} value={form.city} onChange={(e) => { set('city', e.target.value); set('district', ''); set('neighborhood', ''); }} disabled={!form.province}>
              <option value="">انتخاب کنید</option>
              {extraOpt(form.city, (geoProvince?.cities || []).map((c) => c.name))}
              {(geoProvince?.cities || []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mjsub-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>منطقه</label>
            <select style={inputStyle} value={form.district} onChange={(e) => { set('district', e.target.value); set('neighborhood', ''); }} disabled={!form.city}>
              <option value="">انتخاب کنید</option>
              {extraOpt(form.district, (geoCity?.districts || []).map((d) => d.name))}
              {(geoCity?.districts || []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>محله</label>
            <select style={inputStyle} value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} disabled={!form.district}>
              <option value="">انتخاب کنید</option>
              {extraOpt(form.neighborhood, geoDistrict?.neighborhoods || [])}
              {(geoDistrict?.neighborhoods || []).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>موقعیت روی نقشه — روی محلِ ملک کلیک کنید تا آدرس، استان، شهر، منطقه و محله خودکار پر شود</label>
          <LocationPicker
            lat={form.lat}
            lng={form.lng}
            onPick={applyGeoPick}
          />
        </div>
        <div className="mjsub-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={labelStyle}>طبقه</label>
            <input style={inputStyle} type="number" placeholder="۳" value={form.floor} onChange={(e) => set('floor', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>تعداد طبقات</label>
            <input style={inputStyle} type="number" placeholder="۷" value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>متراژ (م²)</label>
            <input style={inputStyle} type="number" placeholder="۱۲۰" value={form.area} onChange={(e) => set('area', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>تعداد اتاق</label>
            <input style={inputStyle} type="number" placeholder="۳" value={form.rooms} onChange={(e) => set('rooms', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>سن بنا (سال)</label>
            <input style={inputStyle} type="number" placeholder="۵" value={form.buildingAge} onChange={(e) => set('buildingAge', e.target.value)} />
          </div>
        </div>
        <div className="mjsub-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {([['parking', 'پارکینگ'], ['elevator', 'آسانسور'], ['storage', 'انباری']] as [keyof FormData, string][]).map(([key, label]) => (
            <div key={key}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>{label}</label>
              <Toggle value={form[key] as ToggleValue} onChange={(v) => set(key, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Step 3: Price ───────────────────────────────────────────────────────────
  const isRent = form.dealType === 'اجاره';
  const step3 = (
    <div>
      <div style={cardStyle}>
        <p style={sectionTitle}>قیمت‌گذاری</p>
        {isRent ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={labelStyle}>ودیعه (تومان)</label>
              <input style={inputStyle} type="text" placeholder="۵۰,۰۰۰,۰۰۰" value={form.deposit} onChange={(e) => set('deposit', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>اجاره ماهانه (تومان)</label>
              <input style={inputStyle} type="text" placeholder="۳,۵۰۰,۰۰۰" value={form.rent} onChange={(e) => set('rent', e.target.value)} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={labelStyle}>قیمت کل (تومان)</label>
              <input style={inputStyle} type="text" placeholder="۳,۵۰۰,۰۰۰,۰۰۰" value={form.totalPrice} onChange={(e) => set('totalPrice', e.target.value)} />
            </div>
            {pricePerMeter && (
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>قیمت هر متر مربع</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>{pricePerMeter} تومان</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ ...cardStyle, border: '1.5px solid var(--gold)', background: 'rgba(var(--gold-rgb,212,175,55),0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ color: 'var(--gold)', fontSize: 20 }}>✦</span>
          <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)', margin: 0 }}>پیشنهاد قیمت هوش مصنوعی</p>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>
          بر اساس آمار معاملات اخیر منطقه و ویژگی‌های ملک شما:
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>حداقل پیشنهادی</div>
            <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>۳,۲۰۰,۰۰۰,۰۰۰</div>
            <div style={{ color: 'var(--faint)', fontSize: 11 }}>تومان</div>
          </div>
          <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 4 }}>حداکثر پیشنهادی</div>
            <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>۳,۸۰۰,۰۰۰,۰۰۰</div>
            <div style={{ color: 'var(--faint)', fontSize: 11 }}>تومان</div>
          </div>
        </div>
        <p style={{ color: 'var(--faint)', fontSize: 12, marginTop: 12, margin: '12px 0 0' }}>
          ✦ این پیشنهاد بر اساس ۴۷ معامله مشابه در ۳ ماه اخیر محاسبه شده است.
        </p>
      </div>
    </div>
  );

  // ─── Step 4: Images ──────────────────────────────────────────────────────────
  const step4 = (
    <div>
      <div style={cardStyle}>
        <p style={sectionTitle}>تصاویر ملک</p>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
          حداکثر ۸ تصویر با کیفیت بالا آپلود کنید. فرمت‌های JPG، PNG و WEBP پشتیبانی می‌شوند.
        </p>
        <div className="mjsub-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array(8).fill(null).map((_, i) => (
            <div
              key={i}
              onClick={() => imageRefs.current[i]?.click()}
              style={{
                aspectRatio: '1', borderRadius: 10, border: '2px dashed',
                borderColor: form.images[i] ? 'var(--gold)' : 'var(--line2)',
                background: form.images[i] ? 'rgba(var(--gold-rgb,212,175,55),0.05)' : 'var(--bg2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 6, transition: 'all 0.2s',
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={(el) => { imageRefs.current[i] = el; }}
                onChange={(e) => handleImageUpload(i, e.target.files?.[0] ?? null)}
              />
              {form.images[i] ? (
                <>
                  <span style={{ fontSize: 24 }}>✓</span>
                  <span style={{ color: 'var(--gold)', fontSize: 11 }}>تصویر {i + 1}</span>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--muted)', fontSize: 24 }}>＋</span>
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>عکس {i + 1}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={cardStyle}>
        <p style={{ ...sectionTitle, marginBottom: 14 }}>نقشه پلان</p>
        <div
          onClick={() => floorPlanRef.current?.click()}
          style={{
            borderRadius: 10, border: '2px dashed',
            borderColor: form.floorPlan ? 'var(--gold)' : 'var(--line2)',
            background: 'var(--bg2)', padding: '28px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            cursor: 'pointer',
          }}
        >
          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} ref={floorPlanRef} onChange={(e) => set('floorPlan', e.target.files?.[0] ?? null)} />
          <span style={{ fontSize: 32, color: form.floorPlan ? 'var(--gold)' : 'var(--muted)' }}>🗺</span>
          <span style={{ color: form.floorPlan ? 'var(--gold)' : 'var(--muted)', fontSize: 14 }}>
            {form.floorPlan ? form.floorPlan.name : 'بارگذاری نقشه پلان'}
          </span>
          <span style={{ color: 'var(--faint)', fontSize: 12 }}>فرمت‌های JPG، PNG و PDF پشتیبانی می‌شوند</span>
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: 'var(--gold)', fontSize: 18 }}>✦</span>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            پشتیبانی از تور مجازی ۳۶۰ درجه — برای اضافه کردن تور ۳۶۰°، لینک را پس از ثبت آگهی در پنل مدیریت وارد کنید.
          </p>
        </div>
      </div>
    </div>
  );

  // ─── Step 5: Review ──────────────────────────────────────────────────────────
  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{value || '—'}</span>
    </div>
  );

  const step5 = (
    <div>
      <div className="mjsub-summary" style={cardStyle}>
        <p style={sectionTitle}>خلاصه آگهی</p>
        <SummaryRow label="نوع معامله" value={form.dealType} />
        <SummaryRow label="نوع ملک" value={form.propertyType} />
        <SummaryRow label="عنوان" value={form.title} />
        <SummaryRow label="استان / شهر" value={[form.province, form.city].filter(Boolean).join(' / ')} />
        <SummaryRow label="منطقه / محله" value={[form.district, form.neighborhood].filter(Boolean).join(' / ')} />
        <SummaryRow label="متراژ" value={form.area ? form.area + ' متر مربع' : ''} />
        <SummaryRow label="اتاق" value={form.rooms ? form.rooms + ' اتاق' : ''} />
        <SummaryRow label="طبقه" value={form.floor ? `طبقه ${form.floor} از ${form.totalFloors || '؟'}` : ''} />
        <SummaryRow label="سن بنا" value={form.buildingAge ? form.buildingAge + ' سال' : ''} />
        <SummaryRow label="پارکینگ" value={form.parking === 'yes' ? 'دارد' : form.parking === 'no' ? 'ندارد' : ''} />
        <SummaryRow label="آسانسور" value={form.elevator === 'yes' ? 'دارد' : form.elevator === 'no' ? 'ندارد' : ''} />
        <SummaryRow label="انباری" value={form.storage === 'yes' ? 'دارد' : form.storage === 'no' ? 'ندارد' : ''} />
        {isRent ? (
          <>
            <SummaryRow label="ودیعه" value={form.deposit ? form.deposit + ' تومان' : ''} />
            <SummaryRow label="اجاره ماهانه" value={form.rent ? form.rent + ' تومان' : ''} />
          </>
        ) : (
          <SummaryRow label="قیمت کل" value={form.totalPrice ? form.totalPrice + ' تومان' : ''} />
        )}
        <SummaryRow label="تصاویر آپلود شده" value={form.images.filter(Boolean).length + ' تصویر'} />
      </div>
      <div style={{ ...cardStyle, border: '1.5px solid var(--gold)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ color: 'var(--gold)', fontSize: 20 }}>✦</span>
          <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold)', margin: 0 }}>توضیحات هوشمند</p>
        </div>
        {aiDescription ? (
          <>
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              rows={7}
              style={{ width: '100%', background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px', color: 'var(--text)', fontSize: 14, lineHeight: 1.9, marginBottom: 8, border: '1px solid var(--line2)', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
            <p style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 14 }}>می‌توانید متن را ویرایش کنید — کم/زیاد کنید یا با دکمهٔ زیر دوباره با هوش مصنوعی بنویسید.</p>
          </>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>
            با یک کلیک، هوش مصنوعی MelkJet یک توضیحِ کامل و حرفه‌ای برای آگهی شما می‌نویسد (با نامِ شما) — و بعد می‌توانید ویرایشش کنید.
          </p>
        )}
        <button
          onClick={handleGenerateDescription}
          disabled={aiLoading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: aiLoading ? 'var(--goldDim)' : 'var(--gold)',
            color: '#000', border: 'none', cursor: aiLoading ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {aiLoading ? (
            <>
              <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #00000040', borderTop: '2px solid #000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              در حال تولید توضیحات...
            </>
          ) : (
            <>✦ {aiDescription ? 'بازنویسی توضیحات' : 'تولید توضیحات با هوش مصنوعی'}</>
          )}
        </button>
      </div>
    </div>
  );

  const STEP_CONTENT = [step1, step2, step3, step4, step5];

  return (
    <div dir="rtl" style={containerStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Nav />
      <div className="mjsub-grid" style={innerStyle}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>ثبت آگهی ملک</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>اطلاعات ملک خود را در چند مرحله وارد کنید.</p>
        {progressBar}
        {STEP_CONTENT[step - 1]}
        {/* امتیاز و تحلیلِ زندهٔ آگهی هنگامِ ثبت */}
        <div style={{ marginTop: 18 }}>
          <LiveScore kind="listing" ready={!!form.title.trim()} data={{
            'عنوان': form.title, 'نوع معامله': form.dealType, 'نوع ملک': form.propertyType,
            'شهر': form.city, 'محله': form.neighborhood || form.district, 'آدرس': form.address,
            'متراژ': form.area, 'اتاق خواب': form.rooms, 'طبقه': form.floor, 'تعداد طبقات': form.totalFloors,
            'سن بنا': form.buildingAge,
            'پارکینگ': form.parking === 'yes' ? 'دارد' : form.parking === 'no' ? 'ندارد' : '',
            'آسانسور': form.elevator === 'yes' ? 'دارد' : form.elevator === 'no' ? 'ندارد' : '',
            'انباری': form.storage === 'yes' ? 'دارد' : form.storage === 'no' ? 'ندارد' : '',
            'قیمت': form.totalPrice || [form.deposit && `ودیعه ${form.deposit}`, form.rent && `اجاره ${form.rent}`].filter(Boolean).join(' · '),
            'توضیحات': aiDescription || '',
            'تعداد عکس': String(form.images.filter(Boolean).length),
          }} />
        </div>
        {/* Bottom Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{
              padding: '12px 28px', borderRadius: 10,
              background: 'var(--bg2)', border: '1px solid var(--line)',
              color: step === 1 ? 'var(--faint)' : 'var(--text)',
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 15,
            }}
          >
            ← بازگشت
          </button>
          {step < 5 ? (
            <button
              onClick={() => {
                if (step === 1 && (!form.dealType || !form.propertyType)) { alert('لطفاً نوع معامله و نوع ملک را انتخاب کنید.'); return; }
                if (step === 2 && (!form.title.trim() || !form.area.trim())) { alert('لطفاً عنوان آگهی و متراژ را وارد کنید.'); return; }
                setStep((s) => Math.min(5, s + 1));
              }}
              style={{
                padding: '12px 36px', borderRadius: 10,
                background: 'var(--gold)', border: 'none',
                color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 15,
              }}
            >
              مرحله بعد ←
            </button>
          ) : (
            <button
              disabled={submitting}
              style={{
                padding: '12px 36px', borderRadius: 10,
                background: 'var(--gold)', border: 'none',
                color: '#000', cursor: submitting ? 'default' : 'pointer', fontWeight: 700, fontSize: 15,
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={submitListing}
            >
              {submitting ? '⏳ در حال ثبت و بررسی هوش مصنوعی…' : '✦ ثبت نهایی آگهی'}
            </button>
          )}
        </div>

        {submitResult && (
          <div style={{
            marginTop: 18, borderRadius: 12, padding: '16px 18px',
            border: `1px solid ${submitResult.status === 'approved' ? '#5fd98a' : submitResult.status === 'rejected' ? '#e7674a' : '#e7a14a'}`,
            background: submitResult.status === 'approved' ? 'rgba(95,217,138,.08)' : submitResult.status === 'rejected' ? 'rgba(231,103,74,.08)' : 'rgba(231,161,74,.08)',
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: submitResult.status === 'approved' ? '#5fd98a' : submitResult.status === 'rejected' ? '#e7674a' : '#e7a14a' }}>
              {submitResult.status === 'approved' ? '✓ آگهی شما توسط هوش مصنوعی تأیید و منتشر شد' : submitResult.status === 'rejected' ? '✕ آگهی شما توسط هوش مصنوعی رد شد' : '⏳ آگهی شما برای بازبینی دستی ارسال شد'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>علت: {submitResult.reason}</div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
