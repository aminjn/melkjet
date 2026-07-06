import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getCrmSettings, setCrmSettings } from '@/app/lib/crm-settings-store'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  return NextResponse.json({ settings: await getCrmSettings(s.phone) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const settings = await setCrmSettings(s.phone, {
    autoWelcomeSms: b.autoWelcomeSms,
    welcomeTemplate: b.welcomeTemplate,
    followUpHours: b.followUpHours,
  })
  return NextResponse.json({ settings })
}
