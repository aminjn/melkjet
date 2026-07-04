import { listItems, listOwners, type Item } from './scraper-store'
import { listPoints } from './market-data'
import { parsePrice, parseArea } from './market-stats'

function isRent(it: Item): boolean {
  const cat = it.meta?.['category'] || ''
  if (/rent/.test(cat)) return true
  if (/sell/.test(cat)) return false
  return /ودیعه|اجاره|رهن/.test(`${it.price || ''} ${it.title || ''} ${it.meta?.['نوع معامله'] || ''}`)
}
function cityOf(it: Item) { return it.meta?.['شهر'] || (it.location || '').split('،').slice(-1)[0]?.trim() || 'نامشخص' }
function districtOf(it: Item) { return it.meta?.['محله'] || (it.location || '').split('،')[0]?.trim() || 'نامشخص' }

// Comprehensive, real platform-wide data overview (everything we have).
export async function platformStats() {
  const listings = await listItems('listing')
  const directory = await listItems('directory')
  const products = await listItems('product')
  const articles = await listItems('article')
  const prices = await listItems('price')

  let sale = 0, rent = 0
  const byCity: Record<string, number> = {}
  const byDistrict: Record<string, { district: string; city: string; count: number; sale: number; rent: number; ppmSum: number; ppmN: number; depSum: number; depN: number }> = {}

  for (const it of listings) {
    const r = isRent(it)
    r ? rent++ : sale++
    const city = cityOf(it), district = districtOf(it)
    byCity[city] = (byCity[city] || 0) + 1
    const k = `${district}|${city}`
    const row = byDistrict[k] || (byDistrict[k] = { district, city, count: 0, sale: 0, rent: 0, ppmSum: 0, ppmN: 0, depSum: 0, depN: 0 })
    row.count++
    const price = parsePrice(it.price || '')
    if (r) {
      row.rent++
      if (price > 1e7) { row.depSum += price; row.depN++ }
    } else {
      row.sale++
      const area = parseArea(it.title) || parseArea(it.excerpt || '')
      if (area > 15 && price > 1e8) { const ppm = price / area; if (ppm > 1e6 && ppm < 5e9) { row.ppmSum += ppm; row.ppmN++ } }
    }
  }

  const dirByCat: Record<string, number> = {}
  for (const it of directory) { const c = it.category || 'سایر'; dirByCat[c] = (dirByCat[c] || 0) + 1 }

  const districts = Object.values(byDistrict).map(r => ({
    district: r.district, city: r.city, count: r.count, sale: r.sale, rent: r.rent,
    avgSalePpm: r.ppmN ? Math.round(r.ppmSum / r.ppmN) : 0,
    avgDeposit: r.depN ? Math.round(r.depSum / r.depN) : 0,
  })).sort((a, b) => b.count - a.count)

  return {
    listings: {
      total: listings.length, sale, rent,
      byCity: Object.entries(byCity).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 30),
      byDistrict: districts.slice(0, 80),
    },
    directory: {
      total: directory.length,
      byCategory: Object.entries(dirByCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    },
    products: products.length,
    articles: articles.length,
    prices: prices.length,
    owners: (await listOwners()).length,
    dataset: listPoints().length,
  }
}
