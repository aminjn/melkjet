# REOS — گزارشِ ممیزیِ صادقانه (Audit Report)

> این فایل برای «هوش مصنوعیِ ممیز» نوشته شده. هر ادعا به کدِ واقعی (فایل:خط یا تابع) وصل است
> تا قابلِ راستی‌آزمایی باشد. زبانِ گزارش عمداً محتاطانه است: آنچه واقعاً اجرا می‌شود از آنچه
> فقط «مستند/طراحی» شده جدا شده. مخزن: `melkjet-nextjs` (Next.js 16.2.9 App Router).
>
> **تاریخ:** 2026-07-07 · **آخرین کامیت مرتبط:** `ff6bf23`

---

## ۰) پاسخِ مستقیم به سؤال: «کل سند انجام شده؟»

**خیر — ۱۰۰٪ نه.** واقعیت به سه دسته تقسیم می‌شود:

| دسته | وضعیت | سهم تقریبی از سند |
|---|---|---|
| **هستهٔ الگوریتمی + سیم‌کشیِ زنده** (feature/embedding/scoring/feed/ML-inference/events/monetization + اتصال به سایتِ واقعی) | ✅ اجرا و تست‌شده، در تولید قابل‌فعال | ~۶۰٪ |
| **لایهٔ داده و مشاهده‌پذیری** (feature store دو-حالته، پنل observability، فید عمومی/خریدار) | ✅ اجرا | ~۱۵٪ |
| **زیرساختِ سنگینِ scale-out** (schema اختصاصیِ pgvector، Kafka، Elasticsearch، WebSocket، آموزشِ واقعیِ XGBoost/مدل یادگیرنده) | ⛔️ فقط مستند/طراحی — **در کد اجرا نمی‌شود** | ~۲۵٪ |

نتیجه: «مغزِ الگوریتمیِ» سند واقعی و زنده است؛ اما «تنه صنعتیِ» سند (صف‌بندی، جستجوی توزیع‌شده،
بردار در دیتابیس، آموزشِ آفلاین) هنوز نصب/دیپلوی نشده و در `docs/REOS.md §۱۵` هم صادقانه
«scale-out» علامت خورده. این فایل همان مرز را دقیق‌تر می‌کند.

---

## ۱) نقشهٔ کد ← سند (چه چیزی واقعاً وجود دارد)

### ۱.۱ هستهٔ موتور — `app/lib/reos/` (۱۲ فایل، ~۹۳۰ خط)

| فایل | خط | توابع/صادرات کلیدی | ادعای سند که پوشش می‌دهد |
|---|---|---|---|
| `types.ts` | 88 | `EMBED_DIM=64`, `UserEntity`, `PropertyEntity`, `AgentEntity`, `ReosEvent`, `EventType`, `Prediction`, `Match` | مدل موجودیت‌ها + قرارداد رویداد |
| `features.ts` | 80 | `parseFaNum`, `tokenize`, `embedTokens`, `l2norm`, `cosine`, `haversineKm`, `userVector`, `propertyVector`, `agentVector`, `demandScore`, `agentPerf`, `clamp01` | Feature engineering + embedding + شباهت |
| `scoring.ts` | 76 | `WEIGHTS`, `budgetMatch`, `locationMatch`, `behaviorMatch`, `intentStrength`, `historicalInteraction`, `scoreUserProperty`, `reasonsOf`, `toMatch` | فرمولِ Global (۶ مؤلفه) + لایهٔ دلیل |
| `hybrid.ts` | 70 | `HYBRID_WEIGHTS`, `hybridScore`, `hybridRank` | فرمولِ Hybrid (۴/۵ لایه) |
| `feed.ts` | 80 | `RANK_WEIGHTS`, `propertyRankScore`, `explain`, `buildHomeFeed` | Property Ranking + فیدِ چندبخشی |
| `ml.ts` | 67 | `predictLeadConversion`, `predictPropertyDemand`, `predictAgentPerformance`, `optimizePrice` | ۵ مدلِ ML — **inference (وزنِ ثابت)، نه آموزش‌دیده** |
| `monetization.ts` | 67 | `effectiveBoost`, `leadValue`, `dynamicMultiplier`, `agentRankingScore`, `revenueSuggestions`, `predictPlanUpsell` | درآمدزاییِ اعتماد-محور (boost×quality) |
| `engine.ts` | 71 | `matchUserToProperties`, `matchPropertyToUsers`, `assignLeadToAgent`, `homeFeed` | ۳ نوع تطبیق |
| `events.ts` | 51 | `REWARD`, `feedVersion`, `ingest` | Event bus + online-learning reward |
| `store.ts` | 133 | `recordEvent`, `recentEvents`, `eventStats`, `topFeatures`, `getFeatures`, `bumpFeatures` | Feature store — **دو-حالته PG/فایل** |
| `data.ts` | 80 | `itemToProperty`, `loadProperties`, `loadUser`, `loadAgentsForAgency` | آداپتورِ دادهٔ واقعیِ سایت → موجودیت‌های REOS |
| `orchestrator.ts` | 63 | `orchestrateBuyerJourney` | هماهنگ‌سازِ سفرِ خریدار |

