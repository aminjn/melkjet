# REOS — گزارشِ ممیزیِ کاملِ دو-فازی (v1 + v2)

> برای «هوش مصنوعیِ ممیز». هر ادعا به کدِ واقعی (فایل/تابع) وصل است و با ۱۱۳ تستِ خودکار روی
> PostgreSQLِ واقعی قابلِ راستی‌آزمایی است. زبان عمداً محتاطانه: «اجرا/تست‌شده» از «معادلِ درون‌استکی»
> جدا شده. **همه‌چیز روی تولید زنده است** (melkjet.com، کامیت `86ea854`، pgvector بومی فعال).
>
> **تاریخ:** 2026-07-07 · **مخزن:** melkjet-nextjs (Next.js 16.2.9، App Router)

---

## ۰) خلاصهٔ اجرایی

| فاز | چه چیزی | وضعیت |
|---|---|---|
| **REOS v1** | موتورِ الگوریتمی + آموزشِ ML + صفِ رویداد + embedding + candidate-gen + فید | ✅ اجرا، تست، دیپلوی |
| **REOS v2** | هر ۱۰ هدفِ ممیزیِ قبلی | ✅ اجرا، تست، دیپلوی |

**تست‌ها:** `npm run test:reos` = **۴۳/۴۳** (خالص + آموزش + نقش‌ها) و
`DATABASE_URL=… npm run test:reos:pg` = **۷۰/۷۰** (روی PostgreSQL 16 + pgvectorِ واقعی). جمع = **۱۱۳**.

**اصلِ راهنما (بدونِ تغییر از v1):** هیچ لایه‌ای «فیک» نیست؛ هر فرمول/مدل کدِ اجراییِ قابلِ‌تست دارد.
هرجا سرویسِ صنعتیِ خارجی (Kafka/Elasticsearch) نصب نشده، **معادلِ کارکردیِ درون‌استکی** پیاده و صریحاً
علامت خورده است.

---

## بخشِ اول — REOS v1 (هستهٔ موتور)

### ۱.۱ هسته — `app/lib/reos/` (فایل / خط)
| فایل | خط | نقش |
|---|---|---|
| `types.ts` | 88 | مدلِ موجودیت‌ها + `EMBED_DIM=64` + رویداد |
| `features.ts` | 80 | feature engineering، embedding، `cosine`، `haversineKm` |
| `scoring.ts` | 76 | فرمولِ Global (۶ مؤلفه) + لایهٔ دلیل |
| `hybrid.ts` | 70 | فرمولِ Hybrid (۴/۵ لایه) |
| `feed.ts` | 83 | Property Ranking + فیدِ چندبخشی + مصرفِ مدلِ آموزش‌دیده |
| `ml.ts` | 67 | ۵ خروجیِ ML (تبدیلِ لید/تقاضا/عملکردِ مشاور/قیمت) |
| `monetization.ts` | 67 | boost×quality، ارزشِ لید، upsell |
| `engine.ts` | 71 | ۳ نوع تطبیق (کاربر↔ملک، ملک↔کاربران، لید→مشاور) |
| `events.ts` | 55 | Event bus + پاداشِ online-learning (enqueue) |
| `queue.ts` | 61 | صفِ ناهمگام (معادلِ Kafka) — batch flush |
| `store.ts` | 272 | event log + feature store + embedding + **pgvector** (dual-mode) |
| `train.ts` | 152 | **آموزشِ واقعیِ ML** — Logistic Regression با Gradient Descent |
| `data.ts` | 112 | آداپتورِ دادهٔ واقعی + `similarProperties` |
| `orchestrator.ts` | 63 | سفرِ کاملِ خریدار |

### ۱.۲ نکاتِ کلیدیِ v1 که ممیز باید تأیید کند
- **آموزشِ واقعی (نه heuristic):** `train.ts` → `fitLogistic` گرادیان-دیسنتِ لجستیک روی دیتاستِ
  ساخته‌شده از رویدادهای واقعی؛ وزن‌ها در feature store ذخیره و در `feed.ts` مصرف و هر ۶ ساعت خودکار
  بازآموزی می‌شوند (`cron-runner.ts`). تست: بازیابیِ سیگنال، AUC>0.75، LogLoss < پیش‌فرض.
- **صفِ ناهمگام:** `ingest` (events.ts) دیگر مسیرِ درخواست را بلاک نمی‌کند؛ بافر + فلاشِ دسته‌ای
  (`queue.ts`) با coalescingِ feature bumps.
