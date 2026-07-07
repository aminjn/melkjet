import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { runAgent } from '@/app/lib/reos/agent/executor'
import { rulePlanner, makeLlmPlanner } from '@/app/lib/reos/agent/planner'
import { recentTasks } from '@/app/lib/reos/agent/memory'
import { resolveAgent } from '@/app/lib/gapgpt'

// POST /api/reos/agent {message} — دستیارِ REOS با memory/planner/executor/tools.
// اگر مدلِ AI تنظیم شده باشد از GapGPT (ReAct)، وگرنه از planner قاعده‌مند استفاده می‌کند.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const message = String(b.message || '').trim()
  if (!message) return NextResponse.json({ error: 'پیام لازم است' }, { status: 400 })

  const { model, provider } = resolveAgent([['AssistantAgent', 'text'], ['ContentAgent', 'text']])
  const planner = model ? makeLlmPlanner(model, provider) : rulePlanner
  const result = await runAgent(message, { userId: s.phone }, { planner, maxSteps: 5 })
  return NextResponse.json({ ok: true, engine: model ? 'llm' : 'rule', ...result }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// GET /api/reos/agent — تاریخچهٔ اجراهای ایجنتِ کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  return NextResponse.json({ ok: true, tasks: await recentTasks(s.phone, 20) }, { headers: { 'Cache-Control': 'no-store, private' } })
}
