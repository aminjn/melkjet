import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getConfig, getReveals, getData } from './persiansaze-store'

// کرونِ هفتگیِ پرشین سازه: وقتی سهمیه ریست شد (یا باقی‌مانده > ۰)، خودکار
// موتورِ گرفتنِ شماره را در پس‌زمینه اجرا می‌کند. توسطِ cron-runner صدا زده می‌شود.
const REVEAL_LOG = path.join(process.cwd(), '.persiansaze-reveal.log')
const REVEAL_LOCK = path.join(process.cwd(), '.persiansaze-reveal.lock')
const WEEK = 6.5 * 24 * 3600 * 1000

function alive(file: string): boolean {
  try { const pid = Number(fs.readFileSync(file, 'utf8')); if (!pid) return false; process.kill(pid, 0); return true } catch { return false }
}

export function maybeRunReveal(now = Date.now()): boolean {
  const cfg = getConfig()
  if (!cfg.enabled || !cfg.user || !cfg.pass) return false
  if (alive(REVEAL_LOCK)) return false
  const projects = getData().projects || []
  const reveals = getReveals()
  const pending = projects.length - Object.keys(reveals.items || {}).length
  if (pending <= 0) return false
  const last = reveals.meta?.lastRevealAt ? Date.parse(reveals.meta.lastRevealAt) : 0
  const avail = reveals.meta?.availableCount
  // اجرا اگر: هفته‌ای گذشته (ریستِ سهمیه) یا سهمیهٔ باقی‌مانده > ۰ (ادامهٔ همین هفته)
  const due = (now - last >= WEEK) || (typeof avail === 'number' && avail > 0) || !last
  if (!due) return false
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
