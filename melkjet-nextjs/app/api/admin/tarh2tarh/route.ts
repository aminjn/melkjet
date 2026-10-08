import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getConfigMasked, saveConfig, tickScrape, createArchitectAccounts,
  stats, listProfilesView, getProfileByHandle, clearAll,
} from '@/app/lib/tarh2tarh-store'

export const runtime = 'nodejs'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const url = new URL(req.url)
  const view = url.searchParams.get('view')
  if (view === 'profiles') {
    return NextResponse.json(await listProfilesView({
      q: url.searchParams.get('q') || '',
      withPhone: url.searchParams.get('withPhone') === '1',
      page: Number(url.searchParams.get('page')) || 1,
    }))
  }
  if (view === 'profile') {
    const p = await getProfileByHandle(url.searchParams.get('id') || '')
    if (!p) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    return NextResponse.json(p)
  }
  return NextResponse.json({ config: await getConfigMasked(), stats: await stats() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  if (action === 'config') {
    // کوکیِ HTTP فقط ASCII است؛ نویسهٔ غیر از آن (مثل «…» از کپیِ متنِ نمونه) یعنی مقدارِ
    // واقعی کپی نشده و هر درخواست با ByteString error می‌ترکید — با پیامِ روشن رد می‌کنیم.
    if (typeof body.cookie === 'string' && body.cookie.trim() && /[^\x20-\x7E]/.test(body.cookie)) {
      return NextResponse.json({ ok: false, error: 'کوکی نویسهٔ نامعتبر دارد (مثل «…») — یعنی از روی متنِ نمونه کپی شده، نه از DevTools. مقدارِ واقعی و کاملِ هدرِ cookie را کپی کن.' })
    }
    const cfg = await saveConfig({
      enabled: body.enabled !== undefined ? !!body.enabled : undefined as any,
      cookie: typeof body.cookie === 'string' ? body.cookie : undefined as any,
      pagesPerTick: body.pagesPerTick, profilesPerTick: body.profilesPerTick, delayMs: body.delayMs,
    })
    return NextResponse.json({ ok: true, config: { ...cfg, cookie: undefined, cookieSet: !!cfg.cookie.trim() } })
  }
  if (action === 'scan') {
    // اجرای فوری (منتظرِ تیکِ کرون نمی‌ماند). خودِ tick قفل و نرخِ داخلی دارد.
    const r = await tickScrape(true)
    return NextResponse.json({ ok: true, ...r, stats: await stats() })
  }
  if (action === 'accounts') {
    const r = await createArchitectAccounts()
    if (r.noRole) return NextResponse.json({ ok: false, error: 'نقشی با داشبوردِ /architect پیدا نشد — اول در «نقش‌ها» بساز.' })
    return NextResponse.json({ ok: true, ...r })
  }
  if (action === 'clear') { await clearAll(); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
