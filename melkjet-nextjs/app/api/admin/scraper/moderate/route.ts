import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { pendingForModeration, setModeration, getItemById } from '@/app/lib/scraper-store'
import { chatCompleteSafe, agentModel } from '@/app/lib/gapgpt'

const SYS = `تو ناظر آگهی‌های املاک در ملک‌جت هستی. هر آگهی را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject|review","score":0-100,"reason":"علت کوتاه فارسی (یک جمله)"}
approve = آگهی معتبر و کامل. reject = مشکوک/ناقص/تکراری/قیمت غیرواقعی. review = نیاز به بررسی دستی.
همیشه reason را پر کن.`

function judge(text: string): { status: 'approved' | 'rejected' | 'pending'; reason: string; score: number } {
  let t = text
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0]
  try {
    const d = JSON.parse(t)
    const v = d.verdict
    const status = v === 'approve' ? 'approved' : v === 'reject' ? 'rejected' : 'pending'
    return { status, reason: String(d.reason || '').slice(0, 200), score: Math.max(0, Math.min(100, Number(d.score) || 0)) }
  } catch { return { status: 'pending', reason: 'پاسخ نامعتبر مدل', score: 0 } }
}

// POST {} → moderate a batch of pending items.  POST {id} → moderate one item.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const model = agentModel('moderation', 'text') || agentModel('chat', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت تأیید (ModerationAgent) داده نشده' }, { status: 400 })

  const items = b.id ? [getItemById(b.id)].filter(Boolean) as any[] : pendingForModeration(20)
  if (!items.length) return NextResponse.json({ ok: true, moderated: 0, results: [] })

  const results: any[] = []
  for (const it of items) {
    const info = `عنوان: ${it.title}\nقیمت: ${it.price || '-'}\nموقعیت: ${it.location || '-'}\nتوضیحات: ${(it.excerpt || '').slice(0, 600)}`
    try {
      const out = await chatCompleteSafe(model, [{ role: 'system', content: SYS }, { role: 'user', content: info }], { temperature: 0.2, max_tokens: 120 })
      const j = judge(out)
      setModeration(it.id, j.status, j.reason, j.score)
      results.push({ id: it.id, title: it.title, ...j })
    } catch (e: any) {
      results.push({ id: it.id, title: it.title, status: 'pending', reason: e?.message || 'خطا', score: 0 })
    }
  }
  return NextResponse.json({ ok: true, moderated: results.length, results })
}
