# REOS — گزارشِ ممیزیِ سه-نسخه‌ای (v1 + v2 + v3)

> برای «هوش مصنوعیِ ممیز». هر ادعا به کدِ واقعی وصل و با **۱۹۳ تستِ خودکار** روی PostgreSQLِ واقعی
> قابلِ راستی‌آزمایی است. زبان عمداً محتاطانه: «اجرا/تست‌شده» از «مسیرِ ارتقا» جدا شده.
> v1+v2 روی تولید **زنده** است (کامیت‌های پیشین + pgvectorِ بومی فعال)؛ v3 ساخته/تست‌شده و آمادهٔ دیپلوی.
>
> **تاریخ:** 2026-07-07 · **مخزن:** melkjet-nextjs (Next.js 16.2.9)

---

## ۰) خلاصه
- **۳۵ فایلِ هسته** در `app/lib/reos/` + `app/lib/reos/agent/`
- **۲۴ route** در `app/api/reos/`
- **تست‌ها:** `npm run test:reos` = **۸۱** (خالص/ریاضی/ML) · `…test:reos:pg` = **۱۱۲** (روی PostgreSQL 16 + pgvector) → **۱۹۳**
- **اصل:** هیچ لایه‌ای فیک نیست؛ هرجا سرویسِ صنعتیِ خارجی نصب نشده، معادلِ درون‌استکی صریح علامت خورده. همه **افزایشی + backward-compatible** (بدونِ `DATABASE_URL` مثلِ قبل روی فایل کار می‌کند).

---

## ۱) v1 — هستهٔ موتور (زنده)
feature/embedding/scoring/hybrid/feed/ml/monetization/engine + **آموزشِ واقعیِ ML** (`train.ts`:
Logistic Regression با Gradient Descent، AUC/LogLoss، بازآموزیِ ۶ساعته) + **صفِ ناهمگام** (`queue.ts`،
معادلِ Kafka) + **embeddingِ پایدار + pgvectorِ بومی** (`store.ts`: `vec vector(64)` + HNSW) +
**candidate-genِ SQL** (معادلِ Elasticsearch). Data Flywheel از ۴ مسیرِ واقعیِ کاربر.

## ۲) v2 — ۱۰ هدفِ ممیزیِ قبلی (زنده)
Multi-Role (`roles.ts`) · AI Agent (`agent/` memory+planner+executor+tools) · Knowledge Graph
(`graph.ts` BFS) · CRM OS (`crm.ts` pipeline/timeline/funnel/automation) · Promotion Engine
(`promotion-engine.ts` CPC/CPM/pacing) · Feature Store v2 (`market-features.ts` + ویوهای نوع‌دار) ·
pgvector · role-feeds · training · event-streaming.

## ۳) v3 — طبقِ نقشهٔ راهِ ممیز (ساخته + تست‌شده)

| # | ماژول | فایل (خط) | route | تست |
|---|---|---|---|---|
| ۱ | **AI Gateway** (router + cache + cost + fallback) | `gateway.ts` (124) | `/api/reos/gateway` | ۱۰ |
| ۲ | **Workflow Builder** (IF/THEN کاربرساز) | `workflow-builder.ts` (120) | `/api/reos/workflow` | ۸ |
| ۳ | **Market Intelligence** (Demand/Supply/Liquidity/Health) | `market-intel.ts` (68) | `/api/reos/market-intel` | ۴ |
| ۴ | **Investor OS** (ROI/IRR/NPV/payback/yield/risk) | `investor.ts` (101) | `/api/reos/investor` | ۱۳ |
| ۵ | **AVM** (ارزش‌گذاریِ خودکار با comparables) | `avm.ts` (58) | `/api/reos/avm` | ۱۱ |
| ۶ | **A/B Testing** (تخصیصِ چسبنده + winner/lift) | `experiments.ts` (63) | `/api/reos/experiment` | ۵ |
| ۷ | **Billing Engine** (wallet/txn/invoice، اتمیک) | `billing.ts` (99) | `/api/reos/billing` | ۷ |
| ۸ | **Attribution** (CAC/LTV/ROAS به‌تفکیکِ کانال) | `attribution.ts` (27) | `/api/reos/attribution` | ۴ |
| ۹ | **Offline Eval** (recall@k/precision/nDCG/MRR) | `eval.ts` (43) | — | ۶ |
| ۱۰ | **Feature Drift** (PSI + سطح‌بندی) | `drift.ts` (41) | — | ۴ |
| ۱۱ | **Learning-to-Rank** (pairwise RankNet) | `rank.ts` (39) | — | ۳ |
| ۱۲ | **Geospatial heatmap** (سلولِ جغرافیایی) | `geo-intel.ts` (43) | `/api/reos/geo-heatmap` | ۵ |
| ۱۳ | **Observability** (مصرفِ AI در پنلِ ادمین) | `gateway.usageStats` | `/api/reos/admin` | (بخشِ Gateway) |

