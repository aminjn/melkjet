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

export interface Site {
  slug: string
  title: string
  blocks: SiteBlock[]
  seo: SiteSeo
  theme?: SiteTheme
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

export function listSites(): Site[] {
  return load().sites.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSite(slug: string): Site | null {
  const s = sanitizeSlug(slug)
  if (!s) return null
  const site = load().sites.find(site => site.slug === s) ?? null
  if (!site) return null
  // Migrate legacy block shapes on read.
  return { ...site, blocks: Array.isArray(site.blocks) ? site.blocks.map(normalizeBlock) : [] }
}

export function saveSite(input: {
  slug?: string
  title: string
  blocks: SiteBlock[]
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
  const site: Site = {
    slug,
    title: String(input.title || '').trim() || 'سایت بدون عنوان',
    blocks: Array.isArray(input.blocks) ? input.blocks.map(normalizeBlock) : [],
    seo: {
      title: String(input.seo?.title || '').trim(),
      description: String(input.seo?.description || '').trim(),
    },
    theme: {
      primary: /^#[0-9a-fA-F]{3,8}$/.test(primary) ? primary : '#c9a84c',
      ...(input.theme?.font ? { font: String(input.theme.font) } : {}),
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
