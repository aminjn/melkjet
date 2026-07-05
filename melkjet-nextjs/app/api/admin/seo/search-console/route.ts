import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { scConfig, scConfigured, scTest, scPerformance, scSitemaps, scInspect, scDiagnose, parseServiceAccount } from '@/app/lib/search-console'
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
    // کلیدِ جدید (اگر فرستاده شد) قبل از ذخیره اعتبارسنجی می‌شود تا کلیدِ خراب ذخیره نشود.
    let keyToSave = cur.serviceAccountJson
    if (b.serviceAccountJson && String(b.serviceAccountJson).trim()) {
      const sa = parseServiceAccount(String(b.serviceAccountJson))
      if (!sa || !sa.client_email || !sa.private_key || !/BEGIN PRIVATE KEY/.test(sa.private_key)) {
        return NextResponse.json({ error: 'کلیدِ JSON نامعتبر است — کلِ محتوای فایلِ سرویس‌اکانت (شاملِ client_email و private_key) را کپی کن' }, { status: 400 })
      }
      keyToSave = String(b.serviceAccountJson).trim()
    }
    data.seo.searchConsole = {
      serviceAccountJson: keyToSave,
      propertyUrl: b.propertyUrl !== undefined ? String(b.propertyUrl).trim() : cur.propertyUrl,
      proxyUrl: b.proxyUrl !== undefined ? String(b.proxyUrl).trim() : cur.proxyUrl,
    }
    saveAdminData(data as any)
    logAudit(actor, 'تنظیماتِ Search Console', data.seo.searchConsole.propertyUrl || '')
    return NextResponse.json({ ok: true, email: parseServiceAccount(keyToSave || '')?.client_email || '' })
  }

  // عیب‌یابیِ اتصال (فقط شبکه) — بدونِ نیاز به کلید کار می‌کند.
  if (b.action === 'diagnose') return NextResponse.json({ ok: true, ...(await scDiagnose()) })

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
