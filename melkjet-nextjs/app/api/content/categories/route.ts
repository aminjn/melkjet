import { NextResponse } from 'next/server'
import { listCategories } from '@/app/lib/scraper-store'

// Public: directory category labels (built-ins + custom like بیمه/وکیل).
export async function GET() {
  return NextResponse.json({ categories: await listCategories() })
}
