import { statSync } from 'fs'
import { readJsonCached, writeJsonCached } from './json-file'
import { join } from 'path'
import { randomBytes } from 'crypto'

const DATA_FILE = join(process.cwd(), '.geo-data.json')

export interface District { id: string; name: string; neighborhoods: string[] }
export interface City { id: string; name: string; districts: District[] }
export interface Province { id: string; name: string; cities: City[] }
interface GeoDB { provinces: Province[] }

function id() { return randomBytes(5).toString('hex') }

// ── Seed: استان‌ها، شهرها، مناطق و محله‌های اصلی (قابل ویرایش از سوپرادمین) ──
type SeedDistrict = { name: string; neighborhoods: string[] }
type SeedCity = { name: string; districts: SeedDistrict[] }
function d(name: string, neighborhoods: string[]): SeedDistrict { return { name, neighborhoods } }
function c(name: string, districts: SeedDistrict[]): SeedCity { return { name, districts } }

const TEHRAN_CITY = c('تهران', [
  d('منطقه ۱', ['تجریش', 'نیاوران', 'فرمانیه', 'قیطریه', 'اقدسیه', 'کامرانیه', 'دربند', 'ولنجک', 'اوین', 'زعفرانیه', 'الهیه', 'دزاشیب', 'محمودیه', 'گلابدره', 'دارآباد']),
  d('منطقه ۲', ['سعادت‌آباد', 'شهرک غرب', 'فرحزاد', 'مرزداران', 'گیشا (کوی نصر)', 'پونک شمالی', 'شهرک قدس', 'طرشت', 'صادقیه', 'دریا', 'ایوانک']),
  d('منطقه ۳', ['ونک', 'جردن (آفریقا)', 'داوودیه', 'دروس', 'قلهک', 'زرگنده', 'امانیه', 'میرداماد', 'پاسداران', 'ظفر', 'گاندی', 'اختیاریه', 'دولت']),
  d('منطقه ۴', ['تهرانپارس', 'نارمک', 'مجیدیه', 'رسالت', 'حکیمیه', 'شمیران‌نو', 'قنات‌کوثر', 'اوقاف', 'علم و صنعت', 'هروی', 'پاسداران شمالی']),
  d('منطقه ۵', ['پونک', 'جنت‌آباد', 'آیت‌الله کاشانی', 'اکباتان', 'فردوس', 'شهران', 'اندیشه', 'باغ فیض', 'سازمان برنامه', 'بلوار فردوس']),
  d('منطقه ۶', ['امیرآباد', 'یوسف‌آباد', 'فاطمی', 'گاندی', 'ولیعصر', 'کارگر', 'انقلاب', 'بهجت‌آباد', 'ساعی', 'آرژانتین', 'کشاورز']),
  d('منطقه ۷', ['عباس‌آباد', 'سهروردی', 'شریعتی', 'بهشتی', 'مطهری', 'نیلوفر', 'خواجه نظام', 'دبستان', 'حشمتیه', 'قصر']),
  d('منطقه ۸', ['نارمک جنوبی', 'تهرانپارس غربی', 'مجیدیه شمالی', 'وحیدیه', 'دردشت', 'فدک']),
  d('منطقه ۹', ['مهرآباد', 'فتح', 'استاد معین', 'شمشیری', 'دکتر هوشیار', 'سرآسیاب']),
  d('منطقه ۱۰', ['سلسبیل', 'هاشمی', 'کارون', 'بریانک', 'زنجان', 'هفت چنار']),
  d('منطقه ۱۱', ['جمهوری', 'حر', 'فردوسی', 'مخبرالدوله', 'آذربایجان', 'اسکندری', 'منیریه', 'امیریه']),
  d('منطقه ۱۲', ['بازار', 'امام خمینی', 'بهارستان', 'سعدی', 'مولوی', 'پامنار', 'سنگلج', 'دروازه شمیران']),
  d('منطقه ۱۳', ['تهران‌نو', 'نیروی هوایی', 'پیروزی', 'زینبیه', 'سرخه حصار', 'دهقان', 'صفا']),
  d('منطقه ۱۴', ['افسریه', 'مشیریه', 'آهنگ', 'شکوفه', 'خاوران', 'نبرد', 'پرستار']),
  d('منطقه ۱۵', ['مسعودیه', 'کیانشهر', 'ابوذر', 'شوش شرقی', 'مشیریه', 'والفجر', 'اتابک']),
  d('منطقه ۱۶', ['نازی‌آباد', 'خزانه', 'علی‌آباد', 'بعثت', 'یاخچی‌آباد', 'تختی']),
  d('منطقه ۱۷', ['ابوذر', 'امامزاده حسن', 'بلورسازی', 'فلاح', 'یافت‌آباد شرقی', 'گلچین']),
  d('منطقه ۱۸', ['یافت‌آباد', 'شادآباد', 'صاحب‌الزمان', 'خلیج فارس', 'تولید دارو', 'بهداشت']),
  d('منطقه ۱۹', ['نعمت‌آباد', 'عبدل‌آباد', 'دولت‌خواه', 'اسماعیل‌آباد', 'شهرک رضویه', 'خانی‌آباد نو']),
  d('منطقه ۲۰', ['شهرری', 'دولت‌آباد', 'جوادیه', 'حمزه‌آباد', 'استخر', 'علائین', 'صفائیه']),
  d('منطقه ۲۱', ['تهرانسر', 'شهرک دانشگاه', 'شهرک استقلال', 'وردآورد', 'شهرک فرهنگیان', 'شهرک پاسداران']),
  d('منطقه ۲۲', ['شهرک چیتگر', 'دهکده المپیک', 'شهرک گلستان', 'دریاچه چیتگر', 'شهرک راه‌آهن', 'آزادشهر', 'شهرک امید']),
])

