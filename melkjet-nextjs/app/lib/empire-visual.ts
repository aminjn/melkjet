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

// ── فاز ۱۵۸ — شهرِ ایزومتریکِ زنده (سبکِ tycoon): توابعِ خالصِ چیدمان و پالت ──
// چیدمان و رنگ کاملاً قطعی از دادهٔ واقعیِ دارایی‌هاست (id/ارزش/نما) — هیچ تصادف و عددِ ساختگی.

// پالتِ زندهٔ برج‌ها به تفکیکِ نما — سه وجهِ ایزومتریک (بام/چپ/راست) + رنگِ پنجره
export const TOWER_PALETTES: Record<string, { top: string; left: string; right: string; win: string }> = {
  '': { top: '#7d6ef0', left: '#5b4dc9', right: '#4a3cb0', win: '#ffe9a3' },
  modern: { top: '#39d5c9', left: '#1fa89e', right: '#158a82', win: '#eafffb' },
  classic: { top: '#f0a45c', left: '#d07f36', right: '#b06a28', win: '#fff3d9' },
  roman: { top: '#e8d9b8', left: '#c9b58c', right: '#ab9871', win: '#fffaf0' },
  green: { top: '#5ecf6d', left: '#3aa94a', right: '#2c8c3a', win: '#eaffe9' },
}
export function towerPaletteOf(facade?: string) {
  return TOWER_PALETTES[facade || ''] || TOWER_PALETTES['']
}

// جای هر برج روی شبکهٔ الماسیِ زمین (ایزومتریک): قطعی از ترتیبِ دارایی — مارپیچ از مرکز
// تا شهر «پر» به نظر برسد و با هر دارایی‌ِ تازه یک قواره‌ی تازه روشن شود. gridN از شمارِ دارایی.
export interface IsoSpot { col: number; row: number }
export function cityLayoutOf(count: number): { gridN: number; spots: IsoSpot[] } {
  const n = Math.max(0, Math.floor(count) || 0)
  const gridN = Math.max(3, Math.ceil(Math.sqrt(n + 1)) + 1)
  const c = Math.floor(gridN / 2)
  // مارپیچِ ساعت‌گرد از مرکز — قطعی و پایدار (دارایی iام همیشه همان‌جا می‌ماند)
  const spots: IsoSpot[] = []
  let col = c, row = c, leg = 1, dir = 0
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  if (n > 0) spots.push({ col, row })
  let guard = 0
  while (spots.length < n && guard++ < 4000) {
    for (let r = 0; r < 2 && spots.length < n; r++) {
      for (let s = 0; s < leg && spots.length < n; s++) {
        col += dirs[dir][0]; row += dirs[dir][1]
        if (col >= 0 && col < gridN && row >= 0 && row < gridN) spots.push({ col, row })
      }
      dir = (dir + 1) % 4
    }
    leg++
  }
  return { gridN, spots }
}

// ارتفاعِ برج (تعدادِ «طبقهٔ بصری») از ارزشِ واقعیِ دارایی نسبت به بیشینهٔ پرتفوی — ۱..۶
export function towerFloorsOf(value: number, maxValue: number, maxFloors = 6): number {
  if (!maxValue || value <= 0) return 1
  return Math.max(1, Math.min(maxFloors, Math.round((value / maxValue) * maxFloors)))
}
