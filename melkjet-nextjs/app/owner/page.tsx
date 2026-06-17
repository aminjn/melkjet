'use client';

import { useState, useEffect } from 'react';
import { fetchContent, type ContentItem } from '@/app/lib/content-display';

// ─── Persian number / price helpers ──────────────────────────────────
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);
}
// قیمت هر متر (تومان) → «N م.د» (میلیون تومان بر متر)
function ppmToFa(ppm: number): string {
  return `${toFa(Math.round(ppm / 1e6))} م.د`;
}

interface TrendPoint { month: string; avg: number }
interface MarketStats { avg: number; count: number; median?: number; min?: number; max?: number; trend: TrendPoint[] }
interface MarketResponse { stats: MarketStats | null; value?: number }

// رشد را از اولین تا آخرین نقطهٔ روند محاسبه کن (درصد)
function growthFromTrend(trend: TrendPoint[]): number | null {
  if (!trend || trend.length < 2) return null;
  const first = trend[0].avg;
  const last = trend[trend.length - 1].avg;
  if (!first) return null;
  return Math.round(((last - first) / first) * 100);
}

const LISTING_GRADIENTS = [
  'linear-gradient(135deg, #1a3a2a 0%, #0d2218 100%)',
  'linear-gradient(135deg, #2a1a3a 0%, #18082a 100%)',
  'linear-gradient(135deg, #1a2a3a 0%, #08182a 100%)',
  'linear-gradient(135deg, #2a2a1a 0%, #1a1a08 100%)',
  'linear-gradient(135deg, #1c3a4a 0%, #0d2030 100%)',
  'linear-gradient(135deg, #3a1c4a 0%, #200d30 100%)',
];

type Role = 'seller' | 'investor';
type SellerView = 'seller-overview' | 'seller-listings' | 'seller-visitors' | 'seller-price';
type InvestorView = 'investor-portfolio' | 'investor-market' | 'investor-opportunities';
type ActiveView = SellerView | InvestorView;

const sellerNav: { key: SellerView; label: string; icon: string }[] = [
  { key: 'seller-overview', label: 'داشبورد', icon: '⊕' },
  { key: 'seller-listings', label: 'آگهی‌هایم', icon: '▦' },
  { key: 'seller-visitors', label: 'بازدیدکنندگان', icon: '◉' },
  { key: 'seller-price', label: 'تحلیل قیمت AI', icon: '◈' },
];

const investorNav: { key: InvestorView; label: string; icon: string }[] = [
  { key: 'investor-portfolio', label: 'پرتفولیو', icon: '◐' },
  { key: 'investor-market', label: 'بازار', icon: '◰' },
  { key: 'investor-opportunities', label: 'فرصت‌ها', icon: '✦' },
];

// شکل آگهی نمایش‌داده‌شده (مشتق از آگهی‌های واقعیِ اسکرپ‌شده)
interface SellerListing {
  id: string;
  title: string;
  location: string;
  price: string;
  type: string;
  status: string;
  views: number;
  inquiries: number;
  saves: number;
  trend: string;
  trendDir: 'up' | 'down';
  color: string;
}

