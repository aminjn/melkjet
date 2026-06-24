import { NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'

// کلیدِ نقشهٔ وب نشان (web.…) برای نقشهٔ تعاملیِ سمتِ کلاینت.
// این کلید عمومی است (محدود به دامنه) و فقط برای نمایشِ نقشه استفاده می‌شود.
export async function GET() {
  const nz = getAdminData().neshan
  const key = nz?.mapKey || ''
  return NextResponse.json({ key }, { headers: { 'Cache-Control': 'public, max-age=600' } })
}
