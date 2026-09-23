/*
 * Neon Horde — platform layer.
 * On Android the Kotlin wrapper injects `window.NeonHordeNative` (@JavascriptInterface) and calls back into
 * `window.NHNative.*`. In a plain browser (development / web preview) ads are simulated with an overlay.
 */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};

  const native = root.NeonHordeNative || null;
  const pending = new Map();
  let reqSeq = 1;
  const listeners = { pause: [], resume: [], back: [], banner: [], insets: [], consent: [] };

  const params = (() => { try { return new URLSearchParams(root.location.search); } catch (e) { return new URLSearchParams(''); } })();

  const Platform = {
    isNative: !!native,
    webAds: !native && params.get('noads') !== '1',
    bannerHeight: 0,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    adBusy: false,

    on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); },
    emit(ev, a, b) { for (const fn of (listeners[ev] || [])) fn(a, b); },

    call(method) {
      if (!native || typeof native[method] !== 'function') return undefined;
      const args = Array.prototype.slice.call(arguments, 1);
      try { return native[method].apply(native, args); } catch (e) { return undefined; }
    },

    // ------------------------------------------------------------------ ads
    rewardedReady() {
      if (native) return this.call('isRewardedReady') === true;
      return true; // web preview always has a simulated ad
    },

    /** Resolves true when the reward was earned. */
    showRewarded(placement) {
      if (this.adBusy) return Promise.resolve(false);
      this.adBusy = true;
      const done = (ok) => { this.adBusy = false; return ok; };
      if (native) {
        const id = reqSeq++;
        return new Promise((resolve) => {
          pending.set('r' + id, (earned) => resolve(done(!!earned)));
          const accepted = this.call('showRewarded', id, placement || 'default');
          if (accepted === false) { pending.delete('r' + id); resolve(done(false)); }
        });
      }
      return this.webAdOverlay('rewarded', placement).then(done);
    },

    showInterstitial(placement) {
      if (this.adBusy) return Promise.resolve(false);
      if (native) {
        const id = reqSeq++;
        this.adBusy = true;
        return new Promise((resolve) => {
          pending.set('i' + id, (shown) => { this.adBusy = false; resolve(!!shown); });
          const accepted = this.call('showInterstitial', id, placement || 'default');
          if (accepted === false) { pending.delete('i' + id); this.adBusy = false; resolve(false); }
        });
      }
      if (!this.webAds) return Promise.resolve(false);
      this.adBusy = true;
      return this.webAdOverlay('interstitial', placement).then((r) => { this.adBusy = false; return r; });
    },

    setBanner(visible) {
      if (native) { this.call('setBannerVisible', !!visible); return; }
      const el = document.getElementById('web-banner');
      if (!el) return;
      const show = visible && this.webAds;
      el.hidden = !show;
      this.setBannerHeight(show ? 50 : 0);
    },

    setBannerHeight(px) {
      this.bannerHeight = px;
      document.documentElement.style.setProperty('--banner-h', px + 'px');
      this.emit('banner', px);
    },

    /** Browser-only stand-in so every ad flow can be tested without the Android SDK. */
    webAdOverlay(kind, placement) {
      return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.className = 'web-ad';
        const secs = kind === 'rewarded' ? 3 : 2;
        ov.innerHTML = '<div class="web-ad-box"><div class="web-ad-tag">AD · web preview</div>' +
          '<div class="web-ad-title">' + (kind === 'rewarded' ? 'Rewarded video' : 'Interstitial') + '</div>' +
          '<div class="web-ad-sub">' + (placement || '') + '</div>' +
          '<div class="web-ad-count">' + secs + '</div>' +
          '<button class="btn web-ad-close" disabled>✕</button></div>';
        document.body.appendChild(ov);
        const count = ov.querySelector('.web-ad-count');
        const close = ov.querySelector('.web-ad-close');
        let left = secs;
        const iv = setInterval(() => {
          left--;
          count.textContent = left > 0 ? String(left) : '✓';
          if (left <= 0) { clearInterval(iv); close.disabled = false; }
        }, 1000);
        close.addEventListener('click', () => {
          clearInterval(iv);
          ov.remove();
          resolve(true);
        });
      });
    },

    // -------------------------------------------------------------- device
    haptic(kind) {
      if (!NH.state || !NH.state.settings.haptics) return;
      const ms = kind === 'heavy' ? 45 : kind === 'medium' ? 22 : 10;
      if (native) { this.call('vibrate', ms); return; }
      if (root.navigator && root.navigator.vibrate) { try { root.navigator.vibrate(ms); } catch (e) { /* ignore */ } }
    },

    keepScreenOn(on) { this.call('setKeepScreenOn', !!on); },

    scheduleNotification(id, delaySec, title, body) {
      if (delaySec <= 0) return;
      this.call('scheduleNotification', id, Math.round(delaySec), title, body);
    },
    cancelNotification(id) { this.call('cancelNotification', id); },
    requestNotificationPermission() { this.call('requestNotificationPermission'); },

    privacyOptionsRequired() { return native ? this.call('isPrivacyOptionsRequired') === true : false; },
    openPrivacyOptions() { this.call('showPrivacyOptions'); },

    openUrl(url) {
      if (native) this.call('openUrl', url);
      else root.open(url, '_blank', 'noopener');
    },
    rateApp() {
      if (native) this.call('rateApp');
      else this.openUrl('https://play.google.com/store/apps/details?id=com.neonhorde.survivor');
    },
    exitApp() { if (native) this.call('exitApp'); },
    appVersion() { return (native && this.call('getAppVersion')) || NH.C.VERSION; },
  };

  // Callbacks invoked by the Android wrapper via evaluateJavascript.
  root.NHNative = {
    onRewardResult(id, earned) { const cb = pending.get('r' + id); if (cb) { pending.delete('r' + id); cb(earned); } },
    onInterstitialClosed(id, shown) { const cb = pending.get('i' + id); if (cb) { pending.delete('i' + id); cb(shown); } },
    onBannerHeight(dp) { Platform.setBannerHeight(Math.max(0, Math.round(dp))); },
    onInsets(top, right, bottom, left) {
      Platform.insets = { top, right, bottom, left };
      const s = document.documentElement.style;
      s.setProperty('--sat', top + 'px'); s.setProperty('--sar', right + 'px');
      s.setProperty('--sab', bottom + 'px'); s.setProperty('--sal', left + 'px');
      Platform.emit('insets', Platform.insets);
    },
    onPause() { Platform.emit('pause'); },
    onResume() { Platform.emit('resume'); },
    onBack() { Platform.emit('back'); return true; },
    onConsent(canRequestAds) { Platform.emit('consent', !!canRequestAds); },
  };

  NH.Platform = Platform;
})(typeof window !== 'undefined' ? window : globalThis);