### ۱.۲ لایهٔ API — `app/api/reos/` (۶ route)

| route | خط | کار | گیتِ دسترسی |
|---|---|---|---|
| `events/route.ts` | 32 | ثبتِ رویداد (`ingest`) | عمومی (ثبت رفتار) |
| `recommendations/route.ts` | 54 | فیدِ «برای شما» | نیازمند session؛ `?userId=` فقط سوپرادمین |
| `match/route.ts` | 46 | تطبیق کاربر↔ملک، لید↔مشاور | `?userId=` فقط سوپرادمین |
| `predict/route.ts` | 40 | خروجیِ ۵ مدلِ ML | session |
| `monetize/route.ts` | 49 | پیشنهادِ درآمد + ارزشِ لید | session |
| `admin/route.ts` | 34 | داشبوردِ observability | **فقط سوپرادمین** (`role==='super_admin'` یا `09122862184`) |

### ۱.۳ رابطِ کاربری

| فایل | کار |
|---|---|
| `app/reos-admin/page.tsx` (120 خط) | داشبوردِ مغزِ زنده: KPI، رویداد به‌تفکیک نوع، پرتعامل‌ترین املاک، رویدادهای اخیر، وزن‌های موتور |
| `app/components/ReosFeed.tsx` (88 خط) | فیدِ توصیهٔ زنده (props: `compact`, `silent`) |
| `app/HomeClient.tsx` | `<ReosFeed compact silent/>` بعد از هیرو (خانهٔ عمومی) |
| `app/buyer/page.tsx` | viewِ `reos` + فیدِ داشبوردِ خریدار |
| `app/admin/page.tsx` | آیتمِ منوی «✦ REOS (مغزِ AI)» → `/reos-admin` |

### ۱.۴ سیم‌کشیِ رویدادهای واقعی (Data Flywheel زنده) — **مهم‌ترین بخشِ ممیزی**

این‌ها ثابت می‌کنند موتور «متصل» است نه ایزوله:

| فایل:خط | رویداد | محرک |
|---|---|---|
| `app/api/listing-stats/route.ts:41` | `user_clicked_property` | بازدید از صفحهٔ ملک |
| `app/api/listing-stats/route.ts:36` | `contact_made` | تماس |
| `app/api/user/prefs/route.ts:30` | `user_saved_property` | سیو |
| `app/api/listing-reveal/route.ts:41` | `contact_made` | افشای شماره |
| `app/api/agency/route.ts:204` | `agent_assigned` | تخصیصِ لید به مشاور |
| `app/api/agency/route.ts:193-195` | — | تخصیصِ لید با `loadAgentsForAgency` + `assignLeadToAgent` (موتورِ مرکزیِ REOS، نه نام‌محور) |

