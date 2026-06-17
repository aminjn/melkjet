import { getAdminData } from './admin-store'
import { DEFAULT_GAP_BASE } from './ai-agents'
import { proxiedRequest } from './proxy-fetch'

function cfg() {
  const g = getAdminData().gapgpt
  if (!g?.apiKey) throw new Error('کلید API گپ‌جی‌پی‌تی تنظیم نشده است (پنل → API و مدل‌های AI)')
  return { base: (g.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, ''), key: g.apiKey }
}

function proxy() {
  return getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined
}

export function agentModel(agentId: string, slot: 'text' | 'image' = 'text'): string | undefined {
  return getAdminData().agentModels?.[agentId]?.[slot]
}

// HTTP helper. GapGPT is a domestic service and works best DIRECTLY — routing it
// through the (foreign) Divar proxy breaks long chat responses. So: direct first,
// proxy only as a last resort if the direct request throws a network error.
async function gapHttp(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeout = 90000): Promise<{ status: number; body: string }> {
  try {
    const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(timeout) })
    return { status: r.status, body: await r.text() }
  } catch (e) {
    const px = proxy()
    if (!px) throw e
    return proxiedRequest(url, { method: init.method, headers: init.headers, body: init.body, proxyUrl: px, timeout })
  }
}

export async function listModels(): Promise<string[]> {
  const { base, key } = cfg()
  const res = await gapHttp(`${base}/models`, { method: 'GET', headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } }, 15000)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const ids: string[] = Array.isArray(d.data) ? d.data.map((m: any) => m.id).filter(Boolean) : []
  return ids.sort()
}

export async function chatComplete(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  const { base, key } = cfg()
  const res = await gapHttp(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
  }, 90000)
  if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  return d.choices?.[0]?.message?.content || ''
}

// Like chatComplete, but if the chosen model fails (e.g. 503/unavailable on
// GapGPT), retry once with a known-good cheap model so the feature still works.
export async function chatCompleteSafe(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  try {
    return await chatComplete(model, messages, opts)
  } catch (e) {
    if (model !== 'gpt-4o-mini') {
      return await chatComplete('gpt-4o-mini', messages, opts)
    }
    throw e
  }
}

export async function generateImage(model: string, prompt: string, size = '1024x1024'): Promise<string> {
  const { base, key } = cfg()
  const res = await gapHttp(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  }, 120000)
  if (res.status !== 200) throw new Error(`گپ تصویر HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  return d.data?.[0]?.url || d.data?.[0]?.b64_json || ''
}
