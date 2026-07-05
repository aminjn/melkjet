import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { scConfig, scConfigured, scTest, scPerformance, scSitemaps, scInspect } from '@/app/lib/search-console'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' ? s : null }

// وضعیتِ اتصال + خلاصهٔ پیکربندی (سبک — بدونِ صدازدنِ API).
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const c = scConfig()
  return NextResponse.json({
    ok: true, configured: scConfigured(),
    propertyUrl: c.propertyUrl || '', hasKey: !!c.serviceAccountJson, proxyUrl: c.proxyUrl || '',
  })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  const actor = (s as any).name || (s as any).phone || 'مدیر'

  if (b.action === 'save') {
    const data = getAdminData() as Record<string, any>
    data.seo = data.seo || {}
    const cur = data.seo.searchConsole || {}
    data.seo.searchConsole = {
      // اگر کلیدِ جدید نفرستاد، کلیدِ قبلی حفظ شود (تا در UI ماسک بماند).
      serviceAccountJson: (b.serviceAccountJson && String(b.serviceAccountJson).trim()) ? String(b.serviceAccountJson).trim() : cur.serviceAccountJson,
      propertyUrl: b.propertyUrl !== undefined ? String(b.propertyUrl).trim() : cur.propertyUrl,
      proxyUrl: b.proxyUrl !== undefined ? String(b.proxyUrl).trim() : cur.proxyUrl,
    }
    saveAdminData(data as any)
    logAudit(actor, 'تنظیماتِ Search Console', data.seo.searchConsole.propertyUrl || '')
    return NextResponse.json({ ok: true })
  }

  if (!scConfigured()) return NextResponse.json({ error: 'ابتدا کلیدِ سرویس‌اکانت و آدرسِ property را ذخیره کن' }, { status: 400 })

  if (b.action === 'test') return NextResponse.json(await scTest())
  if (b.action === 'performance') return NextResponse.json(await scPerformance(Number(b.days) || 28))
  if (b.action === 'sitemaps') return NextResponse.json(await scSitemaps())
  if (b.action === 'inspect') {
    if (!b.url) return NextResponse.json({ error: 'آدرس الزامی است' }, { status: 400 })
    return NextResponse.json(await scInspect(String(b.url)))
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
