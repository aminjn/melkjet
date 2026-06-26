import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { FALLBACK_MODELS } from '@/app/lib/ai-agents'
import { listModels } from '@/app/lib/gapgpt'

// فهرستِ مدل‌های موجود از سرویسِ AI (سازگار با OpenAI /models). با ?provider=<id>
// مدل‌های یک ارائه‌دهندهٔ مشخص (مثل aval) را برمی‌گرداند؛ بدونِ آن، پیش‌فرض (گپ).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })

  const provider = new URL(req.url).searchParams.get('provider') || ''
  const data = getAdminData()
  const hasKey = provider && provider !== 'gap' ? !!data.providers?.[provider]?.apiKey : !!data.gapgpt?.apiKey
  if (!hasKey) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'no_key' })
  try {
    const ids = await listModels(provider || undefined)
    if (!ids.length) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'empty' })
    return NextResponse.json({ models: ids, source: 'live' })
  } catch (e: any) {
    return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: e?.message || 'error' })
  }
}
