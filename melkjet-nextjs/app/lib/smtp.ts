import net from 'node:net'
import tls from 'node:tls'

// کلاینت SMTP کوچک و بدون وابستگی (پشتیبانی از TLS مستقیم پورت 465 و STARTTLS پورت 587/25).
// برای ارسال ایمیل کمپین/اعلان بدون نیاز به پکیج بیرونی.

export interface SmtpConfig { host: string; port: number; user: string; pass: string; from: string }

interface Conn { sock: net.Socket | tls.TLSSocket; buf: string }

function once(conn: Conn, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error('SMTP timeout')) }, timeout)
    const onData = (d: Buffer) => {
      conn.buf += d.toString('utf8')
      // یک پاسخ کامل وقتی خطی به شکل «۲۵۰ متن» (با فاصله بعد کد) داشته باشیم
      const lines = conn.buf.split(/\r?\n/).filter(Boolean)
      const last = lines[lines.length - 1]
      if (last && /^\d{3} /.test(last)) { cleanup(); const out = conn.buf; conn.buf = ''; resolve(out) }
    }
    const onErr = (e: Error) => { cleanup(); reject(e) }
    function cleanup() { clearTimeout(t); conn.sock.removeListener('data', onData); conn.sock.removeListener('error', onErr) }
    conn.sock.on('data', onData); conn.sock.on('error', onErr)
  })
}

async function cmd(conn: Conn, line: string, expect: number, timeout = 15000): Promise<string> {
  conn.sock.write(line + '\r\n')
  const res = await once(conn, timeout)
  const code = parseInt(res.trim().slice(0, 3), 10)
  if (code !== expect && !(expect === 250 && code === 251)) {
    throw new Error(`SMTP ${code}: ${res.trim().slice(0, 160)}`)
  }
  return res
}

function b64(s: string) { return Buffer.from(s, 'utf8').toString('base64') }

function buildMessage(cfg: SmtpConfig, to: string, subject: string, html: string): string {
  const date = new Date().toUTCString()
  const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
  return [
    `From: ${enc('ملک‌جت')} <${cfg.from}>`,
    `To: ${to}`,
    `Subject: ${enc(subject)}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n')
}

// یک ایمیل به چند گیرنده ارسال می‌کند. در صورت خطا throw می‌کند.
export async function sendMail(cfg: SmtpConfig, recipients: string[], subject: string, html: string): Promise<number> {
  const implicitTls = cfg.port === 465
  let sock: net.Socket | tls.TLSSocket = implicitTls
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    : net.connect({ host: cfg.host, port: cfg.port })
  const conn: Conn = { sock, buf: '' }

  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('اتصال به سرور ایمیل برقرار نشد')), 15000)
    sock.once(implicitTls ? 'secureConnect' : 'connect', () => { clearTimeout(t); res() })
    sock.once('error', (e) => { clearTimeout(t); rej(e) })
  })

  await once(conn, 15000) // greeting 220
  await cmd(conn, `EHLO melkjet.com`, 250)

  // STARTTLS برای پورت‌های غیر-۴۶۵
  if (!implicitTls) {
    await cmd(conn, 'STARTTLS', 220)
    const upgraded: tls.TLSSocket = await new Promise((res, rej) => {
      const s = tls.connect({ socket: sock, servername: cfg.host }, () => res(s))
      s.once('error', rej)
    })
    conn.sock = upgraded; sock = upgraded
    await cmd(conn, `EHLO melkjet.com`, 250)
  }

  // احراز هویت
  await cmd(conn, 'AUTH LOGIN', 334)
  await cmd(conn, b64(cfg.user), 334)
  await cmd(conn, b64(cfg.pass), 235)

  let sent = 0
  for (const to of recipients) {
    try {
      await cmd(conn, `MAIL FROM:<${cfg.from}>`, 250)
      await cmd(conn, `RCPT TO:<${to}>`, 250)
      await cmd(conn, 'DATA', 354)
      const msg = buildMessage(cfg, to, subject, html).replace(/\n\./g, '\n..')
      conn.sock.write(msg + '\r\n.\r\n')
      await once(conn, 20000)
      sent++
    } catch { /* این گیرنده ناموفق؛ ادامه بده */ }
  }
  try { await cmd(conn, 'QUIT', 221, 5000) } catch {}
  conn.sock.end()
  return sent
}
