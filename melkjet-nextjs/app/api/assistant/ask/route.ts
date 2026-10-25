import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { aiFor, agentModel, aiActive, agentProvider } from '@/app/lib/gapgpt'
import { searchAssistantListings, type AssistantFilters, type AssistantCard } from '@/app/lib/assistant-listings'
import { sttConfigured, ttsConfigured } from '@/app/lib/self-host'

const { chatCompleteSafe } = aiFor('دستیارِ عمومیِ ملک‌جت')   // دفترِ مصرفِ AI
export const maxDuration = 45

// پرامپتِ پایه — با anti-hallucination (هرگز منطقه/محله/قیمتِ قطعیِ ساختگی) + آگاهی از «فایل‌ها».
const DEFAULT_SYSTEM =
  'تو «دستیار ملک‌جت» هستی، دستیارِ یک پلتفرمِ املاکِ ایرانی. فارسی، کوتاه، دقیق و دوستانه پاسخ بده. ' +
  'می‌توانی فایل‌های واقعیِ سایت را جستجو و نشان بدهی؛ اگر کاربر می‌خواهد ملک/فایل ببیند، فیلترها را دربیاور. ' +
  'هرگز شمارهٔ منطقهٔ تهران، نگاشتِ محله‑به‑منطقه یا قیمتِ دقیق را از خودت نساز و فهرست نکن؛ اگر مطمئن نیستی بپرس.'

function parseBudgetToman(text: string): number {
  const t = String(text || '')
  const num = (s: string) => parseFloat(s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,٬،]/g, '').replace(/[^\d.]/g, '')) || 0
  let m = t.match(/([\d۰-۹.,٬]+)\s*میلیارد/); if (m) return Math.round(num(m[1]) * 1e9)
  m = t.match(/([\d۰-۹.,٬]+)\s*میلیون/); if (m) return Math.round(num(m[1]) * 1e6)
  return 0
}

// استخراجِ پشتیبان بدونِ AI (اگر مدل نبود یا JSON خراب داد): کلیدواژه‌های معامله/نوع + بودجه.
function regexFilters(text: string): { want: boolean; filters: AssistantFilters } {
  const t = String(text || '')
  const want = /(فایل|آگهی|ملک|آپارتمان|ویلا|خونه|خانه|مغازه|زمین|دفتر|نشون|نشان|ببینم|پیدا|سراغ داری|داری)/.test(t)
  const filters: AssistantFilters = {}
  if (/(اجاره|رهن)/.test(t)) filters.deal = 'rent'
  else if (/(خرید|فروش|بخرم|فروشی)/.test(t)) filters.deal = 'sale'
  for (const [re, ty] of [[/آپارتمان/, 'آپارتمان'], [/ویلا/, 'ویلا'], [/زمین/, 'زمین'], [/مغازه|تجاری/, 'تجاری'], [/دفتر|اداری/, 'اداری']] as [RegExp, string][]) if (re.test(t)) filters.type = ty
  const b = parseBudgetToman(t); if (b) filters.budgetMax = b
  return { want, filters }
}

