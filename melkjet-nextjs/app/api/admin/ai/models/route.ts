import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { FALLBACK_MODELS } from '@/app/lib/ai-agents'
import { listModels } from '@/app/lib/gapgpt'

// Returns the list of available model ids from GapGPT (OpenAI-compatible /models),
// tried directly then via the proxy. Falls back to a curated list on failure.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })

  if (!getAdminData().gapgpt?.apiKey) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'no_key' })
  try {
    const ids = await listModels()
    if (!ids.length) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'empty' })
    return NextResponse.json({ models: ids, source: 'live' })
  } catch (e: any) {
    return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: e?.message || 'error' })
  }
}
