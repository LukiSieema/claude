/* Neon Horde — Canvas 2D renderer for a running World. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C, S = NH.Sprites;
  const TAU = U.TAU;

  function Renderer(canvas) {
    this.canvas = canvas;
    // No `desynchronized`: that path bypasses the page compositor and left the canvas black in the Android WebView.
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.w = 1; this.h = 1; this.dpr = 1; this.scale = 1;
    this.cam = { x: 0, y: 0 };
    this.bg = null;
    this.bgKey = '';
    this.stars = [];
    const r = U.rng(99);
    for (let i = 0; i < 70; i++) this.stars.push({ x: r.range(0, 900), y: r.range(0, 900), s: r.range(0.6, 2.2), a: r.range(0.2, 0.8) });
    this.time = 0;
    this.quality = 1;
    this.showNumbers = true;
  }

  const P = Renderer.prototype;

  P.resize = function (w, h, dpr) {
    this.w = w; this.h = h;
    this.dpr = Math.min(dpr || 1, this.quality >= 1 ? 2.5 : 1.5);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w, h) / C.VIEW_WIDTH;
    S.init(this.dpr, this.scale);
    this.bgKey = '';
  };

  P.viewSize = function () { return { w: this.w / this.scale, h: this.h / this.scale }; };

  P.buildBackground = function (pal) {
    const key = pal.bg + pal.bg2 + this.w + 'x' + this.h;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w / 2)); c.height = Math.max(1, Math.round(this.h / 2));
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(c.width / 2, c.height * 0.45, 10, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.8);
    g.addColorStop(0, pal.bg2);
    g.addColorStop(1, pal.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    this.bg = c;
  };

  P.follow = function (world, dt) {
    const h = world.hero;
    const tx = h.x + h.vx * 0.22, ty = h.y + h.vy * 0.22;
    this.cam.x = U.damp(this.cam.x, tx, 6, dt);
    this.cam.y = U.damp(this.cam.y, ty, 6, dt);
  };

  P.snap = function (world) { this.cam.x = world.hero.x; this.cam.y = world.hero.y; };

  P.inView = function (x, y, r) {
    const hw = this.w / this.scale / 2 + r + 20, hh = this.h / this.scale / 2 + r + 20;
    return Math.abs(x - this.cam.x) < hw && Math.abs(y - this.cam.y) < hh;
  };

  P.draw = function (ctx, sp, x, y, rot, scale, alpha) {
    const sz = sp.size * (scale || 1);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    if (rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(sp.c, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    } else ctx.drawImage(sp.c, x - sz / 2, y - sz / 2, sz, sz);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  };

  P.render = function (world, fx, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const pal = world.chapter.palette;
    this.buildBackground(pal);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);

    const shake = Math.max(fx.shake, world.shake) * 9;
    const sx = shake ? (fx.rng.next() - 0.5) * shake : 0, sy = shake ? (fx.rng.next() - 0.5) * shake : 0;

    // parallax star dust (screen space)
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      const px = ((s.x - this.cam.x * 0.35 * this.scale) % 900 + 900) % 900;
      const py = ((s.y - this.cam.y * 0.35 * this.scale) % 900 + 900) % 900;
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(this.time * 2 + s.x));
      for (let ox = px - 900; ox < this.w; ox += 900) for (let oy = py - 900; oy < this.h; oy += 900) if (ox >= -2 && oy >= -2) ctx.fillRect(ox, oy, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.w / 2 + sx, this.h / 2 + sy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawGrid(ctx, pal);
    if (world.arena) this.drawArena(ctx, world, pal);
    this.drawZones(ctx, world);
    this.drawPickups(ctx, world);
    this.drawEnemies(ctx, world);
    this.drawProjectiles(ctx, world, fx);
    this.drawHero(ctx, world, fx);
    this.drawBullets(ctx, world);
    this.drawBeams(ctx, world);
    this.drawParticles(ctx, fx);
    this.drawNumbers(ctx, fx);
    ctx.restore();

    this.drawIndicators(ctx, world);
    this.drawOverlays(ctx, world, fx);
  };

  P.drawGrid = function (ctx, pal) {
    const G = 80;
    const hw = this.w / this.scale / 2 + G, hh = this.h / this.scale / 2 + G;
    const x0 = Math.floor((this.cam.x - hw) / G) * G, x1 = this.cam.x + hw;
    const y0 = Math.floor((this.cam.y - hh) / G) * G, y1 = this.cam.y + hh;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.grid;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let x = x0; x < x1; x += G) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y < y1; y += G) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    // brighter major lines with a travelling pulse
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.time * 1.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.accent;
    ctx.beginPath();
    const M = G * 5;
    for (let x = Math.floor(x0 / M) * M; x < x1; x += M) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = Math.floor(y0 / M) * M; y < y1; y += M) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.globalAlpha *= 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  P.drawArena = function (ctx, world, pal) {
    const a = world.arena;
    a.t = (a.t || 0) + 0.016;
    const grow = U.clamp(a.t / 0.8, 0, 1);
    const r = a.r * (1.6 - 0.6 * U.easeOutCubic(grow));
    // darken outside
    ctx.save();
    ctx.fillStyle = 'rgba(5,3,15,0.55)';
    ctx.beginPath();
    ctx.rect(this.cam.x - 2000, this.cam.y - 2000, 4000, 4000);
    ctx.arc(a.x, a.y, r, 0, TAU, true);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = pal.accent; ctx.shadowBlur = 20;
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 5;
    ctx.setLineDash([26, 14]);
    ctx.lineDashOffset = -this.time * 60;
    ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.4; ctx.lineWidth = 14; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(a.x, a.y, r + 9, 0, TAU); ctx.stroke();
    ctx.restore();
  };

  P.drawZones = function (ctx, world) {
    const list = world.zones.active;
    if (!list.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const z of list) {
      if (!this.inView(z.x, z.y, z.r)) continue;
      const k = z.life / z.maxLife;
      const fade = Math.min(1, k * 4) * Math.min(1, (1 - k) * 8 + 0.2);
      const flick = z.kind === 'fire' ? 0.85 + 0.15 * Math.sin(this.time * 24 + z.x) : 1;
      const sp = S.glow(z.color || '#ff8a3d', 32);
      const scale = (z.r * 2.3) / sp.size;
      this.draw(ctx, sp, z.x, z.y, 0, scale * flick, 0.5 * fade);
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = z.color || '#ff8a3d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * flick, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  P.drawPickups = function (ctx, world) {
    const list = world.pickups.active;
    for (const g of list) {
      if (!this.inView(g.x, g.y, 20)) continue;
      const bob = Math.sin(this.time * 4 + g.x * 0.1) * 1.5;
      if (g.kind === 'xp') {
        let tier = C.GEM_TIERS[0];
        for (const t of C.GEM_TIERS) if (g.value >= t.min) tier = t;
        this.draw(ctx, S.gem(tier.color, tier.r), g.x, g.y + bob);
      } else if (g.kind === 'crate') {
        // light beam
        ctx.globalCompositeOperation = 'lighter';
        const beam = ctx.createLinearGradient(g.x, g.y - 120, g.x, g.y);
        beam.addColorStop(0, 'rgba(255,200,61,0)');
        beam.addColorStop(1, 'rgba(255,200,61,0.35)');
        ctx.fillStyle = beam;
        ctx.fillRect(g.x - 12, g.y - 120, 24, 120);
        ctx.globalCompositeOperation = 'source-over';
        this.draw(ctx, S.pickup('crate'), g.x, g.y + bob * 2, Math.sin(this.time * 3) * 0.08, 1 + Math.sin(this.time * 6) * 0.05);
      } else {
        this.draw(ctx, S.pickup(g.kind), g.x, g.y + bob, 0, 1 + Math.sin(this.time * 5) * 0.08);
      }
    }
  };

  P.drawEnemies = function (ctx, world) {
    const list = world.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e._alive || !this.inView(e.x, e.y, e.r + 10)) continue;
      if (e.boss) { this.drawBoss(ctx, e, world); continue; }
      if (e.parent) { this.drawSegment(ctx, e); continue; }
      let sp = S.enemy(e.type, e.elite);
      if (e.flash > 0) sp = S.white(sp);
      const spawnK = U.clamp(e.age / 0.25, 0, 1);
      const squash = e.def.dash && e.st === 1 ? 1 + Math.sin(this.time * 40) * 0.08 : 1;
      const rot = e.def.shape === 'tri' || e.def.shape === 'diamond' ? Math.sin(e.age * 2 + e.id) * 0.25 : e.age * e.spin * 0.3;
      this.draw(ctx, sp, e.x, e.y, rot, U.easeOutBack(spawnK) * squash);
      if (e.freezeT > 0 || e.slowT > 0) {
        ctx.globalAlpha = e.freezeT > 0 ? 0.55 : 0.25;
        ctx.fillStyle = '#bff6ff';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.05, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.def.dash && e.st === 1) {
        ctx.strokeStyle = U.rgba(e.color, 0.5); ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.dx * 260, e.y + e.dy * 260); ctx.stroke(); ctx.setLineDash([]);
      }
      if (e.elite) this.hpBar(ctx, e.x, e.y - e.r - 12, e.r * 2, e.hp / e.maxHp, '#ffc83d');
    }
  };

  P.hpBar = function (ctx, x, y, w, k, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * U.clamp(k, 0, 1), 4);
  };

  P.drawBoss = function (ctx, e, world) {
    const t = this.time;
    const col = e.color;
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    // aura
    ctx.globalCompositeOperation = 'lighter';
    this.draw(ctx, S.glow(col, 40), 0, 0, 0, (e.r * 3.2) / 80 * (1 + Math.sin(t * 3) * 0.06), 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.lineJoin = 'round';
    const body = flash ? U.mixHex(col, '#ffffff', 0.45) : U.mixHex(col, '#150b2e', 0.55);
    const stroke = flash ? U.mixHex(col, '#ffffff', 0.6) : col;
    const sides = { titan: 6, hive: 5, serpent: 4, prism: 4, king: 8 }[e.boss] || 6;
    // rotating outer ring
    ctx.strokeStyle = stroke; ctx.lineWidth = 3;
    ctx.save(); ctx.rotate(t * 0.8);
    ctx.beginPath();
    for (let i = 0; i < sides * 2; i++) {
      const a = (i / (sides * 2)) * TAU, r = e.r * (i % 2 ? 1.18 : 1.32);
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    // body
    ctx.fillStyle = body; ctx.strokeStyle = stroke; ctx.lineWidth = 4;
    ctx.save(); ctx.rotate(-t * 0.4);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r); else ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // core
    ctx.shadowBlur = 24;
    ctx.fillStyle = flash ? U.mixHex(col, '#ffffff', 0.6) : col;
    const pulse = 1 + Math.sin(t * 6) * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.34 * pulse, 0, TAU); ctx.fill();
    // eyes looking at the hero
    const la = Math.atan2(world.hero.y - e.y, world.hero.x - e.x);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    const ex = e.r * 0.42, ey = -e.r * 0.25;
    ctx.beginPath(); ctx.arc(-ex, ey, e.r * 0.16, 0, TAU); ctx.arc(ex, ey, e.r * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b0b3a';
    ctx.beginPath();
    ctx.arc(-ex + Math.cos(la) * 3, ey + Math.sin(la) * 3, e.r * 0.08, 0, TAU);
    ctx.arc(ex + Math.cos(la) * 3, ey + Math.sin(la) * 3, e.r * 0.08, 0, TAU);
    ctx.fill();
    if (e.boss === 'king') {
      ctx.fillStyle = flash ? '#fff' : '#ffc83d';
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.6, -e.r * 0.75); ctx.lineTo(-e.r * 0.45, -e.r * 1.25); ctx.lineTo(-e.r * 0.2, -e.r * 0.9);
      ctx.lineTo(0, -e.r * 1.35); ctx.lineTo(e.r * 0.2, -e.r * 0.9); ctx.lineTo(e.r * 0.45, -e.r * 1.25); ctx.lineTo(e.r * 0.6, -e.r * 0.75);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // dash telegraph for the king
    if (e.boss === 'king' && e.st === 1) {
      ctx.strokeStyle = U.rgba(col, 0.6); ctx.lineWidth = e.r * 1.2; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.dx * 380, e.y + e.dy * 380); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  P.drawSegment = function (ctx, s) {
    const col = s.flash > 0 ? '#ffffff' : s.color;
    ctx.save();
    ctx.shadowColor = s.color; ctx.shadowBlur = 14;
    ctx.fillStyle = U.mixHex(s.color, '#150b2e', 0.5);
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  };

  P.drawProjectiles = function (ctx, world, fx) {
    const list = world.projectiles.active;
    if (!list.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of list) {
      if (!p._alive || !this.inView(p.x, p.y, 30)) continue;
      switch (p.kind) {
        case 'bolt':
          this.draw(ctx, S.bolt(p.color, p.evo ? 26 : 20, p.evo ? 5 : 4), p.x, p.y, p.angle, p.r / 5);
          break;
        case 'bomb': {
          const z = p.z || 0;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 6, 3, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          this.draw(ctx, S.glow(p.color, 10), p.x, p.y - z, 0, 1.2);
          if (fx.rng.next() < 0.5) fx.trail(p.x, p.y - z, p.color, 3, 0.25);
          break;
        }
        case 'missile':
          this.draw(ctx, S.rocket(p.color, 12), p.x, p.y, p.angle);
          fx.trail(p.x - Math.cos(p.angle) * 6, p.y - Math.sin(p.angle) * 6, p.color, 2.5, 0.18);
          break;
        case 'rocket':
          this.draw(ctx, S.rocket(p.color, p.evo ? 22 : 18), p.x, p.y, p.angle);
          fx.trail(p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, '#ffb35c', 4, 0.3);
          break;
        case 'disc':
          this.draw(ctx, S.disc(p.color, 11), p.x, p.y, p.spin, p.r / 11);
          break;
        default: break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  P.drawHero = function (ctx, world, fx) {
    const h = world.hero;
    // orbit blades & drones
    for (const w of world.weapons) {
      if (w.id === 'orbit' && w.blades && (w.active > 0 || w.evolved || world.wstats(w).duration === 0)) {
        ctx.globalCompositeOperation = 'lighter';
        const col = w.evolved ? C.EVOLUTIONS.singularity.color : C.WEAPONS.orbit.color;
        const bs = S.blade(col, w.evolved ? 16 : 12);
        for (const b of w.blades) this.draw(ctx, bs, b.x, b.y, b.a + Math.PI / 2, world.mod.area);
        if (w.evolved) {
          ctx.strokeStyle = U.rgba(col, 0.25); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(h.x, h.y, world.wstats(w).radius * world.mod.area, 0, TAU); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (w.id === 'drone') {
        const col = w.evolved ? C.EVOLUTIONS.swarm.color : C.WEAPONS.drone.color;
        for (const d of w.drones) this.draw(ctx, S.drone(col), d.x, d.y, d.a);
      }
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(h.x, h.y + h.r * 0.9, h.r * 0.9, h.r * 0.35, 0, 0, TAU); ctx.fill();
    // thruster trail
    if (h.moving && fx.rng.next() < 0.8) fx.trail(h.x - Math.cos(h.facing) * h.r, h.y - Math.sin(h.facing) * h.r, '#2ef2ff', 5, 0.3);
    const blink = h.invuln > 0.2 && Math.floor(this.time * 20) % 2 === 0;
    const bob = Math.sin(this.time * 8) * (h.moving ? 1.2 : 0.6);
    this.draw(ctx, S.hero(), h.x, h.y + bob, h.facing, 1 + (h.moving ? 0.03 * Math.sin(this.time * 16) : 0), blink ? 0.4 : 1);
    // HP bar under hero
    const k = h.hp / h.maxHp;
    const col = k > 0.5 ? '#7dff5a' : k > 0.25 ? '#ffe63d' : '#ff4d6d';
    this.hpBar(ctx, h.x, h.y + h.r + 10, 34, k, col);
    // pickup radius hint (subtle)
    ctx.strokeStyle = 'rgba(46,242,255,0.07)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, world.mod.pickup, 0, TAU); ctx.stroke();
  };

  P.drawBullets = function (ctx, world) {
    const list = world.bullets.active;
    if (!list.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of list) {
      if (!b._alive || !this.inView(b.x, b.y, 12)) continue;
      this.draw(ctx, S.glow(b.color, 12), b.x, b.y, 0, (b.r * 2.4) / 24);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    for (const b of list) {
      if (!b._alive || !this.inView(b.x, b.y, 12)) continue;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
    }
  };

  P.drawBeams = function (ctx, world) {
    if (!world.beams.length) return;
    ctx.globalCompositeOperation = 'lighter';
    const r = U.rng((this.time * 1000) | 0);
    for (const b of world.beams) {
      const k = b.max > 0 ? b.life / b.max : 1;
      if (b.kind === 'lightning') {
        ctx.save();
        ctx.shadowColor = b.color; ctx.shadowBlur = 16;
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width * (0.6 + k * 0.6); ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.beginPath();
        const pts = b.pts;
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
          const segs = 4;
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const jx = s === segs ? 0 : r.range(-10, 10), jy = s === segs ? 0 : r.range(-10, 10);
            ctx.lineTo(U.lerp(x0, x1, t) + jx, U.lerp(y0, y1, t) + jy);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      } else if (b.kind === 'laser') {
        ctx.save();
        ctx.shadowColor = b.color; ctx.shadowBlur = 20;
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width + Math.sin(this.time * 60) * 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(b.pts[0], b.pts[1]); ctx.lineTo(b.pts[2], b.pts[3]); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.width * 0.35; ctx.stroke();
        ctx.restore();
      } else if (b.kind === 'telegraph') {
        ctx.save();
        ctx.strokeStyle = b.color; ctx.globalAlpha = 0.45 + 0.35 * Math.sin(this.time * 30); ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(b.pts[0], b.pts[1]); ctx.lineTo(b.pts[2], b.pts[3]); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  P.drawParticles = function (ctx, fx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of fx.particles.active) {
      if (!this.inView(p.x, p.y, 10)) continue;
      const k = p.life / p.max;
      if (p.kind === 'dot') {
        const sp = S.glow(p.color, 8);
        this.draw(ctx, sp, p.x, p.y, 0, (p.size * (0.4 + k * 0.8)) / 8, k);
      } else if (p.kind === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = k; ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'line') {
        ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of fx.rings.active) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k * 0.7);
      ctx.beginPath(); ctx.arc(r.x, r.y, U.lerp(r.r0, r.r1, U.easeOutCubic(k)), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  P.drawNumbers = function (ctx, fx) {
    if (!this.showNumbers && !fx.numbers.active.some((n) => n.scale > 1.4)) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const n of fx.numbers.active) {
      if (!this.showNumbers && n.scale <= 1.45 && /^\d/.test(n.text)) continue;
      const k = n.life / n.max;
      const pop = k > 0.8 ? U.easeOutBack((1 - k) / 0.2) : 1;
      const size = 13 * n.scale * pop;
      ctx.font = '700 ' + size.toFixed(1) + 'px Fredoka, system-ui, sans-serif';
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(12,6,30,0.9)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  };

  /** Arrows at screen edges pointing to off-screen elites, crates and the boss. */
  P.drawIndicators = function (ctx, world) {
    const targets = [];
    for (const e of world.enemies.active) if (e._alive && (e.elite || e.boss)) targets.push([e.x, e.y, e.boss ? e.color : '#ffc83d']);
    for (const g of world.pickups.active) if (g.kind === 'crate') targets.push([g.x, g.y, '#ffc83d']);
    if (!targets.length) return;
    const cx = this.w / 2, cy = this.h / 2;
    const m = 26;
    for (const [x, y, col] of targets) {
      const sx = cx + (x - this.cam.x) * this.scale, sy = cy + (y - this.cam.y) * this.scale;
      if (sx > 0 && sx < this.w && sy > 0 && sy < this.h) continue;
      const a = Math.atan2(sy - cy, sx - cx);
      const kx = (cx - m) / Math.abs(Math.cos(a) || 1e-6), ky = (cy - m - 60) / Math.abs(Math.sin(a) || 1e-6);
      const d = Math.min(kx, ky);
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(a);
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.time * 8);
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  P.drawOverlays = function (ctx, world, fx) {
    const h = world.hero;
    const low = h.hp / h.maxHp < 0.3 ? (0.35 + 0.2 * Math.sin(this.time * 6)) : 0;
    const red = Math.max(fx.flash * 0.7, low);
    if (red > 0.01) {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, 'rgba(255,40,80,0)');
      g.addColorStop(1, 'rgba(255,40,80,' + red.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (fx.whiteFlash > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + (fx.whiteFlash * 0.6).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.w, this.h);
    }
  };

  NH.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
