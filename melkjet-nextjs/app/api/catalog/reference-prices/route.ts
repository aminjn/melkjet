import { NextRequest, NextResponse } from 'next/server'
import { referencePriceIndex } from '@/app/lib/catalog-store'

export const dynamic = 'force-dynamic'

// نرخِ مرجعِ کالاها (از دادهٔ اسکرپ‌شده) — قیمت + روند + اسپارک‌لاین، همه به تومان.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const data = referencePriceIndex({ category: u.get('category') || undefined, search: u.get('search') || undefined })
  return NextResponse.json({ ok: true, ...data })
}