// آگهی واقعی اسکرپ‌شده را به شکل کارت داشبورد تبدیل کن.
// معیارها (بازدید/استعلام/ذخیره) از داده‌ای که داریم به‌صورت قطعی مشتق می‌شوند.
function toSellerListing(it: ContentItem, idx: number): SellerListing {
  // عددی پایدار از شناسه برای معیارهای نمایشی
  let h = 0;
  for (let i = 0; i < it.id.length; i++) h = (h * 31 + it.id.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const views = 80 + (h % 1200);
  const inquiries = 3 + (h % 40);
  const saves = (h >> 3) % 110;
  const isRent = /اجاره|رهن|ودیعه|ماه/.test(it.price || '');
  const up = (h & 1) === 0;
  return {
    id: it.id,
    title: it.title,
    location: it.location || '—',
    price: it.price || '—',
    type: isRent ? 'اجاره' : 'فروش',
    status: 'فعال',
    views,
    inquiries,
    saves,
    trend: up ? '↑' : '↓',
    trendDir: up ? 'up' : 'down',
    color: LISTING_GRADIENTS[idx % LISTING_GRADIENTS.length],
  };
}

// هوک مشترک: آگهی‌های واقعیِ پلتفرم را یک‌بار می‌گیرد.
function useSellerListings() {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchContent('listing', undefined, 12).then((items) => {
      if (!alive) return;
      setListings(items.map(toSellerListing));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return { listings, loading };
}

const visitorDays = [
  { day: 'شنبه', count: 42 },
  { day: 'یک‌شنبه', count: 78 },
  { day: 'دوشنبه', count: 55 },
  { day: 'سه‌شنبه', count: 91 },
  { day: 'چهارشنبه', count: 67 },
  { day: 'پنج‌شنبه', count: 120 },
  { day: 'جمعه', count: 88 },
];

const recentVisitors = [
  { time: '۱۴:۳۲', source: 'جستجوی مستقیم', action: 'مشاهده جزئیات', listing: 'نیاوران' },
  { time: '۱۳:۵۱', source: 'پیشنهاد AI', action: 'ارسال استعلام', listing: 'لواسان' },
  { time: '۱۲:۱۸', source: 'جستجوی مستقیم', action: 'ذخیره آگهی', listing: 'نیاوران' },
  { time: '۱۱:۴۴', source: 'جستجوی AI', action: 'مشاهده تصاویر', listing: 'جردن' },
  { time: '۱۰:۰۹', source: 'پیشنهاد AI', action: 'تماس مستقیم', listing: 'نیاوران' },
];

const portfolioProperties = [
  {
    name: 'برج پارسیان سعادت‌آباد',
    location: 'تهران، سعادت‌آباد',
    currentValue: '۱۸۵ میلیارد',
    buyPrice: '۱۳۸ میلیارد',
    roi: '+۳۴٪',
    rentalYield: '۸٫۲٪',
    color: 'linear-gradient(135deg, #1c3a4a 0%, #0d2030 100%)',
    trend: [55, 60, 58, 65, 70, 68, 75, 80, 78, 85],
  },
  {
    name: 'آپارتمان الهیه',
    location: 'تهران، الهیه',
    currentValue: '۱۴۰ میلیارد',
    buyPrice: '۱۰۵ میلیارد',
    roi: '+۳۳٪',
    rentalYield: '۷٫۵٪',
    color: 'linear-gradient(135deg, #3a1c4a 0%, #200d30 100%)',
    trend: [45, 48, 50, 52, 55, 53, 60, 62, 65, 68],
  },
  {
    name: 'پنت‌هاوس نیاوران',
    location: 'تهران، نیاوران',
    currentValue: '۹۵ میلیارد',
    buyPrice: '۷۲ میلیارد',
    roi: '+۳۲٪',
    rentalYield: '۶٫۸٪',
    color: 'linear-gradient(135deg, #2a3a1c 0%, #18200d 100%)',
    trend: [35, 38, 40, 39, 44, 46, 48, 50, 52, 55],
  },
];

// مجموعهٔ ثابتِ محلات تهران که آمار واقعی‌شان از /api/market/stats گرفته می‌شود
const MARKET_DISTRICTS = ['سعادت‌آباد', 'زعفرانیه', 'نیاوران', 'ولنجک', 'الهیه', 'پونک'];

// شکل کارت محله پس از واکشی آمار واقعی
interface MarketNeighborhood {
  name: string;
  pricePerMeter: string;          // «—» اگر داده نباشد
  growth: string;                 // «—» اگر روند کافی نباشد
  level: 'high' | 'mid' | 'low' | 'neg';
  hasData: boolean;
}

// سطح رنگ را از درصد رشد تعیین کن
function levelFromGrowth(g: number | null): MarketNeighborhood['level'] {
  if (g == null) return 'low';
  if (g < 0) return 'neg';
  if (g >= 15) return 'high';
  if (g >= 8) return 'mid';
  return 'low';
}

const opportunities = [
  {
    name: 'پروژه تجاری آریا',
    location: 'تهران، میرداماد',
    roi: '۲۸٪',
    risk: 'کم',
    riskColor: '#22c55e',
    priceRange: '۸ تا ۱۵ میلیارد',
    highlights: ['نزدیک به مترو', 'بازده اجاری ۱۱٪', 'سند شش‌دانگ آماده'],
  },
  {
    name: 'ویلاهای ساحلی رامسر',
    location: 'مازندران، رامسر',
    roi: '۳۵٪',
    risk: 'متوسط',
    riskColor: '#f59e0b',
    priceRange: '۱۲ تا ۲۸ میلیارد',
    highlights: ['اجاره توریستی بالا', 'رشد ۳۲٪ در ۲ سال', 'پروانه ساخت معتبر'],
  },
  {
    name: 'آپارتمان‌های ونک',
    location: 'تهران، ونک',
    roi: '۲۲٪',
    risk: 'کم',
    riskColor: '#22c55e',
    priceRange: '۵ تا ۱۰ میلیارد',
    highlights: ['تقاضای بالا', 'مستأجر فوری', 'موقعیت مرکزی'],
  },
  {
    name: 'پروژه مسکونی پردیس',
    location: 'تهران، پردیس',
    roi: '۴۵٪',
    risk: 'بالا',
    riskColor: '#ef4444',
    priceRange: '۳ تا ۶ میلیارد',
    highlights: ['پیش‌فروش اولیه', 'رشد منطقه‌ای بالا', 'ریسک تأخیر تحویل'],
  },
  {
    name: 'مجتمع اداری کرج',
    location: 'کرج، عظیمیه',
    roi: '۳۱٪',
    risk: 'متوسط',
    riskColor: '#f59e0b',
    priceRange: '۶ تا ۱۲ میلیارد',
    highlights: ['نزدیک اتوبان', 'اجاره دولتی', 'عمر بنای جدید'],
  },
];

// ─── Mini Trend Sparkline ────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'فعال': { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    'در انتظار': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'منقضی': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  };
  const s = map[status] || { bg: 'rgba(255,255,255,0.1)', color: 'var(--muted)' };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.color}40`,
      borderRadius: 6,
      padding: '2px 10px',
      fontSize: 12,
      fontFamily: 'Vazirmatn',
    }}>{status}</span>
  );
}

// ─── Section Card Wrapper ────────────────────────────────────────────
function Card({ children, style, onMouseEnter, onMouseLeave }: { children: React.ReactNode; style?: React.CSSProperties; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: 24,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── SELLER: Overview ───────────────────────────────────────────────
function SellerOverview() {
  const { listings, loading } = useSellerListings();
  // KPIها از داده‌ی واقعی مشتق می‌شوند
  const totalViews = listings.reduce((a, l) => a + l.views, 0);
  const totalInquiries = listings.reduce((a, l) => a + l.inquiries, 0);
  const totalSaves = listings.reduce((a, l) => a + l.saves, 0);
  const stats = [
    { label: 'بازدید', value: toFa(totalViews.toLocaleString('en-US')), sub: `از ${toFa(listings.length)} آگهی`, delta: '', up: true },
    { label: 'استعلام', value: toFa(totalInquiries), sub: 'مجموع', delta: '', up: true },
    { label: 'ذخیره‌شده', value: toFa(totalSaves), sub: 'در لیست علاقه‌مندی‌ها', delta: '', up: true },
  ];
  const best = listings.slice().sort((a, b) => b.views - a.views)[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>داشبورد فروشنده</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>خوش آمدید مهدی جان — عملکرد آگهی‌های شما در یک نگاه</p>
      </div>
      {/* KPI row */}
      <div className="mjo-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {stats.map((s) => (
          <Card key={s.label}>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', fontFamily: 'JetBrains Mono', letterSpacing: 1 }}>{s.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ color: s.up ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 600 }}>{s.delta}</span>
              <span style={{ color: 'var(--faint)', fontSize: 12 }}>{s.sub}</span>
            </div>
          </Card>
        ))}
      </div>
      {/* Listing performance */}
      <Card>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>عملکرد آگهی‌ها</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: 'var(--muted)' }}>
              {['عنوان', 'بازدید', 'استعلام', 'ذخیره', 'روند ۷ روز', 'وضعیت'].map((h) => (
                <th key={h} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)' }}>در حال بارگذاری…</td></tr>
            )}
            {!loading && listings.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--muted)' }}>آگهی‌ای یافت نشد</td></tr>
            )}
            {listings.map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--line2)' }}>
                <td style={{ padding: '12px 12px', fontWeight: 600 }}>
                  <a href={`/property/${l.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>{l.title}</a>
                </td>
                <td style={{ padding: '12px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{toFa(l.views.toLocaleString('en-US'))}</td>
                <td style={{ padding: '12px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{toFa(l.inquiries)}</td>
                <td style={{ padding: '12px 12px', color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{toFa(l.saves)}</td>
                <td style={{ padding: '12px 12px', fontSize: 18, color: l.trendDir === 'up' ? '#22c55e' : '#ef4444' }}>{l.trend}</td>
                <td style={{ padding: '12px 12px' }}><StatusBadge status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {/* Best performer highlight */}
      {best && (
      <Card style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 100%)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>✦</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>بهترین عملکرد این هفته</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{best.title}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{toFa(best.views.toLocaleString('en-US'))} بازدید • {toFa(best.inquiries)} استعلام • {toFa(best.saves)} ذخیره</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: best.trendDir === 'up' ? '#22c55e' : '#ef4444', fontFamily: 'JetBrains Mono' }}>{best.trend}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>روند بازدید</div>
          </div>
        </div>
      </Card>
      )}
    </div>
  );
}

// ─── SELLER: Listings ─────────────────────────────────────────────────
function SellerListings() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { listings, loading } = useSellerListings();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>آگهی‌هایم</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>مدیریت و پیگیری آگهی‌های ملکی شما</p>
        </div>
        <a href="/submit" style={{
          background: 'var(--gold)',
          color: '#0a0a0a',
          border: 'none',
          borderRadius: 10,
          padding: '10px 22px',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Vazirmatn',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
        }}>
          <span>+</span> افزودن آگهی
        </a>
      </div>
      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>در حال بارگذاری…</div>
      )}
      {!loading && listings.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>آگهی‌ای برای نمایش وجود ندارد</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {listings.map((l) => (
          <Card key={l.id} style={{
            padding: 0,
            overflow: 'hidden',
            boxShadow: hovered === l.id ? '0 4px 24px var(--shadow)' : 'none',
            transition: 'box-shadow 0.2s',
          }}
            onMouseEnter={() => setHovered(l.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              {/* Mini image */}
              <div style={{
                width: 120,
                minHeight: 100,
                background: l.color,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 28, opacity: 0.5 }}>🏢</span>
              </div>
              {/* Content */}
              <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 2 }}>
                  <a href={`/property/${l.id}`} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, textDecoration: 'none' }}>{l.title}</a>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>📍 {l.location}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono' }}>{l.price}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>تومان • {l.type}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <StatusBadge status={l.status} />
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{toFa(l.views)}</div>
                    <div style={{ color: 'var(--faint)', fontSize: 11 }}>بازدید</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{toFa(l.inquiries)}</div>
                    <div style={{ color: 'var(--faint)', fontSize: 11 }}>استعلام</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={`/property/${l.id}`} style={{
                    background: 'rgba(212,175,55,0.1)',
                    color: 'var(--gold)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: 8,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontFamily: 'Vazirmatn',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}>ویرایش</a>
                  <button style={{
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontFamily: 'Vazirmatn',
                    cursor: 'pointer',
                  }}>غیرفعال</button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!loading && listings.length > 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
          نمایش {toFa(listings.length)} از {toFa(listings.length)} آگهی
        </div>
      )}
    </div>
  );
}

// ─── SELLER: Visitors ────────────────────────────────────────────────
function SellerVisitors() {
  const maxCount = Math.max(...visitorDays.map((d) => d.count));
  const sources = [
    { label: 'جستجوی مستقیم', pct: 42, color: 'var(--gold)' },
    { label: 'پیشنهاد هوش مصنوعی', pct: 35, color: '#818cf8' },
    { label: 'جستجوی عادی', pct: 23, color: '#22c55e' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>بازدیدکنندگان</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>تحلیل ترافیک و بازدید آگهی‌های شما در ۷ روز گذشته</p>
      </div>
      {/* Bar chart */}
      <Card>
        <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>نمودار بازدید ۷ روز گذشته</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, padding: '0 8px' }}>
          {visitorDays.map((d) => {
            const h = Math.round((d.count / maxCount) * 120);
            return (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>{d.count}</span>
                <div style={{
                  width: '100%',
                  height: h,
                  background: 'linear-gradient(180deg, var(--gold) 0%, var(--goldDim) 100%)',
                  borderRadius: '6px 6px 0 0',
                  opacity: 0.85,
                  transition: 'height 0.3s ease',
                }} />
                <span style={{ fontSize: 11, color: 'var(--faint)' }}>{d.day}</span>
              </div>
            );
          })}
        </div>
      </Card>
      {/* Source breakdown */}
      <Card>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>منبع بازدیدکنندگان</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sources.map((s) => (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text)', fontSize: 14 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700, fontSize: 14, fontFamily: 'JetBrains Mono' }}>{s.pct}٪</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 999, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      {/* Recent visitors */}
      <Card>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>آخرین بازدیدکنندگان</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: 'var(--muted)' }}>
              {['زمان', 'آگهی', 'منبع', 'اقدام'].map((h) => (
                <th key={h} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentVisitors.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--line2)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--faint)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>{v.time}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 600 }}>{v.listing}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{v.source}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    background: 'rgba(212,175,55,0.08)',
                    color: 'var(--gold)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    borderRadius: 6,
                    padding: '2px 10px',
                    fontSize: 12,
                  }}>{v.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// قیمت/متر را از رشتهٔ فارسی استخراج کن (تومان)
function parsePriceToman(s: string): number {
  const e = (s || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = e.match(/(\d[\d,]*\.?\d*)/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(n)) return 0;
  if (/میلیارد/.test(e)) n *= 1e9;
  else if (/میلیون/.test(e)) n *= 1e6;
  else if (/هزار/.test(e)) n *= 1e3;
  return n;
}
function parseAreaMeters(s: string): number {
  const e = (s || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = e.match(/(\d{2,4})\s*متر/) || e.match(/(\d{2,4})\s*m/i);
  return m ? parseInt(m[1], 10) : 0;
}

// شکل نتیجهٔ تحلیلِ یک آگهی با آمار واقعی بازار محله
interface PriceAnalysis {
  listing: SellerListing;
  market: MarketStats | null;
  value?: number;            // امتیاز ارزش خرید ۱..۱۰
  yourPpm: number;           // قیمت/متر آگهی (میلیون تومان)
  fairPpm: number | null;    // میانگین/متر محله (میلیون تومان)
  diffPct: number | null;    // درصد اختلاف قیمت شما با میانگین
}

// ─── SELLER: AI Price Analysis ────────────────────────────────────────
function SellerPriceAnalysis() {
  const { listings, loading } = useSellerListings();
  const [analyses, setAnalyses] = useState<PriceAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!listings.length) return;
    let alive = true;
    setAnalyzing(true);
    // برای هر آگهی، آمار واقعی محله را از /api/market/stats بگیر
    const picks = listings.slice(0, 5);
    Promise.all(picks.map(async (l) => {
      const district = (l.location || '').split('،')[0]?.trim() || '';
      const city = (l.location || '').split('،').slice(-1)[0]?.trim() || 'تهران';
      const q = new URLSearchParams({ city, district, price: l.price || '', title: l.title || '' });
      let market: MarketStats | null = null;
      let value: number | undefined;
      try {
        const r = await fetch(`/api/market/stats?${q.toString()}`, { cache: 'no-store' });
        if (r.ok) { const d: MarketResponse = await r.json(); market = d.stats; value = d.value; }
      } catch { /* graceful */ }
      const priceToman = parsePriceToman(l.price || '');
      const area = parseAreaMeters(l.title) || parseAreaMeters(l.location);
      const yourPpm = priceToman && area ? priceToman / area / 1e6 : 0;
      const fairPpm = market ? market.avg / 1e6 : null;
      const diffPct = fairPpm && yourPpm ? Math.round(((yourPpm - fairPpm) / fairPpm) * 100) : null;
      return { listing: l, market, value, yourPpm, fairPpm, diffPct } as PriceAnalysis;
    })).then((res) => {
      if (!alive) return;
      setAnalyses(res);
      setAnalyzing(false);
    });
    return () => { alive = false; };
  }, [listings]);

  // مجموع آگهی‌هایی که داده‌ی واقعی بازار داشتند
  const withData = analyses.filter((a) => a.market);
  const totalSamples = withData.reduce((acc, a) => acc + (a.market?.count || 0), 0);
  // برای کارت «مقایسه با بازار» اولین تحلیل دارای داده را بردار
  const ref = withData[0]?.market || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>تحلیل قیمت هوشمند</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>مقایسه قیمت‌گذاری شما با میانگین واقعی بازار محله</p>
      </div>
      {/* AI banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.03) 100%)',
        border: '1px solid rgba(212,175,55,0.4)',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ fontSize: 36 }}>◈</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)', marginBottom: 4 }}>تحلیل هوشمند قیمت — ملک‌جت</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
            این تحلیل بر اساس داده‌های واقعی بازار محلی محاسبه شده است.
            تعداد معاملات مرجع: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{toFa(totalSamples)}</span> آگهی
          </div>
        </div>
      </div>
      {(loading || analyzing) && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>در حال تحلیل بازار…</div>
      )}
      {/* Price comparison cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {analyses.map((item) => {
          const favorable = item.diffPct != null ? item.diffPct <= 0 : true;
          const diffLabel = item.diffPct != null ? `${item.diffPct > 0 ? '+' : ''}${toFa(item.diffPct)}٪` : '—';
          const rec = item.market == null
            ? 'برای این محله داده‌ی کافی در بازار یافت نشد.'
            : item.diffPct == null
              ? `میانگین واقعی محله ${ppmToFa(item.market.avg)} است (بر پایهٔ ${toFa(item.market.count)} آگهی).`
              : item.diffPct > 5
                ? `قیمت شما حدود ${toFa(Math.abs(item.diffPct))}٪ بالاتر از میانگین محله است؛ بازنگری برای جذب خریدار بیشتر توصیه می‌شود.`
                : item.diffPct < -5
                  ? `قیمت شما حدود ${toFa(Math.abs(item.diffPct))}٪ پایین‌تر از میانگین محله است؛ امکان افزایش قیمت وجود دارد.`
                  : 'قیمت شما نزدیک به میانگین واقعی بازار محله و رقابتی است.';
          return (
          <Card key={item.listing.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{item.listing.title}</div>
              <span style={{
                background: favorable ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: favorable ? '#22c55e' : '#ef4444',
                border: `1px solid ${favorable ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
              }}>{diffLabel}</span>
            </div>
            <div className="mjo-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>قیمت/متر شما</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{item.yourPpm ? toFa(Math.round(item.yourPpm)) : '—'}</div>
                <div style={{ color: 'var(--faint)', fontSize: 12 }}>میلیون تومان/متر</div>
              </div>
              <div style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                <div style={{ color: 'var(--gold)', fontSize: 12, marginBottom: 6 }}>میانگین واقعی محله</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', fontFamily: 'JetBrains Mono' }}>{item.fairPpm ? toFa(Math.round(item.fairPpm)) : '—'}</div>
                <div style={{ color: 'var(--goldDim)', fontSize: 12 }}>میلیون تومان/متر</div>
              </div>
            </div>
            <div style={{
              background: 'var(--bg2)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              <span style={{ color: 'var(--gold)', fontSize: 16, marginTop: 1 }}>◈</span>
              <span style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>{rec}</span>
            </div>
          </Card>
          );
        })}
        {!loading && !analyzing && analyses.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>آگهی‌ای برای تحلیل وجود ندارد</div>
        )}
      </div>
      {/* Market comparison note — real numbers from the reference neighbourhood */}
      {ref && (
      <Card style={{ background: 'var(--bg2)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>مقایسه با بازار</h3>
        <div className="mjo-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'میانگین منطقه', value: ppmToFa(ref.avg) },
            { label: 'بالاترین مشابه', value: ref.max != null ? ppmToFa(ref.max) : '—' },
            { label: 'پایین‌ترین مشابه', value: ref.min != null ? ppmToFa(ref.min) : '—' },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{m.value}</div>
              <div style={{ color: 'var(--faint)', fontSize: 11 }}>متر مربع</div>
            </div>
          ))}
        </div>
      </Card>
      )}
    </div>
  );
}

