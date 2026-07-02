import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { listRoles } from './role-store'

// استورِ پلن‌های اشتراک — نقش‌محور، با سقفِ مصرف (quotas) و اعتبارِ AI (aiCredits).
// همه‌چیز داینامیک و قابلِ ویرایش از پنلِ سوپرادمین است؛ هیچ عددی هاردکد نیست (فقط seedِ اولیه).
const DATA_FILE = join(process.cwd(), '.plan-data.json')
const SEED_V = 4   // با تغییرِ ساختار/قیمت‌های پیش‌فرض این را بالا ببرید تا seed دوباره اعمال شود

// کلیدهای سقفِ مصرف (−۱ = نامحدود، ۰/تعریف‌نشده = بدونِ محدودیتِ اعمال‌شده)
export const QUOTA_KEYS: { id: string; label: string }[] = [
  { id: 'listings', label: 'آگهی' }, { id: 'files', label: 'فایل' }, { id: 'properties', label: 'ملک' },
  { id: 'projects', label: 'پروژه' }, { id: 'units', label: 'واحد' }, { id: 'investors', label: 'سرمایه‌گذار' },
  { id: 'leads', label: 'لید' }, { id: 'crmCustomers', label: 'مشتری CRM' }, { id: 'contacts', label: 'مخاطب' },
  { id: 'agents', label: 'مشاور' }, { id: 'products', label: 'محصول' }, { id: 'aiRequests', label: 'درخواست AI' },
  { id: 'contentGen', label: 'تولید محتوا' }, { id: 'aiImages', label: 'تصویر AI' },
  { id: 'savedSearches', label: 'جستجوی ذخیره' }, { id: 'chats', label: 'چت' }, { id: 'divarImports', label: 'ایمپورت دیوار' },
  { id: 'sites', label: 'سایت' }, { id: 'sitePages', label: 'صفحهٔ سایت' }, { id: 'sms', label: 'پیامک' },
  { id: 'email', label: 'ایمیل' }, { id: 'campaigns', label: 'کمپین' }, { id: 'automations', label: 'اتوماسیون' },
  { id: 'contactReveals', label: 'تماسِ آشکارشده' },
]

export interface Plan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  currency?: string
  features: string[]
  highlighted: boolean
  cta?: string
  order: number
  active: boolean
  roleId?: string        // نقشی که این پلن برای آن است (خالی = عمومی)
  dashboard?: string     // داشبوردِ هدف (/buyer, /owner, …) — برای نمایش در پنلِ همان نقش
  badge?: string
  permissions?: string[] // ماژول‌هایی که باز می‌کند (از PERMISSIONS)
  quotas?: Record<string, number>  // سقفِ مصرف (−۱ نامحدود)
  aiCredits?: number     // اعتبارِ AIِ ماهانه که با این پلن داده می‌شود
  tier?: string          // سطح: free | starter | growth | pro | premium | enterprise
  promotionDiscount?: number  // درصدِ تخفیفِ پروموشن برای این پلن
  trialEnabled?: boolean      // امکانِ دورهٔ آزمایشی
  founderEligible?: boolean    // مشمولِ باشگاهِ بنیان‌گذاران
  referralEligible?: boolean   // مشمولِ سیستمِ دعوت
  couponEligible?: boolean     // امکانِ اعمالِ کدِ تخفیف
  createdAt: number
}

