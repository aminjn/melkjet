'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'

// ─── Types ───────────────────────────────────────────────────────────────────

type RoleId = 'advisor' | 'agency' | 'builder' | 'materials' | 'architect' | 'contractor' | 'appraiser' | 'legal' | 'bank' | 'notary'

interface Service { ic: string; l: string; desc: string; bg: string; color: string }
interface PortfolioItem { l: string; meta: string; img: string }
interface ContactItem { ic: string; l: string; v: string }
interface Achievement { ic: string; l: string; desc: string }
interface ReviewItem { n: string; r: string; av: string; t: string }
interface SimilarProfile { name: string; title: string; rating: string; deals: string; av: string }

interface Profile {
  name: string; initial: string; roleLabel: string; av: string; cover: string; rating: string;
  stat1: string; stat2: string; area: string; cta: string; color: string;
  bio: string; experience: string; responseTime: string; activeListings: number; salesYear: number;
  services: Service[];
  portfolio: PortfolioItem[];
  contact: ContactItem[];
  specs: string[];
  achievements: Achievement[];
  chartData: number[];
  areas: string[];
  certs: string[];
  reviewList: ReviewItem[];
  similarProfiles: SimilarProfile[];
}

// ─── Real advisor (public API) ─────────────────────────────────────────────────

