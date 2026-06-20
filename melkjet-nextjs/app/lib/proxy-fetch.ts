import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'

interface Opts {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  proxyUrl?: string
  timeout?: number
}

/**
 * Dependency-free HTTPS request that can tunnel through an HTTP proxy
 * (CONNECT). Used for hosts only reachable via the server's proxy (e.g. Divar).
 */
export function proxiedRequest(targetUrl: string, opts: Opts = {}): Promise<{ status: number; body: string }> {
  const { method = 'GET', headers = {}, body, proxyUrl, timeout = 15000 } = opts
  const u = new URL(targetUrl)
  const path = u.pathname + u.search
  const baseHeaders: Record<string, string> = { Host: u.hostname, ...headers }
  if (body) baseHeaders['Content-Length'] = String(Buffer.byteLength(body))

  return new Promise((resolve, reject) => {
    const sendOverSocket = (socket: tls.TLSSocket | null) => {
      const reqOpts: https.RequestOptions = socket
        ? { method, path, headers: baseHeaders, createConnection: () => socket as any, timeout }
        : { host: u.hostname, port: 443, method, path, headers: baseHeaders, servername: u.hostname, timeout }
      const lib = socket ? http : https
      const req = lib.request(reqOpts, (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (c) => { data += c })
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
      })
      req.on('error', reject)
      req.setTimeout(timeout, () => req.destroy(new Error('request timeout')))
      if (body) req.write(body)
      req.end()
    }

    if (!proxyUrl) { sendOverSocket(null); return }

    const p = new URL(proxyUrl)
    const connectHeaders: Record<string, string> = {}
    if (p.username) {
      const auth = Buffer.from(`${decodeURIComponent(p.username)}:${decodeURIComponent(p.password)}`).toString('base64')
      connectHeaders['Proxy-Authorization'] = `Basic ${auth}`
    }
    const connectReq = http.request({
      host: p.hostname,
      port: Number(p.port) || 80,
      method: 'CONNECT',
      path: `${u.hostname}:443`,
      headers: connectHeaders,
      timeout,
    })
    connectReq.on('connect', (res, rawSocket) => {
      if (res.statusCode !== 200) { reject(new Error(`proxy CONNECT failed: ${res.statusCode}`)); return }
      const tlsSocket = tls.connect({ socket: rawSocket, servername: u.hostname }, () => sendOverSocket(tlsSocket))
      tlsSocket.on('error', reject)
    })
    connectReq.on('error', reject)
    connectReq.setTimeout(timeout, () => connectReq.destroy(new Error('proxy timeout')))
    connectReq.end()
  })
}