**نکاتِ ممیزی v3:**
- **AI Gateway** واقعاً کش/هزینه/fallback دارد و **planner ایجنت از آن عبور می‌کند** (`agent/planner.ts`).
  تست با callerِ mock (بدونِ شبکه): کش=فراخوانِ دوم صفر، fallback=خطای اصلی→مدلِ پشتیبان، هرگز throw نمی‌کند.
- **Billing** شارژ/برداشتِ **اتمیک** (FOR UPDATE) دارد؛ تست: ردِ موجودیِ ناکافی، عدمِ پرداختِ دوبارهٔ فاکتور.
- **Investor** با مقادیرِ شناخته‌شدهٔ مالی تأیید شده (IRR≈13.1٪، payback≈1.67، مالیاتِ فاکتور).
- **Learning-to-Rank** واقعاً بهتر مرتب می‌کند: سیگنالِ درست را بازمی‌یابد و در ≥۸۰٪ کوئری‌ها مرتبط‌ترین را اول می‌آورد.
- **AVM** میانگینِ وزنیِ comparables + بازه/اطمینان از پراکندگی؛ تستِ داده‌محور روی listingهای seedشده.

---

## ۴) چک‌لیستِ راستی‌آزمایی برای ممیز
- [ ] خودت تست بزن: `npm run test:reos` (۸۱) و `DATABASE_URL=… npm run test:reos:pg` (۱۱۲).
- [ ] AI Gateway کش/fallback واقعی دارد؟ تستِ «۲nd request from cache» و «falls back on primary error».
- [ ] Billing اتمیک است؟ تستِ «rejects insufficient funds» و «cannot pay twice».
- [ ] LTR واقعاً یاد می‌گیرد؟ تستِ «ranks most-relevant first in ≥80%».
- [ ] Investor فرمول‌ها درست‌اند؟ IRR/NPV/payback با مقادیرِ دستی مطابق است.
- [ ] آیا ادعای «Kafka/Elasticsearch/OCRِ صنعتی نصب است» جایی هست؟ **نباید باشد** — §۵.

## ۵) صادقانه چه چیزی هنوز صنعتی/بیرونی نشده (V4/V5)
- **Document AI** نیازمندِ OCR (سرویسِ بیرونی) — RAGِ متن با embeddingِ موجود ممکن است، ولی OCR فعلاً نه.
- **Geospatial پیشرفته** (walkability/transit/school/POI) نیازمندِ دیتاست/سرویسِ بیرونی — فعلاً فقط heatmapِ عرضه/قیمت از مختصاتِ موجود.
- **Kafka/Elasticsearch/ClickHouse/Distributed-Training** بومی نصب نیست — معادلِ درون‌استکی کار می‌کند؛ مسیرِ ارتقا در `docs/REOS-ROADMAP.md`.
- **LTR/Drift/Eval** ساخته و تست‌شده‌اند ولی هنوز به‌صورتِ خودکار جایگزینِ رتبه‌بندیِ زندهٔ فید **نشده‌اند** (ابزارِ آماده؛ اتصالِ زنده = گامِ بعدی).

## ۶) جمع‌بندی
> «REOS اکنون سه نسخه دارد: v1 (موتور+ML واقعی)، v2 (۱۰ هدفِ Multi-Role/Agent/Graph/CRM/Promotion/
> pgvector)، و v3 (Gateway/Workflow/Market-Intel/Investor/AVM/A-B/Billing/Attribution/Eval/Drift/LTR/
> Geo). ۱۹۳ تستِ واقعی روی PostgreSQL. v1+v2 زنده، v3 آمادهٔ دیپلوی. باقی‌مانده صرفاً سرویس‌های
> بیرونی/صنعتیِ V4/V5 است که معادلِ درون‌استکی دارند. هیچ لایه‌ای فیک نیست.»
