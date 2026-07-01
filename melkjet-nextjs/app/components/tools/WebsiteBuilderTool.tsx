'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import PanelReturnBar from '@/app/components/PanelReturnBar'

export type WebsiteView = 'templates' | 'editor'

// Sidebar nav entries (one per sub-view) — lets a host panel show a cascading submenu.
export const WEBSITE_VIEWS: { id: WebsiteView; label: string; icon: string }[] = [
  { id: 'templates', icon: '▦', label: 'قالب‌ها' },
  { id: 'editor', icon: '◳', label: 'ویرایشگر' },
]

type Device = 'desktop' | 'mobile' | 'tablet'
type ActiveTab = 'seo' | 'settings' | 'pages' | 'reviews'

interface Block {
  id: number
  type: string
  props: Record<string, any>
}

// A real page: its own slug, title and block list. pages[0] is the home page.
interface Page {
  slug: string
  title: string
  blocks: Block[]
  inMenu?: boolean      // در منوی سایت نمایش داده شود (پیش‌فرض true)
  menuLabel?: string    // عنوان دلخواه در منو (پیش‌فرض = title)
}

// Make a url-safe slug (mirrors sites-store.sanitizeSlug).
function slugify(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Theme {
  primary: string
  secondary?: string
  bg?: string
  surface?: string
  text?: string
  heading?: string
  font?: string
}

const DEFAULT_THEME: Theme = { primary: '#c9a84c', secondary: '#1a1510', bg: '#ffffff', surface: '#fbfaf8', text: '#4a4338', heading: '#15110b' }

// پالت‌های آمادهٔ کاملِ سایت — تا قالب‌ها واقعاً متفاوت دیده شوند و کاربر یک‌کلیک تمِ کامل بگذارد.
const SITE_PALETTES: { name: string; t: Required<Omit<Theme, 'font'>> }[] = [
  { name: 'طلایی کلاسیک', t: { primary: '#c9a84c', secondary: '#1a1510', bg: '#ffffff', surface: '#faf8f3', text: '#4a4338', heading: '#15110b' } },
  { name: 'آبی حرفه‌ای', t: { primary: '#2563eb', secondary: '#0f1f3a', bg: '#ffffff', surface: '#f3f6fc', text: '#3f4654', heading: '#0f1b30' } },
  { name: 'سبز اعتماد', t: { primary: '#0f9d76', secondary: '#06302c', bg: '#ffffff', surface: '#f0faf6', text: '#3c4a45', heading: '#0c241d' } },
  { name: 'مشکی لوکس', t: { primary: '#d4af37', secondary: '#0c0c0e', bg: '#0f0f12', surface: '#17171c', text: '#c9c6c1', heading: '#ffffff' } },
  { name: 'بنفش سلطنتی', t: { primary: '#7c3aed', secondary: '#1e1033', bg: '#ffffff', surface: '#f6f3fd', text: '#443a55', heading: '#1c1230' } },
  { name: 'نارنجی گرم', t: { primary: '#ea580c', secondary: '#2a1505', bg: '#ffffff', surface: '#fdf5ef', text: '#4d4338', heading: '#26160a' } },
  { name: 'فیروزه‌ای', t: { primary: '#0891b2', secondary: '#0a2a33', bg: '#ffffff', surface: '#eef9fc', text: '#3a4a4e', heading: '#0c2229' } },
  { name: 'صورتی مدرن', t: { primary: '#db2777', secondary: '#2a0d1f', bg: '#ffffff', surface: '#fdf2f8', text: '#4d3a44', heading: '#2a0d1f' } },
  { name: 'سرمه‌ای شب', t: { primary: '#60a5fa', secondary: '#0b1220', bg: '#0d1424', surface: '#141d31', text: '#b9c2d4', heading: '#ffffff' } },
  { name: 'زمرد تیره', t: { primary: '#34d399', secondary: '#06231a', bg: '#0b1a15', surface: '#10241d', text: '#aebfb7', heading: '#ffffff' } },
  { name: 'قرمز شرابی', t: { primary: '#be123c', secondary: '#2a0810', bg: '#ffffff', surface: '#fdf2f4', text: '#4d3a3f', heading: '#26090f' } },
  { name: 'خاکستری شیک', t: { primary: '#475569', secondary: '#1e293b', bg: '#ffffff', surface: '#f4f6f8', text: '#475569', heading: '#1e293b' } },
]

// فونت‌های قابلِ انتخابِ سایت — همگی لوکال (@font-face در globals.css). بدونِ گوگل.
const FONT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'وزیرمتن (پیش‌فرض)' },
  { value: 'Markazi Text', label: 'مرکزی (Markazi)' },
  { value: 'Gulzar', label: 'گلزار (Gulzar)' },
  { value: 'Noto Naskh Arabic', label: 'نسخ (Naskh)' },
  { value: 'Lalezar', label: 'لاله‌زار (نمایشی)' },
]

// پالتِ هر قالب بر اساسِ شمارهٔ آن — تا قالب‌های یک پروفایل، هرکدام رنگِ متفاوت داشته باشند.
function templatePalette(tpl: { id: string }): Required<Omit<Theme, 'font'>> {
  const m = /(\d+)\s*$/.exec(tpl.id)
  const n = m ? parseInt(m[1], 10) : 0
  return SITE_PALETTES[n % SITE_PALETTES.length].t
}

// Shared inspector input style (inline + CSS vars, RTL).
const INSPECTOR_INPUT: CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }
const LIST_BTN: CSSProperties = { width: 22, height: 22, borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }

// ── Per-type defaults: a fresh block looks real out of the box ──────────────
const BLOCK_DEFAULTS: Record<string, Record<string, any>> = {
  hero: {
    heading: 'بهترین ملک را با ما بیابید',
    subheading: 'مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه',
    buttonText: 'مشاهده ملک‌ها',
    buttonLink: '#listings',
    align: 'center',
    bg: 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)',
    textColor: '#ffffff',
    image: '',
    images: [],
    overlay: 'dark',
    height: 'normal',
  },
  search: {
    heading: 'جستجوی ملک',
    placeholder: 'منطقه، شهر یا محله را وارد کنید...',
  },
  catalog: {
    heading: 'محصولات ما',
    count: 12,
  },
  pricelist: {
    heading: 'نرخِ روزِ محصولات',
  },
  listings: {
    heading: 'آگهی‌های من',
    source: 'mine',
    total: 9,
    perSlide: 3,
    showCategories: 'yes',
    count: 3,
  },
  searchlist: {
    heading: 'جستجوی آگهی‌ها',
    total: 60,
  },
  blog: {
    heading: 'وبلاگ و مقالات',
    source: 'mine',
    count: 3,
  },
  blogfull: {
    heading: 'وبلاگ',
    source: 'mine',
    sidebar: 'yes',
  },
  services: {
    heading: 'خدمات ما',
    perSlide: 3,
    items: [
      { icon: '◇', title: 'خرید ملک', desc: 'مشاوره تخصصی برای خرید بهترین ملک' },
      { icon: '⌂', title: 'اجاره', desc: 'گزینه‌های متنوع اجاره مسکونی و تجاری' },
      { icon: '◈', title: 'مشاوره', desc: 'مشاوره رایگان سرمایه‌گذاری ملکی' },
    ],
  },
  about: {
    heading: 'درباره ما',
    text: 'ما با سال‌ها تجربه در حوزه املاک، همراه شما در مسیر خرید، فروش و اجاره ملک هستیم. تیم حرفه‌ای ما با ارائه مشاوره تخصصی، بهترین گزینه‌ها را متناسب با نیاز شما پیشنهاد می‌دهد.',
    image: '',
  },
  team: {
    heading: 'مشاوران ما',
    subheading: 'تیمِ حرفه‌ایِ مشاورانِ ما در کنارِ شما',
    showSites: 'yes',   // نمایشِ لینکِ سایتِ شخصیِ هر مشاور زیرِ عکسش
    showPhone: 'yes',
  },
  stats: {
    items: [
      { value: '۵۰۰+', label: 'ملک فروخته' },
      { value: '۱۲', label: 'سال تجربه' },
      { value: '۲۰۰', label: 'مشتری راضی' },
      { value: '۹۸٪', label: 'رضایت' },
    ],
  },
  gallery: {
    heading: 'گالری تصاویر',
    images: [],
    total: 9,
    perSlide: 3,
  },
  testimonials: {
    heading: 'نظرات مشتریان',
    showReal: 'yes',
    allowSubmit: 'yes',
    items: [
      { name: 'علی رضایی', text: 'تجربه‌ای عالی و حرفه‌ای داشتم. کاملاً راضی هستم.', rating: 5 },
      { name: 'مریم احمدی', text: 'برخورد بسیار خوب و مشاوره دقیق. پیشنهاد می‌کنم.', rating: 5 },
    ],
  },
  cta: {
    heading: 'همین امروز با ما تماس بگیرید',
    subheading: 'کارشناسان ما آماده پاسخگویی هستند',
    buttonText: 'تماس با ما',
    buttonLink: '#contact',
    bg: 'linear-gradient(135deg,#2d2215,#1a1510)',
  },
  contact: {
    heading: 'فرم تماس',
    phone: '۰۲۱-۱۲۳۴۵۶۷۸',
    email: 'info@example.com',
    address: 'تهران، ایران',
  },
  footer: {
    brand: 'ملک‌جت',
    about: 'مشاور املاک حرفه‌ای؛ همراهِ شما در خرید، فروش و اجارهٔ ملک با مشاورهٔ تخصصی و فایل‌های به‌روز.',
    links: [
      { label: 'خانه', href: '#' },
      { label: 'آگهی‌ها', href: '#listings' },
      { label: 'درباره ما', href: '#about' },
      { label: 'تماس', href: '#contact' },
    ],
    phone: '۰۲۱-۱۲۳۴۵۶۷۸',
    email: 'info@example.com',
    address: 'تهران، خیابان ولیعصر',
    instagram: '',
    telegram: '',
    whatsapp: '',
    linkedin: '',
    copyright: '© ۱۴۰۴ — تمامی حقوق محفوظ است',
    // back-compat
    text: 'ملک‌جت',
  },
}

// Field kinds for the inspector. order matters for layout.
type FieldKind = 'text' | 'textarea' | 'color' | 'number' | 'enum' | 'image' | 'list'
interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  options?: { value: string; label: string }[] // enum
  itemFields?: { key: string; label: string; kind: 'text' | 'textarea' | 'number' | 'image' }[] // list
  newItem?: () => any // list (object row, or a string for image lists)
}

const BLOCK_SCHEMA: Record<string, FieldSpec[]> = {
  hero: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'subheading', label: 'زیرعنوان', kind: 'textarea' },
    { key: 'buttonText', label: 'متن دکمه', kind: 'text' },
    { key: 'buttonLink', label: 'لینک دکمه', kind: 'text' },
    { key: 'image', label: 'تصویرِ پس‌زمینه', kind: 'image' },
    { key: 'images', label: 'اسلایدرِ تصاویرِ پس‌زمینه', kind: 'list', itemFields: [{ key: '', label: 'تصویر', kind: 'image' }], newItem: () => '' },
    { key: 'overlay', label: 'لایهٔ تیرگی روی تصویر', kind: 'enum', options: [{ value: 'dark', label: 'تیره' }, { value: 'light', label: 'روشن' }, { value: 'none', label: 'بدون' }] },
    { key: 'height', label: 'ارتفاع', kind: 'enum', options: [{ value: 'normal', label: 'معمولی' }, { value: 'tall', label: 'بلند' }] },
    { key: 'align', label: 'چیدمان', kind: 'enum', options: [{ value: 'center', label: 'وسط' }, { value: 'right', label: 'راست‌چین' }] },
    { key: 'bg', label: 'پس‌زمینه (CSS)', kind: 'text' },
    { key: 'textColor', label: 'رنگ متن', kind: 'color' },
  ],
  search: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'placeholder', label: 'متن راهنما', kind: 'text' },
  ],
  catalog: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'count', label: 'تعدادِ محصولِ نمایشی', kind: 'number' },
  ],
  pricelist: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
  ],
  listings: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'total', label: 'تعدادِ کلِ آگهی', kind: 'number' },
    { key: 'perSlide', label: 'تعداد در هر اسلاید', kind: 'number' },
    { key: 'showCategories', label: 'نمایشِ دسته‌بندی‌ها', kind: 'enum', options: [{ value: 'yes', label: 'نمایش' }, { value: 'no', label: 'بدون دسته' }] },
  ],
  searchlist: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'total', label: 'تعدادِ کلِ آگهی', kind: 'number' },
  ],
  blog: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'count', label: 'تعداد', kind: 'number' },
  ],
  blogfull: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'sidebar', label: 'ساید‌بار', kind: 'enum', options: [{ value: 'yes', label: 'نمایش' }, { value: 'no', label: 'بدون ساید‌بار' }] },
  ],
  services: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'perSlide', label: 'تعداد در هر اسلاید', kind: 'number' },
    { key: 'items', label: 'خدمات', kind: 'list', itemFields: [{ key: 'icon', label: 'آیکن', kind: 'text' }, { key: 'title', label: 'عنوان', kind: 'text' }, { key: 'desc', label: 'توضیح', kind: 'textarea' }], newItem: () => ({ icon: '◇', title: 'خدمت جدید', desc: 'توضیح خدمت' }) },
  ],
  about: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'text', label: 'متن', kind: 'textarea' },
    { key: 'image', label: 'تصویر', kind: 'image' },
  ],
  team: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'subheading', label: 'زیرعنوان', kind: 'textarea' },
    { key: 'showSites', label: 'نمایشِ لینکِ سایتِ مشاور', kind: 'enum', options: [{ value: 'yes', label: 'نمایش' }, { value: 'no', label: 'عدم نمایش' }] },
    { key: 'showPhone', label: 'نمایشِ شمارهٔ تماس', kind: 'enum', options: [{ value: 'yes', label: 'نمایش' }, { value: 'no', label: 'عدم نمایش' }] },
  ],
  stats: [
    { key: 'items', label: 'آمار', kind: 'list', itemFields: [{ key: 'value', label: 'مقدار', kind: 'text' }, { key: 'label', label: 'برچسب', kind: 'text' }], newItem: () => ({ value: '۰', label: 'آمار جدید' }) },
  ],
  gallery: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'images', label: 'تصاویر', kind: 'list', itemFields: [{ key: '', label: 'تصویر', kind: 'image' }], newItem: () => '' },
    { key: 'total', label: 'تعدادِ کلِ تصاویر', kind: 'number' },
    { key: 'perSlide', label: 'تعداد در هر اسلاید', kind: 'number' },
  ],
  testimonials: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'showReal', label: 'نمایشِ نظراتِ واقعیِ ثبت‌شده', kind: 'enum', options: [{ value: 'yes', label: 'نمایش' }, { value: 'no', label: 'فقط نظراتِ دستی' }] },
    { key: 'allowSubmit', label: 'فرمِ ثبتِ نظر برای بازدیدکننده', kind: 'enum', options: [{ value: 'yes', label: 'فعال' }, { value: 'no', label: 'غیرفعال' }] },
    { key: 'items', label: 'نظراتِ دستی', kind: 'list', itemFields: [{ key: 'name', label: 'نام', kind: 'text' }, { key: 'text', label: 'متن', kind: 'textarea' }, { key: 'rating', label: 'امتیاز (۱-۵)', kind: 'number' }], newItem: () => ({ name: 'مشتری جدید', text: 'متن نظر', rating: 5 }) },
  ],
  cta: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'subheading', label: 'زیرعنوان', kind: 'textarea' },
    { key: 'buttonText', label: 'متن دکمه', kind: 'text' },
    { key: 'buttonLink', label: 'لینک دکمه', kind: 'text' },
    { key: 'bg', label: 'پس‌زمینه (CSS)', kind: 'text' },
  ],
  contact: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'phone', label: 'تلفن', kind: 'text' },
    { key: 'email', label: 'ایمیل', kind: 'text' },
    { key: 'address', label: 'آدرس', kind: 'text' },
  ],
  footer: [
    { key: 'brand', label: 'نامِ برند', kind: 'text' },
    { key: 'about', label: 'معرفیِ کوتاه', kind: 'textarea' },
    { key: 'links', label: 'لینک‌های سریع', kind: 'list', itemFields: [{ key: 'label', label: 'برچسب', kind: 'text' }, { key: 'href', label: 'آدرس', kind: 'text' }], newItem: () => ({ label: 'لینک جدید', href: '#' }) },
    { key: 'phone', label: 'تلفن', kind: 'text' },
    { key: 'email', label: 'ایمیل', kind: 'text' },
    { key: 'address', label: 'آدرس', kind: 'text' },
    { key: 'instagram', label: 'اینستاگرام (آدرس/آی‌دی)', kind: 'text' },
    { key: 'telegram', label: 'تلگرام', kind: 'text' },
    { key: 'whatsapp', label: 'واتساپ', kind: 'text' },
    { key: 'linkedin', label: 'لینکدین', kind: 'text' },
    { key: 'copyright', label: 'متنِ کپی‌رایت', kind: 'text' },
  ],
}

