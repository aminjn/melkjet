import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getProfileOptions, setProfileOptions } from '@/app/lib/profile-options-store'
import { logAudit } from '@/app/lib/audit-store'

// مدیریتِ لیستِ استانداردِ تخصص‌ها/خدماتِ پروفایل (سوپرادمین) — ورودیِ آزادِ کاربر برای ML
// قابل‌اندازه‌گیری نیست؛ کاربر فقط از این لیست انتخاب می‌کند.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json(getProfileOptions())
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as { specialties?: string[]; services?: string[] }))
  const next = setProfileOptions({ specialties: b.specialties, services: b.services })
  const s = await getSession()
  logAudit(String((s as any)?.name || (s as any)?.phone || 'مدیر'), 'ویرایشِ گزینه‌های پروفایل', `${next.specialties.length} تخصص · ${next.services.length} خدمت`)
  return NextResponse.json({ ok: true, ...next })
}
