import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { getMedia } from '@/app/lib/media-store'

// سرو فایل رسانه (عکس/ویدئو) ذخیره‌شده.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = getMedia(id)
  if (!m) return new Response('not found', { status: 404 })
  try {
    const buf = readFileSync(m.path)
    return new Response(new Uint8Array(buf), { headers: { 'content-type': m.mime, 'cache-control': 'public, max-age=31536000, immutable' } })
  } catch {
    return new Response('error', { status: 500 })
  }
}
