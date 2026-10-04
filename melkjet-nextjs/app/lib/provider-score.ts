// فاز ۲۹۸س — «امتیازِ ملک‌جت» برای «همهٔ» دایرکتوری (نه فقط معمار). موتورِ بومیِ شفاف که از
// «هر دادهٔ واقعی‌ای که برای آن صنف داریم» یک امتیازِ ۰..۱۰۰ + رتبهٔ کیفی می‌سازد. جایگزینِ
// معیارهای بی‌معنایِ مبدأ (اعتبار/رتبهٔ طرح‌۲طرح). ستونِ بدونِ داده = ۰ (صادقانه). خالص و تست‌پذیر.
//
// یک موتور، پنج ستونِ عمومی؛ هر صنف هرچه دارد پاس می‌دهد:
//   - مشاور/آژانس: فایل‌ها، معاملهٔ موفق، نظرها، سابقه، نشان‌ها
//   - سازنده: پروژه‌ها، نظرها، سابقه
//   - معمار: پروژه‌های اجراشده، امتیاز/NPSِ کارفرما، جوایز، تحصیلات/مهارت
//   - بقیه (کارشناس/حقوقی/…): نظرها، کاملیِ پروفایل، نشان‌ها، سابقه

export interface ProviderScoreInput {
  // کارنامه/فعالیت
  listings?: number           // فایل/آگهیِ فعال
  deals?: number              // معاملهٔ موفق
  projects?: number           // پروژه‌های ثبت‌شده (سازنده/معمار)
  projDone?: number; projDoing?: number; projPresented?: number
  projectsWithImage?: number
  // رضایت/نظرات
  rating?: number; ratingCount?: number; nps?: number   // بازخوردِ بیرونی (معمار)
  mjReviews?: number; mjAvg?: number                    // نظراتِ تاییدشدهٔ ملک‌جت
  // اعتبار
  honor1?: number; honor2?: number; honor3?: number; honorFinal?: number; honoursCount?: number
  badgesCount?: number        // نشان‌های اعتبارِ ملک‌جت (به‌جز تیکِ تایید)
  // کاملیِ پروفایل
  skillsCount?: number; edusCount?: number; specialtiesCount?: number
  hasAbout?: boolean; hasAvatar?: boolean; hasOffice?: boolean; hasCity?: boolean; hasPhone?: boolean
  // سابقه و تایید
  memberYears?: number; registered?: boolean; verified?: boolean
}

export interface ScorePart { key: string; label: string; score: number; weight: number }
export type ProviderTierKey = 'top' | 'pro' | 'active' | 'new' | 'none'
export interface ProviderScore { score: number; tier: string; tierKey: ProviderTierKey; parts: ScorePart[]; dataPoints: number }

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0)

function portfolioScore(i: ProviderScoreInput): number {
  const projTotal = Math.max(num(i.projects), num(i.projDone) + num(i.projDoing) + num(i.projPresented))
  return clamp(
    num(i.listings) * 7 +
    num(i.deals) * 11 +
    num(i.projDone) * 9 + num(i.projDoing) * 3 + num(i.projPresented) * 1.5 +
    projTotal * 5,
  )
}

function satisfactionScore(i: ProviderScoreInput): number {
  const r = num(i.rating), rc = num(i.ratingCount)
  let base = 0, conf = 0
  if (r > 0 && rc > 0) { base = (r / 5) * 100; conf = Math.min(1, rc / 10) }
  else if (num(i.mjAvg) > 0 && num(i.mjReviews) > 0) { base = (num(i.mjAvg) / 5) * 100; conf = Math.min(1, num(i.mjReviews) / 8) }
  else if (num(i.mjReviews) > 0) { base = 60; conf = Math.min(1, num(i.mjReviews) / 8) }   // نظر هست ولی بی‌امتیاز
  else return 0
  const npsBoost = num(i.nps) > 0 ? Math.min(12, num(i.nps) / 6) : 0
  return clamp(base * (0.65 + 0.35 * conf) + npsBoost)
}

function recognitionScore(i: ProviderScoreInput): number {
  const extra = Math.max(0, num(i.honoursCount) - (num(i.honor1) + num(i.honor2) + num(i.honor3) + num(i.honorFinal)))
  const awards = num(i.honor1) * 30 + num(i.honor2) * 20 + num(i.honor3) * 12 + num(i.honorFinal) * 6 + extra * 5
  return clamp(awards + num(i.badgesCount) * 16 + num(i.deals) * 2)
}

function completenessScore(i: ProviderScoreInput): number {
  let s = 0
  if (i.hasAbout) s += 18
  if (i.hasAvatar) s += 12
  const spec = Math.max(num(i.specialtiesCount), num(i.skillsCount))
  if (spec >= 3) s += 16; else if (spec >= 1) s += 8
  if (num(i.edusCount) >= 1) s += 10
  if (i.hasOffice) s += 8
  if (i.hasCity) s += 8
  if (num(i.projectsWithImage) >= 3) s += 16; else if (num(i.projectsWithImage) >= 1) s += 8
  if (i.hasPhone) s += 10
  return clamp(s)
}

function tenureScore(i: ProviderScoreInput): number {
  const yrs = Math.min(60, num(i.memberYears) * 18)
  const base = (i.registered && num(i.memberYears) === 0) ? 8 : 0
  return clamp(yrs + base + (i.verified ? 40 : 0))
}

const WEIGHTS: { key: string; label: string; w: number; fn: (i: ProviderScoreInput) => number }[] = [
  { key: 'portfolio', label: 'کارنامه و فعالیت', w: 28, fn: portfolioScore },
  { key: 'satisfaction', label: 'رضایت و نظرات', w: 28, fn: satisfactionScore },
  { key: 'recognition', label: 'اعتبار و افتخارات', w: 20, fn: recognitionScore },
  { key: 'completeness', label: 'کاملیِ پروفایل', w: 12, fn: completenessScore },
  { key: 'tenure', label: 'سابقه و تایید', w: 12, fn: tenureScore },
]

function tierOf(score: number): { tier: string; tierKey: ProviderTierKey } {
  if (score >= 80) return { tier: 'برترِ ملک‌جت', tierKey: 'top' }
  if (score >= 60) return { tier: 'حرفه‌ای', tierKey: 'pro' }
  if (score >= 40) return { tier: 'فعال', tierKey: 'active' }
  if (score >= 1) return { tier: 'در حالِ رشد', tierKey: 'new' }
  return { tier: '', tierKey: 'none' }
}

export function providerScore(i: ProviderScoreInput): ProviderScore {
  const parts: ScorePart[] = WEIGHTS.map(w => ({ key: w.key, label: w.label, score: Math.round(clamp(w.fn(i))), weight: w.w }))
  const score = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / 100)
  const { tier, tierKey } = tierOf(score)
  const dataPoints = parts.filter(p => p.score > 0).length
  return { score, tier, tierKey, parts, dataPoints }
}
