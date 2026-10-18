/**
 * ایکونِ خطیِ SVG در قابِ شیشه‌ای — جایگزینِ اموجی در کلِ رابط.
 *
 * چرا کامپوننت و نه SVGِ درجا: فاز ۲۹۸ی۱۲ الگو را ساخت ولی مسیرها را مستقیم داخلِ
 * HomeClient نوشت، پس کارت‌های پایینِ همان صفحه اموجی ماندند و هر مصرف‌کنندهٔ تازه
 * باید کپی می‌کرد. همان الگوی «نسخهٔ موازیِ فقیر» که CLAUDE.md دو بار ثبتش کرده.
 * یک رجیستری، یک قاب: ایکونِ تازه یک‌جا اضافه می‌شود و همه‌جا می‌آید.
 *
 * دو حالتِ رنگ، چون پشتِ قاب دو چیزِ متفاوت است:
 *   tone="hero"  → روی هیرویِ تیره (کرم/طلاییِ روشن، مستقل از تم)
 *   tone="theme" → روی سطحِ تم (از توکن‌ها، پس در دارک و لایت درست است)
 * با tint، هویتِ رنگیِ هر کارت حفظ می‌شود و شیشه رویش می‌نشیند.
 */
import type { ReactNode } from 'react'

export type IconName =
  | 'home' | 'key' | 'people' | 'crane' | 'bricks' | 'store' | 'bars' | 'spark'
  | 'ruler' | 'briefcase' | 'article' | 'trend' | 'dashboard' | 'office' | 'search' | 'plus'
  | 'brain' | 'link' | 'chartDown' | 'tools' | 'pin'
  | 'layers' | 'clipboard' | 'scale' | 'bank' | 'doc' | 'crown' | 'star' | 'sun' | 'moon'
  | 'heart' | 'eye' | 'bolt' | 'clock' | 'compare' | 'check' | 'arrowLeft' | 'arrowUp'
  | 'fire' | 'trophy' | 'flag'
  | 'map' | 'bell' | 'close' | 'arrowUpRight' | 'cabinet' | 'faucet' | 'snow'
  | 'chevronDown' | 'phone' | 'mail' | 'medal' | 'chat'