interface AdvisorListing { id: string; title: string; price?: string; location?: string; image?: string }
interface AdvisorPublic {
  phone: string; name: string; title: string; bio: string; contactPhone: string;
  areas: string; experience: string; photo: string; specialties: string[];
  agency: { name: string; phone: string } | null;
  stats: { activeListings: number; deals: number; totalListings: number };
  listings: AdvisorListing[];
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const roleTabs: { id: RoleId; label: string; ic: string }[] = [
  { id: 'advisor', label: 'مشاور', ic: '◌' },
  { id: 'agency', label: 'آژانس', ic: '◉' },
  { id: 'builder', label: 'سازنده', ic: '▦' },
  { id: 'materials', label: 'مصالح‌فروش', ic: '⛓' },
  { id: 'architect', label: 'معمار', ic: '△' },
  { id: 'contractor', label: 'پیمانکار', ic: '⚒' },
  { id: 'appraiser', label: 'کارشناس', ic: '◎' },
  { id: 'legal', label: 'حقوقی', ic: '⚖' },
  { id: 'bank', label: 'بانک/بیمه', ic: '⛁' },
  { id: 'notary', label: 'دفترخانه', ic: '❖' },
]

const chartMonths = ['تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند', 'فرو', 'ارد', 'خرد']

const sharedReviews: ReviewItem[] = [
  { n: 'علی کریمی', r: '۵٫۰', av: 'linear-gradient(135deg,#7a8fae,#465a78)', t: 'بسیار حرفه‌ای و دقیق. کل فرایند سریع و شفاف بود و کاملاً راضی‌ام.' },
  { n: 'نگار عباسی', r: '۴٫۸', av: 'linear-gradient(135deg,#b07a8a,#6e4754)', t: 'پاسخ‌گویی عالی و مشاوره صادقانه. حتماً دوباره مراجعه می‌کنم.' },
  { n: 'کاوه مرادی', r: '۵٫۰', av: 'linear-gradient(135deg,#7aa88f,#476e58)', t: 'تخصص و تجربه کاملاً مشخص بود؛ بهترین انتخابم بود.' },
  { n: 'مریم رستمی', r: '۴٫۷', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)', t: 'خیلی صبور و راهنما بود. هیچ فشاری برای فروش احساس نکردم.' },
]

const profiles: Record<RoleId, Profile> = {
  advisor: {
    name: 'سارا محمدی', initial: 'س', roleLabel: 'مشاور املاک',
    av: 'linear-gradient(135deg,#caa86a,#8a6f3e)', cover: 'linear-gradient(120deg,#2a2620,#3a3530)',
    rating: '۴٫۹', stat1: '۱۲۴ معامله', stat2: '۸ سال سابقه', area: 'زعفرانیه',
    cta: 'درخواست مشاوره', color: 'var(--gold)',
    bio: 'با بیش از ۸ سال تجربه در بازار لوکس تهران، تخصص اصلی من مشاوره خرید و فروش آپارتمان‌های لوکس در زعفرانیه، سعادت‌آباد و الهیه است. رویکرد من کاملاً شفاف و داده‌محور است؛ قیمت‌گذاری با AI و تحلیل دقیق بازار از ارکان اصلی خدماتم است.',
    experience: '۸ سال', responseTime: '۲۲ دقیقه', activeListings: 18, salesYear: 34,
    services: [
      { ic: '◌', l: 'خرید و فروش لوکس', desc: 'مشاوره تخصصی املاک لوکس زعفرانیه و سعادت‌آباد', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '⌂', l: 'اجاره و رهن', desc: 'یافتن سریع مستأجر و موجر معتبر', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '◔', l: 'تحلیل قیمت AI', desc: 'ارزیابی منصفانه با هوش مصنوعی', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '✦', l: 'سرمایه‌گذاری', desc: 'معرفی فرصت‌های بازده بالا', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
    ],
    portfolio: [
      { l: 'آپارتمان ۱۴۰م', meta: '۱۷٫۸ م', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'پنت‌هاوس زعفرانیه', meta: '۸۵ م', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'ویلا لواسان', meta: '۱۲۰ م', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'دوبلکس الهیه', meta: '۴۵ م', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'آپارتمان ونک', meta: '۹٫۲ م', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
      { l: 'نوساز جردن', meta: '۱۴٫۵ م', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
    ],
    contact: [
      { ic: '✆', l: 'موبایل', v: '۰۹۱۲-***-۶۷۸۹' },
      { ic: '◍', l: 'دفتر', v: 'زعفرانیه، خیابان ولنجک' },
      { ic: '◧', l: 'وب‌سایت', v: 'sara-realty.melkjet.site' },
    ],
    specs: ['آپارتمان لوکس', 'سرمایه‌گذاری', 'ملک تجاری', 'زعفرانیه', 'سعادت‌آباد', 'الهیه', 'ویلا', 'رهن و اجاره'],
    achievements: [
      { ic: '★', l: 'مشاور برتر سال ۱۴۰۳', desc: 'از میان ۲۸۰۰ مشاور فعال ملک‌جت' },
      { ic: '✓', l: 'تأییدیه رسمی', desc: 'دارای مجوز رسمی مشاور املاک' },
      { ic: '◎', l: 'ارزیاب تخصصی AI', desc: 'گذرانده دوره تحلیل بازار با هوش مصنوعی' },
    ],
    chartData: [8, 11, 7, 14, 9, 16, 12, 18, 10, 15, 13, 17],
    areas: ['زعفرانیه', 'سعادت‌آباد', 'الهیه', 'ولنجک', 'اوین', 'نیاوران'],
    certs: ['مجوز رسمی کانون مشاوران', 'گواهی تحلیل AI بازار مسکن', 'عضو اتحادیه مشاوران تهران', 'دوره ارزیابی ملک'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'علی رضایی', title: 'مشاور لوکس · ونک', rating: '۴٫۸', deals: '۲۱۰', av: 'linear-gradient(135deg,#5b9bd5,#2f5f8a)' },
      { name: 'نیلوفر صادقی', title: 'مشاور ارشد · الهیه', rating: '۴٫۷', deals: '۱۷۸', av: 'linear-gradient(135deg,#b07a8a,#6e4754)' },
    ],
  },
  agency: {
    name: 'املاک پارسیان', initial: 'پ', roleLabel: 'آژانس املاک',
    av: 'linear-gradient(135deg,#7a8fae,#465a78)', cover: 'linear-gradient(120deg,#23272e,#33394a)',
    rating: '۴٫۸', stat1: '۵ شعبه', stat2: '۳۸ مشاور', area: 'تهران',
    cta: 'تماس با آژانس', color: '#7a8fae',
    bio: 'آژانس پارسیان با ۱۵ سال سابقه درخشان، ۵ شعبه فعال در مناطق برتر تهران و تیمی از ۳۸ مشاور تأییدشده، یکی از معتبرترین آژانس‌های کشور است.',
    experience: '۱۵ سال', responseTime: '۱۵ دقیقه', activeListings: 47, salesYear: 128,
    services: [
      { ic: '◉', l: 'شبکه شعب', desc: '۵ شعبه فعال در مناطق برتر تهران', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '◍', l: 'تیم مشاوران', desc: '۳۸ مشاور تأییدشده', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '◔', l: 'مدیریت پورتفولیو', desc: 'صدها فایل به‌روز', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '✦', l: 'خدمات سازمانی', desc: 'قرارداد با شرکت‌ها', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
    ],
    portfolio: [
      { l: 'برج لوکس آرین', meta: '۲۲ م', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'مجتمع نگین', meta: '۱۴ م', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'اداری میرداماد', meta: '۶٫۸ م', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'ویلای فرمانیه', meta: '۳۸ م', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'آپارتمان ونک', meta: '۱۱ م', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'دفتر شریعتی', meta: '۴٫۵ م', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'تماس مرکزی', v: '۰۲۱-۸۸۸۸-۸۸۸۸' },
      { ic: '◍', l: 'دفتر مرکزی', v: 'ونک، خیابان وزرا' },
      { ic: '◧', l: 'وب‌سایت', v: 'parsian.melkjet.site' },
    ],
    specs: ['فروش لوکس', 'اجاره تجاری', 'مدیریت ملک', 'مشاوره سازمانی', 'شمال تهران'],
    achievements: [
      { ic: '★', l: 'آژانس برتر ۵ ستاره', desc: 'رتبه اول پلتفرم ملک‌جت ۱۴۰۳' },
      { ic: '✓', l: 'مجوز اتحادیه', desc: 'دارای جواز رسمی اتحادیه مشاوران' },
      { ic: '◉', l: '۵ شعبه فعال', desc: 'گسترده‌ترین شبکه در تهران' },
    ],
    chartData: [22, 28, 19, 31, 26, 38, 29, 42, 33, 37, 30, 41],
    areas: ['ونک', 'میرداماد', 'شریعتی', 'زعفرانیه', 'سعادت‌آباد'],
    certs: ['مجوز رسمی اتحادیه ۱۴۰۰', 'تأیید کیفیت ISO 9001', 'گواهی حرفه‌ای مشاوران'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'آژانس ملت', title: 'آژانس · شمال تهران', rating: '۴٫۶', deals: '۳۴۰', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)' },
      { name: 'گروه مسکن آریا', title: 'آژانس · مرکز', rating: '۴٫۵', deals: '۲۸۰', av: 'linear-gradient(135deg,#7aa88f,#476e58)' },
    ],
  },
  builder: {
    name: 'گروه ساختمانی آرین', initial: 'آ', roleLabel: 'سازنده / انبوه‌ساز',
    av: 'linear-gradient(135deg,#9b7ad0,#5e4488)', cover: 'linear-gradient(120deg,#2a2433,#3a3045)',
    rating: '۴٫۷', stat1: '۱۲ پروژه', stat2: '۱٬۸۰۰ واحد', area: 'سعادت‌آباد',
    cta: 'مشاهده پروژه‌ها', color: '#9b7ad0',
    bio: 'گروه ساختمانی آرین با ۲۰ سال تجربه در ساخت‌وساز لوکس، بیش از ۱۲ پروژه موفق و ۱۸۰۰ واحد تحویل‌داده‌شده، یکی از پیشتازان صنعت ساختمان ایران است.',
    experience: '۲۰ سال', responseTime: '۴۸ ساعت', activeListings: 3, salesYear: 12,
    services: [
      { ic: '▦', l: 'ساخت و ساز', desc: 'پروژه‌های مسکونی و تجاری', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
      { ic: '◔', l: 'پیش‌فروش', desc: 'واحدهای پیش‌فروش با اقساط', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '✦', l: 'مشارکت در ساخت', desc: 'همکاری با مالکان زمین', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '◧', l: 'سرمایه‌گذاری', desc: 'جذب سرمایه‌گذار پروژه', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
    ],
    portfolio: [
      { l: 'برج آرین', meta: 'پیش‌فروش', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'مجتمع نگین', meta: 'در حال ساخت', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'باغ‌برج دیپلمات', meta: 'آماده تحویل', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'رزیدنس پارک', meta: 'تحویل‌شده', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'برج صدرا', meta: 'تحویل‌شده', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'مجتمع شهباز', meta: 'تحویل‌شده', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'دفتر فروش', v: '۰۲۱-۲۲۲۲-۲۲۲۲' },
      { ic: '◍', l: 'دفتر مرکزی', v: 'سعادت‌آباد، بلوار دریا' },
      { ic: '◧', l: 'وب‌سایت', v: 'arian.melkjet.site' },
    ],
    specs: ['مسکونی لوکس', 'مشارکت در ساخت', 'پیش‌فروش', 'سرمایه‌گذاری', 'برج‌سازی'],
    achievements: [
      { ic: '▦', l: 'سازنده سال ۱۴۰۲', desc: 'جایزه بهترین کیفیت ساخت' },
      { ic: '✓', l: 'گواهی ایمنی ساخت', desc: 'استاندارد ملی ۲۸۰۰' },
      { ic: '★', l: '۱۸۰۰ واحد تحویلی', desc: 'صفر پرونده قضایی معوقه' },
    ],
    chartData: [1, 2, 1, 3, 2, 4, 2, 3, 1, 2, 3, 2],
    areas: ['سعادت‌آباد', 'شهرک غرب', 'پونک', 'جنت‌آباد'],
    certs: ['پروانه ساخت رسمی', 'تأیید کیفیت ساختمانی', 'گواهی رتبه‌بندی پیمانکار'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'شرکت ساختمان مدرن', title: 'سازنده · تهران', rating: '۴٫۵', deals: '۸', av: 'linear-gradient(135deg,#7a8fae,#465a78)' },
      { name: 'گروه نگین ساز', title: 'انبوه‌ساز · غرب', rating: '۴٫۶', deals: '۱۵', av: 'linear-gradient(135deg,#c98a4a,#8a5a2e)' },
    ],
  },
  materials: {
    name: 'مصالح تهران', initial: 'م', roleLabel: 'فروشنده مصالح',
    av: 'linear-gradient(135deg,#7aa88f,#476e58)', cover: 'linear-gradient(120deg,#222a26,#2f3a34)',
    rating: '۴٫۶', stat1: '۸۴۰ محصول', stat2: '۱٬۲۰۰ سفارش', area: 'سراسری',
    cta: 'دریافت پیش‌فاکتور', color: '#7aa88f',
    bio: 'مصالح تهران با بیش از ۸۴۰ محصول ساختمانی و تأمین مستقیم از کارخانه‌های معتبر کشور، سریع‌ترین و مطمئن‌ترین منبع تأمین مصالح برای سازندگان است.',
    experience: '۱۲ سال', responseTime: '۲ ساعت', activeListings: 840, salesYear: 1200,
    services: [
      { ic: '▭', l: 'آهن و میلگرد', desc: 'عرضه عمده با قیمت روز', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '◳', l: 'سیمان و گچ', desc: 'تأمین فوری پروژه', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '▦', l: 'کاشی و سرامیک', desc: 'تنوع بالا از اول کیفی', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
      { ic: '✦', l: 'استعلام عمده', desc: 'پیشنهاد قیمت برای سازندگان', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
    ],
    portfolio: [
      { l: 'میلگرد A3', meta: 'از ۲۸ ت/کیلو', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'سیمان تیپ ۲', meta: 'از ۴۵ ت/پاکت', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'کاشی پرسلان', meta: 'از ۱۸۰ ت/متر', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'آجر نما', meta: 'از ۱۲۰ ت/عدد', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'بلوک سبک', meta: 'از ۵۵ ت/عدد', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'رنگ ساختمانی', meta: 'از ۸۰ ت/لیتر', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'سفارش', v: '۰۲۱-۳۳۳۳-۳۳۳۳' },
      { ic: '◍', l: 'انبار مرکزی', v: 'شهرک صنعتی عباس‌آباد' },
      { ic: '◧', l: 'وب‌سایت', v: 'tehran-mat.melkjet.site' },
    ],
    specs: ['آهن و فولاد', 'سیمان', 'کاشی سرامیک', 'عایق‌بندی', 'رنگ ساختمانی'],
    achievements: [
      { ic: '▭', l: 'تأمین‌کننده برتر ۱۴۰۳', desc: 'از نظر تعداد سازندگان فعال' },
      { ic: '✓', l: 'ایزو کیفیت', desc: 'گواهینامه ISO 9001:2015' },
      { ic: '★', l: '۱۲۰۰+ سفارش امسال', desc: 'بدون پرونده مرجوعی' },
    ],
    chartData: [80, 110, 95, 130, 115, 148, 122, 160, 135, 145, 128, 155],
    areas: ['تهران', 'کرج', 'اصفهان', 'شیراز', 'مشهد', 'سراسری'],
    certs: ['ایزو کیفیت ۹۰۰۱', 'تأیید استاندارد ملی ایران', 'عضو اتحادیه مصالح ساختمانی'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'مصالح ایران‌ساز', title: 'عمده‌فروش · تهران', rating: '۴٫۴', deals: '۹۸۰', av: 'linear-gradient(135deg,#c98a4a,#8a5a2e)' },
      { name: 'بازار آهن کرج', title: 'فولاد · کرج', rating: '۴٫۳', deals: '۵۶۰', av: 'linear-gradient(135deg,#7a8fae,#465a78)' },
    ],
  },
  architect: {
    name: 'استودیو طراحی نقش', initial: 'ن', roleLabel: 'معمار / طراح داخلی',
    av: 'linear-gradient(135deg,#c97a9a,#7a4458)', cover: 'linear-gradient(120deg,#2a232a,#3a303a)',
    rating: '۴٫۹', stat1: '۹۲ پروژه', stat2: '۱۲ سال', area: 'تهران',
    cta: 'رزرو مشاوره طراحی', color: '#c97a9a',
    bio: 'استودیو نقش با ۱۲ سال سابقه در طراحی معماری و دکوراسیون داخلی، رویکردی منحصربه‌فرد در ترکیب فضای ایرانی با مفاهیم مدرن دارد. تیم ما از ابتدای کانسپت تا پایان اجرا همراه شماست.',
    experience: '۱۲ سال', responseTime: '۴ ساعت', activeListings: 92, salesYear: 28,
    services: [
      { ic: '△', l: 'طراحی معماری', desc: 'نقشه و نما و مدل سه‌بعدی', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
      { ic: '◑', l: 'طراحی داخلی', desc: 'دکوراسیون و چیدمان فضا', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '▥', l: 'مودبورد و کانسپت', desc: 'ایده‌پردازی با AI', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '✦', l: 'نظارت اجرا', desc: 'هماهنگی با پیمانکار', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
    ],
    portfolio: [
      { l: 'پنت‌هاوس مدرن', meta: 'مسکونی', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'کافه صنعتی', meta: 'تجاری', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'لابی هتل', meta: 'هتلداری', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'استودیو موسیقی', meta: 'خاص', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'دفتر کار خلاق', meta: 'اداری', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
      { l: 'ویلا باغی', meta: 'مسکونی', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
    ],
    contact: [
      { ic: '✆', l: 'استودیو', v: '۰۹۱۲-۸۸۸-۸۸۸۸' },
      { ic: '◍', l: 'آدرس', v: 'جردن، خیابان لارستان' },
      { ic: '◧', l: 'وب‌سایت', v: 'naghsh.melkjet.site' },
    ],
    specs: ['طراحی لوکس', 'مینیمال', 'کلاسیک مدرن', 'فضای تجاری', 'خانه هوشمند'],
    achievements: [
      { ic: '△', l: 'معمار برگزیده ۱۴۰۲', desc: 'جایزه طراحی بهترین فضای مسکونی' },
      { ic: '✓', l: 'عضو نظام مهندسی', desc: 'پروانه اشتغال پایه یک' },
      { ic: '★', l: '۹۲ پروژه موفق', desc: 'بدون تأخیر در تحویل نقشه' },
    ],
    chartData: [2, 3, 2, 4, 3, 5, 3, 4, 2, 3, 4, 3],
    areas: ['تهران', 'کرج', 'اصفهان', 'مشهد'],
    certs: ['مجوز نظام مهندسی پایه ۱', 'دوره طراحی پارامتریک', 'گواهی طراحی پایدار'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'دفتر معماری آبان', title: 'معمار · شمال تهران', rating: '۴٫۷', deals: '۶۸', av: 'linear-gradient(135deg,#7a8fae,#465a78)' },
      { name: 'استودیو ایده', title: 'طراح داخلی · تهران', rating: '۴٫۸', deals: '۵۴', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)' },
    ],
  },
  contractor: {
    name: 'پیمانکاری عمران‌سازه', initial: 'ع', roleLabel: 'پیمانکار',
    av: 'linear-gradient(135deg,#c98a4a,#8a5a2e)', cover: 'linear-gradient(120deg,#2a2620,#3a3025)',
    rating: '۴٫۷', stat1: '۵ پروژه فعال', stat2: 'رتبه ۳', area: 'تهران',
    cta: 'درخواست مناقصه', color: '#c98a4a',
    bio: 'پیمانکاری عمران‌سازه با رتبه ۳ ابنیه و بیش از ۱۸ سال سابقه در اجرای پروژه‌های ساختمانی، آماده همکاری با سازندگان و صاحبان پروژه است.',
    experience: '۱۸ سال', responseTime: '۶ ساعت', activeListings: 5, salesYear: 9,
    services: [
      { ic: '⚒', l: 'اجرای اسکلت', desc: 'بتنی و فلزی', bg: 'rgba(201,138,74,0.15)', color: '#c98a4a' },
      { ic: '▦', l: 'نازک‌کاری', desc: 'گچ، کاشی، نقاشی', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '✦', l: 'تأسیسات', desc: 'مکانیکال و الکتریکال', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '◔', l: 'مدیریت پیمان', desc: 'نظارت و زمان‌بندی', bg: 'var(--goldDim)', color: 'var(--gold)' },
    ],
    portfolio: [
      { l: 'اسکلت برج آرین', meta: '۱۸ طبقه', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'نازک‌کاری نگین', meta: '۹۶ واحد', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'محوطه لواسان', meta: 'تحویل‌شده', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'برج اداری', meta: '۱۲ طبقه', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'مجتمع شهباز', meta: 'کامل', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'پروژه نگین', meta: 'فاز ۲', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'دفتر', v: '۰۹۱۲-۷۷۷-۷۷۷۷' },
      { ic: '◍', l: 'آدرس', v: 'تهرانپارس، خیابان ۱۸۲' },
      { ic: '◧', l: 'وب‌سایت', v: 'omransaze.melkjet.site' },
    ],
    specs: ['اسکلت بتنی', 'اسکلت فلزی', 'نازک‌کاری', 'تأسیسات مکانیکی', 'تأسیسات برق'],
    achievements: [
      { ic: '⚒', l: 'رتبه ۳ ابنیه', desc: 'سازمان برنامه و بودجه' },
      { ic: '✓', l: 'ایمنی کار ممتاز', desc: '۰ حادثه کاری در ۵ سال' },
      { ic: '★', l: '۱۸ سال بی‌وقفه', desc: 'صفر پروژه ناتمام‌مانده' },
    ],
    chartData: [1, 1, 2, 1, 2, 3, 2, 2, 1, 2, 1, 2],
    areas: ['تهران', 'کرج', 'اسلامشهر', 'شهریار'],
    certs: ['رتبه ۳ ابنیه سازمان برنامه', 'تأیید ایمنی کار ISO 45001', 'دوره مدیریت پیمان'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'شرکت ابنیه‌سازان', title: 'پیمانکار · تهران', rating: '۴٫۵', deals: '۱۲', av: 'linear-gradient(135deg,#5b9bd5,#2f5f8a)' },
      { name: 'گروه عمران نو', title: 'پیمانکار · غرب', rating: '۴٫۴', deals: '۸', av: 'linear-gradient(135deg,#7aa88f,#476e58)' },
    ],
  },
  appraiser: {
    name: 'کارشناس رضا کاویانی', initial: 'ر', roleLabel: 'کارشناس رسمی',
    av: 'linear-gradient(135deg,#5b9bd5,#2f5f8a)', cover: 'linear-gradient(120deg,#222730,#2f3a4a)',
    rating: '۵٫۰', stat1: '۳۲۰ ارزیابی', stat2: '۱۵ سال', area: 'تهران',
    cta: 'درخواست ارزیابی', color: '#5b9bd5',
    bio: 'کارشناس رسمی دادگستری با ۱۵ سال سابقه در ارزیابی انواع ملک. گزارش‌های ارزیابی ما مورد تأیید بانک‌ها، دادگاه‌ها و سازمان‌های دولتی است.',
    experience: '۱۵ سال', responseTime: '۲۴ ساعت', activeListings: 320, salesYear: 85,
    services: [
      { ic: '◎', l: 'ارزیابی ملک', desc: 'برآورد ارزش رسمی دادگستری', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '⚖', l: 'کارشناسی قضایی', desc: 'گزارش برای دادگاه', bg: 'rgba(201,138,74,0.15)', color: '#c98a4a' },
      { ic: '◔', l: 'ارزیابی وام', desc: 'برای تسهیلات بانکی', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '✦', l: 'تحلیل با داده AI', desc: 'پشتیبانی هوش مصنوعی', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
    ],
    portfolio: [
      { l: 'مسکونی تهران', meta: '۱۸۵ ملک', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'تجاری و اداری', meta: '۷۸ واحد', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'زمین و کشاورزی', meta: '۵۷ پرونده', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'صنعتی و انبار', meta: '۲۴ پرونده', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'ارزیابی بانکی', meta: '۱۲۰ مورد', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'کارشناسی قضایی', meta: '۶۸ پرونده', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'موبایل', v: '۰۹۱۲-۶۶۶-۶۶۶۶' },
      { ic: '◍', l: 'دفتر', v: 'میرداماد، خیابان البرز' },
      { ic: '◧', l: 'وب‌سایت', v: 'kaviani.melkjet.site' },
    ],
    specs: ['مسکونی', 'تجاری', 'صنعتی', 'زمین', 'ارزیابی بانکی', 'کارشناسی قضایی'],
    achievements: [
      { ic: '◎', l: 'کارشناس رسمی دادگستری', desc: 'کد ۱۲۳۴۵ سازمان قضایی' },
      { ic: '✓', l: 'عضو کانون کارشناسان', desc: 'استان تهران پایه یک' },
      { ic: '★', l: '۳۲۰ ارزیابی موفق', desc: 'صد در صد پذیرفته‌شده در دادگاه' },
    ],
    chartData: [22, 28, 19, 31, 24, 36, 28, 32, 25, 29, 27, 33],
    areas: ['تهران', 'کرج', 'اصفهان'],
    certs: ['کارشناس رسمی دادگستری', 'عضو کانون کارشناسان ایران', 'دوره ارزیابی با داده AI'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'کارشناس حسینی', title: 'ارزیاب رسمی · تهران', rating: '۴٫۸', deals: '۲۴۵', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)' },
      { name: 'دکتر رحمانی', title: 'ارزیاب · شمال', rating: '۴٫۷', deals: '۱۸۶', av: 'linear-gradient(135deg,#c97a9a,#7a4458)' },
    ],
  },
  legal: {
    name: 'دفتر حقوقی عدل', initial: 'ع', roleLabel: 'دفتر حقوقی / وکیل',
    av: 'linear-gradient(135deg,#5a7a9c,#34506e)', cover: 'linear-gradient(120deg,#222831,#2f3d4e)',
    rating: '۴٫۸', stat1: '۲۴۰ پرونده', stat2: '۹۱٪ موفقیت', area: 'تهران',
    cta: 'رزرو مشاوره حقوقی', color: '#5a7a9c',
    bio: 'دفتر حقوقی عدل با تیمی از وکلای متخصص در حوزه ملک و ساختمان، بیش از ۲۴۰ پرونده قضایی و غیرقضایی را با نرخ موفقیت ۹۱ درصد به پایان رسانده است.',
    experience: '۱۴ سال', responseTime: '۱ ساعت', activeListings: 240, salesYear: 60,
    services: [
      { ic: '⚖', l: 'دعاوی ملکی', desc: 'خلع ید، الزام به تنظیم سند', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '⎙', l: 'تنظیم قرارداد', desc: 'مشارکت، پیش‌فروش، اجاره', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '◔', l: 'مشاوره حقوقی', desc: '۲۴ ساعته با دستیار AI', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '✦', l: 'داوری و مذاکره', desc: 'حل اختلاف ملکی', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
    ],
    portfolio: [
      { l: 'دعاوی ملکی', meta: '۱۲۸ پرونده', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'قراردادها', meta: '۸۵ مورد', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'ارث و وقف', meta: '۲۷ مورد', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'مشارکت ساخت', meta: '۴۲ قرارداد', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'پیش‌فروش', meta: '۳۸ قرارداد', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'اجاره تجاری', meta: '۵۵ قرارداد', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'دفتر', v: '۰۲۱-۴۴۴۴-۴۴۴۴' },
      { ic: '◍', l: 'آدرس', v: 'ولیعصر، خیابان جام‌جم' },
      { ic: '◧', l: 'وب‌سایت', v: 'adl.melkjet.site' },
    ],
    specs: ['دعاوی ملکی', 'قراردادها', 'ارث و وصیت', 'وقف', 'مشارکت ساخت', 'داوری'],
    achievements: [
      { ic: '⚖', l: 'وکیل پایه یک دادگستری', desc: 'شماره پروانه ۱۸۵۴۳۲' },
      { ic: '✓', l: '۹۱٪ نرخ موفقیت', desc: 'در ۱۴ سال فعالیت قضایی' },
      { ic: '★', l: '۲۴۰ پرونده موفق', desc: 'بدون پرونده به ضرر موکل' },
    ],
    chartData: [15, 20, 16, 24, 19, 28, 22, 26, 20, 24, 21, 25],
    areas: ['تهران', 'البرز', 'اصفهان'],
    certs: ['وکیل پایه یک دادگستری', 'عضو کانون وکلا', 'دوره حقوق ملکی تخصصی'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'دفتر حقوقی مدرن', title: 'وکیل ملکی · تهران', rating: '۴٫۶', deals: '۱۸۲', av: 'linear-gradient(135deg,#7a8fae,#465a78)' },
      { name: 'وکیل صادقی', title: 'حقوق ملک · غرب', rating: '۴٫۵', deals: '۱۴۸', av: 'linear-gradient(135deg,#7aa88f,#476e58)' },
    ],
  },
  bank: {
    name: 'بانک مسکن — شعبه ملک', initial: 'ب', roleLabel: 'بانک / بیمه',
    av: 'linear-gradient(135deg,#5fa97a,#37704e)', cover: 'linear-gradient(120deg,#222a26,#2f3a32)',
    rating: '۴٫۵', stat1: '۲۴۰ بیمه‌نامه', stat2: '۱۸ شعبه', area: 'سراسری',
    cta: 'درخواست تسهیلات', color: '#5fa97a',
    bio: 'بانک مسکن با ۱۸ شعبه فعال و تخصص در ارائه تسهیلات خرید مسکن و بیمه‌های مرتبط، بهترین گزینه برای تأمین مالی خرید ملک است.',
    experience: '۳۰ سال', responseTime: '۲ ساعت', activeListings: 240, salesYear: 480,
    services: [
      { ic: '⛁', l: 'وام خرید مسکن', desc: 'تا ۸۰٪ ارزش ملک', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
      { ic: '⛁', l: 'وام جعاله', desc: 'بازسازی و تعمیر', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '⛨', l: 'بیمه آتش‌سوزی', desc: 'پوشش کامل ساختمان', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '✦', l: 'بیمه عمر و سرمایه', desc: 'طرح‌های ترکیبی', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
    ],
    portfolio: [
      { l: 'وام مسکن', meta: '۱۸٪ سود', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'وام جعاله', meta: '۲۳٪ سود', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'بیمه آتش', meta: '۰٫۸٪ سالانه', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'بیمه عمر ملکی', meta: 'ترکیبی', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'وام ودیعه اجاره', meta: 'تا ۱ م', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'تسهیلات پیش‌فروش', meta: 'ویژه', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'سامانه', v: '۱۴۱۷' },
      { ic: '◍', l: 'شعبه مرکزی', v: 'سعادت‌آباد، میدان کاج' },
      { ic: '◧', l: 'وب‌سایت', v: 'maskan.melkjet.site' },
    ],
    specs: ['وام خرید', 'وام جعاله', 'بیمه آتش', 'بیمه عمر', 'ودیعه اجاره', 'پیش‌فروش'],
    achievements: [
      { ic: '⛁', l: 'بانک تخصصی مسکن', desc: 'تنها بانک متخصص حوزه ملک ایران' },
      { ic: '✓', l: 'رتبه AAA اعتباری', desc: 'بانک مرکزی جمهوری اسلامی ایران' },
      { ic: '★', l: '۴۸۰ تسهیلات امسال', desc: 'رکورد پرداخت در ۱۴۰۳' },
    ],
    chartData: [35, 42, 38, 50, 45, 60, 52, 58, 48, 55, 50, 62],
    areas: ['تهران', 'اصفهان', 'شیراز', 'مشهد', 'کرج', 'سراسری'],
    certs: ['مجوز بانک مرکزی', 'تأیید بیمه مرکزی ایران', 'ایزو ۹۰۰۱ خدمات بانکی'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'بانک ملی — مسکن', title: 'بانک · سراسری', rating: '۴٫۳', deals: '۳۸۰', av: 'linear-gradient(135deg,#5b9bd5,#2f5f8a)' },
      { name: 'بیمه آسیا', title: 'بیمه ملکی · تهران', rating: '۴٫۴', deals: '۲۲۰', av: 'linear-gradient(135deg,#c97a9a,#7a4458)' },
    ],
  },
  notary: {
    name: 'دفتر اسناد رسمی ۱۲۰', initial: '۱', roleLabel: 'دفترخانه',
    av: 'linear-gradient(135deg,#b07a8a,#6e4754)', cover: 'linear-gradient(120deg,#2a2228,#3a2f37)',
    rating: '۴٫۹', stat1: '۸۹ سند/ماه', stat2: '۴۵ دقیقه', area: 'سعادت‌آباد',
    cta: 'رزرو نوبت', color: '#b07a8a',
    bio: 'دفتر اسناد رسمی شماره ۱۲۰ با بیش از ۲۵ سال سابقه، یکی از سریع‌ترین و معتبرترین دفترخانه‌های تهران است. تنظیم سند در ۴۵ دقیقه، استعلام‌های خودکار با AI و پیگیری آنلاین پرونده.',
    experience: '۲۵ سال', responseTime: '۴۵ دقیقه', activeListings: 89, salesYear: 1068,
    services: [
      { ic: '❖', l: 'انتقال سند', desc: 'ثبت رسمی مالکیت', bg: 'rgba(155,122,208,0.15)', color: '#9b7ad0' },
      { ic: '⎙', l: 'تنظیم مبایعه‌نامه', desc: 'قرارداد رسمی فوری', bg: 'var(--goldDim)', color: 'var(--gold)' },
      { ic: '◔', l: 'وکالت‌نامه', desc: 'تنظیم و ثبت رسمی', bg: 'rgba(91,155,213,0.15)', color: '#5b9bd5' },
      { ic: '✦', l: 'استعلام خودکار AI', desc: 'شهرداری و ثبت در لحظه', bg: 'rgba(95,217,138,0.15)', color: '#5fd98a' },
    ],
    portfolio: [
      { l: 'انتقال سند', meta: '۴۵ دقیقه', img: 'linear-gradient(135deg,#33303a,#1d1b22)' },
      { l: 'مبایعه‌نامه', meta: 'فوری', img: 'linear-gradient(135deg,#3a3530,#211e1b)' },
      { l: 'وکالت رسمی', meta: 'همان روز', img: 'linear-gradient(135deg,#2c343a,#1a1f23)' },
      { l: 'قرارداد اجاره', meta: 'ثبت رسمی', img: 'linear-gradient(135deg,#2f3a34,#1b211e)' },
      { l: 'مشارکت ساخت', meta: 'تنظیم', img: 'linear-gradient(135deg,#3a3630,#221f1b)' },
      { l: 'وصیت‌نامه', meta: 'رسمی', img: 'linear-gradient(135deg,#34323c,#1e1d23)' },
    ],
    contact: [
      { ic: '✆', l: 'دفترخانه', v: '۰۲۱-۲۲۲۲-۲۲۲۲' },
      { ic: '◍', l: 'آدرس', v: 'سعادت‌آباد، میدان کاج' },
      { ic: '◧', l: 'وب‌سایت', v: 'notary120.melkjet.site' },
    ],
    specs: ['انتقال سند', 'مبایعه‌نامه', 'وکالت', 'مشارکت ساخت', 'اجاره رسمی', 'وصیت'],
    achievements: [
      { ic: '❖', l: 'سردفتر رسمی', desc: 'منصوب از سازمان ثبت اسناد' },
      { ic: '✓', l: 'کمترین زمان ثبت', desc: 'میانگین ۴۵ دقیقه برای انتقال' },
      { ic: '★', l: '۸۹ سند در ماه', desc: 'رکورد حجم ثبت در منطقه' },
    ],
    chartData: [75, 88, 82, 95, 88, 105, 92, 98, 86, 94, 89, 102],
    areas: ['سعادت‌آباد', 'شهرک غرب', 'پونک', 'جنت‌آباد'],
    certs: ['مجوز سازمان ثبت اسناد', 'تأیید قوه قضاییه', 'دوره سامانه ثبت الکترونیک'],
    reviewList: sharedReviews,
    similarProfiles: [
      { name: 'دفترخانه ۴۵', title: 'سردفتر · غرب تهران', rating: '۴٫۷', deals: '۷۲', av: 'linear-gradient(135deg,#7a8fae,#465a78)' },
      { name: 'دفترخانه ۸۸', title: 'سردفتر · مرکز', rating: '۴٫۸', deals: '۸۵', av: 'linear-gradient(135deg,#9b7ad0,#5e4488)' },
    ],
  },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BarChart({ data, months }: { data: number[]; months: string[] }) {
  const max = Math.max(...data)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            height: max > 0 ? `${(v / max) * 80}px` : '4px',
            background: i === data.length - 1 ? 'linear-gradient(180deg,var(--gold2),var(--gold))' : 'var(--goldDim)',
            minHeight: 4,
          }} />
          <span style={{ fontSize: 8.5, color: 'var(--faint)', textAlign: 'center' }}>{months[i]}</span>
        </div>
      ))}
    </div>
  )
}

function ServiceAreaSVG({ areas }: { areas: string[] }) {
  const positions = [
    { cx: 50, cy: 45, r: 26 }, { cx: 155, cy: 50, r: 22 }, { cx: 100, cy: 108, r: 30 },
    { cx: 48, cy: 148, r: 18 }, { cx: 200, cy: 128, r: 20 }, { cx: 170, cy: 165, r: 15 },
  ]
  const colors = ['var(--gold)', '#9b7ad0', '#5b9bd5', '#5fd98a', '#c97a9a', '#c98a4a']
  return (
    <svg width="100%" viewBox="0 0 260 200" style={{ display: 'block', borderRadius: 10 }}>
      <rect width="260" height="200" rx="10" fill="var(--bg2)" />
      {[40, 80, 120, 160].map(y => <line key={y} x1="0" y1={y} x2="260" y2={y} stroke="var(--line)" strokeWidth="0.5" />)}
      {[65, 130, 195].map(x => <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="var(--line)" strokeWidth="0.5" />)}
      {areas.slice(0, 6).map((area, i) => {
        const pos = positions[i] || positions[0]
        return (
          <g key={i}>
            <circle cx={pos.cx} cy={pos.cy} r={pos.r} fill={colors[i]} fillOpacity="0.14" stroke={colors[i]} strokeWidth="1.5" strokeOpacity="0.65" />
            <text x={pos.cx} y={pos.cy + 4} textAnchor="middle" fontSize="8" fill={colors[i]} fontFamily="Vazirmatn">{area}</text>
          </g>
        )
      })}
      <text x="130" y="193" textAnchor="middle" fontSize="9" fill="var(--faint)" fontFamily="Vazirmatn">نقشه محدوده فعالیت</text>
    </svg>
  )
}

// ─── Real item ────────────────────────────────────────────────────────────────

interface RealItem {
  id: string; title: string; category?: string; location?: string; phone?: string;
  image?: string; rating?: string; excerpt?: string; url?: string; sourceName?: string;
  type?: string; meta?: Record<string, string>
}

// Keep only the digits of a phone string (Persian or Latin) for tel/wa.me links.
const digits = (s?: string): string => {
  if (!s) return ''
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return s.replace(/[۰-۹]/g, d => String(fa.indexOf(d))).replace(/\D/g, '')
}
// Convert a local Iranian number (09xxxxxxxxx) to international form for wa.me.
const waNumber = (s?: string): string => {
  const d = digits(s)
  return d.startsWith('0') ? '98' + d.slice(1) : d
}

// ─── Shared visual shell helpers ────────────────────────────────────────────────

// The page-level CSS-var theme, reused by both the real and template profiles.
const themeVars: React.CSSProperties = {
  '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c',
  '--navbg': 'rgba(13,13,15,0.72)', '--line': 'rgba(255,255,255,0.08)',
  '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee',
  '--muted': '#9a9a98', '--faint': '#6a6a68',
  '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
  minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: "'Vazirmatn', system-ui, sans-serif",
} as React.CSSProperties

const fa = (n: number) => n.toLocaleString('fa-IR')
const heroGradients = [
  'linear-gradient(135deg,#caa86a,#8a6f3e)', 'linear-gradient(135deg,#7a8fae,#465a78)',
  'linear-gradient(135deg,#9b7ad0,#5e4488)', 'linear-gradient(135deg,#7aa88f,#476e58)',
  'linear-gradient(135deg,#c97a9a,#7a4458)', 'linear-gradient(135deg,#5b9bd5,#2f5f8a)',
]
const cardGradients = [
  'linear-gradient(135deg,#3a3530,#211e1b)', 'linear-gradient(135deg,#33303a,#1d1b22)',
  'linear-gradient(135deg,#2f3a34,#1b211e)', 'linear-gradient(135deg,#2c343a,#1a1f23)',
  'linear-gradient(135deg,#34323c,#1e1d23)', 'linear-gradient(135deg,#3a3630,#221f1b)',
]

// ─── Real advisor profile page (id = phone) ─────────────────────────────────────

function RealAdvisorProfile({ phone }: { phone: string }) {
  const [data, setData] = useState<AdvisorPublic | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    setStatus('loading')
    setData(null)
    fetch(`/api/advisor/public?phone=${encodeURIComponent(phone)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not-found'))))
      .then(d => { if (alive) { setData(d as AdvisorPublic); setStatus('ok') } })
      .catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [phone])

  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22,
  }

  // ── Loading state ──
  if (status === 'loading') {
    return (
      <div dir="rtl" style={themeVars}>
        <Nav />
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 22px 120px' }}>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: 'var(--bg2)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'grid', gap: 10 }}>
              <div style={{ height: 22, width: '40%', borderRadius: 8, background: 'var(--bg2)' }} />
              <div style={{ height: 14, width: '60%', borderRadius: 7, background: 'var(--bg2)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ ...card, height: 78 }} />)}
          </div>
          <div style={{ ...card, height: 160 }} />
          <div style={{ textAlign: 'center', marginTop: 30, fontSize: 13, color: 'var(--muted)' }}>در حال بارگذاری پروفایل…</div>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Not-found / error state ──
  if (status === 'error' || !data) {
    return (
      <div dir="rtl" style={themeVars}>
        <Nav />
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '90px 22px 140px', textAlign: 'center' }}>
          <div style={{ fontSize: 54, marginBottom: 14 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>این پروفایل یافت نشد</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 2, margin: '0 0 26px' }}>
            مشاوری با این شناسه پیدا نشد یا حساب آن غیرفعال است.
          </p>
          <a href="/" style={{ display: 'inline-block', padding: '12px 26px', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>بازگشت به خانه</a>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Success ──
  const initial = (data.name || '').trim().charAt(0) || 'م'
  const heroAv = heroGradients[(initial.charCodeAt(0) || 0) % heroGradients.length]
  const metaChips = [data.areas, data.experience].filter(Boolean) as string[]
  const stats = [
    { v: data.stats.activeListings, l: 'آگهی فعال' },
    { v: data.stats.deals, l: 'معاملات' },
    { v: data.stats.totalListings, l: 'کل آگهی‌ها' },
  ]

  return (
    <div dir="rtl" style={themeVars}>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px 90px' }}>

        {/* Hero / header */}
        <div style={{ position: 'relative', marginTop: 20, borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)' }}>
          <div style={{ height: 150, background: 'linear-gradient(120deg,#2a2620,#3a3530)', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 11px,rgba(255,255,255,0.03) 11px,rgba(255,255,255,0.03) 12px)' }} />
          </div>
          <div className="mjpp-hero" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, padding: '0 26px 22px', marginTop: -44, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{
              width: 96, height: 96, borderRadius: 24, flexShrink: 0,
              background: data.photo ? `center/cover no-repeat url(${data.photo})` : heroAv,
              border: '4px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 34, fontWeight: 800,
            }}>{data.photo ? '' : initial}</div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(20px,2.8vw,26px)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{data.name}</h1>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', border: '1px solid rgba(95,217,138,0.4)', borderRadius: 999, padding: '3px 10px' }}>✓ تأییدشده</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 999, padding: '3px 11px' }}>{data.title}</span>
              </div>
              {/* meta chips + agency badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {data.agency && (
                  <a href={`/profile/${data.agency.phone}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
                    color: 'var(--gold2)', background: 'var(--goldDim)', border: '1px solid var(--gold)',
                    borderRadius: 999, padding: '5px 13px', textDecoration: 'none',
                  }}>🏢 عضو آژانس {data.agency.name}</a>
                )}
                {metaChips.map((m, i) => (
                  <span key={i} style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 12px' }}>
                    {i === 0 ? '📍 ' : '🕒 '}{m}
                  </span>
                ))}
              </div>
            </div>
            {data.contactPhone && (
              <div style={{ display: 'flex', gap: 9, flexShrink: 0, paddingBottom: 4, flexWrap: 'wrap' }}>
                <a href={`tel:${data.contactPhone.replace(/\D/g, '')}`} style={{ height: 42, display: 'inline-flex', alignItems: 'center', padding: '0 22px', border: 'none', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>☎ تماس</a>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{fa(s.v)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* About */}
        {data.bio && (
          <section style={{ ...card, marginTop: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>درباره</div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, margin: 0 }}>{data.bio}</p>
          </section>
        )}

        {/* Specialties */}
        {data.specialties.length > 0 && (
          <section style={{ ...card, marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>تخصص‌ها</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.specialties.map((s, i) => (
                <span key={i} style={{ padding: '6px 13px', borderRadius: 999, border: '1px solid var(--line2)', fontSize: 12.5, color: 'var(--text)', background: 'var(--bg2)' }}>{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* Listings */}
        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>آگهی‌های {data.name}</div>
            {data.listings.length > 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fa(data.listings.length)} آگهی</span>}
          </div>
          {data.listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '34px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🏠</div>
              <div style={{ fontSize: 13.5 }}>در حال حاضر آگهی فعالی ثبت نشده است.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
              {data.listings.map((it, i) => (
                <a key={it.id} href={`/property/${it.id}`} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', display: 'block', background: 'var(--bg2)' }}>
                  <div style={{ height: 120, background: it.image ? `center/cover no-repeat url(${it.image})` : cardGradients[i % cardGradients.length], position: 'relative' }}>
                    {!it.image && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(255,255,255,0.03) 8px,rgba(255,255,255,0.03) 9px)' }} />}
                  </div>
                  <div style={{ padding: '12px 13px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                    {it.location && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>📍 {it.location}</div>}
                    {it.price && <div style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, marginTop: 6 }}>{it.price}</div>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Contact */}
        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>تماس</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {data.contactPhone && (
              <a href={`tel:${data.contactPhone.replace(/\D/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 16px', textDecoration: 'none' }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>☎</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>تماس مستقیم</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', direction: 'ltr', textAlign: 'right', fontWeight: 700 }}>{data.contactPhone}</div>
                </div>
              </a>
            )}
            {data.agency && (
              <a href={`/profile/${data.agency.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 16px', textDecoration: 'none' }}>
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>آژانس</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>{data.agency.name}</div>
                </div>
              </a>
            )}
            {!data.contactPhone && !data.agency && (
              <div style={{ fontSize: 13, color: 'var(--muted)', padding: '6px 2px' }}>اطلاعات تماسی ثبت نشده است.</div>
            )}
          </div>
        </section>

      </main>

      {/* FAB */}
      <a href="/" aria-label="home" style={{ position: 'fixed', bottom: 22, left: 22, zIndex: 60, width: 52, height: 52, borderRadius: 16, textDecoration: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 19, fontWeight: 800, boxShadow: '0 14px 34px -10px var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✦</a>

      <Footer />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const params = useParams()
  const urlId = (params?.id as string) || 'advisor'

  // یک شناسهٔ نقشِ شناخته‌شده (advisor/agency/…) = صفحهٔ نمونهٔ نقش.
  // هر چیز دیگری (شمارهٔ تلفنِ مشاور یا کلیدِ پیش‌نمایشِ نقش) = پروفایلِ واقعیِ مشاور.
  if (urlId in profiles) {
    return <RoleTemplateProfile urlId={urlId} />
  }
  return <RealAdvisorProfile phone={urlId} />
}

// ─── Role template profile (fallback: /profile/advisor, /profile/agency, …) ─────

function RoleTemplateProfile({ urlId }: { urlId: string }) {
  const validId = (urlId in profiles ? urlId : 'advisor') as RoleId

  const [activeRole, setActiveRole] = useState<RoleId>(validId)
  const [realItem, setRealItem] = useState<RealItem | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactDesc, setContactDesc] = useState('')
  const [formSent, setFormSent] = useState(false)
  const [sidebarName, setSidebarName] = useState('')
  const [sidebarPhone, setSidebarPhone] = useState('')
  const [sidebarDesc, setSidebarDesc] = useState('')
  const [sidebarSent, setSidebarSent] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [meetingPhone, setMeetingPhone] = useState('')
  const [meetingSent, setMeetingSent] = useState(false)
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews' | 'about' | 'contact'>('listings')

  // Fetch the real directory item for this id. If none (404 / demo role id), fall back to sample.
  useEffect(() => {
    let alive = true
    setRealItem(null)
    fetch(`/api/content/item?id=${encodeURIComponent(urlId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d && d.item) setRealItem(d.item as RealItem) })
      .catch(() => {})
    return () => { alive = false }
  }, [urlId])

  const sample = profiles[activeRole]
  // realItem ? realData : sampleData — merge real fields into the existing sample layout.
  const p: Profile = realItem ? {
    ...sample,
    name: realItem.title || sample.name,
    initial: (realItem.title || sample.name).trim().charAt(0) || sample.initial,
    roleLabel: realItem.category || sample.roleLabel,
    rating: realItem.rating || sample.rating,
    area: realItem.location || sample.area,
    bio: realItem.excerpt || sample.bio,
  } : sample
  const realAvatar = realItem?.image
  const roleColor = p.color
  const phone = realItem ? realItem.phone : undefined
  const igLink = realItem?.url && /instagram\.com/i.test(realItem.url) ? realItem.url : undefined

  // Hero CTA: dial the phone if present, otherwise jump to the contact tab.
  const handleCta = () => {
    if (phone) { window.location.href = `tel:${digits(phone)}` }
    else { setActiveTab('contact'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  const postLead = (title: string, description: string, name: string, ph: string) =>
    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, owner: name || undefined, phone: ph || undefined }),
    }).catch(() => {})

  const handleSend = () => {
    if (!contactName || !contactPhone) return
    postLead(`درخواست خدمت از ${p.name}`, `${contactDesc}\n— نام: ${contactName} · تماس: ${contactPhone}`, contactName, contactPhone)
    setFormSent(true)
  }
  const handleSidebar = () => {
    if (!sidebarName || !sidebarPhone) return
    postLead(`درخواست خدمت از ${p.name}`, `${sidebarDesc}\n— نام: ${sidebarName} · تماس: ${sidebarPhone}`, sidebarName, sidebarPhone)
    setSidebarSent(true)
  }
  const handleMeeting = () => {
    if (!meetingDate || !meetingTime) return
    postLead(`درخواست خدمت از ${p.name}`, `رزرو جلسه — تاریخ: ${meetingDate} · ساعت: ${meetingTime}\nنام: ${meetingName} · تماس: ${meetingPhone}`, meetingName, meetingPhone)
    setMeetingSent(true)
  }

  const inpSt: React.CSSProperties = {
    width: '100%', border: '1px solid var(--line2)', borderRadius: 11,
    background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit',
    fontSize: 13, padding: '11px 13px', outline: 'none', boxSizing: 'border-box',
  }
  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 22,
  }
  const tabs = [
    { id: 'listings' as const, label: 'فایل‌ها', ic: '⌂' },
    { id: 'reviews' as const, label: 'نظرات', ic: '★' },
    { id: 'about' as const, label: 'درباره', ic: '◈' },
    { id: 'contact' as const, label: 'تماس', ic: '✉' },
  ]
  const meetDates = ['۱۵ خرداد', '۱۶ خرداد', '۱۷ خرداد', '۱۸ خرداد', '۱۹ خرداد', '۲۰ خرداد']
  const meetTimes = ['۹:۰۰', '۱۰:۳۰', '۱۲:۰۰', '۱۴:۰۰', '۱۵:۳۰', '۱۷:۰۰']

  return (
    <div dir="rtl" style={{
      '--bg': '#0d0d0f', '--bg2': '#141417', '--surface': '#18181c',
      '--navbg': 'rgba(13,13,15,0.72)', '--line': 'rgba(255,255,255,0.08)',
      '--line2': 'rgba(255,255,255,0.14)', '--text': '#f2f1ee',
      '--muted': '#9a9a98', '--faint': '#6a6a68',
      '--gold': '#c9a96a', '--gold2': '#e0c489', '--goldDim': 'rgba(201,169,106,0.12)',
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: "'Vazirmatn', system-ui, sans-serif",
    } as React.CSSProperties}>

      <Nav />

      {/* Role switcher */}
      <div className="mjpp-roles" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg2)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '11px 22px', display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 6 }}>پیش‌نمایش نقش:</span>
          {roleTabs.map(r => {
            const on = activeRole === r.id
            return (
              <button key={r.id} onClick={() => { setActiveRole(r.id); setFormSent(false); setSidebarSent(false); setActiveTab('listings') }} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9,
                border: `1px solid ${on ? 'var(--gold)' : 'var(--line)'}`,
                background: on ? 'var(--goldDim)' : 'var(--surface)',
                color: on ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {r.ic} {r.label}
              </button>
            )
          })}
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '0 22px 90px' }}>

        {/* Hero */}
        <div style={{ position: 'relative', marginTop: 20, borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)' }}>
          <div style={{ height: 160, background: p.cover, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 11px,rgba(255,255,255,0.03) 11px,rgba(255,255,255,0.03) 12px)' }} />
            <span style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, background: 'rgba(20,18,14,0.7)', backdropFilter: 'blur(6px)', color: 'var(--gold2)', fontSize: 12, fontWeight: 800, border: '1px solid var(--gold)' }}>★ پروفایل پروموت‌شده در {p.area}</span>
          </div>
          <div className="mjpp-hero" style={{ display: 'flex', alignItems: 'flex-end', gap: 20, padding: '0 26px 22px', marginTop: -44, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: realAvatar ? `center/cover no-repeat url(${realAvatar})` : p.av, border: '4px solid var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 34, fontWeight: 800 }}>{realAvatar ? '' : p.initial}</div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(20px,2.8vw,26px)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{p.name}</h1>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#5fd98a', background: 'rgba(95,217,138,0.12)', border: '1px solid rgba(95,217,138,0.4)', borderRadius: 999, padding: '3px 10px' }}>✓ تأییدشده</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: roleColor, background: `${roleColor}22`, border: `1px solid ${roleColor}66`, borderRadius: 999, padding: '3px 11px' }}>{p.roleLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 9, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>★ {p.rating}</span>
                <span>{p.stat1}</span><span>{p.stat2}</span><span>📍 {p.area}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9, flexShrink: 0, paddingBottom: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setModalOpen(true)} style={{ height: 42, padding: '0 18px', border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>رزرو جلسه</button>
              <button onClick={handleCta} style={{ height: 42, padding: '0 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{p.cta}</button>
            </div>
          </div>
        </div>

        {/* Contact bar */}
        <div style={{ marginTop: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {p.contact.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{c.ic}</span>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{c.l}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text)', direction: 'ltr', textAlign: 'right' }}>{c.v}</div>
              </div>
            </div>
          ))}
          <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
            {(() => {
              const cbSt: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
              return (
                <>
                  {phone
                    ? <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener noreferrer" style={cbSt}>📱 واتس‌اپ</a>
                    : <button style={{ ...cbSt, opacity: 0.5, cursor: 'default' }} disabled>📱 واتس‌اپ</button>}
                  {phone
                    ? <a href={`mailto:?subject=${encodeURIComponent('تماس از طریق ملک‌جت با ' + p.name)}`} style={cbSt}>📧 ایمیل</a>
                    : <a href="mailto:" style={cbSt}>📧 ایمیل</a>}
                  {igLink
                    ? <a href={igLink} target="_blank" rel="noopener noreferrer" style={cbSt}>📢 اینستاگرام</a>
                    : <button style={{ ...cbSt, opacity: 0.5, cursor: 'default' }} disabled>📢 اینستاگرام</button>}
                </>
              )
            })()}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { v: String(p.activeListings), l: 'فایل فعال' },
            { v: String(p.salesYear), l: 'معامله امسال' },
            { v: p.responseTime, l: 'میانگین پاسخ' },
            { v: p.experience, l: 'سابقه کار' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="mjpp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginTop: 20, alignItems: 'start' }}>

          {/* LEFT */}
          <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>

            {/* Tab nav */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 5 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: activeTab === tab.id ? 'var(--goldDim)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--gold)' : 'var(--muted)',
                  fontFamily: 'inherit', fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <span>{tab.ic}</span><span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab: Listings */}
            {activeTab === 'listings' && (
              <>
                <section style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>فایل‌های فعال</div>
                    <a href="/directory" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>مشاهده همه ←</a>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {p.portfolio.map((it, i) => (
                      <div key={i} style={{ borderRadius: 13, overflow: 'hidden', border: '1px solid var(--line)', cursor: 'pointer' }}>
                        <div style={{ height: 96, background: it.img, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(135deg,transparent,transparent 8px,rgba(255,255,255,0.03) 8px,rgba(255,255,255,0.03) 9px)' }} />
                        </div>
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.l}</div>
                          <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>{it.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section style={card}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>خدمات {p.roleLabel}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {p.services.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: 15, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg2)' }}>
                        <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{s.ic}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{s.l}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Tab: Reviews */}
            {activeTab === 'reviews' && (
              <section style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>نظرات مشتریان</div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>★ {p.rating}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, alignItems: 'center', marginBottom: 20, padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{p.rating}</div>
                    <div style={{ fontSize: 18, color: 'var(--gold)', marginTop: 4 }}>★★★★★</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>از {p.reviewList.length} نظر</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[5, 4, 3, 2, 1].map(star => (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)', width: 14, textAlign: 'center' }}>{star}</span>
                        <span style={{ color: 'var(--gold)', fontSize: 11 }}>★</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: star >= 4 ? '75%' : star === 3 ? '20%' : '5%', background: 'linear-gradient(90deg,var(--gold2),var(--gold))', borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {p.reviewList.map((rv, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 13 }}>
                      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', background: rv.av }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{rv.n}</span>
                          <span style={{ fontSize: 12, color: 'var(--gold)' }}>★ {rv.r}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.8 }}>{rv.t}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tab: About */}
            {activeTab === 'about' && (
              <>
                <section style={card}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>درباره {p.roleLabel}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 2, margin: '0 0 16px' }}>{p.bio}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.specs.map((s, i) => (
                      <span key={i} style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--line2)', fontSize: 12, color: 'var(--muted)', background: 'var(--bg2)' }}>{s}</span>
                    ))}
                  </div>
                </section>
                <section style={card}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>📍 محدوده فعالیت</div>
                  <ServiceAreaSVG areas={p.areas} />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.areas.map((z, i) => (
                      <span key={i} style={{ padding: '4px 11px', borderRadius: 999, border: '1px solid var(--line)', fontSize: 11.5, color: 'var(--muted)', background: 'var(--bg2)' }}>{z}</span>
                    ))}
                  </div>
                </section>
                <section style={card}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>🏆 دستاوردها و گواهینامه‌ها</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
                    {p.achievements.map((a, i) => (
                      <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--bg2)', textAlign: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--goldDim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 18, color: 'var(--gold)' }}>{a.ic}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{a.l}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{a.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {p.certs.map((cert, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#16140f', fontWeight: 800, flexShrink: 0 }}>✦</div>
                        <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{cert}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>سابقه معاملات ماهانه</div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg2)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>۱۲ ماه اخیر</span>
                  </div>
                  <BarChart data={p.chartData} months={chartMonths} />
                  <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 12, color: 'var(--muted)' }}>
                    <span>مجموع: <strong style={{ color: 'var(--gold)' }}>{p.chartData.reduce((a, b) => a + b, 0)}</strong></span>
                    <span>بیشترین ماه: <strong style={{ color: 'var(--gold)' }}>{Math.max(...p.chartData)}</strong></span>
                  </div>
                </section>
              </>
            )}

            {/* Tab: Contact */}
            {activeTab === 'contact' && (
              <section style={card}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>تماس با {p.name}</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0, marginBottom: 20 }}>پیام خود را ارسال کنید — ظرف {p.responseTime} پاسخ می‌گیرید.</p>
                <div style={{ background: 'var(--goldDim)', border: '1px solid rgba(201,169,106,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--gold)', fontSize: 18 }}>🕐</span>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}><strong style={{ color: 'var(--gold)' }}>ساعات پاسخ‌گویی: </strong>شنبه تا چهارشنبه · ۹ صبح تا ۷ عصر</div>
                </div>
                {formSent ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#5fd98a', marginBottom: 8 }}>پیام شما ارسال شد!</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{p.name} به زودی با شما تماس خواهند گرفت.</div>
                    <button onClick={() => setFormSent(false)} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>ارسال پیام جدید</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>نام و نام خانوادگی *</label>
                        <input placeholder="مثال: علی احمدی" style={inpSt} value={contactName} onChange={e => setContactName(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>شماره تماس *</label>
                        <input placeholder="۰۹۱۲-xxx-xxxx" style={inpSt} value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>پیام *</label>
                      <textarea rows={4} placeholder="نیاز خود را شرح دهید…" style={{ ...inpSt, resize: 'none', lineHeight: 1.7 }} value={contactDesc} onChange={e => setContactDesc(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['مشاوره خرید', 'مشاوره فروش', 'اجاره', 'سرمایه‌گذاری'].map(t => (
                        <button key={t} type="button" onClick={() => setContactDesc(d => d ? d : `موضوع: ${t}\n`)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, border: '1px solid var(--line)', background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer' }}>{t}</button>
                      ))}
                    </div>
                    <button onClick={handleSend} style={{ height: 46, border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>✉ ارسال پیام</button>
                  </div>
                )}
              </section>
            )}

          </div>

          {/* RIGHT sidebar */}
          <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 88 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 13 }}>درخواست خدمت</div>
              {sidebarSent ? (
                <div style={{ textAlign: 'center', padding: '18px 0' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#5fd98a', marginBottom: 6 }}>درخواست شما ثبت شد!</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{p.name} به زودی با شما تماس می‌گیرد.</div>
                  <button onClick={() => { setSidebarSent(false); setSidebarName(''); setSidebarPhone(''); setSidebarDesc('') }} style={{ padding: '9px 20px', borderRadius: 11, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>درخواست جدید</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 9 }}>
                  <input placeholder="نام شما" style={inpSt} value={sidebarName} onChange={e => setSidebarName(e.target.value)} />
                  <input placeholder="شماره تماس" style={inpSt} value={sidebarPhone} onChange={e => setSidebarPhone(e.target.value)} />
                  <textarea rows={3} placeholder="نیاز خود را شرح دهید…" style={{ ...inpSt, resize: 'none', lineHeight: 1.6 }} value={sidebarDesc} onChange={e => setSidebarDesc(e.target.value)} />
                  <button onClick={handleSidebar} style={{ height: 44, border: 'none', borderRadius: 12, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>ارسال درخواست</button>
                </div>
              )}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>اطلاعات تماس</div>
              <div style={{ display: 'grid', gap: 11 }}>
                {p.contact.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: 'var(--goldDim)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{c.ic}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.l}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text)', direction: 'ltr', textAlign: 'right' }}>{c.v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--goldDim)', border: '1px solid var(--gold)', borderRadius: 16, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--gold)', fontSize: 15 }}>★</span>
              <div style={{ fontSize: 11.5, lineHeight: 1.8, color: 'var(--text)' }}>
                این پروفایل در صدر نتایج محله‌ی <b style={{ color: 'var(--gold)' }}>{p.area}</b> نمایش داده می‌شود.{' '}
                <a href="/pricing" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>پروموت پروفایل من ←</a>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>عملکرد</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {[{ l: 'پاسخ‌گویی', v: 0.98 }, { l: 'رضایت مشتری', v: 0.96 }, { l: 'نرخ موفقیت', v: 0.89 }].map((m, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--muted)' }}>{m.l}</span>
                      <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{Math.round(m.v * 100)}٪</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--bg2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${m.v * 100}%`, background: 'linear-gradient(90deg,var(--gold2),var(--gold))', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>مشابه‌ها</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.similarProfiles.map((sp, i) => (
                  <a key={i} href="/directory" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg2)', textDecoration: 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: sp.av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{sp.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{sp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sp.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>★ {sp.rating} · {sp.deals} معامله</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Meeting modal */}
      {modalOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>رزرو جلسه با {p.name}</div>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            {meetingSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#5fd98a' }}>جلسه رزرو شد!</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>تأییدیه برایتان ارسال می‌شود.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>انتخاب تاریخ</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                    {meetDates.map((d, i) => (
                      <button key={i} onClick={() => setMeetingDate(d)} style={{ padding: '9px 6px', borderRadius: 10, border: `1px solid ${meetingDate === d ? 'var(--gold)' : 'var(--line)'}`, background: meetingDate === d ? 'var(--goldDim)' : 'var(--bg2)', color: meetingDate === d ? 'var(--gold)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: meetingDate === d ? 700 : 400 }}>{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>انتخاب ساعت</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {meetTimes.map((t, i) => (
                      <button key={i} onClick={() => setMeetingTime(t)} style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${meetingTime === t ? 'var(--gold)' : 'var(--line)'}`, background: meetingTime === t ? 'var(--goldDim)' : 'var(--bg2)', color: meetingTime === t ? 'var(--gold)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', fontWeight: meetingTime === t ? 700 : 400 }}>{t}</button>
                    ))}
                  </div>
                </div>
                <input placeholder="نام و نام خانوادگی" style={inpSt} value={meetingName} onChange={e => setMeetingName(e.target.value)} />
                <input placeholder="شماره تماس" style={inpSt} value={meetingPhone} onChange={e => setMeetingPhone(e.target.value)} />
                <button onClick={handleMeeting} style={{ height: 46, border: 'none', borderRadius: 13, background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>تأیید رزرو جلسه</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <a href="/" aria-label="home" style={{ position: 'fixed', bottom: 22, left: 22, zIndex: 60, width: 52, height: 52, borderRadius: 16, textDecoration: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontSize: 19, fontWeight: 800, boxShadow: '0 14px 34px -10px var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✦</a>

      <Footer />
    </div>
  )
}
