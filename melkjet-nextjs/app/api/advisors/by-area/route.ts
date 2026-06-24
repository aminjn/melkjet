import { NextRequest, NextResponse } from 'next/server'
import { listAccounts, dashForRole } from '@/app/lib/account-store'
import { getAdvisor } from '@/app/lib/advisor-store'
import { getAdvisorMembership } from '@/app/lib/agency-link-store'

// مشاورانی که محله/منطقهٔ موردنظر در «مناطق فعالیت»‌شان است (برای صفحهٔ محلهٔ عمومی).
function norm(s: string) { return (s || '').replace(/\s+/g, ' ').replace(/‌/g, '').trim() }

export async function GET(req: NextRequest) {
  const area = norm(new URL(req.url).searchParams.get('area') || '')
  if (!area) return NextResponse.json({ advisors: [] })

  const advisors = listAccounts()
    .filter(a => dashForRole(a.role) === '/pros')
    .map(a => {
      const p = getAdvisor(a.phone).profile
      const areas = (p.areas || '').split('،').map(x => norm(x)).filter(Boolean)
      if (!(p.name || '').trim()) return null
      if (!areas.some(x => x === area || x.includes(area) || area.includes(x))) return null
      const m = getAdvisorMembership(a.phone)
      return { phone: a.phone, name: p.name, title: p.title || 'مشاور املاک', photo: p.photo || '', agency: m?.agencyName || '', areas: p.areas || '' }
    })
    .filter(Boolean)
    .slice(0, 24)

  return NextResponse.json({ advisors }, { headers: { 'Cache-Control': 'no-store' } })
}
