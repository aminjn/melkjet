import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/lib/session'
import { siteConfig, saveSiteConfig, upsertPage, deletePage } from '@/app/lib/site-store'

// فاز ۳۱۸ — تغییرِ هویتِ سایت (لوگو/هیرو/فوتر/صفحات) باید فوراً روی سایتِ ISRشده دیده شود.
// بدونِ این، صفحهٔ کش‌شده (revalidate=300 در app/page.tsx + layout) تا ۵ دقیقه عکسِ قدیمی را
// نشان می‌داد («عکس را عوض کردم ۱۰ دقیقه عوض نمی‌شود»). «layout» کلِ درخت (هدر/لوگو/فاوآیکون
// + همهٔ صفحه‌ها) را روی همین اینستنس باطل می‌کند. (چند اینستنسی: بقیه تا ۵ دقیقه خودکار تازه می‌شوند.)
function revalidateSite() { try { revalidatePath('/', 'layout') } catch { /* بی‌اثر در حالتِ dev/فایل */ } }

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ config: siteConfig() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const action = String(b.action || 'save')
  if (action === 'save') {
    const cfg = saveSiteConfig({ brand: b.brand, footer: b.footer, contact: b.contact, blog: b.blog })
    revalidateSite()
    return NextResponse.json({ ok: true, config: cfg })
  }
  if (action === 'page') {
    const r = upsertPage(b.page || {})
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    revalidateSite()
    return NextResponse.json({ ok: true, config: r.cfg })
  }
  if (action === 'deletePage') {
    const r = deletePage(String(b.slug || ''))
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    revalidateSite()
    return NextResponse.json({ ok: true, config: r.cfg })
  }
  return NextResponse.json({ error: 'اکشن ناشناخته' }, { status: 400 })
}