// مسیرها همه ۲۴×۲۴، فقط stroke — بدونِ fill و بدونِ رنگِ سخت، تا رنگ از قاب بیاید.
const ICONS: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>,
  key: <><circle cx="8" cy="15" r="3.4" /><path d="M10.6 12.6 20 3.4" /><path d="M16.6 6.8l2.2 2.2" /><path d="M14.2 9.2l2.2 2.2" /></>,
  people: <><circle cx="9" cy="7.5" r="3" /><path d="M3.5 20c0-3 2.5-5.3 5.5-5.3S14.5 17 14.5 20" /><path d="M16 4.7a2.8 2.8 0 0 1 0 5.6" /><path d="M17.2 14.9c2 .4 3.3 2.1 3.3 4.6" /></>,
  crane: <><path d="M4 21V6l9-2.6V21" /><path d="M13 9.5l7 2V21" /><path d="M3 21h18" /><path d="M7 9h2.5M7 13h2.5M7 17h2.5M16 13.5h1.6M16 17h1.6" /></>,
  bricks: <><rect x="3" y="4.5" width="18" height="4.5" rx="1" /><rect x="3" y="9.5" width="7" height="4.5" rx="1" /><rect x="11" y="9.5" width="10" height="4.5" rx="1" /><rect x="3" y="14.5" width="11" height="4.5" rx="1" /><rect x="15" y="14.5" width="6" height="4.5" rx="1" /></>,
  store: <><path d="M3 9.5 4.6 4.5h14.8L21 9.5" /><path d="M4.5 9.5V20h15V9.5" /><path d="M3 9.5h18" /><path d="M9 20v-5.5h6V20" /></>,
  bars: <><path d="M4 20V13" /><path d="M9.3 20V8.5" /><path d="M14.6 20v-5.5" /><path d="M20 20V5" /></>,
  spark: <><path d="M12 3.2l1.9 4.5 4.6 1.9-4.6 1.9L12 16l-1.9-4.5L5.5 9.6l4.6-1.9z" /><path d="M18.5 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" /></>,
  ruler: <><path d="M3.5 14.5 14.5 3.5l6 6L9.5 20.5z" /><path d="M7 11l2 2M10 8l2 2M13 5l2 2" /></>,
  briefcase: <><rect x="3" y="7.5" width="18" height="12.5" rx="2.2" /><path d="M9 7.5V5.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6v1.9" /><path d="M3 13h18" /></>,
  article: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.2" /><path d="M7 9h6M7 12.5h10M7 16h7" /></>,
  trend: <><path d="M3.5 17.5 9 11l3.6 3.4L20.5 6" /><path d="M15.6 6h4.9v4.9" /></>,
  dashboard: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="3.5" width="7.5" height="4.6" rx="1.8" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="10" width="7.5" height="10.5" rx="1.8" /></>,
  office: <><rect x="4.5" y="3.5" width="15" height="17" rx="2" /><path d="M8.5 7.5h2M13.5 7.5h2M8.5 11.5h2M13.5 11.5h2M8.5 15.5h2M13.5 15.5h2" /><path d="M3 20.5h18" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 20.5 20.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  brain: <><path d="M9.5 4.5a3 3 0 0 0-3 3 2.6 2.6 0 0 0-1.3 4.7A2.8 2.8 0 0 0 6.6 17c.3 1.4 1.5 2.5 2.9 2.5h.5V4.5z" /><path d="M14.5 4.5a3 3 0 0 1 3 3 2.6 2.6 0 0 1 1.3 4.7A2.8 2.8 0 0 1 17.4 17c-.3 1.4-1.5 2.5-2.9 2.5H14V4.5z" /><path d="M12 4.5v15" /></>,
  link: <><path d="M10.3 13.7a4 4 0 0 1 0-5.6l2.1-2.1a4 4 0 0 1 5.6 5.6l-1 1" /><path d="M13.7 10.3a4 4 0 0 1 0 5.6l-2.1 2.1a4 4 0 0 1-5.6-5.6l1-1" /></>,
  chartDown: <><path d="M3.5 6.5 9 13l3.6-3.4 7.9 8.4" /><path d="M20.5 18.4h-4.9v-4.9" /><path d="M3.5 20.5h17" /></>,
  tools: <><path d="M14.2 6.3a3.4 3.4 0 0 1 4.6 4.6l-8.4 8.4-4.6-4.6z" /><path d="M5.8 14.7 4 20.5l5.8-1.8" /><path d="M12.4 8.1l3.5 3.5" /></>,
  pin: <><path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>,
  layers: <><path d="M12 3.5 21 8l-9 4.5L3 8z" /><path d="M3.5 12.2 12 16.5l8.5-4.3" /><path d="M3.5 16.2 12 20.5l8.5-4.3" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16" rx="2.2" /><path d="M9 4.5V3.6c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1v.9" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>,
  scale: <><path d="M12 4v16M7 20h10" /><path d="M4.5 8h15" /><path d="M7.2 8 4.5 13.5h5.4z" /><path d="M16.8 8l-2.7 5.5h5.4z" /></>,
  bank: <><path d="M3.5 9.5 12 4.5l8.5 5" /><path d="M5.5 9.5V17M10 9.5V17M14 9.5V17M18.5 9.5V17" /><path d="M3 20h18" /></>,
  doc: <><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19" /><path d="M8.5 13h7M8.5 16.5h5" /></>,
  crown: <><path d="M4 17.5 3 7l5 3.5L12 4l4 6.5L21 7l-1 10.5z" /><path d="M4 20.5h16" /></>,
  star: <><path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  moon: <><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" /></>,
  // ۸ اکتبر — جایگزینِ اموجی‌های روی کارتِ آگهی (قلب، چشم، صاعقه، ساعت، مقایسه، تیک، فلش)
  // و نشان‌های پروموت (آتش، جام، پرچم، نردبان). قلب با fill="currentColor" توپُر هم می‌شود.
  heart: <><path d="M12 20.4s-7.6-4.7-7.6-10A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 7.6 3.1c0 5.3-7.6 10-7.6 10z" /></>,
  eye: <><path d="M2.5 12S6.2 5.8 12 5.8 21.5 12 21.5 12 17.8 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  bolt: <><path d="M13.6 2.5 5.2 13.7h5.1L9.6 21.5 18.8 10h-5.5z" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2V12l3.3 2" /></>,
  compare: <><path d="M4 9h13" /><path d="M14 6 17 9l-3 3" /><path d="M20 15H7" /><path d="M10 12 7 15l3 3" /></>,
  check: <><path d="M4.8 12.7l4.5 4.5L19.4 7" /></>,
  arrowLeft: <><path d="M19.5 12H4.6" /><path d="M10.4 5.6 4 12l6.4 6.4" /></>,
  arrowUp: <><path d="M12 19.6V4.7" /><path d="M5.6 11.1 12 4.7l6.4 6.4" /></>,
  fire: <><path d="M12 21.5c3.6 0 6-2.3 6-5.5 0-4.2-4.3-5.8-3.3-11.5-2.6 1-4.2 3.3-4.2 5.6 0 1.3.5 2.2.5 3 0 1-.8 1.7-1.6 1.7-1 0-1.6-.8-1.7-2-1 1.1-1.7 2.6-1.7 4.2 0 3.2 2.4 5.5 6 5.5z" /></>,
  trophy: <><path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z" /><path d="M7.5 5.5H5a2 2 0 0 0 2.6 2.4M16.5 5.5H19a2 2 0 0 1-2.6 2.4" /><path d="M12 13v3.5M8.5 20.5h7M9.8 20.5c0-2 .9-4 2.2-4s2.2 2 2.2 4" /></>,
  flag: <><path d="M6 3.5v17" /><path d="M6 4.6h11.5l-2.1 3.9 2.1 3.9H6z" /></>,
  map: <><path d="M9 3.6 3.5 5.5v15L9 18.6l6 1.9 5.5-1.9v-15L15 5.5z" /><path d="M9 3.6v15M15 5.5v15" /></>,
  bell: <><path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6.3-2 6.3h16s-2-1.3-2-6.3z" /><path d="M10.2 19.5a2 2 0 0 0 3.6 0" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  arrowUpRight: <><path d="M6.8 17.2 17.2 6.8" /><path d="M8.6 6.8h8.6v8.6" /></>,
  cabinet: <><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M12 3.5v17M4 12h16" /><path d="M10.3 7.2v2.4M13.7 7.2v2.4M10.3 14.4v2.4M13.7 14.4v2.4" /></>,
  faucet: <><path d="M6.5 20.5h7.5" /><path d="M10 20.5V11.4h5.6v3.6" /><path d="M7.6 11.4h4.8" /><path d="M10 11.4V8.8" /><path d="M8.1 8.8h3.8" /><path d="M15.6 17.6v1.4" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><path d="M9.3 5.1 12 7l2.7-1.9M9.3 18.9 12 17l2.7 1.9" /></>,
  chevronDown: <><path d="M5.5 9 12 15.4 18.5 9" /></>,
  phone: <><path d="M8.2 3.6 10.6 8l-2 1.9a12 12 0 0 0 5.5 5.5l1.9-2 4.4 2.4-.6 3a1.6 1.6 0 0 1-1.8 1.3C12 19.3 4.7 12 3.5 5a1.6 1.6 0 0 1 1.3-1.8z" /></>,
  mail: <><rect x="3" y="5.2" width="18" height="13.6" rx="2.2" /><path d="M3.6 6.6 12 12.8l8.4-6.2" /></>,
  medal: <><circle cx="12" cy="14.6" r="5.4" /><path d="M12 11.8l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" /><path d="M8.4 9.4 6.2 3.5h11.6l-2.2 5.9" /></>,
  chat: <><path d="M20.5 11.6c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.6-.35L4.8 20.5l1.1-3.4a6.9 6.9 0 0 1-2.4-5.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2z" /></>,
}

