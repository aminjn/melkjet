import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getConfig, getReveals, getData, createBuilderAccounts } from './persiansaze-store'

// کرونِ هفتگیِ پرشین سازه: وقتی سهمیه ریست شد (یا باقی‌مانده > ۰)، خودکار
// موتورِ گرفتنِ شماره را در پس‌زمینه اجرا می‌کند. توسطِ cron-runner صدا زده می‌شود.
const REVEAL_LOG = path.join(process.cwd(), '.persiansaze-reveal.log')
const REVEAL_LOCK = path.join(process.cwd(), '.persiansaze-reveal.lock')
const PROFILES_FILE = path.join(process.cwd(), '.persiansaze-profiles.json')
const ACCT_SYNC = path.join(process.cwd(), '.persiansaze-accounts.sync')
const WEEK = 6.5 * 24 * 3600 * 1000

function alive(file: string): boolean {
  try { const pid = Number(fs.readFileSync(file, 'utf8')); if (!pid) return false; process.kill(pid, 0); return true } catch { return false }
}

const DAY = 24 * 3600 * 1000
export function maybeRunReveal(now = Date.now()): boolean {
  const cfg = getConfig()
  if (!cfg.enabled || !cfg.user || !cfg.pass) return false
  if (alive(REVEAL_LOCK)) return false
  // ابتدا گیتِ زمانی (ارزان) تا هر ۵ دقیقه Chrome راه نیفتد و فایلِ بزرگ خوانده نشود.
  const reveals = getReveals()
  const last = reveals.meta?.lastRevealAt ? Date.parse(reveals.meta.lastRevealAt) : 0
  const avail = reveals.meta?.availableCount
  const gotLast = (reveals.meta as any)?.gotLast
  // اجرا فقط: هفته‌ای گذشته (ریستِ سهمیه)، یا ادامهٔ همین هفته حداکثر هر ۱۲ ساعت —
  // ولی فقط اگر اجرای قبلی واقعاً شمارهٔ جدیدی گرفته باشد (وگرنه تا ریستِ هفتگی صبر کن،
  // تا Chrome بیهوده راه نیفتد وقتی پروژهٔ درون‌محدودهٔ نگرفته‌ای نمانده).
  const resume = typeof avail === 'number' && avail > 0 && (gotLast == null || gotLast > 0) && now - last >= 12 * 3600 * 1000
  const due = !last || (now - last >= WEEK) || resume
  if (!due) return false
  const projects = getData().projects || []
  const pending = projects.length - Object.keys(reveals.items || {}).length
  if (pending <= 0) return false
  try {
    const out = fs.openSync(REVEAL_LOG, 'w')
    const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'persiansaze-reveal.mjs')], {
      detached: true, stdio: ['ignore', out, out],
      env: { ...process.env, PS_USER: cfg.user, PS_PASS: cfg.pass, PS_CHANNEL: cfg.channel || 'chrome' },
    })
    fs.writeFileSync(REVEAL_LOCK, String(child.pid))
    child.unref()
    return true
  } catch { return false }
}

// پس از هر بار به‌روزشدنِ پروفایل‌ها (یعنی بعدِ هر reveal)، حساب‌های سازنده را خودکار می‌سازد.
export function maybeCreateAccounts(): boolean {
  const cfg = getConfig()
  if (!cfg.enabled) return false
  try {
    const mtime = fs.statSync(PROFILES_FILE).mtimeMs
    let last = 0; try { last = Number(fs.readFileSync(ACCT_SYNC, 'utf8')) || 0 } catch {}
    if (mtime <= last) return false // پروفایل‌ها از آخرین ساختِ حساب تغییری نکرده‌اند
    createBuilderAccounts()
    fs.writeFileSync(ACCT_SYNC, String(mtime))
    return true
  } catch { return false }
}