function simpleCity(name: string, neighborhoods: string[]): SeedCity {
  return c(name, [d('مرکزی', neighborhoods)])
}

const SEED: { name: string; cities: SeedCity[] }[] = [
  { name: 'تهران', cities: [
    TEHRAN_CITY,
    simpleCity('کرج', ['عظیمیه', 'گوهردشت', 'مهرشهر', 'باغستان', 'جهانشهر', 'فردیس', 'گلشهر']),
    simpleCity('شهریار', ['اندیشه', 'باغستان', 'وحیدیه', 'فردوسیه']),
    simpleCity('اسلامشهر', ['قائمیه', 'واوان', 'چهاردانگه']),
    simpleCity('پردیس', ['فاز ۱', 'فاز ۳', 'فاز ۵', 'فاز ۱۱']),
    simpleCity('لواسان', ['لواسان بزرگ', 'لواسان کوچک', 'ایگل']),
    simpleCity('ورامین', ['مرکزی', 'قرچک', 'پیشوا']),
    simpleCity('دماوند', ['گیلاوند', 'آبسرد', 'رودهن']),
  ] },
  { name: 'البرز', cities: [
    simpleCity('کرج', ['عظیمیه', 'گوهردشت', 'مهرشهر', 'جهانشهر', 'باغستان', 'گلشهر', 'حصارک']),
    simpleCity('فردیس', ['فاز ۱', 'فاز ۲', 'فاز ۳', 'فاز ۴']),
    simpleCity('نظرآباد', ['مرکزی']),
    simpleCity('هشتگرد', ['شهر جدید هشتگرد', 'مرکزی']),
  ] },
  { name: 'اصفهان', cities: [
    simpleCity('اصفهان', ['مرداویج', 'سعادت‌آباد', 'ملک‌شهر', 'خیابان جی', 'چهارباغ', 'بهارستان', 'خانه اصفهان', 'کاوه']),
    simpleCity('کاشان', ['مرکزی', 'فین', 'ناجی‌آباد']),
    simpleCity('خمینی‌شهر', ['مرکزی']),
    simpleCity('نجف‌آباد', ['مرکزی']),
    simpleCity('شاهین‌شهر', ['مرکزی']),
  ] },
  { name: 'فارس', cities: [
    simpleCity('شیراز', ['معالی‌آباد', 'قصرالدشت', 'فرهنگ‌شهر', 'صدرا', 'قدوسی', 'زرگری', 'عفیف‌آباد', 'بلوار حافظ']),
    simpleCity('مرودشت', ['مرکزی']),
    simpleCity('کازرون', ['مرکزی']),
    simpleCity('جهرم', ['مرکزی']),
  ] },
  { name: 'خراسان رضوی', cities: [
    simpleCity('مشهد', ['احمدآباد', 'سجاد', 'وکیل‌آباد', 'هاشمیه', 'الهیه', 'قاسم‌آباد', 'بلوار فردوسی', 'طلاب', 'سیدی']),
    simpleCity('نیشابور', ['مرکزی']),
    simpleCity('سبزوار', ['مرکزی']),
    simpleCity('تربت حیدریه', ['مرکزی']),
  ] },
  { name: 'آذربایجان شرقی', cities: [
    simpleCity('تبریز', ['ولیعصر', 'ائل‌گلی', 'مارالان', 'باغمیشه', 'یاغچیان', 'منظریه', 'زعفرانیه']),
    simpleCity('مراغه', ['مرکزی']),
    simpleCity('مرند', ['مرکزی']),
  ] },
  { name: 'آذربایجان غربی', cities: [simpleCity('ارومیه', ['مرکزی', 'دانشکده', 'استادان']), simpleCity('خوی', ['مرکزی']), simpleCity('مهاباد', ['مرکزی'])] },
  { name: 'مازندران', cities: [
    simpleCity('ساری', ['مرکزی', 'میدان معلم', 'بلوار کشاورز']),
    simpleCity('بابل', ['مرکزی']), simpleCity('آمل', ['مرکزی']), simpleCity('قائم‌شهر', ['مرکزی']),
    simpleCity('نوشهر', ['مرکزی']), simpleCity('چالوس', ['مرکزی']), simpleCity('بابلسر', ['مرکزی']),
  ] },
  { name: 'گیلان', cities: [
    simpleCity('رشت', ['گلسار', 'مرکزی', 'بلوار انصاری', 'منظریه']),
    simpleCity('بندر انزلی', ['مرکزی']), simpleCity('لاهیجان', ['مرکزی']), simpleCity('لنگرود', ['مرکزی']),
  ] },
  { name: 'خوزستان', cities: [
    simpleCity('اهواز', ['کیانپارس', 'کیان‌آباد', 'گلستان', 'زیتون', 'پادادشهر', 'ملاشیه']),
    simpleCity('آبادان', ['مرکزی']), simpleCity('دزفول', ['مرکزی']), simpleCity('ماهشهر', ['مرکزی']),
  ] },
  { name: 'قم', cities: [simpleCity('قم', ['مرکزی', 'پردیسان', 'سالاریه', 'عمار یاسر', 'صفائیه'])] },
  { name: 'کرمان', cities: [simpleCity('کرمان', ['مرکزی', 'هزارویک', 'کوثر']), simpleCity('سیرجان', ['مرکزی']), simpleCity('رفسنجان', ['مرکزی']), simpleCity('بم', ['مرکزی'])] },
  { name: 'یزد', cities: [simpleCity('یزد', ['صفائیه', 'مرکزی', 'آزادشهر', 'مهرآوران']), simpleCity('میبد', ['مرکزی']), simpleCity('اردکان', ['مرکزی'])] },
  { name: 'هرمزگان', cities: [simpleCity('بندرعباس', ['مرکزی', 'گلشهر', 'بلوار امام']), simpleCity('قشم', ['مرکزی']), simpleCity('کیش', ['میدان سحل', 'مرکزی', 'صدف']), simpleCity('بندرلنگه', ['مرکزی'])] },
  { name: 'گلستان', cities: [simpleCity('گرگان', ['مرکزی', 'عدالت', 'گرگانپارس']), simpleCity('گنبد کاووس', ['مرکزی']), simpleCity('علی‌آباد کتول', ['مرکزی'])] },
  { name: 'کرمانشاه', cities: [simpleCity('کرمانشاه', ['مرکزی', 'الهیه', 'مسکن', 'دولت‌آباد']), simpleCity('اسلام‌آباد غرب', ['مرکزی'])] },
  { name: 'همدان', cities: [simpleCity('همدان', ['مرکزی', 'بلوار ارم', 'شهرک مدنی']), simpleCity('ملایر', ['مرکزی'])] },
  { name: 'اردبیل', cities: [simpleCity('اردبیل', ['مرکزی', 'شهرک کارشناسان']), simpleCity('پارس‌آباد', ['مرکزی'])] },
  { name: 'قزوین', cities: [simpleCity('قزوین', ['مرکزی', 'مینودر', 'شهرک مهرگان']), simpleCity('الوند', ['مرکزی'])] },
  { name: 'مرکزی', cities: [simpleCity('اراک', ['مرکزی', 'شهرک قدس']), simpleCity('ساوه', ['مرکزی'])] },
  { name: 'لرستان', cities: [simpleCity('خرم‌آباد', ['مرکزی', 'کیو']), simpleCity('بروجرد', ['مرکزی'])] },
  { name: 'سیستان و بلوچستان', cities: [simpleCity('زاهدان', ['مرکزی']), simpleCity('چابهار', ['مرکزی']), simpleCity('زابل', ['مرکزی'])] },
  { name: 'کردستان', cities: [simpleCity('سنندج', ['مرکزی', 'فرجه']), simpleCity('سقز', ['مرکزی'])] },
  { name: 'بوشهر', cities: [simpleCity('بوشهر', ['مرکزی', 'ریشهر']), simpleCity('برازجان', ['مرکزی'])] },
  { name: 'زنجان', cities: [simpleCity('زنجان', ['مرکزی', 'کوی فرهنگ'])] },
  { name: 'سمنان', cities: [simpleCity('سمنان', ['مرکزی']), simpleCity('شاهرود', ['مرکزی'])] },
  { name: 'خراسان شمالی', cities: [simpleCity('بجنورد', ['مرکزی'])] },
  { name: 'خراسان جنوبی', cities: [simpleCity('بیرجند', ['مرکزی'])] },
  { name: 'چهارمحال و بختیاری', cities: [simpleCity('شهرکرد', ['مرکزی'])] },
  { name: 'کهگیلویه و بویراحمد', cities: [simpleCity('یاسوج', ['مرکزی'])] },
  { name: 'ایلام', cities: [simpleCity('ایلام', ['مرکزی'])] },
]

