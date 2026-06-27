import { allWorkflows, type Workflow, type WorkflowNode } from './workflow-store'
import { getAdvisor, addAppt, setLeadStage, updateLead } from './advisor-store'
import { sendServiceSms } from './sms'
import { getWfState, setWfState } from './workflow-runner-store'
import { chatCompleteSafe, resolveAgent } from './gapgpt'

// موتورِ اجرای اتوماسیون. هر گردش‌کارِ «فعال» را با تریگرِ آن می‌سنجد و اکشن‌های متصل را
// روی رویدادهای جدید (لید/قرارِ تازه) اجرا می‌کند. تنها رویدادهای جدید (بعد از فعال‌سازی)
// پردازش می‌شوند و هر رویداد فقط یک‌بار (با مجموعهٔ done) اجرا می‌شود.

interface Ctx { id: string; leadId?: string; phone?: string; name?: string; need?: string; budget?: string; ai?: string }

function nextNodes(wf: Workflow, fromId: string): WorkflowNode[] {
  return wf.connections.filter(c => c.from === fromId).map(c => wf.nodes.find(n => n.id === c.to)).filter(Boolean) as WorkflowNode[]
}

function interpolate(tpl: string, ctx: Ctx): string {
  return String(tpl || '')
    .replace(/\{\s*(نام|name)\s*\}/g, ctx.name || 'مشتری')
    .replace(/\{\s*(نیاز|need)\s*\}/g, ctx.need || '')
    .replace(/\{\s*(بودجه|budget)\s*\}/g, ctx.budget || '')
    .replace(/\{\s*(تحلیل|ai)\s*\}/g, ctx.ai || '')
}

