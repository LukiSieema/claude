/* Neon Horde — juicy effects: particles, damage numbers, shock rings, flashes. Render-only. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U;
  const TAU = U.TAU;

  const MAX_PARTICLES = 900;
  const MAX_NUMBERS = 70;

  function FX() {
    this.rng = U.rng(12345);
    this.particles = U.Pool(() => ({}), (p) => {
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0.5; p.max = 0.5; p.size = 4; p.color = '#fff';
      p.drag = 3; p.kind = 'dot'; p.rot = 0; p.vr = 0; p.grav = 0;
    });
    this.numbers = U.Pool(() => ({}), (n) => { n.x = 0; n.y = 0; n.vy = 0; n.life = 0.7; n.max = 0.7; n.text = ''; n.crit = false; n.color = '#fff'; n.scale = 1; });
    this.rings = U.Pool(() => ({}), (r) => { r.x = 0; r.y = 0; r.r0 = 0; r.r1 = 50; r.life = 0.35; r.max = 0.35; r.color = '#fff'; r.width = 4; });
    this.flash = 0;          // red damage vignette
    this.whiteFlash = 0;     // screen white flash (level up, boss)
    this.hitStop = 0;        // seconds of frozen simulation
    this.shake = 0;
    this.quality = 1;
  }

  const P = FX.prototype;

  P.update = function (dt) {
    const ps = this.particles.active;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { p._alive = false; continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles.sweep();
    const ns = this.numbers.active;
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i];
      n.life -= dt;
      if (n.life <= 0) { n._alive = false; continue; }
      n.y += n.vy * dt; n.vy *= Math.exp(-4 * dt);
    }
    this.numbers.sweep();
    const rs = this.rings.active;
    for (let i = 0; i < rs.length; i++) { const r = rs[i]; r.life -= dt; if (r.life <= 0) r._alive = false; }
    this.rings.sweep();
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 3);
    this.shake = Math.max(0, this.shake - dt * 2.8);
  };

  P.budget = function () { return this.particles.count < MAX_PARTICLES * this.quality; };

  P.burst = function (x, y, color, count, speed, size, life) {
    count = Math.round(count * this.quality);
    for (let i = 0; i < count && this.budget(); i++) {
      const p = this.particles.get();
      const a = this.rng.next() * TAU, s = speed * (0.35 + this.rng.next() * 0.8);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.max = (life || 0.45) * (0.6 + this.rng.next() * 0.6);
      p.size = size * (0.6 + this.rng.next() * 0.7);
      p.color = color; p.drag = 4.5; p.kind = 'dot';
    }
  };

  P.shards = function (x, y, color, count, speed) {
    count = Math.round(count * this.quality);
    for (let i = 0; i < count && this.budget(); i++) {
      const p = this.particles.get();
      const a = this.rng.next() * TAU, s = speed * (0.4 + this.rng.next() * 0.9);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.max = 0.5 + this.rng.next() * 0.4;
      p.size = 3 + this.rng.next() * 4; p.color = color; p.drag = 3.5; p.kind = 'shard';
      p.rot = this.rng.next() * TAU; p.vr = (this.rng.next() - 0.5) * 16;
    }
  };

  P.spark = function (x, y, color, angle, count) {
    for (let i = 0; i < count && this.budget(); i++) {
      const p = this.particles.get();
      const a = angle + (this.rng.next() - 0.5) * 1.3, s = 160 + this.rng.next() * 220;
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = p.max = 0.12 + this.rng.next() * 0.12; p.size = 2.2; p.color = color; p.drag = 8; p.kind = 'line';
    }
  };

  P.trail = function (x, y, color, size, life) {
    if (!this.budget()) return;
    const p = this.particles.get();
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.life = p.max = life || 0.25; p.size = size; p.color = color; p.drag = 0; p.kind = 'dot';
  };

  P.ring = function (x, y, r0, r1, color, life, width) {
    const r = this.rings.get();
    r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.color = color; r.life = r.max = life || 0.35; r.width = width || 4;
  };

  P.number = function (x, y, value, crit, color) {
    if (this.numbers.count >= MAX_NUMBERS) return;
    const n = this.numbers.get();
    n.x = x + (this.rng.next() - 0.5) * 14; n.y = y - 10; n.vy = crit ? -95 : -70;
    n.life = n.max = crit ? 0.85 : 0.6;
    n.text = value >= 1000 ? U.fmt(value) : String(Math.max(1, Math.round(value)));
    n.crit = crit; n.color = color || (crit ? '#ffe63d' : '#ffffff'); n.scale = crit ? 1.45 : 1;
  };

  P.text = function (x, y, text, color, scale, life) {
    const n = this.numbers.get();
    n.x = x; n.y = y; n.vy = -50; n.life = n.max = life || 1.1; n.text = text; n.crit = true; n.color = color; n.scale = scale || 1.3;
  };

  P.clear = function () {
    this.particles.clear(); this.numbers.clear(); this.rings.clear();
    this.flash = 0; this.whiteFlash = 0; this.hitStop = 0; this.shake = 0;
  };

  NH.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