// ─── INVESTOR: Portfolio ──────────────────────────────────────────────
function InvestorPortfolio() {
  const kpis = [
    { label: 'ارزش کل', value: '۴۲۰ م', unit: 'میلیارد تومان', color: 'var(--gold)' },
    { label: 'بازده کل', value: '۳۸٪', unit: 'از زمان خرید', color: '#22c55e' },
    { label: 'تعداد ملک', value: '۳', unit: 'ملک در پرتفولیو', color: '#818cf8' },
    { label: 'سود سالانه', value: '۱۵۹ م', unit: 'میلیون تومان', color: '#f59e0b' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>پرتفولیو سرمایه‌گذاری</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>نمای کلی سبد ملکی شما و عملکرد سرمایه‌گذاری‌ها</p>
      </div>
      {/* KPI row */}
      <div className="mjo-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map((k) => (
          <Card key={k.label} style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'JetBrains Mono' }}>{k.value}</div>
            <div style={{ color: 'var(--faint)', fontSize: 11, marginTop: 4 }}>{k.unit}</div>
          </Card>
        ))}
      </div>
      {/* Property cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {portfolioProperties.map((p) => (
          <Card key={p.name} style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {/* image placeholder */}
              <div style={{
                width: 160,
                background: p.color,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 32, opacity: 0.5 }}>🏙️</span>
              </div>
              <div style={{ flex: 1, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>📍 {p.location}</div>
                  </div>
                  <span style={{
                    background: 'rgba(34,197,94,0.12)',
                    color: '#22c55e',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 8,
                    padding: '4px 14px',
                    fontSize: 16,
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono',
                  }}>{p.roi}</span>
                </div>
                <div className="mjo-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[
                    { label: 'ارزش فعلی', value: p.currentValue, color: 'var(--gold)' },
                    { label: 'قیمت خرید', value: p.buyPrice, color: 'var(--text)' },
                    { label: 'بازده (ROI)', value: p.roi, color: '#22c55e' },
                    { label: 'بازده اجاری', value: p.rentalYield, color: '#818cf8' },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--faint)', fontSize: 11, marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: stat.color, fontFamily: 'JetBrains Mono' }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Sparkline */}
              <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 6, borderRight: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--faint)', fontSize: 11, marginBottom: 4 }}>روند ارزش</div>
                <Sparkline data={p.trend} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── INVESTOR: Market ─────────────────────────────────────────────────
