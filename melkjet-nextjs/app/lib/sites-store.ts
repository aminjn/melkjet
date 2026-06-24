import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Dependency-free JSON-file store for published builder sites.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.sites-data.json')

export interface SiteBlock {
  id: number
  type: string
  // Rich, per-type editable content. Always an object; legacy reads may also
  // carry a top-level `heading` which is migrated into props on read.
  props: Record<string, unknown>
  // back-compat: old stored blocks only had a `heading`
  heading?: string
}

export interface SiteSeo {
  title: string
  description: string
}

export interface SiteTheme {
  primary: string
  font?: string
}

// A single page of a site. pages[0] is always the home page.
export interface SitePage {
  slug: string
  title: string
  blocks: SiteBlock[]
  inMenu?: boolean      // در منوی سایت نمایش داده شود (پیش‌فرض true)
  menuLabel?: string    // عنوان دلخواه در منو
}

export interface Site {
  slug: string
  title: string
  owner?: string          // creator's session phone
  ownerName?: string      // creator's display name (for listings matching)
  theme?: SiteTheme
  pages: SitePage[]       // pages[0] is the home page
  // legacy/back-compat — kept optional so old data still reads
  blocks?: SiteBlock[]
  seo?: SiteSeo
  createdAt: number
  updatedAt: number
}

// Normalise a block read from disk: ensure `props` exists, migrating any legacy
// top-level `heading` into props.heading so old sites keep rendering.
export function normalizeBlock(b: any): SiteBlock {
  const props: Record<string, unknown> =
    b && typeof b.props === 'object' && b.props ? { ...b.props } : {}
  if ((props.heading === undefined || props.heading === null) && b && typeof b.heading === 'string') {
    props.heading = b.heading
  }
  return { id: Number(b?.id) || 0, type: String(b?.type || ''), props }
}

interface DB { sites: Site[] }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { sites: [] }
}

function persist(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

// Make a url-safe slug: lowercase, keep a-z0-9 and dash only.
export function sanitizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function randomSlug(): string {
  return 'site-' + randomBytes(4).toString('hex')
}

// Migrate a stored site into the current `pages` shape. Old sites had a
// top-level `blocks` array and no `pages`; wrap that into a single home page.
function migrateSite(site: any): Site {
  let pages: SitePage[]
  if (Array.isArray(site?.pages) && site.pages.length) {
    pages = site.pages.map((pg: any, i: number) => ({
      slug: i === 0 ? 'home' : (sanitizeSlug(pg?.slug || '') || `page-${i}`),
      title: String(pg?.title || '').trim() || (i === 0 ? 'خانه' : `صفحه ${i + 1}`),
      inMenu: pg?.inMenu !== false,
      menuLabel: pg?.menuLabel ? String(pg.menuLabel) : undefined,
      blocks: Array.isArray(pg?.blocks) ? pg.blocks.map(normalizeBlock) : [],
    }))
  } else {
    // Legacy: a single top-level blocks array → one home page.
    pages = [{
      slug: 'home',
      title: String(site?.title || '').trim() || 'خانه',
      blocks: Array.isArray(site?.blocks) ? site.blocks.map(normalizeBlock) : [],
    }]
  }
  return {
    slug: String(site?.slug || ''),
    title: String(site?.title || '').trim() || 'سایت بدون عنوان',
    owner: site?.owner ? String(site.owner) : undefined,
    ownerName: site?.ownerName ? String(site.ownerName) : undefined,
    theme: site?.theme && typeof site.theme === 'object'
      ? { primary: String(site.theme.primary || '#c9a84c'), ...(site.theme.font ? { font: String(site.theme.font) } : {}) }
      : undefined,
    pages,
    seo: site?.seo && typeof site.seo === 'object'
      ? { title: String(site.seo.title || ''), description: String(site.seo.description || '') }
      : undefined,
    createdAt: Number(site?.createdAt) || Date.now(),
    updatedAt: Number(site?.updatedAt) || Date.now(),
  }
}

export function listSites(): Site[] {
  return load().sites.map(migrateSite).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSite(slug: string): Site | null {
  const s = sanitizeSlug(slug)
  if (!s) return null
  const site = load().sites.find(site => site.slug === s) ?? null
  if (!site) return null
  return migrateSite(site)
}

// Find a page within a site by slug; falls back to the home page (pages[0]).
export function getSitePage(site: Site, pageSlug: string): SitePage {
  const want = sanitizeSlug(pageSlug)
  return site.pages.find(p => p.slug === want) || site.pages[0]
}

interface SavePageInput { slug?: string; title?: string; blocks?: any[]; inMenu?: boolean; menuLabel?: string }

export function saveSite(input: {
  slug?: string
  title: string
  owner?: string
  ownerName?: string
  pages?: SavePageInput[]
  // legacy single-page input
  blocks?: SiteBlock[]
  seo?: Partial<SiteSeo>
  theme?: Partial<SiteTheme>
}): Site {
  const db = load()
  // Derive slug: explicit slug → title → random.
  let slug = sanitizeSlug(input.slug || '')
  if (!slug) slug = sanitizeSlug(input.title || '')
  if (!slug) slug = randomSlug()

  const now = Date.now()
  const existing = db.sites.find(site => site.slug === slug)
  const primary = String(input.theme?.primary || '').trim()

  // Build the pages array. Prefer `pages`; fall back to a legacy single `blocks` array.
  let rawPages: SavePageInput[]
  if (Array.isArray(input.pages) && input.pages.length) {
    rawPages = input.pages
  } else {
    rawPages = [{ slug: 'home', title: input.title, blocks: Array.isArray(input.blocks) ? input.blocks : [] }]
  }

  // Sanitize/validate pages: first page is always home; slugs url-safe + unique.
  const used = new Set<string>()
  const pages: SitePage[] = rawPages.map((pg, i) => {
    let s = i === 0 ? 'home' : sanitizeSlug(pg?.slug || '')
    if (!s) s = `page-${i}`
    // ensure uniqueness within the site
    let candidate = s
    let n = 2
    while (used.has(candidate)) { candidate = `${s}-${n++}` }
    used.add(candidate)
    return {
      slug: candidate,
      title: String(pg?.title || '').trim() || (i === 0 ? 'خانه' : `صفحه ${i + 1}`),
      inMenu: (pg as { inMenu?: boolean })?.inMenu !== false,
      menuLabel: (pg as { menuLabel?: string })?.menuLabel ? String((pg as { menuLabel?: string }).menuLabel) : undefined,
      blocks: Array.isArray(pg?.blocks) ? pg.blocks.map(normalizeBlock) : [],
    }
  })
  // Always at least one page (home).
  if (!pages.length) {
    pages.push({ slug: 'home', title: String(input.title || '').trim() || 'خانه', blocks: [] })
  }

  const site: Site = {
    slug,
    title: String(input.title || '').trim() || 'سایت بدون عنوان',
    owner: input.owner ? String(input.owner) : (existing?.owner),
    ownerName: input.ownerName !== undefined ? String(input.ownerName).trim() : (existing?.ownerName),
    theme: {
      primary: /^#[0-9a-fA-F]{3,8}$/.test(primary) ? primary : '#c9a84c',
      ...(input.theme?.font ? { font: String(input.theme.font) } : {}),
    },
    pages,
    seo: {
      title: String(input.seo?.title || '').trim(),
      description: String(input.seo?.description || '').trim(),
    },
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  }
  if (existing) {
    const idx = db.sites.findIndex(s => s.slug === slug)
    db.sites[idx] = site
  } else {
    db.sites.unshift(site)
  }
  persist(db)
  return site
}