> **نکتهٔ ممیزی:** همهٔ `ingest` ها داخلِ `try{}catch{}` هستند تا خطای موتور هرگز مسیرِ اصلیِ
> کاربر را نشکند (fail-open). این عمدی است.

---

## ۲) فرمول‌ها — دقیقاً چه چیزی پیاده شده (برای بازبینیِ ریاضی)

- **Global score** (`scoring.ts` `WEIGHTS`): budget 0.35، location 0.25، behavior 0.15،
  intent 0.10، historical 0.10، (+ demand 0.05 در مسیرها). `budgetMatch` = افتِ نمایی با فاصلهٔ
  نسبیِ قیمت؛ `locationMatch` = ترکیبِ haversine + همپوشانیِ متنی.
- **Hybrid score** (`hybrid.ts` `HYBRID_WEIGHTS`): content 0.30، collaborative(cosine embedding)
  0.25، demand 0.20، freshness 0.15، quality 0.10.
- **Property Ranking / Feed** (`feed.ts` `RANK_WEIGHTS`): relevance 0.35، engagement 0.20،
  freshness 0.15، quality 0.10، proximity 0.10، boost 0.10.
- **Reward (online learning)** (`events.ts` `REWARD`): click +1، save +5، contact +20 →
  به `bumpFeatures` می‌رود و رتبه‌بندیِ بعدی را جابه‌جا می‌کند.
- **Monetization** (`monetization.ts` `effectiveBoost`): `boost × qualityScore` — یعنی پول
  بدونِ کیفیت رتبه نمی‌خرد (گیتِ اعتماد).

هر تابع، خالص (pure) و بدونِ I/O است ⇒ مستقیماً unit-testable.

---

## ۳) صادقانه چه چیزی هنوز نشده (⛔️ فقط در سند، نه در کد)

اینها را ممیز باید به‌عنوان **«طراحی‌شده ولی اجرانشده»** علامت بزند — من ادعای اجرای آنها را ندارم:

1. **Schema اختصاصیِ REOS اجرا نشده.** `docs/reos-schema.sql` (۲۴۷ خط، شاملِ `VECTOR`/pgvector،
   جداولِ `properties/leads/deals/embeddings/feature_store/predictions/matches/events/...`)
   **روی دیتابیس اعمال نشده**. Feature store فعلی از لایهٔ `kv` دو-حالته (`store.ts`) استفاده
   می‌کند، نه از جداولِ نرمالِ سند. یعنی pgvector واقعی در تولید نیست؛ embedding در حافظه/بلاب است.
2. **مدل‌های ML آموزش‌دیده نیستند.** `ml.ts` فرمولِ لجستیکِ ویژگی‌محور با **وزنِ ثابتِ دستی**
   است (inference). هیچ pipelineِ آموزش، هیچ XGBoost، هیچ backtest/AUC واقعی وجود ندارد.
   API این توابع طوری است که با مدلِ آموزش‌دیده جایگزین شوند بدونِ تغییرِ امضا — ولی آن جایگزینی
   انجام نشده.
3. **Kafka / صف رویداد صنعتی نیست.** `ingest` هم‌زمان و درجا در همان request می‌نویسد
   (`events.ts` → `store.ts`). در حجمِ بالا این نیازمندِ صف است؛ فعلاً نیست.
4. **Elasticsearch / جستجوی توزیع‌شده نیست.** رتبه‌بندی روی آرایهٔ درون‌حافظه‌ایِ املاک
   (`loadProperties(limit=300)`) اجرا می‌شود، نه روی ایندکسِ جستجو. یعنی سقفِ فعلی ~صدها ملکِ
   کاندید در هر درخواست است، نه میلیون‌ها.
5. **WebSocket / real-time push نیست.** فید با `fetch` در بارگذاریِ صفحه گرفته می‌شود (pull)،
   نه push زنده.
