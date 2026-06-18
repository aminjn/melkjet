import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'node:os'

// آمار واقعی سیستم: پراسس، حافظه، و وضعیت فایل‌های دادهٔ پروژه.
async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

function countRecords(file: string): number {
  try {
    const j = JSON.parse(readFileSync(file, 'utf-8'))
    if (Array.isArray(j)) return j.length
    if (j && Array.isArray(j.items)) return j.items.length
    if (j && typeof j === 'object') {
      // مجموع طول آرایه‌های داخلی، وگرنه تعداد کلیدها
      let sum = 0, hadArray = false
      for (const k of Object.keys(j)) { if (Array.isArray(j[k])) { sum += j[k].length; hadArray = true } }
      return hadArray ? sum : Object.keys(j).length
    }
  } catch {}
  return 0
}

const STORE_LABELS: Record<string, string> = {
  '.scraper-data.json': 'آگهی‌ها و محتوا', '.market-data.json': 'دادهٔ بازار', '.enrich-data.json': 'کش تحلیل',
  '.crm-data.json': 'وظایف CRM', '.leads-data.json': 'لیدها', '.pros-data.json': 'مشتریان مشاوران',
  '.user-data.json': 'ترجیحات کاربران', '.sites-data.json': 'سایت‌های ساخته‌شده', '.workflow-data.json': 'اتوماسیون‌ها',
  '.promo-data.json': 'کدهای تخفیف', '.banner-data.json': 'بنرها', '.plan-data.json': 'پلن‌ها',
  '.category-data.json': 'دسته‌بندی‌ها', '.geo-data.json': 'جغرافیا', '.divar-places.json': 'مناطق دیوار',
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const cwd = process.cwd()
  const mem = process.memoryUsage()
  const stores: { name: string; label: string; records: number; sizeKB: number; updated: number }[] = []
  try {
    for (const f of readdirSync(cwd)) {
      if (!f.endsWith('.json') || !f.startsWith('.')) continue
      const full = join(cwd, f)
      try {
        const st = statSync(full)
        stores.push({ name: f, label: STORE_LABELS[f] || f, records: countRecords(full), sizeKB: Math.round(st.size / 1024 * 10) / 10, updated: st.mtimeMs })
      } catch {}
    }
  } catch {}
  stores.sort((a, b) => b.records - a.records)

  return NextResponse.json({
    process: {
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      platform: `${os.type()} ${os.arch()}`,
      pid: process.pid,
      rssMB: Math.round(mem.rss / 1048576),
      heapUsedMB: Math.round(mem.heapUsed / 1048576),
      heapTotalMB: Math.round(mem.heapTotal / 1048576),
      cpus: os.cpus().length,
      loadAvg: os.loadavg().map(n => Math.round(n * 100) / 100),
      totalMemMB: Math.round(os.totalmem() / 1048576),
      freeMemMB: Math.round(os.freemem() / 1048576),
    },
    stores,
    totalRecords: stores.reduce((a, s) => a + s.records, 0),
    now: Date.now(),
  })
}
