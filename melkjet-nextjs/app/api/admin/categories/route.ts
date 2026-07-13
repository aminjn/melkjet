import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listCategories, addCategory, updateCategory, deleteCategory, CategoryType } from '@/app/lib/category-store'

const TYPES: CategoryType[] = ['article', 'listing', 'directory', 'product']

async function guard() {
  const s = await getSession()
  return s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}

function parseType(t: unknown): CategoryType | null {
  return TYPES.includes(t as CategoryType) ? (t as CategoryType) : null
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const type = parseType(req.nextUrl.searchParams.get('type'))
  if (!type) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  return NextResponse.json({ categories: listCategories(type) })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { type, name, slug, parentId } = await req.json()
  const t = parseType(type)
  if (!t) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'نام دسته الزامی است' }, { status: 400 })
  const cat = addCategory(t, String(name), {
    slug: slug ? String(slug) : undefined,
    parentId: parentId ? String(parentId) : undefined,
  })
  return NextResponse.json({ ok: true, category: cat, categories: listCategories(t) })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { type, id, name, slug, parentId } = await req.json()
  const t = parseType(type)
  if (!t) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  if (!id) return NextResponse.json({ error: 'شناسهٔ دسته الزامی است' }, { status: 400 })
  const cat = updateCategory(t, String(id), {
    ...(name !== undefined ? { name: String(name) } : {}),
    ...(slug !== undefined ? { slug: String(slug) } : {}),
    ...(parentId !== undefined ? { parentId: parentId ? String(parentId) : null } : {}),
  })
  if (!cat) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, category: cat, categories: listCategories(t) })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const type = parseType(req.nextUrl.searchParams.get('type'))
  const id = req.nextUrl.searchParams.get('id')
  if (!type) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  if (!id) return NextResponse.json({ error: 'شناسهٔ دسته الزامی است' }, { status: 400 })
  deleteCategory(type, id)
  return NextResponse.json({ categories: listCategories(type) })
}
