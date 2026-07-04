import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { newVid, recordEvent, canSend, enqueuePending } from '@/app/lib/tracker-store'

const VID_COOKIE = 'mj_vid'
const VID_MAXAGE = 400 * 24 * 60 * 60 // ~۴۰۰ روز (سقفِ مرورگر) — هر بار تمدید می‌شود ⇒ عملاً دائمی
const DEFAULT_PATHS = ['/property', '/project', '/profile', '/neighborhood', '/store', '/blog', '/search', '/directory']

function cleanTitle(t: string): string {
  return String(t || '').replace(/\s*[|\-–—]\s*ملک‌?جت.*$/u, '').replace(/^ملک‌?جت\s*[|\-–—]\s*/u, '').trim().slice(0, 80)
}

// ثبتِ رویدادِ بازدید + (در صورتِ شناخته‌بودنِ شماره) صف‌بندیِ پیامکِ هدفمند.
export async function POST(req: NextRequest) {
  let vid = req.cookies.get(VID_COOKIE)?.value || ''
  let fresh = false
  if (!vid || vid.length < 8) { vid = newVid(); fresh = true }

  const b = await req.json().catch(() => ({} as any))
  const url = String(b.url || '').slice(0, 300)
  const title = cleanTitle(b.title || '')
  if (url) await recordEvent(vid, { url, title, at: Date.now() })

  // تصمیم برای پیامکِ هدفمند
  const t = getAdminData().tracker
  if (t?.enabled && url) {
    const prefixes = (t.paths || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    const list = prefixes.length ? prefixes : DEFAULT_PATHS
    const path = url.split('?')[0]
    const match = list.some(p => path.startsWith(p))
    const throttleMs = Math.max(0, (t.throttleHours ?? 6)) * 3600_000
    if (match && await canSend(vid, throttleMs)) {
      const tmpl = t.template || 'سلام👋 «%title%» را در ملک‌جت دیدید و مشتاقانه منتظرِ شما هستیم.'
      const message = tmpl.replace(/%title%/g, title || 'موردِ موردِ علاقه‌تان').replace(/%url%/g, url)
      const dueAt = Date.now() + Math.max(0, (t.delayMin ?? 2)) * 60_000
      await enqueuePending(vid, { message, title, url, dueAt })
    }
  }

  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store, private' } })
  // کوکیِ دائمی (هر بار تمدید) — httpOnly تا فقط سرور بخواند
  res.cookies.set(VID_COOKIE, vid, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: VID_MAXAGE, path: '/' })
  void fresh
  return res
}
