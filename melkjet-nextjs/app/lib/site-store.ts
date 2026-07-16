import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SITE, type SiteConfig, type SitePage, type SiteFooter, type SiteContact } from './site-defaults'

// فاز ۹۸ — استورِ تنظیماتِ سایت (فوتر + صفحات عمومی). فایل‌محور مثل banner-store:
// config کم‌تغییر و تک‌نویسنده (سوپرادمین) است؛ نیازی به PG ندارد.
const DATA_FILE = join(process.cwd(), '.site-data.json')

function load(): Partial<SiteConfig> {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch { /* فایل خراب → پیش‌فرض */ }
  }
  return {}
}

function save(db: SiteConfig) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

/** پیکربندیِ کامل — ذخیره‌شده روی پیش‌فرض‌ها merge می‌شود تا فیلد/صفحهٔ جدیدِ
 *  نسخه‌های بعدی هیچ‌وقت گم نشود (صفحه‌های سیستمیِ جاافتاده اضافه می‌شوند). */
export function siteConfig(): SiteConfig {
  const raw = load()
  const footer: SiteFooter = { ...DEFAULT_SITE.footer, ...(raw.footer || {}) }
  if (!Array.isArray(footer.cols) || !footer.cols.length) footer.cols = DEFAULT_SITE.footer.cols
  const contact: SiteContact = { ...DEFAULT_SITE.contact, ...(raw.contact || {}) }
  const blog = { ...DEFAULT_SITE.blog, ...((raw as Partial<SiteConfig>).blog || {}) }
  const pages: SitePage[] = Array.isArray(raw.pages) && raw.pages.length ? raw.pages.slice() : DEFAULT_SITE.pages.slice()
  for (const def of DEFAULT_SITE.pages) {
    if (!pages.some(p => p.slug === def.slug)) pages.push({ ...def })
  }
  return { footer, contact, pages, blog }
}

export function pageOf(slug: string): SitePage | null {
  const p = siteConfig().pages.find(x => x.slug === slug)
  return p && p.show !== false ? p : null
}

const SLUG_RE = /^[a-z0-9-]{2,60}$/
// اسلاگ‌هایی که مسیرِ واقعیِ خودشان را دارند — صفحهٔ سفارشی نمی‌تواند رویشان بنشیند
const RESERVED = new Set(['about', 'terms', 'privacy', 'faq', 'contact', 'search', 'blog', 'store', 'pricing', 'admin', 'api', 'auth', 'empire', 'page'])

export function saveSiteConfig(patch: { footer?: Partial<SiteFooter>; contact?: Partial<SiteContact>; blog?: Partial<SiteConfig['blog']> }): SiteConfig {
  const cur = siteConfig()
  if (patch.footer) cur.footer = { ...cur.footer, ...patch.footer }
  if (patch.contact) cur.contact = { ...cur.contact, ...patch.contact }
  if (patch.blog) cur.blog = { ...cur.blog, ...patch.blog }   // فاز ۱۵۰: knobهای صفحهٔ مقاله
  save(cur)
  return cur
}

export function upsertPage(p: { slug: string; title: string; body: string; show?: boolean }): { ok: true; cfg: SiteConfig } | { ok: false; error: string } {
  const slug = String(p.slug || '').trim().toLowerCase()
  const cur = siteConfig()
  const ex = cur.pages.find(x => x.slug === slug)
  if (!ex) {
    if (!SLUG_RE.test(slug)) return { ok: false, error: 'اسلاگ فقط حروف انگلیسی کوچک، رقم و خط تیره (۲ تا ۶۰ کاراکتر)' }
    if (RESERVED.has(slug)) return { ok: false, error: 'این اسلاگ رزرو است — یک نام دیگر انتخاب کن' }
  }
  if (!String(p.title || '').trim()) return { ok: false, error: 'عنوان الزامی است' }
  if (ex) {
    ex.title = String(p.title); ex.body = String(p.body ?? ex.body)
    if (p.show !== undefined) ex.show = !!p.show
  } else {
    cur.pages.push({ slug, title: String(p.title), body: String(p.body || ''), show: p.show !== false })
  }
  save(cur)
  return { ok: true, cfg: cur }
}

export function deletePage(slug: string): { ok: true; cfg: SiteConfig } | { ok: false; error: string } {
  const cur = siteConfig()
  const ex = cur.pages.find(x => x.slug === slug)
  if (!ex) return { ok: false, error: 'صفحه پیدا نشد' }
  if (ex.system) return { ok: false, error: 'صفحه‌های سیستمی حذف نمی‌شوند (می‌توانی «نمایش» را خاموش کنی)' }
  cur.pages = cur.pages.filter(x => x.slug !== slug)
  save(cur)
  return { ok: true, cfg: cur }
}
