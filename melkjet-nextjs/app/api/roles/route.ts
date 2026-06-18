import { NextResponse } from 'next/server'
import { listRoles } from '@/app/lib/role-store'

// عمومی: نقش‌های فعال (برای آنبوردینگ ثبت‌نام)
export async function GET() {
  return NextResponse.json({ roles: listRoles(true).map(r => ({ id: r.id, name: r.name, dashboard: r.dashboard, planId: r.planId || '' })) })
}
