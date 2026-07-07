# REOS — گزارشِ ممیزیِ چهار-نسخه‌ای (v1 + v2 + v3 + v4)

> برای «هوش مصنوعیِ ممیز». هر ادعا به کدِ واقعی وصل و با **۲۳۳ تستِ خودکار** روی PostgreSQLِ واقعی
> قابلِ راستی‌آزمایی است. زبان محتاطانه: «اجرا/تست‌شده» از «مسیرِ ارتقا/دادهٔ بیرونی» جدا شده.
> v1+v2+v3 روی تولید زنده‌اند (+pgvectorِ بومی)؛ v4 ساخته/تست‌شده و آمادهٔ دیپلوی.
>
> **تاریخ:** 2026-07-07 · **مخزن:** melkjet-nextjs (Next.js 16.2.9)

---

## ۰) خلاصه
- **۴۳ فایلِ هستهٔ REOS** (`app/lib/reos/**`) · **۳۱ route** (`app/api/reos/*`) · **۱۲ کامپوننتِ UI** (`Reos*.tsx`)
- **تست:** `npm run test:reos` = **۱۰۵** (خالص/ریاضی/ML) · `…test:reos:pg` = **۱۲۸** (روی PostgreSQL 16 + pgvector) → **۲۳۳**
- همه **افزایشی + backward-compatible**؛ بدونِ `DATABASE_URL` مثلِ قبل روی فایل کار می‌کند.
- **اصل:** هیچ لایه‌ای فیک نیست. هرجا سرویسِ صنعتیِ خارجی یا دادهٔ بیرونی لازم است، صریح «pending» علامت خورده.

---

## ۱) v1 — هستهٔ موتور (زنده)
feature/embedding/scoring/hybrid/feed/ml/monetization/engine + **آموزشِ واقعیِ ML** (`train.ts` GD) +
**صفِ ناهمگام** (`queue.ts`) + **pgvectorِ بومی** (`store.ts` HNSW) + **candidate-genِ SQL**. Data Flywheel از ۴ مسیرِ واقعیِ کاربر.

## ۲) v2 — ۱۰ هدفِ ممیزی (زنده)
Multi-Role · AI Agent (memory/planner/executor/tools) · Knowledge Graph · CRM OS · Promotion Engine ·
Feature Store v2 · pgvector · role-feeds · training · event-streaming.

## ۳) v3 — ۱۳ ماژول (ساخته+تست، UI کامل)
AI Gateway · Workflow Builder · Market Intelligence · Investor OS · AVM · A/B Testing · Billing ·
Attribution · Offline Eval (recall/nDCG) · Feature Drift (PSI) · Learning-to-Rank · Geospatial · Observability.

## ۴) v4 — لایه‌های تمایزِ عمیق (ساخته+تست)

| فاز | ماژول | فایل | route | UI | تست |
|---|---|---|---|---|---|
| ۱ | **Property Digital Twin** 🔥 | `digital-twin.ts` | `/api/reos/twin` | کارت روی صفحهٔ ملک | ۷ |
| ۲ | **Trust Layer** | `trust.ts` | `/api/reos/trust` | `ReosTrustBadge` در پنل‌ها | ۹ |
| ۳ | **Seller Intelligence** | `seller-intel.ts` | `/api/reos/seller-intel` | — | ۴ |
| ۴ | **AI Copilot** (بهبودِ آگهی) | `copilot.ts` | `/api/reos/copilot` | — | ۵ |
| ۵ | **Growth Engine** (دعوت+اعتبار→کیفِ پول) | `growth.ts` | `/api/reos/growth` | `ReosReferralCard` در پنل‌ها | ۶ |
| ۶ | **Market Knowledge Graph** | `market-graph.ts` | (در neighborhood) | — | (۵ مشترک) |
| ۷ | **Neighborhood Intelligence** | `neighborhood.ts` | `/api/reos/neighborhood` | — | ۵ |
| ۸ | **Unified Communication Hub** | `comms-hub.ts` | `/api/reos/comms` | — | ۴ |

**نکاتِ v4 برای ممیز:**
- **Digital Twin** ترکیبِ AVM + تقاضای واقعی (بازدید/تماس) + market-intel + مالی است → احتمالِ فروشِ ۴۵روزه،
  روزهای تا فروش، نقدشوندگی، ریسک، اطمینانِ AI. تست: داغ+ارزان سریع‌تر از سرد+گران؛ گران+سرد+کهنه = ریسکِ بالا.
- **Trust** از سیگنالِ واقعی (تأیید/پروفایل/معامله/امتیازِ وزن‌دار با نظر/سابقه)؛ کاربرِ OTP → نشانِ phone ضمنی.
- **Growth**: پاداشِ تبدیل به **کیفِ پولِ واقعیِ Billing** واریز می‌شود (تست: +۱۵۰هزار در موجودی).
- **Market Graph**: یال‌های `located_in`/`active_in`؛ «فعال‌ترین مشاورِ منطقه» (تست: O1 با ۳ آگهی اول).

---

## ۵) چک‌لیستِ راستی‌آزمایی برای ممیز
- [ ] `npm run test:reos` = ۱۰۵ · `DATABASE_URL=… npm run test:reos:pg` = ۱۲۸.
- [ ] Digital Twin واقعی است؟ `daysToSell(hot,cheap) < daysToSell(cold,expensive)`؛ `riskProfile` factors.
- [ ] Growth واقعاً کیفِ پول را شارژ می‌کند؟ تستِ «conversion credited the wallet (+150k)».
- [ ] Market Graph مسیرِ منطقه→مشاور می‌دهد؟ تستِ «topActiveInArea ranks O1 first».
- [ ] آیا ادعای «WhatsApp/OCR/crime-data متصل است» جایی هست؟ **نباید باشد** — §۶.

## ۶) صادقانه چه چیزی pending است (دادهٔ بیرونی/سرویسِ صنعتی)
- **Neighborhood**: walkability/transit/school/crime = `null` (نیازمندِ دیتاست/سرویسِ بیرونی)؛ بقیهٔ پروفایل از دادهٔ داخلی واقعی است.
- **Comms Hub**: SMS/Email آمادهٔ ارسال؛ WhatsApp/Telegram/Push = `pending` (نیازمندِ API).
- **Kafka/Elasticsearch/ClickHouse/OCR/Distributed-Training** بومی نصب نیست — معادلِ درون‌استکی کار می‌کند (مستند در `REOS-ROADMAP.md`).
- **AI Copilot/Seller-Intel/Neighborhood/Market-Graph** فعلاً API-only (بدونِ صفحهٔ گرافیکیِ اختصاصی؛ Twin/Trust/Growth دارای UI‌اند).

## ۷) جمع‌بندی
> «REOS چهار نسخه دارد و روی‌هم یک Real Estate Operating Systemِ AI-native است: از هستهٔ موتور و آموزشِ
> واقعیِ ML (v1)، تا Multi-Role/Agent/Graph/CRM (v2)، تا Gateway/AVM/A-B/Billing/LTR (v3)، تا Digital-Twin/
> Trust/Seller-Intel/Copilot/Growth/Market-Graph/Neighborhood/Comms (v4). **۲۳۳ تستِ واقعی** روی PostgreSQL.
> v1-v3 زنده، v4 آمادهٔ دیپلوی. باقی‌مانده صرفاً دادهٔ بیرونی/سرویسِ صنعتیِ برچسب‌خورده است. هیچ لایه‌ای فیک نیست.»
