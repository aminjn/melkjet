import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listCategories, addCategory } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ categories: listCategories() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { name } = await req.json()
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'نام دسته الزامی است' }, { status: 400 })
  return NextResponse.json({ ok: true, categories: addCategory(String(name).slice(0, 40)) })
}
