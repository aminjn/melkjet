import { NextRequest, NextResponse } from 'next/server'
import { requireModule, requireQuota } from '@/app/lib/plan-gate'
import { getSite, getSiteByOwner, saveSite } from '@/app/lib/sites-store'
import { getSession } from '@/app/lib/session'

// Persistent published-site store. Reads are open; writes require a logged-in session.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  // «سایتِ من»: سایتِ ذخیره‌شدهٔ خودِ کاربر (بر اساسِ session)، مستقل از slug.
  if (sp.get('mine')) {
    const s = await getSession()
    if (!s) return NextResponse.json({ site: null }, { status: 200 })
    const site = await getSiteByOwner(s.phone)
    return NextResponse.json({ site: site || null })
  }
  const slug = sp.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'slug خالی است' }, { status: 400 })
  const site = await getSite(slug)
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
  { const pg51 = requireModule(session as any, 'website'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const body = await req.json().catch(() => ({}))

  // Pages: prefer body.pages; fall back to a legacy single body.blocks array.
  let pages: { slug?: string; title?: string; blocks: any[]; inMenu?: boolean; menuLabel?: string }[] | undefined
  if (Array.isArray(body.pages)) {
    pages = body.pages.map((pg: { slug?: string; title?: string; blocks?: any[]; inMenu?: boolean; menuLabel?: string }) => ({
      slug: pg.slug ? String(pg.slug) : undefined,
      title: pg.title ? String(pg.title) : undefined,
      inMenu: pg.inMenu !== false,
      menuLabel: pg.menuLabel ? String(pg.menuLabel) : undefined,
      blocks: Array.isArray(pg.blocks) ? pg.blocks.map(normIncomingBlock) : [],
    }))
  } else if (Array.isArray(body.blocks)) {
    pages = [{ slug: 'home', title: body.title ? String(body.title) : undefined, blocks: body.blocks.map(normIncomingBlock) }]
  }

  const theme = body.theme && typeof body.theme === 'object'
    ? { primary: String(body.theme.primary || ''), font: body.theme.font ? String(body.theme.font) : undefined }
    : undefined

  { const q52 = requireQuota(session as any, 'sitePages', 0, (pages?.length || 1)); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
  const site = await saveSite({
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
