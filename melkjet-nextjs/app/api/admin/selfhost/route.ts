import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { logAudit } from '@/app/lib/audit-store'
import { selfHostImage, selfHostSearch, selfHostSpeak, selfHostVideo } from '@/app/lib/self-host'

export const runtime = 'nodejs'
export const maxDuration = 600

// سرویس‌های AIِ خودِ مالک (GPU): تصویر/ویدئو/STT/TTS/جستجو — تنظیم + تستِ واقعی. فقط سوپرادمین/staff.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }
const who = (s: any) => s?.name || s?.phone || 'مدیر'
const str = (v: unknown, n = 300) => String(v ?? '').trim().slice(0, n)
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, selfHost: getAdminData().selfHost || {} }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))

  // تستِ واقعیِ یک سرویس (قبل از اینکه به کلِ سایت وصلش کنی).
  if (b.test) {
    try {
      if (b.test === 'image') { const u = await selfHostImage(str(b.prompt, 200) || 'یک آپارتمانِ مدرن در تهران، نورِ طبیعی'); return NextResponse.json({ ok: true, url: u }) }
      if (b.test === 'tts') { const u = await selfHostSpeak(str(b.text, 200) || 'سلام، این یک تستِ صداست.'); return NextResponse.json({ ok: true, url: u }) }
      if (b.test === 'search') { const rs = await selfHostSearch(str(b.query, 120) || 'قیمت مسکن تهران', 5); return NextResponse.json({ ok: true, results: rs }) }
      if (b.test === 'video') { const u = await selfHostVideo(str(b.image, 2000), { prompt: str(b.prompt, 200) }); return NextResponse.json({ ok: true, url: u }) }
      if (b.test === 'stt') return NextResponse.json({ ok: false, error: 'تستِ STT از همین‌جا نیست — یک پیامِ صوتی در دستیار/ربات بفرست.' }, { status: 200 })
      return NextResponse.json({ ok: false, error: 'سرویسِ نامعتبر' }, { status: 200 })
    } catch (e: any) { return NextResponse.json({ ok: false, error: e?.message || 'خطا' }, { status: 200 }) }
  }

  // ذخیرهٔ تنظیمات (ادغام با موجود؛ فقط کلیدهای فرستاده‌شده).
  const cur = getAdminData().selfHost || {}
  const inp = b.selfHost || {}
  // apiKey در هر سرویس حفظ می‌شود (هدرِ X-Media-Keyِ دروازه).
  const merge = (k: string, extra: (o: any) => any) => {
    if (!(k in inp)) return (cur as any)[k]
    const o = inp[k] || {}
    return { enabled: !!o.enabled, baseUrl: str(o.baseUrl, 300), apiKey: str(o.apiKey, 200), ...extra(o) }
  }
  const selfHost = {
    image: merge('image', (o: any) => ({ path: str(o.path, 120) || '/img/generate', width: num(o.width) || 1024, height: num(o.height) || 1024, steps: num(o.steps) || 20 })),
    video: merge('video', (o: any) => ({ path: str(o.path, 120) || '/vid/i2v' })),
    stt: merge('stt', (o: any) => ({ model: str(o.model, 80) })),
    tts: merge('tts', (o: any) => ({ model: str(o.model, 80), voice: str(o.voice, 80) })),
    search: merge('search', (_o: any) => ({})),
  }
  const data = getAdminData()
  saveAdminData({ ...data, selfHost })
  const onList = Object.entries(selfHost).filter(([, v]: any) => v?.enabled).map(([k]) => k).join('،') || 'هیچ'
  try { logAudit(who(s), 'selfhost-config', `سرویس‌های خودیِ روشن: ${onList}`) } catch {}
  return NextResponse.json({ ok: true, selfHost }, { headers: { 'Cache-Control': 'no-store, private' } })
}
