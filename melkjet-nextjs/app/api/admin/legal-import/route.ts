import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { spawn } from 'child_process'
import { openSync, existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'

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
const running = () => { if (!existsSync(LOCK)) return false; try { return Date.now() - Number(readFileSync(LOCK, 'utf8')) < 30 * 60_000 } catch { return true } }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  let log = ''
  try { log = readFileSync(LOG, 'utf8').slice(-4000) } catch {}
  return NextResponse.json({ running: running(), log })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({} as any))
  const action = body.action || (body.fileContent ? 'upload' : 'import')
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
  else return NextResponse.json({ ok: false, note: 'عملِ نامعتبر' })

  try {
    writeFileSync(LOCK, String(Date.now()))
    const out = openSync(LOG, 'w')
    const child = spawn(process.execPath, ['--import', join(ROOT, 'scripts/reos-loader.mjs'), join(ROOT, 'scripts/import-legal.mjs'), ...flags], { cwd: ROOT, env: process.env, stdio: ['ignore', out, out] })
    child.on('exit', () => { try { unlinkSync(LOCK) } catch {} })
    child.on('error', () => { try { unlinkSync(LOCK) } catch {} })
    child.unref()
    return NextResponse.json({ ok: true, started: true })
  } catch (e) {
    try { unlinkSync(LOCK) } catch {}
    return NextResponse.json({ ok: false, note: (e as Error).message })
  }
}
