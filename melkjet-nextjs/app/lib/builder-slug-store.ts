import { makeSlugStore } from './entity-slug-store'

// نگاشتِ Slug ↔ idِ سازنده (پرشین‌سازه/دستی) برای URLهای عمومیِ /builders/{slug}.
const store = makeSlugStore('.builder-slug-data.json', 'builder_slugs', 'sazande')
export const ensureBuilderSlug = store.ensure
export const ensureManyBuilderSlugs = store.ensureMany
export const builderIdForSlug = store.idForSlug
export const slugForBuilderId = store.slugForId
export const allBuilderSlugsById = store.allById
