// REOS v2 · AI Agent — Tool registry. هر ابزار = wrapper روی موتورِ واقعیِ REOS.
// ابزارهای سنگین (نیازمندِ data layer) با importِ پویا بار می‌شوند تا این ماژول در تست سبک بماند.
import { predictLeadConversion, optimizePrice } from '../ml'
import { parseFaNum } from '../features'
import { saveMemory, searchMemories, type MemoryKind } from './memory'

export interface ToolCtx { userId: string }
export interface Tool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>
}

export const TOOLS: Tool[] = [
  {
    name: 'remember',
    description: 'ذخیرهٔ یک واقعیت/ترجیحِ کاربر در حافظهٔ بلندمدت (مثلاً بودجه، منطقهٔ موردعلاقه).',
    parameters: { content: { type: 'string', description: 'متنِ حافظه', required: true }, kind: { type: 'string', description: 'fact|pref|goal|episode' } },
    run: async (a, ctx) => saveMemory({ userId: ctx.userId, kind: (String(a.kind || 'fact') as MemoryKind), content: String(a.content || '') }),
  },
  {
    name: 'recall',
    description: 'بازیابیِ حافظهٔ مرتبط با یک موضوع از حافظهٔ بلندمدتِ کاربر.',
    parameters: { query: { type: 'string', description: 'موضوع', required: true } },
    run: async (a, ctx) => (await searchMemories(ctx.userId, String(a.query || ''), 5)).map(m => ({ kind: m.kind, content: m.content })),
  },
  {
    name: 'recommend_properties',
    description: 'فهرستِ املاکِ پیشنهادیِ شخصی‌سازی‌شده برای کاربر (فیدِ REOS).',
    parameters: { limit: { type: 'number', description: 'تعداد' } },
    run: async (a, ctx) => {
      const { loadUser, loadProperties } = await import('../data')
      const { matchUserToProperties } = await import('../engine')
      const [user, props] = await Promise.all([loadUser(ctx.userId), loadProperties(300)])
      return matchUserToProperties(user, props, { limit: Math.min(Number(a.limit) || 8, 20) }).map(m => ({ id: m.targetId, score: m.score, matchPct: Math.round(m.breakdown.final * 100), reasons: m.reasons }))
    },
  },
  {
    name: 'similar_properties',
    description: 'املاکِ مشابهِ یک ملک بر اساسِ شباهتِ برداری (embedding).',
    parameters: { propertyId: { type: 'string', description: 'شناسهٔ ملک', required: true }, k: { type: 'number', description: 'تعداد' } },
    run: async (a) => {
      const { similarProperties } = await import('../data')
      return similarProperties(String(a.propertyId || ''), Math.min(Number(a.k) || 6, 20))
    },
  },
  {
    name: 'estimate_price',
    description: 'برآوردِ قیمتِ منصفانهٔ یک ملک + بازهٔ پیشنهادی.',
    parameters: { propertyId: { type: 'string', description: 'شناسهٔ ملک', required: true } },
    run: async (a) => {
      const { getItemById } = await import('../../scraper-store')
      const { itemToProperty } = await import('../data')
      const it = await getItemById(String(a.propertyId || ''))
      if (!it) return { error: 'ملک یافت نشد' }
      const p = itemToProperty(it)
      const perM = p.area && p.price ? p.price / p.area : 0
      return optimizePrice(p, { medianPricePerM: perM })
    },
  },
  {
    name: 'predict_lead',
    description: 'پیش‌بینیِ احتمالِ تبدیلِ یک لید به معامله (۰..۱) + برچسبِ داغ/گرم/سرد.',
    parameters: { phone: { type: 'string', description: 'شماره' }, budget: { type: 'string', description: 'بودجه' }, stage: { type: 'string', description: 'مرحله' }, activityCount: { type: 'number', description: 'تعدادِ فعالیت' } },
    run: async (a) => predictLeadConversion({ phone: a.phone ? String(a.phone) : undefined, budget: a.budget as string, stage: a.stage ? String(a.stage) : undefined, activityCount: Number(a.activityCount) || 0 }),
  },
  {
    name: 'match_agent',
    description: 'بهترین مشاورِ یک آژانس برای یک لید (عملکرد + تخصص + ظرفیت).',
    parameters: { agencyPhone: { type: 'string', description: 'شمارهٔ آژانس', required: true }, need: { type: 'string', description: 'نیاز/منطقه' }, budget: { type: 'string', description: 'بودجه' } },
    run: async (a) => {
      const { loadAgentsForAgency } = await import('../data')
      const { assignLeadToAgent } = await import('../engine')
      const agents = await loadAgentsForAgency(String(a.agencyPhone || ''))
      if (!agents.length) return { error: 'مشاورِ فعالی نیست' }
      return assignLeadToAgent({ need: String(a.need || ''), budget: parseFaNum(a.budget as string) }, agents).slice(0, 5)
    },
  },
]

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map(t => [t.name, t]))

// شرحِ ابزارها برای promptِ planner (LLM یا قاعده‌مند).
export function toolCatalog(): string {
  return TOOLS.map(t => {
    const ps = Object.entries(t.parameters).map(([k, v]) => `${k}${v.required ? '*' : ''}:${v.type}`).join(', ')
    return `- ${t.name}(${ps}) — ${t.description}`
  }).join('\n')
}
