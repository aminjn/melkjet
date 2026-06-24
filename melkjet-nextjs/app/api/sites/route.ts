import { NextRequest, NextResponse } from 'next/server'
import { getSite, saveSite } from '@/app/lib/sites-store'
import { getSession } from '@/app/lib/session'

// Persistent published-site store. Reads are open; writes require a logged-in session.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'slug خالی است' }, { status: 400 })
  const site = getSite(slug)
  if (!site) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ site })
}

// Normalise an incoming block to { id, type, props } (tolerating legacy `heading`).
function normIncomingBlock(b: { id: number; type: string; props?: Record<string, unknown>; heading?: string }) {
  return {
    id: Number(b.id),
    type: String(b.type || ''),
    props: (b.props && typeof b.props === 'object')
      ? b.props
      : (typeof b.heading === 'string' ? { heading: b.heading } : {}),
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  // Pages: prefer body.pages; fall back to a legacy single body.blocks array.
  let pages: { slug?: string; title?: string; blocks: any[] }[] | undefined
  if (Array.isArray(body.pages)) {
    pages = body.pages.map((pg: { slug?: string; title?: string; blocks?: any[] }) => ({
      slug: pg.slug ? String(pg.slug) : undefined,
      title: pg.title ? String(pg.title) : undefined,
      blocks: Array.isArray(pg.blocks) ? pg.blocks.map(normIncomingBlock) : [],
    }))
  } else if (Array.isArray(body.blocks)) {
    pages = [{ slug: 'home', title: body.title ? String(body.title) : undefined, blocks: body.blocks.map(normIncomingBlock) }]
  }

  const theme = body.theme && typeof body.theme === 'object'
    ? { primary: String(body.theme.primary || ''), font: body.theme.font ? String(body.theme.font) : undefined }
    : undefined

  const site = saveSite({
    slug: body.slug ? String(body.slug) : undefined,
    title: String(body.title || ''),
    owner: session.phone,
    ownerName: body.ownerName !== undefined ? String(body.ownerName) : undefined,
    pages,
    seo: {
      title: String(body.seo?.title || ''),
      description: String(body.seo?.description || ''),
    },
    theme,
  })
  return NextResponse.json({ ok: true, slug: site.slug, url: '/' + site.slug })
}
