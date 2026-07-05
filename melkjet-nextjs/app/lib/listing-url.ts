import { slugify } from './slugify'

// ── مسیرِ canonicalِ آگهی: /listing/{id}-{slug} ──
// id همیشه ۱۲ رقمِ hex در ابتدای slug است تا بازیابیِ قطعی داشته باشیم؛ بقیه توضیحِ سئویی.
export function listingHref(id: string | number, title?: string, location?: string): string {
  const base = String(id || '').trim()
  if (!base) return '/listings'
  const s = slugify([title, location].filter(Boolean).join(' ')).slice(0, 60).replace(/^-|-$/g, '')
  return s ? `/listing/${base}-${s}` : `/listing/${base}`
}

// استخراجِ idِ ۱۲-رقمیِ hex از slugِ آگهی (سازگاریِ عقب‌رو با idِ خام هم حفظ می‌شود).
export function idFromListingSlug(slug: string): string {
  const raw = decodeURIComponent(String(slug || '')).trim()
  const m = raw.match(/^([0-9a-f]{12})(?:-|$)/i)
  return m ? m[1] : raw
}
