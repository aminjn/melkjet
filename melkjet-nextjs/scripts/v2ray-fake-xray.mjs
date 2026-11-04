#!/usr/bin/env node
// Xrayِ قلابی برای تستِ testEachV2ray: کانفیگ را می‌خواند، روی هر inbound یک پراکسیِ HTTP باز می‌کند،
// CONNECT را 200 می‌دهد و بعد قطع می‌کند (مثلِ وقتی outbound وصل نمی‌شود) و لاگِ سبکِ Xray می‌نویسد.
import fs from 'node:fs'
import net from 'node:net'
const cfgPath = process.argv[process.argv.indexOf('-c') + 1]
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
if (process.env.FAKE_XRAY_BAD) { console.log('Failed to start: main: failed to load config files > infra/conf: unknown transport protocol: foo'); process.exit(23) }
let sid = 1000
for (const ib of cfg.inbounds) {
  const rule = cfg.routing.rules.find(r => r.inboundTag.includes(ib.tag))
  net.createServer(sock => {
    sock.once('data', () => {
      const id = ++sid
      console.log(`2026/11/04 10:00:00.000000 [Info] [${id}] app/dispatcher: taking detour [${rule.outboundTag}] for [tcp:www.gstatic.com:443]`)
      console.log(`2026/11/04 10:00:00.100000 [Info] [${id}] app/proxyman/outbound: failed to process outbound traffic > common/retry: [dial tcp 1.2.3.4:443: i/o timeout] > common/retry: all retry attempts failed`)
      sock.write('HTTP/1.1 200 Connection established\r\n\r\n'); setTimeout(() => sock.destroy(), 20)
    })
  }).listen(ib.port, '127.0.0.1')
}
console.log('2026/11/04 10:00:00.000000 [Warning] core: Xray 26.1.1 started')
