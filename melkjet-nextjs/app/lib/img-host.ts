import { randomBytes } from 'crypto'
import { proxiedRequest } from './proxy-fetch'

// آپلود موقتِ عکس روی litterbox (هاست جهانی با حذف خودکار) از طریق پروکسیِ سرور.
// لازم است چون سرویس بیناییِ خارجی نمی‌تواند هاستِ ایرانیِ ما را فِچ کند و base64 هم
// پشتیبانی نمی‌شود؛ پس عکس را روی URLِ قابل‌دسترسِ بین‌المللی می‌گذاریم.
// time: 1h | 12h | 24h | 72h  (خودکار پاک می‌شود → حریم خصوصی)
export async function uploadTempImage(buf: Buffer, mime: string, proxyUrl?: string, time = '1h', timeout = 25000): Promise<string> {
  const boundary = '----melkjet' + randomBytes(8).toString('hex')
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="time"\r\n\r\n${time}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="room.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`,
    'utf8',
  )
  const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const body = Buffer.concat([pre, buf, post])

  const res = await proxiedRequest('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
    proxyUrl,
    timeout,
  })
  const url = (res.body || '').trim()
  if (res.status === 200 && /^https?:\/\/\S+$/.test(url)) return url
  throw new Error(`آپلود عکس ناموفق (HTTP ${res.status}): ${url.slice(0, 140)}`)
}