const num = (s?: string) => { const n = parseInt(String(s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0 }

// شرط را می‌سنجد: اگر برقرار بود true (ادامه)، وگرنه false (توقفِ این شاخه).
function evalCondition(node: WorkflowNode, ctx: Ctx): boolean {
  const op = node.config?.operator || ''
  const val = node.config?.value || ''
  const fieldHint = (node.config?.field || '') + ' ' + node.label
  const isBudget = /بودجه|قیمت/.test(fieldHint)
  const isRegion = /منطقه|محله|شهر|مکان/.test(fieldHint)
  if (isBudget) {
    const a = num(ctx.budget), b = num(val)
    if (!b) return true   // مقدارِ مرجع تنظیم نشده → مانع نشو
    if (/کوچک|کمتر|</.test(op)) return a < b
    if (/برابر|=/.test(op)) return a === b
    return a > b   // پیش‌فرض: بزرگ‌تر از
  }
  if (isRegion) {
    const hay = `${ctx.need || ''} ${ctx.name || ''}`
    return val ? hay.includes(val) : true
  }
  return true   // شرطِ ناشناخته → عبوری
}

// از یک گره، شاخهٔ پاییندست را اجرا می‌کند: شرط شاخه را می‌بندد، AI تحلیل می‌سازد.
async function runFrom(owner: string, wf: Workflow, fromNode: WorkflowNode, ctx: Ctx, depth = 0) {
  if (depth > 20) return
  for (const node of nextNodes(wf, fromNode.id)) {
    try {
      if (node.type === 'condition') {
        if (!evalCondition(node, ctx)) continue   // شرط برقرار نیست → این شاخه را نرو
      } else if (node.type === 'ai') {
        const { model } = resolveAgent([['lead', 'text'], ['content', 'text'], ['chat', 'text']])
        const task = node.config?.prompt
          || (node.label.includes('قیمت') ? 'بر اساس نیاز و بودجه، یک بازهٔ قیمتِ پیشنهادی و یک جملهٔ مذاکره بده.'
            : node.label.includes('ملک') ? 'یک توضیحِ کوتاه و جذاب برای ملکِ متناسب با این نیاز بنویس.'
              : 'این لید را در ۲ جمله تحلیل کن و یک اقدامِ بعدی پیشنهاد بده.')
        try {
          const out = await chatCompleteSafe(model || 'gpt-4o-mini', [
            { role: 'system', content: 'تو دستیارِ فروشِ املاک هستی. کوتاه، فارسی و کاربردی پاسخ بده.' },
            { role: 'user', content: `${task}\nنام: ${ctx.name || '-'}\nنیاز: ${ctx.need || '-'}\nبودجه: ${ctx.budget || '-'}` },
          ], { max_tokens: 220 })
          if (out && out.trim()) {
            ctx.ai = out.trim()
            if (ctx.leadId) updateLead(owner, ctx.leadId, { note: `🤖 ${ctx.ai}` })
          }
        } catch { /* AI در دسترس نبود → بدونِ تحلیل ادامه بده */ }
      } else if (node.type === 'action') {
        if (node.label.includes('پیام')) {                       // ارسال پیام (پیامک به لید)
          const msg = interpolate(node.config?.template || node.config?.message || `سلام${ctx.name ? ' ' + ctx.name : ''}، از ملک‌جت با شما تماس می‌گیریم.`, ctx)
          if (ctx.phone) await sendServiceSms(ctx.phone, msg, 'اتوماسیون ملک‌جت')
        } else if (node.label.includes('وظیفه') || node.label.includes('قرار')) {   // ایجاد وظیفه/پیگیری
          addAppt(owner, { client: ctx.name || 'لید', listingTitle: ctx.need, date: new Date().toLocaleDateString('fa-IR'), type: 'call' })
        } else if (node.label.includes('CRM') || node.label.includes('وضعیت')) {    // بروزرسانی CRM → مرحلهٔ «تماس‌گرفته»
          if (ctx.leadId) setLeadStage(owner, ctx.leadId, 'contacted')
        }
      } else if (node.type === 'end') {                          // پایان: بستن لید / تبدیل به مشتری
        if (ctx.leadId) setLeadStage(owner, ctx.leadId, 'closed')
      }
    } catch { /* گرهِ خطادار، بقیه را متوقف نکند */ }
    await runFrom(owner, wf, node, ctx, depth + 1)
  }
}

export async function processWorkflows(now = Date.now()): Promise<{ workflows: number; fired: number }> {
  const wfs = allWorkflows().filter(w => w.enabled && w.owner)
  let fired = 0
  for (const wf of wfs) {
    const trig = wf.nodes.find(n => n.type === 'trigger')
    if (!trig) continue
    const owner = wf.owner as string
    const st = getWfState(wf.id)
    const firstRun = !st.lastRun
    const done = new Set(st.done)
    let events: Ctx[] = []
    try {
      const adv = getAdvisor(owner)
      if (trig.label.includes('لید')) {                          // تریگر: لید جدید
        events = adv.leads.filter(l => l.createdAt > st.lastRun)
          .map(l => ({ id: 'lead:' + l.id, leadId: l.id, phone: l.phone, name: l.name, need: l.need, budget: l.budget }))
      } else if (trig.label.includes('بازدید') || trig.label.includes('قرار')) {   // تریگر: قرار/بازدید جدید
        events = adv.appts.filter(a => a.createdAt > st.lastRun)
          .map(a => ({ id: 'appt:' + a.id, name: a.client, need: a.listingTitle }))
      }
    } catch { /* مالکِ بدونِ دادهٔ مشاور → رویدادی نیست */ }

    if (!firstRun) {     // اولین اجرا فقط زمان را تنظیم می‌کند (رویدادهای قدیمی شلیک نمی‌شوند)
      for (const ev of events) {
        if (done.has(ev.id)) continue
        await runFrom(owner, wf, trig, ev)
        done.add(ev.id)
        fired++
      }
    }
    setWfState(wf.id, { lastRun: now, done: [...done] })
  }
  return { workflows: wfs.length, fired }
}
