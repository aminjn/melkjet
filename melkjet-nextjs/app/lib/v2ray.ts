// فاز ۲۹۹ — فیلترشکنِ داخلیِ v2ray/Xray (پورت از ایدهٔ nexacomercial، نوشتهٔ تازه برای ملک‌جت).
// کاربر یک لینکِ کانفیگ (vmess/vless/trojan/ss) یا لینکِ اشتراک (subscription) می‌دهد؛ این ماژول
// خودش Xray-core را اجرا می‌کند با:
//   • inboundِ HTTP محلی روی 127.0.0.1:PORT (کدِ موجودِ proxy-fetch بدونِ تغییر از همین می‌خواند)
//   • همهٔ سرورهای لینک به‌صورتِ outbound
//   • observatory + balancer(leastPing): خودِ Xray دائم همه را پینگ می‌زند، سریع‌ترین/سالم‌ترین
//     را انتخاب می‌کند و در صورتِ قطع، failover می‌کند — «لینک را بده، خودش بهترین را پیدا می‌کند».
// فقط روی اینستنسِ ۰ (کارگرِ کرون) اجرا می‌شود و کاملاً opt-in است: تا کاربر در سوپرادمین
// روشن نکند و لینک ندهد، هیچ پروسه‌ای بالا نمی‌آید و رفتارِ فعلیِ سایت عوض نمی‌شود.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

const DIR = path.join(process.cwd(), '.v2ray')
const CONFIG_PATH = path.join(DIR, 'config.json')
const STATUS_PATH = path.join(DIR, 'status.json')   // اینستنسِ ۰ می‌نویسد؛ بقیه برای دیدنِ وضعیت می‌خوانند
export const V2RAY_HTTP_PORT_DEFAULT = 10809
export const V2RAY_SOCKS_PORT_DEFAULT = 10808

// ───────────────────────── کمک‌ها ─────────────────────────
function b64decode(s: string): string {
  try {
    let t = String(s || '').trim().replace(/-/g, '+').replace(/_/g, '/')
    while (t.length % 4) t += '='
    return Buffer.from(t, 'base64').toString('utf8')
  } catch { return '' }
}
function safeJson<T = any>(s: string): T | null { try { return JSON.parse(s) } catch { return null } }
const num = (v: any, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }

export function xrayBinPath(): string {
  const cfg = getAdminData().v2ray?.binPath
  const cands = [cfg, process.env.XRAY_BIN,
    path.join(process.cwd(), 'bin', 'xray'),
    '/usr/local/bin/xray', '/usr/bin/xray', '/var/www/melkjet/melkjet-nextjs/bin/xray'].filter(Boolean) as string[]
  for (const c of cands) { try { if (fs.existsSync(c)) return c } catch {} }
  return cfg || 'xray'   // آخرین امید: از PATH
}
export function xrayBinaryPresent(): boolean {
  const p = xrayBinPath()
  if (p === 'xray') return false   // در PATH ممکن است باشد؛ ولی مطمئن نیستیم → «نصب نیست» امن‌تر است
  try { return fs.existsSync(p) } catch { return false }
}

// ───────────────────────── پارسِ streamSettings ─────────────────────────
function streamSettings(o: { net?: string; tls?: string; sni?: string; host?: string; path?: string; alpn?: string; fp?: string; pbk?: string; sid?: string; serviceName?: string; headerType?: string; flow?: string }) {
  const net = (o.net || 'tcp').toLowerCase()
  const security = (o.tls || 'none').toLowerCase()
  const ss: any = { network: net === 'h2' ? 'http' : net, security: security === 'xtls' ? 'tls' : security }
  if (net === 'ws') ss.wsSettings = { path: o.path || '/', headers: o.host ? { Host: o.host } : {} }
  else if (net === 'grpc') ss.grpcSettings = { serviceName: o.serviceName || o.path || '' }
  else if (net === 'h2' || net === 'http') ss.httpSettings = { path: o.path || '/', host: o.host ? [o.host] : [] }
  else if (net === 'tcp' && (o.headerType === 'http')) ss.tcpSettings = { header: { type: 'http', request: { path: [o.path || '/'], headers: o.host ? { Host: [o.host] } : {} } } }
  if (ss.security === 'tls') ss.tlsSettings = { serverName: o.sni || o.host || '', allowInsecure: false, ...(o.alpn ? { alpn: o.alpn.split(',') } : {}), ...(o.fp ? { fingerprint: o.fp } : {}) }
  else if (ss.security === 'reality') ss.realitySettings = { serverName: o.sni || '', fingerprint: o.fp || 'chrome', publicKey: o.pbk || '', shortId: o.sid || '', spiderX: o.path || '/' }
  return ss
}

