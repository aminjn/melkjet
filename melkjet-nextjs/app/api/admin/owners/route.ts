import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listOwners } from '@/app/lib/scraper-store'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ owners: listOwners() })
}
