// Client-safe Divar constants (no node imports) — used by the admin UI.

export const DIVAR_CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'apartment-rent', label: 'آپارتمان — اجاره/رهن' },
  { slug: 'apartment-sell', label: 'آپارتمان — فروش' },
  { slug: 'house-villa-rent', label: 'خانه و ویلا — اجاره' },
  { slug: 'house-villa-sell', label: 'خانه و ویلا — فروش' },
  { slug: 'residential-rent', label: 'مسکونی — همه اجاره' },
  { slug: 'residential-sell', label: 'مسکونی — همه فروش' },
  { slug: 'plot-old', label: 'زمین و کلنگی' },
  { slug: 'office-rent', label: 'دفتر کار — اجاره' },
  { slug: 'office-sell', label: 'دفتر کار — فروش' },
  { slug: 'store-rent', label: 'مغازه — اجاره' },
  { slug: 'store-sell', label: 'مغازه — فروش' },
]

export const DIVAR_CITIES: { id: string; name: string }[] = [
  { id: '1', name: 'تهران' },
  { id: '2', name: 'کرج' },
  { id: '4', name: 'مشهد' },
  { id: '5', name: 'تبریز' },
  { id: '6', name: 'اصفهان' },
  { id: '7', name: 'شیراز' },
  { id: '8', name: 'اهواز' },
  { id: '9', name: 'قم' },
]
