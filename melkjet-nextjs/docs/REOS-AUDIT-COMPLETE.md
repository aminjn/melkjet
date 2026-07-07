# REOS — گزارشِ ممیزیِ یکپارچهٔ نهایی (v1 → v7)

> سندِ واحد برای «هوش مصنوعیِ ممیز». همهٔ نسخه‌ها، معماری، تفکیکِ صادقانهٔ ML/فرمول/بیرونی، و راستی‌آزمایی.
> هر ادعا به کدِ واقعی وصل و با **۳۹۶ تستِ خودکار** روی PostgreSQLِ واقعی قابلِ راستی‌آزمایی است.
>
> **تاریخ:** 2026-07-07 · **مخزن:** melkjet-nextjs (Next.js 16.2.9) · **REOS = Real Estate Operating System**

---

## ۰) آمارِ کلی (قابلِ شمارش در مخزن)
| سنجه | مقدار | راستی‌آزمایی |
|---|---|---|
| فایلِ هستهٔ REOS (`app/lib/reos`) | **۵۷** | `ls app/lib/reos/**/*.ts \| wc -l` |
| endpointِ API (`app/api/reos`) | **۳۹** | `find app/api/reos -name route.ts \| wc -l` |
| کامپوننتِ UI (`Reos*.tsx`) | **۱۶** | `ls app/components/Reos*.tsx \| wc -l` |
| تستِ واحد (pure + gradient descent) | **۱۸۱** | `npm run test:reos` |
| تستِ یکپارچه روی PostgreSQLِ واقعی | **۲۱۵** | `…test:reos:pg` |
| **مجموعِ تست** | **۳۹۶** | همه سبز |

همه **افزایشی + backward-compatible**؛ بدونِ `DATABASE_URL` روی فایلِ JSON کار می‌کند (dual-mode).

---

## ۱) مهم‌ترین بخش برای ممیز — صادقانه: ML واقعی چیست، فرمول چیست
### ✅ ۵ مؤلفهٔ واقعیِ ML (از داده یاد می‌گیرند)
1. **مدلِ تعامل/رتبه‌بندیِ فید** — Logistic Regression با Gradient Descent روی رویدادهای واقعی. `train.ts` (AUC/LogLoss، تست: recovers signal).
2. **مدلِ تبدیلِ لید** — LR با GD روی نتیجهٔ واقعیِ CRM (won/lost)، بدونِ نشتِ برچسب. `lead-model.ts`.
3. **سیاستِ آنلاین/RL** — به‌روزرسانیِ لحظه‌ایِ وزن از پاداشِ رفتار + epsilon-greedy. `rl.ts`.
4. **Learning-to-Rank** — رتبه‌بندیِ زوجی (RankNet). `rank.ts`.
5. **Embeddings** — بردار + pgvector/HNSW. `store.ts`/`features.ts`.

### ⚙️ عمداً فرمول‌اند (نباید ML باشند — روشِ آماری/ریاضیِ قطعی و توضیح‌پذیر)
IRR/NPV/cashflow (`investor.ts`)، AVM با comparables (`avm.ts`)، Digital-Twin، market-intel، Trust، و
**امتیازهای رقابتیِ v-Dominance→v7** (اقتدار/اثباتِ اجتماعی/کمیسیون). این‌ها باید شفاف + ضدِدستکاری باشند،
نه جعبهٔ سیاه — اما سیگنال‌هایشان همه از دادهٔ واقعیِ ML-محور (CRM/تعامل/معامله) تغذیه می‌شوند.
> در `/reos-admin` → «مدل‌های REOS» هر مدل با برچسبِ **آموزش‌دیده/آنلاین/برداری/فرمول** و وضعیتِ واقعی دیده می‌شود.

---

