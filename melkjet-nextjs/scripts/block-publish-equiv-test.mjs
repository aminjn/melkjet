#!/usr/bin/env node
// SCALE-2M مرحلهٔ B3 — هم‌ارزیِ publishUserListingsBatch (مسیرِ کاملِ load() در برابرِ بلوکی).
// چون فلگ ماژول‌سطح است، این اسکریپت یک‌بار با SCALE_BLOCK_DEDUP خاموش و یک‌بار روشن روی DBِ
// تمیز اجرا می‌شود و خطِ RESULT:<json> را چاپ می‌کند؛ هم‌ارزی را bench (block-publish-equiv) diff می‌کند.
import { readFileSync, existsSync } from 'node:fs'
function loadEnv(f){ if(!existsSync(f))return; for(const l of readFileSync(f,'utf-8').split('\n')){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(process.env[m[1]]===undefined)process.env[m[1]]=v} }
loadEnv('.env.production.local'); loadEnv('.env')
const { pgEnabled, pgTx } = await import('../app/lib/db.ts')
if(!pgEnabled()){ console.error('DATABASE_URL لازم است.'); process.exit(1) }
const { _insertFull, publishUserListingsBatch, addUserListing } = await import('../app/lib/scraper-store.ts')

await pgTx(c=>c.query('TRUNCATE listings')); await pgTx(c=>c.query('DELETE FROM kv'))
const src = { id:'pubseed', name:'seed', url:'http://t', type:'listing', method:'divar', enabled:true, schedule:'manual', lastRun:null, lastCount:0, status:'idle' }
// seedِ موجود: دو آگهیِ متمایز.
await _insertFull(src, [
  { title:'آپارتمان ۱۲۰ متری ونک', price:'10000000000', location:'تهران، ونک', url:'seed/u1' },
  { title:'ویلا ۳۰۰ متری نیاوران', price:'50000000000', location:'تهران، نیاوران', url:'seed/u2' },
], [])

// publishِ دسته‌ای: (۱) هم‌ملکِ seed[0] (باید twin شود، created:false)، (۲) آگهیِ کاملاً نو (created:true).
const reqs = [
  { raw: { title:'آپارتمان ۱۲۰ متر ونک فول', price:'10000000000', location:'تهران، ونک' } },
  { raw: { title:'مغازه ۴۰ متری سعادت‌آباد', price:'20000000000', location:'تهران، سعادت‌آباد' } },
]
const pub = await publishUserListingsBatch(reqs)
// addUserListing تکی: هم‌ملکِ همان مغازه (باید duplicate شود).
const addDup = await addUserListing({ title:'مغازه ۴۰ متر سعادت آباد تجاری', price:'20000000000', location:'تهران، سعادت‌آباد' })

const rows = (await pgTx(c=>c.query(`SELECT data->>'title' t, status, data->>'price' p, data->>'location' loc FROM listings ORDER BY data->>'title', status`))).rows
const result = {
  pubCreated: pub.map(x=>x.created),
  addDupStatus: addDup.status,
  rows,
}
console.log('RESULT:' + JSON.stringify(result))
process.exit(0)
