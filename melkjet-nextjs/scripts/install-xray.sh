#!/usr/bin/env bash
# فاز ۲۹۹ — نصبِ باینریِ Xray-core برای فیلترشکنِ داخلیِ ملک‌جت.
# یک‌بار روی سرور اجرا کن:  sudo bash scripts/install-xray.sh
# باینری در bin/xray کنارِ پروژه می‌نشیند؛ کدِ app/lib/v2ray.ts همین مسیر را خودکار پیدا می‌کند.
# اگر دانلود از گیت‌هاب از داخلِ ایران گیر کرد، با پروکسی اجرا کن:
#   HTTPS_PROXY=http://127.0.0.1:1080 sudo -E bash scripts/install-xray.sh
set -euo pipefail

DEST="${1:-$(cd "$(dirname "$0")/.." && pwd)/bin}"
VERSION="${XRAY_VERSION:-latest}"
case "$(uname -m)" in
  x86_64|amd64) ASSET="Xray-linux-64.zip" ;;
  aarch64|arm64) ASSET="Xray-linux-arm64-v8a.zip" ;;
  *) echo "معماریِ ناشناخته: $(uname -m) — دستی از https://github.com/XTLS/Xray-core/releases نصب کن"; exit 1 ;;
esac
if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/XTLS/Xray-core/releases/latest/download/$ASSET"
else
  URL="https://github.com/XTLS/Xray-core/releases/download/$VERSION/$ASSET"
fi

mkdir -p "$DEST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "دانلودِ Xray ($ASSET) از:"
echo "  $URL"
curl -fSL --retry 3 "$URL" -o "$TMP/xray.zip"
if command -v unzip >/dev/null 2>&1; then
  unzip -o "$TMP/xray.zip" xray -d "$DEST"
else
  (cd "$DEST" && python3 -c "import zipfile,sys; zipfile.ZipFile('$TMP/xray.zip').extract('xray','.')")
fi
chmod +x "$DEST/xray"
echo "نسخهٔ نصب‌شده:"
"$DEST/xray" version | head -1 || true
echo ""
echo "✓ نصب شد: $DEST/xray"
echo "حالا در سوپرادمین → اتصال‌ها → «v2ray (فیلترشکن داخلی)» لینکِ کانفیگ/اشتراک را بگذار و روشن کن."
