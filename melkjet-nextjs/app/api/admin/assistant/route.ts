import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { logAudit } from '@/app/lib/audit-store'

export const runtime = 'nodejs'

// تنظیماتِ «دستیار ملک‌جت» (ویجتِ عمومی) + تبلیغِ درونِ آن — فقط سوپرادمین/staff.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }
const who = (s: any) => s?.name || s?.phone || 'مدیر'

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, assistant: getAdminData().assistant || {} }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  let b: any = {}
  try { b = await req.json() } catch {}
  const str = (v: unknown, n = 2000) => String(v ?? '').slice(0, n)
  const chips = Array.isArray(b?.chips) ? b.chips.map((c: any) => str(c, 60)).filter(Boolean).slice(0, 6)
    : typeof b?.chips === 'string' ? b.chips.split(/[\n,،]/).map((c: string) => c.trim()).filter(Boolean).slice(0, 6) : []
  const adIn = b?.ad || {}
  const assistant = {
    enabled: b?.enabled !== false,
    greeting: str(b?.greeting, 400),
    systemPrompt: str(b?.systemPrompt, 4000),
    chips,
    showListings: b?.showListings !== false,
    maxResults: Math.max(1, Math.min(Number(b?.maxResults) || 4, 8)),
    ad: {
      enabled: !!adIn.enabled,
      title: str(adIn.title, 120),
      text: str(adIn.text, 400),
      imageUrl: str(adIn.imageUrl, 1000),
      linkUrl: str(adIn.linkUrl, 1000),
      cta: str(adIn.cta, 40),
      everyTurns: Math.max(1, Math.min(Number(adIn.everyTurns) || 3, 20)),
    },
  }
  const data = getAdminData()
  saveAdminData({ ...data, assistant })
  try { logAudit(who(s), 'assistant-config', `دستیار ${assistant.enabled ? 'روشن' : 'خاموش'} · تبلیغ ${assistant.ad.enabled ? 'روشن' : 'خاموش'}`) } catch {}
  return NextResponse.json({ ok: true, assistant }, { headers: { 'Cache-Control': 'no-store, private' } })
}
