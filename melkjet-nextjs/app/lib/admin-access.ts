// 🛡 فاز ۱۱۵ — دسترسیِ پرسنل به پنلِ مدیریت (درخواستِ مستقیم: «به ادمین‌ها و پرسنلم دسترسی بدهم»).
// این فایل عمداً «خالص» است (بدونِ fs/store) تا در proxy (edge) هم قابلِ‌import باشد.
// مدل: سوپرادمین در کشوی کاربر بخش‌های مجاز را تیک می‌زند → در JWT کاربر (claim `staff`) می‌نشیند →
// proxy تنها گلوگاهِ اجرای سخت‌گیرانه است (هر /api/admin/* خارج از بخش‌های مجاز = 403).
// بخش‌های حساس (نقش‌ها، درگاه‌ها، اتصال‌ها/کلیدها، impersonate، تغییرِ رمز، امپراتوری، پرشین‌سازه)
// عمداً قابلِ‌اعطا نیستند — همیشه فقط سوپرادمین.

// بخش‌های قابلِ‌اعطا (id = همان idهای منوی پنلِ ادمین)
export const STAFF_GRANTABLE: Array<{ id: string; label: string }> = [
  { id: 'staffCrm', label: '📞 CRM مرکزی (مشتریانِ سایت)' },
  { id: 'support', label: '🛟 پشتیبانی (تیکت‌ها)' },
  { id: 'crm', label: '👁 نظارت بر CRM کاربران (همهٔ لیدهای سیستم)' },
  { id: 'users', label: '◍ کاربران' },
  { id: 'profiles', label: '👁 پروفایل‌ها' },
  { id: 'agencyintel', label: '🏢 هوشِ آژانس' },
  { id: 'listings', label: '▤ آگهی‌ها' },
  { id: 'moderation', label: '✓ تأییدِ آگهی' },
  { id: 'products', label: '◰ محصولاتِ فروشگاه' },
  { id: 'catalog', label: '🧱 کاتالوگِ مصالح' },
  { id: 'articles', label: '✎ مقالات' },
  { id: 'categories', label: '☰ دسته‌بندی‌ها' },
  { id: 'site', label: '🌐 تنظیماتِ سایت و صفحه‌ها' },
  { id: 'scraper', label: '⛏ موتورِ اسکرپی' },
  { id: 'ads', label: '▤ تبلیغاتِ بنری' },
  { id: 'discounts', label: '٪ کدهای تخفیف' },
  { id: 'promos', label: '★ پروموت و ویژه‌سازی' },
  { id: 'tracker', label: '🎯 ترکر و پیامکِ هدفمند' },
  { id: 'sms', label: '✉ پیامک و الگوها' },
  { id: 'plans', label: '◔ پلن‌ها و اشتراک' },
  { id: 'geo', label: '🗺 مناطق و محله‌ها' },
  { id: 'sitemap', label: '🧭 سایت‌مپ و SEO' },
  { id: 'reports', label: '◔ گزارش‌ها و Big Data' },
  { id: 'audit', label: '❖ لاگِ ممیزی' },
  { id: 'impersonate', label: '👤 ورود به محیطِ کاربر (impersonate)' },
]
export const STAFF_GRANTABLE_IDS = new Set(STAFF_GRANTABLE.map(x => x.id))

// نگاشتِ سگمنتِ اولِ /api/admin/<seg> → بخش‌هایی که به آن API نیاز دارند.
// هر سگمنتی که اینجا نیست = فقط سوپرادمین (پیش‌فرضِ امن) — از جمله impersonate/change-password/roles/payment/کانفیگ‌ها.
export const API_SECTIONS: Record<string, string[]> = {
  'staff-crm': ['staffCrm'],
  support: ['support'],
  crm: ['crm'],
  users: ['users'],
  'shahkar-lookup': ['users'],
  'shahkar-refetch': ['users'],
  profiles: ['profiles'],
  'profile-options': ['profiles'],
  'profile-gate-config': ['profiles', 'sms'],   // فاز ۱۲۵: کارتش داخلِ نمای پیامک هم هست
  'divar-pros': ['profiles', 'agencyintel'],
  'agency-intel': ['agencyintel'],
  'agency-roster': ['agencyintel'],
  scraper: ['scraper', 'listings', 'moderation', 'products', 'articles'],
  owners: ['scraper', 'listings'],
  categories: ['categories', 'listings', 'products', 'articles'],
  'moderation-config': ['moderation'],
  catalog: ['catalog'],
  cms: ['articles'],
  site: ['site'],
  banners: ['ads'],
  promos: ['discounts'],
  promotions: ['promos'],
  'promo-pricing': ['promos'],
  'tracker-config': ['tracker', 'users'],   // فاز ۱۲۵: بازدیدهای سایتِ کاربر داخلِ کشوی کاربران هم خوانده می‌شود
  'alerts-config': ['sms'],
  'negotiation-config': ['sms'],
  outreach: ['tracker', 'sms'],
  'sms-cost': ['sms'],
  'ai-cost': ['reports'],
  plans: ['plans'],
  geo: ['geo'],
  seo: ['sitemap'],
  market: ['reports'],
  audit: ['audit'],
  system: ['reports'],
  impersonate: ['impersonate'],
}

// آیا این نشستِ پرسنل به این مسیرِ /api/admin/... می‌رسد؟ (سوپرادمین جدا و همیشه آزاد است)
export function staffApiAllowed(staff: string[] | undefined, pathname: string): boolean {
  if (!staff?.length) return false
  const m = pathname.match(/^\/api\/admin\/([^/?]+)/)
  if (!m) return false
  const secs = API_SECTIONS[m[1]]
  return !!secs && secs.some(sec => staff.includes(sec))
}
