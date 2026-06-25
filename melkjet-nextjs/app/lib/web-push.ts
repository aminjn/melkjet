import crypto from 'node:crypto'
import { getAdminData, saveAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

// Web Push بدونِ هیچ وابستگیِ npm — VAPID (ES256) + رمزنگاریِ aes128gcm (RFC 8291/8188).
// ارسال به سرویس‌های پوش (FCM/Mozilla/Apple) از طریقِ همان پروکسیِ دیوار (دسترسیِ خارجی).

export interface PushSubscription { endpoint: string; keys: { p256dh: string; auth: string } }

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlDec = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const hmac = (key: Buffer, data: Buffer) => crypto.createHmac('sha256', key).update(data).digest()
const hkdfExpand = (prk: Buffer, info: Buffer, len: number) => hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, len)

// کلیدهای VAPID — یک‌بار ساخته و در admin-data ذخیره می‌شوند.
export function getVapid(): { publicKey: string; privateKeyPem: string; subject: string } {
  const data = getAdminData()
  if (data.webpush?.publicKey && data.webpush?.privateKeyPem) return { publicKey: data.webpush.publicKey, privateKeyPem: data.webpush.privateKeyPem, subject: data.webpush.subject || 'mailto:naeiniamini@gmail.com' }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const raw = spki.subarray(spki.length - 65) // نقطهٔ ناهمفشردهٔ P-256 (۶۵ بایت)
  const pub = b64url(raw)
  data.webpush = { publicKey: pub, privateKeyPem, subject: 'mailto:naeiniamini@gmail.com' }
  saveAdminData(data)
  return { publicKey: pub, privateKeyPem, subject: data.webpush.subject! }
}

function vapidAuth(endpoint: string): string {
  const { publicKey, privateKeyPem, subject } = getVapid()
  const aud = new URL(endpoint).origin
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64url(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })))
  const signingInput = `${header}.${payload}`
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key: crypto.createPrivateKey(privateKeyPem), dsaEncoding: 'ieee-p1363' })
  return `vapid t=${signingInput}.${b64url(sig)}, k=${publicKey}`
}

// رمزنگاریِ aes128gcm طبقِ RFC 8291
function encrypt(payload: string, p256dh: string, auth: string): Buffer {
  const uaPublic = b64urlDec(p256dh)         // ۶۵ بایت
  const authSecret = b64urlDec(auth)         // ۱۶ بایت
  const ecdh = crypto.createECDH('prime256v1')
  const asPublic = ecdh.generateKeys()       // ۶۵ بایت
  const ecdhSecret = ecdh.computeSecret(uaPublic) // ۳۲ بایت

  const authPrk = hmac(authSecret, ecdhSecret)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info'), Buffer.from([0]), uaPublic, asPublic])
  const ikm = hkdfExpand(authPrk, keyInfo, 32)

  const salt = crypto.randomBytes(16)
  const prk = hmac(salt, ikm)
  const cek = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm'), Buffer.from([0])]), 16)
  const nonce = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce'), Buffer.from([0])]), 12)

  const plaintext = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])]) // دلیمیترِ رکوردِ پایانی
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0)
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ct])
}

// ارسالِ یک پوش. خروجی: کدِ وضعیت (۲۰۱ موفق؛ ۴۰۴/۴۱۰ یعنی منقضی → باید حذف شود).
export async function sendPush(sub: PushSubscription, payloadObj: any): Promise<number> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return 0
  const body = encrypt(JSON.stringify(payloadObj), sub.keys.p256dh, sub.keys.auth)
  const headers: Record<string, string> = {
    Authorization: vapidAuth(sub.endpoint),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: '2419200',
  }
  const proxyUrl = getAdminData().divar?.proxyUrl
  try {
    const res = await proxiedRequest(sub.endpoint, { method: 'POST', headers, body, proxyUrl, timeout: 15000 })
    return res.status
  } catch {
    // اگر پروکسی نبود، تلاشِ مستقیم
    try { const res2 = await proxiedRequest(sub.endpoint, { method: 'POST', headers, body, timeout: 15000 }); return res2.status } catch { return 0 }
  }
}
