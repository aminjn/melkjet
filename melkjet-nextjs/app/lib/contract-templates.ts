// ── قالب‌های قراردادِ املاک (فارسی) ──
// هر قالب: فیلدهای پرشونده + سازندهٔ متنِ HTML. متن، اسکلتِ حرفه‌ای است؛ تنظیمِ نهاییِ
// حقوقی با وکیل/کارشناس است (در پاورقی هم نوشته می‌شود).
export interface ContractField { key: string; label: string; type?: 'text' | 'number' | 'date' | 'textarea' }
export interface ContractTemplate {
  id: string
  name: string
  fields: ContractField[]
  build: (v: Record<string, string>) => string   // HTML
}

const g = (v: Record<string, string>, k: string, dash = '…') => (v[k] && String(v[k]).trim()) || dash
const clause = (n: number, title: string, body: string) =>
  `<div style="margin:14px 0"><b>مادهٔ ${n} — ${title}:</b> ${body}</div>`

const commonParties: ContractField[] = [
  { key: 'seller', label: 'فروشنده / موجر / موکل' },
  { key: 'sellerId', label: 'کدملی/شناسهٔ فروشنده' },
  { key: 'buyer', label: 'خریدار / مستأجر / وکیل' },
  { key: 'buyerId', label: 'کدملی/شناسهٔ خریدار' },
]

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'sale',
    name: 'مبایعه‌نامهٔ ملک',
    fields: [
      ...commonParties,
      { key: 'property', label: 'موردِ معامله (نشانی کامل)', type: 'textarea' },
      { key: 'area', label: 'متراژ (متر مربع)', type: 'number' },
      { key: 'deed', label: 'شمارهٔ سند/پلاکِ ثبتی' },
      { key: 'price', label: 'ثمنِ معامله (تومان)' },
      { key: 'prepay', label: 'بیعانه/پیش‌پرداخت (تومان)' },
      { key: 'settleDate', label: 'تاریخِ تنظیمِ سند رسمی', type: 'date' },
      { key: 'date', label: 'تاریخِ قرارداد', type: 'date' },
    ],
    build: v => `
      <h2 style="text-align:center;margin:0 0 6px">مبایعه‌نامه</h2>
      <div style="text-align:center;color:#666;font-size:12px;margin-bottom:18px">تاریخ: ${g(v, 'date')}</div>
      <p>این قرارداد بین <b>${g(v, 'seller')}</b> (کدملی ${g(v, 'sellerId')}) به‌عنوان «فروشنده» و <b>${g(v, 'buyer')}</b> (کدملی ${g(v, 'buyerId')}) به‌عنوان «خریدار» با شرایطِ زیر منعقد گردید.</p>
      ${clause(1, 'موردِ معامله', `تمامتِ ششدانگِ یک واحد ملک به نشانی «${g(v, 'property')}» به متراژِ ${g(v, 'area')} متر مربع با پلاکِ ثبتی ${g(v, 'deed')}.`)}
      ${clause(2, 'ثمنِ معامله', `مبلغِ ${g(v, 'price')} تومان که مبلغِ ${g(v, 'prepay')} تومان هنگامِ امضای این قرارداد به‌عنوان بیعانه پرداخت و مابقی در زمانِ تنظیمِ سند رسمی پرداخت می‌گردد.`)}
      ${clause(3, 'تنظیمِ سند رسمی', `طرفین متعهد شدند در تاریخِ ${g(v, 'settleDate')} در دفترخانه حاضر و نسبت به انتقالِ رسمیِ سند اقدام نمایند.`)}
      ${clause(4, 'تعهدات و خیارات', 'فروشنده متعهد به تخلیه و تحویلِ ملک بدونِ هرگونه معارض است. کلیهٔ خیارات از جمله خیارِ غبن از طرفین ساقط گردید.')}
      ${clause(5, 'حلِ اختلاف', 'در صورتِ بروزِ اختلاف، ابتدا از طریقِ مذاکره و در صورتِ عدمِ توافق از طریقِ مراجعِ قضاییِ صالح رسیدگی می‌شود.')}
    `,
  },
  {
    id: 'rent',
    name: 'اجاره‌نامه',
    fields: [
      ...commonParties,
      { key: 'property', label: 'موردِ اجاره (نشانی)', type: 'textarea' },
      { key: 'deposit', label: 'ودیعه/رهن (تومان)' },
      { key: 'rent', label: 'اجارهٔ ماهانه (تومان)' },
      { key: 'from', label: 'شروعِ اجاره', type: 'date' },
      { key: 'months', label: 'مدت (ماه)', type: 'number' },
      { key: 'date', label: 'تاریخِ قرارداد', type: 'date' },
    ],
    build: v => `
      <h2 style="text-align:center;margin:0 0 6px">اجاره‌نامه</h2>
      <div style="text-align:center;color:#666;font-size:12px;margin-bottom:18px">تاریخ: ${g(v, 'date')}</div>
      <p>این قرارداد بین <b>${g(v, 'seller')}</b> (موجر) و <b>${g(v, 'buyer')}</b> (مستأجر) منعقد گردید.</p>
      ${clause(1, 'موردِ اجاره', `یک واحد ملک به نشانی «${g(v, 'property')}».`)}
      ${clause(2, 'مدت', `به مدتِ ${g(v, 'months')} ماه از تاریخِ ${g(v, 'from')}.`)}
      ${clause(3, 'مبلغِ اجاره', `ودیعه ${g(v, 'deposit')} تومان و اجارهٔ ماهانه ${g(v, 'rent')} تومان که اولِ هر ماه پرداخت می‌گردد.`)}
      ${clause(4, 'تعهدات', 'مستأجر متعهد به حفظِ عینِ مستأجره و پرداختِ به‌موقعِ اجاره است. تخلیه در پایانِ مدت بر عهدهٔ مستأجر است.')}
      ${clause(5, 'حلِ اختلاف', 'اختلافات از طریقِ مراجعِ قضاییِ صالح رسیدگی می‌شود.')}
    `,
  },
  {
    id: 'poa',
    name: 'وکالت‌نامهٔ فروش',
    fields: [
      { key: 'seller', label: 'موکل (مالک)' },
      { key: 'sellerId', label: 'کدملیِ موکل' },
      { key: 'buyer', label: 'وکیل' },
      { key: 'buyerId', label: 'کدملیِ وکیل' },
      { key: 'property', label: 'موردِ وکالت (نشانی ملک)', type: 'textarea' },
      { key: 'scope', label: 'حدودِ اختیارات', type: 'textarea' },
      { key: 'date', label: 'تاریخ', type: 'date' },
    ],
    build: v => `
      <h2 style="text-align:center;margin:0 0 6px">وکالت‌نامه</h2>
      <div style="text-align:center;color:#666;font-size:12px;margin-bottom:18px">تاریخ: ${g(v, 'date')}</div>
      <p>موکل <b>${g(v, 'seller')}</b> (کدملی ${g(v, 'sellerId')}) به <b>${g(v, 'buyer')}</b> (کدملی ${g(v, 'buyerId')}) وکالت داد تا نسبت به موردِ زیر اقدام نماید.</p>
      ${clause(1, 'موردِ وکالت', `انجامِ امورِ مربوط به ملکِ واقع در «${g(v, 'property')}».`)}
      ${clause(2, 'حدودِ اختیارات', g(v, 'scope', 'امضای مبایعه‌نامه، اخذِ ثمن، حضور در دفترخانه و انتقالِ رسمیِ سند.'))}
      ${clause(3, 'مدت و عزل', 'این وکالت تا اجرای کاملِ موضوع معتبر است و شرایطِ عزل مطابقِ قانون خواهد بود.')}
    `,
  },
]

export function contractTemplateById(id: string) { return CONTRACT_TEMPLATES.find(t => t.id === id) }
