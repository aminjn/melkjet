// 🎨 فاز ۱۰۹ — Visual Bible Pass 2 (با تأییدِ امین): توابعِ خالصِ لایهٔ بصریِ شهرِ زنده.
// همه‌چیز از دادهٔ واقعی: فازِ آسمان از ساعتِ واقعیِ محلی، جلوهٔ هوا از هوای واقعیِ Open-Meteo
// (فاز ۱۰۴ — نبود = هیچ)، شلوغیِ خیابان از شمارِ دارایی‌های واقعیِ بازیکن. هیچ عددِ ساختگی.
// نما (facade) طبق قانونِ ۱۳ (رویاپردازی) صرفاً هویتی است — صفر اثرِ اقتصادی.

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

// فازِ آسمان از ساعتِ ۰–۲۳ (تقریبِ ثابتِ ایران؛ نمایش است، نه موتور — قانونِ ۱۰ فقط برای engine است)
export function dayPhaseOf(hour: number): DayPhase {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'dusk'
  return 'night'
}

// جلوهٔ بصری از آیکنِ هوای واقعی (نگاشتِ WMO فاز ۱۰۴) — آیکنِ ناشناخته/نبودِ هوا = هیچ جلوه‌ای
export function weatherFxOf(icon?: string | null): 'rain' | 'snow' | 'storm' | 'mist' | null {
  if (icon === '🌧') return 'rain'
  if (icon === '❄️') return 'snow'
  if (icon === '⛈') return 'storm'
  if (icon === '🌫') return 'mist'
  return null
}

// شلوغیِ خیابانِ زیرِ خطِ آسمان: از شمارِ واقعیِ برج‌های بازیکن — سقف‌دار تا صحنه شلوغ نشود
export function streetLifeOf(assetCount: number, cap = 5): number {
  return Math.max(0, Math.min(Math.max(0, cap), Math.floor(assetCount) || 0))
}

// سبک‌های نما (جلد ۶۸ — هویتِ معماری): همان چهار سبکِ موجودِ کارگاه + پیش‌فرض؛ فقط ظاهرِ برج در خطِ آسمان
export const FACADES = [
  { id: '', name: 'پیش‌فرض' },
  { id: 'modern', name: 'مدرن (شیشه‌ای)' },
  { id: 'classic', name: 'کلاسیک' },
  { id: 'roman', name: 'رومی' },
  { id: 'green', name: 'سبز' },
] as const

export function isValidFacade(id: string): boolean {
  return FACADES.some(f => f.id === id)
}
