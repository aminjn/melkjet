# MelkJet REOS — Real Estate Operating System
### سندِ معماریِ واحد و کامل (Master Specification)

> این سند همهٔ لایه‌ها را یک‌جا جمع می‌کند: معماری، دیتابیس، Event system، موتورِ تطبیقِ AI،
> فیدِ توصیه، لایهٔ ML، موتورِ درآمد (Monetization)، لایهٔ AI Agent + Orchestrator،
> Data Flywheel + Intelligence Graph، Real-time، API، ساختارِ پوشه، و استکِ فنی.
> بخشِ پایانی «وضعیتِ پیاده‌سازی» دقیقاً می‌گوید چه چیزی همین حالا در کد اجراست و مسیرِ scale-out چیست.

MelkJet یک **سایتِ آگهی نیست**؛ یک **Decision Engine برای بازارِ املاک** است — ترکیبِ
Zillow (کاتالوگ+رتبه‌بندی) + HubSpot (CRM/pipeline) + Airbnb (تجربهٔ کاربر) + Stripe (پول) + TikTok (فیدِ یادگیرنده).

---

## ۰) اصولِ طراحی
- **Multi-tenant**: هر نقش و هر سازمان (آژانس/سازنده/بانک/…) داده و pipelineِ جدا (`organization_id`).
- **Event-driven**: هر اکشن → رویداد → آپدیتِ feature store → re-score → re-rank → UI.
- **ML-ready**: feature store + vector store؛ مدل‌ها inference-only و قابلِ جایگزینی با وزنِ آموزش‌دیده.
- **ID-based**: همهٔ لینک‌ها با **آیدیِ پروفایل** (نه نام) تا سیستم هرگز بهم نریزد.
- **Scalable**: طراحی برای ۱M+ آگهی و ۱۰M+ کاربر؛ candidate-generation + ranking دومرحله‌ای.
- **Trust-gated monetization**: پول به‌تنهایی رتبه نمی‌خرد — `boost × quality`.

---

## ۱) معماریِ کلان (Modular Monolith، آمادهٔ تجزیه به microservice)

```
                         ┌─────────────── CLIENTS (web / mobile / GHA) ───────────────┐
                         ▼                                                            ▼
                  ┌──────────────┐         API GATEWAY (Next.js route handlers)  ┌──────────┐
                  │ Realtime/SSE │◀────────────────────┬────────────────────────▶│  Auth    │ RBAC+ABAC
                  └──────────────┘                     │                         └──────────┘
   ┌───────────────────────────────────────────────────────────────────────────────────────┐
   │  CORE SERVICES        Property │ Lead/CRM │ Agent/Agency │ Builder │ Legal │ Finance │ … │
   ├───────────────────────────────────────────────────────────────────────────────────────┤
   │  AI/ML SERVICES       Matching Engine (CORE) │ Ranking │ Recommendation │ Lead-Scoring   │
   │                       Behavior Tracking │ Prediction (conversion/price/demand)           │
   ├───────────────────────────────────────────────────────────────────────────────────────┤
   │  MONETIZATION         Promotion │ Lead-Marketplace │ Subscriptions │ Dynamic-Pricing     │
   ├───────────────────────────────────────────────────────────────────────────────────────┤
   │  AI AGENTS            per-role Digital Employee  ──▶  AI ORCHESTRATOR (cross-role network)│
   └───────────────────────────────────────────────────────────────────────────────────────┘
        │ EVENT BUS (in-app dispatcher → Redis Streams/Kafka)     │ FEATURE STORE     │ VECTOR DB
        ▼                                                         ▼                   ▼
   ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────┐   ┌───────────────────┐
   │ PostgreSQL  │   │ Redis (cache)│   │ Elasticsearch │   │ pgvector │   │ Object store/media│
   └─────────────┘   └──────────────┘   └───────────────┘   └──────────┘   └───────────────────┘
```

**نگاشتِ محیطِ فعلی → مقیاس‌پذیر:** Event bus = دیسپچرِ درون‌برنامه‌ای + جدولِ `events` (→ Kafka/Redis Streams).
Vector DB = بردارِ jsonb + کسینوسِ درون‌کد (→ pgvector). Search = فیلترِ SQL/JS (→ Elasticsearch). Cache = کشِ حافظه/۱۵ث (→ Redis).

---

