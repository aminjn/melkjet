import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { addArticle, updateArticle, listArticles, deleteItem } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// GET → { articles }
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ articles: listArticles() })
}

// POST { title, body, image?, category? } → create article
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const title = (b.title || '').toString().trim()
  const body = (b.body || '').toString().trim()
  if (!title || !body) return NextResponse.json({ error: 'عنوان و متن الزامی است' }, { status: 400 })
  const item = addArticle({
    title,
    body,
    image: b.image ? String(b.image) : undefined,
    category: b.category ? String(b.category) : undefined,
    source: b.source ? String(b.source) : undefined,
  })
  return NextResponse.json({ ok: true, id: item.id, item })
}

// PATCH { id, title?, body?, image?, category? } → update article
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const it = updateArticle(String(b.id), {
    title: b.title !== undefined ? String(b.title) : undefined,
    body: b.body !== undefined ? String(b.body) : undefined,
    image: b.image !== undefined ? String(b.image) : undefined,
    category: b.category !== undefined ? String(b.category) : undefined,
  })
  if (!it) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, item: it })
}

// DELETE ?id=xxx → delete article
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deleteItem(id)
  return NextResponse.json({ ok: true })
}
