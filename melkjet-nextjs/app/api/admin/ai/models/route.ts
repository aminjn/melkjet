import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { FALLBACK_MODELS, DEFAULT_GAP_BASE } from '@/app/lib/ai-agents'

// Returns the list of available model ids from GapGPT (OpenAI-compatible /models).
// Falls back to a curated list if the key is missing or the call fails.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })

  const g = getAdminData().gapgpt
  if (!g?.apiKey) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'no_key' })

  const base = (g.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, '')
  try {
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${g.apiKey}` },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: `http_${r.status}` })
    const d = await r.json()
    const ids: string[] = Array.isArray(d.data) ? d.data.map((m: any) => m.id).filter(Boolean) : []
    if (!ids.length) return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: 'empty' })
    ids.sort()
    return NextResponse.json({ models: ids, source: 'live' })
  } catch (e: any) {
    return NextResponse.json({ models: FALLBACK_MODELS, source: 'fallback', reason: e?.message || 'error' })
  }
}
