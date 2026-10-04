// فاز ۲۹۸ن — «امتیازِ ملک‌جت» برای معماران (جایگزینِ «اعتبار/رتبه»ی طرح‌۲طرح که برای ما بی‌معنا
// و عملاً فیک بود). یک سنجهٔ بومیِ شفاف، ساخته‌شده «فقط از دادهٔ واقعیِ» خودمان دربارهٔ معمار:
// پنج ستون، هرکدام ۰..۱۰۰، با وزنِ مشخص → امتیازِ نهاییِ ۰..۱۰۰ + رتبهٔ کیفی. هیچ عددِ ساختگی
// نیست؛ ستونِ بدونِ داده = ۰ (صادقانه: چیزی که اثبات نشده امتیاز نمی‌گیرد). خالص و تست‌پذیر.

export interface ArchScoreInput {
  projDone?: number           // پروژه‌های اجراشده
  projDoing?: number          // در حالِ اجرا
  projPresented?: number      // ارائه‌شده
  projectsCount?: number      // تعدادِ پروژه‌های ثبت‌شده در پروفایل
  rating?: number             // امتیازِ بازخوردها (۰..۵)
  ratingCount?: number        // تعدادِ بازخورد
  nps?: number                // تمایلِ کارفرمایان (−۱۰۰..۱۰۰)
  honor1?: number; honor2?: number; honor3?: number; honorFinal?: number
  honoursCount?: number       // کلِ افتخارات/جوایزِ فهرست‌شده
  skillsCount?: number
  edusCount?: number
  hasAbout?: boolean
  hasAvatar?: boolean
  hasOffice?: boolean
  projectsWithImage?: number
  hasPhone?: boolean
  mjReviews?: number          // نظرهای تاییدشدهٔ ملک‌جت
  mjAvg?: number              // میانگینِ نظراتِ ملک‌جت (۰..۵)
  verified?: boolean          // تیکِ تاییدِ ملک‌جت
}

export interface ScorePart { key: string; label: string; score: number; weight: number }
export type ArchTierKey = 'top' | 'pro' | 'active' | 'new' | 'none'
export interface ArchScore { score: number; tier: string; tierKey: ArchTierKey; parts: ScorePart[]; dataPoints: number }

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)

// ستونِ «کارنامه و تجربه»: پروژه‌های اجراشده بیشترین وزن، بعد حجمِ کلِ کارنامه.
function portfolioScore(i: ArchScoreInput): number {
  const done = num(i.projDone), doing = num(i.projDoing), pres = num(i.projPresented)
  const total = Math.max(num(i.projectsCount), done + doing + pres)
  return clamp(done * 9 + doing * 3 + pres * 1.5 + total * 3)
}

// ستونِ «رضایتِ کارفرما»: امتیازِ بازخورد با ضریبِ اطمینان (تعدادِ بازخورد) + اثرِ NPS؛
// اگر بازخوردِ طرح‌۲طرح نبود ولی نظرِ ملک‌جت بود، از آن استفاده می‌شود.
function satisfactionScore(i: ArchScoreInput): number {
  const r = num(i.rating), rc = num(i.ratingCount)
  let base = 0, conf = 0
  if (r > 0 && rc > 0) { base = (r / 5) * 100; conf = Math.min(1, rc / 10) }
  else if (num(i.mjAvg) > 0 && num(i.mjReviews) > 0) { base = (num(i.mjAvg) / 5) * 100; conf = Math.min(1, num(i.mjReviews) / 8) }
  else return 0
  const npsBoost = num(i.nps) > 0 ? Math.min(12, num(i.nps) / 6) : 0
  return clamp(base * (0.65 + 0.35 * conf) + npsBoost)
}

// ستونِ «اعتبار و افتخارات»: مقام‌های اول/دوم/سوم/فینالیست + کلِ جوایزِ فهرست‌شده.
function recognitionScore(i: ArchScoreInput): number {
  const extra = Math.max(0, num(i.honoursCount) - (num(i.honor1) + num(i.honor2) + num(i.honor3) + num(i.honorFinal)))
  return clamp(num(i.honor1) * 30 + num(i.honor2) * 20 + num(i.honor3) * 12 + num(i.honorFinal) * 6 + extra * 5)
}

// ستونِ «کاملیِ پروفایل»: هرچه پروفایل پرتر و قابلِ‌اعتمادتر.
function completenessScore(i: ArchScoreInput): number {
  let s = 0
  if (i.hasAbout) s += 20
  if (i.hasAvatar) s += 12
  if (num(i.skillsCount) >= 3) s += 15; else if (num(i.skillsCount) >= 1) s += 7
  if (num(i.edusCount) >= 1) s += 13
  if (i.hasOffice) s += 10
  if (num(i.projectsWithImage) >= 3) s += 20; else if (num(i.projectsWithImage) >= 1) s += 10
  if (i.hasPhone) s += 10
  return clamp(s)
}

// ستونِ «فعالیت و اعتبار در ملک‌جت»: نظرهای واقعی + تیکِ تایید.
function engagementScore(i: ArchScoreInput): number {
  return clamp(Math.min(70, num(i.mjReviews) * 14) + (i.verified ? 30 : 0))
}

const WEIGHTS: { key: string; label: string; w: number; fn: (i: ArchScoreInput) => number }[] = [
  { key: 'portfolio', label: 'کارنامه و تجربه', w: 30, fn: portfolioScore },
  { key: 'satisfaction', label: 'رضایتِ کارفرما', w: 30, fn: satisfactionScore },
  { key: 'recognition', label: 'اعتبار و افتخارات', w: 20, fn: recognitionScore },
  { key: 'completeness', label: 'کاملیِ پروفایل', w: 10, fn: completenessScore },
  { key: 'engagement', label: 'فعالیت در ملک‌جت', w: 10, fn: engagementScore },
]

function tierOf(score: number): { tier: string; tierKey: ArchTierKey } {
  if (score >= 80) return { tier: 'معمارِ برتر', tierKey: 'top' }
  if (score >= 60) return { tier: 'معمارِ حرفه‌ای', tierKey: 'pro' }
  if (score >= 40) return { tier: 'معمارِ فعال', tierKey: 'active' }
  if (score >= 1) return { tier: 'در حالِ رشد', tierKey: 'new' }
  return { tier: '', tierKey: 'none' }
}

export function architectScore(i: ArchScoreInput): ArchScore {
  const parts: ScorePart[] = WEIGHTS.map(w => ({ key: w.key, label: w.label, score: Math.round(clamp(w.fn(i))), weight: w.w }))
  const composite = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / 100)
  const { tier, tierKey } = tierOf(composite)
  // چند ستون واقعاً داده دارد (برای شفافیت: «بر پایهٔ N سنجه»)
  const dataPoints = parts.filter(p => p.score > 0).length
  return { score: composite, tier, tierKey, parts, dataPoints }
}
