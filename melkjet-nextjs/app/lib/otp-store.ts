// In-memory OTP store with 5-minute TTL
// For production, replace with Redis or database

interface OTPEntry {
  code: string
  expires: number
  attempts: number
}

const store = new Map<string, OTPEntry>()

export function setOTP(phone: string, code: string) {
  store.set(phone, {
    code,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    attempts: 0,
  })
}

export function verifyOTP(phone: string, code: string): 'valid' | 'invalid' | 'expired' | 'too_many' {
  const entry = store.get(phone)
  if (!entry) return 'invalid'
  if (Date.now() > entry.expires) {
    store.delete(phone)
    return 'expired'
  }
  if (entry.attempts >= 5) return 'too_many'
  if (entry.code !== code) {
    entry.attempts++
    return 'invalid'
  }
  store.delete(phone)
  return 'valid'
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
