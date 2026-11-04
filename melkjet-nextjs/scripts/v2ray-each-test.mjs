// فاز ۳۴۷ — تستِ «تستِ تک‌تکِ سرورها» با Xrayِ قلابی (بدونِ شبکه): اجرای موقت، تشخیصِ شروع،
// نسبت‌دادنِ خطای لاگ به سرورِ درست، و گزارشِ خطای کانفیگ.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v2each-'))
process.chdir(tmp)
const fake = path.join(here, 'v2ray-fake-xray.mjs')
const links = [
  'vless://11111111-1111-1111-1111-111111111111@a.example.com:443?security=tls&type=ws&path=%2Fa#A',
  'trojan://pw@b.example.com:443?security=tls#B',
]
fs.writeFileSync(path.join(tmp, '.admin-data.json'), JSON.stringify({ v2ray: { enabled: false, link: links.join('\n'), binPath: fake } }))
const { testEachV2ray } = await import('../app/lib/v2ray.ts')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }

const r = await testEachV2ray()
ok(r.ok === true, 'test-each ran: ' + (r.error || ''))
ok(r.xrayVersion === '26.1.1', 'xray version detected')
ok(r.results?.length === 2 && r.results.every(x => !x.ok), 'two failing servers')
ok(r.results?.[0].name === 'A' && r.results?.[1].name === 'B', 'names kept')
ok(r.results?.every(x => /timeout/.test(x.error || '') && /i\/o timeout/.test(x.detail || '')), 'log error attributed per server: ' + JSON.stringify(r.results?.map(x => x.error)))

process.env.FAKE_XRAY_BAD = '1'
const bad = await testEachV2ray()
ok(bad.ok === false && /xray-config/.test(bad.error || '') && /unknown transport/.test(bad.error || ''), 'config error surfaced: ' + bad.error)

console.log(`\n${fail === 0 ? '✅' : '❌'} v2ray-each-test: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
