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
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { getAdminData, saveAdminData } from './admin-store'
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
// فاز ۳۴۷ — پشتیبانیِ کاملِ ترنسپورت‌های جدید (پنل‌های Marzneshin/Marzban/3x-ui زیاد از این‌ها می‌دهند):
// httpupgrade، xhttp/splithttp، kcp، grpc multiMode، allowInsecure، reality spiderX/mldsa65Verify، ws.host.
// قبلاً این‌ها یا نادیده گرفته می‌شدند یا با مسیر/هاستِ پیش‌فرض ساخته می‌شدند → Xray بالا می‌آمد ولی
// سرور اتصال را رد می‌کرد («disconnected before secure TLS connection»).
type StreamOpts = { net?: string; tls?: string; sni?: string; host?: string; path?: string; alpn?: string; fp?: string; pbk?: string; sid?: string; spx?: string; pqv?: string; serviceName?: string; authority?: string; headerType?: string; mode?: string; seed?: string; extra?: string; insecure?: boolean }
const truthy = (v: any) => v === true || v === 1 || /^(1|true|yes)$/i.test(String(v ?? ''))
function streamSettings(o: StreamOpts) {
  let net = String(o.net || 'tcp').toLowerCase()
  if (net === 'raw') net = 'tcp'
  if (net === 'splithttp') net = 'xhttp'
  const security = String(o.tls || 'none').toLowerCase() || 'none'
  const ss: any = { network: net === 'h2' ? 'http' : net, security: security === 'xtls' ? 'tls' : (security === 'reality' || security === 'tls' ? security : 'none') }
  const host = String(o.host || '').trim()
  const firstHost = host.split(',')[0].trim()
  if (net === 'ws') ss.wsSettings = { path: o.path || '/', ...(firstHost ? { host: firstHost, headers: { Host: firstHost } } : {}) }
  else if (net === 'httpupgrade') ss.httpupgradeSettings = { path: o.path || '/', ...(firstHost ? { host: firstHost } : {}) }
  else if (net === 'xhttp') {
    const extra = o.extra ? safeJson<any>(o.extra) : null
    ss.xhttpSettings = { path: o.path || '/', ...(firstHost ? { host: firstHost } : {}), mode: o.mode || 'auto', ...(extra && typeof extra === 'object' ? { extra } : {}) }
  }
  else if (net === 'grpc') ss.grpcSettings = { serviceName: o.serviceName || o.path || '', multiMode: String(o.mode || '').toLowerCase() === 'multi', ...(o.authority ? { authority: o.authority } : {}) }
  else if (net === 'h2' || net === 'http') ss.httpSettings = { path: o.path || '/', host: host ? host.split(',').map(x => x.trim()).filter(Boolean) : [] }
  else if (net === 'kcp' || net === 'mkcp') { ss.network = 'kcp'; ss.kcpSettings = { header: { type: o.headerType || 'none' }, ...(o.seed || o.path ? { seed: o.seed || o.path } : {}) } }
  else if (net === 'tcp' && (o.headerType === 'http')) ss.tcpSettings = { header: { type: 'http', request: { path: (o.path || '/').split(','), headers: host ? { Host: host.split(',').map(x => x.trim()).filter(Boolean) } : {} } } }
  if (ss.security === 'tls') ss.tlsSettings = { serverName: o.sni || firstHost || '', ...(o.insecure ? { allowInsecure: true } : {}), ...(o.alpn ? { alpn: o.alpn.split(',').map(x => x.trim()).filter(Boolean) } : {}), ...(o.fp ? { fingerprint: o.fp } : {}) }
  else if (ss.security === 'reality') ss.realitySettings = { serverName: o.sni || '', fingerprint: o.fp || 'chrome', publicKey: o.pbk || '', shortId: o.sid || '', spiderX: o.spx || '/', ...(o.pqv ? { mldsa65Verify: o.pqv } : {}) }
  return ss
}

