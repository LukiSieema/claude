/* Neon Horde — animated synthwave chapter preview for the Battle tab (sun, perspective grid, floating boss). */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;
  const TAU = U.TAU;

  function StageAnim(canvas, chapter) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ch = chapter;
    this.def = C.CHAPTERS[chapter - 1];
    this.t = 0;
    this.locked = chapter > NH.G.state.chapter.unlocked;
    this.stars = [];
    const r = U.rng(chapter * 77);
    for (let i = 0; i < 60; i++) this.stars.push([r.next(), r.next() * 0.5, r.range(0.5, 1.8), r.next() * 6]);
    this.resize();
  }

  StageAnim.prototype.resize = function () {
    const rect = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    this.w = Math.max(1, rect.width); this.h = Math.max(1, rect.height);
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.dpr = dpr;
  };

  StageAnim.prototype.frame = function (dt) {
    if (!this.cv.isConnected) return false;
    this.t += dt;
    const ctx = this.ctx, w = this.w, h = this.h, pal = this.def.palette;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const horizon = h * 0.58;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, pal.bg);
    sky.addColorStop(1, pal.bg2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);
    // stars
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 2 + s[3]));
      ctx.fillRect(s[0] * w, s[1] * h, s[2], s[2]);
    }
    ctx.globalAlpha = 1;
    // sun with stripes
    const sr = Math.min(w, h) * 0.3;
    const sx = w / 2, sy = horizon - sr * 0.15;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, horizon); ctx.clip();
    const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sun.addColorStop(0, '#ffe9a8');
    sun.addColorStop(0.45, pal.accent);
    sun.addColorStop(1, U.mixHex(pal.accent, '#3a0b4a', 0.6));
    ctx.shadowColor = pal.accent; ctx.shadowBlur = 40;
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = pal.bg2;
    for (let i = 0; i < 7; i++) {
      const yy = sy + sr * (0.05 + i * 0.13) + ((this.t * 8) % (sr * 0.13));
      ctx.fillRect(sx - sr, yy, sr * 2, 2 + i * 1.3);
    }
    ctx.restore();
    // ground
    const gr = ctx.createLinearGradient(0, horizon, 0, h);
    gr.addColorStop(0, U.mixHex(pal.bg2, '#000', 0.2));
    gr.addColorStop(1, pal.bg);
    ctx.fillStyle = gr;
    ctx.fillRect(0, horizon, w, h - horizon);
    // perspective grid
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
      ctx.moveTo(w / 2 + i * 6, horizon);
      ctx.lineTo(w / 2 + i * w * 0.18, h);
    }
    const speed = (this.t * 0.6) % 1;
    for (let i = 0; i < 12; i++) {
      const z = (i + speed) / 12;
      const y = horizon + (h - horizon) * z * z;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // horizon glow line
    ctx.shadowColor = pal.accent; ctx.shadowBlur = 16;
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
    ctx.shadowBlur = 0;
    // boss silhouette hovering in front of the sun
    this.drawBoss(ctx, sx, sy - sr * 0.25 + Math.sin(this.t * 1.6) * 6, sr * 0.55);
    if (this.locked) {
      ctx.fillStyle = 'rgba(8,6,26,0.55)';
      ctx.fillRect(0, 0, w, h);
    }
    // soft top/bottom fade into the page
    const fade = ctx.createLinearGradient(0, h - 50, 0, h);
    fade.addColorStop(0, 'rgba(13,11,36,0)'); fade.addColorStop(1, 'rgba(13,11,36,1)');
    ctx.fillStyle = fade; ctx.fillRect(0, h - 50, w, 50);
    return true;
  };

  StageAnim.prototype.drawBoss = function (ctx, x, y, r) {
    const def = C.BOSSES[this.def.boss];
    const col = def.color;
    const t = this.t;
    const sides = { titan: 6, hive: 5, serpent: 4, prism: 4, king: 8 }[this.def.boss] || 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = col; ctx.shadowBlur = 24;
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.save(); ctx.rotate(t * 0.5);
    ctx.beginPath();
    for (let i = 0; i < sides * 2; i++) {
      const a = (i / (sides * 2)) * TAU, rr = r * (i % 2 ? 1.1 : 1.28);
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = U.mixHex(col, '#150b2e', 0.6);
    ctx.lineWidth = 4;
    ctx.save(); ctx.rotate(-t * 0.3);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3 * (1 + Math.sin(t * 4) * 0.08), 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.25, r * 0.14, 0, TAU); ctx.arc(r * 0.4, -r * 0.25, r * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b0b3a';
    ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.2, r * 0.07, 0, TAU); ctx.arc(r * 0.4, -r * 0.2, r * 0.07, 0, TAU); ctx.fill();
    if (this.def.mk) {
      ctx.fillStyle = '#ffc83d'; ctx.font = '700 ' + Math.round(r * 0.38) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MK II', 0, r * 1.62);
    }
    ctx.restore();
  };

  NH.StageAnim = StageAnim;
})(typeof window !== 'undefined' ? window : globalThis);
