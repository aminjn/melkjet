'use client';

import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchContent, gradientFor, type ContentItem } from '@/app/lib/content-display';
import { listingHref } from '@/app/lib/listing-url';
import PromoBadge from '@/app/components/PromoBadge';

// ── helpers ────────────────────────────────────────────────────────────────
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);
}
// قیمت هر متر (تومان) را به «N م/متر» (میلیون تومان بر متر) فارسی تبدیل کن
function ppmToFa(ppm: number): string {
  return `${toFa(Math.round(ppm / 1e6))} م/متر`;
}

interface TrendPoint { month: string; avg: number }
interface MarketStats { avg: number; count: number; median?: number; min?: number; max?: number; trend: TrendPoint[] }

// ماه شمسیِ کوتاه از کلید «YYYY-M» میلادی (تقریبی برای برچسب نمودار)
const MONTH_LABELS = ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'];
function monthLabel(key: string, idx: number): string {
  const m = parseInt((key.split('-')[1] || ''), 10);
  if (m >= 1 && m <= 12) return MONTH_LABELS[m - 1];
  return MONTH_LABELS[idx % 12];
}

export default function NeighborhoodPage() {
  const params = useParams();
  const rawId = (params?.id as string) || 'saadatabad';
  // route id is the neighbourhood/city name (e.g. "tehran" or a Persian name)
  let decoded = rawId;
  try { decoded = decodeURIComponent(rawId); } catch { /* keep raw */ }
  const neighborhoodName = decoded;

  const [stats, setStats] = useState<MarketStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [listingItems, setListingItems] = useState<ContentItem[]>([]);
  const [promotedListings, setPromotedListings] = useState<ContentItem[]>([]);
  const [advisorItems, setAdvisorItems] = useState<ContentItem[]>([]);
  const [areaAdvisors, setAreaAdvisors] = useState<{ phone: string; name: string; title: string; photo: string; agency: string }[]>([]);
  const [areaProfiles, setAreaProfiles] = useState<{ id: string; title: string; category?: string; location?: string; image?: string; excerpt?: string; url: string; promoKind?: string }[]>([]);
  const [areaListings, setAreaListings] = useState<{ id: string; title: string; price?: string; location?: string; image?: string; url?: string; category?: string; type?: string; promoKind?: string }[]>([]);

  useEffect(() => {
    let alive = true;
    // Treat the route id as both district and city; the API matches whichever fits.
    const q = `city=${encodeURIComponent(decoded)}&district=${encodeURIComponent(decoded)}`;
    fetch(`/api/market/stats?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { stats: null }))
      .then((d) => { if (alive) { setStats(d?.stats || null); setStatsLoaded(true); } })
      .catch(() => { if (alive) setStatsLoaded(true); });

    fetchContent('listing', undefined, 12).then((items) => {
      if (!alive) return;
      const name = decoded;
      const matched = items.filter((it) => {
        const hay = `${it.location || ''} ${it.title || ''}`;
        return name && hay.includes(name);
      });
      setListingItems((matched.length ? matched : items).slice(0, 3));
    });

    fetchContent('directory', undefined, 6).then((items) => {
      if (alive) setAdvisorItems(items.slice(0, 3));
    });

    // مشاوران واقعیِ ثبت‌شده که این محله در «مناطق فعالیت»‌شان است
    fetch(`/api/advisors/by-area?area=${encodeURIComponent(decoded)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { advisors: [] }))
      .then((d) => { if (alive) setAreaAdvisors(d.advisors || []); })
      .catch(() => {});

    fetch('/api/promotions?slot=neighborhood_featured', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setPromotedListings((d.items || []) as ContentItem[]); })
      .catch(() => {});

    // پروموت‌های محله‌محور — متخصصان و آگهی‌های ویژهٔ این محله
    fetch(`/api/promotions/area?name=${encodeURIComponent(neighborhoodName)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { profiles: [], listings: [] }))
      .then((d) => { if (alive) { setAreaProfiles(d.profiles || []); setAreaListings(d.listings || []); } })
      .catch(() => {});

    return () => { alive = false; };
  }, [decoded]);

  // Promoted listings lead the featured strip (dedup by id).
  const promotedListingIds = new Set(promotedListings.map((p) => p.id));
  const shownListings = [
    ...promotedListings,
    ...listingItems.filter((l) => !promotedListingIds.has(l.id)),
  ].slice(0, 3);

  // ── derived chart data from real trend (fallback to flat baseline) ──────────
  const trend = stats?.trend && stats.trend.length ? stats.trend.slice(-12) : [];
  const months = trend.length
    ? trend.map((t, i) => monthLabel(t.month, i))
    : ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'];
  const trendAvgs = trend.map((t) => t.avg);
  const barHeights = trendAvgs.length ? trendAvgs : [80, 85, 82, 88, 90, 92, 95, 98, 100, 105, 110, 115];
  const maxBar = Math.max(...barHeights, 1);
  const maxHeight = 150;
  const barCount = barHeights.length || 12;
  const barGap = 12;
  const svgPaddingLeft = 52;
  const barWidth = Math.max(8, (596 - svgPaddingLeft - barGap * (barCount - 1) - 4) / barCount);
  const baselineY = 175;

  // average price KPI + year-over-year growth from real trend
  const avgLabel = stats ? ppmToFa(stats.avg) : '—';
  let growthPct: number | null = null;
  if (trendAvgs.length >= 2) {
    const first = trendAvgs[0];
    const last = trendAvgs[trendAvgs.length - 1];
    if (first > 0) growthPct = Math.round(((last - first) / first) * 100);
  }

  const amenities = [
    { icon: '🏫', label: 'مدارس', value: '۱۲ مدرسه' },
    { icon: '🌳', label: 'پارک‌ها', value: '۸ پارک' },
    { icon: '🚇', label: 'مترو', value: '۳ ایستگاه' },
    { icon: '🏥', label: 'بیمارستان', value: '۴ مرکز درمانی' },
    { icon: '🏬', label: 'مراکز خرید', value: '۶ مجتمع' },
    { icon: '🍽️', label: 'رستوران', value: '۸۵+ مکان' },
    { icon: '🏦', label: 'بانک', value: '۲۲ شعبه' },
    { icon: '⚽', label: 'ورزشگاه', value: '۳ مجموعه' },
  ];

  const nearbyNeighborhoods = [
    { name: 'زعفرانیه', href: '/neighborhood/zafaranieh', price: '۳۲۷ م/متر' },
    { name: 'ونک', href: '/neighborhood/vanak', price: '۹۷ م/متر' },
    { name: 'فرمانیه', href: '/neighborhood/farmaniyeh', price: '۱۸۵ م/متر' },
    { name: 'شهرک غرب', href: '/neighborhood/shahrak', price: '۱۱۲ م/متر' },
  ];

  const advisors = [
    { name: 'علی رضایی', rating: '۴.۹', hue: 30 },
    { name: 'سارا احمدی', rating: '۴.۸', hue: 200 },
    { name: 'محمد کریمی', rating: '۴.۷', hue: 120 },
  ];

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Nav />

      {/* Hero Banner */}
      <div style={{ height: '200px', background: 'linear-gradient(135deg, #1a0e04 0%, #2d1a06 35%, #4a2e0a 65%, #6b4510 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(184,134,11,0.18) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: '0.78rem', color: 'rgba(212,175,55,0.7)', marginBottom: '0.75rem', position: 'relative', zIndex: 1 }}>
          <Link href="/" style={{ color: 'rgba(212,175,55,0.7)', textDecoration: 'none' }}>خانه</Link>
          <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>／</span>
          <Link href="/search" style={{ color: 'rgba(212,175,55,0.7)', textDecoration: 'none' }}>محله‌ها</Link>
          <span style={{ margin: '0 0.4rem', opacity: 0.5 }}>／</span>
          <span style={{ color: 'var(--gold)' }}>{neighborhoodName}</span>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0', position: 'relative', zIndex: 1, textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>
          خرید و فروش ملک در {neighborhoodName}
        </h1>

        <p style={{ fontSize: '0.9rem', color: 'rgba(212,175,55,0.85)', margin: 0, position: 'relative', zIndex: 1, letterSpacing: '0.02em' }}>
          ۲٬۴۰۰ ملک فعال · تحلیل بازار به‌روز · راهنمای خرید هوشمند
        </p>
      </div>

      {/* Page body */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* KPI Cards */}
        <div className="mjn-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '-32px', marginBottom: '2.25rem', position: 'relative', zIndex: 10 }}>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>قیمت میانگین</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>{avgLabel}</span>
              {growthPct !== null && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: growthPct >= 0 ? '#22c55e' : '#e74c3c', background: growthPct >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(231,76,60,0.12)', border: `1px solid ${growthPct >= 0 ? 'rgba(34,197,94,0.28)' : 'rgba(231,76,60,0.28)'}`, borderRadius: '6px', padding: '2px 7px' }}>{growthPct >= 0 ? '+' : ''}{toFa(growthPct)}٪</span>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>{stats ? 'بر اساس آگهی‌های واقعی' : statsLoaded ? 'داده کافی موجود نیست' : 'در حال بارگذاری…'}</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>ودیعه میانگین</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>۹۰۰ م</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>برای واحد ۱۰۰ متری</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>آگهی‌های فعال</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>{stats ? toFa(stats.count) : '—'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>آگهی فروش این منطقه</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>امتیاز محله</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>۹.۲</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>/ ۱۰</span>
              <span style={{ fontSize: '1.15rem', color: 'var(--gold)' }}>★</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>بر اساس نظرات ساکنین</div>
          </div>
        </div>

        {/* ⭐ متخصصانِ ویژهٔ این محله (پروموتِ محله‌محور) */}
        {areaProfiles.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⭐</span> متخصصانِ ویژهٔ این محله
            </h2>
            <div className="mjn-listings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
              {areaProfiles.map((p) => (
                <Link key={p.id} href={p.url} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', height: '100%' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(212,175,55,0.15)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ height: '96px', background: p.image ? `url(${p.image}) center/cover` : gradientFor(p.id), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '6px', left: '6px' }}><PromoBadge kind={p.promoKind || 'ویژه'} size="sm" /></span>
                      {!p.image && <span style={{ fontSize: '1.6rem', opacity: 0.35 }}>👤</span>}
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      {(p.category || p.location) && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[p.category, p.location].filter(Boolean).join(' · ')}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 🚀 آگهی‌های ویژهٔ این محله (پروموتِ محله‌محور) */}
        {areaListings.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gold)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚀</span> آگهی‌های ویژهٔ این محله
            </h2>
            <div className="mjn-listings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
              {areaListings.map((l) => (
                <Link key={l.id} href={l.url || listingHref(l.id, l.title, l.location)} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', height: '100%' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(212,175,55,0.15)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ height: '96px', background: l.image ? `url(${l.image}) center/cover` : gradientFor(l.id), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '6px', left: '6px' }}><PromoBadge kind={l.promoKind || 'ویژه'} size="sm" /></span>
                      {!l.image && <span style={{ fontSize: '1.6rem', opacity: 0.35 }}>🏢</span>}
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      {l.price && <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.25rem' }}>{l.price}</div>}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                      {l.location && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {l.location}</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="mjn-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start', paddingBottom: '3.5rem' }}>

          {/* LEFT CONTENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Section 1 – 12-month price trend SVG bar chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem 0' }}>روند قیمت {toFa(barCount)} ماه گذشته</h2>

              {statsLoaded && !trendAvgs.length ? (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  داده کافی برای نمایش روند قیمت این محله موجود نیست.
                </div>
              ) : (
              <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="نمودار روند قیمت">
                <text x="46" y="32" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">{ppmToFa(maxBar)}</text>
                <text x="46" y="100" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">{ppmToFa(maxBar / 2)}</text>
                <text x="46" y="168" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">۰</text>
                <line x1="50" y1="28" x2="596" y2="28" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                <line x1="50" y1="96" x2="596" y2="96" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                <line x1="50" y1="164" x2="596" y2="164" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                {barHeights.map((h, i) => {
                  const scaledH = (h / maxBar) * maxHeight;
                  const x = svgPaddingLeft + i * (barWidth + barGap);
                  const y = baselineY - scaledH;
                  const isGold = i >= barCount - 3;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={barWidth} height={scaledH} rx="4" ry="4" fill={isGold ? 'var(--gold)' : 'var(--line2, #3a3028)'} opacity={isGold ? 1 : 0.5} />
                      <text x={x + barWidth / 2} y={baselineY + 18} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">{months[i]}</text>
                    </g>
                  );
                })}
                <line x1="50" y1={baselineY + 1} x2="596" y2={baselineY + 1} stroke="var(--line)" strokeWidth="1" />
              </svg>
              )}
            </div>

            {/* Section 2 – AI Insight */}
            <div style={{ background: 'var(--goldDim, rgba(212,175,55,0.06))', border: '1px solid var(--gold)', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.1rem' }}>
                <span style={{ fontSize: '1.5rem', color: 'var(--gold)', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>✦</span>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem 0' }}>تحلیل هوش مصنوعی</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text)', margin: 0, lineHeight: 1.75 }}>
                    ۷۴٪ احتمال افزایش قیمت در ۶ ماه آینده بر اساس تحلیل ۱۲۰٬۰۰۰ تراکنش تاریخی، روند بازار و شاخص‌های اقتصادی
                  </p>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                  <span>سطح اطمینان</span>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>۷۴٪</span>
                </div>
                <div style={{ height: '8px', background: 'var(--line)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{ width: '74%', height: '100%', background: 'linear-gradient(90deg, var(--gold2, #b8860b) 0%, var(--gold) 100%)', borderRadius: '100px' }} />
                </div>
              </div>
            </div>

            {/* Section 3 – Mini listings grid */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>آگهی‌های برگزیده</h2>
                <Link href="/search" style={{ fontSize: '0.8rem', color: 'var(--gold)', textDecoration: 'none' }}>مشاهده همه ←</Link>
              </div>
              {shownListings.length === 0 ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  آگهی‌ای برای نمایش یافت نشد.
                </div>
              ) : (
              <div className="mjn-listings" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {shownListings.map((listing) => (
                  <Link key={listing.id} href={listingHref(listing.id, listing.title, listing.location)} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(212,175,55,0.15)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ height: '100px', background: listing.image ? `url(${listing.image}) center/cover` : gradientFor(listing.id), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {promotedListingIds.has(listing.id) && <span style={{ position: 'absolute', top: '6px', left: '6px' }}><PromoBadge kind={(listing as any).promoKind || 'ویژه'} size="sm" /></span>}
                        {!listing.image && <span style={{ fontSize: '1.6rem', opacity: 0.35 }}>🏢</span>}
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        {listing.price && <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.25rem' }}>{listing.price}</div>}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</div>
                        {listing.location && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {listing.location}</div>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              )}
            </div>

            {/* Section 4 – Amenities grid */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem 0' }}>امکانات محله</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                {amenities.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.75rem 0.65rem' }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.1rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Card 1 – CTA */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🏠</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem 0', lineHeight: 1.55 }}>
                ملک خود را در {neighborhoodName} ثبت کنید
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1.25rem 0', lineHeight: 1.6 }}>
                به هزاران خریدار جدی دسترسی داشته باشید
              </p>
              <Link
                href="/submit"
                style={{ display: 'block', background: 'linear-gradient(135deg, var(--gold2, #b8860b) 0%, var(--gold) 100%)', color: '#1a0e04', textDecoration: 'none', borderRadius: '8px', padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.85rem' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.88')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}
              >
                ثبت رایگان آگهی ←
              </Link>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                بیش از ۸۰٬۰۰۰ خریدار فعال در انتظار
              </div>
            </div>

            {/* Card 2 – Nearby neighborhoods */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1rem 0' }}>محله‌های اطراف</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {nearbyNeighborhoods.map((n, i) => (
                  <Link
                    key={i}
                    href={n.href}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg2)', transition: 'border-color 0.2s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--gold)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--line)')}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>{n.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600 }}>{n.price}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>←</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Card 3 – Active advisors */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.3rem 0' }}>
                مشاوران فعال در {neighborhoodName}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>{areaAdvisors.length ? `${toFa(areaAdvisors.length)} مشاورِ فعال در این محله` : advisorItems.length ? `${toFa(advisorItems.length)} مشاور تأییدشده` : 'مشاوران تأییدشده ملک‌جت'}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {/* مشاوران واقعیِ ثبت‌شده در این محله */}
                {areaAdvisors.map((adv) => (
                  <Link key={adv.phone} href={`/profile/${adv.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--line)', textDecoration: 'none' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: gradientFor(adv.phone, 'avatar'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {adv.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={adv.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (adv.name?.trim()?.[0] || '؟')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adv.title}{adv.agency ? ` · ${adv.agency}` : ''}</div>
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: '0.85rem', flexShrink: 0 }}>←</span>
                  </Link>
                ))}
                {areaAdvisors.length === 0 && (advisorItems.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '0.5rem 0' }}>مشاوری یافت نشد.</div>
                ) : advisorItems.map((advisor) => (
                  <div key={advisor.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: gradientFor(advisor.id, 'avatar'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {advisor.title?.trim()?.[0] || '؟'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{advisor.title}</div>
                    </div>
                    {advisor.rating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                        <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>★</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold)' }}>{advisor.rating}</span>
                      </div>
                    )}
                  </div>
                )))}
              </div>

              <Link
                href="/directory"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: '0.82rem', fontWeight: 600, transition: 'background 0.2s' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--goldDim, rgba(212,175,55,0.08))')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
              >
                مشاهده همه مشاوران ←
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
