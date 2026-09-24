/* Neon Horde — in-run UI: HUD, announcements, tutorial, level-up cards, crates, pause, revive, results. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C, PF = NH.Platform, A = NH.Audio, M = NH.Meta, UI = NH.UI;
  const t = (k, v) => NH.t(k, v);
  const $ = UI.$;

  const RunUI = {
    world: null,
    hudT: 0,
    skillsDirty: true,
    tut: null,

    attach(world, tutorial) {
      this.world = world;
      this.skillsDirty = true;
      this.hudT = 0;
      this.tut = tutorial ? { step: 0, t: 0, moved: false } : null;
      $('#boss-bar').hidden = true;
      $('#hud-timer').classList.remove('boss');
      $('#announce').innerHTML = '';
      $('#tutorial-hint').hidden = true;
      world.ev.on('upgrade', () => { this.skillsDirty = true; });
      world.ev.on('evolve', () => { this.skillsDirty = true; });
      world.ev.on('eliteSpawn', () => { if (this.tut && !this.tut.crateShown) { this.tut.crateShown = true; this.hint(t('tut_crate'), 5); } });
      $('#hud-pause').onclick = () => { A.play('click'); NH.G.pauseRun(); };
    },

    announce(html, cls, small) {
      const el = document.createElement('div');
      el.className = (small ? 'a-small ' : 'a-big ') + (cls || '');
      el.innerHTML = html;
      const box = $('#announce');
      box.innerHTML = '';
      box.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.remove(); }, 2100);
    },

    hint(text, secs) {
      const el = $('#tutorial-hint');
      el.textContent = text;
      el.hidden = false;
      clearTimeout(this.hintTimer);
      if (secs) this.hintTimer = setTimeout(() => { el.hidden = true; }, secs * 1000);
    },

    update(dt) {
      const w = this.world;
      if (!w) return;
      $('#hud-xp').style.transform = 'scaleX(' + U.clamp(w.xp / w.xpNeed, 0, 1).toFixed(3) + ')';
      if (w.boss && w.boss._alive) $('#boss-fill').style.transform = 'scaleX(' + U.clamp(w.boss.hp / w.boss.maxHp, 0, 1).toFixed(3) + ')';
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.1;
        $('#hud-level').textContent = t('lv', { n: w.level });
        $('#hud-kills').textContent = U.fmt(w.kills);
        $('#hud-coins').textContent = U.fmt(w.coins);
        const timer = $('#hud-timer');
        if (w.boss) { timer.textContent = t('boss').toUpperCase(); timer.classList.add('boss'); }
        else timer.textContent = U.fmtTime(w.t);
      }
      if (this.skillsDirty) { this.skillsDirty = false; this.renderSkills(); }
      if (this.tut) this.tutorial(dt);
    },

    renderSkills() {
      const w = this.world;
      let html = '';
      for (const wp of w.weapons) {
        const id = wp.evolved ? C.WEAPONS[wp.id].evo : wp.id;
        html += '<div class="sk">' + UI.icon(id, 48) + (wp.evolved ? '' : '<b>' + wp.level + '</b>') + '</div>';
      }
      const ps = Object.keys(w.passives);
      if (ps.length) html += '<div class="sep"></div>';
      for (const id of ps) html += '<div class="sk">' + UI.icon(id, 48) + '<b>' + w.passives[id] + '</b></div>';
      $('#hud-skills').innerHTML = html;
    },

    tutorial(dt) {
      const T = this.tut, w = this.world;
      T.t += dt;
      if (T.step === 0) {
        this.hint(t('tut_move'));
        if (w.hero.moving) { T.moved = true; T.step = 1; T.t = 0; }
      } else if (T.step === 1) {
        this.hint(t('tut_auto'));
        if (T.t > 3.5) { T.step = 2; T.t = 0; }
      } else if (T.step === 2) {
        this.hint(t('tut_gems'));
        if (w.level >= 2 || T.t > 12) { T.step = 3; $('#tutorial-hint').hidden = true; }
      }
    },

    bossBar(e) {
      const def = C.CHAPTERS[this.world.chapterIdx];
      $('#boss-name').textContent = def.mk ? t('mk2', { name: t('boss_' + e.boss) }) : t('boss_' + e.boss);
      $('#boss-bar').hidden = false;
    },

    // --------------------------------------------------------------- level up
    skillName(c) { return t('sk_' + c.id); },

    diffText(id, level) {
      const L = C.WEAPONS[id].levels;
      if (level <= 1) return t('skd_' + id);
      const a = L[level - 2], b = L[level - 1];
      const out = [];
      const countKey = id === 'orbit' ? 'd_blades' : id === 'drone' ? 'd_drones' : 'd_count';
      if (b.count !== undefined && b.count > a.count) out.push(t(countKey, { n: b.count - a.count }));
      if (b.strikes !== undefined && b.strikes > a.strikes) out.push(t('d_strikes', { n: b.strikes - a.strikes }));
      if (b.chains !== undefined && b.chains > a.chains) out.push(t('d_chains', { n: b.chains - a.chains }));
      if (b.dmg > a.dmg) out.push(t('d_dmg', { p: Math.round((b.dmg / a.dmg - 1) * 100) }));
      if (b.duration === 0 && a.duration > 0) out.push(t('d_permanent'));
      else if (b.duration !== undefined && b.duration > a.duration) out.push(t('d_duration', { p: Math.round((b.duration / a.duration - 1) * 100) }));
      if (b.cd > 0 && b.cd < a.cd) out.push(t('d_cd', { p: Math.round((1 - b.cd / a.cd) * 100) }));
      const ra = a.radius || a.size, rb = b.radius || b.size;
      if (rb && rb > ra) out.push(t('d_area', { p: Math.round((rb / ra - 1) * 100) }));
      if (b.pierce !== undefined && b.pierce > a.pierce) out.push(t('d_pierce', { n: b.pierce - a.pierce }));
      if (b.freeze && !a.freeze) out.push(t('d_freeze'));
      if (b.range !== undefined && b.range > a.range) out.push(t('d_range', { p: Math.round((b.range / a.range - 1) * 100) }));
      if (!out.length && b.speed > a.speed) out.push(t('d_speed'));
      return out.slice(0, 3).join(' · ');
    },

    cardHTML(c, i) {
      const w = this.world;
      let icon = c.id, name = this.skillName(c), desc = '', delta = '', ev = '', tag = '';
      let stars = '';
      if (c.kind === 'weapon' || c.kind === 'passive') {
        const cur = c.level - 1;
        stars = '<span class="stars">' + [1, 2, 3, 4, 5].map((n) => '<i class="' + (n <= cur ? 'on' : n === c.level ? 'next' : '') + '"></i>').join('') + '</span>';
        if (c.level === 1) { tag = '<span class="tag-new">' + t('new') + '</span>'; desc = t('skd_' + c.id); }
        else if (c.kind === 'weapon') delta = this.diffText(c.id, c.level);
        else desc = t('skd_' + c.id);
        if (c.kind === 'weapon') {
          const pair = C.WEAPONS[c.id].pair;
          const owned = !!w.passives[pair];
          ev = (c.level === 5 ? t('maxedEvolve') + ' ' : '') + t('evolvesWith', { p: t('sk_' + pair) }) + (owned ? ' ✓' : '');
        } else {
          const wid = Object.keys(C.WEAPONS).find((k) => C.WEAPONS[k].pair === c.id);
          if (wid) ev = '→ ' + t('sk_' + C.WEAPONS[wid].evo) + (w.weapon(wid) ? ' ✓' : '');
        }
      } else {
        desc = t('skd_' + c.id);
        icon = c.kind === 'heal' ? 'heal' : 'coins';
      }
      return '<button class="lu-card" data-i="' + i + '">' + UI.icon(icon, 96) +
        '<div class="grow"><div class="nm">' + name + ' ' + tag + stars + '</div>' +
        (desc ? '<div class="ds">' + desc + '</div>' : '') + (delta ? '<div class="dl">' + delta + '</div>' : '') +
        (ev ? '<div class="ev">' + ev + '</div>' : '') + '</div></button>';
    },

    showLevelUp() {
      const w = this.world;
      const choices = w.rollChoices(3);
      A.play('card');
      const canReroll = w.rerollsUsed < C.ADS.rerollPerRun;
      const canAll = w.takeAllUsed < C.ADS.takeAllPerRun && choices.filter((c) => c.kind === 'weapon' || c.kind === 'passive').length === 3 && w.fitsAll(choices);
      const m = UI.modal({
        cls: 'levelup', raw: true, dismiss: false,
        html: '<div style="width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center">' +
          '<div class="lu-title">' + t('levelUp') + '</div><div class="lu-sub">' + t('chooseSkill') + ' · ' + t('lv', { n: w.level - w.pendingLevels + 1 }) + '</div>' +
          '<div class="lu-cards">' + choices.map((c, i) => this.cardHTML(c, i)).join('') + '</div>' +
          '<div class="lu-actions">' +
          (canReroll ? UI.adBtn(t('reroll'), 'data-x="reroll"', 'btn-sm btn-violet') : '') +
          (canAll ? UI.adBtn(t('takeAll'), 'data-x="all"', 'btn-sm') : '') +
          '</div></div>',
      });
      let picked = false;
      m.el.addEventListener('click', async (e) => {
        if (picked) return;
        const card = e.target.closest('.lu-card');
        if (card) {
          picked = true;
          A.play('confirm');
          PF.haptic('light');
          card.style.transform = 'scale(1.05)';
          w.applyChoice(choices[Number(card.dataset.i)]);
          setTimeout(() => { m.close(); w.finishLevelUp(); }, 140);
          return;
        }
        const x = e.target.closest('[data-x]');
        if (!x || x.disabled) return;
        x.disabled = true;
        if (x.dataset.x === 'reroll') {
          const ok = await UI.watchAd('levelup_reroll');
          if (picked) return;
          if (ok) {
            w.rerollsUsed++;
            picked = true;
            m.close();
            setTimeout(() => this.showLevelUp(), 160);
          } else x.disabled = false;
        } else if (x.dataset.x === 'all') {
          const ok = await UI.watchAd('levelup_take_all');
          if (picked) return;
          if (ok) {
            w.takeAllUsed++;
            picked = true;
            for (const c of choices) w.applyChoice(c);
            A.play('evolve');
            m.close();
            w.finishLevelUp();
          } else x.disabled = false;
        }
      });
    },

    // ------------------------------------------------------------------ crate
    showCrate() {
      const w = this.world;
      A.play('crate');
      PF.haptic('medium');
      let extraUsed = false;
      const m = UI.modal({
        dismiss: false,
        html: '<div class="modal-title gold">' + t('crateTitle') + '</div>' +
          '<div class="crate-stage"><div class="crate-anim">' + UI.icon('crate_gold', 128, '', true).replace('<img', '<img style="width:130px;height:130px"') + '</div></div>' +
          '<div class="crate-result" hidden></div>' +
          '<div class="modal-actions" hidden>' + UI.adBtn(t('openAgain'), 'data-x="again"', 'btn-wide') +
          '<button class="btn btn-wide" data-x="done">' + t('continue') + '</button></div>',
      });
      const stage = m.el.querySelector('.crate-stage');
      const res = m.el.querySelector('.crate-result');
      const actions = m.el.querySelector('.modal-actions');
      const reveal = () => {
        const r = w.openCrate();
        stage.hidden = true;
        res.hidden = false;
        if (r.evo) {
          res.innerHTML = '<div class="evo-banner">' + t('evolution') + '</div>' + UI.icon(r.evo, 128).replace('<img', '<img style="width:110px;height:110px"') +
            '<div class="hl" style="font-size:22px">' + t('sk_' + r.evo) + '</div><div class="muted center">' + t('skd_' + r.evo) + '</div>';
        } else {
          res.innerHTML = '<div class="hl">' + t('crateUpgrades') + '</div><div class="mini-list">' + r.upgrades.map((c, i) =>
            '<div class="mi" style="animation-delay:' + i * 0.12 + 's">' + UI.icon(c.kind === 'heal' ? 'heal' : c.kind === 'coins' ? 'coins' : c.id, 96) + '<span>' + this.skillName(c) + (c.level ? ' ' + t('lv', { n: c.level }) : '') + '</span></div>').join('') + '</div>';
        }
        actions.hidden = false;
        const again = actions.querySelector('[data-x="again"]');
        again.hidden = extraUsed;
      };
      const anim = m.el.querySelector('.crate-anim');
      anim.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg) scale(1.05)' }, { transform: 'rotate(10deg) scale(1.1)' }, { transform: 'rotate(-8deg) scale(1.15)' }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 850, easing: 'ease-in' });
      setTimeout(reveal, 830);
      m.el.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]');
        if (!x || x.disabled || m.closed) return;
        if (x.dataset.x === 'done') { A.play('click'); m.close(); w.finishCrate(); }
        else if (x.dataset.x === 'again') {
          x.disabled = true;
          if (await UI.watchAd('crate_double')) {
            extraUsed = true;
            A.play('crate');
            res.hidden = true; actions.hidden = true;
            stage.hidden = false;
            anim.animate([{ transform: 'rotate(0)', opacity: 1 }, { transform: 'rotate(-10deg) scale(1.1)' }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 600, easing: 'ease-in' });
            setTimeout(reveal, 580);
          } else x.disabled = false;
        }
      });
    },

    // ------------------------------------------------------------------ pause
    showPause() {
      const w = this.world;
      const build = w.weapons.map((wp) => UI.icon(wp.evolved ? C.WEAPONS[wp.id].evo : wp.id, 64).replace('<img', '<img style="width:44px;height:44px"')).join('') +
        Object.keys(w.passives).map((id) => UI.icon(id, 64).replace('<img', '<img style="width:44px;height:44px"')).join('');
      const G = NH.G;
      const s = G.state;
      const toggle = (key, label) => '<div class="set-row"><span>' + label + '</span><button class="toggle ' + (s.settings[key] ? 'on' : '') + '" data-s="' + key + '"></button></div>';
      const m = UI.modal({
        dismiss: true,
        onClose: () => G.resumeRun(),
        html: '<div class="modal-title">' + t('pause') + '</div>' +
          '<div class="section-title" style="margin-top:6px">' + t('yourBuild') + '</div><div class="card" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">' + build + '</div>' +
          toggle('sound', t('sound')) + toggle('music', t('music')) + toggle('haptics', t('vibration')) +
          '<div class="modal-actions"><button class="btn btn-wide btn-big" data-close>' + t('resume') + '</button>' +
          '<button class="btn btn-ghost btn-wide" data-x="quit">' + t('quitRun') + '</button></div>',
      });
      m.el.addEventListener('click', async (e) => {
        const tg = e.target.closest('[data-s]');
        if (tg) { s.settings[tg.dataset.s] = !s.settings[tg.dataset.s]; tg.classList.toggle('on'); G.applySettings(); G.persist(); return; }
        const x = e.target.closest('[data-x="quit"]');
        if (!x) return;
        if (await UI.confirm(t('quitConfirm'), t('quitRun'), true)) {
          m.dismiss = false;
          m.close();
          G.endRun(false);
        }
      });
      return m;
    },

    // ----------------------------------------------------------------- revive
    showRevive() {
      const w = this.world, G = NH.G, s = G.state;
      const canAd = w.adRevives < C.REVIVE.maxAdRevives;
      const canGems = w.gemRevives < C.REVIVE.maxGemRevives;
      const canFree = w.freeRevives > 0;
      if (!canAd && !canGems && !canFree) { setTimeout(() => G.endRun(false), 900); return; }
      let left = C.REVIVE.timeout;
      let done = false;
      const circ = 2 * Math.PI * 52;
      const m = UI.modal({
        dismiss: false,
        html: '<div class="modal-title rose">' + t('defeated') + '</div><div class="modal-sub">' + t('reviveQ') + '</div>' +
          '<div class="revive-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="#231a57" stroke-width="10"/>' +
          '<circle id="rv-arc" cx="60" cy="60" r="52" fill="none" stroke="#ffc83d" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="0"/></svg><div class="num" id="rv-num">' + left + '</div></div>' +
          '<div class="modal-actions">' +
          (canFree ? '<button class="btn btn-lime btn-wide btn-big" data-r="free">' + t('freeRevive') + '</button>' : '') +
          (canAd ? UI.adBtn(t('revive'), 'data-r="ad"', 'btn-wide btn-big shine') : '') +
          (canGems ? '<button class="btn btn-violet btn-wide" data-r="gems" ' + (s.gems >= C.REVIVE.gemCost ? '' : 'disabled') + '>' + t('revive') + ' · ' + UI.cur('gem') + C.REVIVE.gemCost + '</button>' : '') +
          '<button class="btn btn-ghost btn-sm" data-r="no">' + t('giveUp') + '</button></div>',
      });
      const arc = m.el.querySelector('#rv-arc'), num = m.el.querySelector('#rv-num');
      let paused = false;
      const iv = setInterval(() => {
        if (paused || done) return;
        left -= 0.1;
        arc.setAttribute('stroke-dashoffset', String(circ * (1 - left / C.REVIVE.timeout)));
        num.textContent = String(Math.max(0, Math.ceil(left)));
        if (left <= 0) finish(false);
      }, 100);
      const finish = (revived, kind) => {
        if (done) return;
        done = true;
        clearInterval(iv);
        m.close();
        if (revived) { w.revive(kind); G.resumeLoop(); }
        else G.endRun(false);
      };
      m.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-r]');
        if (!b || b.disabled || done) return;
        const r = b.dataset.r;
        if (r === 'no') { A.play('click'); finish(false); }
        else if (r === 'free') finish(true, 'free');
        else if (r === 'gems') {
          if (s.gems < C.REVIVE.gemCost) return;
          s.gems -= C.REVIVE.gemCost; G.persist();
          finish(true, 'gems');
        } else if (r === 'ad') {
          paused = true;
          b.disabled = true;
          const ok = await UI.watchAd('revive');
          paused = false;
          if (ok) finish(true, 'ad'); else b.disabled = false;
        }
      });
    },

    // ---------------------------------------------------------------- results
    showResults(result, rewards) {
      const G = NH.G, s = G.state;
      const win = result.cleared;
      const itemsPreview = rewards.items.map((it) => ({ uid: 0, id: it.id, rarity: it.rarity, level: 1 }));
      let claimed = false;
      const m = UI.modal({
        dismiss: false,
        html: '<div class="result-title ' + (win ? 'win' : 'lose') + '">' + (win ? t('victory') : t('defeat')) + '</div>' +
          '<div class="center muted">' + t('chapter', { n: result.chapter }) + ' · ' + t('ch' + result.chapter) + '</div>' +
          '<div class="result-stats"><div><span class="small muted">' + t('time') + '</span><b>' + U.fmtTime(result.time) + '</b></div>' +
          '<div><span class="small muted">' + t('kills') + '</span><b>' + U.fmt(result.kills) + '</b></div>' +
          '<div><span class="small muted">' + t('runLevel') + '</span><b>' + result.level + '</b></div></div>' +
          '<div class="section-title" style="margin:6px 2px">' + t('rewards') + '</div>' +
          '<div id="res-rewards">' + UI.rewardChipsHTML({ coins: rewards.coins, scrap: rewards.scrap, xp: rewards.xp, items: itemsPreview }) + '</div>' +
          '<div class="modal-actions">' + UI.adBtn(t('doubleRewards'), 'data-x="double"', 'btn-wide btn-big shine') +
          '<button class="btn btn-wide ' + (win ? 'btn-lime' : 'btn-ghost') + '" data-x="claim">' + t('continue') + '</button>' +
          (!win ? UI.adBtn(t('retryFree'), 'data-x="retry"', 'btn-wide btn-sm btn-violet') : '') + '</div>',
      });
      m.el.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]');
        if (!x || x.disabled || claimed) return;
        const act = x.dataset.x;
        if (act === 'double') {
          x.disabled = true;
          const ok = await UI.watchAd('run_double');
          if (claimed) return;
          if (!ok) { x.disabled = false; return; }
          claimed = true;
          $('#res-rewards').innerHTML = UI.rewardChipsHTML({ coins: rewards.coins * 2, scrap: rewards.scrap * 2, xp: rewards.xp, items: itemsPreview.concat(itemsPreview) });
          A.play('reward');
          const out = G.claimRun(result, rewards, 2);
          setTimeout(() => { m.close(); G.afterRun(out, result); }, 900);
        } else if (act === 'claim') {
          claimed = true;
          A.play('confirm');
          const out = G.claimRun(result, rewards, 1);
          m.close();
          G.afterRun(out, result);
        } else if (act === 'retry') {
          x.disabled = true;
          const ok = await UI.watchAd('retry_free');
          if (claimed) return;
          if (!ok) { x.disabled = false; return; }
          claimed = true;
          G.claimRun(result, rewards, 1);
          m.close();
          G.startRun(result.chapter, { free: true });
        }
      });
    },
  };

  NH.RunUI = RunUI;
})(typeof window !== 'undefined' ? window : globalThis);
