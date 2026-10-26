import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { aiFor, agentModel, aiActive, agentProvider } from '@/app/lib/gapgpt'
import { searchAssistantListings, type AssistantFilters, type AssistantCard } from '@/app/lib/assistant-listings'
import { sttConfigured, ttsConfigured, searchConfigured, selfHostSearch, type WebResult } from '@/app/lib/self-host'
import { neighbourhoodStats } from '@/app/lib/market-stats'

const { chatCompleteSafe } = aiFor('دستیارِ عمومیِ ملک‌جت')   // دفترِ مصرفِ AI
export const maxDuration = 45

// پرامپتِ پایه — با anti-hallucination (هرگز منطقه/محله/قیمتِ قطعیِ ساختگی) + آگاهی از «فایل‌ها».
const DEFAULT_SYSTEM =
  'تو «دستیار ملک‌جت» هستی — یک مشاورِ املاکِ واقعی، باتجربه و پیگیر، نه یک پاسخ‌گوی خشک. فارسی، گرم، دوستانه و راهنما باش. ' +
  'هدفِ اصلیت: با چند پرسشِ کوتاه و هوشمند، نیازِ واقعیِ کاربر را کامل بفهمی و بعد «دقیقاً» همان چیزی را که به دردش می‌خورد پیدا و لیست کنی. مثلِ یک مشاورِ دلسوز رفتار کن که تا ته ماجرا کنارِ کاربر می‌ماند. ' +
  'اگر کاربر مبهم گفت (مثلِ «خونه می‌خوام» یا «کمک می‌خوای»)، همه‌چیز را یک‌جا نپرس؛ طبیعی و پله‌پله یکی-دو سؤالِ کلیدی بپرس تا این‌ها روشن شود: معامله (خرید یا اجاره)، شهر و محله، بودجه، نوعِ ملک، متراژ/تعدادِ خواب، و هدف (سکونت یا سرمایه‌گذاری). ' +
  'به‌محضِ اینکه حداقلِ لازم (معامله + محله یا بودجه) را داشتی، معطل نکن: فایل‌های واقعیِ مناسب را «نشان بده» و با یک جملهٔ گرم معرفی کن، و بعد بپرس کدام را بیشتر پسندید یا چه چیزی را عوض کند تا دقیق‌تر شود. ' +
  'ملک‌جت آمارِ واقعیِ قیمتِ محله‌ها را از آگهی‌های فعالِ خودش دارد؛ اگر سیستم آمارِ محله‌ای به تو داد، همان عددِ واقعی را با اطمینان بگو و فعالانه راهنمایی کن: با بودجه‌ات این محله می‌خورد یا نه، کدام محلهٔ نزدیک ارزان‌تر/مناسب‌تر است، و بعد چند گزینه نشان بده. ' +
  'فقط «از خیالِ خودت» عددِ قیمت یا نگاشتِ محله‑به‑منطقهٔ شهرداری نساز؛ ولی بقیهٔ سؤال‌های ملکی (روندِ بازار، نکاتِ خرید/فروش/اجاره، مراحلِ معامله، انتخابِ محله) را کامل و مفید جواب بده. ' +
  'سؤال‌های حقوقیِ ملک (سند، مبایعه‌نامه، قرارداد اجاره، حقوقِ خریدار/مستاجر، کد رهگیری، قولنامه) را هم کاربردی جواب بده و در صورتِ پیچیدگی به دایرکتوریِ وکلای ملک‌جت (/directory?category=حقوقی) ارجاع بده. ' +
  'لحن: پیگیر، دقیق، بدونِ تعارفِ اضافه؛ همیشه یک «قدمِ بعدیِ» مشخص جلوی کاربر بگذار.'

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

  // آگاهیِ صفحه‌ای: اگر کلاینت متنِ صفحهٔ جاری را فرستاده، در پرامپت می‌نشیند تا دستیار به
  // سؤالِ «این صفحه/مقاله/ملک» از روی محتوای واقعیِ همان صفحه جواب دهد (نه از حدس).
  const pc = b?.pageContext || {}
  const pcTitle = String(pc.title || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const pcPath = String(pc.path || '').slice(0, 200)
  const pcText = String(pc.text || '').replace(/\s+/g, ' ').trim().slice(0, 2500)
  const pageNote = (pcTitle || pcText)
    ? `\n\n[صفحهٔ فعلیِ کاربر]\nعنوان: ${pcTitle}\nنشانی: ${pcPath}\nمتنِ صفحه: ${pcText}\n`
      + 'اگر سؤالِ کاربر دربارهٔ «همین صفحه/مقاله/ملک/محتوا» بود، پاسخ را از روی همین متنِ صفحه بده، نه از حدس. اگر جواب در متنِ صفحه نبود، صادقانه بگو.'
    : ''

  const model = agentModel('chat', 'text') || agentModel('content', 'text')
  const provider = agentProvider('chat', 'text') || agentProvider('content', 'text')
  const aiOn = !!model && aiActive('assistant', provider)   // aiActive خودش aiEnabled + aiAreas['assistant'] + کلید را چک می‌کند
  const system = ((cfg.systemPrompt && cfg.systemPrompt.trim()) || DEFAULT_SYSTEM) + pageNote
  const showListings = cfg.showListings !== false
  const maxResults = Math.max(1, Math.min(Number(cfg.maxResults) || 4, 8))

  let reply = ''
  let wantListings = false
  let wantPrice = false
  let wantWeb = false
  let webQuery = ''
  let filters: AssistantFilters = {}
  const webOn = searchConfigured()

  // یک فراخوانِ AI: هم تصمیمِ «فایل می‌خواهد؟»/«وب لازم است؟» + فیلترها، هم متنِ پاسخ.
  if (aiOn) {
    const extractSys = system + '\n\n' +
      'خروجی را «فقط» به‌صورتِ یک JSON بده، بدونِ هیچ متنِ اضافه:\n' +
      '{"wantListings": true|false, "wantPrice": true|false, "wantWeb": true|false, "webQuery":"", "filters": {"city":"","district":"","deal":"sale|rent|","type":"","budgetMax":0,"rooms":0,"areaMin":0,"areaMax":0}, "reply":"<پاسخِ کوتاهِ فارسی>"}\n' +
      'مشاور باش: اگر از تاریخچه و پیام «حداقلِ لازم» (معامله + محله یا بودجه) را داری، wantListings=true بگذار و reply یک معرفیِ گرم باشد مثل «این چند گزینهٔ مناسب برایت پیدا کردم — ببین کدام را بیشتر می‌پسندی:». ' +
      'اگر نیازِ کاربر هنوز مبهم است، wantListings=false و reply یک «سؤالِ راهنمای کوتاه» باشد که یکی از جاهای خالی (معامله/محله/بودجه/نوع/متراژ/هدف) را بپرسد — طبیعی و پله‌پله، نه همه با هم. فیلترهایی که از قبل معلوم‌اند را در filters نگه‌دار تا در نوبت‌های بعد گم نشوند. ' +
      'اگر کاربر دربارهٔ «قیمتِ متری/میانگینِ قیمتِ یک محله/چند بخرم» می‌پرسد wantPrice=true و district (و در صورتِ امکان city) را حتماً دربیاور. ' +
      (webOn ? 'اگر پاسخ به اطلاعاتِ «روزِ» وب نیاز دارد (خبر، نرخِ امروز، قانونِ جدید، رویدادِ تازه) wantWeb=true و webQuery یک عبارتِ جستجوی کوتاه باشد؛ وگرنه wantWeb=false. ' : 'wantWeb را همیشه false بگذار. ') +
      'budgetMax را به «تومان» بده (۱۰ میلیارد = 10000000000). اگر فیلدی معلوم نیست خالی/صفر بگذار.'
    const out = await chatCompleteSafe(model, [{ role: 'system', content: extractSys }, ...history, { role: 'user', content: message }], { temperature: 0.3, max_tokens: 500 }, provider).catch(() => null)
    if (out) {
      try {
        const j = JSON.parse((out.match(/\{[\s\S]*\}/) || ['{}'])[0])
        wantListings = !!j.wantListings
        wantPrice = !!j.wantPrice
        wantWeb = webOn && !!j.wantWeb
        webQuery = String(j.webQuery || '').trim()
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

  // پاسخِ قیمتیِ داده‌محور: اگر کاربر قیمتِ متریِ یک محله را پرسید و «دادهٔ واقعی» داریم، همان را
  // بده (نه ردِ کلی). این عدد از آگهی‌های فعالِ خودِ سایت است، پس توهم نیست.
  let priceAnswered = false
  if (wantPrice && filters.district) {
    try {
      const city = filters.city || 'تهران'
      const ns = await neighbourhoodStats(city, filters.district)
      const toM = (n: number) => Math.round(n / 1e6).toLocaleString('fa-IR')
      if (ns && ns.avg > 0 && ns.count >= 3) {
        let trendTxt = ''
        if (ns.trend && ns.trend.length >= 2) {
          const f = ns.trend[0].avg, l = ns.trend[ns.trend.length - 1].avg
          if (l > f * 1.03) trendTxt = ' روندِ قیمت در ماه‌های اخیر صعودی بوده.'
          else if (l < f * 0.97) trendTxt = ' روندِ قیمت در ماه‌های اخیر نزولی بوده.'
        }
        reply = `طبقِ آگهی‌های فروشِ فعالِ همین ملک‌جت، میانگینِ قیمتِ هر متر در ${filters.district} حدودِ ${toM(ns.avg)} میلیون تومان است (میانه ${toM(ns.median)}، بازه ${toM(ns.min)} تا ${toM(ns.max)} میلیون، از ${ns.count.toLocaleString('fa-IR')} آگهیِ مبنا).${trendTxt} حالا بگو بودجه و متراژِ موردنظرت چقدر است (و خرید یا اجاره) تا بعد دقیقاً گزینه‌های مناسبِ همین محله را برایت لیست کنم.`
        // مشاور باش: اینجا فقط قیمت + سؤال. کارت را «آخرِ کار» (وقتی بودجه/متراژ را گرفت) نشان بده، نه الان.
        priceAnswered = true
      } else {
        reply = `الان آگهیِ کافی از ${filters.district} در سیستم نیست که میانگینِ قابلِ‌اتکا بدهم. محلهٔ نزدیکِ دیگری بگو، یا بگو بودجه و نوعِ ملکت چیست تا گزینه‌های موجود را برایت بگردم.`
        priceAnswered = true
      }
    } catch { /* دادهٔ بازار در دسترس نبود → پاسخِ معمولی می‌ماند */ }
  }

  // جستجوی وب (گراندینگ): اگر لازم است و سرویس روشن، نتایجِ وب را بگیر و پاسخِ «مستند» بساز.
  let sources: WebResult[] = []
  if (wantWeb && !wantListings && aiOn) {
    try {
      sources = await selfHostSearch(webQuery || message, 5)
      if (sources.length) {
        const ctx = sources.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\n${r.url}`).join('\n\n')
        const groundSys = system + '\n\nبر اساسِ «نتایجِ جستجوی وب» زیر پاسخِ کوتاه و دقیقِ فارسی بده. فقط از همین نتایج استفاده کن و اگر جواب در آن‌ها نبود صادقانه بگو نمی‌دانی. عدد/تاریخ را از خودت نساز.'
        const g = await chatCompleteSafe(model, [{ role: 'system', content: groundSys }, { role: 'user', content: `سؤال: ${message}\n\nنتایجِ جستجو:\n${ctx}` }], { temperature: 0.3, max_tokens: 600 }, provider).catch(() => null)
        if (g && g.trim()) reply = g.trim()
      }
    } catch { /* جستجو شکست خورد → همان پاسخِ معمولی */ }
  }

  let cards: AssistantCard[] = []
  if (wantListings && showListings) {
    cards = await searchAssistantListings(filters, maxResults)
    // اگر فایلی نبود، پاسخِ قیمتی/راهنما را خراب نکن؛ فقط وقتی reply خالی/عمومی است پیام بده.
    if (!cards.length && !priceAnswered) reply = reply && !/پیدا کردم/.test(reply) ? reply : 'الان فایلی که دقیقاً با این مشخصات بخورد پیدا نکردم. می‌توانی بودجه/محله/نوع را کمی بازتر بگویی، یا در صفحهٔ «جستجو» خودت فیلتر بزنی.'
  }
  if (!reply) reply = 'در خدمتم — چطور کمکت کنم؟'

  // تبلیغ (مثلِ «نورا»): هر چند پاسخ یک‌بار، بر اساسِ شمارهٔ نوبت (از طولِ تاریخچه).
  let ad: typeof cfg.ad | undefined
  if (cfg.ad?.enabled && (cfg.ad.title || cfg.ad.text)) {
    const every = Math.max(1, Number(cfg.ad.everyTurns) || 3)
    const turn = history.filter(h => h.role === 'assistant').length + 1
    if (turn % every === 0) ad = { enabled: true, title: cfg.ad.title, text: cfg.ad.text, imageUrl: cfg.ad.imageUrl, linkUrl: cfg.ad.linkUrl, cta: cfg.ad.cta || 'بیشتر' }
  }

  return NextResponse.json({ ok: true, reply, cards, sources, ad, degraded: !aiOn && !cards.length }, { headers: { 'Cache-Control': 'no-store' } })
}
