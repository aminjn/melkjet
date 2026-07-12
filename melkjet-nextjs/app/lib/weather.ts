import { shecanRequest } from './shecan-https'

// فاز ۱۰۴ — هوای واقعیِ شهر (Open-Meteo، بدونِ کلید). صادقانه: اگر سرویس در دسترس
// نبود هیچ هوایی نمایش داده نمی‌شود (نه عددِ ساختگی). کشِ ۳۰ دقیقه‌ای در حافظه.
// مختصاتِ مراکزِ استان‌ها دادهٔ جغرافیاییِ واقعی و ثابت است.
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'تهران': { lat: 35.6892, lng: 51.389 }, 'مشهد': { lat: 36.297, lng: 59.6062 }, 'اصفهان': { lat: 32.6539, lng: 51.666 },
  'کرج': { lat: 35.8327, lng: 50.9916 }, 'شیراز': { lat: 29.5918, lng: 52.5837 }, 'تبریز': { lat: 38.0667, lng: 46.2993 },
  'قم': { lat: 34.6416, lng: 50.8746 }, 'اهواز': { lat: 31.3183, lng: 48.6706 }, 'رشت': { lat: 37.2808, lng: 49.5832 },
  'ساری': { lat: 36.5633, lng: 53.0601 }, 'آمل': { lat: 36.4696, lng: 52.3507 }, 'یزد': { lat: 31.8974, lng: 54.3569 },
  'کرمان': { lat: 30.2839, lng: 57.0834 }, 'ارومیه': { lat: 37.5527, lng: 45.0759 }, 'همدان': { lat: 34.7992, lng: 48.5146 },
}
// نگاشتِ weathercodeهای WMO به فارسی/ایموجی — استاندارد Open-Meteo
const WMO: Array<[number[], string, string]> = [
  [[0], '☀️', 'صاف'], [[1, 2], '🌤', 'کمی ابری'], [[3], '☁️', 'ابری'],
  [[45, 48], '🌫', 'مه'], [[51, 53, 55, 61, 63, 65, 80, 81, 82], '🌧', 'بارانی'],
  [[71, 73, 75, 77, 85, 86], '❄️', 'برفی'], [[95, 96, 99], '⛈', 'طوفانی'],
]

export interface CityWeather { city: string; tempC: number; icon: string; label: string; at: number }
const cache = new Map<string, CityWeather | null>()
let cacheAt = 0

export async function weatherOf(city: string): Promise<CityWeather | null> {
  const c = CITY_COORDS[String(city || '').trim()] || CITY_COORDS['تهران']
  const key = String(city || 'تهران')
  const now = Date.now()
  if (now - cacheAt < 30 * 60 * 1000 && cache.has(key)) return cache.get(key)!
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,weather_code`
    const r = await shecanRequest(url, { method: 'GET', headers: { accept: 'application/json' }, timeout: 6000 })
    if (r.status !== 200) throw new Error('http ' + r.status)
    const d = JSON.parse(r.body)
    const code = Number(d?.current?.weather_code)
    const temp = Number(d?.current?.temperature_2m)
    if (!Number.isFinite(temp)) throw new Error('no temp')
    const w = WMO.find(x => x[0].includes(code)) || WMO[0]
    const out: CityWeather = { city: key, tempC: Math.round(temp), icon: w[1], label: w[2], at: now }
    cache.set(key, out); cacheAt = now
    return out
  } catch {
    cache.set(key, null); cacheAt = now   // در دسترس نیست → هیچ (صادقانه)؛ نیم‌ساعتِ بعد دوباره تلاش
    return null
  }
}
