import type { Metadata } from 'next'
import { getSession } from '@/app/lib/session'
import { getDraft } from '@/app/lib/site-draft-store'
import { buildPreviewSite, getSitePage } from '@/app/lib/sites-store'
import { SiteShell } from '../[site]/page'

// فاز ۳۳۹ب — «پیش‌نمایشِ واقعی»ِ ویرایشگر: پیش‌نویسِ ذخیره‌نشدهٔ کاربر با «همان» موتورِ سایتِ منتشرشده
// (SiteShell) رندر می‌شود. قبلاً ویرایشگر رندرکنندهٔ جدا و قدیمیِ خودش را داشت و کاربر هنگامِ ویرایش ظاهری
// متفاوت از سایتِ نهایی می‌دید. این مسیرِ ایستا بر [site]ِ پویا مقدم است؛ ایندکس نمی‌شود.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'پیش‌نمایش سایت', robots: { index: false, follow: false } }

export default async function SitePreviewPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const s = await getSession()
  const msg = (t: string) => <div dir="rtl" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Vazirmatn, Tahoma, sans-serif', color: '#777', fontSize: 15, padding: 24, textAlign: 'center' }}>{t}</div>
  if (!s) return msg('برای دیدنِ پیش‌نمایش وارد شوید.')
  const d = await getDraft(s.phone)
  if (!d) return msg('هنوز پیش‌نویسی برای پیش‌نمایش ارسال نشده است.')
  const sp = await searchParams
  const want = String((Array.isArray(sp.page) ? sp.page[0] : sp.page) || 'home')
  const site = buildPreviewSite(d.input, d.slug)
  const page = getSitePage(site, want)
  return <SiteShell site={site} page={page} preview />
}