// ───────────────────────── پارسِ هر پروتکل ─────────────────────────
function parseVmess(link: string, tag: string): any | null {
  const j = safeJson<any>(b64decode(link.slice('vmess://'.length)))
  if (!j || !j.add || !j.port || !j.id) return null
  return {
    tag, protocol: 'vmess',
    settings: { vnext: [{ address: String(j.add), port: num(j.port, 443), users: [{ id: String(j.id), alterId: num(j.aid, 0) || 0, security: j.scy || 'auto' }] }] },
    streamSettings: streamSettings({ net: j.net, tls: j.tls, sni: j.sni, host: j.host, path: j.path, alpn: j.alpn, fp: j.fp, headerType: j.type }),
  }
}
function uriParts(link: string, scheme: string) {
  // scheme://USERINFO@host:port?query#name
  const body = link.slice(scheme.length + 3)
  const hashIdx = body.indexOf('#'); const name = hashIdx >= 0 ? decodeURIComponent(body.slice(hashIdx + 1)) : ''
  const noHash = hashIdx >= 0 ? body.slice(0, hashIdx) : body
  const qIdx = noHash.indexOf('?'); const query = qIdx >= 0 ? noHash.slice(qIdx + 1) : ''
  const main = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash
  const at = main.lastIndexOf('@'); const userinfo = at >= 0 ? main.slice(0, at) : ''
  const hostport = at >= 0 ? main.slice(at + 1) : main
  const colon = hostport.lastIndexOf(':'); const host = colon >= 0 ? hostport.slice(0, colon) : hostport
  const port = colon >= 0 ? hostport.slice(colon + 1) : '443'
  const params: Record<string, string> = {}
  for (const kv of query.split('&')) { if (!kv) continue; const i = kv.indexOf('='); const k = i >= 0 ? kv.slice(0, i) : kv; params[decodeURIComponent(k)] = decodeURIComponent(i >= 0 ? kv.slice(i + 1) : '') }
  return { userinfo, host, port: num(port, 443), params, name }
}
function parseVless(link: string, tag: string): any | null {
  const { userinfo, host, port, params } = uriParts(link, 'vless')
  if (!userinfo || !host) return null
  return {
    tag, protocol: 'vless',
    settings: { vnext: [{ address: host, port, users: [{ id: userinfo, encryption: params.encryption || 'none', flow: params.flow || '' }] }] },
    streamSettings: streamSettings({ net: params.type, tls: params.security, sni: params.sni, host: params.host, path: params.path, alpn: params.alpn, fp: params.fp, pbk: params.pbk, sid: params.sid, serviceName: params.serviceName, headerType: params.headerType, flow: params.flow }),
  }
}
function parseTrojan(link: string, tag: string): any | null {
  const { userinfo, host, port, params } = uriParts(link, 'trojan')
  if (!userinfo || !host) return null
  return {
    tag, protocol: 'trojan',
    settings: { servers: [{ address: host, port, password: userinfo }] },
    streamSettings: streamSettings({ net: params.type, tls: params.security || 'tls', sni: params.sni, host: params.host, path: params.path, alpn: params.alpn, fp: params.fp, serviceName: params.serviceName, headerType: params.headerType }),
  }
}
function parseSs(link: string, tag: string): any | null {
  // ss://base64(method:pass)@host:port#name  |  ss://base64(method:pass@host:port)#name
  const body = link.slice('ss://'.length)
  const hashIdx = body.indexOf('#'); const noHash = hashIdx >= 0 ? body.slice(0, hashIdx) : body
  let method = '', password = '', host = '', port = 443
  if (noHash.includes('@')) {
    const at = noHash.lastIndexOf('@'); const cred = b64decode(noHash.slice(0, at)) || decodeURIComponent(noHash.slice(0, at))
    const c = cred.indexOf(':'); method = cred.slice(0, c); password = cred.slice(c + 1)
    const hp = noHash.slice(at + 1); const colon = hp.lastIndexOf(':'); host = hp.slice(0, colon); port = num(hp.slice(colon + 1), 443)
  } else {
    const dec = b64decode(noHash); const at = dec.lastIndexOf('@'); const cred = dec.slice(0, at)
    const c = cred.indexOf(':'); method = cred.slice(0, c); password = cred.slice(c + 1)
    const hp = dec.slice(at + 1); const colon = hp.lastIndexOf(':'); host = hp.slice(0, colon); port = num(hp.slice(colon + 1), 443)
  }
  if (!host || !method) return null
  return { tag, protocol: 'shadowsocks', settings: { servers: [{ address: host, port, method, password }] } }
}