interface DB { plans: Plan[]; v?: number }
function id() { return randomBytes(6).toString('hex') }
function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { const db = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as DB; if (db && Array.isArray(db.plans) && db.v === SEED_V) return db } catch {}
  }
  const db = seed(); save(db); return db
}
function save(db: DB) { db.v = SEED_V; writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

// ── seedِ کاملِ پلن‌ها طبقِ سندِ درآمدیِ ملک‌جت ──
function seed(): DB {
  let now = Date.now(), ord = 0
  const roles = (() => { try { return listRoles() } catch { return [] } })()
  const ridFor = (dash: string) => roles.find(r => r.dashboard === dash)?.id
  const Q = (o: Record<string, number>) => o
  const mk = (dashboard: string, name: string, priceMonthly: number, o: { yearly?: number; features?: string[]; perms?: string[]; quotas?: Record<string, number>; ai?: number; hot?: boolean; badge?: string; tier?: string }): Plan => ({
    id: id(), name, dashboard, roleId: ridFor(dashboard), priceMonthly, priceYearly: o.yearly ?? priceMonthly * 10, currency: 'تومان',
    features: o.features || [], permissions: o.perms || [], quotas: o.quotas || {}, aiCredits: o.ai || 0,
    tier: o.tier, promotionDiscount: 0, trialEnabled: priceMonthly > 0, founderEligible: true, referralEligible: true, couponEligible: priceMonthly > 0,
    highlighted: !!o.hot, badge: o.badge, order: ord++, active: true, createdAt: now++,
  })
  const U = -1
  const plans: Plan[] = [
    // خریدار
    mk('/buyer', 'رایگان', 0, { features: ['۲ آگهی', '۵ جستجوی ذخیره‌شده', '۲۰ پیام', '۵۰ درخواست AI'], quotas: Q({ listings: 2, savedSearches: 5, chats: 20, aiRequests: 50 }), ai: 5000 }),
    mk('/buyer', 'Plus', 99000, { features: ['۱۰ آگهی', 'جستجوی نامحدود', '۲۰۰ درخواست AI'], quotas: Q({ listings: 10, savedSearches: U, chats: U, aiRequests: 200 }), ai: 20000, hot: true, badge: 'محبوب' }),
    mk('/buyer', 'Pro', 199000, { features: ['آگهی نامحدود', 'تحلیل قیمت', 'تحلیل منطقه', 'دستیار خرید'], quotas: Q({ listings: U, savedSearches: U, chats: U, aiRequests: U }), ai: 50000 }),
    // مالک
    mk('/owner', 'رایگان', 0, { features: ['۳ ملک'], quotas: Q({ properties: 3 }), ai: 5000 }),
    mk('/owner', 'حرفه‌ای', 249000, { features: ['۲۰ ملک', 'CRM سبک', 'گزارش بازدید'], perms: ['crm', 'analytics'], quotas: Q({ properties: 20, crmCustomers: 100 }), ai: 20000, hot: true }),
    mk('/owner', 'پریمیوم', 449000, { features: ['ملک نامحدود', 'وب‌سایت اختصاصی', 'تخفیفِ پروموشن'], perms: ['crm', 'analytics', 'website'], quotas: Q({ properties: U, crmCustomers: U, sites: 1 }), ai: 50000 }),
    // مشاور املاک
    mk('/pros', 'Starter', 290000, { features: ['۱۰۰ فایل', '۲۰۰ لید', '۵۰ مشتری', '۵ ایمپورت دیوار'], perms: ['crm', 'listings'], quotas: Q({ files: 100, leads: 200, crmCustomers: 50, divarImports: 5 }), ai: 20000 }),
    mk('/pros', 'Growth', 590000, { features: ['۵۰۰ فایل', 'CRM کامل', 'موتور مذاکره', 'سایت‌ساز', 'گزارش'], perms: ['crm', 'marketing', 'website', 'analytics', 'listings'], quotas: Q({ files: 500, leads: U, crmCustomers: U, divarImports: 50, sites: 1 }), ai: 50000, hot: true }),
    mk('/pros', 'Elite', 990000, { features: ['نامحدود', 'اتوماسیون', 'همه امکانات'], perms: ['crm', 'marketing', 'website', 'automation', 'analytics', 'listings'], quotas: Q({ files: U, leads: U, crmCustomers: U, divarImports: U, sites: U }), ai: 100000 }),
    // آژانس املاک
    mk('/agency', 'Team', 690000, { features: ['۳ مشاور', '۱۰۰۰ فایل', 'CRM'], perms: ['crm', 'listings'], quotas: Q({ agents: 3, files: 1000, crmCustomers: U }), ai: 30000 }),
    mk('/agency', 'Business', 1200000, { features: ['۱۰ مشاور', 'بازاریابی', 'وب‌سایت', 'گزارش'], perms: ['crm', 'marketing', 'website', 'analytics', 'listings'], quotas: Q({ agents: 10, files: U, sites: 1 }), ai: 80000, hot: true }),
    mk('/agency', 'Enterprise', 2400000, { features: ['مشاورِ نامحدود', 'اتوماسیون', 'API', 'Big Data'], perms: ['crm', 'marketing', 'website', 'automation', 'analytics', 'listings'], quotas: Q({ agents: U, files: U, sites: U }), ai: 200000 }),
    // سازنده
    mk('/builder', 'Lite', 590000, { features: ['۱ پروژه', '۵۰ واحد', '۲۰ سرمایه‌گذار'], perms: ['units', 'investors'], quotas: Q({ projects: 1, units: 50, investors: 20 }), ai: 20000 }),
    mk('/builder', 'Pro', 1190000, { features: ['۵ پروژه', '۳۰۰ واحد', 'بازار مصالح', 'تحلیل'], perms: ['units', 'investors', 'store', 'analytics'], quotas: Q({ projects: 5, units: 300, investors: U }), ai: 50000, hot: true }),
    mk('/builder', 'Max', 2490000, { features: ['نامحدود', 'AI Studio', 'پلانِ سه‌بعدی', 'گزارشِ پیشرفته'], perms: ['units', 'investors', 'store', 'analytics', 'ai_studio', 'website'], quotas: Q({ projects: U, units: U, investors: U }), ai: 150000 }),
    // مصالح
    mk('/materials', 'Basic', 390000, { features: ['۵۰ محصول', 'ویترینِ فروشگاهی'], perms: ['store'], quotas: Q({ products: 50 }), ai: 10000 }),
    mk('/materials', 'Advanced', 790000, { features: ['۳۰۰ محصول', 'نرخِ روز', 'هوش مصنوعی'], perms: ['store', 'marketing'], quotas: Q({ products: 300 }), ai: 40000, hot: true }),
    mk('/materials', 'Premium', 1490000, { features: ['محصولِ نامحدود', 'ویژه‌سازی', 'تبلیغات'], perms: ['store', 'marketing', 'website'], quotas: Q({ products: U }), ai: 100000 }),
    // حقوقی
    mk('/legal', 'Basic', 199000, { features: ['پروفایل', 'مقاله'], perms: ['content'], quotas: Q({ contentGen: 10 }), ai: 5000 }),
    mk('/legal', 'Expert', 490000, { features: ['وب‌سایت', 'SEO با AI'], perms: ['content', 'website'], quotas: Q({ contentGen: 50, sites: 1 }), ai: 20000, hot: true }),
    mk('/legal', 'Professional', 890000, { features: ['محتوای نامحدود', 'مارکتینگ', 'لیدسازی'], perms: ['content', 'website', 'marketing', 'crm'], quotas: Q({ contentGen: U, leads: U }), ai: 50000 }),
  ]
  return { plans, v: SEED_V }
}

export function listPlans(): Plan[] { return load().plans.sort((a, b) => a.order - b.order) }
export function listActive(): Plan[] { return load().plans.filter(p => p.active).sort((a, b) => a.order - b.order) }
export function getPlan(pid: string): Plan | null { return load().plans.find(p => p.id === pid) || null }

export interface PlanInput {
  name: string; priceMonthly: number; priceYearly: number; currency?: string; features?: string[]
  highlighted?: boolean; cta?: string; order?: number; active?: boolean; roleId?: string; dashboard?: string
  badge?: string; permissions?: string[]; quotas?: Record<string, number>; aiCredits?: number
  tier?: string; promotionDiscount?: number; trialEnabled?: boolean; founderEligible?: boolean; referralEligible?: boolean; couponEligible?: boolean
}
function cleanQuotas(q: any): Record<string, number> {
  const out: Record<string, number> = {}
  if (q && typeof q === 'object') for (const k of QUOTA_KEYS.map(x => x.id)) if (q[k] !== undefined && q[k] !== '' && q[k] !== null) out[k] = Math.trunc(Number(q[k]))
  return out
}
export function addPlan(input: PlanInput): Plan {
  const db = load()
  const maxOrder = db.plans.reduce((m, p) => Math.max(m, p.order), 0)
  const plan: Plan = {
    id: id(), name: String(input.name || '').trim(),
    priceMonthly: Number(input.priceMonthly) || 0, priceYearly: Number(input.priceYearly) || 0,
    currency: input.currency ? String(input.currency) : 'تومان',
    features: Array.isArray(input.features) ? input.features.map(f => String(f)) : [],
    highlighted: !!input.highlighted, cta: input.cta ? String(input.cta) : undefined,
    order: input.order != null ? Number(input.order) : maxOrder + 1, active: input.active !== false,
    roleId: input.roleId ? String(input.roleId) : undefined, dashboard: input.dashboard ? String(input.dashboard) : undefined,
    badge: input.badge ? String(input.badge) : undefined,
    permissions: Array.isArray(input.permissions) ? input.permissions.map(String) : [],
    quotas: cleanQuotas(input.quotas), aiCredits: Number(input.aiCredits) || 0,
    tier: input.tier ? String(input.tier) : undefined, promotionDiscount: Number(input.promotionDiscount) || 0,
    trialEnabled: !!input.trialEnabled, founderEligible: !!input.founderEligible, referralEligible: !!input.referralEligible, couponEligible: !!input.couponEligible,
    createdAt: Date.now(),
  }
  db.plans.push(plan); save(db); return plan
}

export type PlanPatch = Partial<Omit<Plan, 'id' | 'createdAt'>>
export function updatePlan(pid: string, patch: PlanPatch): Plan | null {
  const db = load(); const p = db.plans.find(x => x.id === pid); if (!p) return null
  if (patch.name !== undefined) p.name = String(patch.name).trim()
  if (patch.priceMonthly !== undefined) p.priceMonthly = Number(patch.priceMonthly) || 0
  if (patch.priceYearly !== undefined) p.priceYearly = Number(patch.priceYearly) || 0
  if (patch.currency !== undefined) p.currency = patch.currency ? String(patch.currency) : undefined
  if (patch.features !== undefined) p.features = Array.isArray(patch.features) ? patch.features.map(f => String(f)) : []
  if (patch.highlighted !== undefined) p.highlighted = !!patch.highlighted
  if (patch.cta !== undefined) p.cta = patch.cta ? String(patch.cta) : undefined
  if (patch.order !== undefined) p.order = Number(patch.order) || 0
  if (patch.active !== undefined) p.active = !!patch.active
  if (patch.roleId !== undefined) p.roleId = patch.roleId ? String(patch.roleId) : undefined
  if (patch.dashboard !== undefined) p.dashboard = patch.dashboard ? String(patch.dashboard) : undefined
  if (patch.badge !== undefined) p.badge = patch.badge ? String(patch.badge) : undefined
  if (patch.permissions !== undefined) p.permissions = Array.isArray(patch.permissions) ? patch.permissions.map(String) : []
  if (patch.quotas !== undefined) p.quotas = cleanQuotas(patch.quotas)
  if (patch.aiCredits !== undefined) p.aiCredits = Number(patch.aiCredits) || 0
  if (patch.tier !== undefined) p.tier = patch.tier ? String(patch.tier) : undefined
  if (patch.promotionDiscount !== undefined) p.promotionDiscount = Number(patch.promotionDiscount) || 0
  if (patch.trialEnabled !== undefined) p.trialEnabled = !!patch.trialEnabled
  if (patch.founderEligible !== undefined) p.founderEligible = !!patch.founderEligible
  if (patch.referralEligible !== undefined) p.referralEligible = !!patch.referralEligible
  if (patch.couponEligible !== undefined) p.couponEligible = !!patch.couponEligible
  save(db); return p
}
export function deletePlan(pid: string): void { const db = load(); db.plans = db.plans.filter(x => x.id !== pid); save(db) }
