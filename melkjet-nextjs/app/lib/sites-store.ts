import { readFileSync, writeFileSync, existsSync } from './fs-atomic'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvSet, kvMutate, kvGetPrefix, kvDelete } from './db'

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

// ─── فاز ۲۹۷ — شاردِ سایت‌ها: «هر سایت ردیفِ خودش» (درسِ رُستر/اسکرپر، این‌بار پیشگیرانه) ───
// سایت‌سازِ خودکار یعنی هزاران سایت؛ بلابِ واحد با هر ساخت/ویرایش کلِ چندمگابایت را زیرِ
// FOR UPDATE بازنویسی می‌کرد — همان الگویی که دو بار استخرِ PG را خشکاند. حالا:
//   site:{slug}  ← سندِ کاملِ هر سایت (خواندنِ صفحه = یک ردیفِ کوچک)
//   sites_idx    ← فهرستِ سبک: slug → {o:مالک, u:updatedAt, t:عنوان, c:createdAt}
// تخصیصِ slug و نگاشتِ مالک زیرِ قفلِ همین ایندکسِ کوچک اتمیک می‌شود؛ مهاجرتِ تنبل از
// بلابِ قدیمی با «کپی فقط اگر غایب» (ضدِ مسابقه)؛ بلابِ قدیمی پشتیبانِ دست‌نخورده می‌ماند.
// حالتِ فایل (تست/dev) همان مسیرِ قدیمی است.
const ROW = (slug: string) => 'site:' + slug
const IDX_KV = 'sites_idx'
const MIG_KV = 'sites_shard_meta'
export interface SiteHead { slug: string; owner: string; updatedAt: number; title: string; createdAt: number }
interface IdxDoc { m: Record<string, { o?: string; u: number; t: string; c: number }> }

let shardReady: Promise<void> | null = null
async function ensureSitesSharded(): Promise<void> {
  if (!pgEnabled()) return
  if (!shardReady) shardReady = (async () => {
    const meta = await kvGet<{ migratedAt?: number }>(MIG_KV, {})
    if (meta.migratedAt) return
    const legacy = await kvGet<DB>(KV_KEY, { sites: [] })
    for (const raw of legacy.sites || []) {
      const slug = String(raw?.slug || ''); if (!slug) continue
      const cur = await kvGet<Site | null>(ROW(slug), null)
      if (!cur) await kvSet(ROW(slug), raw)
    }
    await kvMutate<IdxDoc, void>(IDX_KV, { m: {} }, idx => {
      idx.m = idx.m || {}
      for (const raw of legacy.sites || []) {
        const slug = String(raw?.slug || ''); if (!slug || idx.m[slug]) continue
        idx.m[slug] = { o: raw.owner ? String(raw.owner) : undefined, u: Number(raw.updatedAt) || Date.now(), t: String(raw.title || ''), c: Number(raw.createdAt) || Date.now() }
      }
    })
    await kvSet(MIG_KV, { migratedAt: Date.now(), n: (legacy.sites || []).length })
    console.log(`[sites] shard migration: ${(legacy.sites || []).length} سایت به ردیف‌های مستقل منتقل شد`)
  })().catch(e => { shardReady = null; throw e })
  return shardReady
}

/** فهرستِ سبکِ همهٔ سایت‌ها (یک خواندنِ کوچک) — برای جارو/سایت‌مپ/پنل؛ نه سندهای کامل. */
export async function listSiteHeads(): Promise<SiteHead[]> {
  if (!pgEnabled()) return fileLoad().sites.map(s => ({ slug: s.slug, owner: String(s.owner || ''), updatedAt: Number(s.updatedAt) || 0, title: String(s.title || ''), createdAt: Number(s.createdAt) || 0 }))
  await ensureSitesSharded()
  const idx = await kvGet<IdxDoc>(IDX_KV, { m: {} })
  return Object.entries(idx.m || {}).map(([slug, e]) => ({ slug, owner: e.o || '', updatedAt: e.u || 0, title: e.t || '', createdAt: e.c || 0 }))
}

