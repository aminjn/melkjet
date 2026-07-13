import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { fetchDivarProfileTokens } from '@/app/lib/divar-post'
import { getAdminData } from '@/app/lib/admin-store'

// تشخیصِ دقیقِ دسترسیِ اپ به دیوار — همان کدی که ایمپورت استفاده می‌کند را اجرا می‌کند و نتیجهٔ خام را برمی‌گرداند.
// فقط سوپرادمین. استفاده: /api/admin/divar-test?slug=ENFJqAgo
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).length > 0)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const slug = (new URL(req.url).searchParams.get('slug') || 'ENFJqAgo').trim()
  const proxyUrl = getAdminData().divar?.proxyUrl || '(در ادمین تنظیم نشده)'
  const t0 = Date.now()
  try {
    const r = await fetchDivarProfileTokens(slug)
    return NextResponse.json({
      ok: true, proxyUrlSeenByApp: proxyUrl, slug,
      postsFound: r.posts.length, brandName: r.name || null, reason: r.reason || null,
      ms: Date.now() - t0,
      verdict: r.posts.length > 0 ? '✓ اپ به دیوار وصل شد و آگهی‌ها را خواند — اگر پنل خطا نشان می‌دهد، خطای قدیمی است؛ دوباره اسکرپ کنید.'
        : r.reason === 'unreachable' ? '✗ proxiedRequest اجرا نشد — proxyUrlSeenByApp را بررسی کنید (خالی/غلط؟).'
          : `✗ دیوار پاسخِ غیرِ۲۰۰ داد: ${r.reason}`,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, proxyUrlSeenByApp: proxyUrl, slug, error: e?.message || 'خطا', ms: Date.now() - t0 })
  }
}
