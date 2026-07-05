import { makeSlugStore } from './entity-slug-store'

// نگاشتِ Slug ↔ idِ کالا (کاتالوگِ مصالح) برای URLهای عمومیِ /product/{slug}.
const store = makeSlugStore('.product-slug-data.json', 'product_slugs', 'kala')
export const ensureProductSlug = store.ensure
export const ensureManyProductSlugs = store.ensureMany
export const productIdForSlug = store.idForSlug
export const slugForProductId = store.slugForId
export const allProductSlugsById = store.allById