// فاز ۲۹۸ه — حذفِ همهٔ سایت‌های یک مالک (cascade حذفِ حساب). ریشهٔ باگِ «سایتِ سازنده بعد از
// حذفِ حساب یتیم ماند»: deleteAccount هیچ cascadeای نداشت و merge هم sites-store را پوشش نمی‌داد.
export async function deleteSitesByOwner(owner: string): Promise<number> {
  const o = String(owner || '').trim()
  if (!o) return 0
  if (!pgEnabled()) {
    return mutate(db => { const before = db.sites.length; db.sites = db.sites.filter(s => String(s.owner || '') !== o); return before - db.sites.length })
  }
  await ensureSitesSharded()
  const idx = await kvGet<IdxDoc>(IDX_KV, { m: {} })
  const slugs = Object.entries(idx.m || {}).filter(([, e]) => (e.o || '') === o).map(([slug]) => slug)
  for (const slug of slugs) { try { await kvDelete(ROW(slug)) } catch { /* ردیفِ بعدی */ } }
  if (slugs.length) await kvMutate<IdxDoc, void>(IDX_KV, { m: {} }, ix => { for (const slug of slugs) delete ix.m[slug] })
  return slugs.length
}

// Make a url-safe slug: lowercase, keep a-z0-9, Persian letters and dash.
// فاز ۲۹۶ — حروفِ فارسی مجازند: اسلاگِ سایتِ خودکار باید «نامِ خودِ شخص» باشد
// (melkjet.com/علی-رضایی) تا جست‌وجوی نامِ او در گوگل به همین صفحه برسد.
export function sanitizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[‌‏‎]/g, '-')   // نیم‌فاصله/نشانه‌های جهت → خط‌تیره
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9؀-ۿ-]/g, '')
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
  if (!pgEnabled()) return fileLoad().sites.map(migrateSite).sort((a, b) => b.updatedAt - a.updatedAt)
  // سنگین (همهٔ سندها) — فقط مصرفِ نادرِ ادمین/ابزار؛ مسیرهای داغ از listSiteHeads می‌خوانند.
  await ensureSitesSharded()
  const rows = await kvGetPrefix<Site>(ROW(''))
  return rows.map(r => migrateSite(r.data)).sort((a, b) => b.updatedAt - a.updatedAt)
}

// فاز ۲۹۶ج — پارامترِ مسیر در این نسخهٔ Next «درصد-کدشده» می‌رسد (مثلِ صفحهٔ وکلا که صریحاً
// decode می‌کند). بدونِ decode، اسلاگِ فارسی هرگز با نسخهٔ ذخیره‌شده match نمی‌شد → ۴۰۴ِ همگانی.
const safeDecode = (s: string): string => { try { return decodeURIComponent(String(s || '')) } catch { return String(s || '') } }

export async function getSite(slug: string): Promise<Site | null> {
  const s = sanitizeSlug(safeDecode(slug))
  if (!s) return null
  if (!pgEnabled()) {
    const site = fileLoad().sites.find(site => site.slug === s) ?? null
    return site ? migrateSite(site) : null
  }
  await ensureSitesSharded()
  const row = await kvGet<Site | null>(ROW(s), null)
  return row ? migrateSite(row) : null
}

// سایتِ متعلق به یک مالک (شمارهٔ حساب) — تازه‌ترین. برای «سایتِ من» در سایت‌ساز که باید
// مستقل از slug، همان سایتِ ذخیره‌شدهٔ کاربر را برگرداند (نه قالبِ پیش‌فرض).
export async function getSiteByOwner(owner: string): Promise<Site | null> {
  const o = String(owner || '').trim(); if (!o) return null
  if (!pgEnabled()) {
    const mine = fileLoad().sites.filter(s => String(s.owner || '') === o)
    if (!mine.length) return null
    mine.sort((a, b) => (Number((b as any).updatedAt || (b as any).createdAt || 0)) - (Number((a as any).updatedAt || (a as any).createdAt || 0)))
    return migrateSite(mine[0])
  }
  // ایندکسِ سبک → یک ردیف؛ تازه‌ترین سایتِ مالک.
  const heads = (await listSiteHeads()).filter(h => h.owner === o).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
  if (!heads.length) return null
  return getSite(heads[0].slug)
}

// Find a page within a site by slug; falls back to the home page (pages[0]).
export function getSitePage(site: Site, pageSlug: string): SitePage {
  const want = sanitizeSlug(safeDecode(pageSlug))
  return site.pages.find(p => p.slug === want) || site.pages[0]
}

