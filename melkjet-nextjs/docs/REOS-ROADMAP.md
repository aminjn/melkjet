# REOS — نقشهٔ راهِ V3 / V4 / V5

> فلسفهٔ حاکم بر معماری (اصلِ طراحیِ همهٔ ماژول‌ها):
>
> **MelkJet یک «دیوارِ هوشمند» نیست؛ یک Real Estate Operating Systemِ AI-native است.**
> هر موجودیت باید هوش داشته باشد، هر تعامل باید داده تولید کند، و هر داده باید پلتفرم را بهتر کند.
> سیستم باید با رشدِ استفاده **نمایی** بهتر شود — طراحی برای network effects، data flywheel و
> مزیتِ مرکبِ (compounding) AI. هیچ فیچری نباید ایستا باشد؛ هر view/click/save/contact/contract/
> campaign باید Matching/Ranking/Pricing/Recommendation/Lead-Scoring/Market-Prediction را بهتر کند.

**اصل معماری (freeze شده پس از v2):** هستهٔ REOS refactor نمی‌شود؛ همه‌چیز **افزایشی + backward-compatible**.

---

## وضعیتِ فعلی
- **REOS v1** ✅ (موتور + آموزشِ ML + صف + embedding + candidate-gen) — زنده، تست‌شده
- **REOS v2** ✅ (۱۰/۱۰ هدفِ ممیز؛ Multi-Role, Agent, Graph, CRM, Promotion, Feature Store v2, pgvector, feeds, training, streaming) — زنده
- **REOS v3** 🚧 در حال ساخت — سه موردِ حیاتیِ اول انجام شد

---

## V3 — سه موردِ حیاتی (طبقِ اولویتِ ممیز)

| مورد | وضعیت | فایل |
|---|---|---|
| **۱. AI Gateway** (router + cache + cost tracker + fallback) | ✅ **اجرا + تست (۱۰)** | `reos/gateway.ts`، `/api/reos/gateway` |
| **۲. Workflow Builder** (IF/THEN کاربرساز، مثلِ HubSpot) | ✅ **اجرا + تست (۸)** | `reos/workflow-builder.ts`، `/api/reos/workflow` |
| **۳. Market Intelligence** (Demand/Supply/Liquidity/Competition/Trend/Health) | ✅ **اجرا + تست (۴)** | `reos/market-intel.ts`، `/api/reos/market-intel` |

### باقیِ V3 (اولویتِ بعدی — پیشنهادِ اجرا)
- **۴. Ranking ML** → ارتقا از Logistic به Learning-to-Rank (pairwise/LambdaMART در JS خالص)
- **۵. Billing Engine** → invoice/wallet/transactions/refund/subscription/tax (روی Promotion فعلی)
- **۶. Attribution Engine** → utm/lead-source/CAC/LTV/ROAS
- **۷. Investor Intelligence / Investor OS** → ROI/IRR/NPV/cashflow/yield/construction-risk (برای سازنده)
- **۸. AVM Pricing** → مدلِ ارزش‌گذاریِ خودکارِ واقعی (comparables + regression) به‌جای `estimate_price` ساده
- **۹. Observability (in-stack)** → metrics تأخیر/هزینه/شمارنده + پنلِ ادمین (معادلِ Langfuse سبک)
- **۱۰. Feature Drift Monitoring** → PSI/KS روی توزیعِ ویژگی‌ها در زمان
- **۱۱. A/B Testing / Experiment Platform** → تخصیصِ واریانت + CTR/CVR/Revenue per variant
- **۱۲. Document AI (سبک)** → RAG روی قراردادها با embeddingِ موجود (OCR بعداً)
- **۱۳. Geospatial Intelligence** → heatmap/walkability/transit/POI (روی مختصاتِ موجود)
- **Vector Recall Eval** → recall@10 / precision@10 / nDCG / MRR برای کیفیتِ فید

---

## V4 — لایه‌های تمایزِ عمیق (کپی‌کردن برای رقبا سخت)
- **Property Digital Twin** 🔥 — هر ملک یک موجودیتِ زنده: price/demand/interest history، buyer personas،
  risk profile، future price prediction، rental yield، liquidity score، AI confidence score.
- **Real Estate Knowledge Graph (بازار-محور)** — District→Neighborhood→Projects→Builders→Agents→Banks→
  Lawyers→Notaries→Buyers→Investors؛ پاسخ به «بهترین بانکِ منطقهٔ ۵؟»، «سریع‌ترین سازندهٔ سعادت‌آباد؟».
- **AI Memory Layer per role** — حافظهٔ ماندگارِ خریدار/مشاور/آژانس/سازنده/سرمایه‌گذار.
- **Unified Communication Hub** — SMS/Email/WhatsApp/Telegram/Push/Voice + call tracking.
- **Trust Layer** — Verified Agency/Builder/Lawyer/Expert/Property + Trust Score 0-100.
- **Seller Intelligence** — «این فروشنده ۷۰٪ احتمالِ فروش، قیمتِ بالا، ۶۳٪ احتمالِ کاهش».
- **Neighborhood Intelligence** — crime/school/transit/walkability/noise/population/income/demand.
- **AI Copilot Everywhere** — در هر صفحه (نه فقط چت): بهبودِ عنوان/قیمت/عکس + پیش‌بینیِ زمانِ فروش.
- **Marketing Attribution کامل** + **Growth Engine** (referral/ambassador/affiliate/credits).

---

## V5 — بلندمدت (Scale + Autonomy)
- **Autonomous AI Agents** — حلقهٔ Observe→Think→Plan→Execute→Measure→Improve (مشاورِ خودران).
- **Self-learning Feed (RL)** — Click→Save→Contact→Visit→Contract→Reward→Retrain (فید خودش بهتر شود).
- **Real Estate Foundation Model (MelkGPT)** — مدلِ اختصاصی روی داده‌های پلتفرم.
- **AI Model Marketplace** — کاربر مدلِ AVM/Investment/Lead/Demand/Rental/Builder را انتخاب کند.
- **Model Registry** — version/metrics/status/champion-challenger/deployed_at.
- **Data Warehouse** — Postgres→CDC→ClickHouse→Analytics→BI→ML.
- **DevOps Scale** — Kafka / Elasticsearch / Distributed Training (جایگزینِ صنعتیِ معادل‌های درون‌استکیِ فعلی).
- **AI Cost Router پیشرفته** — مسیریابیِ هوشمندِ مدل بر اساسِ پیچیدگیِ وظیفه (ساده→Flash، حقوقی→Claude).

---

## اصلِ Compounding (چک‌لیستِ طراحی برای هر ماژولِ جدید)
هر ماژولِ جدید باید حداقل یکی از این‌ها را تغذیه کند تا «داده مرکب» شود:
- [ ] رویدادش به Event Bus می‌رود؟ (`ingest`)
- [ ] feature store را به‌روز می‌کند؟
- [ ] گرافِ دانش را غنی می‌کند؟
- [ ] سیگنالِ آموزشِ مدل تولید می‌کند؟
- [ ] در رتبه‌بندی/توصیه/قیمت‌گذاری مصرف می‌شود؟

اگر هیچ‌کدام نبود، آن فیچر «ایستا» است و باید بازطراحی شود.