function parseOne(link: string, tag: string): any | null {
  const l = link.trim()
  if (l.startsWith('vmess://')) return parseVmess(l, tag)
  if (l.startsWith('vless://')) return parseVless(l, tag)
  if (l.startsWith('trojan://')) return parseTrojan(l, tag)
  if (l.startsWith('ss://')) return parseSs(l, tag)
  return null
}

// یک لینکِ اشتراک را به فهرستِ share-linkها باز می‌کند (بدنه معمولاً base64 از خطوط است).
async function expandSubscription(url: string): Promise<string[]> {
  const proxy = getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || ''
  const tryFetch = async (p: string): Promise<string> => {
    try { const r = await proxiedRequest(url, { proxyUrl: p || undefined, timeout: 20000 }); return (r.status >= 200 && r.status < 400) ? (r.body || '') : '' } catch { return '' }
  }
  // اول با پروکسی (اگر هست)، بعد مستقیم — سرورِ اشتراک معمولاً خارجی است و ممکن است هرکدام جواب دهد.
  let raw = proxy ? await tryFetch(proxy) : ''
  if (!raw) raw = await tryFetch('')
  if (!raw) return []
  const decoded = /^[A-Za-z0-9+/=_\-\s]+$/.test(raw.trim()) && !raw.includes('://') ? b64decode(raw) : raw
  return decoded.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
}

// متنِ ورودیِ کاربر (چند خط: share-link یا subscription URL) → فهرستِ outboundهای Xray.
export async function buildOutbounds(text: string): Promise<any[]> {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const links: string[] = []
  for (const ln of lines) {
    if (/^https?:\/\//i.test(ln) && !/^(vmess|vless|trojan|ss):\/\//i.test(ln)) {
      const sub = await expandSubscription(ln); links.push(...sub)
    } else links.push(ln)
  }
  const out: any[] = []
  let i = 0
  for (const ln of links) {
    const ob = parseOne(ln, `proxy-${i}`)
    if (ob) { out.push(ob); i++ }
  }
  return out
}

