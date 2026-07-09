'use client'
// 🔊 بازخوردِ صوتیِ مسیرِ رشد (سند ۲۱ — GDD فصل ۱۱، فاز ۳۲) — سنتزِ WebAudio، بدونِ هیچ فایلِ صوتی.
// قوانینِ سند که اینجا اجرا می‌شوند: هر افکت < ۱ ثانیه (Part 02) · مثبت/منفی کاملاً متمایز (Part 06) ·
// شروعِ پخش < 100ms و حجمِ دانلودِ صفر (Part 09) · هیچ اطلاعِ مهمی فقط صوتی نیست — همهٔ پیام‌ها متن دارند (Part 08)
// · قابلِ خاموش‌کردن + حجمِ جدا (Part 05) · «هیچ صدایی فقط برای پرکردنِ سکوت نیست» (Part 10).
// موسیقی/امبینت/اسپیشال/گوینده → نیازمندِ اسِتِ صوتی و کلاینتِ World (در تراکر با تریگر ثبت است).

export type SfxKind = 'success' | 'error' | 'warn' | 'reward' | 'levelup' | 'build' | 'coin'

const KEY = 'mj_sfx'
type Prefs = { on: boolean; vol: number }
export function sfxPrefs(): Prefs {
  try { const p = JSON.parse(localStorage.getItem(KEY) || ''); return { on: p.on !== false, vol: Math.max(0, Math.min(1, Number(p.vol ?? 0.35))) } } catch { return { on: true, vol: 0.35 } }
}
export function setSfxPrefs(p: Partial<Prefs>) {
  const cur = sfxPrefs()
  try { localStorage.setItem(KEY, JSON.stringify({ ...cur, ...p })) } catch {}
}

let ctx: AudioContext | null = null
let last: Record<string, number> = {}
function ac(): AudioContext | null {
  try { if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx } catch { return null }
}
// یک نُتِ کوتاه: sine/triangle با envelope نرم — بدونِ کلیکِ ناگهانی (Part 08: کاهشِ صداهای ناگهانی)
function tone(a: AudioContext, freq: number, t0: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(a.destination)
  o.start(t0); o.stop(t0 + dur + 0.05)
}

// «هر عملِ مهم فقط یک صدای مشخص» + «صداها با هم تداخل نکنند» (Part 02): هر نوع حداقل ۱۵۰ms فاصله.
export function sfx(kind: SfxKind, adminEnabled = true) {
  const p = sfxPrefs()
  if (!adminEnabled || !p.on || p.vol <= 0) return
  const now = Date.now()
  if (now - (last[kind] || 0) < 150) return
  last[kind] = now
  const a = ac(); if (!a) return
  const t = a.currentTime, v = p.vol * 0.5
  switch (kind) {
    case 'success':   // آرپژِ ماژورِ بالارونده — «معاملهٔ موفق»
      tone(a, 523, t, .12, v); tone(a, 659, t + .09, .12, v); tone(a, 784, t + .18, .2, v); break
    case 'reward':    // برقِ جایزه — صندوقچه/پاداش
      tone(a, 880, t, .1, v, 'triangle'); tone(a, 1175, t + .08, .1, v, 'triangle'); tone(a, 1568, t + .16, .25, v, 'triangle'); break
    case 'levelup':   // فانفارِ کوتاه — Level Up
      tone(a, 392, t, .12, v); tone(a, 523, t + .1, .12, v); tone(a, 659, t + .2, .12, v); tone(a, 784, t + .3, .3, v); break
    case 'coin':      // جرینگِ سکه
      tone(a, 1319, t, .07, v * .9, 'triangle'); tone(a, 1760, t + .06, .12, v * .9, 'triangle'); break
    case 'build':     // ضربِ بم — کلنگ/کارگاه
      tone(a, 110, t, .18, v, 'triangle'); tone(a, 147, t + .12, .22, v, 'triangle'); break
    case 'warn':      // دو بوقِ کوتاه — هشدار
      tone(a, 440, t, .1, v, 'square' as OscillatorType); tone(a, 440, t + .16, .1, v, 'square' as OscillatorType); break
    case 'error':     // پایین‌رونده — رد/خطا (کاملاً متمایز از موفق)
      tone(a, 330, t, .12, v); tone(a, 247, t + .1, .22, v); break
  }
}
