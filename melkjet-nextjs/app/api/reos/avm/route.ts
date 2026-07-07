import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { valuate } from '@/app/lib/reos/avm'

// GET /api/reos/avm?propertyId=… — ارزش‌گذاریِ خودکار (AVM) با فایل‌های مشابه.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const propertyId = new URL(req.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'propertyId لازم است' }, { status: 400 })
  return NextResponse.json({ ok: true, avm: await valuate(propertyId) }, { headers: { 'Cache-Control': 'no-store, private' } })
}