// ───────────────────────── پارسِ هر پروتکل ─────────────────────────
function parseVmess(link: string, tag: string): any | null {
  const j = safeJson<any>(b64decode(link.slice('vmess://'.length)))
  if (!j || !j.add || !j.port || !j.id) return null
  const net = String(j.net || 'tcp').toLowerCase()
  // در vmess-JSONِ v2rayN برای grpc، «type» همان mode است (gun/multi) و path همان serviceName.
  const isGrpc = net === 'grpc'
  return {
    tag, protocol: 'vmess', _name: String(j.ps || ''),
    settings: { vnext: [{ address: String(j.add).replace(/^\[|\]$/g, ''), port: num(j.port, 443), users: [{ id: String(j.id), alterId: num(j.aid, 0) || 0, security: j.scy || 'auto' }] }] },
    streamSettings: streamSettings({ net, tls: j.tls, sni: j.sni, host: j.host, path: j.path, alpn: j.alpn, fp: j.fp, headerType: isGrpc ? undefined : j.type, mode: j.mode || (isGrpc ? j.type : undefined), serviceName: j.serviceName, authority: j.authority, insecure: truthy(j.allowInsecure) || truthy(j.insecure), seed: j.seed, extra: j.extra }),
  }
}
function safeDecode(s: string): string { try { return decodeURIComponent(s.replace(/\+/g, '%20')) } catch { return s } }
function safeDecodeKeepPlus(s: string): string { try { return decodeURIComponent(s) } catch { return s } }
function uriParts(link: string, scheme: string) {
  // scheme://USERINFO@host:port?query#name   (host می‌تواند IPv6 داخلِ [] باشد)
  const body = link.slice(scheme.length + 3)
  const hashIdx = body.indexOf('#'); const name = hashIdx >= 0 ? safeDecode(body.slice(hashIdx + 1)) : ''
  const noHash = hashIdx >= 0 ? body.slice(0, hashIdx) : body
  const qIdx = noHash.indexOf('?'); const query = qIdx >= 0 ? noHash.slice(qIdx + 1) : ''
  const main = (qIdx >= 0 ? noHash.slice(0, qIdx) : noHash).replace(/\/+$/, '')
  const at = main.lastIndexOf('@'); const userinfo = at >= 0 ? safeDecodeKeepPlus(main.slice(0, at)) : ''
  const hostport = at >= 0 ? main.slice(at + 1) : main
  let host = '', port = '443'
  const v6 = hostport.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (v6) { host = v6[1]; port = v6[2] || '443' }
  else { const colon = hostport.lastIndexOf(':'); host = colon >= 0 ? hostport.slice(0, colon) : hostport; port = colon >= 0 ? hostport.slice(colon + 1) : '443' }
  const params: Record<string, string> = {}
  for (const kv of query.split('&')) { if (!kv) continue; const i = kv.indexOf('='); const k = i >= 0 ? kv.slice(0, i) : kv; params[safeDecodeKeepPlus(k)] = safeDecodeKeepPlus(i >= 0 ? kv.slice(i + 1) : '') }
  return { userinfo, host, port: num(port, 443), params, name }
}
const uriStream = (p: Record<string, string>, defTls = 'none'): StreamOpts => ({
  net: p.type, tls: p.security || defTls, sni: p.sni || p.peer, host: p.host, path: p.path, alpn: p.alpn, fp: p.fp,
  pbk: p.pbk, sid: p.sid, spx: p.spx, pqv: p.pqv, serviceName: p.serviceName, authority: p.authority, headerType: p.headerType,
  mode: p.mode, seed: p.seed, extra: p.extra, insecure: truthy(p.allowInsecure) || truthy(p.insecure) || truthy(p.allow_insecure),
})
function parseVless(link: string, tag: string): any | null {
  const { userinfo, host, port, params, name } = uriParts(link, 'vless')
  if (!userinfo || !host) return null
  return {
    tag, protocol: 'vless', _name: name,
    settings: { vnext: [{ address: host, port, users: [{ id: userinfo, encryption: params.encryption || 'none', flow: params.flow || '' }] }] },
    streamSettings: streamSettings(uriStream(params)),
  }
}
function parseTrojan(link: string, tag: string): any | null {
  const { userinfo, host, port, params, name } = uriParts(link, 'trojan')
  if (!userinfo || !host) return null
  return {
    tag, protocol: 'trojan', _name: name,
    settings: { servers: [{ address: host, port, password: userinfo }] },
    streamSettings: streamSettings(uriStream(params, 'tls')),
  }
}
function parseSs(link: string, tag: string): any | null {
  // ss://base64(method:pass)@host:port[/?plugin=…]#name | ss://method:pass@host:port#name | ss://base64(method:pass@host:port)#name
  const body = link.slice('ss://'.length)
  const hashIdx = body.indexOf('#'); const noHash = hashIdx >= 0 ? body.slice(0, hashIdx) : body
  const name = hashIdx >= 0 ? safeDecode(body.slice(hashIdx + 1)) : ''
  const core = noHash.split('?')[0].replace(/\/+$/, '')
  const looksCred = (c: string) => /^[a-z0-9-]+:.+/i.test(c) && !/[^\x20-\x7e]/.test(c)
  let method = '', password = '', host = '', port = 443
  const hostPort = (hp: string) => { const m = hp.match(/^\[([^\]]+)\]:(\d+)$/); if (m) return { h: m[1], p: num(m[2], 443) }; const colon = hp.lastIndexOf(':'); return { h: hp.slice(0, colon), p: num(hp.slice(colon + 1), 443) } }
  if (core.includes('@')) {
    const at = core.lastIndexOf('@'); const rawCred = core.slice(0, at)
    const dec = b64decode(rawCred)
    const cred = looksCred(dec) ? dec : safeDecodeKeepPlus(rawCred)
    const c = cred.indexOf(':'); method = cred.slice(0, c); password = cred.slice(c + 1)
    const hp = hostPort(core.slice(at + 1)); host = hp.h; port = hp.p
  } else {
    const dec = b64decode(core); const at = dec.lastIndexOf('@'); const cred = dec.slice(0, at)
    const c = cred.indexOf(':'); method = cred.slice(0, c); password = cred.slice(c + 1)
    const hp = hostPort(dec.slice(at + 1)); host = hp.h; port = hp.p
  }
  if (!host || !method) return null
  return { tag, protocol: 'shadowsocks', _name: name, settings: { servers: [{ address: host, port, method, password }] } }
}

