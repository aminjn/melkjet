import { NextResponse } from 'next/server'
import { listPublicRoles } from '@/app/lib/role-store'

// عمومی: نقش‌های فعال (برای آنبوردینگ ثبت‌نام)
export async function GET() {
  return NextResponse.json({ roles: listPublicRoles().map(r => ({ id: r.id, name: r.name, dashboard: r.dashboard, planId: r.planId || '' })) })   // فاز ۱۱۹: نقشِ کارمندان مخفی
}