interface SavePageInput { slug?: string; title?: string; blocks?: any[]; inMenu?: boolean; menuLabel?: string }

export interface SaveSiteInput {
  slug?: string
  title: string
  owner?: string
  ownerName?: string
  pages?: SavePageInput[]
  // legacy single-page input
  blocks?: SiteBlock[]
  seo?: Partial<SiteSeo>
  theme?: Partial<SiteTheme>
}

// بدنهٔ سندِ سایت از ورودی + سندِ قبلی — مشترک بینِ مسیرِ فایل و PGِ شاردشده.
function buildSiteDoc(input: SaveSiteInput, slug: string, existing: Site | null | undefined): Site {
  const now = Date.now()
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
  if (!pages.length) {
    pages.push({ slug: 'home', title: String(input.title || '').trim() || 'خانه', blocks: [] })
  }

  return {
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
}

export async function saveSite(input: SaveSiteInput): Promise<Site> {
  const owner = input.owner ? String(input.owner) : undefined

  if (!pgEnabled()) {
    // مسیرِ فایل (تست/dev) — همان منطقِ قدیمی روی آرایه.
    return mutate((db) => {
      let slug = sanitizeSlug(input.slug || '')
      let existing: Site | undefined
      if (owner) {
        const mineExisting = db.sites.find(s => String(s.owner || '') === owner)
        if (mineExisting) { slug = mineExisting.slug; existing = mineExisting }
        else {
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
      const site = buildSiteDoc(input, slug, existing)
      if (existing) { const i = db.sites.findIndex(s => s.slug === slug); db.sites[i] = site }
      else db.sites.unshift(site)
      return site
    })
  }

  // ─── PG شاردشده (فاز ۲۹۷): تخصیصِ slug زیرِ قفلِ ایندکسِ «کوچک»، سند در ردیفِ خودش ───
  await ensureSitesSharded()
  const res = await kvMutate<IdxDoc, { slug: string; existed: boolean }>(IDX_KV, { m: {} }, idx => {
    idx.m = idx.m || {}
    let slug = sanitizeSlug(input.slug || '')
    let existed = false
    if (owner) {
      // سایتِ خودش را در جا آپدیت کن (مستقل از slugِ ارسالی) — هرگز سایتِ دیگری را رونویسی نکن.
      const mine = Object.entries(idx.m).filter(([, e]) => e.o === owner)
        .sort((a, b) => ((b[1].u || b[1].c) - (a[1].u || a[1].c)))
      if (mine.length) { slug = mine[0][0]; existed = true }
      else {
        const taken = slug ? idx.m[slug] : undefined
        if (!slug || (taken && taken.o !== owner)) {
          const base = sanitizeSlug(input.ownerName || input.title || slug || 'site') || 'site'
          let cand = base, n = 2
          while (idx.m[cand]) cand = `${base}-${n++}`
          slug = cand
        }
        existed = !!idx.m[slug]
      }
    } else {
      if (!slug) slug = sanitizeSlug(input.title || '') || randomSlug()
      existed = !!idx.m[slug]
    }
    const now = Date.now()
    const prev = idx.m[slug]
    idx.m[slug] = { o: owner ?? prev?.o, u: now, t: String(input.title || '').trim() || prev?.t || '', c: prev?.c || now }
    return { slug, existed }
  })
  const prevRow = res.existed ? await kvGet<Site | null>(ROW(res.slug), null) : null
  const site = buildSiteDoc(input, res.slug, prevRow ? migrateSite(prevRow) : undefined)
  await kvSet(ROW(res.slug), site)
  return site
}

/** فاز ۳۳۹ب — پیش‌نمایشِ زندهٔ ویرایشگر: پیش‌نویسِ ذخیره‌نشده با «همان» نرمال‌سازیِ ذخیره به سندِ Site تبدیل
 *  می‌شود تا موتورِ رندرِ سایتِ منتشرشده عیناً همان را نشان دهد (بدونِ نوشتن در انبارِ سایت‌ها). */
export function buildPreviewSite(input: SaveSiteInput, slug: string): Site {
  return buildSiteDoc(input, sanitizeSlug(slug || '') || 'preview', null)
}