## ۲) لایه‌های دیتابیس (کاملِ schema در `docs/reos-schema.sql`)
| لایه | جدول‌ها |
|---|---|
| Auth/Tenant | `organizations، users، roles، user_roles` (RBAC+ABAC) |
| Real-estate core | `properties، property_media، property_price_history` |
| CRM | `leads، lead_interactions، lead_tags` |
| Money | `deals` |
| Business | `agents، agent_performance، agency_memberships، projects` |
| **AI/ML** | `embeddings(VECTOR)، feature_store، predictions، matches` |
| **Event** | `events` (قلبِ AI) |
| Recommendation | `user_preferences، recommendation_feed، ranking_logs` |
| Monetization | `plans، subscriptions، promotions، leads_marketplace، campaigns، transactions` |
| AI Agent | `ai_agents، ai_memory، ai_tasks، ai_actions` |
| Search | `search_index (tsvector + geo)` |

**Relation map:** `User → Lead → Agent → Property → Deal → Payment`. ایندکس‌ها روی city/price/geo/status، lead status/score/agent، events type/entity/user/time، matches score، feed(user,score)، search(GIN).

---

## ۳) Event-Driven Architecture (سیستمِ عصبی)
**ایدهٔ اصلی:** هر اکشن = یک Event → دادهٔ زنده → آپدیتِ AI → آپدیتِ Matching → آپدیتِ UI.

**Pipeline:**
```
Frontend → API (Event Collector) → [Broker: Redis Streams/Kafka] → Workers
        → feature_store update → re-score(lead/property) → AI matching trigger
        → recommendation rebuild → Realtime push (WebSocket/SSE) → UI
```

**Event types:**
- User: `user_view_property، user_clicked_property، user_saved_property، user_searched، user_contact_agent`
- CRM: `lead_created، lead_updated، lead_contacted، lead_won، lead_lost`
- Property: `property_created، property_updated، property_boosted، property_sold`
- Agent/Business: `agent_assigned، agent_called_lead، deal_created، deal_closed، payment_done، campaign_started`

**Online-learning rewards (وزنِ سیگنال):** `click +1 · save +5 · contact/call +20 · deal +100 · ignore/skip −2`.
هر رویداد `feature_store` را افزایش می‌دهد (`click_count، save_count، contact_count، intent_score، engagement_score`) و فیدِ کاربر را «کهنه» می‌کند تا در خواندنِ بعدی از نو ساخته شود.

**فایلِ اجرا:** `app/lib/reos/events.ts` (`ingest`, `REWARD`) + `app/lib/reos/store.ts` (`recordEvent، getFeatures، bumpFeatures`).

---

## ۴) موتورِ تطبیقِ جهانی (GLOBAL AI MATCHING — CORE)
### ۴.۱ Feature Engineering
- **User:** `budget_ratio، location_distance، intent_score، click_rate، save_rate، session_time، search_keywords، engagement`
- **Property:** `price_distance_to_budget، geo_distance، type_match، demand_score، engagement_score، days_on_market، quality`
- **Agent:** `response_time، conversion_rate، lead_success_rate، specialty_match، activity، trust`
- **Context:** `time_of_day، market_trend، seasonality، region_hotness، campaign_boost`

### ۴.۲ Embedding layer
`UserVector / PropertyVector / AgentVector` (بُعدِ ثابت `EMBED_DIM=64`): embeddingِ متنی (bag-of-hashed-tokens نرمال‌شده)، جغرافیایی (haversine)، رفتاری (تجمیعِ توکنِ املاکِ تعامل‌شده). شباهت = **cosine**. ذخیره در `embeddings`/jsonb (ارتقا: pgvector 1536).

### ۴.۳ دو فرمولِ اسکورینگ (هر دو پیاده‌شده)
**الف) Global component score** — `app/lib/reos/scoring.ts`
```
FinalScore = 0.35·BudgetMatch + 0.25·LocationMatch + 0.15·BehaviorMatch
           + 0.10·IntentStrength + 0.10·HistoricalInteraction + 0.05·MarketDemand
```
**ب) Hybrid production ranker (۴ لایه)** — `app/lib/reos/hybrid.ts`
```
Layer1 Rule (fast filter): if price > budget×1.3 → reject ; else rule_score
Layer2 ML  : P(conversion) لجستیک روی (budget, vector, demand, engagement)
Layer3 Vector: cosine(user_embed, property_embed)
Layer4 Business boost: featured/vip (trust-gated)
FinalScore = 0.30·ML + 0.25·Vector + 0.20·Rule + 0.15·Behavioral + 0.10·BusinessBoost
```

### ۴.۴ سه نوع تطبیق — `app/lib/reos/engine.ts`
1. **User → Property** (فیدِ شخصی‌سازی‌شده، top-K).
2. **Property → Users** (لیستِ هدف‌گیری برای SMS/واتساپ/push/campaign، top-100).
3. **Lead → Agent** (`0.5·perf + 0.3·capacity + 0.2·specialty`).

### ۴.۵ Cold start
- کاربرِ جدید: فقط location+budget + املاکِ trending + مشاورانِ محبوب.
- ملکِ جدید: push به کاربرانِ مشابه (geo+price cluster) + boostِ نمایشِ اولیه.

