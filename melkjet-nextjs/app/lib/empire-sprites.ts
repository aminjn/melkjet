// 🎨 فاز ۱۶۴ — موتورِ اسپرایتِ شهرِ امپراتوری: گرافیکِ استودیویی (پک‌های CC0 مثل Kenney)
// به‌جای شکل‌کشی با کد. اسپرایت‌ها در public/empire/sprites/ + manifest.json (خروجیِ
// scripts/empire-sprite-import.mjs). انتخابِ اسپرایت ۱۰۰٪ قطعی از دادهٔ واقعیِ دارایی است
// (هَشِ id + نوع + طبقه) — هیچ تصادفی. نبودِ manifest = fallback به صحنهٔ SVG فعلی.

export interface SpriteDef {
  file: string        // نسبت به /empire/sprites/
  w: number
  h: number
  // نقطهٔ اتکا: فاصلهٔ «کفِ» اسپرایت از پایینِ تصویر (px در مقیاسِ اصلی) — برای نشستنِ دقیق روی قواره
  anchorY?: number
}
export interface SpriteManifest {
  tileW: number                      // عرضِ کاشیِ زمینِ ایزو (px اصلی، نسبت ۲:۱)
  ground: { grass: SpriteDef[]; roadNS?: SpriteDef; roadEW?: SpriteDef; cross?: SpriteDef }
  buildings: Record<string, SpriteDef[]>   // apartment | shop | villa | office | landmark | generic
  vehicles?: SpriteDef[]
  props?: SpriteDef[]                // درخت/فواره/بیلبورد …
}

// هَشِ قطعیِ سبک (بدونِ وابستگی) — همان الگوی مکانیک‌های قطعیِ بازی
export function spriteHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return Math.abs(h)
}

// دسته‌بندیِ ساختمان از دادهٔ واقعیِ دارایی (هم‌راستا با bkindOf صفحهٔ بازی)
export type BuildingKind = 'apartment' | 'shop' | 'villa' | 'office' | 'landmark' | 'generic'

// انتخابِ اسپرایتِ ساختمان: نوع + ارتفاعِ نسبی (طبقه) + هشِ id → همیشه همان اسپرایت برای همان دارایی.
// اسپرایت‌های هر دسته باید از کوتاه به بلند مرتب شده باشند (کارِ اسکریپتِ import).
export function pickBuilding(man: SpriteManifest, kind: BuildingKind, floors: number, maxFloors: number, id: string): SpriteDef | null {
  const pool = (man.buildings[kind]?.length ? man.buildings[kind] : man.buildings['generic']) || []
  if (!pool.length) return null
  // نگاشتِ طبقه (۱..max) به بازهٔ اسپرایت‌ها؛ داخلِ هر بازه با هشِ id یکی از هم‌ارتفاع‌ها
  const ratio = Math.max(0, Math.min(1, (floors - 1) / Math.max(1, maxFloors - 1)))
  const bandSize = Math.max(1, Math.floor(pool.length / Math.max(1, maxFloors)))
  const start = Math.min(pool.length - 1, Math.floor(ratio * (pool.length - bandSize)))
  const band = pool.slice(start, start + bandSize)
  return band[spriteHash(id) % band.length] || pool[pool.length - 1]
}

export function pickFrom(pool: SpriteDef[] | undefined, seed: string): SpriteDef | null {
  if (!pool || !pool.length) return null
  return pool[spriteHash(seed) % pool.length]
}

// اعتبارسنجیِ حداقلیِ manifest (برای تست و برای ردِ فایلِ خراب بدونِ شکستنِ صحنه)
export function isValidManifest(m: unknown): m is SpriteManifest {
  const x = m as SpriteManifest
  return !!x && typeof x.tileW === 'number' && x.tileW > 0
    && !!x.ground && Array.isArray(x.ground.grass) && x.ground.grass.length > 0
    && !!x.buildings && Object.values(x.buildings).some(a => Array.isArray(a) && a.length > 0)
}
