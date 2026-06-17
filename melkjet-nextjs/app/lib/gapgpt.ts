import { getAdminData } from './admin-store'
import { DEFAULT_GAP_BASE } from './ai-agents'

function cfg() {
  const g = getAdminData().gapgpt
  if (!g?.apiKey) throw new Error('کلید API گپ‌جی‌پی‌تی تنظیم نشده است (پنل → API و مدل‌های AI)')
  return { base: (g.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, ''), key: g.apiKey }
}

export function agentModel(agentId: string, slot: 'text' | 'image' = 'text'): string | undefined {
  return getAdminData().agentModels?.[agentId]?.[slot]
}

export async function chatComplete(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  const { base, key } = cfg()
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
    signal: AbortSignal.timeout(90000),
  })
  if (!r.ok) throw new Error(`گپ HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = await r.json()
  return d.choices?.[0]?.message?.content || ''
}

export async function generateImage(model: string, prompt: string, size = '1024x1024'): Promise<string> {
  const { base, key } = cfg()
  const r = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error(`گپ تصویر HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = await r.json()
  return d.data?.[0]?.url || d.data?.[0]?.b64_json || ''
}
