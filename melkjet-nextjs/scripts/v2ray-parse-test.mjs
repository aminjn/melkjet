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

console.log(`\n${fail === 0 ? '✅' : '❌'} v2ray-parse-test: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
