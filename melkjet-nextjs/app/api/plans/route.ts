import { NextResponse } from 'next/server'
import { listActive } from '@/app/lib/plan-store'

// PUBLIC GET → { plans }  (active only, sorted by order)
export async function GET() {
  return NextResponse.json({ plans: listActive() })
}
