// REOS v2 · AI Agent — Executor. حلقهٔ ReAct: plan → tool → observe → … → answer.
// planner تزریق‌پذیر است (قاعده‌مند یا LLM). هر اجرا + trace در reos_agent_tasks ثبت می‌شود.
import { TOOL_MAP, type ToolCtx } from './tools'
import { saveTask } from './memory'
import type { Plan, Planner } from './planner'

export interface ToolCall { tool: string; args: Record<string, unknown>; result: unknown; ok: boolean; thought?: string }
export interface AgentResult { answer: string; trace: ToolCall[]; steps: number; taskId?: string }

export async function runAgent(goal: string, ctx: ToolCtx, opts: { planner: Planner; maxSteps?: number; persist?: boolean } ): Promise<AgentResult> {
  const maxSteps = Math.min(opts.maxSteps ?? 4, 8)
  const trace: ToolCall[] = []
  let answer = ''

  for (let step = 0; step < maxSteps; step++) {
    let plan: Plan
    try { plan = await opts.planner(goal, trace, ctx) }
    catch { plan = { action: 'answer', answer: 'در پردازش خطایی رخ داد.' } }

    if (plan.action === 'answer') { answer = plan.answer; break }

    const tool = TOOL_MAP[plan.tool]
    if (!tool) { trace.push({ tool: plan.tool, args: plan.args, result: { error: 'ابزارِ ناشناخته' }, ok: false, thought: plan.thought }); continue }
    try {
      const result = await tool.run(plan.args || {}, ctx)
      trace.push({ tool: plan.tool, args: plan.args, result, ok: true, thought: plan.thought })
    } catch (e) {
      trace.push({ tool: plan.tool, args: plan.args, result: { error: (e as Error)?.message || 'خطا' }, ok: false, thought: plan.thought })
    }
  }

  // اگر حلقه بدونِ answer تمام شد، از آخرین مشاهده جمع‌بندی کن.
  if (!answer) answer = trace.length ? 'بر اساسِ اطلاعاتِ موجود، نتایج آماده شد.' : 'متوجهِ درخواست نشدم؛ لطفاً واضح‌تر بگویید.'

  let taskId: string | undefined
  if (opts.persist !== false) {
    try { taskId = (await saveTask({ userId: ctx.userId, goal, answer, trace, steps: trace.length })).id } catch { /* ثبت اختیاری */ }
  }
  return { answer, trace, steps: trace.length, taskId }
}
