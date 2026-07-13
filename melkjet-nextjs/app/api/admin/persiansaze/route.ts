import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  getConfigMasked, saveConfig, getConfig, getMeta, rebuildProfiles,
  listProfiles, getProfile, profileStats, createBuilderAccounts, regionLabel, phaseLabel,
} from '@/app/lib/persiansaze-store'

export const runtime = 'nodejs'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

const LOG_FILE = path.join(process.cwd(), '.persiansaze-scrape.log')
const LOCK_FILE = path.join(process.cwd(), '.persiansaze-scrape.lock')
const REVEAL_LOG = path.join(process.cwd(), '.persiansaze-reveal.log')
const REVEAL_LOCK = path.join(process.cwd(), '.persiansaze-reveal.lock')

function pidAlive(file: string): boolean {
  try { const pid = Number(fs.readFileSync(file, 'utf8')); if (!pid) return false; process.kill(pid, 0); return true } catch { return false }
}
function isRunning(): boolean { return pidAlive(LOCK_FILE) }
function isRevealing(): boolean { return pidAlive(REVEAL_LOCK) }

// یک اسکریپتِ پرشین سازه را در پس‌زمینه اجرا می‌کند.
function startJob(script: string, logFile: string, lockFile: string, extraEnv: Record<string, string> = {}) {
  const cfg = getConfig()
  const out = fs.openSync(logFile, 'w')
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', script)], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PS_USER: cfg.user, PS_PASS: cfg.pass, PS_CHANNEL: cfg.channel || 'chrome', PS_LIMIT: String(cfg.limit || 20), ...extraEnv },
  })
  fs.writeFileSync(lockFile, String(child.pid))
  child.unref()
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
    if (!p) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    // پروژه‌ها را با نامِ منطقه/مرحله غنی کن
    const projects = (p.projects || []).map(pr => ({ ...pr, regionLabel: regionLabel(pr), phaseLabel: phaseLabel(pr) }))
    return NextResponse.json({ ...p, projects })
  }
  const meta = getMeta()
  let log = '', revealLog = ''
  try { log = fs.readFileSync(LOG_FILE, 'utf8').slice(-1500) } catch {}
  try { revealLog = fs.readFileSync(REVEAL_LOG, 'utf8').slice(-1500) } catch {}
  return NextResponse.json({
    config: getConfigMasked(),
    running: isRunning(),
    revealing: isRevealing(),
    data: { lastSync: meta.lastSync, totalProjects: meta.totalProjects || 0, totalBuilders: meta.totalBuilders || 0 },
    profiles: profileStats(),
    log,
    revealLog,
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
    startJob('persiansaze-scrape.mjs', LOG_FILE, LOCK_FILE)
    saveConfig({ lastScrapeAt: new Date().toISOString(), lastError: '' })
    return NextResponse.json({ ok: true, message: 'اسکرپ شروع شد (در پس‌زمینه).' })
  }

  if (action === 'reveal') {
    const cfg = getConfig()
    if (!cfg.user || !cfg.pass) return NextResponse.json({ error: 'یوزر/پسوردِ پرشین سازه را اول ذخیره کن' }, { status: 400 })
    if (isRevealing()) return NextResponse.json({ error: 'گرفتنِ شماره در حال اجراست' }, { status: 409 })
    const extra: Record<string, string> = {}
    if (b.max) extra.PS_MAX_REVEALS = String(Math.max(1, Math.min(500, Number(b.max) || 0)))
    startJob('persiansaze-reveal.mjs', REVEAL_LOG, REVEAL_LOCK, extra)
    return NextResponse.json({ ok: true, message: 'گرفتنِ شماره‌ها شروع شد (در پس‌زمینه).' })
  }

  if (action === 'rebuild-profiles') {
    const r = rebuildProfiles()
    return NextResponse.json({ ok: true, ...r })
  }

  if (action === 'create-accounts') {
    const r = createBuilderAccounts()
    return NextResponse.json({ ok: true, ...r })
  }

  return NextResponse.json({ error: 'اکشنِ نامعتبر' }, { status: 400 })
}
