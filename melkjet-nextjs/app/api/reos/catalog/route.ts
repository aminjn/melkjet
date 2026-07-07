import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { modelCatalog } from '@/app/lib/reos/model-catalog'

// GET /api/reos/catalog — فهرستِ مدل‌های REOS + وضعیتِ واقعی (Model Marketplace).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, models: await modelCatalog() }, { headers: { 'Cache-Control': 'no-store, private' } })
}