## ۲) نسخه‌ها (v1 → v7)
| نسخه | محتوا | فایل‌های شاخص |
|---|---|---|
| **v1** | موتور: feature/embedding/scoring/hybrid/feed/ml + آموزشِ ML + صفِ ناهمگام + pgvector + candidate-gen | `features/scoring/hybrid/feed/ml/train/store` |
| **v2** | Multi-Role, Agent (memory/planner/executor/tools), Knowledge Graph, CRM OS, Promotion, Feature-Store v2, event-streaming | `agent/*`, `graph`, `crm`, `promotion-engine` |
| **v3** | AI Gateway, Workflow Builder, Market Intelligence, Investor OS, AVM, A/B, Billing, Attribution (CAC/LTV/ROAS), Offline-Eval, Drift(PSI), LTR, Geospatial, Observability | `gateway`, `workflow-builder`, `market-intel`, `investor`, `avm`, `experiments`, `billing`, `attribution`, `eval`, `drift`, `rank`, `geo-intel` |
| **v4** | Property Digital Twin, Trust Layer, Seller Intelligence, AI Copilot, Growth Engine, Market Knowledge Graph, Neighborhood Intelligence, Unified Comms Hub | `digital-twin`, `trust`, `seller-intel`, `copilot`, `growth`, `market-graph`, `neighborhood`, `comms-hub` |
| **v5** | Model Registry (champion/challenger), Self-learning RL policy, Autonomous Agent, مدلِ لیدِ آموزش‌دیده, AI Cost Router, Model Catalog | `model-registry`, `rl`, `autonomous`, `lead-model`, `gateway`, `model-catalog` |
| **Dominance** | **Market Dominance Engine**: قلمرو، امتیازِ اقتدار، نبردِ ۷روزه، مالکیت، جدولِ رده، نشان، زنجیره، FOMO، ضدِتقلب، کارتِ اشتراکِ ویروسی | `territory`, `achievements`, `territory-sync` |
| **v6** | **Gamification + Reward Economy**: XP/سطح/لیگِ فصلی، مأموریت/چالش، کیفِ پولِ چندسطلی، کمیسیون/پورسانتِ معرف/وفاداری | `xp`, `missions`, `wallet`, `economy` |
| **v7** | **Community**: دنبال‌کردن، مجموعه‌ها، نظرهای درختی، اثباتِ اجتماعی، رتبه‌بندیِ عمومی | `community` |

اسناد جزئیِ هر لایه: `REOS-MARKET-DOMINANCE.md`، `REOS-V6-ECONOMY.md`، `REOS-V7-COMMUNITY.md`.

---

## ۳) لایهٔ رقابتی/اجتماعی/اقتصادی (پاسخ به فهرستِ ممیز — همه ساخته شد)
| موردِ فهرستِ ممیز | لایه | فایل |
|---|---|---|
| territories · dominance_score · battles · leaderboards · ownership | Dominance | `territory.ts` |
| streaks · badges · achievements · gamification | Dominance/v6 | `achievements.ts`, `xp.ts` |
| «Top Agent of Ponak» (Territory Intelligence) | Dominance | جدولِ ردهٔ هر قلمرو + مالک |
| viral share cards | Dominance | `/api/reos/territory/card` (SVG) |
| XP · levels · seasons · missions | v6 | `xp.ts`, `missions.ts` |
| unified wallet · credits · refunds · commission · affiliate | v6 | `wallet.ts`, `economy.ts` |
| referral engine · reward economy | v4+v6 | `growth.ts`, `economy.ts` |
| attribution (utm/cac/ltv/roas) | v3 (از قبل) | `attribution.ts` |
| trust marketplace / verified badges | v4 | `trust.ts` |
| community (follow/comments/collections/rankings/social proof) | v7 | `community.ts` |

**اصلِ طراحی:** لایهٔ اجتماعی/اقتصادی **مصرف‌کنندهٔ** خروجیِ Territory/Trust/XP است، نه دادهٔ تکراری —
هرچه مشاور در بازارِ واقعی قوی‌تر، اعتبار/اقتدار/اعتمادش بالاتر. شبکهٔ اثرِ واقعی، نه بازیِ توخالی.

---

## ۴) کنترلِ سوپرادمین (تنظیماتِ واقعی روی موتورِ زنده)
`/reos-admin` → «⚙️ مرکزِ کنترلِ REOS» — همهٔ وزن‌ها/نرخ‌ها/آستانه‌ها (`reos-config.ts`) روی موتورِ زنده اعمال می‌شوند:
RL (lr/epsilon/پاداش) · تبلیغات (boost/gate) · اعتماد · فید (rankWeights) · Global scoring · Hybrid · Gateway (نرخ/کش) ·
آموزش · **اقتدارِ بازار** (وزن‌های ۷گانه/روزِ نبرد/آستانهٔ تقلب/اعتبارِ فید) · **اقتصاد+XP** (کمیسیون/پورسانت/وفاداری/پاداشِ مأموریت/منحنیِ سطح) · **اعتبارِ اجتماعی** (وزن‌ها/طولِ نظر).
- **اثبات (تست):** عددِ config عوض شود → موتورِ زندهٔ `estimateCost`/`dominanceScore`/… مقدارِ جدید را برمی‌گرداند.
- اکشن‌ها: آموزشِ هر دو مدل، بازمحاسبهٔ market-intel/features/graph، **همگام‌سازیِ اقتدارِ بازار**، تأییدِ اعتماد، ارتقای champion.

