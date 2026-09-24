/* Neon Horde — game controller: boot, main loop, run lifecycle, persistence, platform lifecycle. */
(function (root) {
  'use strict';
  const NH = root.NH;
  const U = NH.U, C = NH.C, M = NH.Meta, PF = NH.Platform, A = NH.Audio, UI = NH.UI;
  const t = (k, v) => NH.t(k, v);
  const $ = UI.$;

  function safeStorage() {
    try {
      const k = '__nh_test__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return root.localStorage;
    } catch (e) {
      const mem = {};
      return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    }
  }

  const G = {
    state: null,
    rng: U.rng((Date.now() ^ 0x5f3759df) >>> 0),
    mode: 'loading',          // loading | lobby | run | results
    world: null,
    paused: false,
    acc: 0,
    last: 0,
    frame: 0,
    tickT: 0,
    saveTimer: null,
    pauseModal: null,
    runEnded: false,

    now() { return Date.now(); },

    // --------------------------------------------------------------- boot
    boot() {
      NH.G = this;
      NH.Save.init(safeStorage());
      const now = this.now();
      this.state = NH.Save.load(now);
      NH.state = this.state;
      NH.I18N.set(this.state.lang || NH.I18N.detect());
      for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
      M.ensureDaily(this.state, now, this.rng);
      M.updateEnergy(this.state, now);

      this.canvas = $('#game-canvas');
      this.renderer = new NH.Renderer(this.canvas);
      this.fx = new NH.FX();
      this.input = new NH.Input(this.canvas);
      this.applySettings();
      this.onResize();
      root.addEventListener('resize', () => this.onResize());
      NH.Lobby.init();

      const unlock = () => { A.unlock(); A.setSfx(this.state.settings.sound); A.setMusic(this.state.settings.music); if (this.mode === 'lobby') A.setMusicMode('menu'); };
      root.addEventListener('pointerdown', unlock, { once: false, passive: true });
      root.addEventListener('touchstart', unlock, { once: false, passive: true });

      document.addEventListener('visibilitychange', () => { if (document.hidden) this.onPause(); else this.onResume(); });
      root.addEventListener('pagehide', () => this.flush());
      PF.on('pause', () => this.onPause());
      PF.on('resume', () => this.onResume());
      PF.on('back', () => this.onBack());
      PF.on('banner', () => { if (NH.Lobby.stage) NH.Lobby.stage.resize(); });
      root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.onBack(); });

      setInterval(() => this.flush(), 15000);
      requestAnimationFrame((ts) => this.loop(ts));
      this.load();
    },

    async load() {
      const fill = $('#loading-fill');
      const steps = [];
      steps.push(() => (document.fonts && document.fonts.load ? Promise.race([document.fonts.load('700 20px Fredoka'), new Promise((r) => setTimeout(r, 1500))]) : null));
      steps.push(() => { for (const k in C.ENEMIES) { NH.Sprites.enemy(k, false); NH.Sprites.enemy(k, true); } NH.Sprites.hero(); });
      steps.push(() => { for (const id of C.WEAPON_IDS.concat(C.PASSIVE_IDS, Object.keys(C.EVOLUTIONS))) { NH.Sprites.iconURL(id, 96); NH.Sprites.iconURL(id, 48); } });
      steps.push(() => { for (const id of ['shop', 'gear', 'battle', 'talents', 'events']) NH.Sprites.iconURL(id, 96, true); for (const s of C.SLOTS) NH.Sprites.iconURL(s, 64, true); });
      for (let i = 0; i < steps.length; i++) {
        await steps[i]();
        fill.style.width = ((i + 1) / steps.length * 100) + '%';
        await new Promise((r) => setTimeout(r, 60));
      }
      if (!this.state.tutorial.firstRunDone) {
        $('.loading-text').textContent = t('tapToStart');
        $('.loading-text').classList.add('pulse');
        const go = () => {
          $('#screen-loading').removeEventListener('pointerdown', go);
          A.unlock();
          this.startRun(1, { free: true, tutorial: true });
        };
        $('#screen-loading').addEventListener('pointerdown', go);
      } else {
        this.mode = 'lobby';
        NH.Lobby.open();
        this.checkWelcomeBack();
      }
    },

    applySettings() {
      const st = this.state.settings;
      A.setSfx(st.sound);
      A.setMusic(st.music);
      const q = st.quality === 'high' ? 1 : 0.6;
      if (this.renderer && this.renderer.quality !== q) { this.renderer.quality = q; this.onResize(); }
      if (this.fx) this.fx.quality = q;
      if (this.renderer) this.renderer.showNumbers = st.damageNumbers;
    },

    onResize() {
      if (!this.renderer) return;
      this.renderer.resize(root.innerWidth, root.innerHeight, root.devicePixelRatio || 1);
      if (this.world) this.world.view = this.renderer.viewSize();
      if (NH.Lobby.stage) NH.Lobby.stage.resize();
    },

    // ---------------------------------------------------------- persistence
    persist() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.flush(), 250);
    },
    flush() {
      clearTimeout(this.saveTimer);
      if (!this.state) return;
      this.state.lastSeen = this.now();
      NH.Save.save(this.state);
    },

    resetProgress() {
      NH.Save.wipe();
      this.state = NH.Save.defaults(this.now());
      NH.state = this.state;
      M.ensureDaily(this.state, this.now(), this.rng);
      NH.I18N.set(NH.I18N.detect());
      this.flush();
      UI.closeAll();
      this.startRun(1, { free: true, tutorial: true });
    },

    // ------------------------------------------------------------- run flow
    startRun(chapter, opts) {
      opts = opts || {};
      const s = this.state, now = this.now();
      if (!opts.free && !opts.tutorial) {
        if (!M.spendEnergy(s, now, C.ENERGY.runCost)) {
          A.play('deny');
          UI.toast(t('noEnergy'), 'bad');
          NH.Lobby.energyModal();
          return;
        }
      }
      UI.closeAll();
      const stats = M.heroStats(s);
      this.world = new NH.World({ chapter, stats, seed: (this.rng.next() * 4294967295) >>> 0, view: this.renderer.viewSize(), tutorial: !!opts.tutorial });
      this.fx.clear();
      this.renderer.snap(this.world);
      this.input.reset();
      const w = this.world;
      NH.Juice.bind(w, this.fx, {
        announce: (html, cls, small) => NH.RunUI.announce(html, cls, small),
        onLevelReady: () => NH.RunUI.showLevelUp(),
        onCrate: () => NH.RunUI.showCrate(),
        onDeath: () => setTimeout(() => { if (this.world === w) NH.RunUI.showRevive(); }, 750),
        onVictory: () => setTimeout(() => { if (this.world === w) this.endRun(true); }, 2400),
        onBoss: (e) => NH.RunUI.bossBar(e),
      }, this.renderer);
      NH.RunUI.attach(w, !!opts.tutorial);
      UI.show('screen-game');
      PF.setBanner(false);
      PF.keepScreenOn(true);
      A.setMusicMode('battle');
      this.mode = 'run';
      this.paused = false;
      this.runEnded = false;
      this.acc = 0;
      this.persist();
    },

    pauseRun() {
      if (this.mode !== 'run' || this.paused || !this.world || this.world.state !== 'play') return;
      this.paused = true;
      this.input.reset();
      this.pauseModal = NH.RunUI.showPause();
    },
    resumeRun() {
      this.paused = false;
      this.pauseModal = null;
      this.last = performance.now();
    },
    resumeLoop() { this.last = performance.now(); this.acc = 0; },

    endRun() {
      if (this.runEnded || !this.world) return;
      this.runEnded = true;
      this.paused = true;
      const result = this.world.result();
      const rewards = M.runRewards(this.state, result, this.rng);
      this.mode = 'results';
      this.state.tutorial.firstRunDone = true;
      PF.keepScreenOn(false);
      PF.setBanner(true);
      A.setMusicMode('menu');
      this.flush();
      NH.RunUI.showResults(result, rewards);
    },

    claimRun(result, rewards, mult) {
      const out = M.applyRunRewards(this.state, result, rewards, mult);
      this.flush();
      return out;
    },

    async afterRun(out, result) {
      const s = this.state;
      const prevUnlocked = s.chapter.selected;
      this.world = null;
      this.mode = 'lobby';
      if (result.cleared && s.chapter.unlocked > prevUnlocked && result.chapter === prevUnlocked) {
        s.chapter.selected = s.chapter.unlocked;
        setTimeout(() => UI.toast('🔓 ' + t('newChapter'), 'good'), 300);
      }
      NH.Lobby.tab = 'battle';
      NH.Lobby.open();
      UI.flyRewards(out, document.body);
      UI.levelUps(out.levels);
      if (out.items.length) setTimeout(() => UI.toast(t('hint_gear'), 'good'), 1200);
      this.persist();
      this.scheduleNotifications();
      if (PF.isNative && !s.notifAsked && s.stats.runs >= 1) { s.notifAsked = true; this.persist(); PF.requestNotificationPermission(); }
      else if (M.interstitialAllowed(s, this.now())) {
        s.ads.lastInterstitial = this.now();
        this.persist();
        A.suspend();
        await PF.showInterstitial('run_end');
        A.resume();
      }
      if (result.cleared && result.chapter === 2 && !s.rated) {
        s.rated = true;
        this.persist();
        setTimeout(async () => { if (await UI.confirm(t('rateQ'), '★ ' + t('rateGame'))) PF.rateApp(); }, 1500);
      }
    },

    // ------------------------------------------------------------ lifecycle
    onPause() {
      this.flush();
      if (this.mode === 'run' && !this.paused && this.world && this.world.state === 'play') this.pauseRun();
      A.suspend();
      this.scheduleNotifications();
    },

    onResume() {
      A.resume();
      this.last = performance.now();
      const now = this.now();
      M.updateEnergy(this.state, now);
      if (M.ensureDaily(this.state, now, this.rng)) this.persist();
      if (this.mode === 'lobby') { NH.Lobby.refresh(); this.checkWelcomeBack(); }
    },

    checkWelcomeBack() {
      const s = this.state, now = this.now();
      const p = M.patrolPending(s, now);
      const away = (now - (s.lastSeen || now)) / 1000;
      if (p.seconds >= C.PATROL.offlinePopupSec && away >= C.PATROL.offlinePopupSec && !UI.topModal()) NH.Lobby.welcomeBack(p);
      s.lastSeen = now;
    },

    async onBack() {
      if (UI.back()) return;
      if (this.mode === 'run') { this.pauseRun(); return; }
      if (this.mode === 'lobby' && NH.Lobby.tab !== 'battle') { NH.Lobby.setTab('battle'); return; }
      if (this.mode === 'lobby' || this.mode === 'loading') {
        if (await UI.confirm(t('exitQ'), t('yes'))) { this.flush(); PF.exitApp(); }
      }
    },

    scheduleNotifications() {
      if (!PF.isNative) return;
      const s = this.state, now = this.now();
      const N = C.NOTIFY;
      const remind = (id, sec, title, body) => {
        PF.cancelNotification(id);
        if (sec > 60) PF.scheduleNotification(id, M.notifyDelay(now, sec), t(title), t(body));
      };
      remind(N.goldChest, M.freeGoldIn(s, now), 'notif_gold_t', 'notif_gold_b');
      remind(N.patrolFull, M.patrolFullIn(s, now), 'notif_patrol_t', 'notif_patrol_b');
      remind(N.energyFull, M.energyFullIn(s, now), 'notif_energy_t', 'notif_energy_b');
    },

    // ------------------------------------------------------------------ loop
    loop(ts) {
      requestAnimationFrame((n) => this.loop(n));
      if (!this.last) this.last = ts;
      let dt = (ts - this.last) / 1000;
      this.frame++;
      const saver = this.state && this.state.settings.batterySaver;
      if (saver && this.frame % 2 === 1) return; // ~30 FPS
      this.last = ts;
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) return;

      if ((this.mode === 'run' || this.mode === 'results') && this.world) {
        const w = this.world;
        if (!this.paused) {
          if (this.fx.hitStop > 0) this.fx.hitStop -= dt;
          else {
            this.acc += dt;
            let steps = 0;
            while (this.acc >= C.FIXED_DT && steps < 6) {
              w.input = this.input.read();
              w.update(C.FIXED_DT);
              this.acc -= C.FIXED_DT;
              steps++;
            }
            if (steps >= 6) this.acc = 0;
          }
        }
        if (!this.paused || w.state !== 'play') this.fx.update(dt);
        this.renderer.follow(w, dt);
        this.renderer.render(w, this.fx, dt);
        this.input.draw(this.renderer.ctx, dt);
        NH.RunUI.update(dt);
      } else if (this.mode === 'lobby') {
        if (NH.Lobby.stage && !NH.Lobby.stage.frame(dt)) NH.Lobby.stage = null;
      }

      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = 1;
        const s = this.state;
        if (s) {
          const now = this.now();
          M.updateEnergy(s, now);
          if (M.ensureDaily(s, now, this.rng)) { this.persist(); if (this.mode === 'lobby') NH.Lobby.refresh(); }
          if (this.mode === 'lobby' || UI.topModal()) NH.Lobby.tick();
          if (this.mode === 'run') s.stats.playTime++;
        }
      }
    },
  };

  NH.G = G;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => G.boot());
  else G.boot();
})(window);
