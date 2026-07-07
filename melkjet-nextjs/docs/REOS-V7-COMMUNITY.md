# REOS v7 · Community Layer — گزارشِ ممیزی

> آخرین موردِ فهرستِ ممیز: لایهٔ اجتماعی. دنبال‌کردن، مجموعه‌ها، نظرها، اثباتِ اجتماعی، رتبه‌بندیِ عمومی.
> اعتبارِ عمومیِ حرفه‌ای = ترکیبِ **دنبال‌کننده + اقتدارِ بازار + اعتماد + سطح** (نه صرفاً محبوبیتِ توخالی).
>
> **تاریخ:** 2026-07-07 · قابلِ راستی‌آزمایی با **۳۹۶ تست** (۱۸۱ واحد + ۲۱۵ روی PostgreSQLِ واقعی).

---

## ۰) اجزا (همه واقعی + تست‌شده)
| بخش | فایل | تست |
|---|---|---|
| دنبال‌کردن (follow/followers/following) | `community.ts` | ✓ PG |
| مجموعه‌ها (Collections + آیتم‌ها، عمومی/خصوصی) | `community.ts` | ✓ PG |
| نظرها (Comments + پاسخِ درختی + مخفی‌سازی) | `community.ts` | ✓ واحد + PG |
| اثباتِ اجتماعی (Social Proof) + امتیاز | `community.ts` | ✓ واحد + PG |
| رتبه‌بندیِ عمومیِ آژانس‌ها (Public Rankings) | `community.ts` | ✓ PG |
| API | `/api/reos/community` | build ✓ |
| رابطِ کاربری | `ReosSocialCard.tsx` (pros+agency) | build ✓ |
| کنترلِ سوپرادمین | `ReosControlCenter.tsx` (وزن‌ها) | build ✓ |

## ۱) دنبال‌کردن
`follow/unfollow/isFollowing/followerCount/followingCount/followingList` — dedup (کلیدِ مرکب)، خوددنبالی مسدود،
ایندکس روی هدف. هدف می‌تواند آژانس یا ملک باشد (`targetType`).

## ۲) مجموعه‌ها (Collections)
کاربر فایل‌های مهم را دسته‌بندی می‌کند (عمومی/خصوصی). `createCollection/addToCollection/removeFromCollection/
listCollections (با شمارش)/collectionItems`. آیتم‌ها dedup می‌شوند.

## ۳) نظرها (Comments)
`addComment` با **پاک‌سازی/اعتبارسنجی** (طولِ مجاز از config)، پاسخِ تودرتو (`parentId`). `listComments` درختِ
مرتب‌شده می‌سازد (`threadComments`، تست‌پذیر) و نظرهایِ مخفی را حذف می‌کند. `hideComment` فقط نویسنده یا سوپرادمین.

## ۴) اثباتِ اجتماعی + رتبه‌بندیِ عمومی
- `communityScore` (۰..۱۰۰): `followers(لگاریتمی) + dominance + trust + level` با وزن‌های config-driven.
  دنبال‌کننده لگاریتمی است تا محبوبیتِ خام بر اعتبارِ واقعی نچربد.
- `socialProof(agentId)` همهٔ سیگنال‌های عمومی را یک‌جا می‌آورد (کارتِ اعتبارِ عمومی) — با اتصال به **Territory
  (اقتدار)** و **Trust** و **XP (سطح)**.
- `publicRankings` برترین آژانس‌ها را بر اساسِ اثباتِ اجتماعی رتبه می‌کند (دانه = مالکانِ قلمرو).

## ۵) اتصال به لایه‌های دیگر
اثباتِ اجتماعی **مصرف‌کنندهٔ** خروجیِ Territory/Trust/XP است (نه داده‌ی تکراری). یعنی هرچه مشاور در بازار
واقعی قوی‌تر باشد، اعتبارِ اجتماعی‌اش هم بالاتر می‌رود — شبکهٔ اثرِ واقعی، نه بازیِ فالوور.

## ۶) راستی‌آزمایی
```
node --import ./scripts/reos-loader.mjs scripts/reos-test.mjs                 # ۱۸۱ سبز (+۱۱ community)
DATABASE_URL=… node --import ./scripts/reos-loader.mjs scripts/reos-store-test.mjs   # ۲۱۵ سبز (+۱۹ community روی PGِ واقعی)
```
- **کنترلِ سوپرادمین:** `/reos-admin` → «اعتبارِ اجتماعی»: وزنِ دنبال‌کننده/اقتدار/اعتماد/سطح + حداکثر طولِ نظر.
- **صادقانه:** امتیازِ اجتماعی فرمولِ وزنیِ شفاف است؛ ضدِدستکاری چون وزنِ اصلی روی اقتدار/اعتمادِ واقعیِ بازار است،
  نه فقط تعدادِ فالوور. **باقی‌ماندهٔ فهرستِ ممیز اکنون کامل است.**