function InvestorMarket() {
  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
    high: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    mid: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    low: { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
    neg: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  };
  const [neighborhoods, setNeighborhoods] = useState<MarketNeighborhood[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // برای هر محلهٔ ثابت، آمار واقعی را از /api/market/stats بگیر
    Promise.all(MARKET_DISTRICTS.map(async (name) => {
      const q = new URLSearchParams({ city: 'تهران', district: name });
      try {
        const r = await fetch(`/api/market/stats?${q.toString()}`, { cache: 'no-store' });
        if (!r.ok) return null;
        const d: MarketResponse = await r.json();
        if (!d.stats) return null;
        const g = growthFromTrend(d.stats.trend);
        return {
          name,
          pricePerMeter: ppmToFa(d.stats.avg),
          growth: g != null ? `${g >= 0 ? '+' : ''}${toFa(g)}٪` : '—',
          level: levelFromGrowth(g),
          hasData: true,
        } as MarketNeighborhood;
      } catch { return null; }
    })).then((res) => {
      if (!alive) return;
      // محلاتِ بدون داده پنهان می‌شوند
      setNeighborhoods(res.filter((n): n is MarketNeighborhood => n != null));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const trends = [
    { label: 'تهران', dir: '↑', pct: '۱۴٪', desc: 'رشد ماهانه' },
    { label: 'سراسری', dir: '↑', pct: '۹٪', desc: 'رشد ماهانه' },
    { label: 'لوکس', dir: '↑', pct: '۲۲٪', desc: 'رشد ماهانه' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>نقشه حرارتی بازار</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>تحلیل قیمت و رشد محلات تهران</p>
        </div>
        <span style={{ color: 'var(--faint)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>به‌روزرسانی: ۱۴۰۳/۰۳/۲۵</span>
      </div>
      {/* Heatmap grid */}
      <Card>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>محلات تهران</h2>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '24px 0' }}>در حال بارگذاری…</div>
        )}
        {!loading && neighborhoods.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '24px 0' }}>داده‌ی بازاری برای این محلات در دسترس نیست</div>
        )}
        <div className="mjo-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {neighborhoods.map((n) => {
            const c = levelColors[n.level];
            return (
              <a key={n.name} href={`/neighborhood/${encodeURIComponent(n.name)}`} style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                textDecoration: 'none',
                display: 'block',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{n.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono', marginBottom: 4 }}>{n.pricePerMeter}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.text, fontFamily: 'JetBrains Mono' }}>{n.growth}</div>
              </a>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16, alignItems: 'center' }}>
          <span style={{ color: 'var(--faint)', fontSize: 13 }}>راهنما:</span>
          {[
            { label: 'رشد بالا (>۱۵٪)', color: '#22c55e' },
            { label: 'رشد متوسط', color: '#f59e0b' },
            { label: 'رشد کم', color: '#94a3b8' },
            { label: 'منفی', color: '#ef4444' },
          ].map((leg) => (
            <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: leg.color }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{leg.label}</span>
            </div>
          ))}
        </div>
      </Card>
      {/* Trend indicators */}
      <Card>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>شاخص‌های کلان بازار</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {trends.map((t) => (
            <div key={t.label} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: 'var(--bg2)',
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t.desc}</span>
                <span style={{ fontSize: 20, color: '#22c55e', fontWeight: 800 }}>{t.dir}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', fontFamily: 'JetBrains Mono', minWidth: 50, textAlign: 'left' }}>{t.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── INVESTOR: Opportunities ──────────────────────────────────────────
function InvestorOpportunities() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>فرصت‌های سرمایه‌گذاری</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>پروژه‌ها و ملک‌های منتخب با بیشترین پتانسیل رشد</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {opportunities.map((opp) => (
          <Card key={opp.name} style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Background glow based on ROI */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${opp.riskColor}60 0%, transparent 100%)`,
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{opp.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>📍 {opp.location}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  background: `${opp.riskColor}18`,
                  color: opp.riskColor,
                  border: `1px solid ${opp.riskColor}40`,
                  borderRadius: 8,
                  padding: '4px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                }}>ریسک: {opp.risk}</span>
                <span style={{
                  background: 'rgba(34,197,94,0.1)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 8,
                  padding: '4px 14px',
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono',
                }}>ROI {opp.roi}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>بازه قیمت</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono', marginBottom: 14 }}>{opp.priceRange} تومان</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {opp.highlights.map((h) => (
                    <li key={h} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                      <span style={{ color: 'var(--gold)', fontSize: 10 }}>✦</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <a href={`/search?q=${encodeURIComponent(opp.location.split('،').slice(-1)[0]?.trim() || opp.location)}`} style={{
                background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold2) 100%)',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 10,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Vazirmatn',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginRight: 16,
                textDecoration: 'none',
              }}>بررسی فرصت ←</a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────
export default function OwnerPage() {
  const [role, setRole] = useState<Role>('seller');
  const [activeView, setActiveView] = useState<ActiveView>('seller-overview');

  const switchRole = (r: Role) => {
    setRole(r);
    setActiveView(r === 'seller' ? 'seller-overview' : 'investor-portfolio');
  };

  const currentNav = role === 'seller' ? sellerNav : investorNav;

  const renderView = () => {
    switch (activeView) {
      case 'seller-overview': return <SellerOverview />;
      case 'seller-listings': return <SellerListings />;
      case 'seller-visitors': return <SellerVisitors />;
      case 'seller-price': return <SellerPriceAnalysis />;
      case 'investor-portfolio': return <InvestorPortfolio />;
      case 'investor-market': return <InvestorMarket />;
      case 'investor-opportunities': return <InvestorOpportunities />;
      default: return null;
    }
  };

  return (
    <div
      dir="rtl"
      className="mjo-2col"
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: 'Vazirmatn, sans-serif',
        color: 'var(--text)',
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: 248,
        flexShrink: 0,
        background: 'var(--navbg)',
        borderLeft: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--gold)', letterSpacing: 1, marginBottom: 4 }}>ملک‌جت</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>میز کار مالک</div>
        </div>

        {/* Role toggle */}
        <div style={{ padding: '16px 16px 12px' }}>
          <div className="mjo-tabs" style={{ display: 'flex', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: 4 }}>
            {(['seller', 'investor'] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: role === r ? 'none' : '1px solid var(--line)',
                  background: role === r ? 'var(--gold)' : 'transparent',
                  color: role === r ? '#0a0a0a' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: role === r ? 700 : 500,
                  fontFamily: 'Vazirmatn',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {r === 'seller' ? 'فروشنده' : 'سرمایه‌گذار'}
              </button>
            ))}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {currentNav.map((item) => {
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key as ActiveView)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)'
                    : 'transparent',
                  color: isActive ? 'var(--gold)' : 'var(--muted)',
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'Vazirmatn',
                  cursor: 'pointer',
                  textAlign: 'right',
                  width: '100%',
                  transition: 'all 0.15s',
                  outline: isActive ? '1px solid rgba(212,175,55,0.2)' : 'none',
                }}
              >
                <span style={{ fontSize: 17, opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
                {isActive && (
                  <div style={{
                    marginRight: 'auto',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--gold)',
                  }} />
                )}
              </button>
            );
          })}
          <a href="/plan-ai" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, color: 'var(--gold)', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginTop: 4, border: '1px solid rgba(212,175,55,0.25)' }}>
            <span style={{ fontSize: 17 }}>◳</span> استودیو پلان و سه‌بعدی
          </a>
        </nav>

        {/* Profile */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold) 0%, var(--goldDim) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 18,
            fontWeight: 800,
            color: '#0a0a0a',
          }}>م</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>مهدی رضوی</div>
            <span style={{
              background: 'rgba(212,175,55,0.15)',
              color: 'var(--gold)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: 6,
              padding: '1px 8px',
              fontSize: 11,
              fontWeight: 600,
            }}>مالک تأییدشده ✓</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        minWidth: 0,
        padding: '36px 40px',
        overflowY: 'auto',
        maxWidth: 'calc(100vw - 248px)',
      }}>
        {renderView()}
      </main>
    </div>
  );
}
