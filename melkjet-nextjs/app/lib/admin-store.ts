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
  }
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
