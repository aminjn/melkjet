// تستِ پارسِ لینک‌های v2ray + ساختِ کانفیگِ Xray (بدونِ نیاز به باینری/شبکه).
import { buildOutbounds, buildXrayConfig } from '../app/lib/v2ray.ts'

const vmessObj = { v: '2', ps: 'vm', add: '1.2.3.4', port: '443', id: '11111111-1111-1111-1111-111111111111', aid: '0', net: 'ws', type: 'none', host: 'h.example.com', path: '/vm', tls: 'tls', sni: 'h.example.com' }
const vmess = 'vmess://' + Buffer.from(JSON.stringify(vmessObj)).toString('base64')
const vless = 'vless://22222222-2222-2222-2222-222222222222@5.6.7.8:443?encryption=none&security=tls&type=ws&path=%2Fvl&host=v.example.com&sni=v.example.com&fp=chrome#vl-name'
const trojan = 'trojan://mypass@9.10.11.12:443?security=tls&type=grpc&serviceName=gsvc&sni=t.example.com#tr-name'
const ss = 'ss://' + Buffer.from('aes-256-gcm:sspass').toString('base64') + '@13.14.15.16:8388#ss-name'
const reality = 'vless://33333333-3333-3333-3333-333333333333@17.18.19.20:443?encryption=none&security=reality&type=tcp&pbk=PUBKEY&sid=ab12&sni=r.example.com&fp=chrome&flow=xtls-rprx-vision#reality'

const text = [vmess, vless, trojan, ss, reality, 'garbage://nope', ''].join('\n')
const outs = await buildOutbounds(text)

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++ } else { fail++; console.log('✗', m) } }
ok(outs.length === 5, `expected 5 outbounds, got ${outs.length}`)
const protos = outs.map(o => o.protocol)
ok(protos.filter(p => p === 'vmess').length === 1, 'one vmess')
ok(protos.filter(p => p === 'vless').length === 2, 'two vless (ws-tls + reality)')
ok(protos.filter(p => p === 'trojan').length === 1, 'one trojan')
ok(protos.filter(p => p === 'shadowsocks').length === 1, 'one shadowsocks')
ok(outs.every((o, i) => o.tag === `proxy-${i}`), 'sequential proxy-N tags')

const vm = outs.find(o => o.protocol === 'vmess')
ok(vm.settings.vnext[0].address === '1.2.3.4' && vm.settings.vnext[0].port === 443, 'vmess addr/port')
ok(vm.settings.vnext[0].users[0].id === vmessObj.id, 'vmess id')
ok(vm.streamSettings.network === 'ws' && vm.streamSettings.security === 'tls', 'vmess ws+tls')
ok(vm.streamSettings.wsSettings.path === '/vm' && vm.streamSettings.wsSettings.headers.Host === 'h.example.com', 'vmess ws path/host')

const vl = outs.find(o => o.protocol === 'vless' && o.streamSettings.security === 'tls')
ok(vl && vl.settings.vnext[0].users[0].id === '22222222-2222-2222-2222-222222222222', 'vless id')
ok(vl && vl.streamSettings.wsSettings.path === '/vl', 'vless ws path (decoded)')
ok(vl && vl.streamSettings.tlsSettings.serverName === 'v.example.com', 'vless sni')

const re = outs.find(o => o.streamSettings?.security === 'reality')
ok(re && re.streamSettings.realitySettings.publicKey === 'PUBKEY' && re.streamSettings.realitySettings.shortId === 'ab12', 'reality pbk/sid')
ok(re && re.settings.vnext[0].users[0].flow === 'xtls-rprx-vision', 'reality flow')

const tr = outs.find(o => o.protocol === 'trojan')
ok(tr.settings.servers[0].password === 'mypass' && tr.settings.servers[0].port === 443, 'trojan pass/port')
ok(tr.streamSettings.network === 'grpc' && tr.streamSettings.grpcSettings.serviceName === 'gsvc', 'trojan grpc svc')

const sh = outs.find(o => o.protocol === 'shadowsocks')
ok(sh.settings.servers[0].method === 'aes-256-gcm' && sh.settings.servers[0].password === 'sspass', 'ss method/pass')
ok(sh.settings.servers[0].address === '13.14.15.16' && sh.settings.servers[0].port === 8388, 'ss addr/port')

const conf = buildXrayConfig(outs, 10809, 10808)
ok(conf.inbounds.some(i => i.protocol === 'http' && i.port === 10809 && i.listen === '127.0.0.1'), 'http inbound')
ok(conf.inbounds.some(i => i.protocol === 'socks' && i.port === 10808), 'socks inbound')
ok(conf.observatory.subjectSelector[0] === 'proxy', 'observatory selects proxy tags')
ok(conf.routing.balancers[0].strategy.type === 'leastPing', 'balancer leastPing')
ok(conf.routing.rules[0].balancerTag === 'bal', 'routing → balancer')
ok(conf.outbounds.some(o => o.protocol === 'freedom') && conf.outbounds.some(o => o.protocol === 'blackhole'), 'direct+block outbounds')
ok(JSON.stringify(conf).length > 100, 'config serializes')

