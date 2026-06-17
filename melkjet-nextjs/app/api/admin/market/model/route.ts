import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { buildModel } from '@/app/lib/market-data'

// "Train"/refresh the market model from the current dataset and return it.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json(buildModel())
}