---

## ۵) فیدِ توصیه (Zillow × TikTok × Amazon) — `app/lib/reos/feed.ts`
**Property Ranking Score:**
```
0.35·UserMatch + 0.20·Quality + 0.15·Engagement + 0.10·Freshness + 0.10·Demand + 0.10·Promotion
```
**Ranking pipeline:** Candidate Generation (فیلترِ سریع) → AI Ranking → Business Rules (حذفِ فروخته‌شده، اعمالِ promotion با گیتِ کیفیت) → top-20.

**بخش‌های فید:** `forYou (پیشنهادِ مخصوص) · hotInArea (داغِ منطقه) · freshMatches (تازه‌های مناسب) · priceDrops (کاهشِ قیمت) · investment (فرصتِ سرمایه‌گذاری)`.

**لایهٔ توضیحِ AI (اعتمادساز):** «چرا این ملک؟ ✓ مشابهِ N فایلی که دیدی ✓ در بودجه/منطقه ✓ پرتقاضا ✓ تازه ثبت‌شده».
هر کارت: `matchPct، reasons، parts{userMatch,quality,engagement,freshness,demand,promotion}`.

---

## ۶) لایهٔ ML — `app/lib/reos/ml.ts`
| مدل | خروجی | ورودی |
|---|---|---|
| Lead Conversion | `P(convert) 0..1` + برچسبِ داغ/گرم/سرد | phone/email/budget/stage/recency/activity/agentPerf |
| Property Demand | `demand 0..1` | views/contacts/saves + تازگی |
| Agent Performance | `perf 0..1` | conversion/response/rating/deals |
| Price Optimization | قیمتِ پیشنهادی + بازه | medianPricePerM/area + demand |
| Revenue/Upsell | `P(buy plan)` | listings/leads/aiUses/loginDays |

**Training pipeline (هدف):** `EVENT LOGS → FEATURE STORE → TRAIN DATASET → XGBoost/LightGBM → Deployment API → Real-time scoring`.
**Feedback loop:** `Prediction → Real Result (deal?) → Compare → Retrain → Better`. برچسب = `did_user_convert / deal_closed_with_property`. جدولِ `ranking_logs` بازخوردِ impression→click→save→contact را ذخیره می‌کند.
> پیاده‌سازیِ فعلی: مدل‌های لجستیکِ ویژگی‌محور (inference)؛ همان فرمول با **وزنِ آموزش‌دیده** جایگزین می‌شود بدونِ تغییرِ API.

---

## ۷) موتورِ درآمد (Monetization / Revenue OS) — `app/lib/reos/monetization.ts`
- **Promotion (آگهی):** Boost / Featured / VIP → `effectiveBoost = rawBoost × quality` (Trust gate: آگهیِ ضعیف با پول هم رتبهٔ کامل نمی‌گیرد).
- **Agent Boost:** «مشاور طلایی» → `agentRankingScore = 0.7·perf + 0.3·(paidBoost×qualityGate)`.
- **Lead Marketplace:** `leadValue ∝ intent × budget × regionDemand`؛ exclusive ≈ ۲.۲× shared.
- **Dynamic Pricing:** ضریبِ زمان/منطقه (جمعه/شب/منطقهٔ داغ).
- **Auction (مرحلهٔ پیشرفته):** رقابتِ مشاوران روی لید؛ برنده = بالاترین `bid × quality`.
- **Subscriptions:** پلنِ هر نقش (مشاور Free/Pro/Premium؛ آژانس Basic/Business/Enterprise؛ سازنده Project-Package؛ مصالح Marketplace-fee؛ حقوقی Lead+Sub؛ بانک Referral).
- **AI Revenue Optimization:** پیشنهادِ درآمدزا («آگهیت X٪ کمتر دیده شده — با Boost لیدت چند برابر می‌شود»).
- **Revenue Prediction:** `predictPlanUpsell` (چه کسی آمادهٔ ارتقاست).

**فازبندیِ درآمد:** فاز۱ = Promote آگهی + صفحهٔ ویژهٔ مشاور. فاز۲ = اشتراکِ Pro + فروشِ لید + سایت‌سازِ حرفه‌ای. فاز۳ = AI Ranking پولی + Auction + Lead Marketplace.

---

## ۸) لایهٔ AI Agent + Orchestrator — `app/lib/reos/orchestrator.ts`
هر نقش یک **کارمندِ دیجیتال** دارد: `Knowledge (دادهٔ همان نقش) + Memory (کوتاه/بلندمدت) + Tools (create_lead، send_message، analyze_property، schedule_followup) + Reasoning`.
- **مشاور:** مدیریت/اولویت‌بندیِ لید، follow-up خودکار، تحلیلِ فایل، تولیدِ محتوا.
- **آژانس:** مدیریتِ تیم، تقسیمِ هوشمندِ لید (ID-based)، پیش‌بینیِ درآمد.
- **سازنده/حقوقی/مالی/پیمانکار/دفترخانه/معمار/مصالح:** ابزارِ تخصصیِ همان نقش.

