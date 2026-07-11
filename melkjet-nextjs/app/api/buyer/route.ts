import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  buyerStats, listSaved, listSearches, listViewings, listOffers, listMessages,
  addSaved, removeSaved, addSearch, toggleSearchAlerts, deleteSearch,
  addViewing, setViewingStatus, addOffer, withdrawOffer, markMessageRead, markAllRead, updateBuyerProfile,
  getBuyerSettings, updateBuyerSettings, requestVerification,
  getBuyer, listConversations, startConversation, addChatMessage, getConversation,
  upsertPropertyConversation, listAiChats, getAiChat, newAiChat, addAiChatMessage, renameAiChat, deleteAiChat,
} from '@/app/lib/buyer-store'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('پنلِ خریدار')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

export const maxDuration = 60

// مدلِ متنیِ دستیار خریدار (ChatAgent → fallback)
function buyerModel(): string {
  return agentModel('chat', 'text') || agentModel('content', 'text') || 'gpt-4o-mini'
}
// تماسِ امن با AI؛ اگر تنظیم نشده یا خطا داد، null برمی‌گرداند تا fallback اعمال شود.
async function aiSafe(messages: { role: string; content: string }[], opts?: { temperature?: number; max_tokens?: number }): Promise<string | null> {
  try {
    const out = await chatCompleteSafe(buyerModel(), messages, { temperature: opts?.temperature ?? 0.6, max_tokens: opts?.max_tokens ?? 600 })
    return out?.trim() || null
  } catch { return null }
}
// پاسخِ «صاحب آگهی» — اگر AI تنظیم باشد نقش‌بازی می‌کند، وگرنه پاسخِ آماده.
async function ownerReply(propertyTitle: string, ownerName: string, history: { from: string; text: string }[]): Promise<{ text: string; ai: boolean }> {
  const sys = {
    role: 'system',
    content: `تو نقشِ «${ownerName}»، صاحب/مشاورِ آگهیِ «${propertyTitle}» را بازی می‌کنی و با یک خریدار در ملک‌جت چت می‌کنی. فارسی، کوتاه (حداکثر ۲ جمله)، مودب و واقع‌گرا پاسخ بده؛ مثل یک فروشندهٔ منطقی که می‌خواهد معامله را پیش ببرد. اطلاعاتِ ساختگیِ معقول بده (قیمت، طبقه، زمان بازدید) اما اغراق نکن.`,
  }
  const msgs = [sys, ...history.map(m => ({ role: m.from === 'buyer' ? 'user' : 'assistant', content: m.text }))]
  const out = await aiSafe(msgs, { temperature: 0.8, max_tokens: 160 })
  if (out) return { text: out, ai: true }
  return { text: 'سلام، ممنون از پیام شما. به‌زودی جزئیات را بررسی می‌کنم و پاسخ می‌دهم.', ai: false }
}

// خلاصهٔ پروفایلِ خریدار برای زمینه‌دادن به مدل
async function buyerContext(o: string): Promise<string> {
  const b = await getBuyer(o)
  const p = b.profile
  const budget = p.budget ? `${Math.round(p.budget / 1e9 * 10) / 10} میلیارد تومان` : 'نامشخص'
  const saved = b.saved.slice(0, 4).map(s => `«${s.title}» (${s.location}، ${s.area}م، ${s.deal === 'rent' ? 'اجاره' : 'فروش'})`).join('؛ ') || 'ندارد'
  return `نام خریدار: ${p.name || 'کاربر'}. بودجه: ${budget}. نوع موردنظر: ${p.prefType || 'نامشخص'}. مناطق: ${p.areas || 'نامشخص'}. ملک‌های ذخیره‌شده: ${saved}.`
}