6. **فید فقط به دو سطح وصل است:** خانهٔ عمومی (`HomeClient`) و پنلِ خریدار (`buyer/page`).
   به همهٔ نقش‌ها (مالک/آژانس/مشاور/۶ نقشِ حرفه‌ای) به‌صورتِ فیدِ اختصاصی وصل **نشده**.
7. **تست‌های خودکار در مخزن نیستند.** تست‌های یکپارچه (که در گفتگو «۲۴ سنجه PASS» گزارش شد)
   به‌صورتِ اسکریپتِ ماندگار در repo کامیت **نشده‌اند** — قابلِ اجرای مجدد توسطِ ممیز نیستند مگر
   بازنویسی شوند. (این ضعفِ واقعیِ قابلِ‌رفع است.)
8. **`orchestrateBuyerJourney` به هیچ route/صفحه‌ای وصل نیست** — کدش هست ولی فراخوانده نمی‌شود
   (dead-ish؛ آماده برای اتصالِ بعدی).

---

## ۴) نکاتِ درست‌کارکردنِ فعلی که ممیز باید تأیید کند

- **حریمِ خصوصی:** `?userId=` در `recommendations`/`match` فقط برای سوپرادمین باز است
  (کامیت `b18e5d5`) — جلوگیری از افشای بودجه/نیتِ کاربرِ دیگر.
- **دو-حالتگی داده:** `store.ts` اگر `DATABASE_URL` نبود، دقیقاً مثلِ فایل رفتار می‌کند
  (`pgEnabled()`), پس تولید تا زمان فعال‌سازی دست‌نخورده می‌ماند.
- **fail-open:** خطای موتور هرگز صفحهٔ کاربر را ۵۰۰ نمی‌کند (همهٔ `ingest` در try/catch).
- **تخصیصِ لید ID-محور است نه نام‌محور** (`assignedToPhone`) — طبقِ خواستهٔ صریحِ کارفرما.

---

## ۵) چک‌لیستِ راستی‌آزماییِ پیشنهادی برای ممیز

هر مورد را می‌توان مستقیم روی مخزن بررسی کرد:

- [ ] فرمول‌های `WEIGHTS`/`HYBRID_WEIGHTS`/`RANK_WEIGHTS` با §۴ سند مطابق‌اند؟ (`scoring/hybrid/feed`)
- [ ] `cosine`/`l2norm`/`haversineKm` از نظرِ ریاضی درست‌اند؟ (`features.ts`)
- [ ] آیا `ingest` واقعاً از مسیرهای کاربر فراخوانده می‌شود؟ (۶ سایت در §۱.۴ — grep کنید)
- [ ] گیتِ سوپرادمین در `reos/admin` و `?userId=` واقعاً اعمال می‌شود؟
- [ ] `effectiveBoost` واقعاً `boost×quality` است (پول بدونِ کیفیت رتبه نمی‌خرد)؟
- [ ] آیا ادعای «pgvector/Kafka/Elasticsearch/XGBoost اجراست» در جایی هست؟ **نباید باشد** —
      §۳ می‌گوید نیست. اگر جایی چنین ادعایی دیدید، تناقض گزارش کنید.
- [ ] `ml.ts` وزنِ ثابت دارد یا آموزش‌دیده؟ (**باید ثابت/inference باشد** — ادعای آموزش نداریم.)

---

## ۶) جمع‌بندیِ یک‌خطی برای ممیز

> «مغزِ الگوریتمیِ REOS (feature→embedding→scoring→feed→reward→monetization) کدِ واقعیِ خالص و
> متصل به رفتارِ واقعیِ سایت است و در تولید قابلِ فعال‌سازی است. اما لایهٔ زیرساختِ صنعتیِ سند
> (pgvector/Kafka/Elasticsearch/WebSocket/آموزشِ ML و schema اختصاصی) هنوز اجرا نشده و به‌صراحت
> به‌عنوان مسیرِ scale-out علامت خورده. هیچ لایه‌ای «فیک» نیست، ولی سند به‌طورِ کامل دیپلوی نشده.»