**Orchestrator (Marketplace Network):** خریدار → تطبیقِ ملک → بهترین مشاور → توانِ مالی/وام → cross-sell (بیمه/حقوقی) → ارزشِ لید. یک معامله = چند درآمد. جدول‌ها: `ai_agents، ai_memory، ai_tasks، ai_actions`.
> در اپِ فعلی، لایهٔ زبانی از GapGPT (`chatCompleteSafe`) + دستیارهای موجود (`AssistantPanel، ProAiTool، advisorLeadAdvice، agencyLeadAdvice`) استفاده می‌کند؛ REOS تصمیم/داده را تأمین می‌کند.

---

## ۹) Data Flywheel + Real Estate Intelligence Graph
```
کاربرِ بیشتر → تعاملِ بیشتر → دادهٔ رفتاریِ بیشتر → مدلِ بهتر
   → پیشنهادِ دقیق‌تر → معامله/لیدِ بیشتر → ارزشِ بیشتر → کاربرِ بیشتر  ↺
```
- **Data collection:** از روزِ اول ذخیره: کلیک، جستجو، مشاهده، مدتِ مشاهده، ذخیره، تماس، پیام، تغییرِ قیمت، تاریخچهٔ آگهی، رفتارِ مشاور.
- **Property DNA:** `{type, location_score, price_position, demand_score, buyer_profile[], selling_probability}`.
- **Agent Intelligence:** `{specialty[], conversion_rate, avg_response_time, trust_score}`.
- **Market Intelligence:** قیمت/تقاضا/زمانِ فروشِ لحظه‌ایِ هر منطقه (قابلِ فروش به بانک/سرمایه‌گذار/سازنده — Analytics API، Pricing API).
- **Knowledge Graph:** `Buyer→Property→Agent→Builder→Bank→Lawyer→Contractor` همه به هم وصل.
- **Data Quality Score:** `Source Trust + User Trust + Transaction Verification` — آگهیِ جعلی مدل را خراب نکند.
- **Data Moat:** رقیب سایت را کپی می‌کند، ولی event/transaction/conversion/agent-performance/market-intelligence را نه.

---

## ۱۰) Real-time
WebSocket (Socket.io) برای: آپدیتِ زندهٔ رتبه، تخصیصِ فوریِ لید، push. در محیطِ فعلی: SSE/short-poll روی endpointِ توصیه (نسخهٔ فید با `feedVersion` ابطال می‌شود).

---

## ۱۱) API Design (REST؛ قابلِ افزودنِ GraphQL)
```
# Events & feed
POST  /api/reos/events                 # ingest رویداد (Event Collector)
GET   /api/reos/events?userId=          # رویدادهای اخیر
GET   /api/reos/recommendations         # فیدِ خانه (چندبخشی) برای کاربرِ session
# Matching
GET   /api/reos/match?userId=           # user → properties
GET   /api/reos/match?propertyId=       # property → users (هدف‌گیریِ کمپین)
POST  /api/reos/assign                  # lead → best agent
# ML & money
POST  /api/reos/predict                 # {kind: conversion|demand|agent|price|upsell}
POST  /api/reos/monetize                # {leadValue|boostQuote|dynamicPrice}
POST  /api/reos/orchestrate             # سفرِ خریدار (cross-role)
GET   /api/reos/analytics               # داشبوردِ بازار/عملکرد
```
(APIهای موجودِ اپ نیز REOS را مصرف می‌کنند: `/api/agency assignLead/autoAssignLead`، `/api/advisor aiInsights/leadAdvice`.)

---

## ۱۲) ساختارِ پوشه (monorepo)
```
app/lib/reos/                 # ← هستهٔ REOS (پیاده‌شده)
  types.ts        # موجودیت‌ها، بردارها، رویدادها، پیش‌بینی‌ها
  features.ts     # feature engineering + embedding + cosine + haversine
  scoring.ts      # فرمولِ Global (0.35/0.25/0.15/0.10/0.10/0.05)
  hybrid.ts       # مدلِ هایبریدِ ۴لایهٔ production (0.30/0.25/0.20/0.15/0.10)
  ml.ts           # ۴+ مدلِ inference (conversion/demand/agent/price/upsell)
  engine.ts       # ۳ نوع تطبیق + homeFeed
  feed.ts         # PropertyRankingScore + بخش‌های فید + explain
  monetization.ts # promotion/lead-value/dynamic/agent-rank/upsell
  events.ts       # Event pipeline + online-learning reward + feed invalidation
  store.ts        # events + feature_store (dual-mode: PG/فایل)
  data.ts         # آداپتورِ دادهٔ واقعی (listings/agents/user)
  orchestrator.ts # AI Orchestrator (cross-role journey)
app/api/reos/*                # route handlers (لایهٔ API)
docs/reos-schema.sql          # schemaِ کاملِ PostgreSQL (pgvector-ready)
docs/REOS.md                  # همین سند
```
**در مقیاسِ microservice:** هر ماژول → یک سرویس (`matching-svc، ranking-svc، events-svc، monetization-svc، agent-svc`) پشتِ همان قراردادهای type.

