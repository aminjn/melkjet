// فاز ۳۳۹ب — پیش‌نویسِ زندهٔ ویرایشگرِ سایت‌ساز (فقط برای پیش‌نمایشِ واقعی؛ سایتِ منتشرشده دست نمی‌خورد).
// هر کاربر یک ردیفِ کوچک: kv `site_draft:{phone}` در PG؛ بدونِ DATABASE_URL (dev/تست) در حافظهٔ همین پروسه.
import { pgEnabled, kvGet, kvSet } from './db'
import type { SaveSiteInput } from './sites-store'

export interface SiteDraft { input: SaveSiteInput; slug: string; at: number }
// حالتِ بی‌دیتابیس: Next مسیرِ API و صفحه را در بسته‌های جدا بارگذاری می‌کند؛ Mapِ ماژول‌سطح بینشان مشترک
// نیست (پیش‌نمایش «پیش‌نویسی نیست» می‌گفت). globalThis در یک پروسه بینِ همهٔ بسته‌ها یکی است.
const mem: Map<string, SiteDraft> = ((globalThis as any).__mjSiteDrafts ||= new Map<string, SiteDraft>())
const key = (owner: string) => `site_draft:${owner}`

export async function saveDraft(owner: string, d: SiteDraft): Promise<void> {
  if (pgEnabled()) await kvSet(key(owner), d)
  else mem.set(owner, d)
}
export async function getDraft(owner: string): Promise<SiteDraft | null> {
  if (pgEnabled()) return await kvGet<SiteDraft | null>(key(owner), null)
  return mem.get(owner) || null
}