// ───────────────────────── ساختِ کانفیگِ Xray ─────────────────────────
export function buildXrayConfig(outbounds: any[], httpPort: number, socksPort: number) {
  return {
    log: { loglevel: 'warning' },
    inbounds: [
      { tag: 'http-in', listen: '127.0.0.1', port: httpPort, protocol: 'http', sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
      { tag: 'socks-in', listen: '127.0.0.1', port: socksPort, protocol: 'socks', settings: { udp: true }, sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
    ],
    outbounds: [
      ...outbounds,
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
    ],
    observatory: { subjectSelector: ['proxy'], probeUrl: 'https://www.gstatic.com/generate_204', probeInterval: '10s' },
    routing: {
      domainStrategy: 'AsIs',
      balancers: [{ tag: 'bal', selector: ['proxy'], strategy: { type: 'leastPing' } }],
      rules: [{ type: 'field', inboundTag: ['http-in', 'socks-in'], balancerTag: 'bal' }],
    },
  }
}

// ───────────────────────── مدیریتِ پروسه (فقط اینستنسِ ۰) ─────────────────────────
let child: ChildProcess | null = null
let serverCount = 0
let startedAt = 0
let lastErr = ''
let lastSig = ''
const logBuf: string[] = []
function pushLog(s: string) { for (const ln of s.split(/\r?\n/)) { if (!ln.trim()) continue; logBuf.push(ln); if (logBuf.length > 200) logBuf.shift() } }
const isWorker = () => process.env.NODE_APP_INSTANCE === '0' || process.env.V2RAY_ALLOW === '1'

// آیا پروسهٔ Xrayِ همین اینستنس زنده است (فقط روی کارگر معنی دارد).
function childAlive(): boolean { return !!child && !child.killed && child.exitCode === null }

// اینستنسِ ۰ وضعیت را در فایل می‌نویسد؛ چون Xray روی همان میزبان است، ۱۲۷.۰.۰.۱:PORT از همهٔ
// اینستنس‌ها در دسترس است، ولی پروسه/وضعیتِ درون‌حافظه فقط روی کارگر است → فایل پلِ اشتراکی است.
function writeStatus() {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(STATUS_PATH, JSON.stringify({ running: childAlive(), servers: serverCount, startedAt, lastErr, updatedAt: Date.now() }))
  } catch {}
}
function readStatus(): { running?: boolean; servers?: number; startedAt?: number; lastErr?: string; updatedAt?: number } | null {
  try { return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) } catch { return null }
}

// وضعیتِ «اشتراکیِ» اجرا: روی کارگر = پروسهٔ درون‌حافظه؛ روی بقیه = فایلِ تازهٔ کارگر (≤۱۲۰ث).
function sharedRunning(): boolean {
  if (isWorker()) return childAlive()
  const st = readStatus()
  return !!(st && st.running && st.updatedAt && (Date.now() - st.updatedAt) < 120_000)
}
export function v2rayRunning(): boolean { return sharedRunning() }

export function stopV2ray() {
  if (child) { try { child.kill('SIGTERM') } catch {} ; child = null }
  serverCount = 0; startedAt = 0; lastSig = ''
  writeStatus()
}

// کانفیگِ ادمین را می‌خواند، لینک را پارس می‌کند، Xray را (دوباره) اجرا می‌کند.
export async function applyV2ray(): Promise<{ ok: boolean; servers: number; error?: string }> {
  const cfg = getAdminData().v2ray
  if (!cfg?.enabled || !cfg.link?.trim()) { stopV2ray(); return { ok: false, servers: 0, error: 'disabled' } }
  if (!isWorker()) return { ok: false, servers: serverCount, error: 'not-worker' }   // فقط روی اینستنسِ ۰
  const bin = xrayBinPath()
  if (!xrayBinaryPresent() && bin === 'xray') { lastErr = 'xray-not-installed'; return { ok: false, servers: 0, error: 'xray-not-installed' } }
  const outbounds = await buildOutbounds(cfg.link)
  if (!outbounds.length) { lastErr = 'no-valid-servers'; stopV2ray(); return { ok: false, servers: 0, error: 'no-valid-servers' } }
  const httpPort = num(cfg.httpPort, V2RAY_HTTP_PORT_DEFAULT)
  const socksPort = num(cfg.socksPort, V2RAY_SOCKS_PORT_DEFAULT)
  const conf = buildXrayConfig(outbounds, httpPort, socksPort)
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(CONFIG_PATH, JSON.stringify(conf, null, 2)) } catch (e) { lastErr = 'write-config'; return { ok: false, servers: 0, error: 'write-config' } }
  stopV2ray()
  try {
    child = spawn(bin, ['run', '-c', CONFIG_PATH], { stdio: ['ignore', 'pipe', 'pipe'] })
    serverCount = outbounds.length; startedAt = Date.now(); lastErr = ''
    child.stdout?.on('data', d => pushLog(String(d)))
    child.stderr?.on('data', d => pushLog(String(d)))
    child.on('exit', (code, sig) => { pushLog(`[xray] exited code=${code} sig=${sig}`); if (child && child.exitCode !== null) { /* exited */ } })
    child.on('error', e => { lastErr = String((e as Error).message || e); pushLog('[xray] spawn error: ' + lastErr) })
    pushLog(`[xray] started pid=${child.pid} servers=${outbounds.length} http=${httpPort}`)
    lastSig = configSig(cfg)
    writeStatus()
    return { ok: true, servers: outbounds.length }
  } catch (e) { lastErr = String((e as Error).message || e); writeStatus(); return { ok: false, servers: 0, error: lastErr } }
}

