/* Neon Horde — floating one-finger joystick (touch/mouse) + keyboard for desktop testing. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U;

  function Input(el) {
    this.el = el;
    this.active = false;
    this.id = null;
    this.bx = 0; this.by = 0; this.kx = 0; this.ky = 0;
    this.radius = 58;
    this.vec = { x: 0, y: 0 };
    this.keys = {};
    this.enabled = true;
    this.touchedOnce = false;
    this.fade = 0;

    const down = (e) => {
      if (!this.enabled || this.active) return;
      const p = this.point(e);
      if (!p) return;
      this.active = true;
      this.id = p.id;
      this.bx = this.kx = p.x; this.by = this.ky = p.y;
      this.touchedOnce = true;
      if (e.cancelable) e.preventDefault();
    };
    const move = (e) => {
      if (!this.active) return;
      const p = this.point(e, this.id);
      if (!p) return;
      let dx = p.x - this.bx, dy = p.y - this.by;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) {
        // drag the base along so direction changes stay responsive
        const over = d - this.radius;
        this.bx += dx / d * over; this.by += dy / d * over;
        dx = p.x - this.bx; dy = p.y - this.by;
      }
      this.kx = this.bx + dx; this.ky = this.by + dy;
      if (e.cancelable) e.preventDefault();
    };
    const up = (e) => {
      if (!this.active) return;
      if (e.changedTouches) {
        let found = false;
        for (const t of e.changedTouches) if (t.identifier === this.id) found = true;
        if (!found) return;
      }
      this.active = false;
      this.id = null;
    };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.active = false; });
  }

  Input.prototype.point = function (e, id) {
    if (e.touches) {
      const list = e.type === 'touchstart' ? e.changedTouches : e.touches;
      for (const t of list) if (id === null || id === undefined || t.identifier === id) return { x: t.clientX, y: t.clientY, id: t.identifier };
      return null;
    }
    return { x: e.clientX, y: e.clientY, id: 'mouse' };
  };

  Input.prototype.reset = function () { this.active = false; this.id = null; this.vec.x = 0; this.vec.y = 0; };

  Input.prototype.read = function () {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    if (x || y) { const l = Math.hypot(x, y); this.vec.x = x / l; this.vec.y = y / l; return this.vec; }
    if (this.active) {
      const dx = this.kx - this.bx, dy = this.ky - this.by;
      const d = Math.hypot(dx, dy);
      const dead = 6;
      if (d < dead) { this.vec.x = 0; this.vec.y = 0; }
      else { const m = U.clamp((d - dead) / (this.radius * 0.7), 0, 1); this.vec.x = dx / d * m; this.vec.y = dy / d * m; }
    } else { this.vec.x = 0; this.vec.y = 0; }
    return this.vec;
  };

  /** Screen-space joystick drawing (called after the world render). */
  Input.prototype.draw = function (ctx, dt) {
    this.fade = U.approach(this.fade, this.active ? 1 : 0, dt * 8);
    if (this.fade <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = this.fade;
    ctx.strokeStyle = 'rgba(46,242,255,0.55)';
    ctx.fillStyle = 'rgba(46,242,255,0.08)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.bx, this.by, this.radius, 0, U.TAU); ctx.fill(); ctx.stroke();
    ctx.shadowColor = '#2ef2ff'; ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(46,242,255,0.85)';
    ctx.beginPath(); ctx.arc(this.kx, this.ky, 24, 0, U.TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(this.kx - 6, this.ky - 7, 6, 0, U.TAU); ctx.fill();
    ctx.restore();
  };

  NH.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);
