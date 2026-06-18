import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file store for banner ads.
// Mirrors the persistence style of crm-store.ts.
const DATA_FILE = join(process.cwd(), '.banner-data.json')

export type Placement = 'home' | 'search' | 'sidebar' | 'article'

export interface Banner {
  id: string
  title: string
  image: string // URL
  link: string  // URL
  placement: Placement
  active: boolean
  clicks: number
  createdAt: number
}

interface DB { banners: Banner[] }

function id() { return randomBytes(6).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { banners: [] }
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

const PLACEMENTS: Placement[] = ['home', 'search', 'sidebar', 'article']
function normPlacement(p: unknown): Placement {
  return PLACEMENTS.includes(p as Placement) ? (p as Placement) : 'home'
}

export function listBanners(): Banner[] {
  return load().banners.sort((a, b) => b.createdAt - a.createdAt)
}

export function listActive(placement?: Placement): Banner[] {
  return listBanners().filter(b => b.active && (!placement || b.placement === placement))
}

export function addBanner(input: {
  title: string
  image: string
  link: string
  placement?: Placement
  active?: boolean
}): Banner {
  const db = load()
  const banner: Banner = {
    id: id(),
    title: String(input.title || '').trim(),
    image: String(input.image || '').trim(),
    link: String(input.link || '').trim(),
    placement: normPlacement(input.placement),
    active: input.active !== false,
    clicks: 0,
    createdAt: Date.now(),
  }
  db.banners.unshift(banner)
  save(db)
  return banner
}

export function updateBanner(
  bannerId: string,
  patch: Partial<Omit<Banner, 'id' | 'createdAt' | 'clicks'>>
): Banner | null {
  const db = load()
  const b = db.banners.find(x => x.id === bannerId)
  if (!b) return null
  if (patch.title !== undefined) b.title = String(patch.title).trim()
  if (patch.image !== undefined) b.image = String(patch.image).trim()
  if (patch.link !== undefined) b.link = String(patch.link).trim()
  if (patch.placement !== undefined) b.placement = normPlacement(patch.placement)
  if (patch.active !== undefined) b.active = !!patch.active
  save(db)
  return b
}

export function deleteBanner(bannerId: string): void {
  const db = load()
  db.banners = db.banners.filter(x => x.id !== bannerId)
  save(db)
}

export function trackClick(bannerId: string): void {
  const db = load()
  const b = db.banners.find(x => x.id === bannerId)
  if (b) { b.clicks = (b.clicks || 0) + 1; save(db) }
}
