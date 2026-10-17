import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { spawn } from 'child_process'
import { openSync, existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { kvGetPrefix, pgEnabled } from '@/app/lib/db'
import { getItemById } from '@/app/lib/scraper-store'

// فاز ۳۰۴ — ایمپورتِ «کارشناسِ رسمی + وکیل» از پنل (جایگزینِ اسکرپِ قدیمیِ بنیاد وکلا).
// دادهٔ کانون در scripts/data/ همراهِ پروژه است؛ این API اسکریپتِ import-legal را در
// پس‌زمینه اجرا می‌کند (ژئوکدِ نکسا‌مپ + درج در دایرکتوری) تا درخواست معطل نماند.
const ROOT = process.cwd()
const LOCK = join(ROOT, '.legal-import.lock')
const LOG = join(ROOT, '.legal-import.log')

async function guard() {
  const s = await getSession()
  return !!s && (s.role === 'super_admin' || (s.staff || []).length > 0)
}
// قفل می‌تواند «عدد (قدیمی)» یا JSON `{at,pid}` (جدید — تا بشود پروسهٔ گیرکرده را کُشت) باشد.
function lockInfo(): { at: number; pid: number } | null {
  try {
    const raw = readFileSync(LOCK, 'utf8')
    try { const j = JSON.parse(raw); return { at: Number(j.at) || 0, pid: Number(j.pid) || 0 } } catch { return { at: Number(raw) || 0, pid: 0 } }
  } catch { return null }
}
const running = () => { if (!existsSync(LOCK)) return false; const l = lockInfo(); return !!l && Date.now() - l.at < 30 * 60_000 }

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  // میزانِ «نمایشِ شماره»ی متخصصان (کلیدِ dir:{id}) — برای سوپرادمین. فقط وقتی ?stats=1 (نه در پولِ لاگ).
  if (req.nextUrl.searchParams.get('stats') && pgEnabled()) {
    try {
      const rows = await kvGetPrefix<{ totalP?: number }>('sstat:dir:')
      const ranked = rows.map(r => ({ id: r.key.slice('sstat:dir:'.length), reveals: Number(r.data?.totalP) || 0 }))
        .filter(x => x.reveals > 0).sort((a, b) => b.reveals - a.reveals).slice(0, 30)
      const top = await Promise.all(ranked.map(async x => {
        const it = await getItemById(x.id).catch(() => null)
        return { id: x.id, reveals: x.reveals, title: it?.title || x.id, location: it?.location || '' }
      }))
      const totalReveals = rows.reduce((s, r) => s + (Number(r.data?.totalP) || 0), 0)
      return NextResponse.json({ top, totalReveals })
    } catch { return NextResponse.json({ top: [], totalReveals: 0 }) }
  }
  let log = ''
  try { log = readFileSync(LOG, 'utf8').slice(-4000) } catch {}
  return NextResponse.json({ running: running(), log })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({} as any))
  const action = body.action || (body.fileContent ? 'upload' : 'import')
  // رفعِ گیر: پروسهٔ ایمپورتِ گیرکرده را می‌کُشد و قفل را آزاد می‌کند (اسکریپت مُرده/هنگ یا UI چسبیده).
  if (action === 'clear-lock') {
    const l = lockInfo()
    if (l?.pid) { try { process.kill(l.pid, 'SIGKILL') } catch {} }
    try { unlinkSync(LOCK) } catch {}
    return NextResponse.json({ ok: true, cleared: true })
  }
  if (running()) return NextResponse.json({ ok: false, running: true, note: 'یک اجرا در جریان است — صبر کن' })

  let flags: string[]
  if (action === 'upload') {
    // فایلِ آپلودشده را اعتبارسنجی و در فایلِ موقت ذخیره کن، بعد اسکریپت را روی آن اجرا کن.
    let doc: any
    try { doc = JSON.parse(String(body.fileContent || '')) } catch { return NextResponse.json({ ok: false, note: 'فایل JSON معتبر نیست' }) }
    if (!doc || !Array.isArray(doc.groups)) return NextResponse.json({ ok: false, note: 'ساختارِ فایل درست نیست (groups لازم است)' })
    const items = doc.groups.flatMap((g: any) => g.items || [])
    if (!items.length) return NextResponse.json({ ok: false, note: 'فایل آیتمی ندارد' })
    const tmp = join(ROOT, `.legal-upload-${Date.now()}.json`)
    writeFileSync(tmp, JSON.stringify(doc))
    flags = [`--file=${tmp}`]
  } else if (action === 'remove-bonyad') flags = ['--remove-bonyad']
  else if (action === 'delete-saz-tehran') flags = ['--delete-cat=سازندگان تهران']
  else if (action === 'reset') flags = ['--reset']
  else if (action === 'regeo') flags = ['--regeo']
  else return NextResponse.json({ ok: false, note: 'عملِ نامعتبر' })

  try {
    writeFileSync(LOCK, JSON.stringify({ at: Date.now(), pid: 0 }))
    const out = openSync(LOG, 'w')
    const child = spawn(process.execPath, ['--import', join(ROOT, 'scripts/reos-loader.mjs'), join(ROOT, 'scripts/import-legal.mjs'), ...flags], { cwd: ROOT, env: process.env, stdio: ['ignore', out, out] })
    try { writeFileSync(LOCK, JSON.stringify({ at: Date.now(), pid: child.pid || 0 })) } catch {}   // pid برای «لغو»
    child.on('exit', () => { try { unlinkSync(LOCK) } catch {} })
    child.on('error', () => { try { unlinkSync(LOCK) } catch {} })
    child.unref()
    return NextResponse.json({ ok: true, started: true })
  } catch (e) {
    try { unlinkSync(LOCK) } catch {}
    return NextResponse.json({ ok: false, note: (e as Error).message })
  }
}
