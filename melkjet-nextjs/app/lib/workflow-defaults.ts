import type { WorkflowNode, WorkflowConnection } from './workflow-store'

// اتوماسیون‌های پیش‌فرضِ واقعی و آمادهٔ اجرا، متناسب با نقشِ کاربر. هنگامِ اولین بارِ بازکردنِ
// پنلِ اتوماسیون، برای هر کاربر بر اساسِ داشبوردش ساخته می‌شوند (خاموش، تا خودش روشن کند).
// موتورِ اجرا (workflow-runner) گره‌ها را با کلیدواژهٔ برچسب می‌شناسد:
//   تریگر «لید جدید» / «تغییر وضعیت»؛ اقدامِ «پیام» (پیامک) / «ایمیل» / «وظیفه»؛ گرهِ ai/end.
// پس برچسب‌ها حتماً باید این کلیدواژه‌ها را داشته باشند؛ متنِ صنفی در config می‌رود.

interface RoleWf { client: string; welcome: string }
const ROLE: Record<string, RoleWf> = {
  '/pros': { client: 'مشتری', welcome: 'سلام {name}، از املاکِ ما با شما تماس می‌گیریم و بهترین فایل‌ها را برایتان می‌فرستیم.' },
  '/agency': { client: 'مشتری', welcome: 'سلام {name}، از آژانسِ املاکِ ما با شما تماس می‌گیریم و همراهی‌تان می‌کنیم.' },
  '/builder': { client: 'خریدار', welcome: 'سلام {name}، از مجموعهٔ ساختمانیِ ما برای معرفیِ واحدها و شرایطِ پیش‌فروش با شما در تماسیم.' },
  '/materials': { client: 'مشتری', welcome: 'سلام {name}، سفارش/استعلامِ شما ثبت شد؛ کارشناسِ فروش به‌زودی تماس می‌گیرد.' },
  '/architect': { client: 'کارفرما', welcome: 'سلام {name}، درخواستِ طراحیِ شما دریافت شد؛ برای مشاوره و بازدید با شما تماس می‌گیریم.' },
  '/contractor': { client: 'کارفرما', welcome: 'سلام {name}، درخواستِ اجرای شما ثبت شد؛ کارشناسِ ما برای برآورد و بازدید تماس می‌گیرد.' },
  '/appraiser': { client: 'متقاضی', welcome: 'سلام {name}، درخواستِ کارشناسیِ شما ثبت شد؛ برای هماهنگیِ بازدید با شما تماس می‌گیریم.' },
  '/lawfirm': { client: 'موکل', welcome: 'سلام {name}، درخواستِ مشاورهٔ حقوقیِ شما دریافت شد؛ همکارانِ ما با شما تماس می‌گیرند.' },
  '/legal': { client: 'موکل', welcome: 'سلام {name}، درخواستِ مشاورهٔ حقوقیِ شما دریافت شد؛ به‌زودی با شما تماس می‌گیریم.' },
  '/finance': { client: 'متقاضی', welcome: 'سلام {name}، درخواستِ تسهیلات/بیمهٔ شما ثبت شد؛ کارشناسِ ما راهنمایی‌تان می‌کند.' },
  '/notary': { client: 'مراجع', welcome: 'سلام {name}، نوبتِ شما در دفترخانه ثبت شد؛ لطفاً مدارکِ لازم را همراه بیاورید.' },
}
const DEFAULT_WF: RoleWf = { client: 'مشتری', welcome: 'سلام {name}، از ملک‌جت با شما تماس می‌گیریم.' }

let seq = 0
const nid = () => 'nd' + (++seq) + Math.random().toString(36).slice(2, 6)

type DefWf = { name: string; nodes: WorkflowNode[]; connections: WorkflowConnection[] }
// سازندهٔ گردش‌کارِ خطی: گره‌ها را از راست‌به‌چپ می‌چیند و پشت‌سرهم وصل می‌کند.
function linear(name: string, steps: { label: string; type: string; config?: Record<string, string> }[]): DefWf {
  const nodes: WorkflowNode[] = steps.map((s, i) => ({ id: nid(), label: s.label, type: s.type, x: 80 + i * 210, y: 150 + (i % 2) * 60, config: s.config || {} }))
  const connections: WorkflowConnection[] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }))
  return { name, nodes, connections }
}

export function roleDefaultWorkflows(dash: string): DefWf[] {
  const r = ROLE[dash] || DEFAULT_WF
  const c = r.client
  return [
    // ۱) خوش‌آمد + پیگیری: لیدِ جدید → پیامکِ خوش‌آمد → وظیفهٔ پیگیری → پایان
    linear(`خوش‌آمد و پیگیریِ ${c}ِ جدید`, [
      { label: 'لید جدید', type: 'trigger', config: {} },
      { label: 'ارسال پیامِ خوش‌آمد', type: 'action', config: { template: r.welcome } },
      { label: 'ایجاد وظیفهٔ پیگیری', type: 'action', config: {} },
      { label: 'بستن', type: 'end', config: {} },
    ]),
    // ۲) تحلیلِ هوشمند: لیدِ جدید → تحلیلِ AI (یادداشت روی لید) → وظیفهٔ تماس
    linear(`تحلیلِ هوشمندِ ${c}`, [
      { label: 'لید جدید', type: 'trigger', config: {} },
      { label: 'تحلیلِ لید با AI', type: 'ai', config: { prompt: `این ${c} را در دو جمله تحلیل کن و بهترین اقدامِ بعدی را پیشنهاد بده.` } },
      { label: 'ایجاد وظیفهٔ تماس', type: 'action', config: {} },
    ]),
    // ۳) اعلانِ قرارداد: رسیدنِ لید به مرحلهٔ «قرارداد» → ایمیل به تیم
    linear('اعلانِ قرارداد به تیم', [
      { label: 'تغییر وضعیت', type: 'trigger', config: { filter: 'contract' } },
      { label: 'ارسال ایمیلِ اعلان', type: 'action', config: { subject: 'قراردادِ جدید در ملک‌جت', template: `${c} «{name}» به مرحلهٔ قرارداد رسید. نیاز: {need} — بودجه: {budget}` } },
    ]),
  ]
}
