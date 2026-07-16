import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listBanners,
  addBanner,
  updateBanner,
  deleteBanner,
  Placement,
} from '@/app/lib/banner-store'

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ banners: listBanners() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.title || !String(b.title).trim() || !b.image || !String(b.image).trim()) {
    return NextResponse.json({ error: 'عنوان و تصویر الزامی است' }, { status: 400 })
  }
  const banner = addBanner({
    title: String(b.title),
    image: String(b.image),
    link: b.link ? String(b.link) : '',
    placement: b.placement as Placement | undefined,
    active: b.active,
    articleCategory: b.articleCategory,   // فاز ۱۵۰: هدف‌گیریِ دسته/تک‌مقاله (خالی = همه‌جا)
    articleSlug: b.articleSlug,
  })
  return NextResponse.json({ banner })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const { id, ...patch } = b
  const banner = updateBanner(id, patch)
  if (!banner) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ banner })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deleteBanner(id)
  return NextResponse.json({ ok: true })
}
