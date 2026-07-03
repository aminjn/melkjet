import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getTeamMembers } from '@/app/lib/team-members'

// اعضای تیمِ آژانسِ کاربرِ واردشده — برای پیش‌نمایشِ زندهٔ بلوکِ «تیم مشاوران» در سایت‌ساز.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ members: [] }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ members: await getTeamMembers(s.phone) }, { headers: { 'Cache-Control': 'no-store, private' } })
}