// امضای تنظیماتِ فعلی — برای تشخیصِ «کاربر لینک/پورت را عوض کرد» روی کارگر.
function configSig(cfg: any): string {
  return [cfg?.enabled ? '1' : '0', cfg?.link || '', cfg?.httpPort || '', cfg?.socksPort || '', cfg?.binPath || ''].join('§')
}

// کارگرِ کرون (اینستنسِ ۰) هر تیک این را صدا می‌زند: اگر تنظیمات عوض شده یا پروسه مرده، دوباره اعمال؛
// اگر خاموش شده، توقف. ضربانِ وضعیت هم همین‌جا تازه می‌شود (تا بقیهٔ اینستنس‌ها «در حال اجرا» را ببینند).
export async function syncV2ray(): Promise<void> {
  if (!isWorker()) return
  const cfg = getAdminData().v2ray
  const sig = configSig(cfg)
  if (!cfg?.enabled || !cfg.link?.trim()) { if (childAlive()) stopV2ray(); else writeStatus(); return }
  if (sig !== lastSig || !childAlive()) { await applyV2ray(); return }
  writeStatus()   // ضربانِ تازگی
}

// آدرسِ پراکسیِ محلیِ v2ray اگر روشن و در حالِ اجراست؛ وگرنه ''.
export function v2rayProxyUrl(): string {
  const cfg = getAdminData().v2ray
  if (!cfg?.enabled || !v2rayRunning()) return ''
  return `http://127.0.0.1:${num(cfg.httpPort, V2RAY_HTTP_PORT_DEFAULT)}`
}

// پراکسیِ «خروجیِ خارجی» برای تلگرام/انتشار/… : اول v2ray، بعد پراکسیِ دستیِ قبلی، بعد env.
export function outboundProxyUrl(): string {
  return v2rayProxyUrl()
    || getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || ''
}

// تستِ زنده: یک درخواست از پراکسیِ محلیِ v2ray به یک URLِ خارجی و اندازه‌گیریِ پینگ.
export async function testV2ray(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  const url = v2rayProxyUrl()
  if (!url) return { ok: false, error: 'not-running' }
  const t0 = Date.now()
  try {
    const r = await proxiedRequest('https://www.gstatic.com/generate_204', { proxyUrl: url, timeout: 12000 })
    if (r.status >= 200 && r.status < 400) return { ok: true, ms: Date.now() - t0 }
    return { ok: false, error: `http-${r.status}` }
  } catch (e) { return { ok: false, error: String((e as Error).message || e).slice(0, 120) } }
}

export function v2rayStatus() {
  const cfg = getAdminData().v2ray
  const worker = isWorker()
  const st = worker ? null : readStatus()   // روی اینستنسِ غیرکارگر، وضعیتِ واقعی از فایلِ کارگر می‌آید
  const started = worker ? startedAt : (st?.startedAt || 0)
  return {
    enabled: !!cfg?.enabled,
    running: v2rayRunning(),
    servers: worker ? serverCount : (st?.servers || 0),
    httpPort: num(cfg?.httpPort, V2RAY_HTTP_PORT_DEFAULT),
    socksPort: num(cfg?.socksPort, V2RAY_SOCKS_PORT_DEFAULT),
    binaryPresent: xrayBinaryPresent(),
    binPath: xrayBinPath(),
    uptimeSec: started ? Math.round((Date.now() - started) / 1000) : 0,
    lastError: worker ? lastErr : (st?.lastErr || ''),
    log: logBuf.slice(-80),
    worker,
  }
}
