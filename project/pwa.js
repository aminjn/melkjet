(function () {
  // Link manifest + theme color if missing
  function ensureMeta() {
    var vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
    if (!document.querySelector('link[rel="manifest"]')) {
      var l = document.createElement('link');
      l.rel = 'manifest'; l.href = 'manifest.webmanifest';
      document.head.appendChild(l);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      var m = document.createElement('meta');
      m.name = 'theme-color'; m.content = '#0d0d0f';
      document.head.appendChild(m);
    }
    var ai = document.createElement('meta');
    ai.name = 'apple-mobile-web-app-capable'; ai.content = 'yes';
    document.head.appendChild(ai);
  }

  var deferred = null;
  var KEY = 'mj_pwa_dismissed';

  function isMobile() {
    return window.matchMedia('(max-width: 760px)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }

  function banner(opts) {
    if (document.getElementById('mj-pwa-banner')) return;
    var wrap = document.createElement('div');
    wrap.id = 'mj-pwa-banner';
    wrap.setAttribute('dir', 'rtl');
    wrap.style.cssText = 'position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;background:#18181c;border:1px solid rgba(201,169,106,0.5);border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:13px;box-shadow:0 18px 50px -12px rgba(0,0,0,0.7);font-family:Vazirmatn,system-ui,sans-serif;animation:mjpwa 0.35s cubic-bezier(.2,.8,.2,1) both';
    var kf = document.createElement('style');
    kf.textContent = '@keyframes mjpwa{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}';
    document.head.appendChild(kf);
    wrap.innerHTML =
      '<span style="width:42px;height:42px;flex-shrink:0;border-radius:12px;background:linear-gradient(140deg,#e0c489,#c9a96a);display:flex;align-items:center;justify-content:center"><span style="width:16px;height:16px;background:#0d0d0f;transform:rotate(45deg);border-radius:3px"></span></span>' +
      '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800;color:#f2f1ee">نصب اپلیکیشن ملک‌جت</div><div style="font-size:11.5px;color:#9a9a98;margin-top:2px;line-height:1.5">' + opts.sub + '</div></div>' +
      '<button id="mj-pwa-act" style="flex-shrink:0;height:38px;padding:0 16px;border:none;border-radius:11px;background:linear-gradient(140deg,#e0c489,#c9a96a);color:#16140f;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">' + opts.cta + '</button>' +
      '<button id="mj-pwa-x" aria-label="بستن" style="flex-shrink:0;width:30px;height:38px;border:none;background:transparent;color:#9a9a98;font-size:18px;cursor:pointer">×</button>';
    document.body.appendChild(wrap);

    document.getElementById('mj-pwa-x').onclick = function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      wrap.remove();
    };
    document.getElementById('mj-pwa-act').onclick = opts.onAct;
  }

  function iosSheet() {
    if (document.getElementById('mj-pwa-ios')) return;
    var s = document.createElement('div');
    s.id = 'mj-pwa-ios'; s.setAttribute('dir', 'rtl');
    s.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;font-family:Vazirmatn,system-ui,sans-serif';
    s.innerHTML =
      '<div style="width:100%;max-width:440px;background:#18181c;border:1px solid rgba(255,255,255,0.12);border-radius:22px 22px 0 0;padding:22px 20px 30px;text-align:center">' +
      '<div style="font-size:16px;font-weight:800;color:#f2f1ee">افزودن به صفحه اصلی</div>' +
      '<div style="font-size:13px;color:#9a9a98;margin-top:10px;line-height:1.9">دکمه‌ی اشتراک‌گذاری <b style="color:#c9a96a">⬆️</b> در نوار سافاری را بزن، سپس «Add to Home Screen» را انتخاب کن.</div>' +
      '<button id="mj-pwa-ios-x" style="margin-top:18px;width:100%;height:44px;border:none;border-radius:13px;background:linear-gradient(140deg,#e0c489,#c9a96a);color:#16140f;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer">متوجه شدم</button>' +
      '</div>';
    document.body.appendChild(s);
    s.onclick = function (e) { if (e.target === s) s.remove(); };
    document.getElementById('mj-pwa-ios-x').onclick = function () { s.remove(); };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    show();
  });

  function show() {
    try { if (localStorage.getItem(KEY)) return; } catch (e) {}
    if (isStandalone() || !isMobile()) return;
    if (isIOS()) {
      banner({ sub: 'برای دسترسی سریع، به صفحه اصلی اضافه کن', cta: 'افزودن', onAct: iosSheet });
    } else if (deferred) {
      banner({
        sub: 'تجربه‌ی کامل، سریع و آفلاین — بدون مرورگر',
        cta: 'نصب',
        onAct: function () {
          deferred.prompt();
          deferred.userChoice.finally(function () {
            deferred = null;
            var b = document.getElementById('mj-pwa-banner'); if (b) b.remove();
          });
        }
      });
    }
  }

  function init() {
    ensureMeta();
    // iOS has no beforeinstallprompt — show after a short delay
    if (isIOS()) setTimeout(show, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
