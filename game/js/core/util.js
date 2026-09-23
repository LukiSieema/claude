/* Neon Horde — shared helpers (math, RNG, formatting, pools). Works in browser and Node. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};

  const TAU = Math.PI * 2;

  const U = {
    TAU,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    dist2: (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    wrapAngle: (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; },
    approach: (v, target, delta) => (v < target ? Math.min(v + delta, target) : Math.max(v - delta, target)),
    // frame-rate independent exponential smoothing
    damp: (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt),

    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    easeOutElastic: (t) => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,

    /** Seeded PRNG (mulberry32). */
    rng(seed) {
      let s = (seed >>> 0) || 1;
      const next = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return {
        next,
        range: (a, b) => a + (b - a) * next(),
        int: (a, b) => Math.floor(a + (b - a + 1) * next()),
        chance: (p) => next() < p,
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        weighted(entries) {
          // entries: [[value, weight], ...]
          let total = 0;
          for (const e of entries) total += e[1];
          let r = next() * total;
          for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
          return entries[entries.length - 1][0];
        },
        shuffle(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
          }
          return arr;
        },
        get state() { return s; },
        set state(v) { s = v >>> 0; },
      };
    },

    /** Compact number: 999, 1.2K, 34.5M, 1.00B, 12.3T, then aa, ab ... */
    fmt(n) {
      if (!isFinite(n)) return '∞';
      const neg = n < 0; n = Math.abs(n);
      let out;
      if (n < 1000) out = n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
      else {
        const units = ['K', 'M', 'B', 'T'];
        let i = -1;
        while (n >= 1000 && i < 3) { n /= 1000; i++; }
        if (n >= 1000) {
          let j = 0;
          while (n >= 1000) { n /= 1000; j++; }
          const a = String.fromCharCode(97 + Math.floor((j - 1) / 26)), b = String.fromCharCode(97 + ((j - 1) % 26));
          out = (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + a + b;
        } else out = (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + units[i];
      }
      return (neg ? '-' : '') + out;
    },

    /** mm:ss or h:mm:ss */
    fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      const pad = (x) => (x < 10 ? '0' : '') + x;
      return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
    },

    /** "2h 05m" style for long timers */
    fmtDuration(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
      if (m > 0) return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
      return s + 's';
    },

    dayKey(ts) {
      const d = new Date(ts);
      return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    },

    deepClone: (o) => JSON.parse(JSON.stringify(o)),

    /** Deep-merge `src` defaults into `dst` for missing keys (used by save migrations). */
    fillDefaults(dst, src) {
      for (const k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        const sv = src[k];
        if (dst[k] === undefined) dst[k] = (sv && typeof sv === 'object') ? JSON.parse(JSON.stringify(sv)) : sv;
        else if (sv && typeof sv === 'object' && !Array.isArray(sv) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) U.fillDefaults(dst[k], sv);
      }
      return dst;
    },

    /** Simple object pool with swap-remove active list. */
    Pool(factory, reset) {
      const free = [];
      const active = [];
      return {
        active,
        get() {
          const o = free.length ? free.pop() : factory();
          reset(o);
          o._alive = true;
          active.push(o);
          return o;
        },
        /** Removes dead objects (o._alive === false) from the active list. */
        sweep() {
          let w = 0;
          for (let i = 0; i < active.length; i++) {
            const o = active[i];
            if (o._alive) active[w++] = o; else free.push(o);
          }
          active.length = w;
        },
        clear() {
          for (const o of active) { o._alive = false; free.push(o); }
          active.length = 0;
        },
        get count() { return active.length; },
      };
    },

    /** Uniform grid for broad-phase collision queries. */
    SpatialHash(cell) {
      const map = new Map();
      const inv = 1 / cell;
      const key = (cx, cy) => ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
      const lists = [];
      let used = 0;
      return {
        clear() { map.clear(); used = 0; },
        insert(o) {
          const k = key(Math.floor(o.x * inv), Math.floor(o.y * inv));
          let l = map.get(k);
          if (!l) {
            l = lists[used] || (lists[used] = []);
            used++;
            l.length = 0;
            map.set(k, l);
          }
          l.push(o);
        },
        /** Calls fn(o) for objects in cells overlapping the circle; fn returning true stops the query. */
        query(x, y, r, fn) {
          const x0 = Math.floor((x - r) * inv), x1 = Math.floor((x + r) * inv);
          const y0 = Math.floor((y - r) * inv), y1 = Math.floor((y + r) * inv);
          for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
              const l = map.get(key(cx, cy));
              if (!l) continue;
              for (let i = 0; i < l.length; i++) if (fn(l[i]) === true) return true;
            }
          }
          return false;
        },
      };
    },

    /** Minimal event emitter */
    Emitter() {
      const handlers = {};
      return {
        on(ev, fn) { (handlers[ev] || (handlers[ev] = [])).push(fn); return () => this.off(ev, fn); },
        off(ev, fn) { const l = handlers[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
        emit(ev, a, b, c, d, e) { const l = handlers[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c, d, e); },
      };
    },

    /** Distance from point to segment, squared. */
    segDist2(px, py, ax, ay, bx, by) {
      const abx = bx - ax, aby = by - ay;
      const len2 = abx * abx + aby * aby;
      let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ax + abx * t - px, dy = ay + aby * t - py;
      return dx * dx + dy * dy;
    },

    hexToRgb(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgba(hex, a) { const c = U.hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; },
    mixHex(a, b, t) {
      const ca = U.hexToRgb(a), cb = U.hexToRgb(b);
      const r = Math.round(U.lerp(ca[0], cb[0], t)), g = Math.round(U.lerp(ca[1], cb[1], t)), bl = Math.round(U.lerp(ca[2], cb[2], t));
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
    },
  };

  NH.U = U;
  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
