/* Neon Horde — "game feel": turns world events into particles, sounds, haptics, hit-stop and shake. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const C = NH.C, A = NH.Audio, PF = NH.Platform;

  const Juice = {
    /** hooks: { announce(text, cls, small), onLevelReady(), onCrate(), onDeath(), onVictory(), onBoss(e) } */
    bind(world, fx, hooks, renderer) {
      const ev = world.ev;
      let hitSound = 0;

      ev.on('hit', (e, dmg, crit) => {
        if (renderer.showNumbers || crit) {
          if (crit || e.boss || e.elite || fx.rng.next() < 0.55) fx.number(e.x, e.y - e.r, dmg, crit);
        }
        if (fx.rng.next() < 0.35) fx.spark(e.x, e.y, e.color, fx.rng.next() * Math.PI * 2, 2);
        if (crit) A.play('crit'); else if (++hitSound % 2 === 0) A.play('hit');
        if (e.boss) { fx.hitStop = Math.max(fx.hitStop, crit ? 0.035 : 0.015); }
      });

      ev.on('kill', (e) => {
        const big = e.elite || e.def.mass >= 2;
        fx.burst(e.x, e.y, e.color, big ? 22 : 9, big ? 260 : 170, big ? 6 : 4.5, big ? 0.6 : 0.4);
        fx.shards(e.x, e.y, e.color, big ? 10 : 4, big ? 240 : 150);
        if (big) fx.ring(e.x, e.y, e.r, e.r * 3, e.color, 0.35, 4);
        A.play('kill');
        if (e.elite) {
          fx.shake = Math.max(fx.shake, 0.6);
          fx.hitStop = Math.max(fx.hitStop, 0.08);
          PF.haptic('medium');
          fx.text(e.x, e.y - 30, '★', '#ffc83d', 2, 1);
        }
      });

      ev.on('explosion', (x, y, r, color, big) => {
        fx.ring(x, y, r * 0.2, r * 1.1, color, big ? 0.45 : 0.3, big ? 7 : 4);
        fx.burst(x, y, color, big ? 26 : 12, r * 3.2, big ? 7 : 5, 0.45);
        fx.burst(x, y, '#ffffff', big ? 6 : 3, r * 2, 5, 0.25);
        A.play('explosion', big);
        if (big) { fx.shake = Math.max(fx.shake, 0.35); PF.haptic('light'); }
      });

      ev.on('nova', (x, y, r, color) => {
        fx.ring(x, y, 10, r, color, 0.45, 8);
        fx.ring(x, y, 10, r * 0.7, '#ffffff', 0.3, 3);
        fx.burst(x, y, color, 16, r * 2.4, 4, 0.5);
      });

      ev.on('shoot', (id) => A.play(id));

      ev.on('pickup', (kind, value, x, y) => {
        switch (kind) {
          case 'xp': A.play('gem'); break;
          case 'coin': A.play('coin'); fx.text(x, y - 12, '+' + value, '#ffc83d', 0.9, 0.6); break;
          case 'heart': A.play('heal'); fx.burst(x, y, '#7dff5a', 18, 180, 5, 0.6); PF.haptic('light'); break;
          case 'magnet': A.play('pickup'); fx.ring(world.hero.x, world.hero.y, 10, 420, '#ff4d6d', 0.6, 6); break;
          case 'bomb':
            A.play('explosion', true);
            fx.whiteFlash = 1; fx.shake = 1.2; PF.haptic('heavy');
            fx.ring(world.hero.x, world.hero.y, 10, 600, '#ff8a3d', 0.7, 14);
            break;
          case 'crate': A.play('pickup'); break;
          default: break;
        }
      });

      ev.on('levelup', () => {
        A.play('levelup');
        fx.ring(world.hero.x, world.hero.y, 8, 140, '#2ef2ff', 0.5, 6);
        fx.burst(world.hero.x, world.hero.y, '#2ef2ff', 24, 260, 5, 0.6);
        fx.whiteFlash = Math.max(fx.whiteFlash, 0.35);
        PF.haptic('medium');
      });
      ev.on('levelupReady', () => hooks.onLevelReady());
      ev.on('crateReady', () => hooks.onCrate());

      ev.on('heroHit', (dmg, sx, sy) => {
        fx.flash = Math.min(1, fx.flash + 0.55);
        fx.shake = Math.max(fx.shake, 0.3);
        fx.number(world.hero.x, world.hero.y - 20, dmg, false, '#ff6b8f');
        A.play('heroHit');
        PF.haptic('light');
      });
      ev.on('heal', (amt) => { fx.number(world.hero.x, world.hero.y - 24, amt, false, '#7dff5a'); });

      ev.on('upgrade', (c) => {
        fx.burst(world.hero.x, world.hero.y, c.kind === 'passive' ? '#ffc83d' : '#2ef2ff', 14, 200, 4, 0.5);
      });

      ev.on('evolve', () => {
        A.play('evolve');
        fx.whiteFlash = 1;
        fx.ring(world.hero.x, world.hero.y, 10, 380, '#ffc83d', 0.8, 10);
        fx.burst(world.hero.x, world.hero.y, '#ffc83d', 50, 420, 6, 0.9);
        PF.haptic('heavy');
      });

      ev.on('eliteSpawn', () => { A.play('eliteSpawn'); hooks.announce(NH.t('eliteIncoming'), 'gold', true); });
      ev.on('waveEvent', (type) => hooks.announce(NH.t('wave_' + type), 'warn', true));
      ev.on('bossWarning', () => {
        A.play('bossWarning');
        hooks.announce(NH.t('warning') + '<br><span class="a-small">' + NH.t('bossIncoming') + '</span>', 'warn');
        PF.haptic('heavy');
      });
      ev.on('bossSpawn', (e) => {
        A.play('bossSpawn');
        A.setMusicMode('boss');
        fx.whiteFlash = 1;
        fx.shake = 1.4;
        fx.ring(e.x, e.y, 10, 500, e.color, 0.8, 12);
        PF.haptic('heavy');
        hooks.onBoss(e);
      });
      ev.on('bossAttack', (e) => { A.play('bossAttack'); fx.ring(e.x, e.y, e.r, e.r * 2, e.color, 0.3, 4); });
      ev.on('teleport', (e) => { fx.burst(e.x, e.y, e.color, 30, 300, 6, 0.5); fx.ring(e.x, e.y, 10, 120, e.color, 0.4, 6); });
      ev.on('dash', () => A.play('dash'));
      ev.on('bossDead', (e) => {
        fx.hitStop = 0.35;
        fx.whiteFlash = 1;
        fx.shake = 2;
        for (let i = 0; i < 4; i++) fx.ring(e.x, e.y, 10 + i * 20, 300 + i * 120, i % 2 ? '#ffffff' : e.color, 0.8 + i * 0.15, 10);
        fx.burst(e.x, e.y, e.color, 90, 520, 8, 1.2);
        fx.shards(e.x, e.y, '#ffffff', 30, 420);
        A.play('explosion', true);
        PF.haptic('heavy');
      });
      ev.on('victory', () => { A.play('victory'); hooks.onVictory(); });
      ev.on('death', () => {
        A.play('death');
        fx.flash = 1;
        fx.shake = 1;
        fx.burst(world.hero.x, world.hero.y, '#2ef2ff', 40, 300, 6, 0.9);
        PF.haptic('heavy');
        hooks.onDeath();
      });
      ev.on('revive', () => {
        A.play('revive');
        fx.whiteFlash = 1;
        fx.ring(world.hero.x, world.hero.y, 10, 260, '#7dff5a', 0.6, 10);
        fx.burst(world.hero.x, world.hero.y, '#7dff5a', 40, 360, 6, 0.8);
      });
    },
  };

  NH.Juice = Juice;
})(typeof window !== 'undefined' ? window : globalThis);
