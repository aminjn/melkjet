import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAudit } from '@/app/lib/audit-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ entries: listAudit(200) })
}
