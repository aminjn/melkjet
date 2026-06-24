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
type ActiveTab = 'seo' | 'settings' | 'pages'

interface Block {
  id: number
  type: string
  props: Record<string, any>
}

interface Theme {
  primary: string
  font?: string
}

const DEFAULT_THEME: Theme = { primary: '#c9a84c' }

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
  },
  search: {
    heading: 'جستجوی ملک',
    placeholder: 'منطقه، شهر یا محله را وارد کنید...',
  },
  listings: {
    heading: 'آگهی‌های من',
    source: 'sample',
    count: 3,
  },
  services: {
    heading: 'خدمات ما',
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
  },
  testimonials: {
    heading: 'نظرات مشتریان',
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
    text: 'ملک‌جت',
    links: [
      { label: 'خانه', href: '#' },
      { label: 'آگهی‌ها', href: '#listings' },
      { label: 'درباره ما', href: '#about' },
      { label: 'تماس', href: '#contact' },
    ],
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
    { key: 'align', label: 'چیدمان', kind: 'enum', options: [{ value: 'center', label: 'وسط' }, { value: 'right', label: 'راست‌چین' }] },
    { key: 'bg', label: 'پس‌زمینه (CSS)', kind: 'text' },
    { key: 'textColor', label: 'رنگ متن', kind: 'color' },
  ],
  search: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'placeholder', label: 'متن راهنما', kind: 'text' },
  ],
  listings: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'source', label: 'منبع', kind: 'enum', options: [{ value: 'sample', label: 'نمونه' }, { value: 'mine', label: 'آگهی‌های من' }] },
    { key: 'count', label: 'تعداد', kind: 'number' },
  ],
  services: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'items', label: 'خدمات', kind: 'list', itemFields: [{ key: 'icon', label: 'آیکن', kind: 'text' }, { key: 'title', label: 'عنوان', kind: 'text' }, { key: 'desc', label: 'توضیح', kind: 'textarea' }], newItem: () => ({ icon: '◇', title: 'خدمت جدید', desc: 'توضیح خدمت' }) },
  ],
  about: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'text', label: 'متن', kind: 'textarea' },
    { key: 'image', label: 'تصویر', kind: 'image' },
  ],
  stats: [
    { key: 'items', label: 'آمار', kind: 'list', itemFields: [{ key: 'value', label: 'مقدار', kind: 'text' }, { key: 'label', label: 'برچسب', kind: 'text' }], newItem: () => ({ value: '۰', label: 'آمار جدید' }) },
  ],
  gallery: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'images', label: 'تصاویر', kind: 'list', itemFields: [{ key: '', label: 'تصویر', kind: 'image' }], newItem: () => '' },
  ],
  testimonials: [
    { key: 'heading', label: 'عنوان', kind: 'text' },
    { key: 'items', label: 'نظرات', kind: 'list', itemFields: [{ key: 'name', label: 'نام', kind: 'text' }, { key: 'text', label: 'متن', kind: 'textarea' }, { key: 'rating', label: 'امتیاز (۱-۵)', kind: 'number' }], newItem: () => ({ name: 'مشتری جدید', text: 'متن نظر', rating: 5 }) },
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
    { key: 'text', label: 'نام / متن', kind: 'text' },
    { key: 'links', label: 'لینک‌ها', kind: 'list', itemFields: [{ key: 'label', label: 'برچسب', kind: 'text' }, { key: 'href', label: 'آدرس', kind: 'text' }], newItem: () => ({ label: 'لینک جدید', href: '#' }) },
  ],
}

