import { allWorkflows, type Workflow, type WorkflowNode } from './workflow-store'
import { getAdvisor, addAppt, setLeadStage } from './advisor-store'
import { sendServiceSms } from './sms'
import { getWfState, setWfState } from './workflow-runner-store'

// موتورِ اجرای اتوماسیون. هر گردش‌کارِ «فعال» را با تریگرِ آن می‌سنجد و اکشن‌های متصل را
// روی رویدادهای جدید (لید/قرارِ تازه) اجرا می‌کند. تنها رویدادهای جدید (بعد از فعال‌سازی)
// پردازش می‌شوند و هر رویداد فقط یک‌بار (با مجموعهٔ done) اجرا می‌شود.

interface Ctx { id: string; leadId?: string; phone?: string; name?: string; need?: string; budget?: string }

function nextNodes(wf: Workflow, fromId: string): WorkflowNode[] {
  return wf.connections.filter(c => c.from === fromId).map(c => wf.nodes.find(n => n.id === c.to)).filter(Boolean) as WorkflowNode[]
}

function interpolate(tpl: string, ctx: Ctx): string {
  return String(tpl || '')
    .replace(/\{\s*(نام|name)\s*\}/g, ctx.name || 'مشتری')
    .replace(/\{\s*(نیاز|need)\s*\}/g, ctx.need || '')
    .replace(/\{\s*(بودجه|budget)\s*\}/g, ctx.budget || '')
}

// از یک گره، اکشن‌های پاییندست را به‌ترتیب اجرا می‌کند (شرط/AI فعلاً عبوری‌اند).
async function runFrom(owner: string, wf: Workflow, fromNode: WorkflowNode, ctx: Ctx, depth = 0) {
  if (depth > 20) return
  for (const node of nextNodes(wf, fromNode.id)) {
    try {
      if (node.type === 'action') {
        if (node.label.includes('پیام')) {                       // ارسال پیام (پیامک به لید)
          const msg = interpolate(node.config?.template || node.config?.message || `سلام${ctx.name ? ' ' + ctx.name : ''}، از ملک‌جت با شما تماس می‌گیریم.`, ctx)
          if (ctx.phone) await sendServiceSms(ctx.phone, msg, 'اتوماسیون ملک‌جت')
        } else if (node.label.includes('وظیفه') || node.label.includes('قرار')) {   // ایجاد وظیفه/پیگیری
          addAppt(owner, { client: ctx.name || 'لید', listingTitle: ctx.need, date: new Date().toLocaleDateString('fa-IR'), type: 'call' })
        } else if (node.label.includes('CRM') || node.label.includes('وضعیت')) {    // بروزرسانی CRM → مرحلهٔ «تماس‌گرفته»
          if (ctx.leadId) setLeadStage(owner, ctx.leadId, 'contacted')
        }
      } else if (node.type === 'end') {                          // پایان: بستن لید / تبدیل به مشتری
        if (ctx.leadId) setLeadStage(owner, ctx.leadId, node.label.includes('مشتری') ? 'closed' : (node.label.includes('بستن') ? 'closed' : 'closed'))
      }
      // condition / ai → عبوری (در MVP بدونِ شرط‌گذاری ادامه می‌دهیم)
    } catch { /* اکشنِ خطادار، بقیه را متوقف نکند */ }
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
