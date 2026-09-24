/* Neon Horde — lobby screens: top bar, navigation, Battle / Shop / Gear / Talents / Events tabs and meta modals. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C, S = NH.Sprites, PF = NH.Platform, A = NH.Audio, M = NH.Meta, UI = NH.UI;
  const t = (k, v) => NH.t(k, v);
  const $ = UI.$;

  const TABS = ['shop', 'gear', 'battle', 'talents', 'events'];

  const Lobby = {
    tab: 'battle',
    stage: null,

    init() {
      $('#topbar').addEventListener('click', (e) => this.onTopbar(e));
      $('#bottom-nav').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b || b.dataset.tab === this.tab) return;
        A.play('click');
        PF.haptic('light');
        this.setTab(b.dataset.tab);
      });
      $('#lobby-content').addEventListener('click', (e) => this.onContent(e));
    },

    open() {
      UI.show('screen-lobby');
      PF.setBanner(true);
      A.setMusicMode('menu');
      this.render();
    },

    setTab(tab) {
      this.tab = tab;
      this.renderNav();
      this.renderContent();
      $('#lobby-content').scrollTop = 0;
    },

    render() {
      this.renderTopbar();
      this.renderNav();
      this.renderContent();
    },

    refresh() {
      if (UI.current !== 'screen-lobby') return;
      this.renderTopbar();
      this.renderNav();
      this.renderContent(true);
    },

    // ---------------------------------------------------------------- topbar
    renderTopbar() {
      const s = NH.G.state;
      const need = C.accountXpToNext(s.account.level);
      $('#topbar').innerHTML =
        '<div class="avatar" data-act="settings"><canvas id="avatar-canvas" width="100" height="100"></canvas>' +
        '<div class="avatar-lv">' + t('lv', { n: s.account.level }) + '</div></div>' +
        '<div class="currencies">' +
        '<div class="pill" data-cur="energy" data-act="energy">' + UI.cur('energy') + '<span>' + s.energy + '/' + C.ENERGY.max + '</span><span class="plus">+</span></div>' +
        '<div class="pill" data-cur="coin">' + UI.cur('coin') + '<span>' + U.fmt(s.coins) + '</span></div>' +
        '<div class="pill" data-cur="gem" data-act="gems">' + UI.cur('gem') + '<span>' + U.fmt(s.gems) + '</span></div>' +
        '</div>' +
        '<button class="icon-btn" data-act="settings" aria-label="' + t('settings') + '"><span class="ico ico-gear"></span></button>';
      const cv = $('#avatar-canvas');
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 100, 100);
      const g = ctx.createRadialGradient(50, 50, 10, 50, 50, 50);
      g.addColorStop(0, '#3b2a8f'); g.addColorStop(1, '#150f3a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(50, 50, 41, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#2ef2ff'; ctx.lineWidth = 3; ctx.stroke();
      const sp = S.hero();
      ctx.save(); ctx.beginPath(); ctx.arc(50, 50, 39.5, 0, U.TAU); ctx.clip();
      ctx.translate(50, 52); ctx.rotate(-0.3);
      ctx.drawImage(sp.c, -44, -44, 88, 88);
      ctx.restore();
      // account XP as a ring around the avatar (saves the width a separate bar needed on narrow phones)
      const k = U.clamp(s.account.xp / need, 0, 1);
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = '#2a2266'; ctx.beginPath(); ctx.arc(50, 50, 47, 0, U.TAU); ctx.stroke();
      if (k > 0) { ctx.strokeStyle = '#b562ff'; ctx.beginPath(); ctx.arc(50, 50, 47, -Math.PI / 2, -Math.PI / 2 + U.TAU * k); ctx.stroke(); }
    },

    onTopbar(e) {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      A.play('click');
      if (act.dataset.act === 'settings') this.settingsModal();
      else if (act.dataset.act === 'energy') this.energyModal();
      else if (act.dataset.act === 'gems') this.setTab('shop');
    },

    renderNav() {
      const b = M.badges(NH.G.state, NH.G.now());
      $('#bottom-nav').innerHTML = TABS.map((id) =>
        '<button class="nav-btn ' + (id === 'battle' ? 'nav-battle ' : '') + (this.tab === id ? 'active' : '') + '" data-tab="' + id + '">' +
        UI.icon(id, 96, '', true) + '<span>' + t('tab_' + id) + '</span>' + (b[id] ? '<span class="badge-dot"></span>' : '') + '</button>').join('');
    },

    renderContent(soft) {
      const el = $('#lobby-content');
      const scroll = el.scrollTop;
      const html = this['tab_' + this.tab]();
      el.innerHTML = '<div class="tab-page' + (soft ? '' : '') + '"' + (soft ? ' style="animation:none"' : '') + '>' + html + '</div>';
      if (soft) el.scrollTop = scroll;
      if (this.tab === 'battle') this.mountStage();
      else this.stage = null;
      if (this.tab === 'gear') this.drawHeroView();
    },

    /** Called every second by the main loop to refresh timers without re-rendering. */
    tick() {
      const s = NH.G.state, now = NH.G.now();
      for (const el of document.querySelectorAll('[data-timer]')) {
        const k = el.dataset.timer;
        if (k === 'gold') {
          const rem = M.freeGoldIn(s, now);
          if (rem <= 0 && el.dataset.state !== 'ready') { this.refresh(); return; }
          el.textContent = t('readyIn', { t: U.fmtDuration(rem) });
        } else if (k === 'energy') {
          el.textContent = s.energy >= C.ENERGY.max ? t('energyFull') : t('energyFullIn', { t: U.fmtTime(M.energyNextIn(s, now)) });
        } else if (k === 'patrol') {
          const p = M.patrolPending(s, now);
          el.textContent = t('patrolStored', { t: U.fmtDuration(p.seconds), cap: C.PATROL.capHours });
          const bar = document.getElementById('patrol-bar');
          if (bar) bar.style.width = (p.seconds / (C.PATROL.capHours * 3600) * 100).toFixed(1) + '%';
          const amt = document.getElementById('patrol-amt');
          if (amt) amt.textContent = U.fmt(p.coins);
        } else if (k === 'daily') {
          const d = new Date(now); const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
          el.textContent = t('resetsIn', { t: U.fmtDuration((next - d) / 1000) });
        }
      }
      const pill = document.querySelector('.pill[data-cur="energy"] span:nth-child(2)');
      if (pill) pill.textContent = s.energy + '/' + C.ENERGY.max;
    },

    // ------------------------------------------------------------ battle tab
    tab_battle() {
      const s = NH.G.state;
      const ch = s.chapter.selected;
      const def = C.CHAPTERS[ch - 1];
      const unlocked = ch <= s.chapter.unlocked;
      const best = s.chapter.best[String(ch)];
      const surv = s.chapter.best['survived' + ch];
      const bossName = def.mk ? t('mk2', { name: t('boss_' + def.boss) }) : t('boss_' + def.boss);
      const meta = best ? t('bestTime', { t: U.fmtTime(best) }) : surv ? t('survived', { t: U.fmtTime(surv) }) : t('notPlayed');
      const power = M.heroStats(s).power;
      const rec = Math.round(600 * Math.pow(def.hp, 0.72));
      let html = '<div class="chapter-stage"><canvas id="stage-canvas"></canvas>' +
        '<button class="chapter-arrow left" data-act="ch-prev" ' + (ch <= 1 ? 'disabled' : '') + '>‹</button>' +
        '<button class="chapter-arrow right" data-act="ch-next" ' + (ch >= C.CHAPTERS.length ? 'disabled' : '') + '>›</button>' +
        '<div class="chapter-info"><div class="chapter-no">' + t('chapter', { n: ch }) + ' · ' + t('boss') + ': ' + bossName + '</div>' +
        '<div class="chapter-name">' + t('ch' + ch) + '</div>' +
        '<div class="chapter-meta">' + meta + '</div></div></div>';
      html += '<div class="start-wrap">';
      if (unlocked) {
        html += '<div class="small ' + (power >= rec ? 'lime' : 'rose') + '">' + t('recommended', { n: U.fmt(rec) }) + ' · ' + t('power') + ' ' + U.fmt(power) + '</div>';
        html += '<button class="btn btn-big btn-rose start-btn shine" data-act="start"><span>' + t('start') + '</span><span class="start-cost">' + UI.cur('energy') + C.ENERGY.runCost + '</span></button>';
        html += '<div class="small muted" data-timer="energy"></div>';
      } else {
        html += '<div class="locked-note">🔒 ' + t('unlockHint', { n: ch - 1 }) + '</div>';
      }
      html += '</div>';
      html += this.patrolCard();
      html += this.adTrackerCard();
      html += '<div class="card row" data-act="evo-guide" style="margin-top:10px">' + UI.icon('photon', 64, '', false).replace('<img', '<img style="width:44px;height:44px"') +
        '<div class="grow"><div class="hl">' + t('evoGuide') + '</div><div class="small muted">' + t('evoGuideDesc') + '</div></div><div class="muted">›</div></div>';
      return html;
    },

    patrolCard() {
      const s = NH.G.state, now = NH.G.now();
      const p = M.patrolPending(s, now);
      const r = M.patrolRates(s);
      const q = M.quickPatrolOptions(s);
      return '<div class="section-title">' + t('patrol') + '<small>' + t('patrolRate', { c: U.fmt(r.coins), x: r.xp }) + '</small></div>' +
        '<div class="card patrol-card"><div class="row">' + UI.icon('drone', 64, 'patrol-anim', true) +
        '<div class="grow"><div class="row small"><span class="muted" data-timer="patrol"></span></div>' +
        '<div class="progress gold" style="margin:6px 0"><i id="patrol-bar" style="width:' + (p.seconds / (C.PATROL.capHours * 3600) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="row small">' + UI.cur('coin') + '<b id="patrol-amt">' + U.fmt(p.coins) + '</b>' + (p.full ? '<span class="rose hl">' + t('patrolFull') + '</span>' : '') + '</div></div></div>' +
        '<div class="modal-actions h" style="margin-top:10px">' +
        '<button class="btn btn-sm ' + (p.seconds >= C.PATROL.minClaimSec ? 'btn-lime' : 'btn-ghost') + '" data-act="patrol-claim" ' + (p.seconds < C.PATROL.minClaimSec ? 'disabled' : '') + '>' + t('claim') + '</button>' +
        '<button class="btn btn-sm btn-gold ' + (q.free ? 'pulse' : '') + '" data-act="quick-patrol">' + (q.free ? '' : '<span class="ad-ico"></span>') + t('quickPatrol') + '</button></div></div>';
    },

    adTrackerCard() {
      const s = NH.G.state;
      const d = s.daily;
      const max = C.AD_TRACKER[C.AD_TRACKER.length - 1].ads;
      const nodes = C.AD_TRACKER.map((m, i) => {
        const done = d.adTrackerClaimed.includes(i);
        const ready = !done && d.ads >= m.ads;
        const r = m.reward;
        const ico = r.chest ? UI.icon('crate_' + r.chest, 64, '', true).replace('<img', '<img style="width:30px;height:30px"') : UI.cur(r.gems ? 'gem' : 'energy');
        const label = r.chest ? '' : '+' + (r.gems || r.energy);
        return '<button class="tracker-node ' + (done ? 'done' : ready ? 'ready' : '') + '" data-act="tracker" data-i="' + i + '">' + ico +
          '<span class="hl">' + label + '</span><span class="need">' + (done ? '✓' : m.ads + ' ▶') + '</span></button>';
      }).join('');
      return '<div class="section-title">' + t('adTracker') + '<small>' + t('adsWatched', { n: Math.min(d.ads, max), m: max }) + '</small></div>' +
        '<div class="card"><div class="small muted" style="margin-bottom:6px">' + t('adTrackerDesc') + '</div>' +
        '<div class="progress gold"><i style="width:' + Math.min(100, d.ads / max * 100) + '%"></i></div>' +
        '<div class="tracker">' + nodes + '</div></div>';
    },

    mountStage() {
      const cv = $('#stage-canvas');
      if (!cv) return;
      this.stage = new NH.StageAnim(cv, NH.G.state.chapter.selected);
    },

    // -------------------------------------------------------------- shop tab
    tab_shop() {
      const s = NH.G.state, now = NH.G.now();
      const goldIn = M.freeGoldIn(s, now);
      const d = s.daily;
      let html = '<div class="section-title">' + t('shop_free') + '<small data-timer="daily"></small></div>';
      html += '<div class="card"><div class="row">' + UI.icon('crate_gold', 96, '', true).replace('<img', '<img style="width:64px;height:64px"') +
        '<div class="grow"><div class="hl">' + t('freeGold') + '</div>' +
        (goldIn <= 0 ? '<div class="lime small" data-state="ready">' + t('ready') + '</div>' : '<div class="small muted" data-timer="gold"></div>') + '</div>' +
        (goldIn <= 0 ? '<button class="btn btn-sm btn-lime shine" data-act="free-gold">' + t('open') + '</button>'
          : UI.adBtn(t('speedUp'), 'data-act="gold-cut"', 'btn-sm')) + '</div></div>';
      html += '<div class="shop-grid" style="margin-top:10px">';
      const silverLeft = C.AD_SILVER_PER_DAY - d.silverAds;
      html += '<div class="card shop-item">' + UI.icon('crate_silver', 96, '', true) + '<div class="name">' + t('freeSilver') + '</div>' +
        '<div class="small muted">' + t('adsLeftToday', { n: silverLeft }) + '</div>' + UI.adBtn(t('open'), 'data-act="ad-silver" ' + (silverLeft <= 0 ? 'disabled' : ''), 'btn-sm btn-wide') + '</div>';
      const gemLeft = C.FREE_GEMS_AD.perDay - d.gemAds;
      html += '<div class="card shop-item"><span class="ico ico-gem" style="width:64px;height:64px"></span><div class="name">' + t('freeGems') + ' +' + C.FREE_GEMS_AD.amount + '</div>' +
        '<div class="small muted">' + t('adsLeftToday', { n: gemLeft }) + '</div>' + UI.adBtn(t('claim'), 'data-act="ad-gems" ' + (gemLeft <= 0 ? 'disabled' : ''), 'btn-sm btn-wide') + '</div>';
      html += '</div>';
      html += this.adTrackerCard();
      html += '<div class="section-title">' + t('shop_crates') + '</div><div class="shop-grid">';
      for (const type of ['silver', 'gold']) {
        const cost = C.CHESTS[type].cost;
        html += '<div class="card shop-item">' + UI.icon('crate_' + type, 96, '', true) + '<div class="name">' + t('crate_' + type) + '</div>' +
          '<div class="odds">' + C.CHESTS[type].odds.map(([r, w]) => '<span style="color:' + UI.rarityColor(r) + '">' + UI.rarityName(r) + ' ' + w + '%</span>').join('') + '</div>' +
          '<button class="btn btn-sm btn-violet btn-wide" data-act="buy" data-type="' + type + '" data-n="1">' + UI.cur('gem') + cost + '</button>' +
          '<button class="btn btn-xs btn-ghost btn-wide" data-act="buy" data-type="' + type + '" data-n="10">' + t('open10') + ' · ' + UI.cur('gem') + Math.round(cost * 10 * 0.9) + '</button></div>';
      }
      html += '</div>';
      html += '<div class="section-title">' + t('shop_resources') + '</div><div class="shop-grid">';
      html += '<div class="card shop-item"><span class="ico ico-energy" style="width:60px;height:60px"></span><div class="name">' + t('energyPack') + ' +' + C.ENERGY.gemAmount + '</div>' +
        '<button class="btn btn-sm btn-violet btn-wide" data-act="energy-gems">' + UI.cur('gem') + C.ENERGY.gemCost + '</button></div>';
      html += '<div class="card shop-item"><span class="ico ico-coin" style="width:60px;height:60px"></span><div class="name">' + t('coinCache') + '</div>' +
        '<div class="small muted">' + t('coinCacheDesc', { h: C.COIN_CACHE.hours }) + ' · ' + U.fmt(M.coinCacheAmount(s)) + '</div>' +
        '<button class="btn btn-sm btn-violet btn-wide" data-act="coin-cache">' + UI.cur('gem') + C.COIN_CACHE.gemCost + '</button></div>';
      html += '</div>';
      return html;
    },

    // -------------------------------------------------------------- gear tab
    tab_gear() {
      const s = NH.G.state;
      const st = M.heroStats(s);
      const slotHTML = (slot) => {
        const it = M.equippedItem(s, slot);
        return '<div class="item-slot ' + (it ? '' : 'empty') + '" data-label="' + t('slot_' + slot) + '" data-act="slot" data-slot="' + slot + '">' +
          (it ? UI.itemHTML(it) : '') + '</div>';
      };
      let html = '<div class="card"><div class="hero-panel">' +
        '<div class="slot-col">' + slotHTML('weapon') + slotHTML('gloves') + slotHTML('necklace') + '</div>' +
        '<div class="hero-view"><canvas id="hero-view" width="240" height="400"></canvas></div>' +
        '<div class="slot-col">' + slotHTML('armor') + slotHTML('boots') + slotHTML('belt') + '</div></div>' +
        '<div class="stat-row"><span class="rose">' + t('atk') + ' ' + U.fmt(st.atk) + '</span><span class="lime">' + t('hp') + ' ' + U.fmt(st.hp) + '</span><span class="gold">' + t('power') + ' ' + U.fmt(st.power) + '</span></div>' +
        '<div class="center small muted" style="margin-top:4px">' + t('startSkill', { skill: t('sk_' + st.startWeapon) }) + '</div></div>';
      const inv = s.inventory.filter((it) => !M.isEquipped(s, it.uid)).sort((a, b) => b.rarity - a.rarity || C.SLOTS.indexOf(C.ITEMS[a.id].slot) - C.SLOTS.indexOf(C.ITEMS[b.id].slot) || b.level - a.level);
      html += '<div class="section-title"><span>' + t('inventory') + '<span class="count">' + inv.length + '</span></span>' +
        '<button class="btn btn-xs btn-gold" data-act="merge-all">' + t('mergeAll') + '</button></div>';
      if (!inv.length) html += '<div class="card empty-note">' + t('emptyInventory') + '</div>';
      else {
        html += '<div class="inv-grid">' + inv.map((it) => {
          const cur = M.equippedItem(s, C.ITEMS[it.id].slot);
          const better = !cur || M.itemScore(it) > M.itemScore(cur);
          return '<div data-act="item" data-uid="' + it.uid + '">' + UI.itemHTML(it, { better }) + '</div>';
        }).join('') + '</div>';
      }
      html += '<div class="section-title">' + t('scrap') + ' <small>' + UI.cur('scrap') + ' ' + U.fmt(s.scrap) + '</small></div>';
      return html;
    },

    drawHeroView() {
      const cv = $('#hero-view');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 240, 400);
      const g = ctx.createRadialGradient(120, 200, 10, 120, 200, 120);
      g.addColorStop(0, 'rgba(46,242,255,0.35)'); g.addColorStop(1, 'rgba(46,242,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 240, 400);
      ctx.strokeStyle = 'rgba(46,242,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(120, 300, 80, 22, 0, 0, U.TAU); ctx.stroke();
      ctx.drawImage(S.hero().c, 40, 120, 160, 160);
      const st = M.heroStats(NH.G.state);
      const ic = S.iconCanvas(st.startWeapon, 64);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(ic, 150, 90, 60, 60);
      ctx.globalAlpha = 1;
    },

    itemModal(uid) {
      const s = NH.G.state;
      const it = M.getItem(s, uid);
      if (!it) return;
      const def = C.ITEMS[it.id];
      const equipped = M.isEquipped(s, uid);
      const r = C.RARITIES[it.rarity];
      const stat = C.itemStat(it);
      const statName = C.SLOT_STAT[def.slot] === 'atk' ? t('atk') : t('hp');
      const up = M.upgradeCheck(s, uid);
      const cost = C.upgradeCost(it);
      const perks = C.SLOT_PERKS[def.slot].map(([minR, stat2, v]) => {
        const on = it.rarity >= minR;
        const val = stat2 === 'regen' ? v : Math.round(v * 100);
        return '<div class="row small" style="opacity:' + (on ? 1 : 0.45) + '"><span style="color:' + UI.rarityColor(minR) + ';min-width:74px">' + UI.rarityName(minR) + '</span>' +
          '<span class="grow">' + t('perk_' + stat2, { v: val }) + '</span>' + (on ? '<span class="lime">✓</span>' : '') + '</div>';
      }).join('');
      const canMerge = M.canMerge(s, uid);
      const salv = M.salvageValue(it);
      const html = '<div class="row" style="gap:14px"><div style="width:86px">' + UI.itemHTML(it) + '</div><div class="grow">' +
        '<div class="hl" style="font-size:20px">' + UI.itemName(it) + '</div>' +
        '<div style="color:' + r.color + ';font-weight:700">' + UI.rarityName(it.rarity) + ' · ' + t('slot_' + def.slot) + '</div>' +
        '<div class="small muted">' + t('level', { n: it.level }) + ' / ' + r.maxLevel + '</div>' +
        '<div class="hl" style="font-size:18px;margin-top:4px">' + statName + ' ' + U.fmt(stat) + '</div></div></div>' +
        (def.weapon ? '<div class="card small" style="margin-top:10px">' + UI.icon(def.weapon, 64, '', false).replace('<img', '<img style="width:36px;height:36px;vertical-align:middle;margin-right:6px"') + t('startSkill', { skill: t('sk_' + def.weapon) }) + '</div>' : '') +
        '<div class="section-title" style="margin-top:12px">' + t('perks') + '</div><div class="card">' + perks + '</div>' +
        '<div class="small muted center" style="margin-top:8px">' + (def.slot === 'weapon' ? t('mergeHintWeapon', { rarity: UI.rarityName(it.rarity) }) : t('mergeHint', { rarity: UI.rarityName(it.rarity), slot: t('slot_' + def.slot) })) + '</div>' +
        '<div class="modal-actions">' +
        (it.level >= r.maxLevel ? '<button class="btn btn-wide btn-ghost" disabled>' + t('maxLevel') + '</button>'
          : '<button class="btn btn-wide btn-lime" data-a="upgrade" ' + (up.ok ? '' : 'disabled') + '>' + t('upgrade') + ' · ' + UI.cur('coin') + U.fmt(cost.coins) + ' ' + UI.cur('scrap') + cost.scrap + '</button>') +
        '<div class="modal-actions h" style="margin-top:0">' +
        (equipped ? (def.slot !== 'weapon' ? '<button class="btn btn-ghost" data-a="unequip">' + t('unequip') + '</button>' : '')
          : '<button class="btn" data-a="equip">' + t('equip') + '</button>') +
        (canMerge ? '<button class="btn btn-gold" data-a="merge">' + t('merge') + '</button>' : '') +
        (!equipped ? '<button class="btn btn-ghost btn-sm" data-a="salvage">' + t('salvageFor', { s: salv.scrap }) + '</button>' : '') +
        '</div></div>';
      const m = UI.modal({ html, dismiss: true, closeBtn: true });
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const act = b.dataset.a;
        if (act === 'upgrade') {
          const res = M.upgradeItem(s, uid);
          if (res.ok) { A.play('buy'); PF.haptic('light'); NH.G.persist(); m.close(); this.refresh(); this.itemModal(uid); }
          else { A.play('deny'); UI.toast(t(res.reason === 'scrap' ? 'notEnoughScrap' : 'notEnoughCoins'), 'bad'); }
        } else if (act === 'equip') { M.equip(s, uid); A.play('confirm'); NH.G.persist(); m.close(); this.refresh(); }
        else if (act === 'unequip') { M.unequip(s, uid); A.play('click'); NH.G.persist(); m.close(); this.refresh(); }
        else if (act === 'merge') {
          const res = M.merge(s, uid);
          if (res) { NH.G.persist(); m.close(); this.refresh(); this.mergeCelebrate([res.item]); }
        } else if (act === 'salvage') {
          const v = M.salvage(s, uid);
          if (v) { A.play('coin'); NH.G.persist(); m.close(); this.refresh(); UI.toast('+' + v.scrap + ' ' + t('scrap') + (v.coins ? ' · +' + U.fmt(v.coins) + ' ' + t('coins') : ''), 'good'); }
        }
      });
    },

    mergeCelebrate(items) {
      A.play('evolve');
      PF.haptic('medium');
      UI.modal({
        dismiss: true,
        html: '<div class="modal-title gold">' + t('merged', { n: items.length }) + '</div>' +
          '<div class="reward-list">' + items.map((it, i) => '<div class="reward-item" style="width:80px;animation-delay:' + i * 0.08 + 's">' + UI.itemHTML(it) + '<div class="small center" style="color:' + UI.rarityColor(it.rarity) + '">' + UI.rarityName(it.rarity) + '</div></div>').join('') + '</div>' +
          '<div class="modal-actions"><button class="btn btn-wide" data-close>' + t('ok') + '</button></div>',
      });
    },

    // ----------------------------------------------------------- talents tab
    tab_talents() {
      const s = NH.G.state;
      const cap = C.talentCap(s.account.level);
      let html = '<div class="section-title">' + t('tab_talents') + '<small>' + t('talentsIntro') + '</small></div><div class="talent-grid">';
      for (const id of C.TALENT_IDS) {
        const lvl = s.talents[id];
        const chk = M.talentCheck(s, id);
        const cost = C.talentCost(lvl);
        const maxed = chk.reason === 'max';
        html += '<div class="card talent">' + UI.icon(id, 96, '', false) + '<div class="hl">' + t('talent_' + id) + '</div>' +
          '<div class="lvl">' + t('level', { n: lvl }) + '</div><div class="small muted">' + t('talentd_' + id) + '</div>' +
          (maxed ? '<button class="btn btn-sm btn-ghost btn-wide" disabled>' + t('maxLevel') + '</button>'
            : '<button class="btn btn-sm btn-wide ' + (chk.ok ? 'btn-lime' : 'btn-ghost') + '" data-act="talent" data-id="' + id + '" ' + (chk.reason === 'cap' ? 'disabled' : '') + '>' + UI.cur('coin') + U.fmt(cost) + '</button>') +
          '</div>';
      }
      html += '</div><div class="center small muted" style="margin-top:12px">' + t('talentCap', { n: cap }) + '</div>';
      return html;
    },

    // ------------------------------------------------------------ events tab
    tab_events() {
      const s = NH.G.state, now = NH.G.now();
      const loginAvail = M.loginAvailable(s, now);
      const cur = s.login.index % C.LOGIN_REWARDS.length;
      let html = '<div class="section-title">' + t('dailyLogin') + '</div><div class="card"><div class="login-grid">';
      const N = C.LOGIN_REWARDS.length;
      C.LOGIN_REWARDS.forEach((r, i) => {
        // `cur` is the next reward; after claiming day 7 the cycle restarts at 0
        const done = loginAvail ? i < cur : (cur === 0 || i < cur);
        const today = loginAvail && i === cur;
        const claimedToday = !loginAvail && i === (cur + N - 1) % N;
        const ico = r.chest ? UI.icon('crate_' + r.chest, 64, '', true).replace('<img', '<img style="width:38px;height:38px"') : UI.cur(r.coins ? 'coin' : r.gems ? 'gem' : r.energy ? 'energy' : 'scrap');
        const amt = r.chest ? t('crate_' + r.chest) : U.fmt(r.coins || r.gems || r.energy || r.scrap);
        html += '<div class="login-day ' + (i === 6 ? 'big ' : '') + (today ? 'today ' : '') + (done ? 'done' : '') + '">' +
          '<div class="muted">' + t('day', { n: i + 1 }) + '</div>' + ico + '<div class="amt">' + amt + '</div>' + (claimedToday ? '<div class="lime small">✓</div>' : '') + '</div>';
      });
      html += '</div>' + (loginAvail ? '<div class="modal-actions h"><button class="btn btn-lime" data-act="login" data-m="1">' + t('claim') + '</button>' + UI.adBtn(t('claimX2'), 'data-act="login" data-m="2"') + '</div>' : '') + '</div>';

      const d = s.daily;
      html += '<div class="section-title">' + t('dailyQuests') + '<small data-timer="daily"></small></div><div class="card">';
      html += '<div class="row small"><span class="hl">' + t('activity') + ' ' + d.activity + '/100</span></div><div class="activity-bar"><div class="progress"><i style="width:' + d.activity + '%"></i></div><div class="activity-nodes">';
      C.ACTIVITY_MILESTONES.forEach((m, i) => {
        const done = d.activityClaimed.includes(i), ready = !done && d.activity >= m.pts;
        html += '<button class="activity-node ' + (done ? 'done' : ready ? 'ready' : '') + '" style="left:' + m.pts + '%" data-act="activity" data-i="' + i + '">' + (done ? '✓' : '🎁') + '<span>' + m.pts + '</span></button>';
      });
      html += '</div></div>';
      d.quests.forEach((q, i) => {
        const ready = !q.claimed && q.progress >= q.target;
        html += '<div class="quest"><div class="grow"><div>' + t('quest_' + q.id, { n: q.target }) + '</div>' +
          '<div class="progress"><i style="width:' + (q.progress / q.target * 100) + '%"></i></div></div>' +
          '<div class="small muted" style="min-width:44px;text-align:right">' + Math.min(q.progress, q.target) + '/' + q.target + '</div>' +
          (q.claimed ? '<button class="btn btn-xs btn-ghost" disabled>' + t('done') + '</button>'
            : '<button class="btn btn-xs ' + (ready ? 'btn-lime' : 'btn-ghost') + '" data-act="quest" data-i="' + i + '" ' + (ready ? '' : 'disabled') + '>+' + q.pts + '</button>') + '</div>';
      });
      html += '</div>';

      html += '<div class="section-title">' + t('achievements') + '</div><div class="card">';
      const achs = C.ACHIEVEMENTS.slice().sort((a, b) => (s.achievements[a.id] ? 1 : 0) - (s.achievements[b.id] ? 1 : 0) || (M.achievementClaimable(s, b) ? 1 : 0) - (M.achievementClaimable(s, a) ? 1 : 0));
      achs.forEach((a) => {
        const val = M.statValue(s, a.stat);
        const claimed = !!s.achievements[a.id];
        const ready = M.achievementClaimable(s, a);
        html += '<div class="quest"><div class="grow"><div>' + t('ach_' + a.stat, { n: a.target }) + '</div>' +
          '<div class="progress violet"><i style="width:' + Math.min(100, val / a.target * 100) + '%"></i></div></div>' +
          (claimed ? '<button class="btn btn-xs btn-ghost" disabled>✓</button>'
            : '<button class="btn btn-xs ' + (ready ? 'btn-violet' : 'btn-ghost') + '" data-act="ach" data-id="' + a.id + '" ' + (ready ? '' : 'disabled') + '>' + UI.cur('gem') + a.gems + '</button>') + '</div>';
      });
      html += '</div>';
      return html;
    },

    // --------------------------------------------------------- click routing
    async onContent(e) {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const G = NH.G, s = G.state, now = G.now();
      const act = b.dataset.act;
      A.play('click');
      switch (act) {
        case 'ch-prev': case 'ch-next': {
          const n = U.clamp(s.chapter.selected + (act === 'ch-next' ? 1 : -1), 1, C.CHAPTERS.length);
          s.chapter.selected = n; G.persist(); this.renderContent(true); break;
        }
        case 'start': G.startRun(s.chapter.selected); break;
        case 'patrol-claim': {
          const r = M.claimPatrol(s, now, 1, G.rng);
          G.persist(); this.refresh();
          UI.rewardPopup(t('patrol'), r);
          break;
        }
        case 'quick-patrol': this.quickPatrolModal(); break;
        case 'tracker': {
          const r = M.claimAdTracker(s, Number(b.dataset.i), G.rng);
          if (r) { G.persist(); this.refresh(); this.showGrant(t('adTracker'), r); }
          else { const m = C.AD_TRACKER[Number(b.dataset.i)]; if (s.daily.ads < m.ads) UI.toast(t('adsWatched', { n: s.daily.ads, m: m.ads })); }
          break;
        }
        case 'evo-guide': this.evoGuide(); break;
        case 'free-gold': {
          const items = M.claimFreeGold(s, now, G.rng);
          if (items) { G.persist(); this.refresh(); this.openCrates('gold', items); G.scheduleNotifications(); }
          break;
        }
        case 'gold-cut': {
          if (await UI.watchAd('free_gold_speedup')) { M.cutFreeGold(s, G.now()); G.persist(); this.refresh(); UI.toast(t('speedUp') + ' ✓', 'good'); G.scheduleNotifications(); }
          break;
        }
        case 'ad-silver': {
          if (await UI.watchAd('free_silver')) {
            const items = M.claimAdSilver(s, G.rng);
            G.persist(); this.refresh();
            if (items) this.openCrates('silver', items);
          }
          break;
        }
        case 'ad-gems': {
          if (s.daily.gemAds >= C.FREE_GEMS_AD.perDay) break;
          if (await UI.watchAd('free_gems')) {
            s.daily.gemAds++;
            s.gems += C.FREE_GEMS_AD.amount;
            G.persist(); this.refresh();
            UI.rewardPopup(t('freeGems'), { gems: C.FREE_GEMS_AD.amount });
          }
          break;
        }
        case 'buy': {
          const n = Number(b.dataset.n);
          const items = M.buyChest(s, b.dataset.type, n, G.rng);
          if (!items) { A.play('deny'); UI.toast(t('notEnoughGems'), 'bad'); break; }
          G.persist(); this.refresh(); this.openCrates(b.dataset.type, items);
          break;
        }
        case 'energy-gems': this.buyEnergyGems(); break;
        case 'coin-cache': {
          const coins = M.buyCoinCache(s);
          if (!coins) { A.play('deny'); UI.toast(t('notEnoughGems'), 'bad'); break; }
          G.persist(); this.refresh();
          UI.rewardPopup(t('coinCache'), { coins });
          break;
        }
        case 'slot': {
          const it = M.equippedItem(s, b.dataset.slot);
          if (it) this.itemModal(it.uid);
          break;
        }
        case 'item': this.itemModal(Number(b.dataset.uid)); break;
        case 'merge-all': {
          const res = M.mergeAll(s);
          if (!res.length) { UI.toast(t('mergeNone')); break; }
          G.persist(); this.refresh(); this.mergeCelebrate(res);
          break;
        }
        case 'talent': {
          const res = M.upgradeTalent(s, b.dataset.id);
          if (res.ok) { A.play('buy'); PF.haptic('light'); G.persist(); this.refresh(); }
          else { A.play('deny'); UI.toast(t('notEnoughCoins'), 'bad'); }
          break;
        }
        case 'login': {
          let mult = Number(b.dataset.m);
          if (mult === 2 && !(await UI.watchAd('login_double'))) mult = 0;
          if (!mult) break;
          const r = M.claimLogin(s, G.now(), mult, G.rng);
          if (r) { G.persist(); this.refresh(); this.showGrant(t('day', { n: r.day + 1 }), r.granted); }
          break;
        }
        case 'quest': if (M.claimQuest(s, Number(b.dataset.i))) { A.play('confirm'); G.persist(); this.refresh(); } break;
        case 'activity': {
          const r = M.claimActivity(s, Number(b.dataset.i), G.rng);
          if (r) { G.persist(); this.refresh(); this.showGrant(t('activity'), r); }
          break;
        }
        case 'ach': {
          const g = M.claimAchievement(s, b.dataset.id);
          if (g) { G.persist(); this.refresh(); UI.rewardPopup(t('achievements'), { gems: g }); }
          break;
        }
        default: break;
      }
    },

    /** Shows a reward from Meta.grant (opens crates with animation if any). */
    showGrant(title, r) {
      if (r.items && r.items.length) {
        const rest = { coins: r.coins, gems: r.gems, energy: r.energy, scrap: r.scrap };
        this.openCrates('gold', r.items, () => { if (rest.coins || rest.gems || rest.energy || rest.scrap) UI.rewardPopup(title, rest); });
      } else UI.rewardPopup(title, r);
    },

    // --------------------------------------------------------------- modals
    openCrates(type, items, after) {
      A.play('crate');
      PF.haptic('medium');
      const best = items.reduce((a, it) => Math.max(a, it.rarity), 0);
      const m = UI.modal({
        dismiss: false,
        onClose: after,
        html: '<div class="crate-stage"><div class="crate-anim">' + UI.icon('crate_' + type, 128, '', true).replace('<img', '<img style="width:130px;height:130px"') + '</div></div>' +
          '<div class="crate-reveal" hidden><div class="modal-title" style="color:' + UI.rarityColor(best) + '">' + UI.rarityName(best) + '!</div>' +
          '<div class="reward-list">' + items.map((it, i) => '<div class="reward-item" style="width:' + (items.length > 4 ? 56 : 80) + 'px;animation-delay:' + (i * 0.07) + 's">' + UI.itemHTML(it) +
            '<div class="small center" style="color:' + UI.rarityColor(it.rarity) + '">' + UI.itemName(it) + '</div></div>').join('') + '</div>' +
          '<div class="modal-actions"><button class="btn btn-wide" data-close>' + t('ok') + '</button></div></div>',
      });
      const anim = m.el.querySelector('.crate-anim');
      anim.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-8deg) scale(1.05)' }, { transform: 'rotate(8deg) scale(1.1)' }, { transform: 'rotate(-6deg) scale(1.15)' }, { transform: 'rotate(0) scale(1.4)', opacity: 0 }], { duration: 900, easing: 'ease-in' });
      setTimeout(() => {
        m.el.querySelector('.crate-stage').hidden = true;
        m.el.querySelector('.crate-reveal').hidden = false;
        m.dismiss = true;
        A.play(best >= 3 ? 'evolve' : 'reward');
        if (best >= 3) PF.haptic('heavy');
      }, 880);
    },

    quickPatrolModal() {
      const G = NH.G, s = G.state;
      const q = M.quickPatrolOptions(s);
      const prev = M.patrolFor(s, C.PATROL.quickHours * 3600);
      const m = UI.modal({
        dismiss: true, closeBtn: true,
        html: '<div class="modal-title">' + t('quickPatrol') + '</div><div class="modal-sub">' + t('quickPatrolDesc', { h: C.PATROL.quickHours }) + '</div>' +
          UI.rewardChipsHTML({ coins: prev.coins, xp: prev.xp, scrap: prev.scrap }) +
          '<div class="modal-actions">' +
          (q.free ? '<button class="btn btn-lime btn-wide" data-m="free">' + t('free') + '</button>' : '') +
          UI.adBtn(t('watchAd') + ' <span class="sub">(' + t('adsLeftToday', { n: q.adsLeft }) + ')</span>', 'data-m="ad" ' + (q.ad ? '' : 'disabled'), 'btn-wide') +
          '<button class="btn btn-violet btn-wide" data-m="gems">' + UI.cur('gem') + q.gemCost + '</button></div>',
      });
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-m]');
        if (!b || b.disabled || m.closed) return;
        const mode = b.dataset.m;
        if (mode === 'ad' && (!(await UI.watchAd('quick_patrol')) || m.closed)) return;
        if (mode === 'gems' && s.gems < q.gemCost) { A.play('deny'); UI.toast(t('notEnoughGems'), 'bad'); return; }
        const r = M.quickPatrol(s, mode, G.rng);
        if (!r) return;
        G.persist(); m.close(); this.refresh();
        UI.rewardPopup(t('quickPatrol'), r);
      });
    },

    energyModal() {
      const G = NH.G, s = G.state;
      const left = C.ADS.energyPerDay - s.daily.energyAds;
      const m = UI.modal({
        dismiss: true, closeBtn: true,
        html: '<div class="modal-title"><span class="ico ico-energy" style="width:30px;height:30px"></span> ' + s.energy + '/' + C.ENERGY.max + '</div>' +
          '<div class="modal-sub" data-timer="energy"></div>' +
          '<div class="modal-actions">' + UI.adBtn(t('energyAd', { n: C.ENERGY.adAmount }) + ' <span class="sub">(' + t('adsLeftToday', { n: left }) + ')</span>', 'data-e="ad" ' + (left > 0 ? '' : 'disabled'), 'btn-wide') +
          '<button class="btn btn-violet btn-wide" data-e="gems">' + t('energyGems', { n: C.ENERGY.gemAmount, g: UI.cur('gem') + C.ENERGY.gemCost }) + '</button></div>',
      });
      this.tick();
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-e]');
        if (!b || b.disabled || m.closed) return;
        if (b.dataset.e === 'ad') {
          if (s.daily.energyAds >= C.ADS.energyPerDay) return;
          if (!(await UI.watchAd('energy')) || m.closed) return;
          s.daily.energyAds++;
          s.energy += C.ENERGY.adAmount;
          G.persist(); m.close(); this.refresh();
          UI.rewardPopup(t('energy'), { energy: C.ENERGY.adAmount });
        } else { m.close(); this.buyEnergyGems(); }
      });
    },

    buyEnergyGems() {
      const G = NH.G, s = G.state;
      if (s.gems < C.ENERGY.gemCost) { A.play('deny'); UI.toast(t('notEnoughGems'), 'bad'); return; }
      s.gems -= C.ENERGY.gemCost;
      s.energy += C.ENERGY.gemAmount;
      G.persist(); this.refresh();
      UI.rewardPopup(t('energy'), { energy: C.ENERGY.gemAmount });
    },

    welcomeBack(p) {
      const G = NH.G, s = G.state;
      const m = UI.modal({
        dismiss: false,
        html: '<div class="modal-title">' + t('welcomeBack') + '</div><div class="modal-sub">' + t('patrolledFor', { t: U.fmtDuration(p.seconds) }) + '</div>' +
          UI.rewardChipsHTML({ coins: p.coins, xp: p.xp, scrap: p.scrap }) +
          '<div class="modal-actions">' + UI.adBtn(t('claimX3'), 'data-w="3"', 'btn-wide btn-big shine') +
          '<button class="btn btn-ghost btn-wide" data-w="1">' + t('claim') + '</button></div>',
      });
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-w]');
        if (!b || b.disabled || m.closed) return;
        const mult = Number(b.dataset.w);
        if (mult === 3) {
          b.disabled = true;
          const ok = await UI.watchAd('offline_x3');
          if (m.closed) return;
          if (!ok) { b.disabled = false; return; }
        }
        const r = M.claimPatrol(s, G.now(), mult, G.rng);
        G.persist(); m.close(); this.refresh();
        UI.rewardPopup(t('patrol') + (mult > 1 ? ' ×' + mult : ''), r);
      });
    },

    evoGuide() {
      const s = NH.G.state;
      const rows = Object.keys(C.EVOLUTIONS).map((id) => {
        const e = C.EVOLUTIONS[id];
        const known = !!s.codex[id];
        return '<div class="row" style="margin:8px 0">' + UI.icon(e.from, 64, '', false).replace('<img', '<img style="width:40px;height:40px"') + '<b>+</b>' +
          UI.icon(e.pair, 64, '', false).replace('<img', '<img style="width:40px;height:40px"') + '<b>=</b>' +
          UI.icon(id, 64, '', false).replace('<img', '<img style="width:46px;height:46px;' + (known ? '' : 'filter:grayscale(1) brightness(0.6)') + '"') +
          '<div class="grow small"><div class="hl">' + t('sk_' + id) + '</div><div class="muted">' + (known ? t('discovered') : t('sk_' + e.from) + ' + ' + t('sk_' + e.pair)) + '</div></div></div>';
      }).join('');
      UI.modal({ dismiss: true, closeBtn: true, html: '<div class="modal-title">' + t('evoGuide') + '</div><div class="modal-sub">' + t('evoGuideDesc') + '</div>' + rows });
    },

    settingsModal() {
      const G = NH.G, s = G.state;
      const toggle = (key, label) => '<div class="set-row"><span>' + label + '</span><button class="toggle ' + (s.settings[key] ? 'on' : '') + '" data-s="' + key + '"></button></div>';
      const langs = NH.I18N.langs.map((l) => '<button class="' + (NH.I18N.lang === l ? 'on' : '') + '" data-lang="' + l + '">' + l.toUpperCase() + '</button>').join('');
      const m = UI.modal({
        dismiss: true, closeBtn: true,
        html: '<div class="modal-title">' + t('settings') + '</div>' +
          toggle('sound', t('sound')) + toggle('music', t('music')) + toggle('haptics', t('vibration')) +
          toggle('damageNumbers', t('damageNumbers')) +
          '<div class="set-row"><span>' + t('graphics') + '</span><button class="toggle ' + (s.settings.quality === 'high' ? 'on' : '') + '" data-s="quality"></button></div>' +
          toggle('batterySaver', t('batterySaver')) +
          '<div class="set-row"><span>' + t('language') + '</span><div class="seg">' + langs + '</div></div>' +
          '<div class="modal-actions">' +
          '<button class="btn btn-ghost btn-wide" data-x="guide">' + t('evoGuide') + '</button>' +
          (PF.isNative && PF.privacyOptionsRequired() ? '<button class="btn btn-ghost btn-wide" data-x="privacy-options">' + t('privacyOptions') + '</button>' : '') +
          '<button class="btn btn-ghost btn-wide" data-x="policy">' + t('privacyPolicy') + '</button>' +
          '<button class="btn btn-ghost btn-wide" data-x="licenses">' + t('licenses') + '</button>' +
          '<button class="btn btn-gold btn-wide" data-x="rate">★ ' + t('rateGame') + '</button>' +
          '<button class="btn btn-rose btn-sm" data-x="reset">' + t('resetProgress') + '</button></div>' +
          '<div class="center small muted" style="margin-top:10px">' + t('version', { v: PF.appVersion() }) + '</div>',
      });
      m.el.addEventListener('click', async (e) => {
        const tg = e.target.closest('[data-s]');
        if (tg) {
          const k = tg.dataset.s;
          if (k === 'quality') s.settings.quality = s.settings.quality === 'high' ? 'low' : 'high';
          else s.settings[k] = !s.settings[k];
          tg.classList.toggle('on');
          G.applySettings();
          G.persist();
          A.play('click');
          return;
        }
        const lg = e.target.closest('[data-lang]');
        if (lg) {
          s.lang = lg.dataset.lang;
          NH.I18N.set(s.lang);
          G.persist();
          m.close();
          this.render();
          this.settingsModal();
          return;
        }
        const x = e.target.closest('[data-x]');
        if (!x) return;
        A.play('click');
        if (x.dataset.x === 'guide') { m.close(); this.evoGuide(); }
        else if (x.dataset.x === 'privacy-options') PF.openPrivacyOptions();
        else if (x.dataset.x === 'policy') this.policyModal();
        else if (x.dataset.x === 'licenses') this.licensesModal();
        else if (x.dataset.x === 'rate') { s.rated = true; G.persist(); PF.rateApp(); }
        else if (x.dataset.x === 'reset') {
          if (await UI.confirm(t('resetConfirm'), t('resetProgress'), true)) G.resetProgress();
        }
      });
    },

    licensesModal() {
      const row = (name, text) => '<div style="margin:10px 0"><div class="hl">' + name + '</div><div class="small muted">' + text + '</div></div>';
      UI.modal({
        dismiss: true, closeBtn: true,
        html: '<div class="modal-title">' + t('licenses') + '</div><div class="modal-sub">' + t('licensesIntro') + '</div>' +
          row('Fredoka', '© 2016 The Fredoka Project Authors · SIL Open Font License 1.1 (fonts/OFL.txt) · ' + t('licensesFont')) +
          row('AndroidX, Kotlin', 'Apache License 2.0 · https://www.apache.org/licenses/LICENSE-2.0') +
          row('Google Mobile Ads SDK, User Messaging Platform, Play In-App Review', 'Google APIs Terms of Service · https://developers.google.com/terms') +
          '<div class="small muted" style="margin-top:12px">' + t('licensesOwn') + '</div>',
      });
    },

    policyModal() {
      UI.modal({
        dismiss: true, closeBtn: true,
        html: '<div class="modal-title">' + t('privacyPolicy') + '</div>' +
          '<iframe src="privacy.html?lang=' + NH.I18N.lang + '" title="' + t('privacyPolicy') + '" style="width:100%;height:60vh;border:0;border-radius:12px;background:#fff"></iframe>',
      });
    },
  };

  NH.Lobby = Lobby;
})(typeof window !== 'undefined' ? window : globalThis);
