import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { fetchDivarProfileTokens } from '@/app/lib/divar-post'
import { getAdminData } from '@/app/lib/admin-store'
import { divarProxies, divarProxyStatus } from '@/app/lib/divar-proxy-pool'

// تشخیصِ دقیقِ دسترسیِ اپ به دیوار — همان کدی که ایمپورت استفاده می‌کند را اجرا می‌کند و نتیجهٔ خام را برمی‌گرداند.
// فقط سوپرادمین. استفاده: /api/admin/divar-test?slug=ENFJqAgo
const maskProxy = (u: string) => u.replace(/\/\/([^@/]+)@/, '//***@')   // یوزر/پسِ پروکسی لو نرود
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).length > 0)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const slug = (new URL(req.url).searchParams.get('slug') || 'ENFJqAgo').trim()
  // پروکسیِ «واقعی» که استخر استفاده می‌کند — نه فقط فیلدِ ادمین (env DIVAR_PROXIES/HTTPS_PROXY اولویت دارد).
  const pool = divarProxies().map(maskProxy)
  const source = process.env.DIVAR_PROXIES ? 'env DIVAR_PROXIES'
    : getAdminData().divar?.proxyPool ? 'admin divar.proxyPool'
      : getAdminData().divar?.proxyUrl ? 'admin «پروکسی دیوار»'
        : (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) ? 'env HTTPS_PROXY/HTTP_PROXY'
          : '(هیچ پروکسی‌ای پیکربندی نشده)'
  const t0 = Date.now()
  try {
    const r = await fetchDivarProfileTokens(slug)
    return NextResponse.json({
      ok: true, proxySource: source, proxiesConfigured: pool, proxyHealth: divarProxyStatus().proxies.map(p => ({ ...p, url: maskProxy(p.url) })), slug,
      postsFound: r.posts.length, brandName: r.name || null, reason: r.reason || null,
      ms: Date.now() - t0,
      verdict: r.posts.length > 0 ? '✓ اپ به دیوار وصل شد و آگهی‌ها را خواند — اگر پنل خطا نشان می‌دهد، خطای قدیمی است؛ دوباره اسکرپ کنید.'
        : r.reason === 'unreachable'
          ? (pool.length ? '✗ پروکسی پاسخ نداد (تونل/فیلترشکن روی سرور خاموش است یا منقضی شده) — پروکسی/‌v2ray را روی سرور بررسی/ری‌استارت کنید.' : '✗ هیچ پروکسی‌ای پیکربندی نشده و دیوار مستقیم فیلتر است — «پروکسی دیوار» یا DIVAR_PROXIES را تنظیم کنید.')
          : `✗ دیوار پاسخِ غیرِ۲۰۰ داد: ${r.reason}`,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, proxySource: source, proxiesConfigured: pool, slug, error: e?.message || 'خطا', ms: Date.now() - t0 })
  }
}
