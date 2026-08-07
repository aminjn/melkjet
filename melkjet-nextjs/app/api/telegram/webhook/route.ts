// فاز ۲۵۳ج — وب‌هوکِ ربات + جریان معامله→شهر→منطقه→محله. پاسخِ فوری، پردازش در پس‌زمینه
// (چون هر تماسِ تلگرام از پروکسی کند است؛ وگرنه تلگرام timeout و صف گیر می‌کند).
import { NextRequest, NextResponse } from 'next/server'
import { tgApi, tgSend } from '@/app/lib/telegram'
import { getDraft, setDraft, clearDraft, addSub, listSubs, removeSub } from '@/app/lib/telegram-store'
import { sendTest, regionsForCity, hoodsForRegion, seedChannel } from '@/app/lib/telegram-notify'

export const dynamic = 'force-dynamic'

const CITIES = ['تهران', 'مشهد', 'کرج', 'اصفهان', 'شیراز', 'تبریز']
// فاز ۲۵۵ — چتِ ادمین برای دستورهای مدیریتی (chat id در env). خالی = هیچ ادمینی.
const isAdmin = (chatId: number) => !!process.env.TELEGRAM_ADMIN_CHAT && String(chatId) === process.env.TELEGRAM_ADMIN_CHAT
type Btn = { t: string; d: string }
function kb(rows: Btn[][]) { return { inline_keyboard: rows.map(r => r.map(b => ({ text: b.t, callback_data: b.d }))) } }
const menu = kb([[{ t: '➕ آلارمِ جدید', d: 'new' }], [{ t: '🔔 آلارم‌های من', d: 'mine' }]])
const dealLabel = (d: string) => (d === 'همه' ? 'خرید/اجاره' : d)
const subLabel = (s: { deal: string; city: string; region: string; hood: string }) =>
  `${dealLabel(s.deal)} · ${s.city}${s.region ? ' · ' + s.region : ''}${s.hood ? ' · ' + s.hood : ''}`

