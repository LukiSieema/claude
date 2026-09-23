/* Neon Horde — enemy AI, bosses and enemy bullets. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;
  const TAU = U.TAU;
  const P = NH.World.prototype;

  P.enemyBullet = function (x, y, a, speed, dmg, color, r) {
    const b = this.bullets.get();
    b.x = x; b.y = y; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.dmg = dmg; b.color = color || '#ff3d7f'; b.r = r || 6; b.life = 5;
    return b;
  };

  P.bulletRing = function (x, y, n, speed, dmg, color, offset) {
    for (let i = 0; i < n; i++) this.enemyBullet(x, y, (offset || 0) + (i / n) * TAU, speed, dmg, color, 7);
  };

  P.updateEnemies = function (dt) {
    const h = this.hero;
    const list = this.enemies.active;
    const recycleR = this.spawnRadius() * 1.55;
    const recycleR2 = recycleR * recycleR;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e._alive) continue;
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.touchCd > 0) e.touchCd -= dt;
      if (e.slowT > 0) e.slowT -= dt; else e.slowAmt = 0;
      e.kx = U.damp(e.kx, 0, 7, dt); e.ky = U.damp(e.ky, 0, 7, dt);

      if (e.boss) { this.bossAI(e, dt); }
      else if (e.parent) { this.segmentAI(e, dt); }
      else {
        const dx = h.x - e.x, dy = h.y - e.y;
        const d2 = dx * dx + dy * dy;
        // recycle enemies left far behind: move them ahead of the hero
        if (d2 > recycleR2 && !e.elite) {
          const a = h.moving ? h.facing + (this.rng.next() - 0.5) * 1.2 : this.rng.next() * TAU;
          const R = this.spawnRadius() + 30;
          e.x = h.x + Math.cos(a) * R; e.y = h.y + Math.sin(a) * R;
          continue;
        }
        if (e.freezeT > 0) { e.freezeT -= dt; e.vx = 0; e.vy = 0; }
        else if (e.stunT > 0) { e.stunT -= dt; e.vx = 0; e.vy = 0; }
        else this.enemyAI(e, dt, dx, dy, Math.sqrt(d2) || 1);
        e.x += (e.vx + e.kx) * dt;
        e.y += (e.vy + e.ky) * dt;
        if (this.arena) this.keepOutOfArena(e);
      }

      // separation from neighbours (cheap, local)
      if (!e.boss && !e.parent) {
        const r = e.r;
        this.hash.query(e.x, e.y, r * 2, (o) => {
          if (o === e || !o._alive || o.boss || o.parent) return;
          const dx = e.x - o.x, dy = e.y - o.y;
          const min = r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) return;
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5 * (o.mass / (e.mass + o.mass));
          e.x += dx / d * push; e.y += dy / d * push;
        });
      }

      // contact damage
      const rr = e.r + h.r - 3;
      if (e.touchCd <= 0 && U.dist2(e.x, e.y, h.x, h.y) < rr * rr) {
        e.touchCd = C.HERO.contactCd;
        this.damageHero(e.dmg, e.x, e.y);
      }
    }
  };

  P.keepOutOfArena = function (e) {
    const a = this.arena;
    const d = U.dist(e.x, e.y, a.x, a.y);
    const lim = a.r + e.r + 4;
    if (d < lim && !e.minion) { const k = lim / (d || 1); e.x = a.x + (e.x - a.x) * k; e.y = a.y + (e.y - a.y) * k; }
  };

  P.enemyAI = function (e, dt, dx, dy, d) {
    const def = e.def;
    const slow = e.slowT > 0 ? 1 - e.slowAmt : 1;
    const sp = e.speed * slow;
    const nx = dx / d, ny = dy / d;
    if (def.ranged) {
      const R = def.ranged;
      if (d > R.range) { e.vx = nx * sp; e.vy = ny * sp; }
      else if (d < R.range * 0.65) { e.vx = -nx * sp * 0.7; e.vy = -ny * sp * 0.7; }
      else { e.vx = -ny * sp * 0.45; e.vy = nx * sp * 0.45; }
      e.cd -= dt;
      if (e.cd <= 0 && d < R.range * 1.15) {
        e.cd = R.cd * this.rng.range(0.85, 1.2);
        const a = Math.atan2(dy, dx);
        const dmg = R.dmg * this.chapter.dmg * C.enemyDmgScale(this.t) * (e.elite ? C.ELITE.dmgMult : 1);
        if (e.elite) for (let k = -1; k <= 1; k++) this.enemyBullet(e.x, e.y, a + k * 0.22, R.speed, dmg, def.color);
        else this.enemyBullet(e.x, e.y, a, R.speed, dmg, def.color);
        this.ev.emit('enemyShoot', e);
      }
      return;
    }
    if (def.dash) {
      const D = def.dash;
      e.cd -= dt;
      if (e.st === 0) { // chase
        e.vx = nx * sp; e.vy = ny * sp;
        if (e.cd <= 0 && d < D.range) { e.st = 1; e.stT = 0.4; e.dx = nx; e.dy = ny; }
      } else if (e.st === 1) { // wind-up
        e.vx = U.damp(e.vx, 0, 12, dt); e.vy = U.damp(e.vy, 0, 12, dt);
        e.stT -= dt;
        if (e.stT <= 0) { e.st = 2; e.stT = D.time; this.ev.emit('dash', e); }
      } else { // dash
        e.vx = e.dx * D.speed * slow; e.vy = e.dy * D.speed * slow;
        e.stT -= dt;
        if (e.stT <= 0) { e.st = 0; e.cd = D.cd * this.rng.range(0.8, 1.2); }
      }
      return;
    }
    if (def.explode) {
      e.vx = nx * sp; e.vy = ny * sp;
      if (d < def.explode.trigger) {
        const h = this.hero;
        e._alive = false;
        this.kills++;
        this.dropXp(e.x, e.y, def.xp * e.xpMult);
        if (U.dist(e.x, e.y, h.x, h.y) < def.explode.radius + h.r) this.damageHero(e.dmg, e.x, e.y);
        this.ev.emit('explosion', e.x, e.y, def.explode.radius, def.color, false);
        this.ev.emit('kill', e);
      }
      return;
    }
    // default: chase with a slight wobble so hordes look organic
    const wob = Math.sin(e.age * 3 + e.id) * 0.25;
    e.vx = (nx - ny * wob) * sp;
    e.vy = (ny + nx * wob) * sp;
  };

  // ------------------------------------------------------------------ bosses
  P.bossAI = function (e, dt) {
    const h = this.hero;
    const dx = h.x - e.x, dy = h.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const mk = e.mk || 1;
    const slow = e.slowT > 0 ? 1 - e.slowAmt * 0.5 : 1;
    const bdmg = e.dmg * 0.8;
    e.cd -= dt;
    e.stT -= dt;
    switch (e.boss) {
      case 'titan': {
        e.vx = nx * e.speed * slow; e.vy = ny * e.speed * slow;
        if (e.cd <= 0) {
          e.cd = mk > 1 ? 2.4 : 3.1;
          e.st = (e.st + 1) % 3;
          if (e.st === 2) { e.spiral = mk > 1 ? 5 : 4; e.stT = 0; }
          else this.bulletRing(e.x, e.y, mk > 1 ? 18 : 14, 150, bdmg, e.color, this.rng.next());
          this.ev.emit('bossAttack', e);
        }
        if (e.spiral > 0 && e.stT <= 0) {
          e.spiral--; e.stT = 0.22;
          this.bulletRing(e.x, e.y, 10, 170, bdmg, '#ffb3cf', e.spiral * 0.3);
        }
        break;
      }
      case 'hive': {
        // orbit at a distance
        const want = 210;
        const radial = (d - want) / want;
        e.vx = (nx * radial - ny * 0.8) * e.speed * 1.4 * slow;
        e.vy = (ny * radial + nx * 0.8) * e.speed * 1.4 * slow;
        if (e.cd <= 0) {
          e.st = (e.st + 1) % 2;
          if (e.st === 0) {
            e.cd = 4;
            const n = mk > 1 ? 9 : 6;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU;
              const m = this.spawnEnemy('swarmer', { x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60 });
              m.minion = true;
            }
          } else {
            e.cd = 2.2;
            const a = Math.atan2(dy, dx);
            for (let k = -2; k <= 2; k++) this.enemyBullet(e.x, e.y, a + k * 0.18, 210, bdmg, e.color, 7);
          }
          this.ev.emit('bossAttack', e);
        }
        break;
      }
      case 'serpent': {
        e.age += dt;
        const a = Math.atan2(dy, dx) + Math.sin(e.age * 2.2) * 0.9;
        e.vx = Math.cos(a) * e.speed * slow; e.vy = Math.sin(a) * e.speed * slow;
        e.trail.unshift(e.x, e.y);
        if (e.trail.length > 1200) e.trail.length = 1200;
        if (e.cd <= 0) {
          e.cd = mk > 1 ? 2.6 : 3.4;
          const n = mk > 1 ? 7 : 5;
          const base = Math.atan2(dy, dx);
          for (let k = 0; k < n; k++) this.enemyBullet(e.x, e.y, base + (k - (n - 1) / 2) * 0.2, 190, bdmg, e.color, 7);
          this.ev.emit('bossAttack', e);
        }
        break;
      }
      case 'prism': {
        if (e.st === 0) { // wander
          e.vx = nx * e.speed * slow * (d > 160 ? 1 : -0.5); e.vy = ny * e.speed * slow * (d > 160 ? 1 : -0.5);
          if (e.cd <= 0) { e.st = 1; e.stT = 0.9; e.beamA = this.rng.next() * TAU; this.ev.emit('bossAttack', e); }
        } else if (e.st === 1) { // laser telegraph
          e.vx = 0; e.vy = 0;
          this.prismBeams(e, false);
          if (e.stT <= 0) { e.st = 2; e.stT = mk > 1 ? 2.2 : 1.7; }
        } else if (e.st === 2) { // lasers firing
          e.beamA += (mk > 1 ? 0.8 : 0.6) * dt;
          this.prismBeams(e, true);
          if (e.stT <= 0) { e.st = 3; e.stT = 0.7; }
        } else { // teleport near hero + ring
          e.vx = 0; e.vy = 0;
          if (e.stT <= 0) {
            const a = this.rng.next() * TAU, r = this.rng.range(170, 240);
            e.x = h.x + Math.cos(a) * r; e.y = h.y + Math.sin(a) * r;
            if (this.arena) {
              const ad = U.dist(e.x, e.y, this.arena.x, this.arena.y), lim = this.arena.r - e.r - 10;
              if (ad > lim) { const k = lim / ad; e.x = this.arena.x + (e.x - this.arena.x) * k; e.y = this.arena.y + (e.y - this.arena.y) * k; }
            }
            this.bulletRing(e.x, e.y, mk > 1 ? 16 : 12, 140, bdmg, e.color, this.rng.next());
            this.ev.emit('teleport', e);
            e.st = 0; e.cd = mk > 1 ? 3 : 3.8;
          }
        }
        break;
      }
      case 'king': {
        if (e.st === 0) { // chase
          e.vx = nx * e.speed * slow; e.vy = ny * e.speed * slow;
          if (e.cd <= 0) { e.st = 1; e.stT = 0.65; e.dx = nx; e.dy = ny; this.ev.emit('bossAttack', e); }
        } else if (e.st === 1) { // telegraph dash
          e.vx = U.damp(e.vx, 0, 10, dt); e.vy = U.damp(e.vy, 0, 10, dt);
          if (e.stT <= 0) { e.st = 2; e.stT = 0.7; }
        } else if (e.st === 2) { // dash
          e.vx = e.dx * 540; e.vy = e.dy * 540;
          if (e.stT <= 0) {
            e.st = 3; e.stT = 0.4;
            this.bulletRing(e.x, e.y, mk > 1 ? 22 : 18, 160, bdmg, e.color, this.rng.next());
            this.shake = Math.max(this.shake, 0.5);
          }
        } else { // recover & summon
          e.vx = 0; e.vy = 0;
          if (e.stT <= 0) {
            e.st = 0; e.cd = mk > 1 ? 2.2 : 2.8;
            if (this.rng.chance(0.5)) {
              for (let i = 0; i < (mk > 1 ? 5 : 3); i++) {
                const a = this.rng.next() * TAU;
                const m = this.spawnEnemy('glitchling', { x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70 });
                m.minion = true; m.hp = m.maxHp = m.maxHp * 3; m.r *= 1.2;
              }
            }
          }
        }
        break;
      }
      default: break;
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (this.arena) {
      const a = this.arena, ad = U.dist(e.x, e.y, a.x, a.y), lim = a.r - e.r - 4;
      if (ad > lim) { const k = lim / ad; e.x = a.x + (e.x - a.x) * k; e.y = a.y + (e.y - a.y) * k; }
    }
  };

  P.prismBeams = function (e, live) {
    const n = (e.mk || 1) > 1 ? 4 : 3;
    const len = 520;
    const h = this.hero;
    for (let i = 0; i < n; i++) {
      const a = e.beamA + (i / n) * TAU;
      const x2 = e.x + Math.cos(a) * len, y2 = e.y + Math.sin(a) * len;
      this.beams.push({ kind: live ? 'laser' : 'telegraph', pts: [e.x, e.y, x2, y2], life: 0.02, max: 0.02, color: e.color, width: live ? 10 : 2 });
      if (live) {
        const rr = h.r + 5;
        if (U.segDist2(h.x, h.y, e.x, e.y, x2, y2) < rr * rr) this.damageHero(e.dmg * 0.6, e.x, e.y);
      }
    }
  };

  P.segmentAI = function (s, dt) {
    const head = s.parent;
    if (!head._alive) { s._alive = false; return; }
    const spacing = 9; // trail samples between segments
    const idx = (s.seg + 1) * spacing * 2;
    if (head.trail.length > idx + 1) { s.x = head.trail[idx]; s.y = head.trail[idx + 1]; }
    if (s.flash > 0) s.flash -= dt;
  };

  // ------------------------------------------------------------ enemy bullets
  P.updateBullets = function (dt) {
    const h = this.hero;
    const list = this.bullets.active;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b._alive) continue;
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0) { b._alive = false; continue; }
      const rr = b.r + h.r - 4;
      if (U.dist2(b.x, b.y, h.x, h.y) < rr * rr) {
        b._alive = false;
        this.damageHero(b.dmg, b.x, b.y);
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
