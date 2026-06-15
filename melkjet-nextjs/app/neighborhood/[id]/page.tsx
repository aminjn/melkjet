'use client';

import Nav from '@/app/components/Nav';
import Footer from '@/app/components/Footer';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function NeighborhoodPage() {
  const params = useParams();
  const id = (params?.id as string) || 'saadatabad';
  void id;
  const neighborhoodName = 'سعادت‌آباد';

  const months = ['فرو', 'ارد', 'خرد', 'تیر', 'مرد', 'شهر', 'مهر', 'آبا', 'آذر', 'دی', 'بهم', 'اسف'];
  const barHeights = [80, 85, 82, 88, 90, 92, 95, 98, 100, 105, 110, 115];
  const maxBar = 115;
  const maxHeight = 150;
  const barWidth = 34;
  const barGap = 12;
  const svgPaddingLeft = 52;
  const baselineY = 175;

  const listings = [
    { title: 'آپارتمان ۱۴۰ متری', price: '۱۷.۸ م.د', location: 'سعادت‌آباد شمالی', grad: 'linear-gradient(135deg, #2a1a0a 0%, #7c5a1e 100%)' },
    { title: 'آپارتمان ۹۵ متری', price: '۱۱.۲ م.د', location: 'بلوار اصلی', grad: 'linear-gradient(135deg, #0a1a2a 0%, #1e4a7c 100%)' },
    { title: 'پنت‌هاوس ۲۲۰ متری', price: '۳۲.۵ م.د', location: 'برج آزادی', grad: 'linear-gradient(135deg, #1a0a2a 0%, #5a1e7c 100%)' },
  ];

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '-32px', marginBottom: '2.25rem', position: 'relative', zIndex: 10 }}>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>قیمت میانگین</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>۱۲۷ م/متر</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: '6px', padding: '2px 7px' }}>+۸٪</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>نسبت به سال گذشته</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>ودیعه میانگین</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>۹۰۰ م</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>برای واحد ۱۰۰ متری</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem 1.25rem 1rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>آگهی‌های فعال</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>۲٬۴۰۰</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: '0.3rem' }}>به‌روزشده امروز</div>
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

        {/* Main 2-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start', paddingBottom: '3.5rem' }}>

          {/* LEFT CONTENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Section 1 – 12-month price trend SVG bar chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem 0' }}>روند قیمت ۱۲ ماه گذشته</h2>

              <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="نمودار روند قیمت ۱۲ ماه گذشته">
                <text x="46" y="32" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">۱۴۰م</text>
                <text x="46" y="100" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">۱۲۰م</text>
                <text x="46" y="168" textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="inherit">۱۰۰م</text>
                <line x1="50" y1="28" x2="596" y2="28" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                <line x1="50" y1="96" x2="596" y2="96" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                <line x1="50" y1="164" x2="596" y2="164" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4,3" />
                {barHeights.map((h, i) => {
                  const scaledH = (h / maxBar) * maxHeight;
                  const x = svgPaddingLeft + i * (barWidth + barGap);
                  const y = baselineY - scaledH;
                  const isGold = i >= 9;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={barWidth} height={scaledH} rx="4" ry="4" fill={isGold ? 'var(--gold)' : 'var(--line2, #3a3028)'} opacity={isGold ? 1 : 0.5} />
                      <text x={x + barWidth / 2} y={baselineY + 18} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">{months[i]}</text>
                    </g>
                  );
                })}
                <line x1="50" y1={baselineY + 1} x2="596" y2={baselineY + 1} stroke="var(--line)" strokeWidth="1" />
              </svg>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {listings.map((listing, i) => (
                  <Link key={i} href="/search" style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={{ border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(212,175,55,0.15)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ height: '100px', background: listing.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.6rem', opacity: 0.35 }}>🏢</span>
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gold)', marginBottom: '0.25rem' }}>{listing.price}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.25rem' }}>{listing.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>📍 {listing.location}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
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
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 1rem 0' }}>۲۴ مشاور تأییدشده در این منطقه</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {advisors.map((advisor, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--line)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, hsl(${advisor.hue},55%,32%) 0%, hsl(${advisor.hue + 20},65%,50%) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {advisor.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{advisor.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>★</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gold)' }}>{advisor.rating}</span>
                    </div>
                  </div>
                ))}
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
