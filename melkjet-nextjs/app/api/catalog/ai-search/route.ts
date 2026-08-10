import { NextRequest, NextResponse } from 'next/server'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('جستجوی هوشمندِ مصالح')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { publicCatalogFacets } from '@/app/lib/catalog-store'
import { mlFirst } from '@/app/lib/ml-gateway'

export const dynamic = 'force-dynamic'

const norm = (s: string) => String(s || '').replace(/‌/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim()
type Filter = { category?: string; search: string; sort?: string }

// مدلِ محلیِ «اول ماشین‌لرنینگ»: اگر نامِ یکی از دسته‌ها عیناً در جمله باشد، یا کلیدواژهٔ
// ارزان/گران دیده شود، بدونِ AI فیلتر ساخته می‌شود. جملهٔ مبهم → AI (و بعد کش می‌شود).
function localParse(q: string, cats: string[]): { value: Filter; confident: boolean } {
  const nq = norm(q)
  const sort = /ارزان|ارزون|کم.?هزینه|پایین.?ترین|اقتصادی/.test(nq) ? 'cheap'
    : /گران|لوکس|بالاترین|درجه.?یک|premium/i.test(nq) ? 'expensive' : ''
  const category = cats.find(c => c && nq.includes(norm(c))) || ''
  // مطمئن = دسته‌ای عیناً پیدا شد (نگاشتِ قطعی روی مجموعهٔ بستهٔ دسته‌ها).
  return { value: { category, search: q.slice(0, 60), sort }, confident: !!category }
}

// جستجوی هوشمندِ مصالح: جملهٔ کاربر را به فیلترِ ساختاریافته تبدیل می‌کند (دسته/کلیدواژه/مرتب‌سازی).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const q = String(b.query || '').trim()
  if (!q) return NextResponse.json({ error: 'عبارت را وارد کنید' }, { status: 400 })
  const cats = publicCatalogFacets().categories.map(c => c.name)
  const model = agentModel('content', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text')
  // بدونِ AI: همان مدلِ محلی، وگرنه جستجوی متنیِ ساده.
  if (!model) { const p = localParse(q, cats); return NextResponse.json({ ok: true, filter: p.confident ? p.value : { search: q } }) }
  const provider = agentProvider('content', 'text') || agentProvider('chat', 'text')
  const sys = `تو دستیارِ جستجوی مصالحِ ساختمانی هستی. درخواستِ کاربر را به یک فیلترِ JSON تبدیل کن.
دسته‌های موجود: ${cats.join('، ')}.
فقط یک JSON برگردان: {"category":"<نامِ دقیقِ یکی از دسته‌ها یا خالی>","search":"<کلیدواژهٔ کالا>","sort":"<cheap|expensive|>"}
اگر کاربر «ارزان/کم‌هزینه» گفت sort=cheap. اگر دسته‌ای در لیست با درخواست می‌خواند همان را بگذار، وگرنه category خالی و فقط search.`

  // دروازهٔ سه‌پله: کش دقیق → مدلِ محلی (اگر مطمئن) → AI (و کش‌شدنِ جوابش برای دفعهٔ بعد).
  const { value } = await mlFirst<Filter>({
    task: 'catalog-search',
    key: norm(q) + '|' + cats.length,
    predict: () => localParse(q, cats),
    validate: (f) => !!f && typeof f.search === 'string',
    ai: async () => {
      try {
        const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: q }], { temperature: 0.2, max_tokens: 200 }, provider)
        const m = text.match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : {}
        const category = cats.includes(String(j.category || '')) ? String(j.category) : ''
        return { category, search: String(j.search || q).slice(0, 60), sort: ['cheap', 'expensive'].includes(j.sort) ? j.sort : '' }
      } catch { return { search: q } }
    },
  })
  return NextResponse.json({ ok: true, filter: value })
}
