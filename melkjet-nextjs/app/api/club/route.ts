import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { requireModule, resolveAccess } from '@/app/lib/plan-gate'
import { listAccounts } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { loadSnapshots } from '@/app/lib/empire-metrics'

// فاز ۱۱۰ — باشگاهِ کسب‌وکار (Business Club، سند ۲۲): شبکه‌سازیِ اعضای واقعی + خلاصهٔ بازار.
// چندسطحی = چند پلنِ ادمین با مجوزِ «club» و قیمت/مدتِ دلخواه — سطحِ هر عضو همان نامِ پلنش است.
// هیچ قیمتِ hardcode؛ هیچ دادهٔ ساختگی — اعضا از اکانت‌های واقعیِ دارای پلنِ باشگاه.
export const dynamic = 'force-dynamic'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید', needLogin: true }, { status: 401 })
  const gate = requireModule(s, 'club')
  if (gate) return NextResponse.json(gate, { status: 403 })

  const roleFa = new Map(listRoles().map(r => [r.id, r.name]))
  const my = resolveAccess(s)

  // اعضای واقعیِ باشگاه: هر اکانتی که پلنِ فعالش مجوزِ club دارد (انقضا در resolveAccess لحاظ می‌شود)
  const members = listAccounts()
    .map(a => ({ a, access: resolveAccess({ phone: a.phone, role: a.role }) }))
    .filter(x => x.access.permissions.includes('club'))
    .map(x => ({
      name: x.a.name || 'کاربرِ ملک‌جت',
      role: roleFa.get(x.a.role || '') || x.a.role || '',
      tier: x.access.planName,                       // سطحِ عضو = نامِ پلنِ باشگاهش (چندسطحی)
      since: x.a.planStartedAt || x.a.createdAt,
    }))
    .sort((a, b) => (a.since || 0) - (b.since || 0))
    .slice(0, 120)

  // خلاصهٔ بازارِ اعضا: ۱۰ محلهٔ برتر از اسنپ‌شات‌های واقعیِ رصدخانه (نسخهٔ سبکِ VIP)
  const snaps = await loadSnapshots(30).catch(() => [])
  const last = snaps[snaps.length - 1]
  const digest = (last?.hoods || [])
    .filter(h => h.perM > 0 && h.samples >= 3)
    .sort((a, b) => b.perM - a.perM)
    .slice(0, 10)
    .map(h => ({ hood: h.hood, perM: h.perM, samples: h.samples }))

  return NextResponse.json({
    ok: true,
    me: { tier: my.planName, expiresAt: my.expiresAt || null },
    members, digest,
    note: 'اعضا و اعداد همه واقعی‌اند — عضویتِ باشگاه از پلن‌های فعالِ دارای دسترسیِ «باشگاهِ کسب‌وکار».',
  })
}
