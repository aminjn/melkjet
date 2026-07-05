// ── تاکسونومیِ بلاگ — ۸ دسته + زیردسته‌ها (تگ‌شونده) ──
// URL: /blog/{category.slug}/{article.slug}. category دقیقاً یکی از این‌هاست؛ زیردسته‌ها tag اند.
export interface BlogCategory { slug: string; nameFa: string; subs: string[] }
export const BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'rahnamaye-kharid', nameFa: 'راهنمای خرید', subs: ['buy-apartment', 'buy-villa', 'buy-land', 'buy-commercial', 'buy-office', 'buy-shop', 'buy-first-home', 'buy-with-loan', 'pre-sale', 'buying-checklist', 'buying-mistakes', 'property-tax', 'transfer-deed', 'investment-buying'] },
  { slug: 'rahnamaye-ejare', nameFa: 'راهنمای اجاره', subs: ['rent-apartment', 'full-mortgage', 'rent-villa', 'rent-office', 'rent-commercial', 'short-term-rent', 'furnished-rent', 'tenant-rights', 'landlord-rights', 'deposit', 'contract-renewal', 'eviction', 'rental-contract'] },
  { slug: 'tahlil-bazar', nameFa: 'تحلیل بازار', subs: ['market-analysis', 'price-analysis', 'monthly-report', 'quarterly-report', 'yearly-report', 'market-forecast', 'supply-demand', 'price-index', 'luxury-market', 'investment-market', 'region-comparison', 'market-trends'] },
  { slug: 'sarmayegozari', nameFa: 'سرمایه‌گذاری', subs: ['investment', 'property-investment', 'land-investment', 'villa-investment', 'joint-venture', 'roi-analysis', 'investment-opportunities', 'low-risk-investment', 'long-term-investment', 'short-term-investment'] },
  { slug: 'hoghoghi', nameFa: 'حقوقی', subs: ['mobaye-name', 'gholnameh', 'official-deed', 'single-deed', 'pre-sale-law', 'property-disputes', 'inheritance', 'deed-separation', 'deed-division', 'commission', 'legal-contracts', 'eviction-law'] },
  { slug: 'vam', nameFa: 'وام و تسهیلات', subs: ['home-loan', 'construction-loan', 'renovation-loan', 'deposit-loan', 'mortgage', 'couple-loan', 'bank-maskan', 'bank-mellat', 'bank-saman', 'loan-calculator', 'loan-interest', 'loan-conditions'] },
  { slug: 'memari', nameFa: 'معماری و دکوراسیون', subs: ['interior-design', 'villa-design', 'facade-design', 'renovation', 'living-room-design', 'kitchen-design', 'bedroom-design', 'modern-style', 'classic-style', 'minimal-style', 'lighting', 'landscape-design', 'smart-home', 'architecture-trends'] },
  { slug: 'akhbar', nameFa: 'اخبار', subs: ['housing-news', 'construction-news', 'bank-news', 'loan-news', 'insurance-news', 'municipality-news', 'market-news', 'investment-news', 'tax-news', 'project-news'] },
]
export function blogCatBySlug(slug: string) { return BLOG_CATEGORIES.find(c => c.slug === slug) }
export function blogCatByNameFa(name: string) { const n = String(name || '').trim(); return BLOG_CATEGORIES.find(c => c.nameFa === n) }
// slugِ دستهٔ یک مقاله از نامِ فارسیِ دسته‌اش (fallback: اولین دسته).
export function categorySlugForName(name?: string): string { return (blogCatByNameFa(name || '')?.slug) || 'akhbar' }