function buildSeed(): GeoDB {
  return {
    provinces: SEED.map(p => ({
      id: id(), name: p.name,
      cities: p.cities.map(ct => ({
        id: id(), name: ct.name,
        districts: ct.districts.map(dt => ({ id: id(), name: dt.name, neighborhoods: dt.neighborhoods })),
      })),
    })),
  }
}

export function load(): GeoDB {
  return readJsonCached<GeoDB>(DATA_FILE, buildSeedCached())
}
let _seedCache: GeoDB | null = null
function buildSeedCached(): GeoDB { return _seedCache || (_seedCache = buildSeed()) }
export function save(db: GeoDB) { writeJsonCached(DATA_FILE, db) }

// Public-shaped read
export function getAll(): Province[] { return load().provinces }

// ── CRUD ──
function findProvince(db: GeoDB, pid: string) { return db.provinces.find(p => p.id === pid) }
function findCity(db: GeoDB, pid: string, cid: string) { return findProvince(db, pid)?.cities.find(c => c.id === cid) }
function findDistrict(db: GeoDB, pid: string, cid: string, did: string) { return findCity(db, pid, cid)?.districts.find(d => d.id === did) }

export function addProvince(name: string) { const db = load(); db.provinces.push({ id: id(), name, cities: [] }); save(db); return db.provinces }
export function addCity(pid: string, name: string) { const db = load(); findProvince(db, pid)?.cities.push({ id: id(), name, districts: [] }); save(db); return db.provinces }
export function addDistrict(pid: string, cid: string, name: string) { const db = load(); findCity(db, pid, cid)?.districts.push({ id: id(), name, neighborhoods: [] }); save(db); return db.provinces }
export function addNeighborhood(pid: string, cid: string, did: string, name: string) {
  const db = load(); const dist = findDistrict(db, pid, cid, did)
  if (dist && !dist.neighborhoods.includes(name)) dist.neighborhoods.push(name)
  save(db); return db.provinces
}
// افزودنِ گروهیِ محله‌ها به یک شهر (تکمیل از آگهی‌های واقعی) — محله‌های تازه در منطقهٔ
// «سایر محله‌ها» می‌نشینند تا ادمین بعداً به منطقهٔ درست منتقل/ویرایش کند. تکراری‌ها رد می‌شوند.
export function addNeighborhoodsBulk(cityName: string, hoods: string[]): { added: number } {
  const db = load()
  let target: City | null = null
  for (const p of db.provinces) for (const c of p.cities) if (normName(c.name) === normName(cityName)) { target = c; break }
  if (!target) return { added: 0 }
  const existing = new Set<string>()
  for (const d of target.districts) for (const n of d.neighborhoods) existing.add(normName(n))
  const fresh = hoods.map(h => String(h).trim()).filter(h => h && !existing.has(normName(h)))
  if (!fresh.length) return { added: 0 }
  let other = target.districts.find(d => d.name === 'سایر محله‌ها')
  if (!other) { other = { id: id(), name: 'سایر محله‌ها', neighborhoods: [] }; target.districts.push(other) }
  for (const h of fresh) other.neighborhoods.push(h)
  save(db)
  return { added: fresh.length }
}

