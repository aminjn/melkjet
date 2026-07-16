import { NextRequest, NextResponse } from 'next/server'
import { marketOverview, soldStats } from '@/app/lib/market-stats'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('نمای بازار')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

export const dynamic = 'force-dynamic'

// تحلیلِ بازارِ واقعی — قیمتِ هر متر به تفکیکِ محله از دادهٔ واقعیِ آگهی‌ها + تحلیلِ AI.
export async function GET(req: NextRequest) {
  const u = new URL(req.url).searchParams
  const city = u.get('city') || ''
  const ov = await marketOverview(city || undefined)
  // فاز ۱۵۳ — آمارِ معامله‌های واقعیِ ثبت‌شده (کمتر از حدِ نمونه → null → کارت رندر نمی‌شود)
  const sold = await soldStats(city || undefined, u.get('district') || undefined)

  let analysis: string | null = null
  if (u.get('ai') === '1' && ov.rows.length) {
    try {
      const model = agentModel('pricing', 'text') || agentModel('summary', 'text') || 'gpt-4o-mini'
      const provider = agentProvider('pricing', 'text') || agentProvider('summary', 'text')
      const top = ov.rows.slice(0, 18).map(r => `${r.district}${r.city && r.city !== '—' ? `، ${r.city}` : ''}: ~${Math.round(r.avg / 1e6)} م.ت/متر (${r.count} آگهی)`).join('\n')
      const sys = 'تو تحلیل‌گرِ ارشدِ بازارِ مسکنِ ایران هستی. از دادهٔ واقعیِ قیمت، یک تحلیلِ کوتاهِ کاربردی به فارسی می‌نویسی. اغراق نکن و فقط بر پایهٔ همین ارقام.'
      const user = `قیمتِ هر متر (میانگین) در محله‌ها${city ? ` در ${city}` : ''}:\n${top}\n\nیک تحلیلِ ۳ تا ۴ جمله‌ای بنویس: گران‌ترین/ارزان‌ترین محله‌ها، تفاوت‌ها، و یک توصیهٔ کوتاه به خریدار/سرمایه‌گذار.`
      analysis = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.5, max_tokens: 500 }, provider)
    } catch { analysis = null }
  }
  return NextResponse.json({ ok: true, ...ov, sold, analysis })
}
