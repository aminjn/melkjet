import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getConfig, getReveals, getMeta, createBuilderAccounts } from './persiansaze-store'

// کرونِ هفتگیِ پرشین سازه: وقتی سهمیه ریست شد (یا باقی‌مانده > ۰)، خودکار
// موتورِ گرفتنِ شماره را در پس‌زمینه اجرا می‌کند. توسطِ cron-runner صدا زده می‌شود.
const REVEAL_LOG = path.join(process.cwd(), '.persiansaze-reveal.log')
const REVEAL_LOCK = path.join(process.cwd(), '.persiansaze-reveal.lock')
const REVEAL_ATTEMPT = path.join(process.cwd(), '.persiansaze-reveal.attempt')
const PROFILES_FILE = path.join(process.cwd(), '.persiansaze-profiles.json')
const ACCT_SYNC = path.join(process.cwd(), '.persiansaze-accounts.sync')
const WEEK = 6.5 * 24 * 3600 * 1000
const MAX_RUN = 25 * 60 * 1000            // اگر Chrome بیش از این طول کشید، هنگ کرده → کشته شود (رفعِ CPUِ ۴۰۰٪)
const ATTEMPT_COOLDOWN = 6 * 3600 * 1000  // چه موفق چه ناموفق، تا این مدت دوباره Chrome راه نمی‌افتد

function alive(file: string): boolean {
  try { const pid = Number(fs.readFileSync(file, 'utf8')); if (!pid) return false; process.kill(pid, 0); return true } catch { return false }
}
function readNum(file: string): number { try { return Number(fs.readFileSync(file, 'utf8')) || 0 } catch { return 0 } }

const DAY = 24 * 3600 * 1000
export function maybeRunReveal(now = Date.now()): boolean {
  const cfg = getConfig()
  if (!cfg.enabled || !cfg.user || !cfg.pass) return false

  // نگهبان: اگر اجرای قبلی هنگ کرده (بیش از MAX_RUN در حالِ اجراست)، Chromeِ معلق را بکش تا CPU آزاد شود.
  if (alive(REVEAL_LOCK)) {
    const started = readNum(REVEAL_ATTEMPT)
    if (started && now - started > MAX_RUN) {
      try { const pid = Number(fs.readFileSync(REVEAL_LOCK, 'utf8')); if (pid) process.kill(pid, 'SIGKILL') } catch {}
      try { fs.unlinkSync(REVEAL_LOCK) } catch {}
    }
    return false   // یکی در حالِ اجراست
  }
  // کول‌داونِ تلاش (کلیدِ رفعِ سواتوثِ CPU): حتی اگر ورود به سایت شکست بخورد و lastRevealAt ثبت نشود،
  // تا ۶ ساعت دوباره Chrome راه نمی‌افتد — به‌جای هر ۵ دقیقه یک Chromeِ سنگین.
  const lastAttempt = readNum(REVEAL_ATTEMPT)
  if (lastAttempt && now - lastAttempt < ATTEMPT_COOLDOWN) return false

  // گیتِ زمانی (ارزان) تا فایلِ بزرگ بی‌جهت خوانده نشود.
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
  const pending = getMeta().totalProjects - Object.keys(reveals.items || {}).length
  if (pending <= 0) return false
  try {
    fs.writeFileSync(REVEAL_ATTEMPT, String(now))   // مهرِ تلاش قبل از spawn — تا شکستِ launch هم کول‌داون بخورد
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