function parseOne(link: string, tag: string): any | null {
  const l = link.trim()
  try {
    if (/^vmess:\/\//i.test(l)) return parseVmess('vmess://' + l.slice(8), tag)
    if (/^vless:\/\//i.test(l)) return parseVless('vless://' + l.slice(8), tag)
    if (/^trojan:\/\//i.test(l)) return parseTrojan('trojan://' + l.slice(9), tag)
    if (/^ss:\/\//i.test(l)) return parseSs('ss://' + l.slice(5), tag)
  } catch {}
  return null
}

// اشتراکِ با فرمتِ JSONِ Xray (آرایه‌ای از کانفیگ‌های کامل — بعضی پنل‌ها برای کلاینت‌های جدید می‌دهند):
// outboundهای پروکسیِ هر کانفیگ را برمی‌داریم (اولی از هر کانفیگ).
function outboundsFromJson(raw: string): any[] {
  const j = safeJson<any>(raw.trim())
  if (!j) return []
  const configs = Array.isArray(j) ? j : [j]
  const out: any[] = []
  for (const c of configs) {
    const obs = Array.isArray(c?.outbounds) ? c.outbounds : []
    const ob = obs.find((o: any) => ['vmess', 'vless', 'trojan', 'shadowsocks'].includes(String(o?.protocol)))
    if (ob) { const { tag: _t, ...rest } = ob; out.push({ ...rest, _name: String(c?.remarks || ob.tag || '') }) }
  }
  return out
}

// یک لینکِ اشتراک را به فهرستِ share-linkها (یا outboundهای JSON) باز می‌کند (بدنه معمولاً base64 از خطوط است).
async function expandSubscription(url: string): Promise<{ links: string[]; json: any[] }> {
  const proxy = getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || ''
  const tryFetch = async (p: string): Promise<string> => {
    try { const r = await proxiedRequest(url, { proxyUrl: p || undefined, timeout: 20000 }); return (r.status >= 200 && r.status < 400) ? (r.body || '') : '' } catch { return '' }
  }
  // اول با پروکسی (اگر هست)، بعد مستقیم — سرورِ اشتراک معمولاً خارجی است و ممکن است هرکدام جواب دهد.
  let raw = proxy ? await tryFetch(proxy) : ''
  if (!raw) raw = await tryFetch('')
  if (!raw) return { links: [], json: [] }
  const t = raw.trim()
  if (t.startsWith('[') || t.startsWith('{')) { const json = outboundsFromJson(t); if (json.length) return { links: [], json } }
  const decoded = /^[A-Za-z0-9+/=_\-\s]+$/.test(t) && !t.includes('://') ? b64decode(t) : raw
  return { links: decoded.split(/\r?\n/).map(s => s.trim()).filter(Boolean), json: [] }
}

export type V2rayServerMeta = { tag: string; name: string; protocol: string; network: string; security: string; address: string; port: number }
function metaOf(ob: any): V2rayServerMeta {
  const s = ob.settings || {}
  const srv = s.vnext?.[0] || s.servers?.[0] || {}
  return { tag: ob.tag, name: String(ob._name || '').slice(0, 60), protocol: ob.protocol, network: ob.streamSettings?.network || 'tcp', security: ob.streamSettings?.security || 'none', address: String(srv.address || ''), port: Number(srv.port || 0) }
}

// متنِ ورودیِ کاربر (چند خط: share-link یا subscription URL) → outboundها + متادیتا (نام/نوع برای عیب‌یابی).
export async function buildOutboundsMeta(text: string): Promise<{ outbounds: any[]; meta: V2rayServerMeta[] }> {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const items: Array<string | any> = []
  for (const ln of lines) {
    if (/^https?:\/\//i.test(ln)) {
      const sub = await expandSubscription(ln); items.push(...sub.links, ...sub.json)
    } else if (ln.startsWith('[') || ln.startsWith('{')) items.push(...outboundsFromJson(ln))
    else items.push(ln)
  }
  const outbounds: any[] = []
  const meta: V2rayServerMeta[] = []
  for (const it of items) {
    const tag = `proxy-${outbounds.length}`
    const ob = typeof it === 'string' ? parseOne(it, tag) : { ...it, tag }
    if (!ob) continue
    meta.push(metaOf(ob))
    const { _name, ...clean } = ob   // Xray فیلدِ ناشناخته نمی‌خواهد
    outbounds.push(clean)
  }
  return { outbounds, meta }
}
export async function buildOutbounds(text: string): Promise<any[]> { return (await buildOutboundsMeta(text)).outbounds }

// ───────────────────────── ساختِ کانفیگِ Xray ─────────────────────────
export function buildXrayConfig(outbounds: any[], httpPort: number, socksPort: number, preferTag = '') {
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
    // enableConcurrency: همهٔ سرورها هم‌زمان پینگ می‌شوند (وگرنه با ۳۰ سرور چند دقیقه طول می‌کشد تا
    // balancer اولین سرورِ سالم را بشناسد و تا آن موقع همهٔ درخواست‌ها قطع می‌شوند).
    observatory: { subjectSelector: ['proxy'], probeUrl: 'https://www.gstatic.com/generate_204', probeInterval: '30s', enableConcurrency: true },
    routing: {
      domainStrategy: 'AsIs',
      balancers: [{ tag: 'bal', selector: ['proxy'], strategy: { type: 'leastPing' }, ...(outbounds[0]?.tag ? { fallbackTag: preferTag || outbounds[0].tag } : {}) }],
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
    fs.writeFileSync(STATUS_PATH, JSON.stringify({ running: childAlive(), servers: serverCount, startedAt, lastErr, updatedAt: Date.now(), log: logBuf.slice(-80) }))
  } catch {}
}
function readStatus(): { running?: boolean; servers?: number; startedAt?: number; lastErr?: string; updatedAt?: number; log?: string[] } | null {
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
  const built = await buildOutboundsMeta(cfg.link)
  if (!built.outbounds.length) { lastErr = 'no-valid-servers'; stopV2ray(); return { ok: false, servers: 0, error: 'no-valid-servers' } }
  const outbounds = orderByGood(built.outbounds, built.meta, cfg.goodKeys || [])
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
  return [cfg?.enabled ? '1' : '0', cfg?.link || '', cfg?.httpPort || '', cfg?.socksPort || '', cfg?.binPath || '', (cfg?.goodKeys || []).join(',')].join('§')
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
export async function testV2ray(): Promise<{ ok: boolean; ms?: number; error?: string; hint?: string }> {
  const url = v2rayProxyUrl()
  if (!url) return { ok: false, error: 'not-running' }
  const t0 = Date.now()
  try {
    const r = await proxiedRequest('https://www.gstatic.com/generate_204', { proxyUrl: url, timeout: 12000 })
    if (r.status >= 200 && r.status < 400) return { ok: true, ms: Date.now() - t0 }
    return { ok: false, error: `http-${r.status}` }
  } catch (e) { const raw = String((e as Error).message || e).slice(0, 120); return { ok: false, error: raw, hint: explainXrayError(raw) } }
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
    log: worker ? logBuf.slice(-80) : (st?.log || []),   // لاگِ کارگر از فایل (قبلاً روی اینستنس‌های دیگر خالی بود)
    lastEach: lastEachSummary(),
    worker,
  }
}

// ───────────────────────── فاز ۳۴۷: تستِ تک‌تکِ سرورها ─────────────────────────
// یک Xrayِ موقت با یک inboundِ جدا برای هر سرور بالا می‌آید (پورت‌های تصادفی، فقط 127.0.0.1)، از هر
// سرور جدا generate_204 گرفته می‌شود و دلیلِ خطا از لاگِ Xray (سطحِ info، با شناسهٔ نشست) به همان
// سرور نسبت داده می‌شود. سرورهای سالم (سریع‌ترین اول) در goodKeys ذخیره می‌شوند تا کارگر آن‌ها را
// اولِ صف و fallbackِ balancer بگذارد. پروسهٔ اصلی دست نمی‌خورد.
export type V2rayEachResult = V2rayServerMeta & { ok: boolean; ms?: number; error?: string; detail?: string }
const serverKey = (m: V2rayServerMeta) => [m.protocol, m.address, m.port, m.network, m.security].join('|')
function orderByGood(outbounds: any[], meta: V2rayServerMeta[], goodKeys: string[]): any[] {
  if (!goodKeys.length) return outbounds
  const rank = new Map(goodKeys.map((k, i) => [k, i]))
  const idx = outbounds.map((_, i) => i)
  idx.sort((a, b) => (rank.get(serverKey(meta[a])) ?? 1e9) - (rank.get(serverKey(meta[b])) ?? 1e9) || a - b)
  return idx.map((i, n) => ({ ...outbounds[i], tag: `proxy-${n}` }))
}
let eachBusy = false
let lastEach: { at: number; total: number; ok: number } | null = null
function lastEachSummary() { return lastEach }

// خطای خامِ Xray/Node → توضیحِ فارسیِ کوتاه برای پنل.
export function explainXrayError(e: string): string {
  const s = String(e || '')
  if (/i\/o timeout|deadline exceeded|request timeout|timed out|ETIMEDOUT/i.test(s)) return 'سرور از این هاست جواب نداد (timeout) — احتمالاً IP/پورتِ سرور از دیتاسنترِ شما مسدود است'
  if (/connection refused|ECONNREFUSED/i.test(s)) return 'پورتِ سرور بسته است (connection refused)'
  if (/no such host|lookup .* (server misbehaving|no such)|ENOTFOUND/i.test(s)) return 'دامنهٔ سرور resolve نشد (DNS)'
  if (/REALITY|processed invalid connection|reality/i.test(s)) return 'کلید/SNIِ reality پذیرفته نشد'
  if (/bad handshake|websocket|unexpected status|httpupgrade|status code 40\d/i.test(s)) return 'مسیر/هاستِ ترنسپورت (ws/httpupgrade/xhttp) را سرور نپذیرفت'
  if (/x509|certificate|tls: |handshake failure|remote error/i.test(s)) return 'خطای TLS (SNI/گواهی)'
  if (/connection reset|ECONNRESET|EOF|disconnected before secure TLS|socket hang up/i.test(s)) return 'سرور اتصال را قطع کرد (کانفیگ رد شد، کاربر منقضی، یا مسیر فیلتر است)'
  if (/invalid user|not found user|authentication/i.test(s)) return 'کاربر/UUID پذیرفته نشد (اشتراک منقضی؟)'
  return ''
}

async function freePorts(n: number): Promise<number> {
  // یک بلوکِ پیوسته از پورت‌های تصادفی؛ تداخل بعید است و اگر شد Xray خطا می‌دهد و گزارش می‌شود.
  return 20000 + Math.floor(Math.random() * (40000 - n))
}

export async function testEachV2ray(opts: { save?: boolean } = {}): Promise<{ ok: boolean; error?: string; results?: V2rayEachResult[]; log?: string[]; xrayVersion?: string }> {
  if (eachBusy) return { ok: false, error: 'busy' }
  const cfg = getAdminData().v2ray
  if (!cfg?.link?.trim()) return { ok: false, error: 'no-link' }
  const bin = xrayBinPath()
  if (!xrayBinaryPresent() && bin === 'xray') return { ok: false, error: 'xray-not-installed' }
  eachBusy = true
  let proc: ChildProcess | null = null
  const tlog: string[] = []
  try {
    const { outbounds: all, meta: allMeta } = await buildOutboundsMeta(cfg.link)
    if (!all.length) return { ok: false, error: 'no-valid-servers' }
    const N = Math.min(all.length, 60)
    const outbounds = all.slice(0, N), meta = allMeta.slice(0, N)
    const base = await freePorts(N)
    const conf = {
      log: { loglevel: 'info' },
      inbounds: outbounds.map((_, i) => ({ tag: `t-${i}`, listen: '127.0.0.1', port: base + i, protocol: 'http' })),
      outbounds: [...outbounds, { tag: 'direct', protocol: 'freedom' }],
      routing: { domainStrategy: 'AsIs', rules: outbounds.map((o, i) => ({ type: 'field', inboundTag: [`t-${i}`], outboundTag: o.tag })) },
    }
    const cfgPath = path.join(os.tmpdir(), `melkjet-xray-test-${process.pid}-${Date.now()}.json`)
    fs.writeFileSync(cfgPath, JSON.stringify(conf))
    let version = ''
    let exited = ''
    proc = spawn(bin, ['run', '-c', cfgPath], { stdio: ['ignore', 'pipe', 'pipe'] })
    const onData = (d: any) => { for (const ln of String(d).split(/\r?\n/)) { if (!ln.trim()) continue; tlog.push(ln); if (tlog.length > 4000) tlog.shift(); const m = ln.match(/Xray (\d+\.\d+\.\d+)/); if (m && !version) version = m[1] } }
    proc.stdout?.on('data', onData); proc.stderr?.on('data', onData)
    proc.on('exit', (code) => { exited = `exit ${code}` })
    proc.on('error', (e) => { exited = String((e as Error).message || e) })
    // صبر تا «started» یا خروج (حداکثر ۶ث)
    for (let w = 0; w < 60 && !exited && !tlog.some(l => /started/i.test(l)); w++) await new Promise(r => setTimeout(r, 100))
    try { fs.unlinkSync(cfgPath) } catch {}
    if (exited) {
      const errLines = tlog.filter(l => /fail|error|invalid|unknown/i.test(l)).slice(-8)
      return { ok: false, error: 'xray-config: ' + (errLines.join(' | ') || exited).slice(0, 600), log: tlog.slice(-40), xrayVersion: version }
    }
    const results: V2rayEachResult[] = meta.map(m => ({ ...m, ok: false }))
    let next = 0
    const worker = async () => {
      while (next < N) {
        const i = next++
        const t0 = Date.now()
        try {
          const r = await proxiedRequest('https://www.gstatic.com/generate_204', { proxyUrl: `http://127.0.0.1:${base + i}`, timeout: 10000 })
          if (r.status >= 200 && r.status < 400) { results[i].ok = true; results[i].ms = Date.now() - t0 }
          else results[i].error = `http-${r.status}`
        } catch (e) { results[i].error = String((e as Error).message || e).slice(0, 140) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(10, N) }, worker))
    await new Promise(r => setTimeout(r, 300))
    // نسبت‌دادنِ خطای لاگ به سرور: «[Info] [SID] app/dispatcher: taking detour [proxy-3] …» سپس خطاهای همان SID.
    const sidTag = new Map<string, string>()
    for (const l of tlog) { const m = l.match(/\[(\d+)\][^\n]*taking detour \[(proxy-\d+)\]/); if (m) sidTag.set(m[1], m[2]) }
    const tagErr = new Map<string, string>()
    for (const l of tlog) {
      const m = l.match(/\[(\d+)\]\s+(.*)$/); if (!m) continue
      const tag = sidTag.get(m[1]); if (!tag) continue
      if (/fail|error|timeout|refused|reset|EOF|invalid|reject|closed/i.test(m[2]) && !/taking detour/.test(m[2])) tagErr.set(tag, m[2].slice(-260))
    }
    for (const r of results) {
      if (r.ok) continue
      const d = tagErr.get(r.tag) || ''
      r.detail = d
      r.error = explainXrayError(d) || explainXrayError(r.error || '') || r.error
    }
    const good = results.filter(r => r.ok).sort((a, b) => (a.ms || 0) - (b.ms || 0))
    lastEach = { at: Date.now(), total: N, ok: good.length }
    if (opts.save !== false && good.length) {
      const data = getAdminData()
      data.v2ray = { ...(data.v2ray || {}), goodKeys: good.map(serverKey) }
      saveAdminData(data)
    }
    return { ok: true, results, xrayVersion: version, log: tlog.filter(l => !/\[Info\]/.test(l)).slice(-30) }
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e).slice(0, 200), log: tlog.slice(-30) }
  } finally {
    if (proc) { try { proc.kill('SIGTERM') } catch {} }
    eachBusy = false
  }
}
