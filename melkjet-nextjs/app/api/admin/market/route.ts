import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { marketOverview } from '@/app/lib/market-stats'
import { platformStats } from '@/app/lib/platform-stats'

export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ...(await marketOverview()), platform: await platformStats() })
}
