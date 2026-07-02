import { NextRequest, NextResponse } from 'next/server'
import { listActive } from '@/app/lib/plan-store'
import { roleByDashboard } from '@/app/lib/role-store'
import { getSession } from '@/app/lib/session'
import { listPackages, getCredit } from '@/app/lib/comm-store'

// GET → پلن‌ها (+ پکیج‌ها و اعتبار برای نمایش در پنل‌ها)
//   ?dashboard=/pros → فقط پلن‌های آن نقش + پلن‌های عمومی
//   بدون dashboard (صفحهٔ عمومیِ قیمت‌گذاری) → همهٔ پلن‌های فعال
export async function GET(req: NextRequest) {
  const dashboard = new URL(req.url).searchParams.get('dashboard') || ''
  let plans = listActive()
  if (dashboard) {
    const role = roleByDashboard(dashboard)
    const rid = role?.id
    // پلن‌های این داشبورد/نقش + پلن‌های عمومی (بدونِ نقش و داشبورد)
    plans = plans.filter(p => p.dashboard === dashboard || (rid && p.roleId === rid) || (!p.roleId && !p.dashboard))
  }
  const s = await getSession()
  const credit = s ? getCredit(s.phone) : null
  return NextResponse.json(
    { plans, packages: listPackages(true), credit },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