// همهٔ دادهٔ پنل خریدار، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const o = s.phone
  return NextResponse.json({
    stats: await buyerStats(o),
    profile: (await getBuyer(o)).profile,
    settings: await getBuyerSettings(o),
    phone: s.phone,
    saved: await listSaved(o),
    searches: await listSearches(o),
    viewings: await listViewings(o),
    offers: await listOffers(o),
    messages: await listMessages(o),
    conversations: await listConversations(o),
    aiChats: await listAiChats(o),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addSaved': return NextResponse.json({ ok: true, item: await addSaved(o, b) })
    case 'removeSaved': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await removeSaved(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addSearch': if (!b.query) return NextResponse.json({ error: 'عبارت جستجو الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, search: await addSearch(o, b) })
    case 'toggleSearchAlerts': { const q = await toggleSearchAlerts(o, String(b.id)); return q ? NextResponse.json({ ok: true, search: q }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'deleteSearch': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteSearch(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'addViewing': if (!b.propertyTitle || !b.date) return NextResponse.json({ error: 'ملک و تاریخ الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, viewing: await addViewing(o, { propertyTitle: String(b.propertyTitle), advisor: b.advisor, date: String(b.date) }) })
    case 'setViewingStatus': { const v = await setViewingStatus(o, String(b.id), b.status); return v ? NextResponse.json({ ok: true, viewing: v }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'addOffer': if (!b.propertyTitle) return NextResponse.json({ error: 'ملک الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, offer: await addOffer(o, { propertyTitle: String(b.propertyTitle), amount: Number(b.amount) || 0 }) })
    case 'withdrawOffer': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await withdrawOffer(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'markMessageRead': { const m = await markMessageRead(o, String(b.id)); return m ? NextResponse.json({ ok: true, message: m }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'markAllRead': await markAllRead(o); return NextResponse.json({ ok: true })
    case 'updateProfile': return NextResponse.json({ ok: true, profile: await updateBuyerProfile(o, b.patch || {}) })
    case 'updateSettings': return NextResponse.json({ ok: true, settings: await updateBuyerSettings(o, b.patch || {}) })
    case 'requestVerification': return NextResponse.json({ ok: true, verifyStatus: await requestVerification(o) })

    // ── چت با صاحب آگهی ──
    case 'startConversation': {
      if (!b.propertyTitle || !b.text) return NextResponse.json({ error: 'ملک و متن پیام الزامی است' }, { status: 400 })
      const c = await startConversation(o, { ownerName: b.ownerName, propertyTitle: String(b.propertyTitle), text: String(b.text) })
      const reply = await ownerReply(String(b.propertyTitle), String(b.ownerName || 'صاحب آگهی'), [{ from: 'buyer', text: String(b.text) }])
      await addChatMessage(o, c.id, 'owner', reply.text, reply.ai)
      return NextResponse.json({ ok: true, conversation: await getConversation(o, c.id) })
    }
    case 'propertyChat': {
      // از صفحهٔ آگهی: گفتگوی همان ملک را پیدا/ایجاد و پیام را ارسال می‌کند.
      if (!b.propertyTitle || !b.text) return NextResponse.json({ error: 'ملک و متن پیام الزامی است' }, { status: 400 })
      const conv = await upsertPropertyConversation(o, { propertyId: String(b.propertyId || ''), ownerName: b.ownerName, propertyTitle: String(b.propertyTitle) })
      await addChatMessage(o, conv.id, 'buyer', String(b.text))
      const fresh = (await getConversation(o, conv.id))!
      const reply = await ownerReply(fresh.propertyTitle, fresh.ownerName, fresh.messages.map(m => ({ from: m.from, text: m.text })))
      await addChatMessage(o, conv.id, 'owner', reply.text, reply.ai)
      return NextResponse.json({ ok: true, conversation: await getConversation(o, conv.id) })
    }
    case 'sendChat': {
      if (!b.id || !b.text) return NextResponse.json({ error: 'گفتگو و متن الزامی است' }, { status: 400 })
      const conv = await getConversation(o, String(b.id))
      if (!conv) return NextResponse.json({ error: 'گفتگو یافت نشد' }, { status: 404 })
      await addChatMessage(o, conv.id, 'buyer', String(b.text))
      const history = [...conv.messages.map(m => ({ from: m.from, text: m.text })), { from: 'buyer' as const, text: String(b.text) }]
      const reply = await ownerReply(conv.propertyTitle, conv.ownerName, history)
      await addChatMessage(o, conv.id, 'owner', reply.text, reply.ai)
      return NextResponse.json({ ok: true, conversation: await getConversation(o, conv.id) })
    }

    // ── دستیار هوشمند (چند گفتگو) ──
    case 'aiAsk': {
      const text = String(b.text || '').trim()
      if (!text) return NextResponse.json({ error: 'پیام خالی است' }, { status: 400 })
      // پیامِ کاربر را در گفتگوی جاری (یا گفتگوی جدید) ثبت می‌کنیم
      const chat = await addAiChatMessage(o, b.chatId ? String(b.chatId) : undefined, 'user', text)
      const history = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.text }))
      const sys = {
        role: 'system',
        content: `تو «دستیار هوشمند ملکِ ملک‌جت» هستی؛ یک مشاور املاک خبره، صادق و فارسی‌زبان. به کاربر کمک می‌کنی ملک مناسب (خرید یا اجاره) پیدا کند، قیمت منصفانه را تشخیص دهد، در مذاکره برنده شود و ریسک‌ها (سند، مجوز، کیفیت ساخت) را بشناسد. کوتاه، دقیق و کاربردی پاسخ بده؛ از تیتر و فهرست استفاده کن. اگر اطلاعاتِ لازم نیست، یک سؤالِ روشن‌کننده بپرس. مشخصاتِ این کاربر: ${await buyerContext(o)}`,
      }
      const out = await aiSafe([sys, ...history])
      const answer = out || 'دستیار هوشمند فعلاً در دسترس نیست (کلید سرویس AI در پنل مدیریت تنظیم نشده). لطفاً بعداً تلاش کنید.'
      await addAiChatMessage(o, chat.id, 'assistant', answer)
      return NextResponse.json({ ok: true, chat: await getAiChat(o, chat.id), chats: await listAiChats(o), degraded: !out })
    }
    case 'aiNewChat': { const c = await newAiChat(o); return NextResponse.json({ ok: true, chat: c, chats: await listAiChats(o) }) }
    case 'aiRenameChat': { const c = await renameAiChat(o, String(b.id), String(b.title || '')); return c ? NextResponse.json({ ok: true, chat: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'aiDeleteChat': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteAiChat(o, String(b.id)); return NextResponse.json({ ok: true, chats: await listAiChats(o) })
    case 'aiDraft': {
      // پیشنهادِ متنِ پیام برای تماس با صاحب آگهی
      const title = String(b.propertyTitle || 'این ملک')
      const goal = String(b.goal || 'هماهنگی بازدید و پرسش دربارهٔ قیمت')
      const out = await aiSafe([
        { role: 'system', content: 'تو به خریدار کمک می‌کنی یک پیامِ کوتاه، مودبانه و حرفه‌ایِ فارسی برای تماس با صاحب آگهی بنویسد. فقط متنِ پیام را برگردان، بدون توضیح اضافه. حداکثر ۳ جمله.' },
        { role: 'user', content: `ملک: ${title}. هدف: ${goal}. مشخصاتِ من: ${await buyerContext(o)}` },
      ], { temperature: 0.7, max_tokens: 200 })
      const draft = out || `سلام، دربارهٔ «${title}» تماس می‌گیرم. آیا هنوز موجود است و امکان هماهنگی بازدید در این هفته وجود دارد؟ ممنون می‌شوم قیمت نهایی را هم بفرمایید.`
      return NextResponse.json({ ok: true, draft, degraded: !out })
    }

    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