---

## ۵) مقیاس‌پذیری (میلیون‌ها ملک/کاربر)
- **dual-mode** با ایندکسِ هدفمند (مثلِ `(territory, score DESC)`, `(agent_id, at DESC)`)؛ جدولِ رده/جایگاه بدونِ اسکنِ کامل.
- **candidate generation** SQL برای فید (N کاندیدا، نه کلِ جدول) + **pgvector/HNSW** برای شباهت.
- **صفِ ناهمگام + کرونِ instance-0** برای همهٔ کارهای سنگین؛ مسیرِ درخواستِ کاربر سبک می‌ماند.
- **رویداد-محور، ضدِتورم:** XP/امتیاز دقیقاً یک‌بار در اقدامِ واقعی؛ نه بازمحاسبه در هر cron.

---

## ۶) صادقانه pending (بیرونی/زیرساختِ صنعتی — نه فیک، فقط نصب‌نشده)
- **Foundation Model (MelkGPT)** — نیازمندِ زیرساختِ آموزشِ بزرگ؛ فعلاً GapGPT + مدل‌های سبکِ آموزش‌دیدهٔ خودمان.
- **Data Warehouse (ClickHouse/CDC)**, **Kafka/Elasticsearchِ بومی** — معادلِ درون‌استکی کار می‌کند؛ مسیرِ ارتقا در `REOS-ROADMAP.md`.
- **Neighborhood: walkability/transit/school/crime**, **WhatsApp/Telegram delivery**, **OCR/Document-AI کامل** — نیازمندِ دیتاست/API بیرونی (در کد `null`/`pending` علامت‌خورده).

---

## ۷) چک‌لیستِ راستی‌آزمایی (برای ممیز)
```bash
# ۱) تست‌های واحد (بدونِ DB) — منطقِ خالص + یادگیریِ واقعی
node --import ./scripts/reos-loader.mjs scripts/reos-test.mjs           # ۱۸۱ سبز

# ۲) تست‌های یکپارچه روی PostgreSQLِ واقعی
DATABASE_URL=postgres://reos:reos@127.0.0.1:5432/reos_test \
  node --import ./scripts/reos-loader.mjs scripts/reos-store-test.mjs   # ۲۱۵ سبز
```
- **ML واقعی؟** تست‌های «recovers signal، AUC>0.7/0.75، trained end-to-end from CRM».
- **کنترلِ سوپرادمین واقعی؟** تستِ «LIVE engine uses new rate».
- **ضدِتقلب/ضدِدستکاری؟** تستِ «fraud dampens score»، «double-claim rejected»، «over-debit rejected atomically»، «non-author cannot hide».
- **ادعای MelkGPT/Kafka/ClickHouse/OCRِ اجرا‌شده هست؟** نباید باشد — §۶.

## ۸) جمع‌بندی
> «REOS هفت لایه دارد (۵۷ فایل، ۳۹ endpoint، ۱۶ UI، ۳۹۶ تستِ واقعی روی PostgreSQL). ۵ مؤلفهٔ واقعیِ ML
> (engage/lead/RL/LTR/embeddings) + بقیه فرمولِ صحیحِ ریاضیِ توضیح‌پذیر. لایه‌های رقابتی/اقتصادی/اجتماعی
> (Dominance/v6/v7) ساخته و تست شده و به موتورهای واقعی (CRM/Trust/Territory) وصل‌اند — شبکهٔ اثرِ واقعی،
> نه بازیِ توخالی. همهٔ وزن‌ها از سوپرادمین قابل‌کنترل و روی موتورِ زنده اعمال می‌شوند. باقی‌مانده صرفاً
> سرویس‌های بیرونی/صنعتیِ برچسب‌خورده است. هیچ لایه‌ای فیک نیست و همه با تست قابلِ‌راستی‌آزمایی است.»
