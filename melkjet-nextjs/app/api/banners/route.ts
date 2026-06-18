import { NextRequest, NextResponse } from 'next/server'
import { listActive, trackClick, Placement } from '@/app/lib/banner-store'

const PLACEMENTS: Placement[] = ['home', 'search', 'sidebar', 'article']

// PUBLIC: GET ?placement= → active banners (minimal public fields)
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams.get('placement')
  const placement = p && PLACEMENTS.includes(p as Placement) ? (p as Placement) : undefined
  const banners = listActive(placement).map(b => ({
    id: b.id,
    title: b.title,
    image: b.image,
    link: b.link,
  }))
  return NextResponse.json({ banners })
}

// PUBLIC: POST { id } → track a click
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  trackClick(String(b.id))
  return NextResponse.json({ ok: true })
}
