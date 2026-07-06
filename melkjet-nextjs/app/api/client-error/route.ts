import { NextRequest, NextResponse } from 'next/server'

// گزارشِ خطاهای سمتِ کلاینت (از app/error.tsx و global-error.tsx).
// خطا را با پیشوندِ CLIENT_ERROR در لاگِ سرور (pm2) چاپ می‌کند تا قابلِ پیگیری باشد:
//   pm2 logs melkjet-3001 --lines 100 --nostream | grep -A20 CLIENT_ERROR
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({})) as { message?: string; stack?: string; digest?: string; url?: string }
    console.error('CLIENT_ERROR', JSON.stringify({
      at: new Date().toISOString(),
      url: String(b.url || '').slice(0, 300),
      digest: String(b.digest || '').slice(0, 80),
      message: String(b.message || '').slice(0, 500),
      stack: String(b.stack || '').slice(0, 2000),
    }))
  } catch {}
  return NextResponse.json({ ok: true })
}
