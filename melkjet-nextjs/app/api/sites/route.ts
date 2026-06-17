import { NextRequest, NextResponse } from 'next/server'
import { getSite, saveSite, type SiteBlock } from '@/app/lib/sites-store'
import { getSession } from '@/app/lib/session'

// Persistent published-site store. Reads are open; writes require a logged-in session.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'slug خالی است' }, { status: 400 })
  const site = getSite(slug)
  if (!site) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ site })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const blocks: SiteBlock[] = Array.isArray(body.blocks)
    ? body.blocks.map((b: { id: number; type: string; heading: string }) => ({
        id: Number(b.id),
        type: String(b.type || ''),
        heading: String(b.heading || ''),
      }))
    : []
  const site = saveSite({
    slug: body.slug ? String(body.slug) : undefined,
    title: String(body.title || ''),
    blocks,
    seo: {
      title: String(body.seo?.title || ''),
      description: String(body.seo?.description || ''),
    },
  })
  return NextResponse.json({ ok: true, slug: site.slug, url: '/' + site.slug })
}