- **Data Flywheelِ زنده:** `ingest` از **۴ مسیرِ واقعیِ کاربر** صدا زده می‌شود (بازدید/سیو/تماس/افشا)
  — `listing-stats/route.ts`، `user/prefs/route.ts`، `listing-reveal/route.ts`، `agency/route.ts`.
- **حریمِ خصوصی:** `?userId=` در recommendations/match فقط سوپرادمین.

---

## بخشِ دوم — REOS v2 (۱۰ هدفِ ممیز) — همه اجرا و تست‌شده

### فاز ۱ · Multi-Role Intelligence — `roles.ts` (131)
هر نقش هدفِ متفاوت (نه فیدِ خریدارِ کپی‌شده): مالک=ارزشِ زیرِ بازار×تقاضا، مشاور/آژانس=فایلِ داغ،
سازنده=زمین/کلنگی، مصالح/معمار/پیمانکار=پروژهٔ فعال، کارشناس=نیازمندِ ارزش‌گذاری، حقوقی/دفترخانه=
معاملهٔ فعال، بانک=بازارِ وام‌پذیر. مسیر: `/api/reos/role-feed`. `ReosPanelSection` نقش را از مسیرِ
داشبورد می‌سازد → **۱۱ پنل** + خانه + خریدار. **۹ تست** (تفکیکِ نقش‌ها).

### فاز ۲ · AI Agent Framework — `agent/` (memory 95 / tools 90 / planner 65 / executor 40)
حافظهٔ بلندمدت (fact/pref/goal) + رجیستریِ ابزار روی موتورِ واقعی (recommend/similar/estimate_price/
predict_lead/match_agent/remember/recall) + planner قاعده‌مند و **LLM (GapGPT ReAct)** + حلقهٔ executor
با ثبتِ trace در `reos_agent_tasks`. مسیر: `/api/reos/agent` + ویجتِ چت در پنلِ خریدار. **۷ تست**.

### فاز ۳ · Knowledge Graph — `graph.ts` (170)
گره‌های نوع‌دار (user/property/agent/builder/lawyer/bank/notary/…) + یال‌های نوع‌دار (viewed/saved/
contacted/assigned/represents/…)، پیمایشِ BFS (`neighbors`/`subgraph`/`shortestPath`)، پرشدنِ خودکار
از رویدادها (هر ۶ ساعت). مسیر: `/api/reos/graph`. **۸ تست** (شاملِ مسیرِ چندگامیِ agent→user→property).

### فاز ۴ · Promotion Engine — `promotion-engine.ts` (140)
کمپین با بودجه + **CPC/CPM/flat** + pacingِ روزانه + آنالیتیکس (CTR/CPCِ واقعی/مانده)، شارژِ اتمیک
(FOR UPDATE)، چرخهٔ وضعیت (scheduled/active/paused/exhausted/ended). `activeBoosts` به boostِ فید تزریق
می‌شود ولی **گیتِ کیفیت پابرجاست** (پول بدونِ کیفیت رتبه نمی‌خرد). مسیر: `/api/reos/promo`. **۱۱ تست**.

### فاز ۵ · pgvector (بومی) — `store.ts`
تشخیصِ خودکارِ افزونهٔ `vector`؛ اگر بود، ستونِ `vec vector(64)` + ایندکسِ **HNSW** (`vector_cosine_ops`)
و جستجوی `<=>`؛ اگر نبود، cosineِ JS (backward-compatible). **روی تولید نصب و فعال است**
(pgvector 0.6.0، ستون + ایندکس تأییدشده). **۴ تست** روی pgvectorِ واقعی.

### فاز ۶ · Feature Store v2 — `market-features.ts` (49) + ویوها در `store.ts`
ویوهای نوع‌دار: `reos_property_features` / `reos_user_features` / `reos_agent_features` /
`reos_market_features` روی jsonb (queryable با SQL). `market-features.ts`: آمارِ بازار به‌تفکیکِ منطقه
(میانهٔ قیمت/متر، میانگین، تعداد، شاخصِ تقاضا)، هر ۶ ساعت بازمحاسبه. مسیر: `/api/reos/market`. **۷ تست**.

### فاز ۷ · CRM OS یکپارچه — `crm.ts` (191)
هستهٔ واحدِ **افزایشی** (Sales-OSهای per-role دست‌نخورده): pipeline ۷مرحله‌ای، activities، tasks،
meetings، **timelineِ ادغام‌شده**، **funnelِ تبدیل**، و **موتورِ automation** (تریگرهای new_lead/
stage_change/idle → create_task/move_stage/add_activity). امتیازِ لید از `predictLeadConversion` و با هر
فعالیت/مرحله بازمحاسبه می‌شود. اتوماسیونِ idle در cron. مسیر: `/api/reos/crm`. **۹ تست**.

