# زیرساختِ دیتابیسِ ملک‌جت — «کاری که دیگر نشکند»

## مشکلی که بارها تکرار شد
روی باکسِ **۴ vCPU / ۸ GB** (مشترک بینِ ۴ اینستنسِ اپ + خودِ PostgreSQL)، زیرِ بارِ نوشتنِ
سنگین (سینکِ روستر + ممیزی + انتشار + enrich) دو خطای کشنده می‌آمد:
- `timeout exceeded when trying to connect` → **استخرِ اتصالِ اپ** پر می‌شد و کوئریِ بعدی شکست می‌خورد.
- `canceling statement due to statement timeout` + گاهی `checkpoint PANIC` → PG زیرِ فشار کُند/ناپایدار.

نتیجه: ممیزی/تلگرام/سایت می‌خوابید تا ری‌استارتِ دستی.

## راه‌حلِ لایه‌ای (هر لایه یک ریشه را می‌بندد)

| لایه | چه چیزی را درست می‌کند | کجا | ریسک |
|---|---|---|---|
| ۱) **pgbouncer** (transaction pooling) | «اتصال گرفتن شکست می‌خورد» — صدها اتصالِ اپ روی ~۳۰ اتصالِ واقعیِ PG مالتی‌پلکس | `setup-pgbouncer.sh` | کم (تست پیش از سوییچ + برگشتِ یک‌خطی) |
| ۲) **تیونِ PostgreSQL** | checkpoint PANIC و اسپایکِ IO؛ autovacuum/حافظه/WAL | `pg-tune.sh` | کم (reloadی؛ فقط shared_buffers restart) |
| ۳) **نوشتنِ بدونِ‌قفلِ ممیزی** (کد) | روستر دیگر ممیزی را پشتِ قفلِ `scraper_meta` خفه نمی‌کند | کد + تستِ PG | متوسط → با تست |
| ۴) **پله‌ایِ «همگام‌سازیِ همه»** (کد) | تریگرِ دقیقِ امروز (۱۳۲ آژانس یک‌جا) | کد | کم |
| ۵) **کشِ ایندکسِ تکرار** (کد، انجام‌شده — فاز ۳۱۰) | سنگین‌ترین کارِ مسیرِ ممیزی هر تیک | `listing-dedupe.ts` | کم |

**نکتهٔ صادقانه:** پایدارترین حالت این است که PostgreSQL روی **سرور/منابعِ جدا** برود (این باکس
برای اپ+DB با هم کوچک است). لایه‌های بالا باکسِ فعلی را تا حدِ زیادی مقاوم می‌کنند، ولی سقفِ
سخت‌افزار همین است؛ با رشدِ داده، جداکردنِ DB گامِ بعدیِ طبیعی است.

## اجرا (به‌ترتیب، روی سرور)

```bash
cd /var/www/melkjet/melkjet-nextjs

# ── لایهٔ ۲: تیونِ PG (اول، چون reloadی و بی‌خطر؛ یک‌بار restart برای shared_buffers وقتِ خلوت) ──
sudo bash scripts/ops/pg-tune.sh
#   وقتِ خلوت (برای فعال‌شدنِ shared_buffers):  sudo systemctl restart postgresql

# ── لایهٔ ۱: pgbouncer (نصب + تست؛ سایت را عوض نمی‌کند) ──
sudo bash scripts/ops/setup-pgbouncer.sh
#   اگر اسموک‌تست سبز شد، دستورِ سوییچِ DATABASE_URL را خودِ اسکریپت چاپ می‌کند:
#     cp .env.production.local .env.production.local.bak-XXXX
#     sed -i -E 's#(DATABASE_URL=.*@127.0.0.1:)5432(/)#\16432\2#' .env.production.local
#     sudo pm2 reload ecosystem.config.js --update-env
#   🔙 برگشتِ فوری: همان sed با 6432→5432 + reload.
```

## تأیید بعد از سوییچ
- `sudo pm2 logs melkjet-3000 --lines 40 --nostream | grep -iE "timeout|connect"` → دیگر «timeout … connect» نباید بیاید.
- `psql "$DATABASE_URL" -c "SELECT 1"` از طریقِ 6432 جواب بدهد.
- بارِ نوشتن (ممیزی + روستر هم‌زمان) دیگر نباید استخر را خفه کند.
- وضعیتِ pgbouncer: `psql "postgres://<user>:<pass>@127.0.0.1:6432/pgbouncer" -c "SHOW POOLS;"`

## برگشتِ کامل (اگر لازم شد)
- DATABASE_URL را به 5432 برگردان + `pm2 reload … --update-env` (سایت دوباره مستقیم روی PG).
- تیونِ PG را حذف: فایلِ `conf.d/melkjet-tuning.conf` را پاک کن + `systemctl reload postgresql`.
- بکاپ‌ها با پسوندِ `.bak-<timestamp>` کنارِ هر فایل‌اند.
