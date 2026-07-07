// REOS v2 · AI Agent — Planner. دو پیاده‌سازی:
// (۱) rulePlanner: قاعده‌مند، قطعی، بدونِ شبکه (fallback + تست‌پذیر).
// (۲) llmPlanner: با GapGPT (ReAct/JSON tool-calling) وقتی مدل تنظیم شده باشد.
import { toolCatalog, TOOL_MAP, type ToolCtx } from './tools'
import type { ToolCall } from './executor'

export type Plan =
  | { action: 'tool'; tool: string; args: Record<string, unknown>; thought?: string }
  | { action: 'answer'; answer: string }

export type Planner = (goal: string, trace: ToolCall[], ctx: ToolCtx) => Promise<Plan>

// ── (۱) Rule-based planner: یک ابزار بر اساسِ نیت، سپس پاسخ ──
export const rulePlanner: Planner = async (goal, trace) => {
  if (trace.length > 0) return { action: 'answer', answer: summarize(goal, trace) }
  const g = goal.toLowerCase()
  // recall را قبل از remember چک کن (وگرنه «یادت هست بودجه‌ام…» اشتباهاً remember می‌شود).
  if (/یادت هست|یادته|چی گفتم|چقدر بود|قبلا گفتم|recall/.test(g))
    return { action: 'tool', tool: 'recall', args: { query: goal }, thought: 'بازیابیِ حافظه' }
  if (/یادت باشه|به.?خاطر بسپار|ذخیره کن|remember/.test(g))
    return { action: 'tool', tool: 'remember', args: { content: goal, kind: 'pref' }, thought: 'ذخیرهٔ ترجیح' }
  if (/مشابه|شبیه/.test(g)) { const id = extractId(goal); if (id) return { action: 'tool', tool: 'similar_properties', args: { propertyId: id }, thought: 'املاکِ مشابه' } }
  if (/قیمت|ارزش|چند می.?ارزه|بیارزه/.test(g)) { const id = extractId(goal); if (id) return { action: 'tool', tool: 'estimate_price', args: { propertyId: id }, thought: 'برآوردِ قیمت' } }
  if (/لید|مشاور|تخصیص/.test(g)) return { action: 'tool', tool: 'match_agent', args: { agencyPhone: '', need: goal }, thought: 'تطبیقِ مشاور' }
  // پیش‌فرض: پیشنهادِ ملک
  return { action: 'tool', tool: 'recommend_properties', args: { limit: 8 }, thought: 'پیشنهادِ ملک' }
}

function extractId(s: string): string | null { const m = s.match(/\b([a-z0-9]{6,})\b/i); return m ? m[1] : null }

function summarize(goal: string, trace: ToolCall[]): string {
  const last = trace[trace.length - 1]
  if (!last || !last.ok) return 'نتوانستم درخواست را کامل انجام دهم؛ لطفاً دقیق‌تر بگویید.'
  const r = last.result
  if (last.tool === 'remember') return 'ثبت شد ✓ — این را در حافظه نگه می‌دارم و در پیشنهادهای بعدی لحاظ می‌کنم.'
  if (last.tool === 'recall') return Array.isArray(r) && r.length ? `از حافظه: ${(r as { content: string }[]).map(x => x.content).join(' — ')}` : 'چیزی در حافظه پیدا نکردم.'
  if (Array.isArray(r)) return r.length ? `${r.length.toLocaleString('fa-IR')} مورد پیدا شد.` : 'موردی پیدا نشد.'
  if (r && typeof r === 'object' && 'suggested' in (r as object)) { const o = r as { suggested: number; low: number; high: number }; return `قیمتِ پیشنهادی حدودِ ${o.suggested.toLocaleString('fa-IR')} تومان (بازهٔ ${o.low.toLocaleString('fa-IR')} تا ${o.high.toLocaleString('fa-IR')}).` }
  if (r && typeof r === 'object' && 'label' in (r as object)) { const o = r as { value: number; label: string }; return `احتمالِ تبدیل: ${Math.round(o.value * 100)}٪ (${o.label}).` }
  return 'انجام شد.'
}

// ── (۲) LLM planner (GapGPT). خروجیِ JSON تجزیه می‌شود؛ در خطا به rulePlanner برمی‌گردد. ──
export function makeLlmPlanner(model: string, provider?: string): Planner {
  return async (goal, trace, ctx) => {
    try {
      // از AI Gateway عبور می‌کنیم (router + cache + cost + fallback) — نه فراخوانِ مستقیم.
      const { runLLM } = await import('../gateway')
      const obs = trace.map((t, i) => `مشاهدهٔ ${i + 1}: ابزار ${t.tool} → ${JSON.stringify(t.result).slice(0, 600)}`).join('\n')
      const sys = `تو دستیارِ املاکِ MelkJet هستی. با ابزارهای زیر به هدفِ کاربر می‌رسی.
ابزارها:
${toolCatalog()}
در هر گام دقیقاً یک JSON برگردان:
{"action":"tool","tool":"<نام>","args":{...}}  یا  {"action":"answer","answer":"<پاسخِ نهاییِ فارسی>"}
اگر با مشاهده‌ها می‌توانی جواب بدهی، action=answer بده. فقط JSON، بدونِ توضیحِ اضافه.`
      const user = `هدفِ کاربر: ${goal}\n${obs ? 'مشاهده‌های تاکنون:\n' + obs : 'هنوز ابزاری اجرا نشده.'}`
      const res = await runLLM('agent', [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.2, max_tokens: 500, cache: false })
      const raw = res.text || ''
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const plan = JSON.parse(json) as Plan
      if (plan.action === 'tool' && !TOOL_MAP[plan.tool]) return { action: 'answer', answer: 'ابزارِ مناسبی پیدا نشد.' }
      return plan
    } catch {
      return rulePlanner(goal, trace, ctx)   // fallbackِ امن
    }
  }
}
