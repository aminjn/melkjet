// ── نسخهٔ «سرور-ساید» تاکسونومیِ بلاگ ــ آگاه از دسته‌های سوپرادمین (category-store) ──
// blog-taxonomy.ts باید خالص بماند (کلاینت هم import می‌کند)، پس هر جایی که به fs نیاز
// است اینجا جدا شده و فقط از سرور-کامپوننت‌ها/route‌ها فراخوانی می‌شود.
// ۸ دستهٔ ثابتِ blog-taxonomy مرجع‌اند؛ هر دستهٔ مقالهٔ تازه‌ای که سوپرادمین در پنل بسازد،
// اینجا به مسیریابیِ /blog و نقشهٔ سایت اضافه می‌شود (با slug و نامِ خودش).
// (فقط از سرور-کامپوننت‌ها/route‌ها import شود — به fs وابسته است.)
import { BLOG_CATEGORIES, blogCatByNameFa, type BlogCategory } from './blog-taxonomy'
import { articleTopCategories, articleCatBySlug, articleSlugForName } from './category-store'

// همهٔ دسته‌های بلاگ: ثابت‌ها + دسته‌های سوپرادمین که در ثابت‌ها نیستند.
export function allBlogCategories(): BlogCategory[] {
  const out: BlogCategory[] = BLOG_CATEGORIES.slice()
  try {
    for (const c of articleTopCategories()) {
      if (out.some(x => x.slug === c.slug || x.nameFa === c.name)) continue
      out.push({ slug: c.slug, nameFa: c.name, subs: [] })
    }
  } catch { /* اگر فایلِ دسته در دسترس نبود، فقط ثابت‌ها */ }
  return out
}

// slug → دستهٔ بلاگ (ثابت‌ها، سپس دسته‌های سوپرادمین).
export function blogCatBySlugDyn(slug: string): BlogCategory | undefined {
  const hit = BLOG_CATEGORIES.find(c => c.slug === slug)
  if (hit) return hit
  try { const c = articleCatBySlug(slug); if (c) return { slug: c.slug, nameFa: c.name, subs: [] } } catch {}
  return undefined
}

// slugِ دستهٔ یک مقاله از نامِ فارسیِ دسته‌اش (ثابت‌ها → سوپرادمین → fallback «اخبار»).
export function categorySlugForNameDyn(name?: string): string {
  const fixed = blogCatByNameFa(name || '')?.slug
  if (fixed) return fixed
  try { const s = articleSlugForName(name); if (s) return s } catch {}
  return 'akhbar'
}
