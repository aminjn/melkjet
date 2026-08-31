import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { cachedPath } from '@/app/lib/listing-image'

// سِروِ عکسِ آگهیِ کش‌شدهٔ محلی. نام هشِ آدرسِ مبدأ است و هرگز عوض نمی‌شود،
// پس کشِ یک‌سالهٔ immutable امن است و بارِ سرور تقریباً صفر می‌ماند.
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  const p = cachedPath(name)
  if (!p) return new Response('not found', { status: 404 })
  try {
    const buf = readFileSync(p)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[(name.split('.').pop() || '').toLowerCase()] || 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buf.length),
      },
    })
  } catch { return new Response('not found', { status: 404 }) }
}
