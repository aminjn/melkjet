import { NextRequest, NextResponse } from 'next/server'
import { listCategories, CategoryType } from '@/app/lib/category-store'

const TYPES: CategoryType[] = ['article', 'listing', 'directory', 'product']

// PUBLIC — no auth. Returns just category names for use in editors/forms.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('type')
  if (!TYPES.includes(t as CategoryType)) return NextResponse.json({ categories: [] })
  return NextResponse.json({ categories: listCategories(t as CategoryType).map(c => c.name) })
}