const BLOCK_LIBRARY = [
  { type: 'hero', label: 'هیرو', icon: '◇' },
  { type: 'catalog', label: 'کاتالوگ محصولات', icon: '🧱' },
  { type: 'pricelist', label: 'نرخِ روز (جدول قیمت)', icon: '📊' },
  { type: 'search', label: 'نوار جستجو', icon: '⌕' },
  { type: 'searchlist', label: 'آگهی‌ها (جستجو و فیلتر)', icon: '🔍' },
  { type: 'listings', label: 'آگهی‌های من', icon: '⌂' },
  { type: 'blog', label: 'وبلاگ (خلاصه)', icon: '✎' },
  { type: 'blogfull', label: 'صفحهٔ وبلاگ', icon: '🗞' },
  { type: 'services', label: 'خدمات', icon: '◈' },
  { type: 'about', label: 'درباره ما', icon: '¶' },
  { type: 'team', label: 'تیم مشاوران', icon: '☺' },
  { type: 'stats', label: 'آمار', icon: '◔' },
  { type: 'gallery', label: 'گالری', icon: '▥' },
  { type: 'testimonials', label: 'نظرات مشتریان', icon: '❝' },
  { type: 'cta', label: 'دعوت به اقدام', icon: '➤' },
  { type: 'contact', label: 'فرم تماس', icon: '✉' },
  { type: 'footer', label: 'فوتر', icon: '▬' },
]

const PROFILE_GROUPS = ['مشاور', 'آژانس', 'سازنده', 'فروشگاه', 'سرمایه‌گذار', 'حقوقی', 'عمومی'] as const

// رنگ تم (primary) و گرادیان هیرو هر پروفایل — قالب‌ها را واقعاً متمایز می‌کند
const PROFILE_THEME: Record<string, { primary: string; heroBg: string }> = {
  'مشاور': { primary: '#3b82f6', heroBg: 'linear-gradient(140deg,#0f1f3a,#1e3a8a,#0f1f3a)' },
  'آژانس': { primary: '#14b8a6', heroBg: 'linear-gradient(140deg,#06302c,#0f766e,#06302c)' },
  'سازنده': { primary: '#f59e0b', heroBg: 'linear-gradient(140deg,#2a1a05,#b45309,#2a1a05)' },
  'فروشگاه': { primary: '#ec4899', heroBg: 'linear-gradient(140deg,#2a0d2a,#7c3aed,#2a0d2a)' },
  'سرمایه‌گذار': { primary: '#10b981', heroBg: 'linear-gradient(140deg,#052b1e,#065f46,#052b1e)' },
  'حقوقی': { primary: '#64748b', heroBg: 'linear-gradient(140deg,#15202b,#334155,#15202b)' },
  'عمومی': { primary: '#c9a84c', heroBg: 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)' },
}

// متن هیروی متمایز برای اولین قالب هر پروفایل (تا قالب‌ها واقعاً فرق کنند)
const PROFILE_HERO_COPY: Record<string, { heading: string; subheading: string; buttonText: string }> = {
  'مشاور': { heading: 'مشاور املاک مورد اعتماد شما', subheading: 'بیش از ۱۰ سال تجربه در خرید، فروش و اجاره ملک', buttonText: 'مشاهده فایل‌ها' },
  'آژانس': { heading: 'آژانس املاک پیشرو', subheading: 'تیمی حرفه‌ای برای تمام نیازهای ملکی شما', buttonText: 'خدمات ما' },
  'سازنده': { heading: 'پروژه‌های ساختمانی لوکس', subheading: 'ساخت و پیش‌فروش واحدهای مسکونی و تجاری', buttonText: 'مشاهده پروژه‌ها' },
  'فروشگاه': { heading: 'فروشگاه مصالح ساختمانی', subheading: 'بهترین کیفیت با مناسب‌ترین قیمت', buttonText: 'مشاهده محصولات' },
  'سرمایه‌گذار': { heading: 'سرمایه‌گذاری هوشمند در املاک', subheading: 'بازده تضمین‌شده با فرصت‌های منتخب', buttonText: 'فرصت‌های سرمایه‌گذاری' },
  'حقوقی': { heading: 'مشاوره حقوقی تخصصی املاک', subheading: 'وکالت و تنظیم قراردادهای ملکی', buttonText: 'دریافت مشاوره' },
  'عمومی': { heading: 'بهترین ملک را با ما بیابید', subheading: 'مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه', buttonText: 'مشاهده ملک‌ها' },
}

// نگاشت مسیر داشبورد کاربر به گروه پروفایل قالب‌ها
const DASH_TO_PROFILE: Record<string, string> = {
  '/builder': 'سازنده',
  '/pros': 'مشاور',
  '/agency': 'آژانس',
  '/materials': 'فروشگاه',
  '/owner': 'سرمایه‌گذار',
  '/buyer': 'عمومی',
  '/legal': 'حقوقی',
  '/crm': 'مشاور',
}