---

## ۱۳) استکِ فنی
| لایه | فعلی (اجرا) | مقیاس‌پذیر (Zillow-level) |
|---|---|---|
| Runtime | Next.js 16 (App Router) + pm2 fork×4 + nginx | Node workers + Python FastAPI (ML) |
| DB | PostgreSQL (kv + جدولِ نرمالِ listings/reos) | PostgreSQL sharded + read-replica |
| Vector | jsonb + cosineِ درون‌کد | pgvector / Pinecone |
| Event bus | dispatcherِ درون‌برنامه‌ای + جدولِ events | Kafka / Redis Streams |
| Cache | حافظه + کشِ ۱۵ث | Redis |
| Search | فیلترِ SQL/JS + tsvector | Elasticsearch |
| ML | لجستیکِ ویژگی‌محور (inference) | XGBoost/LightGBM/Two-Tower/NCF |
| Realtime | SSE/poll | WebSocket (Socket.io) |
| LLM | GapGPT (chatCompleteSafe) | Claude/GPT برای reasoning، Qwen برای ارزان |

---

## ۱۳.۵) AI Infrastructure Stack (زیرساختِ اجرای مغزِ AI)
معماریِ زیرساخت برای میلیون‌ها آگهی/کاربر و میلیاردها Event:
```
FRONTEND → API Gateway → { Backend · AI Gateway · Event System }
Backend → PostgreSQL(+PostGIS+pgvector) → { Redis · Elasticsearch · Vector DB }
                                     → AI/ML Platform { Training · Inference · Monitoring }
```
| # | مؤلفه | ابزارِ پیشنهادی | نقش |
|---|---|---|---|
| 1 | Backend | Node.js/NestJS (apps: api/auth/crm/property/marketplace/billing/ai-gateway) | سرویس‌های اصلی |
| 2 | API Gateway | Kong / Nginx / Traefik | مسیریابیِ همهٔ درخواست‌ها، rate-limit |
| 3 | DB | **PostgreSQL 17 + PostGIS + pgvector** | داده + جستجوی جغرافیایی (radius/nearby) + جستجوی معنایی |
| 4 | Cache | Redis | session، ranking cache، real-time، rate-limit |
| 5 | Search | Elasticsearch / OpenSearch | جستجو/فیلتر/autocomplete در مقیاس |
| 6 | Event infra | Redis Streams (شروع) → **Kafka** | topics: user/property/crm/payment/ai_events |
| 7 | Vector DB | pgvector (شروع) → Pinecone/Weaviate | embeddingِ user/property/agent/document |
| 8 | **AI Gateway** | Router سفارشی | انتخابِ مدل، کنترلِ هزینه، cache، fallback، logging |
| 9 | LLM stack | ارزان: Qwen/Gemini-Flash/GPT-mini · قوی: Claude/GPT | تولیدِ محتوا vs. تحلیل/Reasoning |
| 10 | ML platform | Python: PyTorch/sklearn/LightGBM/XGBoost | Two-Tower (rec)، LGBM Ranker، XGBoost (predict) |
| 11 | Feature store | PostgreSQL JSONB (شروع) → Feast | ویژگی‌های زندهٔ ML |
| 12 | Model serving | **FastAPI / BentoML / TorchServe** (جدا از Backend) | سرویسِ inferenceِ مدل |
| 13 | Agent infra | LangGraph / LangChain / LlamaIndex | Orchestratorِ Memory/Tools/Tasks |
| 14 | Document AI | OCR (Tesseract/PaddleOCR) → Embedding → **RAG** | تحلیلِ قرارداد/سند/گزارش |
| 15 | Storage | S3-compatible (MinIO/R2/S3) | عکس/ویدئو/قرارداد/فایلِ پروژه |
| 16 | Monitoring | Prometheus + Grafana | CPU/GPU/latency/AI-cost/accuracy |
| 17 | AI Observability | Langfuse / Helicone | لاگِ prompt/response/cost/latency/feedback |
| 18 | Deployment | VPS (شروع) → Docker → **Kubernetes** (auto-scale) | استقرار |
| 19 | GPU | فعلاً API؛ بعداً RTX4090/L40S/A100 | embedding/ranking/vision |
| 20 | Security | JWT/OAuth + Rate-limit + Encryption + Backup + Audit-log | امنیت |
| 21 | **AI Cost Optimization** | Simple→Cheap model، Complex→Premium، Matching→ML خودت | کنترلِ هزینه |