// تطبیق نام (حذف ZWNJ + فاصله‌ها + یکسان‌سازی ی/ک)
function normName(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

// نامِ محلهٔ دیوار را به یکی از محله‌های موجودِ سایتِ خودمان نگاشت می‌کند (هیچ محلهٔ
// جدیدی ساخته نمی‌شود). اول تطابقِ دقیق، بعد تطابقِ نسبی؛ ابتدا داخلِ همان شهر، سپس کل کشور.
// خروجی: نام استانداردِ محله/منطقه/شهرِ موجود، یا null اگر محله‌ای در سایت ما با آن نمی‌خواند.
export function findNeighborhoodInGeo(
  cityName: string,
  neighborhoodName: string,
): { province: string; city: string; district: string; neighborhood: string } | null {
  const nb = normName(neighborhoodName)
  const cityN = normName(cityName)
  if (!nb) return null
  const db = load()

  let exact: { province: string; city: string; district: string; neighborhood: string } | null = null
  let fuzzy: { province: string; city: string; district: string; neighborhood: string } | null = null
  for (const p of db.provinces) {
    for (const c of p.cities) {
      const cityOk = !cityN || normName(c.name) === cityN || normName(c.name).includes(cityN) || cityN.includes(normName(c.name))
      for (const d of c.districts) {
        for (const n of d.neighborhoods) {
          const nn = normName(n)
          if (nn === nb) {
            const hit = { province: p.name, city: c.name, district: d.name, neighborhood: n }
            if (cityOk) return hit          // بهترین حالت: تطابقِ دقیق در همان شهر
            exact = exact || hit
          } else if (cityOk && (nn.includes(nb) || nb.includes(nn))) {
            fuzzy = fuzzy || { province: p.name, city: c.name, district: d.name, neighborhood: n }
          }
        }
      }
    }
  }
  return exact || fuzzy
}

// ─── تشخیصِ منطقه از روی آدرس (همان منطقِ آگهی‌ها) ───────────────────────────
// آدرس را به اجزا می‌شکند و اولین محله/منطقه‌ای را که با جدولِ مناطقِ خودِ سایت می‌خورد
// برمی‌گرداند. اندیسِ محله‌ها از یک شهر فقط یک‌بار ساخته و بر mtime کش می‌شود.
const _cityIdx = new Map<string, { key: string; map: Map<string, string> }>()
function cityNeighborhoodIndex(cityName: string): Map<string, string> {
  const want = normName(cityName)
  let mtime = 0; try { mtime = statSync(DATA_FILE).mtimeMs } catch {}
  const key = String(mtime)
  const hit = _cityIdx.get(want)
  if (hit && hit.key === key) return hit.map
  const db = load()
  const map = new Map<string, string>()
  for (const p of db.provinces) for (const c of p.cities) {
    if (normName(c.name) !== want) continue
    for (const d of c.districts) for (const nb of d.neighborhoods) {
      const k = normName(nb); if (k && !map.has(k)) map.set(k, d.name)
    }
  }
  _cityIdx.set(want, { key, map })
  return map
}
// از آدرسِ یک ملک، نامِ منطقهٔ استانداردِ سایت را پیدا می‌کند (یا null).
export function districtFromAddress(cityName: string, address: string): string | null {
  if (!address) return null
  const idx = cityNeighborhoodIndex(cityName)
  if (!idx.size) return null
  const tokens = address.split(/[-،,()\/\n]/).map(t => normName(t)).filter(Boolean)
  for (const t of tokens) { const d = idx.get(t); if (d) return d }       // تطابقِ دقیقِ جزء
  for (const t of tokens) for (const [k, d] of idx) { if (k.length >= 3 && (t.includes(k) || k.includes(t))) return d }  // تطابقِ نسبی
  return null
}

// اندیسِ نامِ محله‌ها (normNb → نامِ نمایشیِ محله) — برای فیلترِ محله.
const _cityNameIdx = new Map<string, { key: string; map: Map<string, string> }>()
function cityNeighborhoodNameIndex(cityName: string): Map<string, string> {
  const want = normName(cityName)
  let mtime = 0; try { mtime = statSync(DATA_FILE).mtimeMs } catch {}
  const key = String(mtime)
  const hit = _cityNameIdx.get(want)
  if (hit && hit.key === key) return hit.map
  const db = load()
  const map = new Map<string, string>()
  for (const p of db.provinces) for (const c of p.cities) {
    if (normName(c.name) !== want) continue
    for (const d of c.districts) for (const nb of d.neighborhoods) { const k = normName(nb); if (k && !map.has(k)) map.set(k, nb) }
  }
  _cityNameIdx.set(want, { key, map })
  return map
}
// نامِ محلهٔ استانداردِ سایت را از آدرس پیدا می‌کند (یا null).
export function neighbourhoodFromAddress(cityName: string, address: string): string | null {
  if (!address) return null
  const idx = cityNeighborhoodNameIndex(cityName)
  if (!idx.size) return null
  const tokens = address.split(/[-،,()\/\n]/).map(t => normName(t)).filter(Boolean)
  for (const t of tokens) { const n = idx.get(t); if (n) return n }
  for (const t of tokens) for (const [k, n] of idx) { if (k.length >= 3 && (t.includes(k) || k.includes(t))) return n }
  return null
}

export function renameNode(level: 'province' | 'city' | 'district', ids: { pid: string; cid?: string; did?: string }, name: string) {
  const db = load()
  if (level === 'province') { const n = findProvince(db, ids.pid); if (n) n.name = name }
  if (level === 'city') { const n = findCity(db, ids.pid, ids.cid!); if (n) n.name = name }
  if (level === 'district') { const n = findDistrict(db, ids.pid, ids.cid!, ids.did!); if (n) n.name = name }
  save(db); return db.provinces
}
export function deleteNode(level: 'province' | 'city' | 'district' | 'neighborhood', ids: { pid: string; cid?: string; did?: string; name?: string }) {
  const db = load()
  if (level === 'province') db.provinces = db.provinces.filter(p => p.id !== ids.pid)
  if (level === 'city') { const p = findProvince(db, ids.pid); if (p) p.cities = p.cities.filter(c => c.id !== ids.cid) }
  if (level === 'district') { const c = findCity(db, ids.pid, ids.cid!); if (c) c.districts = c.districts.filter(d => d.id !== ids.did) }
  if (level === 'neighborhood') { const d = findDistrict(db, ids.pid, ids.cid!, ids.did!); if (d) d.neighborhoods = d.neighborhoods.filter(n => n !== ids.name) }
  save(db); return db.provinces
}
