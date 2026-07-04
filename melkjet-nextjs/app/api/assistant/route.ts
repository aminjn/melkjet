import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listChats, getChat, newChat, addMessage, renameChat, deleteChat } from '@/app/lib/assistant-store'
import { agentModel, chatCompleteSafe } from '@/app/lib/gapgpt'

export const maxDuration = 60

// پرامپتِ سیستم برای هر پنل. (ویژگی‌های اختصاصی‌تر بعداً قابل افزودن است.)
const PANEL_PROMPTS: Record<string, string> = {
  buyer: 'تو «دستیار هوشمند ملکِ ملک‌جت» برای یک کاربر هستی که هم می‌تواند ملک بخرد/اجاره کند و هم ملکش را بفروشد/اجاره دهد. در انتخاب ملک، قیمت‌گذاری منصفانه، مذاکره، تنظیم آگهی و تشخیص ریسک‌ها (سند، مجوز، کیفیت ساخت) کمکش کن.',
  owner: 'تو «دستیار هوشمند فروشنده/مالکِ ملک‌جت» هستی. به مالک کمک می‌کنی ملکش را درست قیمت‌گذاری کند، آگهیِ جذاب و حرفه‌ای بنویسد، با خریداران/مستأجران مذاکره کند و سریع‌تر به فروش/اجاره برسد.',
  pros: 'تو «دستیار هوشمند مشاور املاکِ ملک‌جت» هستی. به مشاور در مدیریت لیدها، نوشتن پیام و اسکریپت فروش، تحلیل بازار و قیمت، پیگیری مشتری و بستن معامله کمک می‌کنی.',
  agency: 'تو «دستیار هوشمند آژانس املاکِ ملک‌جت» هستی. به مدیر آژانس در مدیریت تیم مشاوران، تخصیص لید، استراتژی بازاریابی، گزارش عملکرد و رشد فروش کمک می‌کنی.',
  builder: 'تو «دستیار هوشمند سازنده/انبوه‌سازِ ملک‌جت» هستی. به سازنده در فروش و پیش‌فروش واحدها، قیمت‌گذاری پروژه، جذب سرمایه‌گذار، بازاریابی پروژه و برنامه‌ریزی فروش کمک می‌کنی.',
  materials: 'تو «دستیار هوشمند تأمین‌کنندهٔ مصالحِ ملک‌جت» هستی. به فروشندهٔ مصالح در قیمت‌گذاری، مدیریت موجودی، پاسخ به استعلام مشتری، افزایش فروش و معرفی محصول کمک می‌کنی.',
}
function systemPrompt(panel: string): string {
  const base = PANEL_PROMPTS[panel] || PANEL_PROMPTS.buyer
  return `${base} فارسی، کوتاه، دقیق و کاربردی پاسخ بده؛ از تیتر و فهرست استفاده کن. اگر اطلاعاتِ لازم نیست، یک سؤالِ روشن‌کننده بپرس.`
}
function model(): string { return agentModel('chat', 'text') || agentModel('content', 'text') || 'gpt-4o-mini' }
async function aiSafe(messages: { role: string; content: string }[]): Promise<string | null> {
  try { const out = await chatCompleteSafe(model(), messages, { temperature: 0.6, max_tokens: 700 }); return out?.trim() || null } catch { return null }
}

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const panel = new URL(req.url).searchParams.get('panel') || 'buyer'
  return NextResponse.json({ chats: await listChats(s.phone, panel) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const panel = String(b.panel || 'buyer')

  switch (String(b.action)) {
    case 'ask': {
      const text = String(b.text || '').trim()
      if (!text) return NextResponse.json({ error: 'پیام خالی است' }, { status: 400 })
      const chat = await addMessage(o, panel, b.chatId ? String(b.chatId) : undefined, 'user', text)
      const history = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.text }))
      const out = await aiSafe([{ role: 'system', content: systemPrompt(panel) }, ...history])
      const answer = out || 'دستیار هوشمند فعلاً در دسترس نیست (کلید سرویس AI در پنل مدیریت تنظیم نشده). لطفاً بعداً تلاش کنید.'
      await addMessage(o, panel, chat.id, 'assistant', answer)
      return NextResponse.json({ ok: true, chat: await getChat(o, panel, chat.id), chats: await listChats(o, panel), degraded: !out })
    }
    case 'new': { const c = await newChat(o, panel); return NextResponse.json({ ok: true, chat: c, chats: await listChats(o, panel) }) }
    case 'rename': { const c = await renameChat(o, panel, String(b.id), String(b.title || '')); return c ? NextResponse.json({ ok: true, chat: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'delete': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteChat(o, panel, String(b.id)); return NextResponse.json({ ok: true, chats: await listChats(o, panel) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
