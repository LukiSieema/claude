/* Neon Horde — procedural neon sprites, pre-rendered with glow into offscreen canvases (cached). */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;
  const TAU = U.TAU;

  const cache = new Map();
  let dpr = 1;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    return c;
  }

  /** Creates (or returns cached) sprite. draw(ctx, size) draws centred at 0,0 in world units. */
  function sprite(key, worldSize, draw, glow) {
    let s = cache.get(key);
    if (s) return s;
    const pad = glow ? 14 : 4;
    const px = Math.ceil((worldSize + pad * 2) * dpr * NH.Sprites.scale);
    const c = canvas(px, px);
    const ctx = c.getContext('2d');
    const k = px / (worldSize + pad * 2);
    ctx.translate(px / 2, px / 2);
    ctx.scale(k, k);
    draw(ctx, worldSize);
    s = { c, size: worldSize + pad * 2, key };
    cache.set(key, s);
    return s;
  }

  /** White silhouette of a sprite (hit flash). */
  function whiteOf(sp) {
    const key = sp.key + ':white';
    let s = cache.get(key);
    if (s) return s;
    const c = canvas(sp.c.width, sp.c.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(sp.c, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    s = { c, size: sp.size, key };
    cache.set(key, s);
    return s;
  }

  function glowStroke(ctx, color, width, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  function poly(ctx, n, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function shapePath(ctx, shape, r) {
    switch (shape) {
      case 'tri': poly(ctx, 3, r * 1.1, -Math.PI / 2); break;
      case 'square': ctx.beginPath(); ctx.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.25); break;
      case 'hex': poly(ctx, 6, r, 0); break;
      case 'diamond': poly(ctx, 4, r * 1.15, -Math.PI / 2); break;
      case 'pent': poly(ctx, 5, r * 1.05, -Math.PI / 2); break;
      case 'bomb':
      case 'dot':
      default: ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); break;
    }
  }

  function drawEyes(ctx, r, color) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    const ex = r * 0.32, ey = -r * 0.05, er = Math.max(1.6, r * 0.17);
    ctx.beginPath(); ctx.arc(-ex, ey, er, 0, TAU); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-ex, ey + er * 0.25, er * 0.5, 0, TAU); ctx.arc(ex, ey + er * 0.25, er * 0.5, 0, TAU); ctx.fill();
  }

  const Sprites = {
    scale: 1,

    init(devicePixelRatio, worldScale) {
      const next = Math.min(2.5, devicePixelRatio || 1);
      if (next !== dpr || worldScale !== this.scale) cache.clear();
      dpr = next;
      this.scale = worldScale;
    },

    enemy(type, elite) {
      const def = C.ENEMIES[type];
      const r = def.r * (elite ? C.ELITE.sizeMult : 1);
      return sprite('enemy:' + type + (elite ? ':e' : ''), r * 2 + 6, (ctx) => {
        const col = def.color;
        if (elite) {
          ctx.save();
          glowStroke(ctx, '#ffc83d', 2.5, 14);
          ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        shapePath(ctx, def.shape, r);
        ctx.fillStyle = U.rgba(col, 0.28);
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.fill();
        glowStroke(ctx, col, def.shape === 'dot' ? 2 : 3, 12);
        ctx.stroke();
        // inner accent
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.55;
        shapePath(ctx, def.shape, r * 0.55);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1;
        if (def.shape === 'bomb') {
          ctx.strokeStyle = '#ffe9c2'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.2, -r * 1.7); ctx.stroke();
        }
        drawEyes(ctx, r, col);
      }, true);
    },

    hero() {
      const r = C.HERO.radius;
      return sprite('hero', r * 2 + 12, (ctx) => {
        const col = '#2ef2ff';
        // body
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r);
        g.addColorStop(0, '#e9fdff');
        g.addColorStop(0.35, '#6ff8ff');
        g.addColorStop(1, '#0a8fb0');
        ctx.shadowColor = col; ctx.shadowBlur = 22;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        glowStroke(ctx, '#ffffff', 2, 10);
        ctx.stroke();
        // visor (faces +x, rotated at draw time)
        ctx.shadowBlur = 8; ctx.shadowColor = '#ff3df2';
        ctx.fillStyle = '#1b0b3a';
        ctx.beginPath(); ctx.ellipse(r * 0.35, 0, r * 0.42, r * 0.62, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff5df5';
        ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.18, r * 0.16, r * 0.1, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.2, r * 0.16, r * 0.1, 0, 0, TAU); ctx.fill();
      }, true);
    },

    /** Soft round glow used for particles, bullets, zone fills. */
    glow(color, r) {
      r = r || 8;
      return sprite('glow:' + color + ':' + r, r * 2, (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.25, color);
        g.addColorStop(1, U.rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      }, false);
    },

    bolt(color, len, w) {
      return sprite('bolt:' + color + ':' + len + ':' + w, len + 8, (ctx) => {
        glowStroke(ctx, color, w, 10);
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.45;
        ctx.beginPath(); ctx.moveTo(-len / 2 + 3, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
      }, true);
    },

    blade(color, r) {
      return sprite('blade:' + color + ':' + r, r * 2.4, (ctx) => {
        ctx.shadowColor = color; ctx.shadowBlur = 14;
        ctx.fillStyle = U.rgba(color, 0.5);
        ctx.beginPath();
        ctx.moveTo(r * 1.1, 0);
        ctx.quadraticCurveTo(0, r * 0.9, -r * 0.8, r * 0.2);
        ctx.quadraticCurveTo(-r * 0.2, 0, -r * 0.8, -r * 0.2);
        ctx.quadraticCurveTo(0, -r * 0.9, r * 1.1, 0);
        ctx.fill();
        glowStroke(ctx, '#ffffff', 1.5, 6); ctx.stroke();
      }, true);
    },

    disc(color, r) {
      return sprite('disc:' + color + ':' + r, r * 2.2, (ctx) => {
        ctx.shadowColor = color; ctx.shadowBlur = 14;
        for (let i = 0; i < 4; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 2);
          ctx.fillStyle = U.rgba(color, 0.85);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.9, -r * 0.2, r, r * 0.35); ctx.quadraticCurveTo(r * 0.3, r * 0.2, 0, 0); ctx.fill();
          ctx.restore();
        }
        glowStroke(ctx, '#ffffff', 1.5, 6);
        ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.stroke();
      }, true);
    },

    rocket(color, len) {
      return sprite('rocket:' + color + ':' + len, len + 6, (ctx) => {
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(len / 2, 0); ctx.lineTo(-len / 4, len * 0.22); ctx.lineTo(-len / 2, len * 0.3); ctx.lineTo(-len / 2.6, 0);
        ctx.lineTo(-len / 2, -len * 0.3); ctx.lineTo(-len / 4, -len * 0.22); ctx.closePath();
        ctx.fill();
        glowStroke(ctx, color, 2, 10); ctx.stroke();
      }, true);
    },

    drone(color) {
      return sprite('drone:' + color, 26, (ctx) => {
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#132a1a';
        poly(ctx, 3, 9, 0); ctx.fill();
        glowStroke(ctx, color, 2, 10); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(2, 0, 2.6, 0, TAU); ctx.fill();
      }, true);
    },

    gem(color, r) {
      return sprite('gem:' + color + ':' + r, r * 2.4, (ctx) => {
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.35, -r * 0.1); ctx.lineTo(-r * 0.3, -r * 0.1); ctx.closePath(); ctx.fill();
      }, true);
    },

    pickup(kind) {
      return sprite('pickup:' + kind, kind === 'crate' ? 40 : 24, (ctx) => {
        switch (kind) {
          case 'coin': {
            ctx.shadowColor = '#ffc83d'; ctx.shadowBlur = 12;
            ctx.fillStyle = '#ffc83d'; poly(ctx, 6, 8, Math.PI / 6); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = '#a86a00'; poly(ctx, 6, 5, Math.PI / 6); ctx.fill();
            ctx.fillStyle = '#fff3c4'; ctx.fillRect(-1.2, -3.5, 2.4, 7);
            break;
          }
          case 'heart': {
            ctx.shadowColor = '#ff4d8a'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff4d8a';
            ctx.beginPath(); ctx.moveTo(0, 8);
            ctx.bezierCurveTo(-12, -1, -6, -11, 0, -4); ctx.bezierCurveTo(6, -11, 12, -1, 0, 8); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-3.5, -3, 1.8, 0, TAU); ctx.fill();
            break;
          }
          case 'magnet': {
            glowStroke(ctx, '#ff4d6d', 4.5, 12);
            ctx.lineCap = 'butt';
            ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0, true); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-7, -6); ctx.moveTo(7, 0); ctx.lineTo(7, -6); ctx.stroke();
            ctx.strokeStyle = '#e8f4ff'; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-7, -8); ctx.moveTo(7, -4); ctx.lineTo(7, -8); ctx.stroke();
            break;
          }
          case 'bomb': {
            ctx.shadowColor = '#ff6b2b'; ctx.shadowBlur = 14; ctx.fillStyle = '#2a1a3d';
            ctx.beginPath(); ctx.arc(0, 2, 8, 0, TAU); ctx.fill();
            glowStroke(ctx, '#ff8a3d', 2, 10); ctx.stroke();
            ctx.strokeStyle = '#ffe9c2'; ctx.beginPath(); ctx.moveTo(3, -5); ctx.quadraticCurveTo(7, -10, 4, -12); ctx.stroke();
            ctx.fillStyle = '#ffe63d'; ctx.beginPath(); ctx.arc(4, -12, 2.2, 0, TAU); ctx.fill();
            break;
          }
          case 'crate': {
            ctx.shadowColor = '#ffc83d'; ctx.shadowBlur = 18;
            ctx.fillStyle = '#3a2468';
            ctx.beginPath(); ctx.roundRect(-14, -11, 28, 22, 5); ctx.fill();
            glowStroke(ctx, '#ffc83d', 2.5, 12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(14, -2); ctx.stroke();
            ctx.fillStyle = '#ffe9a8'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.roundRect(-4, -5, 8, 8, 2); ctx.fill();
            break;
          }
          default: break;
        }
      }, true);
    },

    // --------------------------------------------------------------- icons
    /** Skill/passive/evolution icon as a canvas (UI cards, HUD). */
    iconCanvas(id, size, bare) {
      const key = 'icon:' + id + ':' + size + (bare ? ':b' : '');
      let s = cache.get(key);
      if (s) return s.c;
      const px = Math.round(size * Math.min(2.5, dpr));
      const c = canvas(px, px);
      const ctx = c.getContext('2d');
      ctx.scale(px / 64, px / 64);
      ctx.translate(32, 32);
      Sprites.drawIcon(ctx, id, bare);
      cache.set(key, { c });
      return c;
    },

    iconURL(id, size, bare) {
      const key = 'iconurl:' + id + ':' + size + (bare ? ':b' : '');
      let s = cache.get(key);
      if (s) return s.url;
      const url = this.iconCanvas(id, size, bare).toDataURL('image/png');
      cache.set(key, { url });
      return url;
    },

    /** Draws a 64x64 icon centred at 0,0. */
    drawIcon(ctx, id, bare) {
      const W = C.WEAPONS[id], Pv = C.PASSIVES[id], E = C.EVOLUTIONS[id];
      const col = (W && W.color) || (Pv && Pv.color) || (E && E.color) || iconColors[id] || '#2ef2ff';
      if (bare) {
        ctx.save(); glowStroke(ctx, col, 3.5, 10); ctx.fillStyle = col;
        (iconDrawers[id] || (id.startsWith('crate_') ? iconDrawers.crate : iconDrawers.star))(ctx, col, false);
        ctx.restore();
        return;
      }
      // badge background
      const g = ctx.createLinearGradient(0, -30, 0, 30);
      g.addColorStop(0, U.mixHex(col, '#1a1240', 0.72));
      g.addColorStop(1, '#120c2e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(-29, -29, 58, 58, 14); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = E ? '#ffc83d' : U.rgba(col, 0.9);
      ctx.stroke();
      ctx.save();
      glowStroke(ctx, col, 3.5, 10);
      ctx.fillStyle = col;
      const draw = iconDrawers[E ? E.from : id] || (id.startsWith('crate_') ? iconDrawers.crate : iconDrawers.star);
      draw(ctx, col, !!E);
      ctx.restore();
      if (E) {
        ctx.fillStyle = '#ffc83d';
        ctx.beginPath(); ctx.moveTo(18, -28); ctx.lineTo(22, -20); ctx.lineTo(30, -19); ctx.lineTo(24, -13); ctx.lineTo(26, -5); ctx.lineTo(18, -9); ctx.lineTo(10, -5); ctx.lineTo(12, -13); ctx.lineTo(6, -19); ctx.lineTo(14, -20); ctx.closePath(); ctx.fill();
      }
    },

    white: whiteOf,

    clear() { cache.clear(); },
  };

  const iconColors = {
    atk: '#ff4d6d', hp: '#7dff5a', def: '#3fa9ff', regen: '#4be37a', pickup: '#ff4d6d', coins: '#ffc83d',
    heal: '#7dff5a', energy: '#ffe63d', gems: '#2ef2ff', scrap: '#9aa4b8', weapon: '#2ef2ff', armor: '#b77bff',
    gloves: '#ff8a3d', boots: '#ffe63d', belt: '#7dff5a', necklace: '#ff4d8a', star: '#ffc83d',
    battle: '#ff3d7f', shop: '#ffc83d', gear: '#2ef2ff', talents: '#b77bff', events: '#7dff5a',
    crate_silver: '#b9c2d6', crate_gold: '#ffc83d', crate_super: '#ff4d6d',
  };

  const iconDrawers = {
    blaster(ctx, col, evo) {
      for (let i = 0; i < (evo ? 3 : 2); i++) { ctx.beginPath(); ctx.moveTo(-16, -8 + i * 8); ctx.lineTo(16, -14 + i * 8); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(-18, 4, 5, 0, TAU); ctx.fill();
    },
    orbit(ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.stroke();
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 5, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    },
    lightning(ctx) {
      ctx.beginPath(); ctx.moveTo(6, -22); ctx.lineTo(-8, 2); ctx.lineTo(4, 2); ctx.lineTo(-6, 22); ctx.lineTo(12, -4); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
    },
    firebomb(ctx) {
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(14, -6, 14, 8, 0, 18); ctx.bezierCurveTo(-14, 8, -14, -6, 0, -20); ctx.fill();
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.bezierCurveTo(6, 2, 6, 8, 0, 13); ctx.bezierCurveTo(-6, 8, -6, 2, 0, -4); ctx.fill();
    },
    drone(ctx) {
      poly(ctx, 3, 14, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-14, -14, 5, 0, TAU); ctx.moveTo(19, -14); ctx.arc(14, -14, 5, 0, TAU); ctx.moveTo(-9, 14); ctx.arc(-14, 14, 5, 0, TAU); ctx.moveTo(19, 14); ctx.arc(14, 14, 5, 0, TAU); ctx.stroke();
    },
    disc(ctx) {
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -4, 20, 8); ctx.quadraticCurveTo(8, 4, 0, 0); ctx.fill(); ctx.restore(); }
    },
    frost(ctx) {
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.moveTo(-6, -14); ctx.lineTo(0, -8); ctx.lineTo(6, -14); ctx.moveTo(-6, 14); ctx.lineTo(0, 8); ctx.lineTo(6, 14); ctx.stroke();
        ctx.restore();
      }
    },
    rocket(ctx) {
      ctx.save(); ctx.rotate(-Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-6, 8); ctx.lineTo(-16, 12); ctx.lineTo(-12, 0); ctx.lineTo(-16, -12); ctx.lineTo(-6, -8); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    overclock(ctx) {
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.moveTo(0, 0); ctx.lineTo(9, 5); ctx.stroke();
    },
    energycell(ctx) {
      ctx.beginPath(); ctx.roundRect(-10, -16, 20, 32, 4); ctx.stroke();
      ctx.fillRect(-4, -21, 8, 5); ctx.fillRect(-6, -2, 12, 14);
    },
    magnet(ctx) {
      ctx.lineCap = 'butt'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 2, 12, Math.PI, 0, true); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-12, -14); ctx.moveTo(12, 2); ctx.lineTo(12, -14); ctx.stroke();
    },
    nanoarmor(ctx) {
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -12); ctx.lineTo(14, 6); ctx.lineTo(0, 20); ctx.lineTo(-14, 6); ctx.lineTo(-16, -12); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
    },
    exoboots(ctx) {
      ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(4, -18); ctx.lineTo(4, 6); ctx.lineTo(18, 10); ctx.lineTo(18, 16); ctx.lineTo(-8, 16); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(-14, -4); ctx.moveTo(-24, 4); ctx.lineTo(-14, 4); ctx.stroke();
    },
    fueltank(ctx) {
      ctx.beginPath(); ctx.roundRect(-12, -14, 24, 30, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(-4, -20); ctx.lineTo(8, -20); ctx.stroke();
      ctx.fillRect(-7, 2, 14, 10);
    },
    aicore(ctx) {
      ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 4); ctx.stroke();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 7, -13); ctx.lineTo(i * 7, -20); ctx.moveTo(i * 7, 13); ctx.lineTo(i * 7, 20); ctx.moveTo(-13, i * 7); ctx.lineTo(-20, i * 7); ctx.moveTo(13, i * 7); ctx.lineTo(20, i * 7); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    },
    bioregen(ctx) {
      ctx.fillRect(-5, -17, 10, 34); ctx.fillRect(-17, -5, 34, 10);
    },
    heal(ctx) { iconDrawers.bioregen(ctx); },
    coins(ctx, col) {
      ctx.fillStyle = col; poly(ctx, 6, 16, Math.PI / 6); ctx.fill();
      ctx.fillStyle = '#7a4d00'; poly(ctx, 6, 10, Math.PI / 6); ctx.fill();
    },
    atk(ctx) {
      ctx.save(); ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, -14); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.lineTo(-5, -14); ctx.closePath(); ctx.fill();
      ctx.fillRect(-11, 10, 22, 4); ctx.fillRect(-3, 14, 6, 8);
      ctx.restore();
    },
    hp(ctx, col) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 16); ctx.bezierCurveTo(-24, -2, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 24, -2, 0, 16); ctx.fill();
    },
    def(ctx) { iconDrawers.nanoarmor(ctx); },
    regen(ctx) { iconDrawers.bioregen(ctx); ctx.beginPath(); ctx.arc(0, 0, 20, -0.5, 2.2); ctx.stroke(); },
    pickup(ctx) { iconDrawers.magnet(ctx); },
    armor(ctx) {
      ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(-8, -18); ctx.quadraticCurveTo(0, -12, 8, -18); ctx.lineTo(18, -14); ctx.lineTo(14, 2); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.lineTo(-14, 2); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 16); ctx.moveTo(-10, 4); ctx.lineTo(10, 4); ctx.stroke();
    },
    gloves(ctx) {
      ctx.beginPath(); ctx.roundRect(-14, -8, 28, 24, 7); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-13 + i * 7, -20, 6, 14, 3); ctx.stroke(); }
    },
    boots(ctx) { iconDrawers.exoboots(ctx); },
    belt(ctx) {
      ctx.beginPath(); ctx.roundRect(-22, -7, 44, 14, 4); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-8, -11, 16, 22, 3); ctx.stroke();
      ctx.fillRect(-3, -3, 6, 6);
    },
    necklace(ctx) {
      ctx.beginPath(); ctx.arc(0, -8, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(9, 13); ctx.lineTo(0, 22); ctx.lineTo(-9, 13); ctx.closePath(); ctx.fill();
    },
    battle(ctx) {
      for (const sgn of [-1, 1]) {
        ctx.save(); ctx.scale(sgn, 1); ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(4, -15); ctx.lineTo(4, 8); ctx.lineTo(-4, 8); ctx.lineTo(-4, -15); ctx.closePath(); ctx.fill();
        ctx.fillRect(-9, 8, 18, 3); ctx.fillRect(-2, 11, 4, 8);
        ctx.restore();
      }
    },
    shop(ctx) {
      ctx.beginPath(); ctx.roundRect(-17, -8, 34, 26, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
      ctx.fillRect(-5, 0, 10, 8);
    },
    gear(ctx) { iconDrawers.armor(ctx); },
    talents(ctx) { iconDrawers.star(ctx); },
    events(ctx) {
      ctx.beginPath(); ctx.roundRect(-18, -14, 36, 32, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-18, -4); ctx.lineTo(18, -4); ctx.moveTo(-9, -20); ctx.lineTo(-9, -10); ctx.moveTo(9, -20); ctx.lineTo(9, -10); ctx.stroke();
      ctx.fillRect(-10, 3, 7, 6); ctx.fillRect(3, 3, 7, 6);
    },
    crate(ctx, col) {
      ctx.fillStyle = U.mixHex(col, '#1a1240', 0.6);
      ctx.beginPath(); ctx.roundRect(-22, -12, 44, 32, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-24, -20, 48, 12, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(-5, -14, 10, 12, 3); ctx.fill();
    },
    star(ctx) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 18; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    },
  };

  NH.Sprites = Sprites;
})(typeof window !== 'undefined' ? window : globalThis);