// پیکربندیِ عمومیِ ویجت (خوش‌آمد/دکمه‌ها/روشن‌بودن + در دسترس‌بودنِ صدا) — بدونِ هیچ دادهٔ حساس.
export async function GET() {
  const cfg = getAdminData().assistant || {}
  return NextResponse.json({
    enabled: cfg.enabled !== false,
    greeting: cfg.greeting || '',
    chips: Array.isArray(cfg.chips) ? cfg.chips.slice(0, 6) : [],
    voice: { stt: sttConfigured(), tts: ttsConfigured() },   // دکمهٔ میکروفون/بلندگو فقط وقتی سرویسِ خودی روشن باشد
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const cfg = getAdminData().assistant || {}
  if (cfg.enabled === false) return NextResponse.json({ error: 'دستیار موقتاً غیرفعال است' }, { status: 503 })

  const b = await req.json().catch(() => ({} as any))
  const message = String(b?.message || '').trim().slice(0, 2000)
  if (!message) return NextResponse.json({ error: 'پیام خالی است' }, { status: 400 })
  const history: { role: string; content: string }[] = Array.isArray(b?.history)
    ? b.history.filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && m?.content).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) })).slice(-8)
    : []

  const model = agentModel('chat', 'text') || agentModel('content', 'text')
  const provider = agentProvider('chat', 'text') || agentProvider('content', 'text')
  const aiOn = !!model && aiActive('assistant', provider)   // aiActive خودش aiEnabled + aiAreas['assistant'] + کلید را چک می‌کند
  const system = (cfg.systemPrompt && cfg.systemPrompt.trim()) || DEFAULT_SYSTEM
  const showListings = cfg.showListings !== false
  const maxResults = Math.max(1, Math.min(Number(cfg.maxResults) || 4, 8))

  let reply = ''
  let wantListings = false
  let filters: AssistantFilters = {}

  // یک فراخوانِ AI: هم تصمیمِ «فایل می‌خواهد؟» + فیلترها، هم متنِ پاسخ.
  if (aiOn) {
    const extractSys = system + '\n\n' +
      'خروجی را «فقط» به‌صورتِ یک JSON بده، بدونِ هیچ متنِ اضافه:\n' +
      '{"wantListings": true|false, "filters": {"city":"","district":"","deal":"sale|rent|","type":"","budgetMax":0,"rooms":0,"areaMin":0,"areaMax":0}, "reply":"<پاسخِ کوتاهِ فارسی>"}\n' +
      'اگر کاربر می‌خواهد فایل/ملک ببیند wantListings=true و reply یک جملهٔ کوتاهِ مقدمه مثل «این چند فایلِ مناسب پیدا کردم:» باشد. ' +
      'budgetMax را به «تومان» بده (۱۰ میلیارد = 10000000000). اگر فیلدی معلوم نیست خالی/صفر بگذار.'
    const out = await chatCompleteSafe(model, [{ role: 'system', content: extractSys }, ...history, { role: 'user', content: message }], { temperature: 0.3, max_tokens: 500 }, provider).catch(() => null)
    if (out) {
      try {
        const j = JSON.parse((out.match(/\{[\s\S]*\}/) || ['{}'])[0])
        wantListings = !!j.wantListings
        reply = String(j.reply || '').trim()
        const ff = j.filters || {}
        filters = {
          city: String(ff.city || '').trim() || undefined,
          district: String(ff.district || '').trim() || undefined,
          deal: ff.deal === 'sale' ? 'sale' : ff.deal === 'rent' ? 'rent' : undefined,
          type: String(ff.type || '').trim() || undefined,
          budgetMax: Number(ff.budgetMax) > 0 ? Number(ff.budgetMax) : undefined,
          rooms: Number(ff.rooms) > 0 ? Number(ff.rooms) : undefined,
          areaMin: Number(ff.areaMin) > 0 ? Number(ff.areaMin) : undefined,
          areaMax: Number(ff.areaMax) > 0 ? Number(ff.areaMax) : undefined,
        }
      } catch { reply = out.trim() }
    }
  }

  // پشتیبان: اگر AI نبود/خالی داد، از کلیدواژه + بودجه استفاده کن.
  if (!reply && !wantListings) {
    const rf = regexFilters(message)
    wantListings = rf.want
    filters = { ...rf.filters, ...filters }
    reply = wantListings ? 'این چند فایلِ مناسب پیدا کردم:' : 'بگو دنبالِ چه ملکی هستی (خرید/اجاره، شهر و محله، بودجه و متراژ) تا فایل‌های مناسب را نشانت بدهم.'
  }
  // بودجه را از متن هم تکمیل کن (مدل گاهی عددِ تومان را اشتباه می‌دهد).
  if (!filters.budgetMax) { const bb = parseBudgetToman(message + ' ' + history.map(h => h.content).join(' ')); if (bb) filters.budgetMax = bb }

  let cards: AssistantCard[] = []
  if (wantListings && showListings) {
    cards = await searchAssistantListings(filters, maxResults)
    if (!cards.length) reply = reply && !/پیدا کردم/.test(reply) ? reply : 'الان فایلی که دقیقاً با این مشخصات بخورد پیدا نکردم. می‌توانی بودجه/محله/نوع را کمی بازتر بگویی، یا در صفحهٔ «جستجو» خودت فیلتر بزنی.'
  }
  if (!reply) reply = 'در خدمتم — چطور کمکت کنم؟'

  // تبلیغ (مثلِ «نورا»): هر چند پاسخ یک‌بار، بر اساسِ شمارهٔ نوبت (از طولِ تاریخچه).
  let ad: typeof cfg.ad | undefined
  if (cfg.ad?.enabled && (cfg.ad.title || cfg.ad.text)) {
    const every = Math.max(1, Number(cfg.ad.everyTurns) || 3)
    const turn = history.filter(h => h.role === 'assistant').length + 1
    if (turn % every === 0) ad = { enabled: true, title: cfg.ad.title, text: cfg.ad.text, imageUrl: cfg.ad.imageUrl, linkUrl: cfg.ad.linkUrl, cta: cfg.ad.cta || 'بیشتر' }
  }

  return NextResponse.json({ ok: true, reply, cards, ad, degraded: !aiOn && !cards.length }, { headers: { 'Cache-Control': 'no-store' } })
}
