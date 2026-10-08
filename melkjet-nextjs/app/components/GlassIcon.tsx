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
  const stroke = tint || (hero ? '#F5D982' : 'var(--gold)')
  const bg = tint ? `${tint}1f` : hero ? 'rgba(255,255,255,.08)' : 'var(--goldDim)'
  const border = tint ? `${tint}55` : hero ? 'rgba(247,222,146,.4)' : 'var(--line2)'
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
export function IconSvg({ name, size = 15, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ICONS[name]}</svg>
  )
}