const BLOCK_LIBRARY = [
  { type: 'hero', label: 'هیرو', icon: '◇' },
  { type: 'search', label: 'نوار جستجو', icon: '⌕' },
  { type: 'listings', label: 'آگهی‌های من', icon: '⌂' },
  { type: 'services', label: 'خدمات', icon: '◈' },
  { type: 'about', label: 'درباره ما', icon: '¶' },
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
  { id: 'pro-02', name: 'مشاور مدرن', profile: 'مشاور', blocks: ['hero', 'stats', 'listings', 'about', 'footer'], desc: 'هیرو، آمار، فایل‌ها، درباره' },
  { id: 'pro-03', name: 'مشاور حرفه‌ای', profile: 'مشاور', blocks: ['hero', 'gallery', 'services', 'cta', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، اقدام، تماس' },
  { id: 'pro-04', name: 'مشاور لوکس', profile: 'مشاور', blocks: ['hero', 'about', 'listings', 'testimonials', 'cta', 'footer'], desc: 'هیرو، معرفی، فایل‌ها، نظرات' },
  { id: 'pro-05', name: 'مشاور جستجو‌محور', profile: 'مشاور', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'pro-06', name: 'مشاور کامل', profile: 'مشاور', blocks: ['hero', 'services', 'stats', 'listings', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، فایل‌ها، نظرات' },
  { id: 'pro-07', name: 'مشاور تک‌برگ', profile: 'مشاور', blocks: ['hero', 'listings', 'about', 'cta', 'footer'], desc: 'هیرو، فایل‌ها، درباره، اقدام' },
  { id: 'pro-08', name: 'مشاور تصویری', profile: 'مشاور', blocks: ['hero', 'gallery', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، فایل‌ها، نظرات، تماس' },
  { id: 'pro-09', name: 'مشاور معتبر', profile: 'مشاور', blocks: ['hero', 'about', 'stats', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، تماس' },
  { id: 'pro-10', name: 'مشاور سریع', profile: 'مشاور', blocks: ['hero', 'search', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، جستجو، خدمات، نظرات، اقدام' },

  // ───────── آژانس (۱۰) ─────────
  { id: 'agc-01', name: 'آژانس جامع', profile: 'آژانس', blocks: ['hero', 'services', 'listings', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، فایل‌ها، تیم، تماس' },
  { id: 'agc-02', name: 'آژانس لوکس', profile: 'آژانس', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات' },
  { id: 'agc-03', name: 'آژانس مدرن', profile: 'آژانس', blocks: ['hero', 'search', 'listings', 'stats', 'cta', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، آمار، اقدام' },
  { id: 'agc-04', name: 'آژانس حرفه‌ای', profile: 'آژانس', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات' },
  { id: 'agc-05', name: 'آژانس برتر', profile: 'آژانس', blocks: ['hero', 'stats', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، آمار، فایل‌ها، نظرات، تماس' },
  { id: 'agc-06', name: 'آژانس تیمی', profile: 'آژانس', blocks: ['hero', 'about', 'gallery', 'services', 'contact', 'footer'], desc: 'هیرو، تیم، گالری، خدمات، تماس' },
  { id: 'agc-07', name: 'آژانس کامل', profile: 'آژانس', blocks: ['hero', 'search', 'services', 'listings', 'testimonials', 'footer'], desc: 'هیرو، جستجو، خدمات، فایل‌ها، نظرات' },
  { id: 'agc-08', name: 'آژانس فروش', profile: 'آژانس', blocks: ['hero', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، فایل‌ها، اقدام، تماس' },
  { id: 'agc-09', name: 'آژانس معتبر', profile: 'آژانس', blocks: ['hero', 'services', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، خدمات، آمار، گالری، اقدام' },
  { id: 'agc-10', name: 'آژانس بین‌المللی', profile: 'آژانس', blocks: ['hero', 'about', 'listings', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، فایل‌ها، خدمات، نظرات، تماس' },

  // ───────── سازنده (۱۰) ─────────
  { id: 'bld-01', name: 'پیش‌فروش پروژه', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری پروژه، آمار، فرم' },
  { id: 'bld-02', name: 'سازندهٔ ساختمان', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'services', 'cta', 'footer'], desc: 'هیرو، درباره، پروژه‌ها، خدمات' },
  { id: 'bld-03', name: 'انبوه‌ساز', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، آمار، درباره، اقدام' },
  { id: 'bld-04', name: 'پروژهٔ لوکس', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات، تماس' },
  { id: 'bld-05', name: 'سازندهٔ مدرن', profile: 'سازنده', blocks: ['hero', 'stats', 'gallery', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، گالری، درباره، تماس' },
  { id: 'bld-06', name: 'برج مسکونی', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'cta', 'footer'], desc: 'هیرو، معرفی، گالری، آمار، اقدام' },
  { id: 'bld-07', name: 'مجتمع تجاری', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، آمار، تماس' },
  { id: 'bld-08', name: 'سازندهٔ کامل', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، گالری، آمار، نظرات' },
  { id: 'bld-09', name: 'پروژهٔ نمونه', profile: 'سازنده', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'bld-10', name: 'سازندهٔ معتبر', profile: 'سازنده', blocks: ['hero', 'stats', 'about', 'gallery', 'services', 'footer'], desc: 'هیرو، آمار، درباره، گالری، خدمات' },

  // ───────── فروشگاه (۱۰) ─────────
  { id: 'shp-01', name: 'فروشگاه مصالح', profile: 'فروشگاه', blocks: ['hero', 'search', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، جستجو، دسته‌ها، نظرات' },
  { id: 'shp-02', name: 'فروشگاه آنلاین', profile: 'فروشگاه', blocks: ['hero', 'search', 'listings', 'services', 'footer'], desc: 'هیرو، جستجو، محصولات، دسته‌ها' },
  { id: 'shp-03', name: 'فروشگاه مدرن', profile: 'فروشگاه', blocks: ['hero', 'search', 'services', 'gallery', 'cta', 'footer'], desc: 'هیرو، جستجو، دسته‌ها، گالری، اقدام' },
  { id: 'shp-04', name: 'فروشگاه کامل', profile: 'فروشگاه', blocks: ['hero', 'search', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، جستجو، دسته‌ها، آمار، نظرات' },
  { id: 'shp-05', name: 'فروشگاه تخصصی', profile: 'فروشگاه', blocks: ['hero', 'search', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، جستجو، محصولات، نظرات، تماس' },
  { id: 'shp-06', name: 'فروشگاه ابزار', profile: 'فروشگاه', blocks: ['hero', 'search', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، جستجو، دسته‌ها، درباره، اقدام' },
  { id: 'shp-07', name: 'فروشگاه دکوراسیون', profile: 'فروشگاه', blocks: ['hero', 'gallery', 'search', 'services', 'contact', 'footer'], desc: 'هیرو، گالری، جستجو، دسته‌ها، تماس' },
  { id: 'shp-08', name: 'فروشگاه عمده', profile: 'فروشگاه', blocks: ['hero', 'search', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، جستجو، دسته‌ها، آمار، تماس' },
  { id: 'shp-09', name: 'فروشگاه برتر', profile: 'فروشگاه', blocks: ['hero', 'search', 'listings', 'services', 'cta', 'footer'], desc: 'هیرو، جستجو، محصولات، دسته‌ها، اقدام' },
  { id: 'shp-10', name: 'فروشگاه نمونه', profile: 'فروشگاه', blocks: ['hero', 'search', 'about', 'services', 'testimonials', 'footer'], desc: 'هیرو، جستجو، درباره، دسته‌ها، نظرات' },

  // ───────── سرمایه‌گذار (۱۰) ─────────
  { id: 'inv-01', name: 'سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، آمار بازده، فرصت‌ها، اقدام' },
  { id: 'inv-02', name: 'صندوق املاک', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، آمار، درباره، اقدام' },
  { id: 'inv-03', name: 'فرصت سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'listings', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، فرصت‌ها، آمار، نظرات، تماس' },
  { id: 'inv-04', name: 'پرتفوی ملکی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، آمار، گالری، اقدام' },
  { id: 'inv-05', name: 'بازده تضمینی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },
  { id: 'inv-06', name: 'سرمایه‌گذاری مدرن', profile: 'سرمایه‌گذار', blocks: ['hero', 'about', 'stats', 'listings', 'cta', 'footer'], desc: 'هیرو، درباره، آمار، فرصت‌ها، اقدام' },
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
  { id: 'lgl-09', name: 'حقوقی کامل', profile: 'حقوقی', blocks: ['hero', 'services', 'testimonials', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، درباره، تماس' },
  { id: 'lgl-10', name: 'دفتر اسناد', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },

  // ───────── عمومی (۱۰) ─────────
  { id: 'gen-01', name: 'لندینگ فروش', profile: 'عمومی', blocks: ['hero', 'cta', 'services', 'testimonials', 'contact', 'footer'], desc: 'صفحهٔ تک‌برگ فروش با اقدام' },
  { id: 'gen-02', name: 'صفحهٔ ساده', profile: 'عمومی', blocks: ['hero', 'about', 'contact', 'footer'], desc: 'هیرو، درباره، تماس' },
  { id: 'gen-03', name: 'معرفی کسب‌وکار', profile: 'عمومی', blocks: ['hero', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام' },
  { id: 'gen-04', name: 'پرتال جستجو', profile: 'عمومی', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'gen-05', name: 'نمونه‌کار', profile: 'عمومی', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'gen-06', name: 'صفحهٔ کامل', profile: 'عمومی', blocks: ['hero', 'services', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات، تماس' },
  { id: 'gen-07', name: 'صفحهٔ شرکتی', profile: 'عمومی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },
  { id: 'gen-08', name: 'صفحهٔ رویداد', profile: 'عمومی', blocks: ['hero', 'about', 'gallery', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، گالری، اقدام، تماس' },
  { id: 'gen-09', name: 'صفحهٔ خدمات', profile: 'عمومی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'gen-10', name: 'صفحهٔ حرفه‌ای', profile: 'عمومی', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },
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
function BlockBody({ block, primary }: { block: Block; primary: string }) {
  const p = block.props || {}
  const t = block.type
  const btn = (text: string) => (
    <span style={{ display: 'inline-block', padding: '9px 24px', background: primary, borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff' }}>{text}</span>
  )

  if (t === 'hero') {
    const align = p.align === 'right' ? 'right' : 'center'
    return (
      <div style={{ background: p.bg || 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)', padding: '52px 28px', textAlign: align as any, direction: 'rtl' }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: p.textColor || '#fff', marginBottom: 10, letterSpacing: '-0.5px' }}>{p.heading}</div>
        <div style={{ fontSize: 14, color: p.textColor ? p.textColor : '#fff', opacity: 0.6, marginBottom: 22 }}>{p.subheading}</div>
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
  if (t === 'listings') {
    const n = Math.max(1, Math.min(12, Number(p.count) || 3))
    const grads = ['#2d2215,#1e1a12', '#1e2215,#141a10', '#15202d,#101828', '#251528,#1a0e1e', '#152825,#0e1a18', '#2d1515,#1e0e0e']
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 16 }}>{p.heading}</div>
        {p.source === 'mine' ? <div style={{ fontSize: 11, color: primary, marginBottom: 12 }}>↻ این بخش آگهی‌های ثبت‌شدهٔ شما را نمایش می‌دهد</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} style={{ background: '#f5f3ef', borderRadius: 10, overflow: 'hidden', border: '1px solid #eee' }}>
              <div style={{ height: 80, background: `linear-gradient(135deg,${grads[i % grads.length]})` }} />
              <div style={{ padding: '12px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1510', marginBottom: 4 }}>آپارتمان لوکس</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>تهران، منطقه نمونه</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: primary }}>قیمت توافقی</div>
              </div>
            </div>
          ))}
        </div>
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
    const imgs: string[] = Array.isArray(p.images) ? p.images.filter(Boolean) : []
    return (
      <div style={{ background: '#fff', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 14 }}>{p.heading}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {(imgs.length ? imgs : ['', '', '', '']).map((src, i) => src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />
          ) : (
            <div key={i} style={{ height: 90, background: 'linear-gradient(135deg,#2d2215,#1a1510)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.18)' }}>▥</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (t === 'testimonials') {
    const items: any[] = Array.isArray(p.items) ? p.items : []
    return (
      <div style={{ background: '#faf9f7', padding: '28px', direction: 'rtl' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1510', marginBottom: 16, textAlign: 'center' }}>{p.heading}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {items.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '16px' }}>
              <div style={{ color: primary, marginBottom: 8, fontSize: 14 }}>{'★'.repeat(Math.max(0, Math.min(5, Number(s.rating) || 5)))}</div>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.9, margin: '0 0 10px' }}>{s.text}</p>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1510' }}>{s.name}</div>
            </div>
          ))}
        </div>
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
    return (
      <div style={{ background: '#0d0b08', padding: '28px', direction: 'rtl' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: primary, marginBottom: 10 }}>{p.text}</div>
            <div style={{ fontSize: 12, color: '#777', lineHeight: 1.9 }}>همراه شما در خرید و فروش ملک.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 10 }}>لینک‌های سریع</div>
            {links.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{l.label}</div>)}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1a1510', paddingTop: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: '#444' }}>© ۱۴۰۴ — تمامی حقوق محفوظ است</span>
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

function BlockPreview({ block, primary, selected, onSelect, onUp, onDown, onDelete }: {
  block: Block
  primary: string
  selected: boolean
  onSelect: () => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const showControls = hovered || selected

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        border: selected ? '2px solid var(--gold)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'border-color .15s',
      }}
    >
      {showControls && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', alignItems: 'center',
          background: selected ? 'var(--gold)' : 'rgba(0,0,0,0.78)',
          padding: '4px 10px', gap: 6,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: selected ? '#16140f' : '#fff', flex: 1 }}>
            {BLOCK_LIBRARY.find(b => b.type === block.type)?.label || block.type}
          </span>
          <button onClick={e => { e.stopPropagation(); onUp() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
          <button onClick={e => { e.stopPropagation(); onDown() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(220,60,60,0.55)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}
      <BlockBody block={block} primary={primary} />
    </div>
  )
}

// پیش‌نمای مینیاتوری و حرفه‌ای یک قالب: یک ماکت واقعی از سایت بر اساس بلوک‌هایش
function TemplateThumb({ tpl }: { tpl: typeof STARTER_TEMPLATES[0] }) {
  const th = PROFILE_THEME[tpl.profile] || PROFILE_THEME['عمومی']
  const v = { grad: th.heroBg, primary: th.primary }
  const block = (b: string, i: number) => {
    switch (b) {
      case 'hero': return <div key={i} style={{ background: v.grad, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <div style={{ height: 6, width: '58%', background: 'rgba(255,255,255,.95)', borderRadius: 3 }} />
        <div style={{ height: 4, width: '42%', background: 'rgba(255,255,255,.6)', borderRadius: 2 }} />
        <div style={{ height: 10, width: '26%', background: '#fff', borderRadius: 5, marginTop: 4 }} />
      </div>
      case 'search': return <div key={i} style={{ padding: '9px 12px', background: '#fff' }}><div style={{ height: 11, background: '#f0f0f2', border: '1px solid #e4e4e7', borderRadius: 6 }} /></div>
      case 'listings': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', gap: 6 }}>{[0, 1, 2].map(k => <div key={k} style={{ flex: 1 }}><div style={{ height: 24, background: '#e7e7ea', borderRadius: 4, marginBottom: 4 }} /><div style={{ height: 3, width: '80%', background: '#dcdce0', borderRadius: 2, marginBottom: 3 }} /><div style={{ height: 3, width: '55%', background: '#e6e6ea', borderRadius: 2 }} /></div>)}</div>
      case 'gallery': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ height: 22, background: '#e3e3e7', borderRadius: 3 }} />)}</div>
      case 'services': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7', display: 'flex', gap: 6 }}>{[0, 1, 2].map(k => <div key={k} style={{ flex: 1, padding: 7, background: '#fff', border: '1px solid #eee', borderRadius: 5, textAlign: 'center' }}><div style={{ width: 11, height: 11, borderRadius: 3, background: v.primary, margin: '0 auto 5px' }} /><div style={{ height: 3, width: '70%', background: '#ddd', borderRadius: 2, margin: '0 auto' }} /></div>)}</div>
      case 'stats': return <div key={i} style={{ padding: '11px 12px', background: '#f5f4f1', display: 'flex', justifyContent: 'space-around' }}>{[0, 1, 2, 3].map(k => <div key={k} style={{ textAlign: 'center' }}><div style={{ height: 8, width: 20, background: v.primary, borderRadius: 2, marginBottom: 3 }} /><div style={{ height: 3, width: 26, background: '#ccc', borderRadius: 2 }} /></div>)}</div>
      case 'about': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>{[90, 80, 70, 50].map((w, k) => <div key={k} style={{ height: 3, width: `${w}%`, background: '#dcdce0', borderRadius: 2 }} />)}</div><div style={{ width: 44, height: 34, background: '#e7e7ea', borderRadius: 5 }} /></div>
      case 'testimonials': return <div key={i} style={{ padding: '9px 12px', background: '#faf9f7' }}><div style={{ padding: 8, background: '#fff', border: '1px solid #eee', borderRadius: 6 }}>{[85, 65].map((w, k) => <div key={k} style={{ height: 3, width: `${w}%`, background: '#dadade', borderRadius: 2, marginBottom: 4 }} />)}<div style={{ height: 6, width: 28, background: '#e3e3e7', borderRadius: 3, marginTop: 5 }} /></div></div>
      case 'cta': return <div key={i} style={{ padding: '14px 12px', background: v.grad, display: 'flex', justifyContent: 'center' }}><div style={{ height: 10, width: '32%', background: '#fff', borderRadius: 5 }} /></div>
      case 'contact': return <div key={i} style={{ padding: '9px 12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 5 }}>{[100, 100, 60].map((w, k) => <div key={k} style={{ height: 9, width: `${w}%`, background: '#f1f1f3', border: '1px solid #e6e6e6', borderRadius: 3 }} />)}</div>
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

export default function WebsiteBuilderTool({ embedded = false, view: viewProp, onView }: { embedded?: boolean; view?: WebsiteView; onView?: (v: WebsiteView) => void }) {
  // Default to 'editor' so standalone /website-builder stays pixel-identical (always the builder).
  const [internalView, setInternalView] = useState<WebsiteView>('editor')
  const activeView: WebsiteView = viewProp ?? internalView
  const setActiveView = (v: WebsiteView) => { onView ? onView(v) : setInternalView(v) }

  const [blocks, setBlocks] = useState<Block[]>([
    makeBlock('hero'),
    makeBlock('search'),
    makeBlock('listings'),
  ])
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [tplFilter, setTplFilter] = useState('عمومی')
  // پروفایل قفل‌شده بر اساس نقش کاربر؛ null یعنی مهمان/ادمین (می‌تواند همه را ببیند)
  const [lockedProfile, setLockedProfile] = useState<string | null>(null)
  const [tplModal, setTplModal] = useState(false)
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
  const [pages, setPages] = useState([
    { id: 'home', label: 'صفحه اصلی', active: true },
    { id: 'listings', label: 'فایل‌ها / محصولات', active: false },
    { id: 'about', label: 'درباره ما', active: false },
    { id: 'contact', label: 'تماس', active: false },
  ])

  // اسکوپ خودکار قالب‌ها بر اساس نقش کاربر واردشده
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
      })
      .catch(() => { /* در صورت خطا روی پیش‌فرض «عمومی» می‌ماند */ })
    return () => { cancelled = true }
  }, [])

  const pushHistory = (b: Block[]) => setHistory(h => [...h.slice(-19), b])

  const addBlock = (type: string) => {
    pushHistory(blocks)
    const nb = makeBlock(type)
    setBlocks(prev => [...prev, nb])
    setSelectedBlock(nb.id)
    setActiveTab('settings')
  }

  const loadTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    pushHistory(blocks)
    const th = PROFILE_THEME[tpl.profile] || PROFILE_THEME['عمومی']
    const copy = PROFILE_HERO_COPY[tpl.profile] || PROFILE_HERO_COPY['عمومی']
    // Apply the template's theme so each preset really looks distinct.
    setTheme({ primary: th.primary })
    const nb = tpl.blocks.map(type => {
      // Per-template presets: distinct hero copy + hero/cta bg matching the theme.
      let preset: Record<string, any> | undefined
      if (type === 'hero') preset = { heading: copy.heading, subheading: copy.subheading, buttonText: copy.buttonText, bg: th.heroBg }
      else if (type === 'cta') preset = { bg: th.heroBg }
      else if (type === 'footer') preset = { text: tpl.name }
      return makeBlock(type, preset)
    })
    setBlocks(nb)
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

  const addPage = () => {
    setPages(prev => [...prev, { id: `page_${Date.now()}`, label: 'صفحه جدید', active: false }])
  }

  // Persist the current site (draft). Returns the server-resolved slug, or null on failure.
  const persistSite = async (): Promise<{ slug: string; url: string } | null> => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: seoTitle,
        blocks: blocks.map(b => ({ id: b.id, type: b.type, props: b.props })),
        seo: { title: seoTitle, description: seoDesc },
        theme,
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
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>وب‌سایت‌ساز ملک‌جت</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', direction: 'ltr', lineHeight: 1.3 }}>melkjet.com/{slug}</div>
          </div>
        </div>

        <button
          onClick={() => setTplModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', flexShrink: 0 }}
        >
          <span style={{ fontSize: 14 }}>▦</span>
          <span>قالب‌ها</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Device toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 9, padding: 3, gap: 2 }}>
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

        <div style={{ width: 1, height: 24, background: 'var(--line)', flexShrink: 0 }} />

        <button
          onClick={undo}
          disabled={history.length === 0}
          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: history.length > 0 ? 'var(--text)' : 'var(--faint)', cursor: history.length > 0 ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}
        >↩ واگرد</button>
        <button style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--faint)', cursor: 'default', fontSize: 12, fontWeight: 600 }}>
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
        }}>
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
        <div style={{
          flex: 1, background: 'var(--bg)', overflowY: 'auto', overflowX: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: device !== 'desktop' ? 'center' : 'stretch',
          padding: device !== 'desktop' ? '20px' : 0,
        }}>
          <div style={{
            width: canvasWidth,
            minHeight: '100%',
            background: '#fff',
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

            {/* Canvas blocks */}
            <div style={{ direction: 'rtl' }}>
              {blocks.length === 0 ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 44, opacity: 0.15 }}>◈</div>
                  <div style={{ fontSize: 14, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.8 }}>
                    از پنل سمت راست یک قالب انتخاب کنید<br />
                    <span style={{ fontSize: 12 }}>یا بلوک‌ها را یکی یکی اضافه نمایید</span>
                  </div>
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
                    }}
                    onUp={() => moveBlock(block.id, -1)}
                    onDown={() => moveBlock(block.id, 1)}
                    onDelete={() => deleteBlock(block.id)}
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
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            {([
              ['seo', 'سئو'],
              ['settings', 'تنظیمات بلوک'],
              ['pages', 'صفحات'],
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>رنگ اصلی سایت (تم)</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <input type="color" value={theme.primary} onChange={e => setTheme(t => ({ ...t, primary: e.target.value }))} style={{ width: 44, height: 36, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg2)', cursor: 'pointer', padding: 2 }} />
                    <input value={theme.primary} onChange={e => setTheme(t => ({ ...t, primary: e.target.value }))} style={{ ...INSPECTOR_INPUT, flex: 1, direction: 'ltr' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['#c9a84c', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#10b981', '#64748b', '#e05050'].map(c => (
                      <button key={c} onClick={() => setTheme(t => ({ ...t, primary: c }))} style={{ width: 26, height: 26, borderRadius: 7, background: c, border: theme.primary === c ? '2px solid var(--text)' : '2px solid var(--line)', cursor: 'pointer', flexShrink: 0 }} />
                    ))}
                  </div>
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
                                <div key={idx} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
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

            {/* Pages Tab */}
            {activeTab === 'pages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>صفحات سایت</div>
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: idx === 0 ? 'var(--goldDim)' : 'var(--surface)',
                      border: `1px solid ${idx === 0 ? 'var(--gold)' : 'var(--line)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 12, color: idx === 0 ? 'var(--gold)' : 'var(--faint)' }}>◰</span>
                    <span style={{ fontSize: 12, fontWeight: idx === 0 ? 700 : 400, color: idx === 0 ? 'var(--gold)' : 'var(--text)' }}>{page.label}</span>
                    {idx === 0 && <span style={{ marginRight: 'auto', fontSize: 9, color: 'var(--gold)', background: 'rgba(201,168,76,0.2)', padding: '2px 7px', borderRadius: 10 }}>فعال</span>}
                  </div>
                ))}
                <button
                  onClick={addPage}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginTop: 4 }}
                >
                  <span>+</span><span>صفحه جدید</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
