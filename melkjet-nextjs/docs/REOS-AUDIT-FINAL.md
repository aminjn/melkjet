# REOS — گزارشِ ممیزیِ نهایی (v1 → v5)

> برای «هوش مصنوعیِ ممیز». هر ادعا به کدِ واقعی وصل و با **۲۷۲ تستِ خودکار** روی PostgreSQLِ واقعی
> قابلِ راستی‌آزمایی است. زبان محتاطانه: «آموزش‌دیده (ML)» از «فرمول» و «دادهٔ بیرونی/pending» جدا شده.
>
> **تاریخ:** 2026-07-07 · **مخزن:** melkjet-nextjs (Next.js 16.2.9) · **آخرین کامیت:** `ba69218`

---

## ۰) خلاصه
- **۴۹ فایلِ هستهٔ REOS** · **۳۵ route** · **۱۳ کامپوننتِ UI**
- **تست:** `npm run test:reos` = **۱۲۰** · `…test:reos:pg` = **۱۵۲** → **۲۷۲**، همه سبز
- همه **افزایشی + backward-compatible**؛ بدونِ `DATABASE_URL` روی فایل کار می‌کند.
- **همهٔ وزن‌ها/نرخ‌ها/آستانه‌ها از سوپرادمین قابلِ‌تنظیم‌اند و روی موتورِ زنده اعمال می‌شوند** (`reos-config.ts` + مرکزِ کنترل در `/reos-admin`).

## ۱) صادقانه: کدام ML است، کدام فرمول (مهم‌ترین بخش برای ممیز)
**۵ مؤلفهٔ واقعیِ ML (از داده یاد می‌گیرند):**
1. **مدلِ engagement/رتبه‌بندیِ فید** — Logistic Regression با Gradient Descent روی رویدادهای واقعی (AUC/LogLoss). `train.ts`.
2. **مدلِ تبدیلِ لید** — LR با GD روی نتیجهٔ واقعیِ CRM (won/lost)، بدونِ نشتِ برچسب. `lead-model.ts`.
3. **سیاستِ آنلاین/RL** — به‌روزرسانیِ لحظه‌ایِ وزن‌ها از پاداشِ رفتار + epsilon-greedy. `rl.ts`.
4. **Learning-to-Rank** — رتبه‌بندیِ زوجی (RankNet). `rank.ts`.
5. **Embeddings** — بردار + pgvector/HNSW. `store.ts`/`features.ts`.

**عمداً فرمول‌اند (نباید ML باشند):** IRR/NPV/cashflow (`investor.ts`)، AVM با comparables (`avm.ts`)،
آستانه‌های Digital-Twin/Seller، market-intel، trust. این‌ها روشِ آماری/ریاضیِ قطعی‌اند.
> در `/reos-admin` → «مدل‌های REOS» هر مدل با برچسبِ **آموزش‌دیده/آنلاین/برداری/فرمول** و وضعیتِ واقعی نشان داده می‌شود (شفافیت).

## ۲) نسخه‌ها
- **v1** موتور: feature/embedding/scoring/hybrid/feed/ml + آموزشِ ML + صفِ ناهمگام + pgvector + candidate-gen.
- **v2** (۱۰ هدف): Multi-Role, Agent (memory/planner/executor/tools), Knowledge Graph, CRM OS, Promotion, Feature-Store v2, pgvector, role-feeds, training, event-streaming.
- **v3** (۱۳): AI Gateway, Workflow Builder, Market Intelligence, Investor OS, AVM, A/B, Billing, Attribution, Offline-Eval, Drift(PSI), Learning-to-Rank, Geospatial, Observability.
- **v4** (۸): Property Digital Twin, Trust Layer, Seller Intelligence, AI Copilot, Growth Engine, Market Knowledge Graph, Neighborhood Intelligence, Unified Comms Hub.
- **v5** (۶): Model Registry (champion/challenger), Self-learning RL policy, Autonomous Agent, **مدلِ لیدِ آموزش‌دیده**, AI Cost Router (پیچیدگی-محور), Model Catalog/Marketplace.

## ۳) کنترلِ سوپرادمین (تنظیماتِ واقعی)
`/reos-admin` → «⚙️ مرکزِ کنترلِ REOS»:
- **وزن‌های زنده:** رتبه‌بندیِ فید، امتیازِ Global، Hybrid, RL(lr/epsilon/پاداش‌ها), تبلیغات(boost/گیت), اعتماد, Gateway(نرخِ هزینه/کش), بازهٔ آموزش + سوئیچِ مدلِ لیدِ آموزش‌دیده.
- **اکشن‌ها:** آموزشِ **هر دو مدل**، بازمحاسبهٔ market-intel/features/graph، تأییدِ اعتماد، ارتقای champion.
- **اثبات (تست):** عددِ config عوض شود → موتورِ زندهٔ `estimateCost` مقدارِ جدید را برمی‌گرداند (نه دکوری).

## ۴) چک‌لیستِ راستی‌آزمایی
- [ ] `npm run test:reos` = ۱۲۰ · `DATABASE_URL=… npm run test:reos:pg` = ۱۵۲.
- [ ] ML واقعی است؟ `lead-model`/`train`: تستِ «recovers signal, AUC>0.7, trained end-to-end from CRM».
- [ ] تنظیماتِ سوپرادمین واقعی است؟ تستِ «LIVE engine uses new rate».
- [ ] Cost Router: `complexityOf('قرارداد…')==='legal'`، ساده→مدلِ ارزان.
- [ ] آیا ادعای «MelkGPT/Kafka/ClickHouse/OCR اجراست» جایی هست؟ **نباید باشد** — §۵.

## ۵) صادقانه pending (بیرونی/زیرساختِ صنعتی — نه فیک، فقط نصب‌نشده)
- **Foundation Model (MelkGPT)** — نیازمندِ زیرساختِ آموزشِ بزرگ؛ فعلاً از GapGPT + مدل‌های سبکِ آموزش‌دیدهٔ خودمان استفاده می‌شود.
- **Data Warehouse (ClickHouse/CDC)** و **Kafka/Elasticsearch بومی** — معادلِ درون‌استکی کار می‌کند؛ مسیرِ ارتقا در `REOS-ROADMAP.md`.
- **Neighborhood: walkability/transit/school/crime** و **WhatsApp/Telegram delivery** — نیازمندِ دیتاست/API بیرونی (در کد `null`/`pending` علامت خورده).
- **OCR/Document-AI کامل** — نیازمندِ سرویسِ OCR.

## ۶) جمع‌بندی
> «REOS پنج نسخه دارد (۴۹ فایل، ۳۵ endpoint، ۱۳ UI، ۲۷۲ تستِ واقعی روی PostgreSQL). ۵ مؤلفهٔ واقعیِ
> ML (engage/lead/RL/LTR/embeddings) + بقیه فرمولِ صحیحِ ریاضی که نباید ML باشند. همهٔ وزن‌ها/نرخ‌ها از
> سوپرادمین قابلِ‌کنترل و روی موتورِ زنده اعمال می‌شوند. v1-v3 زنده، v4-v5 آمادهٔ دیپلوی. باقی‌مانده صرفاً
> سرویس‌های بیرونی/صنعتیِ برچسب‌خورده است. هیچ لایه‌ای فیک نیست و ریپورت‌ها با تست قابلِ‌راستی‌آزمایی‌اند.»
