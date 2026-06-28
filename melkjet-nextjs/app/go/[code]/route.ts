import { NextRequest, NextResponse } from 'next/server'
import { recordClick } from '@/app/lib/tracker-links-store'

// ریدایرکتِ شمارندهٔ کلیک: /go/<code> → کلیک ثبت و به مقصدِ واقعی هدایت می‌شود.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const dest = recordClick(String(code || ''))
  if (dest && /^https?:\/\//.test(dest)) return NextResponse.redirect(dest, 302)
  return NextResponse.redirect('https://melkjet.com', 302)
}
