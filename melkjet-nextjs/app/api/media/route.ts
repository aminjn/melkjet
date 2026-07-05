import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { saveMedia, isAllowed } from '@/app/lib/media-store'

// آپلود رسانه (عکس/ویدئو) — برای ویرایشگر مقاله. کاربر واردشده مجاز است.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای آپلود باید وارد شوید' }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'فایلی انتخاب نشده' }, { status: 400 })
    if (!isAllowed(file.type)) return NextResponse.json({ error: 'فقط تصویر، ویدئو یا PDF مجاز است' }, { status: 400 })
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: 'حجم فایل بیش از ۳۰ مگابایت' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())
    const m = saveMedia(buf, file.type, file.name || 'file')
    return NextResponse.json({ ok: true, url: `/api/media/${m.id}`, mime: m.mime, kind: m.mime.startsWith('video/') ? 'video' : 'image' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در آپلود' }, { status: 500 })
  }
}