export default function GlassIcon({
  name, size = 46, box, tone = 'theme', tint,
}: {
  name: IconName
  size?: number          // قطرِ قاب
  box?: number           // اندازهٔ خودِ ایکون (پیش‌فرض ≈ ۵۲٪ قاب)
  tone?: 'theme' | 'hero'
  tint?: string          // رنگِ اختصاصیِ کارت — شیشه رویش می‌نشیند
}) {
  const hero = tone === 'hero'
  const stroke = tint || (hero ? 'var(--hero-ic-stroke)' : 'var(--gold)')
  const bg = tint ? `${tint}1f` : hero ? 'var(--hero-ic-bg)' : 'var(--goldDim)'
  const border = tint ? `${tint}55` : hero ? 'var(--hero-ic-brd)' : 'var(--line2)'
  const ic = Math.round(box || size * 0.52)
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: size >= 40 ? 13 : '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, border: `1px solid ${border}`,
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14)',
    }}>
      <svg width={ic} height={ic} viewBox="0 0 24 24" fill="none" stroke={stroke}
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
    </span>
  )
}

/** فقط خودِ ایکون، بدونِ قابِ شیشه‌ای — برای ظرفی که خودش حاشیه/قرص دارد. */
export function IconSvg({ name, size = 15, color = 'currentColor', fill = 'none', weight = 1.8 }: { name: IconName; size?: number; color?: string; fill?: string; weight?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ICONS[name]}</svg>
  )
}
