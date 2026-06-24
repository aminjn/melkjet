import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHmac } from 'crypto'

const DATA_FILE = join(process.cwd(), '.admin-data.json')

function salt() {
  return process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod'
}

export function hashPassword(password: string): string {
  return createHmac('sha256', salt()).update(password).digest('hex')
}

export interface AdminData {
  email: string
  passwordHash: string
  ippanel?: {
    apiKey: string
    sender: string
    pattern: string
    patternVar?: string   // نام متغیر کد در پترن IPPanel (پیش‌فرض: code)
  }
  smtp?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
  }
  neshan?: {
    serviceKey: string   // Neshan web-service key (search / reverse / distance-matrix) — «service.…»
    mapKey?: string      // Neshan map key (static map / map display) — «web.…»
  }
  divar?: {
    proxyUrl?: string    // HTTP proxy used to reach api.divar.ir from the server
  }
  gapgpt?: {
    baseUrl: string      // e.g. https://api.gapgpt.app/v1
    apiKey: string
  }
  arvan?: {              // پاس‌انبان آروان (S3) — (برای بینایی گپ جواب نداد؛ نگه‌داری شده)
    endpoint: string
    bucket: string
    accessKey: string
    secretKey: string
    region?: string
  }
  imgbb?: {              // imgbb — میزبانی عکس روی i.ibb.co که سرورِ گپ می‌تواند فِچ کند
    apiKey: string
  }
  zarinpal?: {           // درگاه پرداخت زرین‌پال (داخلی)
    merchantId: string
    sandbox?: boolean
  }
  negotiation?: {        // موتور مذاکره — قواعدِ تولیدِ پیام + پترنِ ارسالِ سریعِ پیامک
    rules?: string       // قواعدی که هوش مصنوعی بر اساسِ آن‌ها پیامِ مذاکره را تولید می‌کند
    pattern?: string     // کدِ پترنِ IPPanel برای ارسالِ سریعِ پیامک (اختیاری)
    patternVar?: string  // نامِ متغیرِ پترن (پیش‌فرض: message)
  }
  agentModels?: Record<string, { text?: string; image?: string }>  // per-agent model assignment
}

export function getAdminData(): AdminData {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return {
    email: process.env.ADMIN_EMAIL || 'naeiniamini@gmail.com',
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123456'),
  }
}

export function saveAdminData(data: AdminData) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}