**MVP سه‌سروری:** Server1 = Node+Redis+Nginx · Server2 = PostgreSQL+PostGIS+pgvector · Server3 = Python+FastAPI+ML · External = LLM APIs + Object storage + SMS + Maps.
> در محیطِ فعلیِ MelkJet: همه روی یک VPS (۴vCPU/۸GB، pm2×4 + nginx)، PostgreSQL فعال، AI Gateway = `app/lib/gapgpt.ts` (agent→model routing + fallback به gpt-4o-mini)، Storage = `.media/`، Maps = Neshan. مسیرِ ارتقا دقیقاً همین جدول است.

## ۱۴) نقشهٔ راه (Phases)
- **MVP (اکنون):** Event tracking، User preference، Rule+Hybrid matching، Recommended feed، Lead-scoring، Follow-up، Promote، ID-based lead↔agent.
- **V2:** ML ranking (XGBoost)، Vector search (pgvector)، Personalization، فروشِ لید، اشتراکِ Pro.
- **V3:** Real-time AI feed، Predictive buying intent، Auction، Lead Marketplace، Analytics/Pricing API، Knowledge Graph کامل.

---

## ۱۴.۵) Production Deployment + DevOps
**استراتژی: Phase-based (نه Kubernetes از روزِ اول).**
- **Phase 1 (۰–۱۰۰هزار کاربر):** `Cloudflare → Nginx → [Next.js + NestJS API + AI worker] → PostgreSQL + Redis`. سه سرور: (۱) Front+Backend، (۲) DB+Redis+Backup، (۳) AI/ML worker.
- **Phase 2 (۱۰۰هزار–۱M):** `Load Balancer → {Frontend · API · AI · Workers} → Database Cluster` (جداسازیِ سرویس‌ها).
- **Phase 3 (۱M+):** Kubernetes (Frontend/Backend/Worker/AI pods) + Kafka/Elastic/VectorDB cluster + DB cluster.

**Monorepo:** `apps/{web(Next.js), api(NestJS), ai-service(FastAPI), worker(queue)} · packages/{database, ui, shared-types, config} · infrastructure/{docker, nginx, terraform} · docker-compose.yml`.
**Git:** `feature/* → develop → (testing) → production/main`.
**Docker:** هر سرویس Container جدا (backend/ai/worker) + `docker-compose` برای MVP (frontend/backend/postgres/redis/ai/worker).
**CI/CD (GitHub Actions):** `push → install → tests → build image → push registry → deploy → health-check → live`. سه محیط: `localhost / staging.melkjet.com / melkjet.com`.
**Secrets:** فقط ENV (هیچ کلیدی در کد) → بعداً Vault/Secrets-Manager. (`DATABASE_URL، LLM keys، SMS، JWT_SECRET`).
**DB:** Primary (write) + Read-Replica (search/reports/analytics). **Backup:** روزانه۷/هفتگی۴/ماهانه۱۲ روی Object storage (اجراشده: `scripts/backup.sh`).
**Storage/CDN:** آپلود → Object storage (MinIO/R2/S3) → CDN → کاربر (عکس/ویدئو/قرارداد).
**Queue:** کارهای سنگین از API خارج → **Redis + BullMQ** (شروع) → Kafka. (اجراشده: صفِ اسکرپ روی instance-0).
**Monitoring:** Prometheus + Grafana (سرور)، Sentry (خطای اپ)، Langfuse (AI: prompt/token/cost/latency/feedback).
**Security (۳ لایه):** Cloudflare WAF/DDoS · App JWT/RBAC/Rate-limit · DB Encryption/Access-control/Audit-log.
> در MelkJet فعلی: Arvan CDN + Nginx + pm2×4 + PostgreSQL + `.media/` + صفِ درون‌برنامه‌ای + `scripts/deploy.sh` (health-check) + `scripts/backup.sh` — همان Phase 1، آمادهٔ رشد به Phase 2/3 بدونِ بازنویسی.

## ۱۵) وضعیتِ پیاده‌سازی (صادقانه)
**اجراشده و تست‌شده (کدِ واقعی در `app/lib/reos/` + ۵۶ تستِ خودکار):** feature engineering، embedding+cosine، هر دو فرمولِ اسکورینگ، مدلِ هایبریدِ ۴لایه، ۳ نوع تطبیق، فیدِ چندبخشی + لایهٔ توضیح، ۵ مدلِ ML، موتورِ درآمد، Event pipeline + online-learning + feature store (dual-mode PG/فایل)، آداپتورِ دادهٔ واقعی، Orchestrator. `docs/reos-schema.sql` schemaِ کاملِ production است.

