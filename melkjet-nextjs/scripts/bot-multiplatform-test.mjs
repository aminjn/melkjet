// تستِ هستهٔ چندسکویی: ساختِ ctx + جداسازیِ namespace بین تلگرام و بله (بدونِ توکن/شبکه).
process.env.BALE_BOT_TOKEN = 'TESTBALE:TOKEN'
process.env.TELEGRAM_BOT_TOKEN = 'TESTTG:TOKEN'
import { tgBotCtx, baleBotCtx, botALS } from '../app/lib/bot-ctx.ts'
import * as store from '../app/lib/telegram-store.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m) } }

ok(tgBotCtx().apiBase === 'https://api.telegram.org/botTESTTG:TOKEN', 'tg apiBase: ' + tgBotCtx().apiBase)
ok(baleBotCtx().apiBase === 'https://tapi.bale.ai/botTESTBALE:TOKEN', 'bale apiBase: ' + baleBotCtx().apiBase)
ok(baleBotCtx().fileBase === 'https://tapi.bale.ai/file/botTESTBALE:TOKEN', 'bale fileBase')
ok(baleBotCtx().proxy === '', 'bale direct (no proxy)')
ok(!!tgBotCtx().proxy, 'tg uses a proxy')
ok(tgBotCtx().platform === 'tg' && baleBotCtx().platform === 'bale', 'platform tags')

const CID = 777001
// همان chatId روی هر دو سکو نباید قاطی شود
await botALS.run(tgBotCtx(), async () => { await store.setDraft(CID, { step: 'deal', deal: 'TG' }) })
await botALS.run(baleBotCtx(), async () => { await store.setDraft(CID, { step: 'deal', deal: 'BALE' }) })
const tgD = await botALS.run(tgBotCtx(), () => store.getDraft(CID))
const baleD = await botALS.run(baleBotCtx(), () => store.getDraft(CID))
ok(tgD?.deal === 'TG', 'tg draft isolated: ' + JSON.stringify(tgD))
ok(baleD?.deal === 'BALE', 'bale draft isolated: ' + JSON.stringify(baleD))

// آلارم‌ها هم باید per-platform باشند
await botALS.run(baleBotCtx(), () => store.addSub({ chatId: CID, deal: 'فروش', city: 'تهران', region: '', hood: '' }))
const tgSubs = await botALS.run(tgBotCtx(), () => store.listSubs(CID))
const baleSubs = await botALS.run(baleBotCtx(), () => store.listSubs(CID))
ok(baleSubs.length === 1 && baleSubs[0].platform === 'bale', 'bale sub listed under bale')
ok(tgSubs.length === 0, 'bale sub NOT visible under tg (no collision)')

// default (بدونِ ctx) = تلگرام، کلیدِ بدونِ پیشوند (سازگاریِ عقب‌رو)
await store.setDraft(CID, { step: 'deal', deal: 'DEFAULT' })
const defD = await store.getDraft(CID)
ok(defD?.deal === 'DEFAULT' && tgD?.deal === 'TG', 'default ctx == tg namespace')

// پاک‌سازی
await botALS.run(tgBotCtx(), () => store.clearDraft(CID))
await botALS.run(baleBotCtx(), async () => { await store.clearDraft(CID); for (const s of await store.listSubs(CID)) await store.removeSub(CID, s.id) })

console.log(`\n${fail === 0 ? '✅' : '❌'} bot-multiplatform-test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
