// ── مرکزِ آدرس‌های عمومی (English, kebab) — تا لینک‌ها پراکنده و هاردکد نباشند ──
// موجودیت‌هایی که slug دارند: مسیر با slug ساخته می‌شود؛ اگر فقط id در دست باشد،
// همان id را می‌دهیم و خودِ مسیر (resolve-or-id) آن را به slug کنونیکال ریدایرکت می‌کند.
export { listingHref } from './listing-url'

export const BUILDERS = '/builders'
export const STORES = '/stores'
export const MATERIALS_MARKET = '/materials-market'
export const MATERIALS_PRICES = '/materials-prices'

export function builderHref(idOrSlug: string | number) { return `/builders/${idOrSlug}` }
export function productHref(idOrSlug: string | number) { return `/product/${idOrSlug}` }
export function shopHref(slug: string) { return `/store/${slug}` }