**تکمیل‌شده در این دور (با تست):**
- **آموزشِ واقعیِ ML** (`train.ts`): Logistic Regression با **Gradient Descent** روی دیتاستِ ساخته‌شده از رویدادهای واقعی؛ وزن‌ها یاد گرفته و در feature store ذخیره می‌شوند، در رتبه‌بندی (`feed.ts`) مصرف و هر ۶ ساعت خودکار بازآموزی می‌شوند (cron). تست: بازیابیِ سیگنالِ واقعی، AUC، کاهشِ LogLoss نسبت به پیش‌فرض.
- **صفِ رویدادِ ناهمگام** (`queue.ts` — معادلِ Kafka): `ingest` دیگر مسیرِ درخواست را بلاک نمی‌کند؛ بافرِ حافظه + فلاشرِ دسته‌ای (batch INSERT + coalesced feature bumps).
- **پایداریِ embedding** (`store.ts` `reos_embeddings` — معادلِ pgvector با jsonb): محاسبهٔ یک‌بار، استفادهٔ مجدد؛ مصرف‌شده در «املاکِ مشابه» (`/api/reos/similar`) روی صفحهٔ هر ملک.
- **Candidate generation با SQL** (`candidateListings` — معادلِ Elasticsearch): گرفتنِ N کاندیدا با ایندکس به‌جای بارگذاریِ کلِ جدول → مقیاس‌پذیر به میلیون‌ها آگهی.
- **route handlers کامل**: events, recommendations, match, predict, monetize, admin, **train, similar, orchestrate**.
- **فید در همهٔ پنل‌ها**: خانهٔ عمومی + خریدار + مالک + مشاور + آژانس + سازنده + مصالح + ۶ نقشِ حرفه‌ای (معمار/پیمانکار/کارشناس/حقوقی/بانک/دفترخانه) + «املاکِ مشابهِ هوشمند» روی صفحهٔ هر ملک.
- **Orchestrator زنده**: `/api/reos/orchestrate` سفرِ کاملِ خریدار (تطبیق→مشاور→مالی→cross-sell→ارزشِ لید).

**همچنان scale-out (طراحی‌شده، هنوز جایگزینِ صنعتی نصب‌نشده):** Kafka/Pinecone/Elasticsearch/WebSocket و آموزشِ توزیع‌شدهٔ XGBoost — همه با «معادلِ درون‌استکیِ» بالا کار می‌کنند و مسیرِ ارتقا در جدولِ استک مستند است. schemaِ اختصاصیِ pgvector (`reos-schema.sql`) هنوز روی DB اعمال نشده؛ لایهٔ فعلی jsonb است.

**تست‌ها:** `npm run test:reos` (۴۳ تستِ خالص + آموزش + Multi-Role) و `DATABASE_URL=… npm run test:reos:pg` (۲۲ تستِ یکپارچه روی PostgreSQLِ واقعی).

### REOS v2 — فاز ۱: لایهٔ هوشِ چندنقشی (Multi-Role Intelligence) — اجرا شد
پاسخ به بزرگ‌ترین ضعفِ ممیزی (فیدِ همهٔ پنل‌ها یکسان بود). `app/lib/reos/roles.ts`: هر نقش
**هدفِ متفاوت** دارد و از همان primitiveهای هسته (demand/quality/freshness/value/price-band)
فیدِ مخصوصِ خودش را می‌سازد — بدونِ refactorِ هسته، backward-compatible:
- **مالک/سرمایه‌گذار** → فرصت‌های سرمایه‌گذاری (ارزشِ زیرِ بازار × تقاضا) + پرتقاضاها
- **مشاور/آژانس** → فایل‌های داغ برای پیشنهاد به مشتری + تازه‌ثبت‌شده‌ها
- **سازنده** → زمین/کلنگیِ پرتقاضا + مناطقِ پرتقاضا برای ساخت
- **مصالح/معمار/پیمانکار** → پروژه‌ها و کلنگی‌های فعال (مشتریانِ بالقوه)
- **کارشناس** → آگهی‌های جدید نیازمندِ ارزش‌گذاری
- **حقوقی/دفترخانه** → معاملاتِ فعالِ منطقه
- **بانک/بیمه** → بازارِ وام‌پذیر (بندِ قیمتیِ تسهیلات)
مسیر: `/api/reos/role-feed?role=…` → `ReosPanelSection` نقش را از مسیرِ داشبورد تشخیص می‌دهد.
تست: تفکیکِ نقش‌ها (سازنده فقط کلنگی، بانک بدونِ اجاره، مالک تخفیف‌محور)، ۹ سنجه PASS.