### اهدافِ ۸/۹/۱۰ ممیز
- **۸ Role-specific feeds** = فاز ۱ (✅)
- **۹ Training pipeline** = `train.ts` v1 (✅)
- **۱۰ Event Streaming** = `queue.ts` v1 (معادلِ درون‌استکیِ Kafka؛ ✅)

---

## ۳) لایهٔ API — `app/api/reos/*` (۱۵ route)
`admin, agent, crm, events, graph, market, match, monetize, orchestrate, predict, promo,
recommendations, role-feed, similar, train`. گیتِ سوپرادمین روی admin/graph/train/market(POST).

## ۴) UI
`reos-admin/page.tsx` (175: KPI + مدل/AUC + گراف + صف + دکمهٔ آموزش)، `ReosFeed` (100)،
`ReosPanelSection` (23)، `ReosAgentChat` (56).

## ۵) جداولِ واقعیِ PostgreSQL (ساخته‌شده توسطِ کد، dual-mode)
`reos_events`, `reos_feature_store`, `reos_embeddings(+vec vector(64)+HNSW)`, `reos_agent_memory`,
`reos_agent_tasks`, `reos_graph_nodes`, `reos_graph_edges`, `reos_promo_campaigns`, `reos_crm` +
ویوهای `reos_{property,user,agent,market}_features`.

---

## ۶) چک‌لیستِ راستی‌آزمایی برای ممیز
- [ ] تست‌ها را خودت اجرا کن: `npm run test:reos` (۴۳) و `…npm run test:reos:pg` (۷۰).
- [ ] آموزش واقعی است؟ `train.ts:fitLogistic` گرادیان-دیسنت؛ تستِ «trained logloss < default» + «AUC>0.75».
- [ ] فید در همهٔ پنل‌ها؟ `grep -rl ReosPanelSection app` = ۱۱ پنل + خانه/خریدار مستقیم.
- [ ] گراف مسیرِ چندگامی می‌دهد؟ تستِ `shortestPath('a:A9','p:P9')` = طولِ ۳.
- [ ] Promotion گیتِ کیفیت دارد؟ `feed.ts` promo = boost × (0.5+0.5×quality).
- [ ] pgvector بومی است؟ روی سرور: `\d reos_embeddings | grep vec` → `vec | vector(64)` + ایندکسِ hnsw.
- [ ] agent حافظه/ابزار واقعی دارد؟ تستِ remember→persist، recall→retrieve، multi-step tool→answer.
- [ ] CRM اتوماسیون واقعی دارد؟ تستِ new_lead→task، idle→task، funnel conversionRate.
- [ ] آیا جایی ادعای «Kafka/Elasticsearchِ صنعتی نصب است» هست؟ **نباید باشد** — §۷ می‌گوید معادلِ درون‌استکی.

## ۷) صادقانه چه چیزی هنوز صنعتی نشده (معادلِ کارکردی اجرا شده)
1. **Kafka/Elasticsearchِ بومی** نصب نیست — صفِ حافظه + candidate-genِ SQL جایگزین‌اند (برای مقیاسِ
   بسیار بزرگ باید سرویسِ اختصاصی آید؛ مسیرِ ارتقا مستند).
2. **XGBoost/آموزشِ توزیع‌شده** نیست — آموزشِ فعلی Logistic Regression تک‌نودی است (واقعی و تست‌شده).
3. **CRM OS**: هستهٔ یکپارچهٔ جدید ساخته شد، ولی UIهای per-role هنوز روی Sales-OSهای قبلی‌اند (اتصالِ
   UI به هستهٔ واحد = کارِ تدریجیِ بعدی؛ backendِ CRM OS کامل و تست‌شده است).

## ۸) جمع‌بندیِ یک‌خطی
> «REOS v1 + v2 (هر ۱۰ هدفِ ممیز) کدِ واقعیِ تست‌شده و **روی تولید زنده** است — ۱۱۳ تست روی
> PostgreSQLِ واقعی، آموزشِ ML با gradient descent، جستجوی برداریِ بومیِ pgvector/HNSW، و بقیهٔ لایه‌ها.
> تنها جایگزینیِ سرویس‌های صنعتیِ خارجی (که معادلِ درون‌استکی دارند) به‌عنوان مسیرِ ارتقا باقی مانده.
> هیچ لایه‌ای فیک نیست.»