// ── فاز ۳۴۷: ترنسپورت‌های جدید ──
const more = [
  'vless://44444444-4444-4444-4444-444444444444@hu.example.com:443?security=tls&type=httpupgrade&path=%2Fhu%3Fed%3D2048&host=cdn.example.com&sni=cdn.example.com&allowInsecure=1#HU',
  'vless://55555555-5555-5555-5555-555555555555@xh.example.com:443?security=reality&type=xhttp&path=%2Fxh&mode=packet-up&pbk=PK2&sid=cd&spx=%2Fspx&sni=www.apple.com#XH',
  'vless://66666666-6666-6666-6666-666666666666@[2001:db8::1]:8443?security=tls&type=grpc&serviceName=g2&mode=multi&sni=g.example.com#V6',
  'trojan://p%40ss@sh.example.com:2083?type=splithttp&path=%2Fsp&host=sh.example.com#SPLIT',
  'vmess://' + Buffer.from(JSON.stringify({ v: '2', ps: 'gvm', add: '7.7.7.7', port: '443', id: '77777777-7777-7777-7777-777777777777', net: 'grpc', type: 'multi', path: 'vsvc', tls: 'tls', sni: 'gv.example.com', allowInsecure: true })).toString('base64'),
  'ss://chacha20-ietf-poly1305:plainpass@8.8.4.4:8389#plain',
  'VLESS://88888888-8888-8888-8888-888888888888@up.example.com:80?type=ws&path=%2Fw&host=w.example.com#UP',
]
const { buildOutboundsMeta } = await import('../app/lib/v2ray.ts')
const m2 = await buildOutboundsMeta(more.join('\n'))
ok(m2.outbounds.length === more.length, `phase347: all ${more.length} parsed, got ${m2.outbounds.length}`)
const [hu, xh, v6, sp, gvm, ssp, up] = m2.outbounds
ok(hu.streamSettings.network === 'httpupgrade' && hu.streamSettings.httpupgradeSettings.path === '/hu?ed=2048' && hu.streamSettings.httpupgradeSettings.host === 'cdn.example.com', 'httpupgrade path/host')
ok(hu.streamSettings.tlsSettings.allowInsecure === true, 'allowInsecure honored')
ok(xh.streamSettings.network === 'xhttp' && xh.streamSettings.xhttpSettings.mode === 'packet-up' && xh.streamSettings.xhttpSettings.path === '/xh', 'xhttp mode/path')
ok(xh.streamSettings.realitySettings.spiderX === '/spx' && xh.streamSettings.realitySettings.publicKey === 'PK2', 'reality spx')
ok(v6.settings.vnext[0].address === '2001:db8::1' && v6.settings.vnext[0].port === 8443, 'ipv6 bracket host')
ok(v6.streamSettings.grpcSettings.multiMode === true && v6.streamSettings.grpcSettings.serviceName === 'g2', 'grpc multiMode')
ok(sp.streamSettings.network === 'xhttp' && sp.settings.servers[0].password === 'p@ss', 'splithttp→xhttp + decoded trojan pass')
ok(gvm.streamSettings.grpcSettings.multiMode === true && gvm.streamSettings.grpcSettings.serviceName === 'vsvc' && gvm.streamSettings.tlsSettings.allowInsecure === true, 'vmess grpc multi + insecure')
ok(!gvm.streamSettings.tcpSettings, 'vmess grpc type not treated as tcp header')
ok(ssp.settings.servers[0].method === 'chacha20-ietf-poly1305' && ssp.settings.servers[0].password === 'plainpass', 'plain ss creds')
ok(up.protocol === 'vless' && up.streamSettings.wsSettings.host === 'w.example.com', 'uppercase scheme + ws host')
ok(m2.meta[0].name === 'HU' && m2.meta[2].address === '2001:db8::1', 'meta names/addresses')
ok(m2.outbounds.every(o => !('_name' in o)), 'no _name leaks into Xray config')
const tlsDefault = outs.find(o => o.protocol === 'vless' && o.streamSettings.security === 'tls')
ok(!('allowInsecure' in tlsDefault.streamSettings.tlsSettings), 'allowInsecure omitted by default')
const conf2 = buildXrayConfig(m2.outbounds, 10809, 10808)
ok(conf2.routing.balancers[0].fallbackTag === 'proxy-0', 'balancer fallbackTag')
ok(conf2.observatory.enableConcurrency === true, 'observatory concurrent probing')
// JSONِ Xray به‌عنوانِ ورودی
const jsonSub = JSON.stringify([{ remarks: 'J1', outbounds: [{ tag: 'proxy', protocol: 'vless', settings: { vnext: [{ address: '9.9.9.9', port: 443, users: [{ id: 'x' }] }] }, streamSettings: { network: 'tcp' } }, { tag: 'direct', protocol: 'freedom' }] }])
const m3 = await buildOutboundsMeta(jsonSub)
ok(m3.outbounds.length === 1 && m3.outbounds[0].tag === 'proxy-0' && m3.meta[0].name === 'J1', 'xray-json subscription format')
const { explainXrayError } = await import('../app/lib/v2ray.ts')
ok(/timeout/.test(explainXrayError('dial tcp 1.2.3.4:443: i/o timeout')), 'explain timeout')
ok(/قطع/.test(explainXrayError('Client network socket disconnected before secure TLS connection was established')), 'explain disconnect')

console.log(`\n${fail === 0 ? '✅' : '❌'} v2ray-parse-test: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