async function startFlow(chatId: number, mid?: number) {
  await setDraft(chatId, { step: 'deal' })
  const rm = kb([[{ t: '🏠 اجاره', d: 'd:اجاره' }, { t: '🔑 فروش', d: 'd:فروش' }], [{ t: 'همه', d: 'd:همه' }]])
  const text = 'یک آلارمِ جدید بسازیم 🔔\nنوعِ معامله؟'
  if (mid) await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text, reply_markup: rm })
  else await tgSend(chatId, text, { reply_markup: rm })
}
async function askCity(chatId: number, mid: number) {
  const rows: Btn[][] = []
  for (let i = 0; i < CITIES.length; i += 2) rows.push(CITIES.slice(i, i + 2).map(c => ({ t: c, d: 'c:' + c })))
  rows.push([{ t: 'سایر شهرها ✍️', d: 'c:__other' }])
  await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: 'شهر؟', reply_markup: kb(rows) })
}
async function presentRegions(chatId: number, deal: string | undefined, city: string) {
  const regions = await regionsForCity(city, 18)
  await setDraft(chatId, { step: 'region', deal, city, regions })
  if (!regions.length) { await presentHoods(chatId, deal, city, ''); return }
  const rows: Btn[][] = []
  for (let i = 0; i < regions.length; i += 2) rows.push(regions.slice(i, i + 2).map((r, k) => ({ t: r, d: 'r:' + (i + k) })))
  rows.push([{ t: 'همهٔ مناطق', d: 'r:__all' }, { t: 'منطقهٔ دیگر ✍️', d: 'r:__text' }])
  await tgSend(chatId, `منطقه را انتخاب کن (${city}):`, { reply_markup: kb(rows) })
}
async function presentHoods(chatId: number, deal: string | undefined, city: string, region: string) {
  const hoods = await hoodsForRegion(city, region, 14)
  await setDraft(chatId, { step: 'hood', deal, city, region, hoods })
  if (!hoods.length) { await tgSend(chatId, 'محلهٔ موردنظرت را بنویس، یا «همهٔ محله‌ها».', { reply_markup: kb([[{ t: 'همهٔ محله‌ها', d: 'h:__all' }]]) }); return }
  const rows: Btn[][] = []
  for (let i = 0; i < hoods.length; i += 2) rows.push(hoods.slice(i, i + 2).map((h, k) => ({ t: h, d: 'h:' + (i + k) })))
  rows.push([{ t: 'همهٔ محله‌ها', d: 'h:__all' }, { t: 'محلهٔ دیگر ✍️', d: 'h:__text' }])
  await tgSend(chatId, region ? `محله را در «${region}» انتخاب کن؛ یا نامش را بنویس:` : 'محله را انتخاب کن؛ یا نامش را بنویس:', { reply_markup: kb(rows) })
}
async function saveSub(chatId: number, deal: string, city: string, region: string, hood: string) {
  await addSub({ chatId, deal, city, region, hood }); await clearDraft(chatId)
  await tgSend(chatId, `✅ آلارم ذخیره شد:\n<b>${subLabel({ deal, city, region, hood })}</b>\n\nبه‌محضِ آگهیِ منطبقِ جدید، همین‌جا خبرت می‌کنم.`, { reply_markup: menu })
}
async function showMine(chatId: number) {
  const subs = await listSubs(chatId)
  if (!subs.length) { await tgSend(chatId, 'هنوز آلارمی نداری. «➕ آلارمِ جدید» را بزن.', { reply_markup: menu }); return }
  for (const s of subs) await tgSend(chatId, `🔔 ${subLabel(s)}`, { reply_markup: kb([[{ t: '🗑 حذف', d: 'del:' + s.id }]]) })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handle(u: any) {
  const cq = u?.callback_query
  if (cq) {
    const chatId = cq.message?.chat?.id; const mid = cq.message?.message_id; const data = String(cq.data || '')
    await tgApi('answerCallbackQuery', { callback_query_id: cq.id })
    if (!chatId) return
    if (data === 'new') await startFlow(chatId, mid)
    else if (data === 'mine') await showMine(chatId)
    else if (data.startsWith('d:')) { await setDraft(chatId, { step: 'city', deal: data.slice(2) }); await askCity(chatId, mid) }
    else if (data.startsWith('c:')) {
      const city = data.slice(2); const dr = await getDraft(chatId)
      if (city === '__other') { await setDraft(chatId, { step: 'cityText', deal: dr?.deal }); await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: 'نامِ شهر را بنویس:' }) }
      else { await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: `شهر: ${city} ✅` }); await presentRegions(chatId, dr?.deal, city) }
    }
    else if (data === 'r:__all') { const dr = await getDraft(chatId); if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, '', '') }
    else if (data === 'r:__text') { const dr = await getDraft(chatId); await setDraft(chatId, { step: 'regionText', deal: dr?.deal, city: dr?.city }); await tgSend(chatId, 'نامِ منطقه را بنویس:') }
    else if (data.startsWith('r:')) { const dr = await getDraft(chatId); const i = parseInt(data.slice(2), 10); const region = (dr?.regions && dr.regions[i]) || ''; await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: `منطقه: ${region} ✅` }); await presentHoods(chatId, dr?.deal, dr?.city || '', region) }
    else if (data === 'h:__all') { const dr = await getDraft(chatId); if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, dr.region || '', '') }
    else if (data === 'h:__text') { const dr = await getDraft(chatId); await setDraft(chatId, { step: 'hood', deal: dr?.deal, city: dr?.city, region: dr?.region }); await tgSend(chatId, 'نامِ محله را بنویس:') }
    else if (data.startsWith('h:')) { const dr = await getDraft(chatId); const i = parseInt(data.slice(2), 10); const h = (dr?.hoods && dr.hoods[i]) || ''; if (dr?.deal && dr.city) await saveSub(chatId, dr.deal, dr.city, dr.region || '', h) }
    else if (data.startsWith('del:')) { await removeSub(chatId, data.slice(4)); await tgApi('editMessageText', { chat_id: chatId, message_id: mid, text: '🗑 حذف شد.' }) }
    return
  }
  const msg = u?.message; const chatId = msg?.chat?.id
  const text = String(msg?.text || '').trim(); const first = (msg?.from?.first_name || 'دوست').toString()
  if (!chatId || !text) return
  if (text === '/start') { await clearDraft(chatId); await tgSend(chatId, `سلام ${first} 👋\nبه رباتِ <b>ملک‌جت</b> خوش آمدی.\nآلارمِ آگهیِ ملک بساز تا به‌محضِ ثبتِ آگهیِ منطبق، همین‌جا خبرت کنم 🔔`, { reply_markup: menu }) }
  else if (text === '/ping') { await tgSend(chatId, '🏓 pong') }
  else if (text === '/testalert') { const ok = await sendTest(chatId); if (!ok) await tgSend(chatId, 'فعلاً آگهیِ منطبقی نیست — اول یک آلارم بساز.') }
  else if (text === '/whoami') { await tgSend(chatId, `chat id شما: <code>${chatId}</code>`) }
  else if (text.startsWith('/pushchannel')) {
    if (!isAdmin(chatId)) { await tgSend(chatId, '⛔ فقط ادمین.') }
    else { const n = parseInt(text.split(/\s+/)[1] || '5', 10) || 5; const c = await seedChannel(n); await tgSend(chatId, c ? `✅ ${c} آگهی به کانال پست شد.` : '⚠️ کانال تنظیم نشده (TELEGRAM_CHANNEL) یا آگهیِ عمومی‌ای نیست.') }
  }
  else {
    const dr = await getDraft(chatId)
    if (dr?.step === 'cityText') { await tgSend(chatId, `شهر: ${text} ✅`); await presentRegions(chatId, dr.deal, text) }
    else if (dr?.step === 'regionText') { await tgSend(chatId, `منطقه: ${text} ✅`); await presentHoods(chatId, dr.deal, dr.city || '', text) }
    else if (dr?.step === 'hood' && dr.deal && dr.city) { await saveSub(chatId, dr.deal, dr.city, dr.region || '', text) }
    else { await tgSend(chatId, 'برای شروع «➕ آلارمِ جدید» را بزن یا /start.', { reply_markup: menu }) }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) return NextResponse.json({ ok: false }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (await req.json().catch(() => null)) as any
  if (u) handle(u).catch(e => console.warn('[tg] handle:', (e as Error).message))   // پس‌زمینه
  return NextResponse.json({ ok: true })                                            // پاسخِ فوری
}
export async function GET() { return NextResponse.json({ ok: true, service: 'telegram-webhook' }) }
