import { slugify } from './slugify'

// بخشِ متنیِ اسلاگ (بدونِ id) — همان محاسبهٔ قبلی، جدا شد تا «یک‌بار» منجمد شود.
export function slugText(title?: string, location?: string): string {
  return slugify([title, location].filter(Boolean).join(' ')).slice(0, 60).replace(/^-|-$/g, '')
}

// ── مسیرِ canonicalِ آگهی: /listing/{id}-{slug} ──
// id همیشه ۱۲ رقمِ hex در ابتدای slug است تا بازیابیِ قطعی داشته باشیم؛ بقیه توضیحِ سئویی.
// فاز ۲۹۸ی — URLِ «منجمد»: اگر seoSlugِ ذخیره‌شده پاس داده شود همان استفاده می‌شود، تا با هر
// اسکرپِ دوباره (که عنوان/قیمت را عوض می‌کند) URL تغییر نکند. ریشهٔ ۵۰۶۳ «Page with redirect»
// در GSC همین بود: اسلاگ از عنوانِ متغیر ساخته می‌شد و هر تغییرِ عنوان = URLِ تازه = ریدایرکت.
export function listingHref(id: string | number, title?: string, location?: string, frozen?: string): string {
  const base = String(id || '').trim()
  if (!base) return '/listings'
  const s = (frozen && frozen.trim()) ? frozen.trim() : slugText(title, location)
  return s ? `/listing/${base}-${s}` : `/listing/${base}`
}

// استخراجِ idِ ۱۲-رقمیِ hex از slugِ آگهی (سازگاریِ عقب‌رو با idِ خام هم حفظ می‌شود).
export function idFromListingSlug(slug: string): string {
  const raw = decodeURIComponent(String(slug || '')).trim()
  const m = raw.match(/^([0-9a-f]{12})(?:-|$)/i)
  return m ? m[1] : raw
}
