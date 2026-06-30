import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  getConfigMasked, saveConfig, getConfig, getData, rebuildProfiles,
  listProfiles, getProfile, profileStats,
} from '@/app/lib/persiansaze-store'

export const runtime = 'nodejs'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

const LOG_FILE = path.join(process.cwd(), '.persiansaze-scrape.log')
const LOCK_FILE = path.join(process.cwd(), '.persiansaze-scrape.lock')

function isRunning(): boolean {
  try {
    const pid = Number(fs.readFileSync(LOCK_FILE, 'utf8'))
    if (!pid) return false
    process.kill(pid, 0) // بدونِ کشتن، فقط بررسیِ زنده‌بودن
    return true
  } catch { return false }
}

// اسکریپتِ اسکرپ را در پس‌زمینه اجرا می‌کند (لاگین + کشیدن + بازسازیِ پروفایل‌ها).
function startScrape() {
  const cfg = getConfig()
  const script = path.join(process.cwd(), 'scripts', 'persiansaze-scrape.mjs')
  const out = fs.openSync(LOG_FILE, 'w')
  const child = spawn(process.execPath, [script], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PS_USER: cfg.user, PS_PASS: cfg.pass, PS_CHANNEL: cfg.channel || 'chrome', PS_LIMIT: String(cfg.limit || 100) },
  })
  fs.writeFileSync(LOCK_FILE, String(child.pid))
  child.unref()
  saveConfig({ lastScrapeAt: new Date().toISOString(), lastError: '' })
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const url = new URL(req.url)
  const view = url.searchParams.get('view')
  if (view === 'profiles') {
    return NextResponse.json(listProfiles({
      search: url.searchParams.get('q') || '',
      withPhone: url.searchParams.get('withPhone') === '1',
      page: Number(url.searchParams.get('page')) || 1,
    }))
  }
  if (view === 'profile') {
    const p = getProfile(url.searchParams.get('id') || '')
    return p ? NextResponse.json(p) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  }
  const data = getData()
  let log = ''
  try { log = fs.readFileSync(LOG_FILE, 'utf8').slice(-1500) } catch {}
  return NextResponse.json({
    config: getConfigMasked(),
    running: isRunning(),
    data: { lastSync: data.lastSync, totalProjects: data.totalProjects || 0, totalBuilders: data.totalBuilders || 0 },
    profiles: profileStats(),
    log,
  })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const action = b.action

  if (action === 'save-config') {
    const patch: any = {}
    for (const k of ['user', 'channel', 'limit', 'weeklyQuota', 'enabled']) if (b[k] !== undefined) patch[k] = b[k]
    if (b.pass && b.pass !== '********') patch.pass = String(b.pass)
    const c = saveConfig(patch)
    return NextResponse.json({ ok: true, config: { ...c, pass: c.pass ? '********' : '' } })
  }

  if (action === 'scrape') {
    const cfg = getConfig()
    if (!cfg.user || !cfg.pass) return NextResponse.json({ error: 'یوزر/پسوردِ پرشین سازه را اول ذخیره کن' }, { status: 400 })
    if (isRunning()) return NextResponse.json({ error: 'اسکرپ در حال اجراست' }, { status: 409 })
    startScrape()
    return NextResponse.json({ ok: true, message: 'اسکرپ شروع شد (در پس‌زمینه).' })
  }

  if (action === 'rebuild-profiles') {
    const r = rebuildProfiles()
    return NextResponse.json({ ok: true, ...r })
  }

  return NextResponse.json({ error: 'اکشنِ نامعتبر' }, { status: 400 })
}
