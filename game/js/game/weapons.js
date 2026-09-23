/* Neon Horde — weapon behaviours, hero projectiles and damage zones. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;
  const TAU = U.TAU;
  const P = NH.World.prototype;

  const AIM_RANGE = 440;

  P.updateWeapons = function (dt) {
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      switch (w.id) {
        case 'blaster': this.wBlaster(w, dt); break;
        case 'orbit': this.wOrbit(w, dt); break;
        case 'lightning': this.wLightning(w, dt); break;
        case 'firebomb': this.wFirebomb(w, dt); break;
        case 'drone': this.wDrone(w, dt); break;
        case 'disc': this.wDisc(w, dt); break;
        case 'frost': this.wFrost(w, dt); break;
        case 'rocket': this.wRocket(w, dt); break;
        default: break;
      }
    }
  };

  P.baseDmg = function (s) { return this.mod.atk * s.dmg; };

  // ---------------------------------------------------------------- blaster
  P.wBlaster = function (w, dt) {
    const s = this.wstats(w), h = this.hero;
    if (w.burst > 0) {
      w.burstT -= dt;
      if (w.burstT <= 0) {
        w.burstT = w.evolved ? 0.035 : 0.07;
        w.burst--;
        const tgt = this.nearestEnemy(h.x, h.y, AIM_RANGE);
        const aim = tgt ? Math.atan2(tgt.y - h.y, tgt.x - h.x) : w.burstAim;
        const spread = w.evolved ? (this.rng.next() - 0.5) * 0.22 : (this.rng.next() - 0.5) * 0.08;
        this.fireBolt(h.x, h.y, aim + spread, s, w);
      }
      return;
    }
    w.timer -= dt;
    if (w.timer > 0) return;
    const tgt = this.nearestEnemy(h.x, h.y, AIM_RANGE);
    if (!tgt) { w.timer = 0.1; return; }
    w.timer = s.cd * this.mod.cd;
    w.burstAim = Math.atan2(tgt.y - h.y, tgt.x - h.x);
    w.burst = s.count + this.extraProj(w);
    w.burstT = 0;
    this.ev.emit('shoot', 'blaster');
  };

  P.fireBolt = function (x, y, a, s, w) {
    const p = this.projectiles.get();
    p.kind = 'bolt'; p.x = x + Math.cos(a) * 16; p.y = y + Math.sin(a) * 16;
    p.vx = Math.cos(a) * s.speed; p.vy = Math.sin(a) * s.speed;
    p.r = 5 * s.size * this.mod.area; p.dmg = this.baseDmg(s); p.pierce = s.pierce; p.life = 1.1;
    p.angle = a; p.wi = w.wi; p.evo = w.evolved;
    p.color = w.evolved ? C.EVOLUTIONS.photon.color : C.WEAPONS.blaster.color;
  };

  // ------------------------------------------------------------------ orbit
  P.wOrbit = function (w, dt) {
    const s = this.wstats(w), h = this.hero;
    const permanent = w.evolved || s.duration === 0;
    if (!permanent) {
      if (w.active > 0) { w.active -= dt; if (w.active <= 0) w.timer = s.cd * this.mod.cd; }
      else { w.timer -= dt; if (w.timer <= 0) { w.active = s.duration * this.mod.dur; this.ev.emit('shoot', 'orbit'); } return; }
    }
    w.angle += s.rot * dt;
    const count = s.count + this.extraProj(w);
    const R = s.radius * this.mod.area;
    const bladeR = (w.evolved ? 16 : 12) * this.mod.area;
    const dmg = this.baseDmg(s);
    w.blades = w.blades || [];
    w.blades.length = count;
    for (let i = 0; i < count; i++) {
      const a = w.angle + (i / count) * TAU;
      const bx = h.x + Math.cos(a) * R, by = h.y + Math.sin(a) * R;
      w.blades[i] = { x: bx, y: by, a };
      this.hash.query(bx, by, bladeR + 60, (e) => {
        if (!e._alive || e.wcd[w.wi] > this.t) return;
        const rr = e.r + bladeR;
        if (U.dist2(e.x, e.y, bx, by) > rr * rr) return;
        e.wcd[w.wi] = this.t + 0.35;
        const ka = Math.atan2(e.y - h.y, e.x - h.x);
        this.damageEnemy(e, dmg, Math.cos(ka), Math.sin(ka), w.evolved ? 260 : 160);
      });
    }
    if (w.evolved) {
      // singularity pull: drag nearby enemies towards the ring
      const pullR = R + 90;
      this.hash.query(h.x, h.y, pullR, (e) => {
        if (!e._alive || e.boss || e.parent) return;
        const d = U.dist(e.x, e.y, h.x, h.y);
        if (d > R + 20 && d < pullR) { e.x += (h.x - e.x) / d * 40 * dt; e.y += (h.y - e.y) / d * 40 * dt; }
      });
    }
  };

  // -------------------------------------------------------------- lightning
  P.wLightning = function (w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const s = this.wstats(w), h = this.hero;
    const first = this.randomEnemyNear(h.x, h.y, 380);
    if (!first) { w.timer = 0.2; return; }
    w.timer = s.cd * this.mod.cd;
    const strikes = s.strikes + this.extraProj(w);
    const dmg = this.baseDmg(s);
    for (let k = 0; k < strikes; k++) {
      let cur = k === 0 ? first : this.randomEnemyNear(h.x, h.y, 380);
      if (!cur) break;
      const pts = [cur.x, cur.y - 420];
      const hit = [];
      for (let c = 0; c <= s.chains && cur; c++) {
        pts.push(cur.x, cur.y);
        hit.push(cur);
        this.damageEnemy(cur, dmg * (c === 0 ? 1 : 0.85), 0, 0, 0);
        if (s.stun) cur.stunT = Math.max(cur.stunT, s.stun);
        let next = null, bd = s.jump * s.jump;
        const from = cur;
        this.hash.query(from.x, from.y, s.jump, (e) => {
          if (!e._alive || hit.includes(e)) return;
          const d = U.dist2(e.x, e.y, from.x, from.y);
          if (d < bd) { bd = d; next = e; }
        });
        cur = next;
      }
      this.beams.push({ kind: 'lightning', pts, life: 0.22, max: 0.22, color: w.evolved ? C.EVOLUTIONS.thunder.color : C.WEAPONS.lightning.color, width: w.evolved ? 4 : 2.5 });
    }
    this.ev.emit('shoot', 'lightning');
  };

  // --------------------------------------------------------------- firebomb
  P.wFirebomb = function (w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const s = this.wstats(w), h = this.hero;
    w.timer = s.cd * this.mod.cd;
    const count = s.count + this.extraProj(w);
    for (let i = 0; i < count; i++) {
      const tgt = this.randomEnemyNear(h.x, h.y, 300);
      let tx, ty;
      if (tgt) { tx = tgt.x + this.rng.range(-20, 20); ty = tgt.y + this.rng.range(-20, 20); }
      else { const a = this.rng.next() * TAU, d = this.rng.range(80, 200); tx = h.x + Math.cos(a) * d; ty = h.y + Math.sin(a) * d; }
      const p = this.projectiles.get();
      p.kind = 'bomb'; p.sx = h.x; p.sy = h.y; p.x = h.x; p.y = h.y; p.tx = tx; p.ty = ty;
      p.dur = 0.55 + i * 0.06; p.t = 0; p.life = 5; p.pierce = 999; p.r = 7;
      p.radius = s.radius * this.mod.area; p.dmg = this.baseDmg(s); p.range = s.duration * this.mod.dur;
      p.wi = w.wi; p.evo = w.evolved; p.color = w.evolved ? C.EVOLUTIONS.inferno.color : C.WEAPONS.firebomb.color;
    }
    this.ev.emit('shoot', 'firebomb');
  };

  // ------------------------------------------------------------------ drone
  P.wDrone = function (w, dt) {
    const s = this.wstats(w), h = this.hero;
    const count = s.count + this.extraProj(w);
    while (w.drones.length < count) w.drones.push({ x: h.x, y: h.y, timer: 0.3 + w.drones.length * 0.25, a: 0 });
    w.drones.length = count;
    w.phase += dt * 1.6;
    for (let i = 0; i < count; i++) {
      const d = w.drones[i];
      const a = w.phase + (i / count) * TAU;
      const tx = h.x + Math.cos(a) * 46, ty = h.y + Math.sin(a) * 46 - 8;
      d.x = U.damp(d.x, tx, 10, dt); d.y = U.damp(d.y, ty, 10, dt);
      d.timer -= dt;
      if (d.timer > 0) continue;
      const tgt = this.nearestEnemy(d.x, d.y, 400);
      if (!tgt) { d.timer = 0.2; continue; }
      d.timer = s.cd * this.mod.cd;
      d.a = Math.atan2(tgt.y - d.y, tgt.x - d.x);
      const p = this.projectiles.get();
      p.kind = 'missile'; p.x = d.x; p.y = d.y; p.angle = d.a; p.speed = 380;
      p.vx = Math.cos(d.a) * p.speed; p.vy = Math.sin(d.a) * p.speed;
      p.r = 5; p.target = tgt; p.life = 2; p.pierce = 1;
      p.radius = s.radius * this.mod.area; p.dmg = this.baseDmg(s);
      p.wi = w.wi; p.evo = w.evolved; p.color = w.evolved ? C.EVOLUTIONS.swarm.color : C.WEAPONS.drone.color;
      this.ev.emit('shoot', 'drone');
    }
  };

  // ------------------------------------------------------------------- disc
  P.wDisc = function (w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const s = this.wstats(w), h = this.hero;
    const first = this.nearestEnemy(h.x, h.y, AIM_RANGE);
    if (!first && !w.evolved) { w.timer = 0.15; return; }
    w.timer = s.cd * this.mod.cd;
    const count = s.count + this.extraProj(w);
    const base = first ? Math.atan2(first.y - h.y, first.x - h.x) : this.rng.next() * TAU;
    for (let i = 0; i < count; i++) {
      const a = w.evolved ? base + (i / count) * TAU : base + (i - (count - 1) / 2) * 0.45;
      const p = this.projectiles.get();
      p.kind = 'disc'; p.x = h.x; p.y = h.y; p.angle = a; p.speed = s.speed; p.range = s.range * this.mod.area;
      p.vx = Math.cos(a) * s.speed; p.vy = Math.sin(a) * s.speed;
      p.r = 11 * s.size * this.mod.area; p.dmg = this.baseDmg(s); p.pierce = 999; p.life = 4; p.state = 0; p.t = 0;
      p.wi = w.wi; p.evo = w.evolved; p.color = w.evolved ? C.EVOLUTIONS.chakram.color : C.WEAPONS.disc.color;
    }
    this.ev.emit('shoot', 'disc');
  };

  // ------------------------------------------------------------------ frost
  P.wFrost = function (w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const s = this.wstats(w), h = this.hero;
    w.timer = s.cd * this.mod.cd;
    const R = s.radius * this.mod.area;
    const dmg = this.baseDmg(s);
    this.hash.query(h.x, h.y, R + 40, (e) => {
      if (!e._alive) return;
      const rr = R + e.r;
      if (U.dist2(e.x, e.y, h.x, h.y) > rr * rr) return;
      e.slowT = s.slowDur * this.mod.dur; e.slowAmt = s.slow;
      if (s.freeze && !e.boss) e.freezeT = Math.max(e.freezeT, s.freeze);
      const a = Math.atan2(e.y - h.y, e.x - h.x);
      this.damageEnemy(e, dmg, Math.cos(a), Math.sin(a), 120);
    });
    if (w.evolved) {
      const z = this.zones.get();
      z.kind = 'frost'; z.x = h.x; z.y = h.y; z.r = R * 0.8; z.life = z.maxLife = 3 * this.mod.dur;
      z.tick = 0; z.dmg = dmg * 0.25; z.slow = 0.6; z.color = C.EVOLUTIONS.absolute.color;
    }
    this.ev.emit('nova', h.x, h.y, R, w.evolved ? C.EVOLUTIONS.absolute.color : C.WEAPONS.frost.color);
    this.ev.emit('shoot', 'frost');
  };

  // ----------------------------------------------------------------- rocket
  P.wRocket = function (w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const s = this.wstats(w), h = this.hero;
    const tgt = this.boss && this.boss._alive ? this.boss : this.toughestEnemyNear(h.x, h.y, 460);
    if (!tgt) { w.timer = 0.2; return; }
    w.timer = s.cd * this.mod.cd;
    const count = s.count + this.extraProj(w);
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(tgt.y - h.y, tgt.x - h.x) + (i - (count - 1) / 2) * 0.5;
      const p = this.projectiles.get();
      p.kind = 'rocket'; p.x = h.x; p.y = h.y; p.angle = a + this.rng.range(-0.3, 0.3); p.speed = s.speed;
      p.vx = Math.cos(p.angle) * 140; p.vy = Math.sin(p.angle) * 140;
      p.r = 7; p.target = i === 0 ? tgt : (this.randomEnemyNear(h.x, h.y, 460) || tgt); p.life = 3; p.pierce = 1;
      p.radius = s.radius * this.mod.area; p.dmg = this.baseDmg(s); p.t = 0;
      p.wi = w.wi; p.evo = w.evolved; p.color = w.evolved ? C.EVOLUTIONS.nuke.color : C.WEAPONS.rocket.color;
    }
    this.ev.emit('shoot', 'rocket');
  };

  // ------------------------------------------------------- projectile update
  P.explode = function (x, y, radius, dmg, color, big) {
    this.hash.query(x, y, radius + 60, (e) => {
      if (!e._alive) return;
      const rr = radius + e.r;
      const d2 = U.dist2(e.x, e.y, x, y);
      if (d2 > rr * rr) return;
      const a = Math.atan2(e.y - y, e.x - x);
      this.damageEnemy(e, dmg, Math.cos(a), Math.sin(a), 220);
    });
    this.shake = Math.max(this.shake, big ? 0.55 : 0.22);
    this.ev.emit('explosion', x, y, radius, color, big);
  };

  P.projHitTest = function (p, onHit) {
    this.hash.query(p.x, p.y, p.r + 60, (e) => {
      if (!e._alive) return false;
      const rr = p.r + e.r;
      if (U.dist2(e.x, e.y, p.x, p.y) > rr * rr) return false;
      return onHit(e) === true;
    });
  };

  P.updateProjectiles = function (dt) {
    const list = this.projectiles.active;
    const h = this.hero;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p._alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p._alive = false; continue; }
      switch (p.kind) {
        case 'bolt': {
          p.x += p.vx * dt; p.y += p.vy * dt;
          this.projHitTest(p, (e) => {
            if (p.hits.includes(e.id)) return false;
            p.hits.push(e.id);
            this.damageEnemy(e, p.dmg, Math.cos(p.angle), Math.sin(p.angle), 90);
            if (p.hits.length >= p.pierce) { p._alive = false; return true; }
            return false;
          });
          break;
        }
        case 'bomb': {
          p.t += dt;
          const k = Math.min(1, p.t / p.dur);
          p.x = U.lerp(p.sx, p.tx, k); p.y = U.lerp(p.sy, p.ty, k);
          p.z = Math.sin(k * Math.PI) * 60;
          if (k >= 1) {
            p._alive = false;
            const z = this.zones.get();
            z.kind = 'fire'; z.x = p.tx; z.y = p.ty; z.r = p.radius; z.life = z.maxLife = p.range;
            z.tick = 0; z.dmg = p.dmg; z.color = p.color; z.evo = p.evo;
            this.ev.emit('explosion', p.tx, p.ty, p.radius * 0.6, p.color, false);
          }
          break;
        }
        case 'missile':
        case 'rocket': {
          p.t += dt;
          if (!p.target || !p.target._alive) p.target = this.nearestEnemy(p.x, p.y, 380);
          const sp = p.kind === 'rocket' ? Math.min(p.speed, 140 + p.t * 900) : p.speed;
          if (p.target) {
            const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            const turn = (p.kind === 'rocket' ? 5 : 7) * dt;
            p.angle += U.clamp(U.wrapAngle(want - p.angle), -turn, turn);
          }
          p.vx = Math.cos(p.angle) * sp; p.vy = Math.sin(p.angle) * sp;
          p.x += p.vx * dt; p.y += p.vy * dt;
          let boom = p.life <= 0.05;
          this.projHitTest(p, () => { boom = true; return true; });
          if (boom) {
            p._alive = false;
            this.explode(p.x, p.y, p.radius, p.dmg, p.color, p.kind === 'rocket');
          }
          break;
        }
        case 'disc': {
          p.t += dt;
          if (p.evo) {
            // chakram: spiral outwards then home back
            p.angle += 3.2 * dt;
            const rad = p.state === 0 ? Math.min(p.range, p.t * p.speed * 0.6) : Math.max(0, p.range - (p.t - p.dur) * p.speed * 0.9);
            if (p.state === 0 && rad >= p.range) { p.state = 1; p.dur = p.t; }
            p.x = h.x + Math.cos(p.angle) * rad; p.y = h.y + Math.sin(p.angle) * rad;
            if (p.state === 1 && rad <= 4) p._alive = false;
          } else {
            if (p.state === 0) {
              p.range -= p.speed * dt;
              if (p.range <= 0) p.state = 1;
            } else {
              const a = Math.atan2(h.y - p.y, h.x - p.x);
              p.vx = U.damp(p.vx, Math.cos(a) * p.speed * 1.15, 6, dt);
              p.vy = U.damp(p.vy, Math.sin(a) * p.speed * 1.15, 6, dt);
              if (U.dist2(p.x, p.y, h.x, h.y) < 20 * 20) p._alive = false;
            }
            p.x += p.vx * dt; p.y += p.vy * dt;
          }
          p.spin += dt * 18;
          this.projHitTest(p, (e) => {
            if (e.wcd[p.wi] > this.t) return false;
            e.wcd[p.wi] = this.t + 0.3;
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            this.damageEnemy(e, p.dmg, Math.cos(a), Math.sin(a), 140);
            return false;
          });
          break;
        }
        default: p._alive = false;
      }
    }
  };

  P.updateZones = function (dt) {
    const list = this.zones.active;
    for (let i = 0; i < list.length; i++) {
      const z = list[i];
      if (!z._alive) continue;
      z.life -= dt;
      if (z.life <= 0) { z._alive = false; continue; }
      z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick = z.kind === 'fire' ? 0.35 : 0.5;
      this.hash.query(z.x, z.y, z.r + 40, (e) => {
        if (!e._alive) return;
        const rr = z.r + e.r * 0.5;
        if (U.dist2(e.x, e.y, z.x, z.y) > rr * rr) return;
        if (z.kind === 'frost') { e.slowT = Math.max(e.slowT, 0.6); e.slowAmt = Math.max(e.slowAmt, z.slow); }
        this.damageEnemy(e, z.dmg, 0, 0, 0, z.kind === 'frost');
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
