import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

// فاز ۱۴۱ — شناسهٔ Google Analytics 4 (G-…): تگِ gtag با این شناسه در <head> همهٔ صفحات می‌نشیند.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = getAdminData().ga4Id || ''
  return NextResponse.json({ configured: !!id, ga4Id: id })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { ga4Id } = await req.json()
  const clean = String(ga4Id || '').trim()
  if (clean && !/^G-[A-Z0-9]{4,20}$/i.test(clean)) return NextResponse.json({ error: 'شناسه باید به شکلِ G-XXXXXXXXXX باشد' }, { status: 400 })
  const data = getAdminData()
  data.ga4Id = clean
  saveAdminData(data)
  return NextResponse.json({ ok: true, ga4Id: clean })
}
