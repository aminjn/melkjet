import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listCategories, addCategory, renameCategory, deleteCategory, CategoryType } from '@/app/lib/category-store'

const TYPES: CategoryType[] = ['article', 'listing', 'directory', 'product']

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
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
  const { type, name } = await req.json()
  const t = parseType(type)
  if (!t) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'نام دسته الزامی است' }, { status: 400 })
  addCategory(t, String(name))
  return NextResponse.json({ categories: listCategories(t) })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { type, id, name } = await req.json()
  const t = parseType(type)
  if (!t) return NextResponse.json({ error: 'نوع نامعتبر است' }, { status: 400 })
  if (!id) return NextResponse.json({ error: 'شناسهٔ دسته الزامی است' }, { status: 400 })
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'نام دسته الزامی است' }, { status: 400 })
  const cat = renameCategory(t, String(id), String(name))
  if (!cat) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })
  return NextResponse.json({ categories: listCategories(t) })
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
