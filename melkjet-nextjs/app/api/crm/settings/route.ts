import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { getCrmSettings, setCrmSettings } from '@/app/lib/crm-settings-store'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  return NextResponse.json({ settings: await getCrmSettings(s.phone) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'crm'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const b = await req.json().catch(() => ({}))
  const settings = await setCrmSettings(s.phone, {
    autoWelcomeSms: b.autoWelcomeSms,
    welcomeTemplate: b.welcomeTemplate,
    followUpHours: b.followUpHours,
  })
  return NextResponse.json({ settings })
}
