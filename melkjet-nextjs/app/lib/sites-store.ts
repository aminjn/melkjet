import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// Dependency-free JSON-file store for published builder sites.
// Mirrors the persistence style of crm-store.ts.
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.sites-data.json')
const KV_KEY = 'sites'

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
  secondary?: string   // رنگِ تیره/مکمل (بخش‌های تیره، فوتر، گرادیانِ هیرو)
  bg?: string          // پس‌زمینهٔ صفحه
  surface?: string     // پس‌زمینهٔ بخش‌ها/کارت‌های جایگزین
  text?: string        // رنگِ متنِ بدنه
  heading?: string     // رنگِ عنوان‌ها
  font?: string
}

const HEX = /^#[0-9a-fA-F]{3,8}$/
function pickColor(v: any, fallback: string): string { const s = String(v || '').trim(); return HEX.test(s) ? s : fallback }
// پالتِ کاملِ تم را از دادهٔ خام می‌سازد (با مقادیرِ پیش‌فرض).
function normTheme(t: any): SiteTheme {
  const o = t && typeof t === 'object' ? t : {}
  return {
    primary: pickColor(o.primary, '#c9a84c'),
    secondary: pickColor(o.secondary, '#1a1510'),
    bg: pickColor(o.bg, '#ffffff'),
    surface: pickColor(o.surface, '#fbfaf8'),
    text: pickColor(o.text, '#4a4338'),
    heading: pickColor(o.heading, '#15110b'),
    ...(o.font ? { font: String(o.font) } : {}),
  }
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

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { sites: [] }
}

function fileSave(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { sites: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { sites: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
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
    theme: site?.theme && typeof site.theme === 'object' ? normTheme(site.theme) : undefined,
    pages,
    seo: site?.seo && typeof site.seo === 'object'
      ? { title: String(site.seo.title || ''), description: String(site.seo.description || '') }
      : undefined,
    createdAt: Number(site?.createdAt) || Date.now(),
    updatedAt: Number(site?.updatedAt) || Date.now(),
  }
}

export async function listSites(): Promise<Site[]> {
  return (await load()).sites.map(migrateSite).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getSite(slug: string): Promise<Site | null> {
  const s = sanitizeSlug(slug)
  if (!s) return null
  const site = (await load()).sites.find(site => site.slug === s) ?? null
  if (!site) return null
  return migrateSite(site)
}

// سایتِ متعلق به یک مالک (شمارهٔ حساب) — تازه‌ترین. برای «سایتِ من» در سایت‌ساز که باید
// مستقل از slug، همان سایتِ ذخیره‌شدهٔ کاربر را برگرداند (نه قالبِ پیش‌فرض).
export async function getSiteByOwner(owner: string): Promise<Site | null> {
  const o = String(owner || '').trim(); if (!o) return null
  const mine = (await load()).sites.filter(s => String(s.owner || '') === o)
  if (!mine.length) return null
  // تازه‌ترین (بیشترین updatedAt/createdAt)
  mine.sort((a, b) => (Number((b as any).updatedAt || (b as any).createdAt || 0)) - (Number((a as any).updatedAt || (a as any).createdAt || 0)))
  return migrateSite(mine[0])
}

// Find a page within a site by slug; falls back to the home page (pages[0]).
export function getSitePage(site: Site, pageSlug: string): SitePage {
  const want = sanitizeSlug(pageSlug)
  return site.pages.find(p => p.slug === want) || site.pages[0]
}

interface SavePageInput { slug?: string; title?: string; blocks?: any[]; inMenu?: boolean; menuLabel?: string }

export async function saveSite(input: {
  slug?: string
  title: string
  owner?: string
  ownerName?: string
  pages?: SavePageInput[]
  // legacy single-page input
  blocks?: SiteBlock[]
  seo?: Partial<SiteSeo>
  theme?: Partial<SiteTheme>
}): Promise<Site> {
  return mutate((db) => {
    const now = Date.now()
    // سایت per-user است: هر کاربر یک سایتِ خودش دارد. slug را طوری حل می‌کنیم که کاربر همیشه
    // سایتِ خودش را آپدیت کند و هرگز سایتِ کاربرِ دیگر یا قالبِ نمونه را رونویسی نکند
    // (باگِ گم‌شدنِ سایت: چند کاربرِ یک صنف روی slugِ پیش‌فرضِ مشترک همدیگر را پاک می‌کردند).
    const owner = input.owner ? String(input.owner) : undefined
    let slug = sanitizeSlug(input.slug || '')
    let existing: Site | undefined
    if (owner) {
      const mineExisting = db.sites.find(s => String(s.owner || '') === owner)
      if (mineExisting) {
        slug = mineExisting.slug            // سایتِ خودش را در جا آپدیت کن (مستقلِ از slugِ ارسالی)
        existing = mineExisting
      } else {
        // کاربرِ جدید: اگر slug خالی است یا متعلق به دیگری/نمونه است، یک slugِ یکتا بساز.
        const taken = slug ? db.sites.find(s => s.slug === slug) : undefined
        if (!slug || (taken && String(taken.owner || '') !== owner)) {
          const base = sanitizeSlug(input.ownerName || input.title || slug || 'site') || 'site'
          let cand = base, n = 2
          while (db.sites.some(s => s.slug === cand)) cand = `${base}-${n++}`
          slug = cand
        }
        existing = undefined
      }
    } else {
      if (!slug) slug = sanitizeSlug(input.title || '') || randomSlug()
      existing = db.sites.find(s => s.slug === slug)
    }
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
      theme: normTheme({ ...input.theme, primary: HEX.test(primary) ? primary : (input.theme?.primary || '#c9a84c') }),
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
    return site
  })
}
