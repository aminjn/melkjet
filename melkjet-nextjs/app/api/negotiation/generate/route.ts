import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { chatCompleteUsage, agentModel } from '@/app/lib/gapgpt'
import { recordToken } from '@/app/lib/comm-store'

// تولیدِ پیامِ مذاکره با هوش مصنوعی، بر اساسِ «قواعدِ» تنظیم‌شده در سوپرادمین.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای استفاده وارد شوید' }, { status: 401 })

  const b = await req.json().catch(() => ({} as any))
  const title = String(b.title || 'ملک موردنظر').slice(0, 120)
  const location = String(b.location || '').slice(0, 80)
  const sellerPrice = Number(b.sellerPrice) || 0
  const offer = Number(b.offer) || 0
  const scenario = String(b.scenario || '').slice(0, 40)
  const pct = sellerPrice > 0 ? Math.round((offer / sellerPrice) * 100) : 0
  const fa = (n: number) => n > 0 ? n.toLocaleString('fa-IR') + ' تومان' : '—'

  const model = agentModel('negotiation', 'text') || agentModel('chat', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به موتور مذاکره تخصیص داده نشده — در پنل API و مدل‌های AI انتخاب کنید' }, { status: 400 })

  const rules = (getAdminData().negotiation?.rules || '').trim()
  const system = `تو یک مشاورِ املاکِ حرفه‌ای ایرانی هستی و پیامِ مذاکرهٔ خرید می‌نویسی. فقط فارسیِ روان بنویس (هیچ کلمهٔ انگلیسی، هیچ جای‌خالیِ [نام] یا [شماره]).${rules ? `\n\nقواعدِ الزامیِ نگارش که باید رعایت کنی:\n${rules}` : ''}`
  const input = `یک پیامِ مذاکرهٔ مؤدبانه و قانع‌کننده برای ارائهٔ پیشنهادِ خرید بنویس.
${scenario ? `سناریو: ${scenario}\n` : ''}ملک: ${title}${location ? ` در ${location}` : ''}
قیمتِ فروشنده: ${fa(sellerPrice)}
پیشنهادِ خریدار: ${fa(offer)}${pct ? ` (${pct}٪)` : ''}
کوتاه (۳ تا ۵ جمله)، با یک دلیلِ منطقی برای قیمت.`

  try {
    const { text, tokens } = await chatCompleteUsage(model, [{ role: 'system', content: system }, { role: 'user', content: input }])
    try { await recordToken(s.phone, s.role, tokens || Math.ceil((input.length + (text || '').length) / 3)) } catch {}
    return NextResponse.json({ ok: true, text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولیدِ پیام' }, { status: 500 })
  }
}
