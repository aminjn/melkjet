# دیپلوی از گیت‌هاب (یک‌کلیک)

بعد از این، به‌جای SSH دستی، از خودِ گیت‌هاب دیپلوی می‌کنی:

**GitHub → تبِ Actions → «Deploy to server» → دکمهٔ «Run workflow» → Run.**

سپس (مثلِ همیشه) **کشِ آروان را پاک کن** (پنلِ آروان → CDN → clear cache).

---

## یک‌بار تنظیم: افزودنِ Secretها (فقط اولین بار)

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret** و این‌ها را اضافه کن:

| Secret | مقدار |
|---|---|
| `DEPLOY_HOST` | `185.206.95.40` |
| `DEPLOY_USER` | کاربرِ SSH سرور (مثلاً `root`) |
| `DEPLOY_PORT` | پورتِ SSH (اگر ۲۲ است، لازم نیست بگذاری) |
| `DEPLOY_SSH_KEY` | **کلیدِ خصوصیِ SSH** (کلِ متنِ فایل، از `-----BEGIN` تا `-----END`) |

### ساختِ کلیدِ SSH برای دیپلوی (روی سرور)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/gh_deploy -N ""      # کلید بساز (بدونِ پسورد)
cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys    # کلیدِ عمومی را مجاز کن
cat ~/.ssh/gh_deploy                                  # این «کلیدِ خصوصی» را در DEPLOY_SSH_KEY بگذار
```

### passwordless sudo برای اسکریپتِ دیپلوی
چون workflow `sudo scripts/deploy.sh` را اجرا می‌کند، کاربرِ دیپلوی باید بدونِ پسورد بتواند آن را sudo کند.
اگر با `root` وصل می‌شوی نیازی نیست. وگرنه (مثلاً کاربرِ `deploy`):
```bash
echo 'deploy ALL=(ALL) NOPASSWD: /var/www/melkjet/melkjet-nextjs/scripts/deploy.sh' | sudo tee /etc/sudoers.d/melkjet-deploy
sudo chmod 440 /etc/sudoers.d/melkjet-deploy
```

## نکته‌ها
- workflow **اتوماتیک روی هر push نیست** — فقط وقتی خودت «Run workflow» بزنی اجرا می‌شود.
- اگر runnerِ گیت‌هاب نتوانست به سرور وصل شود (فایروال/پورت)، پورتِ SSH را در فایروالِ آروان برای اینترنت باز نگه‌دار یا از IPهای گیت‌هاب اجازه بده.
- اسکریپتِ `scripts/deploy.sh` خودش `git pull + npm run build + pm2 reload` را با health-check انجام می‌دهد.
