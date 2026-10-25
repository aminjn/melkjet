import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { DEFAULT_GAP_BASE } from '@/app/lib/ai-agents'
import { AI_AREAS } from '@/app/lib/gapgpt'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

const mask = (k?: string) => (k ? '***' + k.slice(-4) : '')

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const d = getAdminData()
  const g = d.gapgpt
  const providers: Record<string, { label?: string; baseUrl: string; configured: boolean; masked: string }> = {}
  for (const [id, p] of Object.entries(d.providers || {})) {
    providers[id] = { label: p.label, baseUrl: p.baseUrl || '', configured: !!p.apiKey, masked: mask(p.apiKey) }
  }
  return NextResponse.json({
    baseUrl: g?.baseUrl || DEFAULT_GAP_BASE,
    configured: !!g?.apiKey,
    masked: mask(g?.apiKey),
    providers,
    aiEnabled: d.aiEnabled !== false,          // پیش‌فرض روشن
    aiAreas: d.aiAreas || {},                  // نبودِ کلید = روشن (مگر صریح false)
    areaList: AI_AREAS,
    defaultModel: d.defaultModel || '',        // فاز ۳۲۵ — مدلِ پیش‌فرضِ سراسری (جای هاردکدِ gpt-4o-mini)
    defaultProvider: d.defaultProvider || '',
  })
}

// POST { baseUrl, apiKey }                              → ارائه‌دهندهٔ پیش‌فرض (گپ)
// POST { providerId, label?, baseUrl, apiKey }          → یک ارائه‌دهندهٔ نامدار (مثل aval)
// POST { removeProvider: '<id>' }                       → حذفِ یک ارائه‌دهنده
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()

  // فاز ۳۲۵ — مدلِ پیش‌فرضِ سراسری: جای هاردکدِ gpt-4o-mini در همهٔ fallbackها.
  if ('defaultModel' in b || 'defaultProvider' in b) {
    if ('defaultModel' in b) data.defaultModel = String(b.defaultModel || '').trim()
    if ('defaultProvider' in b) data.defaultProvider = String(b.defaultProvider || '').trim()
    saveAdminData(data)
    return NextResponse.json({ ok: true, defaultModel: data.defaultModel || '', defaultProvider: data.defaultProvider || '' })
  }

  // سوییچِ اتصال به AI (ماستر + per-area). فقط وقتی در بدنه آمده تغییر می‌دهد.
  if (typeof b.aiEnabled === 'boolean' || (b.aiAreas && typeof b.aiAreas === 'object')) {
    if (typeof b.aiEnabled === 'boolean') data.aiEnabled = b.aiEnabled
    if (b.aiAreas && typeof b.aiAreas === 'object') {
      const clean: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(b.aiAreas)) clean[String(k).slice(0, 40)] = v !== false
      data.aiAreas = clean
    }
    saveAdminData(data)
    return NextResponse.json({ ok: true, aiEnabled: data.aiEnabled !== false, aiAreas: data.aiAreas || {} })
  }

  if (b.removeProvider) {
    if (data.providers) { delete data.providers[String(b.removeProvider)]; saveAdminData(data) }
    return NextResponse.json({ ok: true })
  }

  const providerId = b.providerId ? String(b.providerId).trim() : ''
  if (providerId) {
    data.providers = data.providers || {}
    const cur = data.providers[providerId]
    data.providers[providerId] = {
      label: b.label != null ? String(b.label) : cur?.label,
      baseUrl: (b.baseUrl && String(b.baseUrl).trim()) || cur?.baseUrl || DEFAULT_GAP_BASE,
      apiKey: b.apiKey && String(b.apiKey).trim() ? String(b.apiKey).trim() : (cur?.apiKey || ''),
    }
    saveAdminData(data)
    return NextResponse.json({ ok: true })
  }

  data.gapgpt = {
    baseUrl: (b.baseUrl && String(b.baseUrl).trim()) || DEFAULT_GAP_BASE,
    apiKey: b.apiKey && String(b.apiKey).trim() ? String(b.apiKey).trim() : (data.gapgpt?.apiKey || ''),
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