### REOS v2 — فاز ۲: AI Agent Framework — اجرا شد
`app/lib/reos/agent/` (memory/tools/planner/executor). حافظهٔ بلندمدت (fact/pref/goal)، رجیستریِ
ابزار روی موتورِ واقعی (recommend/similar/estimate_price/predict_lead/match_agent/remember/recall)،
plannerِ قاعده‌مند + LLM (GapGPT ReAct)، حلقهٔ executor با ثبتِ trace در `reos_agent_tasks`.
مسیر: `/api/reos/agent` + ویجتِ چت در پنلِ خریدار. ۷ تستِ PG.

### REOS v2 — فاز ۳: Knowledge Graph — اجرا شد
`app/lib/reos/graph.ts`: گره‌های نوع‌دار (user/property/agent/builder/lawyer/bank/notary/…) + یال‌های
نوع‌دار (viewed/saved/contacted/assigned/represents/…)، پیمایشِ BFS (neighbors/subgraph/shortestPath)،
پرشدن خودکار از رویدادها (هر ۶ ساعت). مسیر: `/api/reos/graph`. ۸ تستِ PG.

### REOS v2 — فاز ۴: Promotion Engine — اجرا شد
`app/lib/reos/promotion-engine.ts`: کمپین با بودجه + CPC/CPM/flat + pacingِ روزانه + آنالیتیکس
(CTR/CPCِ واقعی/مانده)، شارژِ اتمیک، `activeBoosts` که به boostِ فید تزریق می‌شود (گیتِ کیفیت پابرجا).
مسیر: `/api/reos/promo`. ۱۱ تستِ PG.

### REOS v2 — فاز ۵: pgvector (جستجوی برداریِ بومی) — اجرا شد
`store.ts`: تشخیصِ خودکارِ افزونهٔ `vector`؛ اگر نصب بود، ستونِ بومیِ `vec vector(64)` + ایندکسِ
**HNSW** (`vector_cosine_ops`) اضافه و `saveEmbeddings` آن را پر می‌کند. `nearestByVector` جستجوی
نزدیک‌ترین همسایه را با عملگرِ `<=>` (فاصلهٔ کسینوسی) و ایندکس انجام می‌دهد؛ اگر افزونه نبود،
`null` برمی‌گرداند و `similarProperties` به cosineِ JS برمی‌گردد (backward-compatible). ۴ تستِ PG
روی PostgreSQL 16 + pgvectorِ واقعی.

**فعال‌سازی روی سرور (یک‌بار، به‌عنوان superuser):**
```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- سپس ری‌استارتِ اپ؛ خودش ستون + ایندکس را می‌سازد.
```
اگر این را نزنید، سیستم بی‌خطا روی مسیرِ jsonb + cosineِ JS کار می‌کند (فقط جستجوی برداری کندتر).

### REOS v2 — فاز ۶: Feature Store v2 (market_features + ویوهای نوع‌دار) — اجرا شد
- ویوهای نوع‌دارِ per-entity روی jsonb: `reos_property_features` / `reos_user_features` /
  `reos_agent_features` / `reos_market_features` (queryable با SQL؛ مسیرِ نوشتنِ jsonb حفظ شد).
- `market-features.ts`: تجمیعِ آماریِ بازار به‌تفکیکِ منطقه (میانهٔ قیمتِ هر متر، میانگین، تعداد،
  شاخصِ تقاضا) از آگهی‌ها؛ در `reos_feature_store(market)` ذخیره، هر ۶ ساعت بازمحاسبه. مسیر:
  `/api/reos/market`. ۷ تستِ PG.

**تنها بخشِ باقی‌مانده از اهدافِ ۱۰گانهٔ ممیزی:** CRM OS یکپارچه — که یک **تجمیع/refactorِ**
Sales-OSهای فعلی است (نه قابلیتِ نبوده): pipeline/فعالیت/تسک/قرار/امتیاز/اتوماسیون همین حالا
per-role در advisor/agency/prodesk کار می‌کنند. یکپارچه‌سازیِ آن‌ها در یک هستهٔ واحد ریسکِ
بی‌ثبات‌کردنِ پنل‌های کارآمد را دارد با ارزشِ افزودهٔ کم؛ عمداً به‌تعویق افتاده.

**تست‌های کل: ۴۳ واحد + ۶۱ روی PostgreSQLِ واقعی = ۱۰۴.**

**اصلِ راهنما:** هیچ لایه‌ای «فیک» نیست — هر فرمول و مدل کدِ واقعیِ قابلِ‌اجرا و قابلِ‌تست دارد؛ زیرساخت‌های سنگین با معادلِ واقعیِ همین استک پیاده و مسیرِ ارتقا مستند شده است.
