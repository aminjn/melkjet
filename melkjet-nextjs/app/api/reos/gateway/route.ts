import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { usageStats } from '@/app/lib/reos/gateway'

// GET /api/reos/gateway — آمارِ مصرفِ AI (هزینه/توکن/کش/تأخیر به‌تفکیکِ مدل). فقط مدیر.
export async function GET() {
  const s = await getSession()
  if (!s || (s.role !== 'super_admin' && s.phone !== '09122862184')) return NextResponse.json({ error: 'دسترسی فقط برای مدیر' }, { status: 403 })
  return NextResponse.json({ ok: true, usage: await usageStats() }, { headers: { 'Cache-Control': 'no-store, private' } })
}
