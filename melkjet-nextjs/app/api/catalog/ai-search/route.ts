import { NextRequest, NextResponse } from 'next/server'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('جستجوی هوشمندِ مصالح')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { publicCatalogFacets } from '@/app/lib/catalog-store'

export const dynamic = 'force-dynamic'

// جستجوی هوشمندِ مصالح: جملهٔ کاربر را به فیلترِ ساختاریافته تبدیل می‌کند (دسته/کلیدواژه/مرتب‌سازی).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const q = String(b.query || '').trim()
  if (!q) return NextResponse.json({ error: 'عبارت را وارد کنید' }, { status: 400 })
  const model = agentModel('content', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text')
  if (!model) return NextResponse.json({ ok: true, filter: { search: q } })   // بدونِ AI: همان جستجوی متنی
  const provider = agentProvider('content', 'text') || agentProvider('chat', 'text')
  const cats = publicCatalogFacets().categories.map(c => c.name)
  const sys = `تو دستیارِ جستجوی مصالحِ ساختمانی هستی. درخواستِ کاربر را به یک فیلترِ JSON تبدیل کن.
دسته‌های موجود: ${cats.join('، ')}.
فقط یک JSON برگردان: {"category":"<نامِ دقیقِ یکی از دسته‌ها یا خالی>","search":"<کلیدواژهٔ کالا>","sort":"<cheap|expensive|>"}
اگر کاربر «ارزان/کم‌هزینه» گفت sort=cheap. اگر دسته‌ای در لیست با درخواست می‌خواند همان را بگذار، وگرنه category خالی و فقط search.`
  try {
    const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: q }], { temperature: 0.2, max_tokens: 200 }, provider)
    const m = text.match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : {}
    const category = cats.includes(String(j.category || '')) ? String(j.category) : ''
    return NextResponse.json({ ok: true, filter: { category, search: String(j.search || q).slice(0, 60), sort: ['cheap', 'expensive'].includes(j.sort) ? j.sort : '' } })
  } catch { return NextResponse.json({ ok: true, filter: { search: q } }) }
}