const STARTER_TEMPLATES = [
  // ───────── مشاور (۱۰) ─────────
  { id: 'pro-01', name: 'مشاور کلاسیک', profile: 'مشاور', blocks: ['hero', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، فایل‌ها، نظرات، تماس' },
  { id: 'pro-02', name: 'مشاور مدرن', profile: 'مشاور', blocks: ['hero', 'stats', 'listings', 'about', 'footer'], desc: 'هیرو، آمار، فایل‌ها، درباره', blogPage: true },
  { id: 'pro-03', name: 'مشاور حرفه‌ای', profile: 'مشاور', blocks: ['hero', 'gallery', 'services', 'cta', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، اقدام، تماس' },
  { id: 'pro-04', name: 'مشاور لوکس', profile: 'مشاور', blocks: ['hero', 'about', 'listings', 'testimonials', 'cta', 'footer'], desc: 'هیرو، معرفی، فایل‌ها، نظرات' },
  { id: 'pro-05', name: 'مشاور جستجو‌محور', profile: 'مشاور', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'pro-06', name: 'مشاور کامل', profile: 'مشاور', blocks: ['hero', 'services', 'stats', 'listings', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، فایل‌ها، نظرات', blogPage: true },
  { id: 'pro-07', name: 'مشاور تک‌برگ', profile: 'مشاور', blocks: ['hero', 'listings', 'about', 'cta', 'footer'], desc: 'هیرو، فایل‌ها، درباره، اقدام' },
  { id: 'pro-08', name: 'مشاور تصویری', profile: 'مشاور', blocks: ['hero', 'gallery', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، فایل‌ها، نظرات، تماس' },
  { id: 'pro-09', name: 'مشاور معتبر', profile: 'مشاور', blocks: ['hero', 'about', 'stats', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، تماس' },
  { id: 'pro-10', name: 'مشاور سریع', profile: 'مشاور', blocks: ['hero', 'search', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، جستجو، خدمات، نظرات، اقدام' },

  // ───────── آژانس (۱۰) ─────────
  { id: 'agc-01', name: 'آژانس جامع', profile: 'آژانس', blocks: ['hero', 'services', 'listings', 'team', 'contact', 'footer'], desc: 'هیرو، خدمات، فایل‌ها، تیم، تماس' },
  { id: 'agc-02', name: 'آژانس لوکس', profile: 'آژانس', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات' },
  { id: 'agc-03', name: 'آژانس مدرن', profile: 'آژانس', blocks: ['hero', 'search', 'listings', 'stats', 'cta', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، آمار، اقدام' },
  { id: 'agc-04', name: 'آژانس حرفه‌ای', profile: 'آژانس', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات', blogPage: true },
  { id: 'agc-05', name: 'آژانس برتر', profile: 'آژانس', blocks: ['hero', 'stats', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، آمار، فایل‌ها، نظرات، تماس' },
  { id: 'agc-06', name: 'آژانس تیمی', profile: 'آژانس', blocks: ['hero', 'team', 'gallery', 'services', 'contact', 'footer'], desc: 'هیرو، تیم، گالری، خدمات، تماس' },
  { id: 'agc-07', name: 'آژانس کامل', profile: 'آژانس', blocks: ['hero', 'search', 'services', 'listings', 'testimonials', 'footer'], desc: 'هیرو، جستجو، خدمات، فایل‌ها، نظرات' },
  { id: 'agc-08', name: 'آژانس فروش', profile: 'آژانس', blocks: ['hero', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، فایل‌ها، اقدام، تماس' },
  { id: 'agc-09', name: 'آژانس معتبر', profile: 'آژانس', blocks: ['hero', 'services', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، خدمات، آمار، گالری، اقدام' },
  { id: 'agc-10', name: 'آژانس بین‌المللی', profile: 'آژانس', blocks: ['hero', 'about', 'listings', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، فایل‌ها، خدمات، نظرات، تماس', blogPage: true },

  // ───────── سازنده (۱۰) ─────────
  { id: 'bld-01', name: 'پیش‌فروش پروژه', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری پروژه، آمار، فرم' },
  { id: 'bld-02', name: 'سازندهٔ ساختمان', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'services', 'cta', 'footer'], desc: 'هیرو، درباره، پروژه‌ها، خدمات' },
  { id: 'bld-03', name: 'انبوه‌ساز', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، آمار، درباره، اقدام' },
  { id: 'bld-04', name: 'پروژهٔ لوکس', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات، تماس' },
  { id: 'bld-05', name: 'سازندهٔ مدرن', profile: 'سازنده', blocks: ['hero', 'stats', 'gallery', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، گالری، درباره، تماس' },
  { id: 'bld-06', name: 'برج مسکونی', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'cta', 'footer'], desc: 'هیرو، معرفی، گالری، آمار، اقدام' },
  { id: 'bld-07', name: 'مجتمع تجاری', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، آمار، تماس' },
  { id: 'bld-08', name: 'سازندهٔ کامل', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، گالری، آمار، نظرات', blogPage: true },
  { id: 'bld-09', name: 'پروژهٔ نمونه', profile: 'سازنده', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'bld-10', name: 'سازندهٔ معتبر', profile: 'سازنده', blocks: ['hero', 'stats', 'about', 'gallery', 'services', 'footer'], desc: 'هیرو، آمار، درباره، گالری، خدمات' },

  // ───────── فروشگاه (۱۰) ─────────
  { id: 'shp-01', name: 'فروشگاه مصالح', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، نظرات، تماس' },
  { id: 'shp-02', name: 'فروشگاه آنلاین', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'pricelist', 'about', 'footer'], desc: 'هیرو، کاتالوگ، نرخِ روز، درباره' },
  { id: 'shp-03', name: 'فروشگاه مدرن', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'gallery', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، گالری، اقدام' },
  { id: 'shp-04', name: 'فروشگاه کامل', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'pricelist', 'stats', 'testimonials', 'footer'], desc: 'هیرو، کاتالوگ، نرخِ روز، آمار، نظرات', blogPage: true },
  { id: 'shp-05', name: 'فروشگاه تخصصی', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، کاتالوگ، درباره، نظرات، تماس' },
  { id: 'shp-06', name: 'فروشگاه ابزار', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، درباره، اقدام' },
  { id: 'shp-07', name: 'فروشگاه دکوراسیون', profile: 'فروشگاه', blocks: ['hero', 'gallery', 'catalog', 'services', 'contact', 'footer'], desc: 'هیرو، گالری، کاتالوگ، دسته‌ها، تماس' },
  { id: 'shp-08', name: 'فروشگاه عمده', profile: 'فروشگاه', blocks: ['hero', 'pricelist', 'catalog', 'stats', 'contact', 'footer'], desc: 'هیرو، نرخِ روز، کاتالوگ، آمار، تماس' },
  { id: 'shp-09', name: 'فروشگاه برتر', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'pricelist', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، نرخِ روز، اقدام' },
  { id: 'shp-10', name: 'فروشگاه نمونه', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'about', 'services', 'testimonials', 'footer'], desc: 'هیرو، کاتالوگ، درباره، دسته‌ها، نظرات' },

  // ───────── سرمایه‌گذار (۱۰) ─────────
  { id: 'inv-01', name: 'سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، آمار بازده، فرصت‌ها، اقدام' },
  { id: 'inv-02', name: 'صندوق املاک', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، آمار، درباره، اقدام' },
  { id: 'inv-03', name: 'فرصت سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'listings', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، فرصت‌ها، آمار، نظرات، تماس' },
  { id: 'inv-04', name: 'پرتفوی ملکی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، آمار، گالری، اقدام' },
  { id: 'inv-05', name: 'بازده تضمینی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },
  { id: 'inv-06', name: 'سرمایه‌گذاری مدرن', profile: 'سرمایه‌گذار', blocks: ['hero', 'about', 'stats', 'listings', 'cta', 'footer'], desc: 'هیرو، درباره، آمار، فرصت‌ها، اقدام', blogPage: true },
  { id: 'inv-07', name: 'سرمایه‌گذاری امن', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'testimonials', 'cta', 'contact', 'footer'], desc: 'هیرو، آمار، نظرات، اقدام، تماس' },
  { id: 'inv-08', name: 'پروژهٔ سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'gallery', 'stats', 'listings', 'cta', 'footer'], desc: 'هیرو، گالری، آمار، فرصت‌ها، اقدام' },
  { id: 'inv-09', name: 'سرمایه‌گذاری کامل', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'services', 'listings', 'testimonials', 'footer'], desc: 'هیرو، آمار، خدمات، فرصت‌ها، نظرات' },
  { id: 'inv-10', name: 'سرمایه‌گذاری حرفه‌ای', profile: 'سرمایه‌گذار', blocks: ['hero', 'about', 'stats', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، اقدام، تماس' },

  // ───────── حقوقی (۱۰) ─────────
  { id: 'lgl-01', name: 'مشاور حقوقی', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات حقوقی، درباره، تماس' },
  { id: 'lgl-02', name: 'دفتر وکالت', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، تماس' },
  { id: 'lgl-03', name: 'مشاوره ملکی', profile: 'حقوقی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'lgl-04', name: 'حقوقی حرفه‌ای', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، تماس' },
  { id: 'lgl-05', name: 'وکیل پایه یک', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام، تماس' },
  { id: 'lgl-06', name: 'حقوقی معتبر', profile: 'حقوقی', blocks: ['hero', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات' },
  { id: 'lgl-07', name: 'قراردادهای ملکی', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، خدمات، نظرات، اقدام' },
  { id: 'lgl-08', name: 'مشاوره تخصصی', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'stats', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، آمار، اقدام' },
  { id: 'lgl-09', name: 'حقوقی کامل', profile: 'حقوقی', blocks: ['hero', 'services', 'testimonials', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، درباره، تماس', blogPage: true },
  { id: 'lgl-10', name: 'دفتر اسناد', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },

  // ───────── عمومی (۱۰) ─────────
  { id: 'gen-01', name: 'لندینگ فروش', profile: 'عمومی', blocks: ['hero', 'cta', 'services', 'testimonials', 'contact', 'footer'], desc: 'صفحهٔ تک‌برگ فروش با اقدام' },
  { id: 'gen-02', name: 'صفحهٔ ساده', profile: 'عمومی', blocks: ['hero', 'about', 'contact', 'footer'], desc: 'هیرو، درباره، تماس' },
  { id: 'gen-03', name: 'معرفی کسب‌وکار', profile: 'عمومی', blocks: ['hero', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام' },
  { id: 'gen-04', name: 'پرتال جستجو', profile: 'عمومی', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'gen-05', name: 'نمونه‌کار', profile: 'عمومی', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'gen-06', name: 'صفحهٔ کامل', profile: 'عمومی', blocks: ['hero', 'services', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات، تماس', blogPage: true },
  { id: 'gen-07', name: 'صفحهٔ شرکتی', profile: 'عمومی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },
  { id: 'gen-08', name: 'صفحهٔ رویداد', profile: 'عمومی', blocks: ['hero', 'about', 'gallery', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، گالری، اقدام، تماس' },
  { id: 'gen-09', name: 'صفحهٔ خدمات', profile: 'عمومی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'gen-10', name: 'صفحهٔ حرفه‌ای', profile: 'عمومی', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },
]

// ── سایتِ کامل (multi-page) — هر قالبِ اصلی یک وبسایتِ کامل با همهٔ صفحات می‌سازد ──
// متناسب با پروفایل، صفحاتِ عمومیِ آماده (درباره، فایل‌ها/پروژه‌ها/محصولات، خدمات،
// تیم، وبلاگ، تماس) با هیرو + محتوا + فوتر ساخته می‌شوند تا کاربر یک سایتِ کاملِ
// چندصفحه‌ای تحویل بگیرد، نه فقط یک صفحهٔ تک‌برگ.
interface PageSpec { slug: string; title: string; menuLabel: string; blocks: string[]; heroHeading: string; heroSub: string }
function profilePageSpec(profile: string): PageSpec[] {
  const about: PageSpec = { slug: 'about', title: 'درباره ما', menuLabel: 'درباره ما', blocks: ['hero', 'about', 'stats', 'cta', 'footer'], heroHeading: 'درباره ما', heroSub: 'با ما و مسیرِ حرفه‌ای‌مان بیشتر آشنا شوید' }
  const aboutTeam: PageSpec = { slug: 'about', title: 'درباره ما', menuLabel: 'درباره ما', blocks: ['hero', 'about', 'stats', 'team', 'cta', 'footer'], heroHeading: 'درباره ما', heroSub: 'تیمِ حرفه‌ای و ارزش‌هایِ ما' }
  const services: PageSpec = { slug: 'services', title: 'خدمات', menuLabel: 'خدمات', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], heroHeading: 'خدماتِ ما', heroSub: 'آنچه برای شما انجام می‌دهیم' }
  const blog: PageSpec = { slug: 'blog', title: 'وبلاگ', menuLabel: 'وبلاگ', blocks: ['blogfull', 'footer'], heroHeading: 'وبلاگ', heroSub: 'تازه‌ترین مقالات و اخبار' }
  const contact: PageSpec = { slug: 'contact', title: 'تماس با ما', menuLabel: 'تماس', blocks: ['hero', 'contact', 'footer'], heroHeading: 'تماس با ما', heroSub: 'برای مشاوره و هماهنگی با ما در ارتباط باشید' }
  const listings: PageSpec = { slug: 'listings', title: 'فایل‌ها', menuLabel: 'فایل‌ها', blocks: ['hero', 'searchlist', 'footer'], heroHeading: 'فایل‌های ملکی', heroSub: 'جدیدترین فایل‌های خرید، فروش و اجاره' }
  const team: PageSpec = { slug: 'team', title: 'تیم ما', menuLabel: 'تیم ما', blocks: ['hero', 'team', 'cta', 'footer'], heroHeading: 'تیمِ مشاوران', heroSub: 'با مشاورانِ خبرهٔ ما آشنا شوید' }
  const projects: PageSpec = { slug: 'projects', title: 'پروژه‌ها', menuLabel: 'پروژه‌ها', blocks: ['hero', 'gallery', 'stats', 'cta', 'footer'], heroHeading: 'پروژه‌های ما', heroSub: 'نمونه‌کارها و پروژه‌های در حالِ ساخت' }
  const products: PageSpec = { slug: 'products', title: 'محصولات', menuLabel: 'محصولات', blocks: ['hero', 'catalog', 'pricelist', 'footer'], heroHeading: 'محصولات', heroSub: 'کاتالوگِ کاملِ محصولاتِ ما' }
  const categories: PageSpec = { slug: 'prices', title: 'نرخِ روز', menuLabel: 'نرخِ روز', blocks: ['hero', 'pricelist', 'cta', 'footer'], heroHeading: 'نرخِ روزِ مصالح', heroSub: 'قیمتِ به‌روزِ محصولاتِ ما' }
  const opportunities: PageSpec = { slug: 'opportunities', title: 'فرصت‌ها', menuLabel: 'فرصت‌ها', blocks: ['hero', 'stats', 'searchlist', 'cta', 'footer'], heroHeading: 'فرصت‌های سرمایه‌گذاری', heroSub: 'بازده و فرصت‌هایِ منتخبِ ملکی' }
  switch (profile) {
    case 'مشاور': return [about, listings, services, blog, contact]
    case 'آژانس': return [aboutTeam, listings, services, team, blog, contact]
    case 'سازنده': return [about, projects, services, blog, contact]
    case 'فروشگاه': return [about, products, categories, blog, contact]
    case 'سرمایه‌گذار': return [about, opportunities, services, blog, contact]
    case 'حقوقی': return [about, services, blog, contact]
    default: return [about, services, blog, contact]
  }
}

// ── قالب‌های صفحه (per-page) — برای ساختِ صفحاتِ مختلف با دسته‌بندی ──────────────
// هر دسته‌بندی ≥۱۰ قالب دارد. هنگامِ «صفحهٔ جدید»، کاربر یکی را انتخاب می‌کند.
const PAGE_TEMPLATE_GROUPS: { key: string; label: string; icon: string; pageTitle: string; items: { name: string; blocks: string[] }[] }[] = [
  { key: 'home', label: 'صفحهٔ اصلی', icon: '⌂', pageTitle: 'صفحهٔ اصلی', items: [
    { name: 'هومِ کلاسیک', blocks: ['hero', 'search', 'listings', 'services', 'testimonials', 'footer'] },
    { name: 'هومِ مدرن', blocks: ['hero', 'stats', 'listings', 'about', 'cta', 'footer'] },
    { name: 'هومِ تصویری', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'] },
    { name: 'هومِ جستجو', blocks: ['hero', 'search', 'listings', 'cta', 'footer'] },
    { name: 'هومِ کامل', blocks: ['hero', 'services', 'stats', 'listings', 'team', 'testimonials', 'footer'] },
    { name: 'هومِ آژانس', blocks: ['hero', 'services', 'listings', 'team', 'contact', 'footer'] },
    { name: 'هومِ لوکس', blocks: ['hero', 'about', 'gallery', 'listings', 'cta', 'footer'] },
    { name: 'هومِ تک‌برگ', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'] },
    { name: 'هومِ فروش', blocks: ['hero', 'listings', 'stats', 'cta', 'contact', 'footer'] },
    { name: 'هومِ معرفی', blocks: ['hero', 'about', 'services', 'gallery', 'footer'] },
  ] },
  { key: 'about', label: 'دربارهٔ ما', icon: '¶', pageTitle: 'دربارهٔ ما', items: [
    { name: 'دربارهٔ ساده', blocks: ['hero', 'about', 'contact', 'footer'] },
    { name: 'دربارهٔ تیمی', blocks: ['hero', 'about', 'team', 'footer'] },
    { name: 'دربارهٔ آماری', blocks: ['hero', 'about', 'stats', 'testimonials', 'footer'] },
    { name: 'دربارهٔ کامل', blocks: ['hero', 'about', 'stats', 'team', 'services', 'footer'] },
    { name: 'دربارهٔ تصویری', blocks: ['hero', 'about', 'gallery', 'cta', 'footer'] },
    { name: 'دربارهٔ خدمات', blocks: ['hero', 'about', 'services', 'contact', 'footer'] },
    { name: 'دربارهٔ معتبر', blocks: ['hero', 'about', 'stats', 'testimonials', 'cta', 'footer'] },
    { name: 'دربارهٔ برند', blocks: ['about', 'gallery', 'team', 'contact', 'footer'] },
    { name: 'دربارهٔ لوکس', blocks: ['hero', 'about', 'services', 'gallery', 'testimonials', 'footer'] },
    { name: 'دربارهٔ تماس', blocks: ['hero', 'about', 'team', 'cta', 'contact', 'footer'] },
  ] },
  { key: 'contact', label: 'ارتباط با ما', icon: '✉', pageTitle: 'ارتباط با ما', items: [
    { name: 'تماسِ ساده', blocks: ['hero', 'contact', 'footer'] },
    { name: 'تماس و معرفی', blocks: ['hero', 'contact', 'about', 'footer'] },
    { name: 'تماس و خدمات', blocks: ['hero', 'services', 'contact', 'footer'] },
    { name: 'تماسِ کامل', blocks: ['hero', 'about', 'contact', 'cta', 'footer'] },
    { name: 'تماسِ سریع', blocks: ['contact', 'cta', 'footer'] },
    { name: 'تماس و تیم', blocks: ['hero', 'team', 'contact', 'footer'] },
    { name: 'تماس و آمار', blocks: ['hero', 'stats', 'contact', 'footer'] },
    { name: 'تماس و نظرات', blocks: ['hero', 'testimonials', 'contact', 'footer'] },
    { name: 'تماسِ حرفه‌ای', blocks: ['hero', 'services', 'about', 'contact', 'footer'] },
    { name: 'تماس و گالری', blocks: ['hero', 'gallery', 'contact', 'footer'] },
  ] },
  { key: 'blog', label: 'وبلاگ', icon: '🗞', pageTitle: 'وبلاگ', items: [
    { name: 'وبلاگِ کامل', blocks: ['blogfull', 'footer'] },
    { name: 'وبلاگ با هیرو', blocks: ['hero', 'blogfull', 'footer'] },
    { name: 'وبلاگ و خلاصه', blocks: ['hero', 'blog', 'blogfull', 'footer'] },
    { name: 'وبلاگِ مینیمال', blocks: ['blogfull'] },
    { name: 'وبلاگ و تماس', blocks: ['hero', 'blogfull', 'contact', 'footer'] },
    { name: 'وبلاگ و خبرنامه', blocks: ['hero', 'blogfull', 'cta', 'footer'] },
    { name: 'وبلاگِ تصویری', blocks: ['hero', 'gallery', 'blogfull', 'footer'] },
    { name: 'وبلاگ و خدمات', blocks: ['hero', 'blogfull', 'services', 'footer'] },
    { name: 'وبلاگِ مجله‌ای', blocks: ['blog', 'blogfull', 'cta', 'footer'] },
    { name: 'وبلاگ و درباره', blocks: ['hero', 'blogfull', 'about', 'footer'] },
  ] },
  { key: 'listings', label: 'آگهی‌ها', icon: '⌂', pageTitle: 'آگهی‌ها', items: [
    { name: 'آگهی‌هایِ کامل', blocks: ['hero', 'search', 'listings', 'footer'] },
    { name: 'آگهی با فیلتر', blocks: ['hero', 'search', 'listings', 'cta', 'footer'] },
    { name: 'آگهیِ ساده', blocks: ['hero', 'listings', 'footer'] },
    { name: 'آگهی و خدمات', blocks: ['hero', 'listings', 'services', 'contact', 'footer'] },
    { name: 'آگهی و آمار', blocks: ['hero', 'stats', 'listings', 'footer'] },
    { name: 'آگهی و تیم', blocks: ['hero', 'listings', 'team', 'contact', 'footer'] },
    { name: 'آگهیِ لوکس', blocks: ['hero', 'search', 'listings', 'testimonials', 'footer'] },
    { name: 'آگهی و درباره', blocks: ['hero', 'listings', 'about', 'cta', 'footer'] },
    { name: 'آگهیِ جامع', blocks: ['hero', 'search', 'listings', 'gallery', 'contact', 'footer'] },
    { name: 'آگهی و تماس', blocks: ['hero', 'listings', 'contact', 'footer'] },
  ] },
  { key: 'services', label: 'خدمات', icon: '◈', pageTitle: 'خدمات', items: [
    { name: 'خدماتِ ساده', blocks: ['hero', 'services', 'footer'] },
    { name: 'خدمات و آمار', blocks: ['hero', 'services', 'stats', 'footer'] },
    { name: 'خدماتِ کامل', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'] },
    { name: 'خدمات و اقدام', blocks: ['hero', 'services', 'cta', 'footer'] },
    { name: 'خدمات و گالری', blocks: ['hero', 'services', 'gallery', 'contact', 'footer'] },
    { name: 'خدمات و تیم', blocks: ['hero', 'services', 'team', 'footer'] },
    { name: 'خدماتِ حرفه‌ای', blocks: ['hero', 'services', 'stats', 'testimonials', 'cta', 'footer'] },
    { name: 'خدمات و تماس', blocks: ['hero', 'services', 'contact', 'footer'] },
    { name: 'خدماتِ لوکس', blocks: ['hero', 'about', 'services', 'gallery', 'footer'] },
    { name: 'خدمات و نظرات', blocks: ['hero', 'services', 'testimonials', 'footer'] },
  ] },
  { key: 'gallery', label: 'گالری و پروژه‌ها', icon: '▥', pageTitle: 'گالری', items: [
    { name: 'گالریِ ساده', blocks: ['hero', 'gallery', 'footer'] },
    { name: 'گالری و آمار', blocks: ['hero', 'gallery', 'stats', 'footer'] },
    { name: 'پروژه‌هایِ لوکس', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'] },
    { name: 'گالری و درباره', blocks: ['hero', 'about', 'gallery', 'cta', 'footer'] },
    { name: 'گالری و اقدام', blocks: ['hero', 'gallery', 'cta', 'footer'] },
    { name: 'گالری و تماس', blocks: ['hero', 'gallery', 'contact', 'footer'] },
    { name: 'گالریِ کامل', blocks: ['hero', 'gallery', 'stats', 'about', 'footer'] },
    { name: 'گالری و تیم', blocks: ['hero', 'gallery', 'team', 'contact', 'footer'] },
    { name: 'پروژه و خدمات', blocks: ['hero', 'gallery', 'services', 'cta', 'footer'] },
    { name: 'گالریِ معتبر', blocks: ['hero', 'stats', 'gallery', 'testimonials', 'footer'] },
  ] },
  { key: 'team', label: 'تیم و مشاوران', icon: '☺', pageTitle: 'تیمِ ما', items: [
    { name: 'تیمِ ساده', blocks: ['hero', 'team', 'footer'] },
    { name: 'تیم و درباره', blocks: ['hero', 'about', 'team', 'footer'] },
    { name: 'تیمِ کامل', blocks: ['hero', 'team', 'stats', 'testimonials', 'contact', 'footer'] },
    { name: 'تیم و خدمات', blocks: ['hero', 'team', 'services', 'footer'] },
    { name: 'تیم و تماس', blocks: ['hero', 'team', 'contact', 'footer'] },
    { name: 'تیمِ حرفه‌ای', blocks: ['hero', 'about', 'team', 'stats', 'cta', 'footer'] },
    { name: 'تیم و گالری', blocks: ['hero', 'team', 'gallery', 'footer'] },
    { name: 'تیم و نظرات', blocks: ['hero', 'team', 'testimonials', 'contact', 'footer'] },
    { name: 'تیمِ لوکس', blocks: ['hero', 'team', 'services', 'gallery', 'footer'] },
    { name: 'تیم و اقدام', blocks: ['hero', 'team', 'cta', 'contact', 'footer'] },
  ] },
]

let nextId = 1

// Deep-clone the defaults so each block owns its props (objects/arrays aren't shared).
function cloneDefaults(type: string): Record<string, any> {
  const d = BLOCK_DEFAULTS[type]
  if (!d) return { heading: type }
  return JSON.parse(JSON.stringify(d))
}

function makeBlock(type: string, preset?: Record<string, any>): Block {
  const props = cloneDefaults(type)
  if (preset) Object.assign(props, JSON.parse(JSON.stringify(preset)))
  return { id: nextId++, type, props }
}

// Migrate any legacy/stored block (top-level `heading` only, or already-rich
// props) into the current props shape, filling in any missing defaults.
function migrateBlock(b: any): Block {
  if (b && b.props && typeof b.props === 'object') {
    return { id: Number(b.id) || nextId++, type: String(b.type || ''), props: { ...cloneDefaults(b.type), ...b.props } }
  }
  const props = cloneDefaults(String(b?.type || ''))
  if (typeof b?.heading === 'string') props.heading = b.heading
  return { id: Number(b?.id) || nextId++, type: String(b?.type || ''), props }
}
// keep a reference so the migration helper is part of the module surface even
// when the builder boots from in-memory defaults.
void migrateBlock

// Real, props-driven render of a block — shared by canvas previews. The public
// page (app/[site]/page.tsx) mirrors this exact markup as a clean page.
type TeamMemberLite = { phone: string; name: string; photo: string; title: string; specialties: string[]; areas: string; experience: string; activeListings: number; slug: string }
type ArticleLite = { title: string; excerpt?: string; image?: string; category?: string; date?: string }

function BlockBody({ block, primary, myListings, myArticles, teamMembers }: { block: Block; primary: string; myListings?: { title: string; location?: string; price?: string; image?: string; category?: string }[]; myArticles?: ArticleLite[]; teamMembers?: TeamMemberLite[] }) {
  const p = block.props || {}
  const t = block.type
  const btn = (text: string) => (
    <span style={{ display: 'inline-block', padding: '9px 24px', background: primary, borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff' }}>{text}</span>
  )

  if (t === 'hero') {
    const align = p.align === 'right' ? 'right' : 'center'
    const imgs: string[] = Array.isArray(p.images) ? p.images.filter(Boolean) : []
    const slider = imgs.length > 1
    const firstImg = imgs[0] || p.image || ''
    const ov = p.overlay === 'none' ? 'rgba(0,0,0,0)' : p.overlay === 'light' ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.5)'
    const baseBg = firstImg
      ? `linear-gradient(${ov},${ov}), url(${firstImg}) center/cover`
      : (p.bg || `linear-gradient(140deg, ${primary}, #1a1510)`)
    const tall = p.height === 'tall'
    return (
      <div style={{ position: 'relative', background: baseBg, padding: tall ? '110px 28px' : '64px 28px', textAlign: align as any, direction: 'rtl', overflow: 'hidden' }}>
        {slider && <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 999, padding: '3px 10px' }}>⟳ اسلایدرِ {imgs.length.toLocaleString('fa-IR')} تصویری</span>}
        <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)', padding: '4px 12px', borderRadius: 999, marginBottom: 14 }}>املاک و مستغلات</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: p.textColor || '#fff', marginBottom: 10, letterSpacing: '-0.5px' }}>{p.heading}</div>
        <div style={{ fontSize: 14, color: p.textColor || '#fff', opacity: 0.82, marginBottom: 22, maxWidth: 520, marginInline: align === 'center' ? 'auto' : undefined }}>{p.subheading}</div>
        {p.buttonText ? btn(p.buttonText) : null}
      </div>
    )
  }
  if (t === 'search') {
    return (
      <div style={{ background: '#f5f3ef', padding: '24px 28px', direction: 'rtl' }}>
        {p.heading ? <div style={{ fontSize: 15, fontWeight: 700, color: '#2a2215', marginBottom: 14 }}>{p.heading}</div> : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, height: 42, background: '#fff', border: '1px solid #ddd', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
            <span style={{ fontSize: 13, color: '#aaa' }}>{p.placeholder}</span>
          </div>
          <div style={{ padding: '0 22px', height: 42, background: primary, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>جستجو</span>
          </div>
        </div>
      </div>
    )
  }
  if (t === 'searchlist') {
    const grads = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']
    const real = myListings || []
    const cards = (real.length ? real.slice(0, 6) : Array.from({ length: 6 }).map(() => null)) as ({ title?: string; location?: string; price?: string; image?: string } | null)[]
    return (
      <div style={{ background: '#faf9f7', padding: '24px 28px', direction: 'rtl' }}>
        {p.heading ? <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 14 }}>{p.heading}</div> : null}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 40, background: '#fff', border: '1px solid #e6ddcd', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 12px' }}><span style={{ fontSize: 12.5, color: '#aaa' }}>جستجو در عنوان، موقعیت، نوع ملک…</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {['همهٔ معاملات', 'نوع ملک', 'شهر', 'محله', 'تعداد خواب', 'مرتب‌سازی'].map(f => <div key={f} style={{ fontSize: 11.5, color: '#666', background: '#fff', border: '1px solid #e6ddcd', borderRadius: 8, padding: '7px 12px' }}>{f} ▾</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 8px 22px -16px rgba(0,0,0,.5)' }}>
              <div style={{ height: 80, background: c?.image ? `center/cover no-repeat url(${c.image})` : `linear-gradient(135deg,${grads[i % grads.length]})` }} />
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1510', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.title || 'عنوان آگهی'}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{c?.location || 'موقعیت'}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: primary, marginTop: 6 }}>{c?.price || 'قیمت'}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: primary, marginTop: 10 }}>{real.length ? `🔍 صفحهٔ کاملِ جستجو و فیلتر — ${real.length.toLocaleString('fa-IR')} آگهیِ منتشرشدهٔ شما` : '🔍 صفحهٔ کاملِ جستجو و فیلترِ آگهی‌ها — آگهی‌های منتشرشدهٔ شما اینجا با فیلتر نمایش داده می‌شوند.'}</div>
      </div>
    )
  }
  if (t === 'listings') {
    const total = Math.max(1, Math.min(24, Number(p.total) || Number(p.count) || 9))
    const perSlide = Math.max(1, Math.min(5, Number(p.perSlide) || 3))
    const showCats = p.showCategories !== 'no'
    const grads = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']
    const mine = p.source !== 'sample'   // پیش‌فرض «آگهی‌های من»
    const real = mine ? (myListings || []).slice(0, total) : []
    const cats = Array.from(new Set((mine ? real : []).map(it => it.category).filter(Boolean))) as string[]
    const cards = mine && real.length
      ? real.map((it, i) => ({ title: it.title, location: it.location || 'موقعیت نامشخص', price: it.price || 'قیمت توافقی', image: it.image, grad: grads[i % grads.length] }))
      : Array.from({ length: Math.max(perSlide + 1, 4) }).map((_, i) => ({ title: 'آپارتمان لوکس', location: 'تهران، منطقه نمونه', price: 'قیمت توافقی', image: undefined as string | undefined, grad: grads[i % grads.length] }))
    const cardW = `calc((100% - ${(perSlide - 1) * 12}px) / ${perSlide})`
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510' }}>{p.heading}</div>
          <span style={{ fontSize: 10.5, color: '#aaa' }}>اسلایدر · {perSlide.toLocaleString('fa-IR')} در هر نما</span>
        </div>
        {mine ? <div style={{ fontSize: 11, color: primary, marginBottom: 10 }}>↻ آگهی‌های واقعیِ ثبت‌شدهٔ شما{real.length ? '' : ' (هنوز آگهی منتشرشده‌ای ندارید)'}</div> : null}
        {showCats && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: primary, borderRadius: 999, padding: '4px 12px' }}>همه</span>
            {(cats.length ? cats : (mine ? [] : ['آپارتمان', 'ویلا', 'تجاری'])).slice(0, 6).map(c => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, color: '#555', background: '#f3f1ec', border: '1px solid #e6e2d8', borderRadius: 999, padding: '4px 12px' }}>{c}</span>
            ))}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
            {cards.map((it, i) => (
              <div key={i} style={{ flex: `0 0 ${cardW}`, minWidth: 130, background: '#f5f3ef', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee' }}>
                {it.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.image} alt="" style={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }} />
                  : <div style={{ height: 84, background: `linear-gradient(135deg,${it.grad})` }} />}
                <div style={{ padding: '11px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1510', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                  <div style={{ fontSize: 10.5, color: '#888', marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.location}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: primary }}>{it.price}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
            {Array.from({ length: Math.max(1, Math.ceil(cards.length / perSlide)) }).slice(0, 6).map((_, i) => <span key={i} style={{ width: i === 0 ? 16 : 6, height: 6, borderRadius: 999, background: i === 0 ? primary : '#ddd' }} />)}
          </div>
        </div>
      </div>
    )
  }
  if (t === 'blog') {
    const n = Math.max(1, Math.min(12, Number(p.count) || 3))
    const grads = ['#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d2215,#1e1a12', '#2d1515,#1e0e0e', '#1e2215,#141a10']
    const real = (myArticles || []).slice(0, n)
    const cards = real.length ? real : Array.from({ length: n }).map(() => null)
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 16 }}>{p.heading}</div>
        {real.length ? <div style={{ fontSize: 11, color: primary, marginBottom: 12 }}>✎ {real.length.toLocaleString('fa-IR')} مقالهٔ منتشرشدهٔ شما</div> : <div style={{ fontSize: 11, color: primary, marginBottom: 12 }}>✎ مقالات منتشرشدهٔ شما اینجا نمایش داده می‌شوند</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {cards.map((a, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 8px 22px -16px rgba(0,0,0,.5)' }}>
              <div style={{ height: 92, background: a?.image ? `center/cover no-repeat url(${a.image})` : `linear-gradient(135deg,${grads[i % grads.length]})`, position: 'relative' }}>
                {(a?.category || !a) && <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, fontSize: 9.5, fontWeight: 700, color: '#fff', background: primary, borderRadius: 999, padding: '2px 9px' }}>{a?.category || 'دسته'}</span>}
              </div>
              <div style={{ padding: '13px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1510', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a?.title || 'عنوان مقاله'}</div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8, marginBottom: 9, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a?.excerpt || 'خلاصه‌ای کوتاه از مقاله…'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: primary }}>ادامه →</span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>{a?.date || '۱۴۰۴/۰۱/۰۱'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (t === 'blogfull') {
    const withSidebar = p.sidebar !== 'no'
    return (
      <div style={{ background: '#faf9f7', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1510', marginBottom: 4 }}>{p.heading || 'وبلاگ'}</div>
        <div style={{ height: 4, width: 48, borderRadius: 999, background: primary, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 16, flexDirection: 'row-reverse' }}>
          {withSidebar && (
            <div style={{ flex: '0 0 150px' }}>
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ height: 9, background: '#eee', borderRadius: 5, marginBottom: 8 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 }}>دسته‌بندی‌ها</div>
                {['همه', 'خرید', 'فروش', 'اجاره'].map((c, i) => <div key={c} style={{ fontSize: 11, color: i === 0 ? primary : '#888', fontWeight: i === 0 ? 700 : 500, padding: '4px 0', borderBottom: '1px solid #f3f1ec' }}>{c}</div>)}
              </div>
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 }}>آخرین مطالب</div>
                {[0, 1, 2].map(i => <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 8 }}><div style={{ width: 30, height: 30, borderRadius: 6, background: `linear-gradient(135deg,${primary},#1a1510)`, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ height: 5, background: '#e7e7ea', borderRadius: 3, marginBottom: 4 }} /><div style={{ height: 4, width: '60%', background: '#f0f0f2', borderRadius: 3 }} /></div></div>)}
              </div>
            </div>
          )}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {(((myArticles || []).length ? (myArticles || []).slice(0, 6) : Array.from({ length: 4 }).map(() => null)) as (ArticleLite | null)[]).map((a, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 22px -16px rgba(0,0,0,.5)' }}>
                <div style={{ height: 74, background: a?.image ? `center/cover no-repeat url(${a.image})` : `linear-gradient(135deg,#2d2215,#1a1510)` }} />
                <div style={{ padding: 11 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1a1510', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a?.title || 'عنوان مقاله'}</div>
                  <div style={{ fontSize: 10.5, color: '#888', lineHeight: 1.7, marginBottom: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a?.excerpt || 'خلاصه‌ای کوتاه…'}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: primary }}>ادامه →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: primary, marginTop: 12 }}>{(myArticles || []).length ? `✎ ${(myArticles || []).length.toLocaleString('fa-IR')} مقالهٔ منتشرشدهٔ شما در این صفحه نمایش داده می‌شود.` : '✎ صفحهٔ کاملِ وبلاگ با فیلتر و ساید‌بار — مقالاتِ منتشرشدهٔ شما هنگامِ انتشار نمایش داده می‌شوند.'}</div>
      </div>
    )
  }
  if (t === 'services') {
    const items: any[] = Array.isArray(p.items) ? p.items : []
    return (
      <div style={{ background: '#faf9f7', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 16, textAlign: 'center' }}>{p.heading}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length || 1, 4)},1fr)`, gap: 12 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '18px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8, color: primary }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1510', marginBottom: 5 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.7 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (t === 'about') {
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl', display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 12 }}>{p.heading}</div>
          <p style={{ fontSize: 13, lineHeight: 2, color: '#555', margin: 0 }}>{p.text}</p>
        </div>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" style={{ flex: '0 0 200px', width: 200, height: 150, objectFit: 'cover', borderRadius: 12 }} />
        ) : (
          <div style={{ flex: '0 0 200px', width: 200, height: 150, background: 'linear-gradient(135deg,#2d2215,#1a1510)', borderRadius: 12 }} />
        )}
      </div>
    )
  }
  if (t === 'team') {
    const showSites = p.showSites !== 'no'
    const showPhone = p.showPhone !== 'no'
    const sel: string[] | null = Array.isArray(p.members) ? p.members : null
    let people = (teamMembers || [])
    if (sel) people = people.filter(m => sel.includes(m.phone))
    return (
      <div style={{ background: '#faf9f7', padding: '44px 28px', direction: 'rtl', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1510', marginBottom: 6 }}>{p.heading || 'مشاوران ما'}</div>
        <div style={{ height: 4, width: 50, borderRadius: 999, background: primary, margin: '0 auto 8px' }} />
        {p.subheading ? <div style={{ fontSize: 13.5, color: '#888', marginBottom: 24 }}>{p.subheading}</div> : <div style={{ height: 16 }} />}
        {people.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #ddd', borderRadius: 16, padding: '34px 20px', color: '#999', fontSize: 13.5, maxWidth: 460, margin: '0 auto', lineHeight: 1.9 }}>
            مشاورانِ عضوِ آژانسِ شما این‌جا نمایش داده می‌شوند.<br />
            <span style={{ fontSize: 12 }}>برای افزودنِ مشاور، از پنل «مشاوران/آژانسِ من» دعوت کنید.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
            {people.slice(0, 4).map(m => {
              const chips = (m.specialties || []).slice(0, 2)
              const rows: [string, string][] = []
              if (m.areas) rows.push(['📍', m.areas])
              if (m.experience) rows.push(['⏳', m.experience])
              if (m.activeListings > 0) rows.push(['🏠', `${m.activeListings.toLocaleString('fa-IR')} آگهی`])
              return (
                <div key={m.phone} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 18, width: 210, boxShadow: '0 10px 28px -18px rgba(0,0,0,.5)', overflow: 'hidden', textAlign: 'center' }}>
                  <div style={{ height: 56, background: `linear-gradient(135deg,${primary},#1a1510)` }} />
                  <div style={{ padding: '0 14px 16px', marginTop: -40 }}>
                    {m.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photo} alt={m.name} style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: `0 0 0 2px ${primary}` }} />
                      : <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${primary}22`, color: primary, fontSize: 28, fontWeight: 900, border: '3px solid #fff', boxShadow: `0 0 0 2px ${primary}` }}>{(m.name || '?').trim().charAt(0)}</div>}
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1510', marginTop: 10 }}>{m.name}</div>
                    {m.title ? <div style={{ fontSize: 11.5, color: primary, fontWeight: 700, marginTop: 3 }}>{m.title}</div> : null}
                    {chips.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 9 }}>{chips.map((s, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, color: primary, background: `${primary}14`, border: `1px solid ${primary}30`, borderRadius: 999, padding: '2px 8px' }}>{s}</span>)}</div>}
                    {rows.length > 0 && <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>{rows.map(([ic, v], i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555', background: '#faf9f7', borderRadius: 8, padding: '4px 8px' }}><span>{ic}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span></div>)}</div>}
                    {(showSites && m.slug) || (showPhone && m.phone) ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                        {showSites && m.slug ? <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: '#fff', background: primary, borderRadius: 9, padding: '7px 6px' }}>وب‌سایت ↗</span> : null}
                        {showPhone && m.phone ? <span style={{ flex: showSites && m.slug ? '0 0 auto' : 1, fontSize: 11.5, fontWeight: 700, color: primary, background: `${primary}12`, border: `1px solid ${primary}30`, borderRadius: 9, padding: '7px 12px' }}>☎ تماس</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  if (t === 'stats') {
    const items: any[] = Array.isArray(p.items) ? p.items : []
    return (
      <div style={{ background: '#f5f3ef', padding: '28px', direction: 'rtl' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length || 1, 4)},1fr)`, gap: 12 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '18px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: primary, marginBottom: 5 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (t === 'gallery') {
    const total = Math.max(1, Math.min(40, Number(p.total) || 9))
    const perSlide = Math.max(1, Math.min(6, Number(p.perSlide) || 3))
    const imgs: string[] = (Array.isArray(p.images) ? p.images.filter(Boolean) : []).slice(0, total)
    const cells = imgs.length ? imgs : ['', '', '', '']
    const cardW = `calc((100% - ${(perSlide - 1) * 10}px) / ${perSlide})`
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510' }}>{p.heading}</div>
          <span style={{ fontSize: 10.5, color: '#aaa' }}>اسلایدر · {perSlide.toLocaleString('fa-IR')} در هر نما</span>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
          {cells.map((src, i) => (
            <div key={i} style={{ flex: `0 0 ${cardW}`, minWidth: 110 }}>
              {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                : <div style={{ height: 110, background: `linear-gradient(135deg,${primary},#1a1510)`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 22, color: 'rgba(255,255,255,0.22)' }}>▥</span></div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {Array.from({ length: Math.max(1, Math.ceil(cells.length / perSlide)) }).slice(0, 6).map((_, i) => <span key={i} style={{ width: i === 0 ? 16 : 6, height: 6, borderRadius: 999, background: i === 0 ? primary : '#ddd' }} />)}
        </div>
      </div>
    )
  }
  if (t === 'testimonials') {
    const items: any[] = Array.isArray(p.items) ? p.items : []
    const showReal = p.showReal !== 'no'
    const allowSubmit = p.allowSubmit !== 'no'
    return (
      <div style={{ background: '#faf9f7', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: showReal ? 4 : 16, textAlign: 'center' }}>{p.heading}</div>
        {showReal ? <div style={{ fontSize: 11, color: primary, textAlign: 'center', marginBottom: 16 }}>★ نظراتِ واقعیِ ثبت‌شدهٔ مشتریان هم این‌جا نمایش داده می‌شوند</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '16px' }}>
              <div style={{ color: primary, marginBottom: 8, fontSize: 14 }}>{'★'.repeat(Math.max(0, Math.min(5, Number(s.rating) || 5)))}</div>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.9, margin: '0 0 10px' }}>{s.text}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: `${primary}22`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{(s.name || '?').charAt(0)}</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1510' }}>{s.name}</div>
              </div>
            </div>
          ))}
        </div>
        {allowSubmit && (
          <div style={{ marginTop: 16, background: '#fff', border: `1px dashed ${primary}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1510', marginBottom: 8 }}>ثبتِ نظرِ شما</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 30, background: '#f4f3ef', borderRadius: 7 }} />
              <div style={{ color: primary, fontSize: 15, alignSelf: 'center' }}>★★★★★</div>
            </div>
            <div style={{ height: 44, background: '#f4f3ef', borderRadius: 7, marginBottom: 8 }} />
            <div style={{ display: 'inline-block', padding: '7px 18px', background: primary, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>ارسالِ نظر</div>
          </div>
        )}
      </div>
    )
  }
  if (t === 'cta') {
    return (
      <div style={{ background: p.bg || 'linear-gradient(135deg,#2d2215,#1a1510)', padding: '40px 28px', textAlign: 'center', direction: 'rtl' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{p.heading}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{p.subheading}</div>
        {p.buttonText ? btn(p.buttonText) : null}
      </div>
    )
  }
  if (t === 'contact') {
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 16 }}>{p.heading}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {p.phone ? <div style={{ fontSize: 13, color: '#555' }}>☏ {p.phone}</div> : null}
          {p.email ? <div style={{ fontSize: 13, color: '#555', direction: 'ltr', textAlign: 'right' }}>✉ {p.email}</div> : null}
          {p.address ? <div style={{ fontSize: 13, color: '#555' }}>⌂ {p.address}</div> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ height: 38, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7 }} />
          <div style={{ height: 38, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7 }} />
        </div>
        <div style={{ height: 70, background: '#f5f3ef', border: '1px solid #ddd', borderRadius: 7, marginBottom: 10 }} />
        {btn('ارسال پیام')}
      </div>
    )
  }
  if (t === 'footer') {
    const links: any[] = Array.isArray(p.links) ? p.links : []
    const brand = p.brand || p.text || 'برندِ شما'
    const socials: [string, string][] = [['IG', p.instagram], ['TG', p.telegram], ['WA', p.whatsapp], ['in', p.linkedin]].filter(x => x[1]) as [string, string][]
    const contacts: [string, string][] = [['☎', p.phone], ['✉', p.email], ['📍', p.address]].filter(x => x[1]) as [string, string][]
    return (
      <div style={{ background: '#0d0b08', padding: '28px', direction: 'rtl', color: '#aaa' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: primary, marginBottom: 8 }}>{brand}</div>
            <div style={{ fontSize: 11.5, color: '#888', lineHeight: 1.9 }}>{p.about || 'معرفیِ کوتاهِ کسب‌وکار.'}</div>
            {socials.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>{socials.map(([g], i) => <span key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1712', color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{g}</span>)}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ddd', marginBottom: 10 }}>لینک‌های سریع</div>
            {links.length ? links.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{l.label}</div>) : <div style={{ fontSize: 11, color: '#555' }}>—</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ddd', marginBottom: 10 }}>تماس</div>
            {contacts.length ? contacts.map(([ic, v], i) => <div key={i} style={{ fontSize: 11.5, color: '#888', marginBottom: 6, display: 'flex', gap: 6, direction: ic === '☎' || ic === '✉' ? 'ltr' as const : 'rtl' as const, justifyContent: 'flex-end' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span><span>{ic}</span></div>) : <div style={{ fontSize: 11, color: '#555' }}>—</div>}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1f1a14', paddingTop: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: '#555' }}>{p.copyright || '© ۱۴۰۴ — تمامی حقوق محفوظ است'}</span>
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', padding: '24px', direction: 'rtl' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1510' }}>{p.heading || t}</div>
    </div>
  )
}

function BlockPreview({ block, primary, selected, onSelect, onUp, onDown, onDelete, myListings, myArticles, teamMembers, enableDrag, isDragging, isDragOver, onDragStartBlock, onDragEnterBlock, onDropBlock, onDragEndBlock, bigControls }: {
  block: Block
  primary: string
  selected: boolean
  onSelect: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  myArticles?: ArticleLite[]
  myListings?: { title: string; location?: string; price?: string; image?: string; category?: string }[]
  teamMembers?: TeamMemberLite[]
  enableDrag?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStartBlock?: () => void
  onDragEnterBlock?: () => void
  onDropBlock?: () => void
  onDragEndBlock?: () => void
  bigControls?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const showControls = hovered || selected
  const btn = bigControls ? 30 : 22
  const ctrlBtn: React.CSSProperties = { width: btn, height: btn, borderRadius: 6, border: 'none', color: '#fff', cursor: 'pointer', fontSize: bigControls ? 14 : 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <div
      className="mjwb-blockwrap"
      draggable={enableDrag}
      onDragStart={e => { if (!enableDrag) return; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(block.id)) } catch {}; onDragStartBlock?.() }}
      onDragOver={e => { if (enableDrag) e.preventDefault() }}
      onDragEnter={e => { if (!enableDrag) return; e.preventDefault(); onDragEnterBlock?.() }}
      onDrop={e => { if (!enableDrag) return; e.preventDefault(); onDropBlock?.() }}
      onDragEnd={() => onDragEndBlock?.()}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        border: selected ? '2px solid var(--gold)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'border-color .15s, box-shadow .12s, opacity .12s',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isDragOver ? 'inset 0 4px 0 0 var(--gold)' : 'none',
      }}
    >
      {showControls && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center',
          background: selected ? 'var(--gold)' : 'rgba(0,0,0,0.78)',
          padding: bigControls ? '6px 10px' : '4px 10px', gap: 6,
        }}>
          {enableDrag && <span title="برای جابه‌جایی بکشید" style={{ cursor: 'grab', color: selected ? '#16140f' : '#fff', fontSize: 14, lineHeight: 1, opacity: 0.8, flexShrink: 0 }}>⠿</span>}
          <span style={{ fontSize: bigControls ? 12.5 : 11, fontWeight: 700, color: selected ? '#16140f' : '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {BLOCK_LIBRARY.find(b => b.type === block.type)?.label || block.type}
          </span>
          <button title="بالا" onClick={e => { e.stopPropagation(); onUp() }} style={{ ...ctrlBtn, background: 'rgba(255,255,255,0.22)' }}>▲</button>
          <button title="پایین" onClick={e => { e.stopPropagation(); onDown() }} style={{ ...ctrlBtn, background: 'rgba(255,255,255,0.22)' }}>▼</button>
          <button title="حذف" onClick={e => { e.stopPropagation(); onDelete() }} style={{ ...ctrlBtn, background: 'rgba(220,60,60,0.6)' }}>×</button>
        </div>
      )}
      <BlockBody block={block} primary={primary} myListings={myListings} myArticles={myArticles} teamMembers={teamMembers} />
    </div>
  )
}

// پیش‌نمای مینیاتوری و حرفه‌ای یک قالب: یک ماکت واقعی از سایت بر اساس بلوک‌هایش
function TemplateThumb({ tpl }: { tpl: typeof STARTER_TEMPLATES[0] }) {
  const pal = templatePalette(tpl)
  const v = { grad: `linear-gradient(135deg, ${pal.primary}, ${pal.secondary} 72%)`, primary: pal.primary, bg: pal.bg, surface: pal.surface }
  const block = (b: string, i: number) => {
    switch (b) {
      case 'hero': return <div key={i} style={{ background: v.grad, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <div style={{ height: 6, width: '58%', background: 'rgba(255,255,255,.95)', borderRadius: 3 }} />
        <div style={{ height: 4, width: '42%', background: 'rgba(255,255,255,.6)', borderRadius: 2 }} />
        <div style={{ height: 10, width: '26%', background: '#fff', borderRadius: 5, marginTop: 4 }} />
      </div>
      case 'search': return <div key={i} style={{ padding: '9px 12px', background: '#fff' }}><div style={{ height: 11, background: '#f0f0f2', border: '1px solid #e4e4e7', borderRadius: 6 }} /></div>
      case 'catalog': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>{[0, 1, 2, 3, 4, 5].map(k => <div key={k}><div style={{ height: 20, background: `${v.primary}22`, borderRadius: 4, marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>🧱</div><div style={{ height: 3, width: '75%', background: '#dcdce0', borderRadius: 2, marginBottom: 2 }} /><div style={{ height: 3, width: '45%', background: v.primary, borderRadius: 2, opacity: .8 }} /></div>)}</div>
      case 'pricelist': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7' }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: k ? '1px solid #eee' : 'none' }}><div style={{ height: 3, width: '40%', background: '#d5d5da', borderRadius: 2 }} /><div style={{ height: 4, width: '22%', background: v.primary, borderRadius: 2, opacity: .8 }} /></div>)}</div>
      case 'listings': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', gap: 6 }}>{[0, 1, 2].map(k => <div key={k} style={{ flex: 1 }}><div style={{ height: 24, background: '#e7e7ea', borderRadius: 4, marginBottom: 4 }} /><div style={{ height: 3, width: '80%', background: '#dcdce0', borderRadius: 2, marginBottom: 3 }} /><div style={{ height: 3, width: '55%', background: '#e6e6ea', borderRadius: 2 }} /></div>)}</div>
      case 'gallery': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ height: 22, background: '#e3e3e7', borderRadius: 3 }} />)}</div>
      case 'services': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7', display: 'flex', gap: 6 }}>{[0, 1, 2].map(k => <div key={k} style={{ flex: 1, padding: 7, background: '#fff', border: '1px solid #eee', borderRadius: 5, textAlign: 'center' }}><div style={{ width: 11, height: 11, borderRadius: 3, background: v.primary, margin: '0 auto 5px' }} /><div style={{ height: 3, width: '70%', background: '#ddd', borderRadius: 2, margin: '0 auto' }} /></div>)}</div>
      case 'stats': return <div key={i} style={{ padding: '11px 12px', background: '#f5f4f1', display: 'flex', justifyContent: 'space-around' }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ textAlign: 'center' }}><div style={{ height: 8, width: 20, background: v.primary, borderRadius: 2, marginBottom: 3 }} /><div style={{ height: 3, width: 26, background: '#ccc', borderRadius: 2 }} /></div>)}</div>
      case 'about': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>{[90, 80, 70, 50].map((w, k) => <div key={k} style={{ height: 3, width: `${w}%`, background: '#dcdce0', borderRadius: 2 }} />)}</div><div style={{ width: 44, height: 34, background: '#e7e7ea', borderRadius: 5 }} /></div>
      case 'team': return <div key={i} style={{ padding: '10px 12px', background: '#fff', display: 'flex', gap: 10, justifyContent: 'center' }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e3e3e7', border: `1.5px solid ${v.primary}` }} /><div style={{ height: 3, width: 22, background: '#dcdce0', borderRadius: 2 }} /><div style={{ height: 2.5, width: 16, background: v.primary, borderRadius: 2, opacity: .7 }} /></div>)}</div>
      case 'testimonials': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7' }}><div style={{ padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 6 }}>{[85, 65].map((w, k) => <div key={k} style={{ height: 3, width: `${w}%`, background: '#dadade', borderRadius: 2, marginBottom: 4 }} />)}<div style={{ height: 6, width: 28, background: '#e3e3e7', borderRadius: 3, marginTop: 5 }} /></div></div>
      case 'cta': return <div key={i} style={{ padding: '14px 12px', background: v.grad, display: 'flex', justifyContent: 'center' }}><div style={{ height: 10, width: '32%', background: '#fff', borderRadius: 5 }} /></div>
      case 'contact': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 5 }}>{[100, 100, 60].map((w, k) => <div key={k} style={{ height: 9, width: `${w}%`, background: '#f1f1f3', border: '1px solid #e6e6e6', borderRadius: 3 }} />)}</div>
      case 'blog': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', gap: 6 }}>{[0, 1, 2].map(k => <div key={k} style={{ flex: 1 }}><div style={{ height: 20, background: '#e7e7ea', borderRadius: 4, marginBottom: 4 }} /><div style={{ height: 3, width: '85%', background: '#dcdce0', borderRadius: 2, marginBottom: 3 }} /><div style={{ height: 3, width: '60%', background: '#ededf0', borderRadius: 2 }} /></div>)}</div>
      case 'blogfull': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7', display: 'flex', gap: 6, flexDirection: 'row-reverse' }}><div style={{ flex: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 3 }}>{[0, 1, 2].map(k => <div key={k} style={{ height: 4, background: k === 0 ? v.primary : '#e0e0e4', borderRadius: 2 }} />)}</div><div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>{[0, 1, 2, 3].map(k => <div key={k}><div style={{ height: 16, background: '#e7e7ea', borderRadius: 3, marginBottom: 2 }} /><div style={{ height: 2.5, width: '80%', background: '#dcdce0', borderRadius: 2 }} /></div>)}</div></div>
      case 'footer': return <div key={i} style={{ padding: '11px 12px', background: '#1a1a1f', display: 'flex', justifyContent: 'space-between' }}>{[0, 1, 2].map(k => <div key={k} style={{ height: 3, width: 32, background: '#3a3a42', borderRadius: 2 }} />)}</div>
      default: return null
    }
  }
  return (
    <div style={{ background: '#fff', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--line)' }}>
      <div style={{ height: 16, background: '#ececef', display: 'flex', alignItems: 'center', gap: 4, padding: '0 7px' }}>
        {['#f25f57', '#fabc2e', '#2aca44'].map(c => <span key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}
      </div>
      <div style={{ maxHeight: 220, overflow: 'hidden' }}>{tpl.blocks.map((b, i) => block(b, i))}</div>
    </div>
  )
}

// مدیریتِ نظراتِ واقعیِ ثبت‌شده روی سایت — تأیید/عدم‌نمایش/حذف.
function ReviewsManager() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); fetch('/api/reviews').then(r => r.ok ? r.json() : null).then(d => setReviews(Array.isArray(d?.reviews) ? d.reviews : [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const patch = async (body: any) => { await fetch('/api/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); load() }
  const fa = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>نظراتِ ثبت‌شده ({fa(reviews.length)})</div>
        <button onClick={load} style={{ fontSize: 11, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>↻ بازخوانی</button>
      </div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: 14, textAlign: 'center' }}>در حال بارگذاری…</div>
        : reviews.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 10, padding: '20px 14px', textAlign: 'center', lineHeight: 1.9 }}>هنوز نظری ثبت نشده است. وقتی بازدیدکننده‌ها از طریقِ بلوکِ «نظرات مشتریان» نظر ثبت کنند، این‌جا برای مدیریت نمایش داده می‌شوند.</div>
        : reviews.map(r => (
          <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${r.approved ? 'var(--line)' : 'rgba(231,137,74,.4)'}`, borderRadius: 10, padding: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{r.name}</span>
              <span style={{ color: 'var(--gold)', fontSize: 12 }}>{'★'.repeat(Math.max(0, Math.min(5, Number(r.rating) || 5)))}</span>
              <span style={{ marginInlineStart: 'auto', fontSize: 10, fontWeight: 700, color: r.approved ? '#5fd98a' : '#e7894a' }}>{r.approved ? 'نمایش' : (r.moderated ? 'ردِ هوش مصنوعی' : 'در انتظارِ بررسی')}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.9, marginBottom: r.reason ? 6 : 9 }}>{r.text}</div>
            {r.reason ? <div style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg2)', borderRadius: 6, padding: '5px 8px', marginBottom: 9 }}>🤖 {r.reason}</div> : null}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => patch({ id: r.id, approved: !r.approved })} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: '6px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)' }}>{r.approved ? '🚫 مخفی کن' : '✓ نمایش بده'}</button>
              <button onClick={() => { if (confirm('این نظر حذف شود؟')) patch({ id: r.id, delete: true }) }} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(231,103,74,.4)', background: 'transparent', color: '#e7674a' }}>حذف</button>
            </div>
          </div>
        ))}
    </div>
  )
}

export default function WebsiteBuilderTool({ embedded = false, view: viewProp, onView }: { embedded?: boolean; view?: WebsiteView; onView?: (v: WebsiteView) => void }) {
  // Default to 'editor' so standalone /website-builder stays pixel-identical (always the builder).
  const [internalView, setInternalView] = useState<WebsiteView>('editor')
  const activeView: WebsiteView = viewProp ?? internalView
  const setActiveView = (v: WebsiteView) => { onView ? onView(v) : setInternalView(v) }

  // REAL pages: the editor edits the ACTIVE page's blocks. pages[0] is home.
  const [pages, setPages] = useState<Page[]>([
    { slug: 'home', title: 'صفحه اصلی', blocks: [makeBlock('hero'), makeBlock('search'), makeBlock('listings')] },
  ])
  const [activePage, setActivePage] = useState(0)

  // `blocks` / `setBlocks` reflect & write the ACTIVE page, so every block op
  // (add/select/inspector/reorder/delete/template) applies to it transparently.
  const blocks: Block[] = pages[activePage]?.blocks ?? []
  const setBlocks = (updater: Block[] | ((prev: Block[]) => Block[])) => {
    setPages(prev => prev.map((pg, i) => i === activePage
      ? { ...pg, blocks: typeof updater === 'function' ? (updater as (p: Block[]) => Block[])(pg.blocks) : updater }
      : pg))
  }
  const [ownerName, setOwnerName] = useState('')
  const [myListings, setMyListings] = useState<{ title: string; location?: string; price?: string; image?: string; category?: string }[]>([])
  const [myArticles, setMyArticles] = useState<ArticleLite[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([])
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [tplFilter, setTplFilter] = useState('عمومی')
  // پروفایل قفل‌شده بر اساس نقش کاربر؛ null یعنی مهمان/ادمین (می‌تواند همه را ببیند)
  const [lockedProfile, setLockedProfile] = useState<string | null>(null)
  const [tplModal, setTplModal] = useState(false)
  const [pageTplModal, setPageTplModal] = useState(false)
  const [pageTplGroup, setPageTplGroup] = useState(PAGE_TEMPLATE_GROUPS[0].key)
  const [device, setDevice] = useState<Device>('desktop')
  const [activeTab, setActiveTab] = useState<ActiveTab>('seo')
  const [seoTitle, setSeoTitle] = useState('آژانس ملکی نمونه | خرید و فروش ملک')
  const [seoDesc, setSeoDesc] = useState('بهترین آژانس ملکی در تهران با بیش از ۱۰ سال سابقه. خرید، فروش و اجاره ملک با مشاوره رایگان.')
  const [slug, setSlug] = useState('agency-sample')
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [publishedSlug, setPublishedSlug] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [history, setHistory] = useState<Block[][]>([])
  const [theme, setTheme] = useState<Theme>({ ...DEFAULT_THEME })
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  // کشیدن‌ورها کردنِ بلوک‌ها (دسکتاپ) + شیت‌های موبایل + کشیدنِ کارت‌های فهرست
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<'none' | 'lib' | 'insp'>('none')
  const [listDrag, setListDrag] = useState<{ key: string; idx: number } | null>(null)
  const [listDragOver, setListDragOver] = useState<{ key: string; idx: number } | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 1000px)')
    const on = () => setIsMobile(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // اسکوپ خودکار قالب‌ها بر اساس نقش کاربر واردشده + نام کاربر (برای «آگهی‌های من»)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        // اگر نقش کاربر به یک پروفایل مشخص نگاشت شود، فقط همان را می‌بیند (قفل).
        // ادمین/داشبورد ناشناخته → قفل نمی‌شود تا بتواند همه را مرور کند.
        const mapped = DASH_TO_PROFILE[data.dash as string]
        if (mapped) { setTplFilter(mapped); setLockedProfile(mapped) }
        // نام نمایشی کاربر — برای تطبیق آگهی‌های منتشرشده در بلوک «آگهی‌های من».
        if (data.account?.name) setOwnerName(String(data.account.name))
      })
      .catch(() => { /* در صورت خطا روی پیش‌فرض «عمومی» می‌ماند */ })
    return () => { cancelled = true }
  }, [])

  // آگهی‌های واقعیِ منتشرشدهٔ کاربر — برای پیش‌نمایشِ زندهٔ بلوک «آگهی‌های من».
  useEffect(() => {
    if (!ownerName) { setMyListings([]); return }
    let cancelled = false
    fetch(`/api/content?type=listing&owner=${encodeURIComponent(ownerName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : [])
        setMyListings(items.slice(0, 12).map((it: any) => ({ title: String(it.title || ''), location: it.location, price: it.price, image: it.image, category: it.category })))
      })
      .catch(() => { /* پیش‌نمایش روی کارت‌های نمونه می‌ماند */ })
    return () => { cancelled = true }
  }, [ownerName])

  // مقالاتِ واقعیِ منتشرشدهٔ کاربر — برای پیش‌نمایشِ زندهٔ بلوک «وبلاگ» (مثلِ سایتِ منتشرشده).
  useEffect(() => {
    if (!ownerName) { setMyArticles([]); return }
    let cancelled = false
    fetch(`/api/content?type=article&owner=${encodeURIComponent(ownerName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : [])
        setMyArticles(items.slice(0, 12).map((it: any) => ({
          title: String(it.title || ''),
          excerpt: String(it.excerpt || it.meta?.summary || it.meta?.excerpt || ''),
          image: it.image, category: it.category,
          date: it.scrapedAt ? new Date(it.scrapedAt).toLocaleDateString('fa-IR') : '',
        })))
      })
      .catch(() => { /* پیش‌نمایش روی کارت‌های نمونه می‌ماند */ })
    return () => { cancelled = true }
  }, [ownerName])

  // اعضای تیمِ آژانس — برای پیش‌نمایشِ زندهٔ بلوک «تیم مشاوران» و انتخابِ مشاوران.
  useEffect(() => {
    let cancelled = false
    fetch('/api/website/team')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d && Array.isArray(d.members)) setTeamMembers(d.members) })
      .catch(() => { /* بدونِ عضو می‌ماند */ })
    return () => { cancelled = true }
  }, [])

  // On mount, load the user's existing saved site (by the default slug) and
  // populate the real pages if it already exists.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/sites?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.site) return
        const s = data.site
        if (Array.isArray(s.pages) && s.pages.length) {
          setPages(s.pages.map((pg: any, i: number) => ({
            slug: i === 0 ? 'home' : slugify(pg.slug || '') || `page-${i}`,
            title: String(pg.title || '') || (i === 0 ? 'صفحه اصلی' : `صفحه ${i + 1}`),
            inMenu: pg.inMenu !== false,
            menuLabel: pg.menuLabel ? String(pg.menuLabel) : undefined,
            blocks: Array.isArray(pg.blocks) ? pg.blocks.map(migrateBlock) : [],
          })))
          setActivePage(0)
          setSelectedBlock(null)
        }
        if (s.theme?.primary) setTheme({ ...DEFAULT_THEME, ...s.theme })
        if (s.seo?.title) setSeoTitle(String(s.seo.title))
        if (s.seo?.description) setSeoDesc(String(s.seo.description))
        if (s.ownerName) setOwnerName(String(s.ownerName))
      })
      .catch(() => { /* no saved site yet — keep the starter page */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushHistory = (b: Block[]) => setHistory(h => [...h.slice(-19), b])

  const addBlock = (type: string) => {
    pushHistory(blocks)
    const nb = makeBlock(type)
    setBlocks(prev => [...prev, nb])
    setSelectedBlock(nb.id)
    setActiveTab('settings')
    if (isMobile) setMobileSheet('insp')
  }

  const loadTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    pushHistory(blocks)
    const pal = templatePalette(tpl)
    const copy = PROFILE_HERO_COPY[tpl.profile] || PROFILE_HERO_COPY['عمومی']
    const heroBg = `linear-gradient(135deg, ${pal.primary}, ${pal.secondary} 72%)`
    // هر قالب، پالتِ کاملِ خودش را می‌گذارد تا واقعاً متمایز دیده شود.
    setTheme({ ...pal })
    // بلوک‌سازِ مشترک: هیرو/cta/footer پیش‌فرضِ متناسب می‌گیرند.
    const build = (type: string, opts?: { heading?: string; sub?: string; btn?: string }) => {
      let preset: Record<string, any> | undefined
      if (type === 'hero') preset = { heading: opts?.heading ?? copy.heading, subheading: opts?.sub ?? copy.subheading, buttonText: opts?.btn ?? copy.buttonText, bg: heroBg }
      else if (type === 'cta') preset = { bg: heroBg }
      else if (type === 'footer') preset = { brand: tpl.name }
      else if (type === 'blogfull') preset = { heading: opts?.heading ?? 'وبلاگ' }
      return makeBlock(type, preset)
    }
    // ── صفحهٔ اصلیِ حرفه‌ای و کامل، متناسب با پروفایل ──
    // هر سایت باید روی صفحهٔ اصلی «آنچه ارائه می‌دهد» را به‌صورتِ اسلایدر نشان دهد:
    // مشاور/آژانس/فروشگاه/سرمایه‌گذار → آگهی‌ها (listings)، سازنده → پروژه‌ها (gallery)،
    // حقوقی → خدمات. این بلوک حتماً روی صفحهٔ اصلی قرار می‌گیرد.
    const offeringsType = tpl.profile === 'سازنده' ? 'gallery' : tpl.profile === 'حقوقی' ? 'services' : 'listings'
    // بلوک‌های متمایزِ خودِ قالب (درباره/تیم و…) که در ترکیبِ پایه نیستند، حفظ می‌شوند تا تنوع بماند.
    const baseTypes = ['hero', 'footer', 'cta', 'listings', 'gallery', 'services', 'stats', 'testimonials', 'search']
    const distinct = tpl.blocks.filter(b => !baseTypes.includes(b))
    const hasSearch = tpl.blocks.includes('search')
    const homeOrder = [
      'hero',
      ...(hasSearch ? ['search'] : []),
      offeringsType,
      ...distinct,
      'services',
      'stats',
      'testimonials',
      'cta',
      'footer',
    ]
    const homeTypes = Array.from(new Set(homeOrder))
    const homeBlocks = homeTypes.map(type => build(type))
    const newPages: Page[] = [{ slug: 'home', title: 'صفحه اصلی', blocks: homeBlocks }]
    // صفحاتِ کاملِ سایت، متناسب با پروفایلِ قالب (درباره، فایل‌ها، خدمات، تیم، وبلاگ، تماس…).
    for (const spec of profilePageSpec(tpl.profile)) {
      const pageBlocks = spec.blocks.map(type => build(type, { heading: spec.heroHeading, sub: spec.heroSub, btn: 'تماس با ما' }))
      newPages.push({ slug: spec.slug, title: spec.title, inMenu: true, menuLabel: spec.menuLabel, blocks: pageBlocks })
    }
    setPages(newPages)
    setActivePage(0)
    setSelectedBlock(null)
  }

  const deleteBlock = (id: number) => {
    pushHistory(blocks)
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (selectedBlock === id) setSelectedBlock(null)
  }

  const moveBlock = (id: number, dir: -1 | 1) => {
    pushHistory(blocks)
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  // جابه‌جاییِ بلوک با کشیدن‌ورها کردن: بلوکِ مبدأ را پیشِ بلوکِ مقصد می‌نشاند.
  const reorderBlocks = (fromId: number, toId: number) => {
    if (fromId === toId) return
    pushHistory(blocks)
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === fromId)
      const to = prev.findIndex(b => b.id === toId)
      if (from < 0 || to < 0) return prev
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return arr
    })
    setDragId(null); setDragOverId(null)
  }

  // جابه‌جاییِ کارت‌های یک فهرست (خدمات/نظرات/گالری/تیم) با کشیدن‌ورها کردن.
  const reorderListItem = (id: number, key: string, from: number, to: number) => {
    if (from === to) return
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? [...b.props[key]] : []
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return b
      const [m] = arr.splice(from, 1)
      arr.splice(to, 0, m)
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
    setListDrag(null); setListDragOver(null)
  }

  const undo = () => {
    if (history.length === 0) return
    setBlocks(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }

  // Immutable prop update for a block.
  const updateProp = (id: number, key: string, value: any) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b))
  }

  // List-prop helpers (services.items, gallery.images, testimonials.items, footer.links).
  const updateListItem = (id: number, key: string, index: number, value: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? [...b.props[key]] : []
      arr[index] = value
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
  }
  const updateListItemField = (id: number, key: string, index: number, field: string, value: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? b.props[key].map((x: any) => ({ ...x })) : []
      arr[index] = { ...arr[index], [field]: value }
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
  }
  const addListItem = (id: number, key: string, item: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? [...b.props[key]] : []
      arr.push(item)
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
  }
  const removeListItem = (id: number, key: string, index: number) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? b.props[key].filter((_: any, i: number) => i !== index) : []
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
  }
  const moveListItem = (id: number, key: string, index: number, dir: -1 | 1) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== id) return b
      const arr = Array.isArray(b.props[key]) ? [...b.props[key]] : []
      const next = index + dir
      if (next < 0 || next >= arr.length) return b
      ;[arr[index], arr[next]] = [arr[next], arr[index]]
      return { ...b, props: { ...b.props, [key]: arr } }
    }))
  }

  // Upload a single file to /api/media and return its url (mirrors app/pros uploadImages).
  const uploadFile = async (file: File): Promise<string | null> => {
    const fd = new FormData(); fd.append('file', file)
    try { const r = await fetch('/api/media', { method: 'POST', body: fd }); const d = await r.json(); return d.url || null } catch { return null }
  }

  const selectedBlockObj = blocks.find(b => b.id === selectedBlock) || null

  const canvasWidth: string | number = device === 'mobile' ? 375 : device === 'tablet' ? 768 : '100%'

  // در موبایل، پنل‌های کناری به «شیتِ کشویی از پایین» تبدیل می‌شوند.
  const sheetStyle = (open: boolean): React.CSSProperties => ({
    position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto', width: 'auto',
    height: '76vh', maxHeight: '76vh', zIndex: 320,
    borderRadius: '20px 20px 0 0', borderLeft: 'none', borderRight: 'none',
    borderTop: '1px solid var(--line2)', boxShadow: '0 -16px 50px rgba(0,0,0,.55)',
    transform: open ? 'translateY(0)' : 'translateY(110%)',
    transition: 'transform .3s cubic-bezier(.2,.85,.25,1)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  })

  // ── Page management (real pages) ───────────────────────────────────────────
  // Ensure a slug is url-safe and unique within the site (skipping `skipIdx`).
  const uniquePageSlug = (raw: string, skipIdx: number): string => {
    let base = slugify(raw) || 'page'
    let candidate = base
    let n = 2
    while (pages.some((pg, i) => i !== skipIdx && pg.slug === candidate)) { candidate = `${base}-${n++}` }
    return candidate
  }

  const addPage = () => {
    const idx = pages.length
    const slugVal = uniquePageSlug(`page-${idx + 1}`, -1)
    const newPage: Page = { slug: slugVal, title: 'صفحه جدید', blocks: [makeBlock('hero')], inMenu: true }
    setPages(prev => [...prev, newPage])
    setActivePage(idx)
    setSelectedBlock(null)
  }

  // ساختِ صفحهٔ جدید از قالبِ صفحه (با بلوک‌ها + پیش‌تنظیماتِ متناسب با تمِ فعلی).
  const createPageFromTemplate = (blocks: string[], title: string) => {
    const idx = pages.length
    const heroBg = `linear-gradient(135deg, ${theme.primary}, ${theme.secondary || '#1a1510'} 72%)`
    const brand = (seoTitle || '').split('|')[0]?.trim() || title
    const nb = blocks.map(type => {
      let preset: Record<string, any> | undefined
      if (type === 'hero') preset = { heading: title, subheading: '', bg: heroBg }
      else if (type === 'cta') preset = { bg: heroBg }
      else if (type === 'footer') preset = { brand }
      return makeBlock(type, preset)
    })
    const slugVal = uniquePageSlug(slugify(title) || `page-${idx + 1}`, -1)
    setPages(prev => [...prev, { slug: slugVal, title, blocks: nb, inMenu: true }])
    setActivePage(idx)
    setSelectedBlock(null)
    setPageTplModal(false)
  }

  // جابه‌جایی ترتیب صفحه (و در نتیجه ترتیب منو) — صفحهٔ خانه ثابت می‌ماند.
  const movePage = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (idx === 0 || next <= 0 || next >= pages.length) return
    setPages(prev => { const arr = [...prev];[arr[idx], arr[next]] = [arr[next], arr[idx]]; return arr })
    setActivePage(a => a === idx ? next : a === next ? idx : a)
  }

  const selectPage = (idx: number) => {
    setActivePage(idx)
    setSelectedBlock(null)
  }

  const renamePage = (idx: number, title: string, rawSlug: string) => {
    setPages(prev => prev.map((pg, i) => {
      if (i !== idx) return pg
      // pages[0] is always the home page — its slug stays 'home'.
      const slugVal = idx === 0 ? 'home' : uniquePageSlug(rawSlug || title, idx)
      return { ...pg, title, slug: slugVal }
    }))
  }

  const deletePage = (idx: number) => {
    // Never delete the last page or the home page (pages[0]).
    if (pages.length <= 1 || idx === 0) return
    setPages(prev => prev.filter((_, i) => i !== idx))
    setActivePage(a => (a >= idx ? Math.max(0, a - 1) : a))
    setSelectedBlock(null)
  }

  // Persist the current site (draft). Returns the server-resolved slug, or null on failure.
  const persistSite = async (): Promise<{ slug: string; url: string } | null> => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: seoTitle,
        theme,
        ownerName,
        seo: { title: seoTitle, description: seoDesc },
        pages: pages.map(pg => ({
          slug: pg.slug,
          title: pg.title,
          inMenu: pg.inMenu !== false,
          menuLabel: pg.menuLabel || undefined,
          blocks: pg.blocks.map(b => ({ id: b.id, type: b.type, props: b.props })),
        })),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.slug && data.slug !== slug) setSlug(data.slug)
    return { slug: data.slug, url: data.url }
  }

  const handleSave = async () => {
    if (saveState === 'saving') return
    setSaveState('saving')
    try {
      const result = await persistSite()
      if (!result) { setSaveState('error'); return }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    setPublishError('')
    try {
      const result = await persistSite()
      if (!result) {
        setPublishError('برای انتشار ابتدا وارد شوید')
        return
      }
      setPublishedSlug(result.slug)
      setPublishSuccess(true)
    } catch {
      setPublishError('خطا در انتشار سایت')
    } finally {
      setPublishing(false)
    }
  }

  // The builder body — shared by both standalone and embedded modes.
  const content = (
    <>
      {/* STICKY TOOLBAR */}
      <div style={{
        flexShrink: 0,
        background: 'var(--navbg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 11, height: 11, background: 'var(--bg)', transform: 'rotate(45deg)', borderRadius: 2, display: 'block' }} />
          </div>
          <div className="mjwb-tb-hide">
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>وب‌سایت‌ساز ملک‌جت</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', direction: 'ltr', lineHeight: 1.3 }}>melkjet.com/{slug}</div>
          </div>
        </div>

        <button
          className="mjwb-tb-hide"
          onClick={() => setTplModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', flexShrink: 0 }}
        >
          <span style={{ fontSize: 14 }}>▦</span>
          <span>قالب‌ها</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Device toggle */}
        <div className="mjwb-tb-hide" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 9, padding: 3, gap: 2 }}>
          {([
            ['desktop', '▭', 'دسکتاپ'],
            ['tablet', '▯', 'تبلت'],
            ['mobile', '☐', 'موبایل'],
          ] as [Device, string, string][]).map(([d, icon, label]) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7,
                border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: device === d ? 'var(--goldDim)' : 'transparent',
                color: device === d ? 'var(--gold)' : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mjwb-tb-hide" style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />

        <button
          className="mjwb-tb-hide"
          onClick={undo}
          disabled={history.length === 0}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: history.length > 0 ? 'var(--text)' : 'var(--faint)', cursor: history.length > 0 ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}
        >↩ واگرد</button>
        <button className="mjwb-tb-hide" style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--faint)', cursor: 'default', fontSize: 12, fontWeight: 600 }}>
          ↪ بازگرد
        </button>

        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{ padding: '5px 16px', borderRadius: 8, border: '1px solid var(--line)', background: saveState === 'saved' ? 'var(--goldDim)' : 'transparent', color: saveState === 'error' ? '#e7674a' : saveState === 'saved' ? 'var(--gold)' : 'var(--text)', fontSize: 12, fontWeight: 700, cursor: saveState === 'saving' ? 'default' : 'pointer' }}
        >
          {saveState === 'saving' ? 'در حال ذخیره...' : saveState === 'saved' ? 'ذخیره شد ✓' : saveState === 'error' ? 'ورود لازم است' : 'ذخیره'}
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{ padding: '6px 18px', borderRadius: 8, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', border: 'none', color: '#16140f', fontSize: 12, fontWeight: 800, cursor: publishing ? 'default' : 'pointer', opacity: publishing ? 0.7 : 1, flexShrink: 0 }}
        >
          {publishing ? 'در حال انتشار...' : 'انتشار سایت'}
        </button>
        {publishError && (
          <span style={{ fontSize: 11, color: '#e7674a', fontWeight: 600, flexShrink: 0 }}>{publishError}</span>
        )}
      </div>

      {/* THREE-COLUMN BUILDER */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL - Block Library */}
        <div className="mjwb-lib" style={{
          width: 230, flexShrink: 0, borderLeft: '1px solid var(--line)',
          background: 'var(--bg2)', overflowY: 'auto', padding: '16px 0',
          ...(isMobile ? sheetStyle(mobileSheet === 'lib') : {}),
        }}>
          {isMobile && (
            <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>افزودنِ بخش</span>
              <button onClick={() => setMobileSheet('none')} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 17, cursor: 'pointer' }}>×</button>
            </div>
          )}
          <div style={{ padding: '0 14px', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 8 }}>شروع سریع</div>
            <button
              onClick={() => setTplModal(true)}
              style={{ width: '100%', padding: '14px 12px', borderRadius: 12, border: '1px solid var(--gold)', background: 'var(--goldDim)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>▦</span>
              <span style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>انتخاب قالب حرفه‌ای</span>
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                  {lockedProfile ? `قالب‌های مخصوص ${lockedProfile}` : 'مشاهدهٔ قالب‌های آماده'}
                </span>
              </span>
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />

          <div style={{ padding: '0 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 10 }}>بلوک‌ها</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {BLOCK_LIBRARY.map(bl => (
                <button
                  key={bl.type}
                  onClick={() => addBlock(bl.type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 9,
                    border: '1px solid var(--line)', background: 'var(--surface)',
                    cursor: 'pointer', transition: 'all .15s', width: '100%', textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--gold)', flexShrink: 0 }}>{bl.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{bl.label}</span>
                  <span style={{ marginRight: 'auto', fontSize: 14, color: 'var(--faint)' }}>+</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER - Canvas */}
        <div className="mjwb-canvaswrap" style={{
          flex: 1, background: 'var(--bg)', overflowY: 'auto', overflowX: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: device !== 'desktop' ? 'center' : 'stretch',
          padding: device !== 'desktop' ? '20px' : 0,
        }}>
          {/* PAGE TABS — مدیریت سریع و واضحِ صفحات سایت */}
          <div style={{ position: 'sticky', top: 0, zIndex: 5, alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 2 }}>صفحات سایت:</span>
            {pages.map((pg, idx) => (
              <button key={idx} onClick={() => { setActivePage(idx); setSelectedBlock(null) }} title={`/${slug}${idx === 0 ? '' : '/' + pg.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${activePage === idx ? 'var(--gold)' : 'var(--line)'}`, background: activePage === idx ? 'var(--goldDim)' : 'var(--surface)', color: activePage === idx ? 'var(--gold)' : 'var(--text)', fontWeight: activePage === idx ? 700 : 500, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {idx === 0 && <span style={{ fontSize: 11 }}>⌂</span>}
                {pg.title || 'صفحه'}
                {pg.inMenu === false && <span title="در منو نیست" style={{ fontSize: 9, opacity: 0.6 }}>(مخفی)</span>}
              </button>
            ))}
            <button onClick={() => setPageTplModal(true)} title="افزودن صفحهٔ جدید از قالب" style={{ padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>＋ صفحهٔ جدید</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => setActiveTab('pages')} title="تنظیمات صفحات و منو" style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>⚙ مدیریت صفحات و منو</button>
          </div>
          <div style={{
            width: canvasWidth,
            minHeight: '100%',
            background: theme.bg || '#fff',
            color: theme.text || '#15110b',
            fontFamily: (theme.font ? `'${theme.font}', ` : '') + 'Vazirmatn, Tahoma, sans-serif',
            boxShadow: device !== 'desktop' ? '0 8px 40px rgba(0,0,0,0.45)' : 'none',
            borderRadius: device !== 'desktop' ? 16 : 0,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {/* Browser chrome */}
            <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--line)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 5 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7674a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e7a14a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#5fd98a' }} />
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: 'var(--faint)', textAlign: 'center', direction: 'ltr' }}>
                https://melkjet.com/{slug}
              </div>
            </div>

            {/* منوی سایت (همیشه روی همهٔ صفحات نمایش داده می‌شود) */}
            <div style={{ direction: 'rtl', background: theme.bg || '#fff', borderBottom: `1px solid ${theme.surface || '#eee'}`, padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: theme.heading || '#15110b', marginInlineEnd: 'auto' }}>{seoTitle?.split('|')[0]?.trim() || 'برندِ شما'}</div>
              {device === 'mobile' ? (
                <div style={{ width: 34, height: 30, borderRadius: 8, border: `1px solid ${theme.surface || '#eee'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }} title="منوی همبرگری (موبایل)">
                  {[0, 1, 2].map(k => <span key={k} style={{ width: 16, height: 2, borderRadius: 2, background: theme.heading || '#15110b' }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {pages.filter((pg, i) => i === 0 || pg.inMenu !== false).map((pg, i) => (
                    <span key={pg.slug} style={{ fontSize: 12.5, fontWeight: i === activePage ? 800 : 600, color: i === activePage ? '#fff' : (theme.text || '#555'), background: i === activePage ? theme.primary : 'transparent', padding: '6px 13px', borderRadius: 8 }}>{i === 0 ? '⌂ ' : ''}{pg.menuLabel || pg.title}</span>
                  ))}
                </div>
              )}
              <span style={{ position: 'absolute', top: 4, insetInlineStart: 8, fontSize: 9, color: 'var(--faint)' }}>منوی سایت</span>
            </div>

            {/* Canvas blocks */}
            <div style={{ direction: 'rtl' }}>
              {blocks.length === 0 ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 44, opacity: 0.15 }}>◈</div>
                  <div style={{ fontSize: 14, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.8 }}>
                    یک قالبِ آماده انتخاب کنید<br />
                    <span style={{ fontSize: 12 }}>یا بخش‌ها را یکی‌یکی اضافه نمایید — سپس با کشیدن جابه‌جا کنید</span>
                  </div>
                  {isMobile && <button onClick={() => setMobileSheet('lib')} style={{ marginTop: 4, padding: '11px 22px', borderRadius: 11, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>＋ افزودنِ بخش</button>}
                </div>
              ) : (
                blocks.map(block => (
                  <BlockPreview
                    key={block.id}
                    block={block}
                    primary={theme.primary}
                    selected={selectedBlock === block.id}
                    onSelect={() => {
                      setSelectedBlock(block.id)
                      setActiveTab('settings')
                      if (isMobile) setMobileSheet('insp')
                    }}
                    onUp={() => moveBlock(block.id, -1)}
                    onDown={() => moveBlock(block.id, 1)}
                    onDelete={() => deleteBlock(block.id)}
                    myListings={myListings}
                    myArticles={myArticles}
                    teamMembers={teamMembers}
                    enableDrag={!isMobile}
                    bigControls={isMobile}
                    isDragging={dragId === block.id}
                    isDragOver={dragOverId === block.id && dragId !== block.id}
                    onDragStartBlock={() => setDragId(block.id)}
                    onDragEnterBlock={() => { if (dragId !== null && dragId !== block.id) setDragOverId(block.id) }}
                    onDropBlock={() => { if (dragId !== null) reorderBlocks(dragId, block.id) }}
                    onDragEndBlock={() => { setDragId(null); setDragOverId(null) }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Inspector */}
        <div className="mjwb-insp" style={{
          width: 288, flexShrink: 0, borderRight: '1px solid var(--line)',
          background: 'var(--bg2)', display: 'flex', flexDirection: 'column',
          ...(isMobile ? sheetStyle(mobileSheet === 'insp') : {}),
        }}>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>ویرایش و تنظیمات</span>
              <button onClick={() => setMobileSheet('none')} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 17, cursor: 'pointer' }}>×</button>
            </div>
          )}
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            {([
              ['seo', 'سئو'],
              ['settings', 'تنظیمات بلوک'],
              ['pages', 'صفحات'],
              ['reviews', 'نظرات'],
            ] as [ActiveTab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  flex: 1, padding: '11px 4px', border: 'none', background: 'transparent',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  color: activeTab === t ? 'var(--gold)' : 'var(--muted)',
                  borderBottom: `2px solid ${activeTab === t ? 'var(--gold)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

            {/* SEO Tab */}
            {activeTab === 'seo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--line2)" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--gold)" strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 24 * 0.92} ${2 * Math.PI * 24 * (1 - 0.92)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 28 28)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'var(--gold)' }}>۹۲</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>امتیاز سئو</div>
                    <div style={{ fontSize: 11, color: '#5fd98a', fontWeight: 600 }}>وضعیت: عالی</div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>عنوان صفحه</label>
                  <input
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 10, color: seoTitle.length > 60 ? '#e7674a' : 'var(--faint)', marginTop: 4 }}>{seoTitle.length}/۶۰ کاراکتر</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>توضیح متا</label>
                  <textarea
                    value={seoDesc}
                    onChange={e => setSeoDesc(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 10, color: seoDesc.length > 160 ? '#e7674a' : 'var(--faint)', marginTop: 4 }}>{seoDesc.length}/۱۶۰ کاراکتر</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>آدرس سایت (Slug)</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', direction: 'ltr' }}>
                    <span style={{ padding: '8px 10px', background: 'var(--bg)', borderRight: '1px solid var(--line)', fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>melkjet.com/</span>
                    <input
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                      style={{ flex: 1, padding: '8px 10px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none', direction: 'ltr' }}
                    />
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>پالتِ آمادهٔ سایت</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 7, marginBottom: 14 }}>
                    {SITE_PALETTES.map(pl => {
                      const active = theme.primary === pl.t.primary && theme.bg === pl.t.bg
                      return (
                        <button key={pl.name} onClick={() => setTheme(t => ({ ...pl.t, ...(t.font ? { font: t.font } : {}) }))} title={pl.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`, background: active ? 'var(--goldDim)' : 'var(--bg2)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
                          <span style={{ display: 'flex', flexShrink: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line2)' }}>
                            <span style={{ width: 13, height: 22, background: pl.t.bg }} />
                            <span style={{ width: 13, height: 22, background: pl.t.primary }} />
                            <span style={{ width: 13, height: 22, background: pl.t.secondary }} />
                          </span>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>رنگ‌های سفارشی</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      ['primary', 'رنگِ اصلی (تأکید)'],
                      ['secondary', 'رنگِ تیره/مکمل'],
                      ['bg', 'پس‌زمینهٔ صفحه'],
                      ['surface', 'پس‌زمینهٔ بخش‌ها'],
                      ['heading', 'رنگِ عنوان‌ها'],
                      ['text', 'رنگِ متن'],
                    ] as [keyof Theme, string][]).map(([k, label]) => (
                      <div key={k} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                        <input type="color" value={String(theme[k] || '#000000')} onChange={e => setTheme(t => ({ ...t, [k]: e.target.value }))} style={{ width: 36, height: 30, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg2)', cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: 'var(--text)', flex: 1 }}>{label}</span>
                        <input value={String(theme[k] || '')} onChange={e => setTheme(t => ({ ...t, [k]: e.target.value }))} style={{ ...INSPECTOR_INPUT, width: 86, flex: '0 0 auto', direction: 'ltr', padding: '5px 8px' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 1, background: 'var(--line)', margin: '12px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>فونتِ سایت</div>
                  <select value={theme.font || ''} onChange={e => setTheme(t => ({ ...t, font: e.target.value || undefined }))} style={{ ...INSPECTOR_INPUT, cursor: 'pointer' }}>
                    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 6, lineHeight: 1.7 }}>فونت روی سایتِ منتشرشده اعمال می‌شود.</div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>بررسی‌های سئو</div>
                  {[
                    'رندرینگ سمت سرور (SSR)',
                    'دامنه اختصاصی فعال',
                    'اسکیما Schema.org',
                    'سرعت بارگذاری ۹۰+',
                    'نقشه سایت (Sitemap)',
                  ].map(label => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 12, color: '#5fd98a', flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                {selectedBlockObj ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                      ویرایش: {BLOCK_LIBRARY.find(b => b.type === selectedBlockObj.type)?.label}
                    </div>

                    {(BLOCK_SCHEMA[selectedBlockObj.type] || []).map(field => {
                      const id = selectedBlockObj.id
                      const val = selectedBlockObj.props[field.key]
                      // ── scalar fields ──
                      if (field.kind === 'text' || field.kind === 'enum' || field.kind === 'number' || field.kind === 'textarea' || field.kind === 'color') {
                        return (
                          <div key={field.key}>
                            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{field.label}</label>
                            {field.kind === 'textarea' ? (
                              <textarea value={val ?? ''} onChange={e => updateProp(id, field.key, e.target.value)} rows={3} style={INSPECTOR_INPUT} />
                            ) : field.kind === 'enum' ? (
                              <select value={val ?? ''} onChange={e => updateProp(id, field.key, e.target.value)} style={INSPECTOR_INPUT}>
                                {field.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : field.kind === 'number' ? (
                              <input type="number" value={val ?? 0} onChange={e => updateProp(id, field.key, Number(e.target.value))} style={INSPECTOR_INPUT} />
                            ) : field.kind === 'color' ? (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="color" value={(typeof val === 'string' && val.startsWith('#')) ? val : '#ffffff'} onChange={e => updateProp(id, field.key, e.target.value)} style={{ width: 40, height: 32, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', padding: 2 }} />
                                <input value={val ?? ''} onChange={e => updateProp(id, field.key, e.target.value)} style={{ ...INSPECTOR_INPUT, flex: 1 }} />
                              </div>
                            ) : (
                              <input value={val ?? ''} onChange={e => updateProp(id, field.key, e.target.value)} style={INSPECTOR_INPUT} />
                            )}
                          </div>
                        )
                      }
                      // ── single image field (about.image) ──
                      if (field.kind === 'image') {
                        const ukey = `${id}:${field.key}`
                        return (
                          <div key={field.key}>
                            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{field.label}</label>
                            {val ? (
                              <div style={{ position: 'relative', marginBottom: 6 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={val} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
                                <button onClick={() => updateProp(id, field.key, '')} style={{ position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,.65)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>✕</button>
                              </div>
                            ) : null}
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: '1px dashed var(--line2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                                const f = e.target.files?.[0]; if (!f) return
                                setUploadingKey(ukey)
                                const url = await uploadFile(f)
                                if (url) updateProp(id, field.key, url)
                                setUploadingKey(null)
                              }} />
                              <span>{uploadingKey === ukey ? '⏳ آپلود…' : '＋ آپلود تصویر'}</span>
                            </label>
                          </div>
                        )
                      }
                      // ── list fields ──
                      if (field.kind === 'list') {
                        const arr: any[] = Array.isArray(val) ? val : []
                        const isImageList = field.itemFields && field.itemFields.length === 1 && field.itemFields[0].kind === 'image' && field.itemFields[0].key === ''
                        return (
                          <div key={field.key}>
                            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{field.label}</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {arr.map((item, idx) => (
                                <div key={idx}
                                  onDragOver={e => { if (listDrag && listDrag.key === field.key) e.preventDefault() }}
                                  onDragEnter={e => { if (listDrag && listDrag.key === field.key && listDrag.idx !== idx) { e.preventDefault(); setListDragOver({ key: field.key, idx }) } }}
                                  onDrop={e => { if (listDrag && listDrag.key === field.key) { e.preventDefault(); reorderListItem(id, field.key, listDrag.idx, idx) } }}
                                  style={{ border: `1px solid ${listDragOver && listDragOver.key === field.key && listDragOver.idx === idx ? 'var(--gold)' : 'var(--line)'}`, borderRadius: 9, padding: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6, opacity: listDrag && listDrag.key === field.key && listDrag.idx === idx ? 0.4 : 1, transition: 'border-color .12s, opacity .12s' }}>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <span draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)) } catch {}; setListDrag({ key: field.key, idx }) }} onDragEnd={() => { setListDrag(null); setListDragOver(null) }} title="برای جابه‌جایی بکشید" style={{ cursor: 'grab', color: 'var(--faint)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>⠿</span>
                                    <span style={{ flex: 1 }} />
                                    <button onClick={() => moveListItem(id, field.key, idx, -1)} style={LIST_BTN}>▲</button>
                                    <button onClick={() => moveListItem(id, field.key, idx, 1)} style={LIST_BTN}>▼</button>
                                    <button onClick={() => removeListItem(id, field.key, idx)} style={{ ...LIST_BTN, color: '#e05050' }}>×</button>
                                  </div>
                                  {isImageList ? (
                                    <div>
                                      {item ? (
                                        <div style={{ position: 'relative' }}>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={item} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                                        </div>
                                      ) : (
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 6, border: '1px dashed var(--line2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
                                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                                            const f = e.target.files?.[0]; if (!f) return
                                            const ukey = `${id}:${field.key}:${idx}`
                                            setUploadingKey(ukey)
                                            const url = await uploadFile(f)
                                            if (url) updateListItem(id, field.key, idx, url)
                                            setUploadingKey(null)
                                          }} />
                                          <span>{uploadingKey === `${id}:${field.key}:${idx}` ? '⏳ آپلود…' : '＋ آپلود'}</span>
                                        </label>
                                      )}
                                    </div>
                                  ) : (
                                    field.itemFields!.map(f => (
                                      <div key={f.key}>
                                        <label style={{ fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>{f.label}</label>
                                        {f.kind === 'textarea' ? (
                                          <textarea value={item?.[f.key] ?? ''} onChange={e => updateListItemField(id, field.key, idx, f.key, e.target.value)} rows={2} style={INSPECTOR_INPUT} />
                                        ) : f.kind === 'number' ? (
                                          <input type="number" value={item?.[f.key] ?? 0} onChange={e => updateListItemField(id, field.key, idx, f.key, Number(e.target.value))} style={INSPECTOR_INPUT} />
                                        ) : (
                                          <input value={item?.[f.key] ?? ''} onChange={e => updateListItemField(id, field.key, idx, f.key, e.target.value)} style={INSPECTOR_INPUT} />
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addListItem(id, field.key, field.newItem ? field.newItem() : {})} style={{ padding: '8px', borderRadius: 8, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>＋ افزودن</button>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })}

                    {selectedBlockObj.type === 'listings' && selectedBlockObj.props.source === 'mine' && (
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.7 }}>
                        این بلوک هنگام انتشار، آگهی‌های ثبت‌شدهٔ شما را نمایش می‌دهد.
                      </div>
                    )}

                    {selectedBlockObj.type === 'team' && (() => {
                      const raw = (selectedBlockObj.props as any).members
                      const explicit = Array.isArray(raw)
                      const id = selectedBlockObj.id
                      const checkedAll = !explicit
                      const isChecked = (ph: string) => explicit ? raw.includes(ph) : true
                      const toggle = (ph: string) => {
                        const base: string[] = explicit ? [...raw] : teamMembers.map(m => m.phone)
                        const next = base.includes(ph) ? base.filter(x => x !== ph) : [...base, ph]
                        updateProp(id, 'members', next)
                      }
                      return (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}>انتخابِ مشاوران</div>
                          {teamMembers.length === 0 ? (
                            <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.8 }}>هنوز مشاوری به آژانسِ شما متصل نیست. از پنل «مشاوران/آژانسِ من» مشاور دعوت کنید؛ سپس این‌جا برای نمایش انتخابشان کنید.</div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                                {teamMembers.map(m => (
                                  <label key={m.phone} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 6px', borderRadius: 7, background: isChecked(m.phone) ? 'var(--goldDim)' : 'transparent' }}>
                                    <input type="checkbox" checked={isChecked(m.phone)} onChange={() => toggle(m.phone)} style={{ width: 15, height: 15, accentColor: 'var(--gold)' }} />
                                    {m.photo
                                      // eslint-disable-next-line @next/next/no-img-element
                                      ? <img src={m.photo} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                      : <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>{(m.name || '?').charAt(0)}</span>}
                                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                                    {m.title ? <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.title}</span> : null}
                                  </label>
                                ))}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 8, lineHeight: 1.7 }}>{checkedAll ? 'همهٔ مشاوران نمایش داده می‌شوند.' : `${(raw as string[]).length.toLocaleString('fa-IR')} مشاور انتخاب شده.`} عکس و تخصصِ هر مشاور از پروفایلِ خودش گرفته می‌شود.</div>
                            </>
                          )}
                        </div>
                      )
                    })()}

                    <div style={{ height: 1, background: 'var(--line)' }} />

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => moveBlock(selectedBlockObj.id, -1)}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                      >▲ بالا</button>
                      <button
                        onClick={() => moveBlock(selectedBlockObj.id, 1)}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                      >▼ پایین</button>
                    </div>

                    <button
                      onClick={() => deleteBlock(selectedBlockObj.id)}
                      style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid rgba(220,60,60,0.4)', background: 'rgba(220,60,60,0.08)', color: '#e05050', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      × حذف بلوک
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.2 }}>◇</div>
                    <div style={{ fontSize: 13, color: 'var(--faint)', lineHeight: 1.8 }}>
                      برای ویرایش<br />یک بلوک را انتخاب کنید
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab — مدیریتِ نظراتِ واقعیِ ثبت‌شده */}
            {activeTab === 'reviews' && <ReviewsManager />}

            {/* Pages Tab — REAL pages: select-to-edit, rename, delete, add */}
            {activeTab === 'pages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>صفحات و منوی سایت</div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.8 }}>
                  هر صفحه را اینجا اضافه/ویرایش کن. صفحاتی که «نمایش در منو» دارند، در نوار منوی بالای سایتِ منتشرشده به‌صورت لینک می‌آیند. ترتیب صفحات = ترتیب منو.
                </div>
                {pages.map((page, idx) => {
                  const isActive = idx === activePage
                  const isHome = idx === 0
                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 10,
                        background: isActive ? 'var(--goldDim)' : 'var(--surface)',
                        border: `1px solid ${isActive ? 'var(--gold)' : 'var(--line)'}`,
                        padding: 10,
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}
                    >
                      <div onClick={() => selectPage(idx)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <span style={{ fontSize: 12, color: isActive ? 'var(--gold)' : 'var(--faint)' }}>{isHome ? '⌂' : '◰'}</span>
                        <span style={{ fontSize: 12.5, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--gold)' : 'var(--text)', flex: 1 }}>{page.title}</span>
                        {isHome && <span style={{ fontSize: 9, color: 'var(--gold)', background: 'rgba(201,168,76,0.2)', padding: '2px 7px', borderRadius: 10 }}>خانه</span>}
                        {isActive && !isHome && <span style={{ fontSize: 9, color: 'var(--gold)', background: 'rgba(201,168,76,0.2)', padding: '2px 7px', borderRadius: 10 }}>فعال</span>}
                      </div>
                      {isActive && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>عنوان صفحه</label>
                            <input value={page.title} onChange={e => renamePage(idx, e.target.value, page.slug)} style={INSPECTOR_INPUT} />
                          </div>
                          {!isHome && (
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>آدرس صفحه (slug)</label>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', direction: 'ltr' }}>
                                <span style={{ padding: '8px 8px', background: 'var(--bg)', borderRight: '1px solid var(--line)', fontSize: 9.5, color: 'var(--faint)', flexShrink: 0 }}>/{slug}/</span>
                                <input value={page.slug} onChange={e => renamePage(idx, page.title, e.target.value)} style={{ flex: 1, padding: '8px 8px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, outline: 'none', direction: 'ltr' }} />
                              </div>
                            </div>
                          )}
                          {/* menu config */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text)', cursor: 'pointer', padding: '4px 0' }}>
                            <input type="checkbox" checked={page.inMenu !== false} onChange={e => setPages(prev => prev.map((p, i) => i === idx ? { ...p, inMenu: e.target.checked } : p))} style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                            نمایش در منوی سایت
                          </label>
                          {page.inMenu !== false && (
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>عنوان در منو (اختیاری)</label>
                              <input value={page.menuLabel ?? ''} onChange={e => setPages(prev => prev.map((p, i) => i === idx ? { ...p, menuLabel: e.target.value } : p))} placeholder={page.title} style={INSPECTOR_INPUT} />
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 10, color: 'var(--faint)', flex: 1 }}>{page.blocks.length} بلوک</div>
                            {!isHome && <>
                              <button onClick={() => movePage(idx, -1)} disabled={idx <= 1} title="بالاتر در منو" style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', cursor: idx <= 1 ? 'default' : 'pointer', fontSize: 11, opacity: idx <= 1 ? 0.4 : 1 }}>▲</button>
                              <button onClick={() => movePage(idx, 1)} disabled={idx >= pages.length - 1} title="پایین‌تر در منو" style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', cursor: idx >= pages.length - 1 ? 'default' : 'pointer', fontSize: 11, opacity: idx >= pages.length - 1 ? 0.4 : 1 }}>▼</button>
                            </>}
                          </div>
                          {!isHome && (
                            <button
                              onClick={() => deletePage(idx)}
                              style={{ padding: '7px', borderRadius: 8, border: '1px solid rgba(220,60,60,0.4)', background: 'rgba(220,60,60,0.08)', color: '#e05050', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}
                            >× حذف صفحه</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => setPageTplModal(true)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginTop: 4 }}
                >
                  <span>+</span><span>صفحهٔ جدید از قالب</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE: backdrop + bottom action bar (پنل‌ها به‌صورتِ شیتِ کشویی) */}
      {isMobile && mobileSheet !== 'none' && (
        <div onClick={() => setMobileSheet('none')} style={{ position: 'fixed', inset: 0, zIndex: 310, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      )}
      {isMobile && mobileSheet === 'none' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300, display: 'flex', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', background: 'var(--navbg)', borderTop: '1px solid var(--line2)', boxShadow: '0 -8px 30px rgba(0,0,0,.4)', backdropFilter: 'blur(20px)' }}>
          <button className="mjwb-mbtn" onClick={() => setMobileSheet('lib')} style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', transition: 'transform .1s' }}>＋ بخش‌ها</button>
          <button className="mjwb-mbtn" onClick={() => setTplModal(true)} style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', transition: 'transform .1s' }}>▦ قالب‌ها</button>
          <button className="mjwb-mbtn" onClick={() => { setActiveTab(selectedBlock ? 'settings' : 'pages'); setMobileSheet('insp') }} style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', transition: 'transform .1s' }}>✎ ویرایش</button>
        </div>
      )}

      {/* PUBLISH SUCCESS MODAL */}
      {publishSuccess && (
        <div
          onClick={() => setPublishSuccess(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 20,
              padding: '40px 44px', textAlign: 'center', maxWidth: 420, width: '90%',
              boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
              direction: 'rtl',
            }}
          >
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(95,217,138,0.12)', border: '2px solid #5fd98a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 30, color: '#5fd98a' }}>✓</div>

            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>سایت شما منتشر شد!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.7 }}>وب‌سایت شما با موفقیت آنلاین شد و در دسترس کاربران است.</div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 16px', marginBottom: 28, direction: 'ltr', fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>
              melkjet.com/{publishedSlug}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a
                href={`/${publishedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 13, fontWeight: 800, textDecoration: 'none', display: 'inline-block' }}
              >
                مشاهده سایت
              </a>
              <button
                onClick={() => setPublishSuccess(false)}
                style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* پاپ‌آپ انتخاب قالب — واکنش‌گرا (موبایل/دسکتاپ) */}
      {tplModal && (
        <div
          onClick={() => setTplModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 14px', overflowY: 'auto' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1000, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>انتخاب قالب حرفه‌ای</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                  {lockedProfile ? `قالب‌های مخصوص پروفایل ${lockedProfile}` : 'قالب‌های آماده'} — روی هر قالب بزنید تا اعمال شود
                </div>
              </div>
              <button onClick={() => setTplModal(false)} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
            </div>

            {/* فقط مهمان/ادمین می‌تواند پروفایل دیگری را مرور کند */}
            {!lockedProfile && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 22px 0' }}>
                {PROFILE_GROUPS.map(pf => (
                  <button key={pf} onClick={() => setTplFilter(pf)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tplFilter === pf ? 'var(--gold)' : 'var(--line)'}`, background: tplFilter === pf ? 'var(--goldDim)' : 'transparent', color: tplFilter === pf ? 'var(--gold)' : 'var(--muted)' }}>{pf}</button>
                ))}
              </div>
            )}

            <div className="mjwb-tplgrid" style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {STARTER_TEMPLATES.filter(t => t.profile === tplFilter).map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => { loadTemplate(tpl); setTplModal(false) }}
                  className="mjwb-tplcard"
                  style={{ textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                >
                  <TemplateThumb tpl={tpl} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{tpl.name}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--gold)', border: '1px solid rgba(212,175,55,.3)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{tpl.profile}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3, lineHeight: 1.5 }}>{tpl.desc}</div>
                  <div style={{ marginTop: 9, textAlign: 'center', padding: '7px', borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>استفاده از این قالب</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* پاپ‌آپِ قالبِ صفحه — برای «صفحهٔ جدید» با دسته‌بندی (درباره، تماس، وبلاگ، آگهی‌ها، …) */}
      {pageTplModal && (() => {
        const group = PAGE_TEMPLATE_GROUPS.find(g => g.key === pageTplGroup) || PAGE_TEMPLATE_GROUPS[0]
        return (
          <div onClick={() => setPageTplModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 14px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1000, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>افزودنِ صفحهٔ جدید</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>نوعِ صفحه را انتخاب و سپس یک قالب بزنید — هر دسته بیش از ۱۰ قالب دارد</div>
                </div>
                <button onClick={() => setPageTplModal(false)} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
              </div>

              {/* دسته‌بندیِ صفحات */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 22px 0' }}>
                {PAGE_TEMPLATE_GROUPS.map(g => (
                  <button key={g.key} onClick={() => setPageTplGroup(g.key)} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${pageTplGroup === g.key ? 'var(--gold)' : 'var(--line)'}`, background: pageTplGroup === g.key ? 'var(--goldDim)' : 'transparent', color: pageTplGroup === g.key ? 'var(--gold)' : 'var(--muted)' }}><span>{g.icon}</span>{g.label}</button>
                ))}
              </div>

              <div className="mjwb-tplgrid" style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {/* صفحهٔ خالی */}
                <button onClick={() => createPageFromTemplate(['hero', 'footer'], group.pageTitle)} className="mjwb-tplcard" style={{ textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line2)', borderRadius: 14, padding: 11, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 8 }}>
                  <span style={{ fontSize: 30, opacity: .5 }}>＋</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>صفحهٔ خالی</span>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>از صفر بسازید</span>
                </button>
                {group.items.map((pt, i) => {
                  const tplLike = { id: `pg-${group.key}-${i + 1}`, name: pt.name, profile: 'عمومی', blocks: pt.blocks, desc: '' } as typeof STARTER_TEMPLATES[0]
                  return (
                    <button key={i} onClick={() => createPageFromTemplate(pt.blocks, group.pageTitle)} className="mjwb-tplcard" style={{ textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                      <TemplateThumb tpl={tplLike} />
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', marginTop: 10 }}>{pt.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.6 }}>{pt.blocks.map(b => BLOCK_LIBRARY.find(x => x.type === b)?.label || b).join(' · ')}</div>
                      <div style={{ marginTop: 9, textAlign: 'center', padding: '7px', borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>ساختِ این صفحه</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )

  // The «قالب‌ها» gallery view — a real, full-panel template picker (reuses STARTER_TEMPLATES,
  // TemplateThumb, and the same profile-scoping as the in-builder popup). Picking a template
  // applies it via loadTemplate(...) and jumps to the builder.
  const templatesContent = (
    <div style={{ flex: 1, overflowY: 'auto', direction: 'rtl' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>قالب‌های حرفه‌ای</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {lockedProfile ? `قالب‌های مخصوص پروفایل ${lockedProfile}` : 'قالب‌های آماده'} — روی هر قالب بزنید تا اعمال شده و وارد ویرایشگر شوید
        </div>
      </div>

      {/* فقط مهمان/ادمین می‌تواند پروفایل دیگری را مرور کند */}
      {!lockedProfile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '14px 22px 0' }}>
          {PROFILE_GROUPS.map(pf => (
            <button key={pf} onClick={() => setTplFilter(pf)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tplFilter === pf ? 'var(--gold)' : 'var(--line)'}`, background: tplFilter === pf ? 'var(--goldDim)' : 'transparent', color: tplFilter === pf ? 'var(--gold)' : 'var(--muted)' }}>{pf}</button>
          ))}
        </div>
      )}

      <div className="mjwb-tplgrid" style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {STARTER_TEMPLATES.filter(t => t.profile === tplFilter).map(tpl => (
          <button
            key={tpl.id}
            onClick={() => { loadTemplate(tpl); setActiveView('editor') }}
            className="mjwb-tplcard"
            style={{ textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
          >
            <TemplateThumb tpl={tpl} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{tpl.name}</span>
              <span style={{ fontSize: 9.5, color: 'var(--gold)', border: '1px solid rgba(212,175,55,.3)', borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{tpl.profile}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3, lineHeight: 1.5 }}>{tpl.desc}</div>
            <div style={{ marginTop: 9, textAlign: 'center', padding: '7px', borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>استفاده از این قالب</div>
          </button>
        ))}
      </div>
    </div>
  )

  // ===== EMBEDDED MODE: only the inner content for the current view (no PanelReturnBar / full-page wrapper). =====
  if (embedded) {
    return (
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', color: 'var(--text)' }}>
        {activeView === 'templates' ? templatesContent : content}
      </div>
    )
  }

  // ===== STANDALONE MODE: full page, pixel-identical to the original /website-builder. =====
  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--text)', direction: 'rtl', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelReturnBar tool="وب‌سایت‌ساز" />
      {content}
    </div>
  )
}
