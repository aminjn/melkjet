import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { DEFAULT_GAP_BASE } from '@/app/lib/ai-agents'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
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
  })
}

// POST { baseUrl, apiKey }                              → ارائه‌دهندهٔ پیش‌فرض (گپ)
// POST { providerId, label?, baseUrl, apiKey }          → یک ارائه‌دهندهٔ نامدار (مثل aval)
// POST { removeProvider: '<id>' }                       → حذفِ یک ارائه‌دهنده
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()

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
