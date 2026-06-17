import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Dependency-free JSON-file store for published builder sites.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.sites-data.json')

export interface SiteBlock {
  id: number
  type: string
  heading: string
}

export interface SiteSeo {
  title: string
  description: string
}

export interface Site {
  slug: string
  title: string
  blocks: SiteBlock[]
  seo: SiteSeo
  createdAt: number
  updatedAt: number
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
  return load().sites.find(site => site.slug === s) ?? null
}

export function saveSite(input: {
  slug?: string
  title: string
  blocks: SiteBlock[]
  seo?: Partial<SiteSeo>
}): Site {
  const db = load()
  // Derive slug: explicit slug → title → random.
  let slug = sanitizeSlug(input.slug || '')
  if (!slug) slug = sanitizeSlug(input.title || '')
  if (!slug) slug = randomSlug()

  const now = Date.now()
  const existing = db.sites.find(site => site.slug === slug)
  const site: Site = {
    slug,
    title: String(input.title || '').trim() || 'سایت بدون عنوان',
    blocks: Array.isArray(input.blocks) ? input.blocks : [],
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
