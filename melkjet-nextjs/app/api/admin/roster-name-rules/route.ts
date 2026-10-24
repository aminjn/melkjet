import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getNameRules, setNameRules } from '@/app/lib/roster-name-rules'
import { logAudit } from '@/app/lib/audit-store'

export const runtime = 'nodejs'

// فهرستِ سیاه/سفیدِ نامِ مشاور — مدیریتِ زنده از سوپرادمین (بدونِ دیپلوی).
//   • سیاه: واژه‌ای که هرگز نامِ مشاور نیست (دوست، پیچ، متریال…).
//   • سفید: واژه‌ای که نامِ واقعی است ولی اشتباهاً نوفه تشخیص داده می‌شود.
// سراسری، بدونِ شرط. در سینکِ بعدیِ هر آژانس اثر می‌کند (buildAgencyRoster → loadNameRules).
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }
const who = (s: any) => s?.name || s?.phone || 'مدیر'

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, rules: await getNameRules() }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  let body: any = {}
  try { body = await req.json() } catch {}
  const toList = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x || '')) :
    typeof v === 'string' ? v.split(/[\n,،]/) : []
  const rules = await setNameRules({ blacklist: toList(body?.blacklist), whitelist: toList(body?.whitelist) })
  try { logAudit(who(s), 'roster-name-rules', `سیاه:${rules.blacklist.length} سفید:${rules.whitelist.length}`) } catch {}
  return NextResponse.json({ ok: true, rules }, { headers: { 'Cache-Control': 'no-store, private' } })
}
