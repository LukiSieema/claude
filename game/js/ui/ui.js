/* Neon Horde — UI toolkit: screens, modals (with back-button stack), toasts, icons, reward flow. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C, S = NH.Sprites, PF = NH.Platform, A = NH.Audio;
  const t = (k, v) => NH.t(k, v);

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const stack = [];

  const UI = {
    $, $$,

    esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

    show(id) {
      $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
      this.current = id;
    },

    /** <img> icon markup from the procedural sprite cache. */
    icon(id, size, cls, bare) {
      return '<img class="' + (cls || '') + '" alt="" draggable="false" src="' + S.iconURL(id, size || 64, bare) + '">';
    },
    cur(kind, cls) { return '<span class="ico ico-' + kind + ' ' + (cls || '') + '"></span>'; },

    rarityColor(r) { return C.RARITIES[r].color; },
    rarityName(r) { return t('rarity_' + C.RARITIES[r].id); },
    itemName(it) { return t('item_' + it.id); },
    itemIconId(it) { const d = C.ITEMS[it.id]; return d.slot === 'weapon' ? d.weapon : d.slot; },

    itemHTML(it, opts) {
      opts = opts || {};
      return '<div class="item" style="--rc:' + this.rarityColor(it.rarity) + '" data-uid="' + it.uid + '">' +
        this.icon(this.itemIconId(it), 64, '', true) +
        '<span class="lv">' + t('lv', { n: it.level }) + '</span>' +
        (opts.equipped ? '<span class="eq"></span>' : '') +
        (opts.better ? '<span class="up">▲</span>' : '') +
        '</div>';
    },

    // ------------------------------------------------------------- modals
    /**
     * opts: { html, cls, dismiss (bool: tap outside / back closes), onClose, closeBtn }
     * returns { el, box, close() }
     */
    modal(opts) {
      const el = document.createElement('div');
      el.className = 'modal ' + (opts.cls || '');
      el.innerHTML = (opts.raw ? opts.html : '<div class="modal-box">' + (opts.closeBtn ? '<button class="modal-close" data-close>✕</button>' : '') + opts.html + '</div>');
      $('#modal-root').appendChild(el);
      const m = {
        el, box: el.querySelector('.modal-box'), dismiss: !!opts.dismiss, closed: false,
        close: () => {
          if (m.closed) return;
          m.closed = true;
          const i = stack.indexOf(m);
          if (i >= 0) stack.splice(i, 1);
          el.classList.add('closing');
          setTimeout(() => el.remove(), 150);
          if (opts.onClose) opts.onClose();
        },
      };
      el.addEventListener('click', (e) => {
        if (m.closed) return;
        if (e.target.closest('[data-close]')) { A.play('click'); m.close(); return; }
        if (e.target === el && m.dismiss) m.close();
      });
      stack.push(m);
      return m;
    },
    topModal() { return stack[stack.length - 1] || null; },
    closeAll() { while (stack.length) stack[stack.length - 1].close(); },

    /** Android back button: close the top dismissable modal. Returns true if handled. */
    back() {
      const m = this.topModal();
      if (m) { if (m.dismiss) { m.close(); } return true; }
      return false;
    },

    confirm(text, yesLabel, danger) {
      return new Promise((resolve) => {
        let answered = false;
        const m = this.modal({
          dismiss: true,
          html: '<div class="modal-sub" style="font-size:17px;color:var(--text)">' + this.esc(text) + '</div>' +
            '<div class="modal-actions h"><button class="btn btn-ghost" data-no>' + t('cancel') + '</button>' +
            '<button class="btn ' + (danger ? 'btn-rose' : '') + '" data-yes>' + (yesLabel || t('yes')) + '</button></div>',
          onClose: () => { if (!answered) resolve(false); },
        });
        m.el.querySelector('[data-no]').onclick = () => { A.play('click'); answered = true; resolve(false); m.close(); };
        m.el.querySelector('[data-yes]').onclick = () => { A.play('confirm'); answered = true; resolve(true); m.close(); };
      });
    },

    toast(text, kind) {
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.innerHTML = text;
      $('#toast-root').appendChild(el);
      setTimeout(() => el.remove(), 2500);
    },

    // ------------------------------------------------------------ rewards
    rewardChipsHTML(r) {
      const chips = [];
      const chip = (ico, v, i) => '<div class="reward-chip" style="animation-delay:' + (i * 0.06) + 's">' + ico + '<span>' + v + '</span></div>';
      let i = 0;
      if (r.coins) chips.push(chip(this.cur('coin'), U.fmt(r.coins), i++));
      if (r.gems) chips.push(chip(this.cur('gem'), U.fmt(r.gems), i++));
      if (r.energy) chips.push(chip(this.cur('energy'), '+' + r.energy, i++));
      if (r.scrap) chips.push(chip(this.cur('scrap'), U.fmt(r.scrap), i++));
      if (r.xp) chips.push(chip(this.cur('xp'), U.fmt(r.xp) + ' XP', i++));
      for (const it of (r.items || [])) {
        chips.push('<div class="reward-item" style="animation-delay:' + (i++ * 0.06) + 's">' + this.itemHTML(it) + '</div>');
      }
      return '<div class="reward-list">' + chips.join('') + '</div>';
    },

    /** Generic reward popup. */
    rewardPopup(title, r, extraHTML) {
      A.play('reward');
      PF.haptic('light');
      const m = this.modal({
        dismiss: true,
        html: '<div class="modal-title">' + this.esc(title) + '</div>' + this.rewardChipsHTML(r) + (extraHTML || '') +
          '<div class="modal-actions"><button class="btn btn-wide" data-close>' + t('ok') + '</button></div>',
      });
      this.flyRewards(r, m.box);
      this.levelUps(r.levels);
      return m;
    },

    levelUps(levels) {
      if (!levels || !levels.length) return;
      const last = levels[levels.length - 1];
      setTimeout(() => this.toast(t('accountUp', { n: last.level }) + ' ' + this.cur('gem') + ' +' + levels.reduce((a, l) => a + l.reward.gems, 0), 'good'), 400);
    },

    /** Coins/gems icons flying from `fromEl` to their top-bar pills. */
    flyRewards(r, fromEl) {
      const kinds = [];
      if (r.coins) kinds.push('coin');
      if (r.gems) kinds.push('gem');
      if (r.energy) kinds.push('energy');
      if (!kinds.length) return;
      const src = (fromEl || document.body).getBoundingClientRect();
      const sx = src.left + src.width / 2, sy = src.top + src.height / 2;
      for (const k of kinds) {
        const pill = document.querySelector('.pill[data-cur="' + k + '"]');
        if (!pill) continue;
        const dst = pill.getBoundingClientRect();
        for (let i = 0; i < 7; i++) {
          const el = document.createElement('span');
          el.className = 'fly ico ico-' + k;
          el.style.left = sx + 'px'; el.style.top = sy + 'px';
          const jx = (Math.random() - 0.5) * 120, jy = (Math.random() - 0.5) * 80;
          el.style.transform = 'translate(' + jx + 'px,' + jy + 'px) scale(1.3)';
          el.style.opacity = '0';
          $('#fly-root').appendChild(el);
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transitionDelay = (i * 0.05) + 's';
            el.style.transform = 'translate(' + (dst.left + 14 - sx) + 'px,' + (dst.top + 16 - sy) + 'px) scale(0.7)';
          }, 30);
          setTimeout(() => { el.remove(); if (i === 6) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); A.play('coin'); } }, 800 + i * 50);
        }
      }
    },

    // ----------------------------------------------------------------- ads
    /** Shows a rewarded ad. Resolves true when the reward should be granted. */
    async watchAd(placement) {
      const G = NH.G;
      if (this.adShield) return false; // another ad is already starting
      if (!PF.rewardedReady()) { this.toast(t('adUnavailable'), 'bad'); A.play('deny'); return false; }
      const shield = document.createElement('div');
      shield.className = 'ad-shield';
      document.body.appendChild(shield);
      this.adShield = shield;
      A.suspend();
      let res = 'unavailable';
      try { res = await PF.showRewarded(placement); } finally { A.resume(); shield.remove(); this.adShield = null; }
      if (res !== 'earned') { this.toast(t(res === 'skipped' ? 'adNotCompleted' : 'adUnavailable'), 'bad'); return false; }
      NH.Meta.recordAd(G.state, G.now());
      G.persist();
      const nextMilestone = C.AD_TRACKER.find((m, i) => G.state.daily.ads === m.ads && !G.state.daily.adTrackerClaimed.includes(i));
      if (nextMilestone) setTimeout(() => this.toast(t('adTracker') + ': ' + t('adsWatched', { n: G.state.daily.ads, m: nextMilestone.ads }) + ' ✓', 'good'), 600);
      return true;
    },

    adBtn(label, attrs, cls) {
      return '<button class="btn btn-gold ' + (cls || '') + '" ' + (attrs || '') + '><span class="ad-ico"></span>' + label + '</button>';
    },
  };

  NH.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
