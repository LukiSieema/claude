/* Neon Horde — run simulation core (no rendering). Weapons: weapons.js, enemy AI & bosses: enemies.js */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;
  const TAU = U.TAU;

  /**
   * opts: { chapter (1-based), stats (Meta.heroStats), seed, view: {w, h}, tutorial }
   */
  function World(opts) {
    this.opts = opts;
    this.rng = U.rng(opts.seed || (Date.now() & 0xffffffff));
    this.ev = U.Emitter();
    this.chapterIdx = U.clamp((opts.chapter || 1) - 1, 0, C.CHAPTERS.length - 1);
    this.chapter = C.CHAPTERS[this.chapterIdx];
    this.stats = opts.stats;
    this.view = opts.view || { w: C.VIEW_WIDTH, h: 930 };
    this.tutorial = !!opts.tutorial;

    this.t = 0;
    this.state = 'play';           // play | levelup | crate | dead | won
    this.level = 1;
    this.xp = 0;
    this.xpNeed = C.xpToNext(1);
    this.pendingLevels = 0;
    this.pendingCrates = 0;
    this.kills = 0;
    this.elitesKilled = 0;
    this.coins = 0;
    this.bossKilled = false;
    this.evolutions = [];
    this.adRevives = 0;
    this.gemRevives = 0;
    this.freeRevives = this.stats.freeRevives || 0;
    this.rerollsUsed = 0;
    this.takeAllUsed = 0;
    this.spawnAcc = 0;
    this.nextEvent = 0;
    this.nextElite = 0;
    this.bossWarned = false;
    this.boss = null;
    this.arena = null;
    this.wonTimer = 0;
    this.beams = [];               // lightning & lasers for rendering
    this.shake = 0;

    const h = C.HERO;
    const pe = C.passiveEffects({});
    this.hero = {
      x: 0, y: 0, vx: 0, vy: 0, r: h.radius, facing: 0,
      maxHp: this.stats.hp, hp: this.stats.hp, invuln: 0, regenAcc: 0, moving: false,
    };
    this.passives = {};
    this.weapons = [];
    this.pe = pe;
    this.input = { x: 0, y: 0 };

    this.nextEnemyId = 1; // per run, so a seed fully determines the simulation
    this.enemies = U.Pool(() => ({ wcd: new Float32Array(C.WEAPON_IDS.length + 4) }), (e) => {
      e.id = this.nextEnemyId++; e.x = 0; e.y = 0; e.vx = 0; e.vy = 0; e.kx = 0; e.ky = 0;
      e.hp = 1; e.maxHp = 1; e.r = 10; e.type = ''; e.def = null; e.speed = 0; e.dmg = 0; e.mass = 1;
      e.elite = false; e.boss = null; e.parent = null; e.seg = -1; e.color = '#fff';
      e.slowT = 0; e.slowAmt = 0; e.freezeT = 0; e.flash = 0; e.touchCd = 0; e.stunT = 0;
      e.st = 0; e.stT = 0; e.cd = 0; e.dx = 0; e.dy = 0; e.age = 0; e.spin = 0; e.xpMult = 1;
      e.minion = false; e.mk = 1; e.trail = null; e.segs = null; e.spiral = 0; e.beamA = 0;
      e.wcd.fill(0);
    });
    this.projectiles = U.Pool(() => ({ hits: [] }), (p) => {
      p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.r = 4; p.dmg = 0; p.pierce = 1; p.life = 1; p.kind = '';
      p.hits.length = 0; p.t = 0; p.tx = 0; p.ty = 0; p.sx = 0; p.sy = 0; p.dur = 0; p.radius = 0;
      p.target = null; p.targetId = 0; p.state = 0; p.range = 0; p.speed = 0; p.color = '#fff'; p.wi = 0; p.angle = 0; p.spin = 0; p.evo = false;
    });
    this.bullets = U.Pool(() => ({}), (b) => { b.x = 0; b.y = 0; b.vx = 0; b.vy = 0; b.r = 6; b.dmg = 0; b.life = 4; b.color = '#ff3d7f'; });
    this.zones = U.Pool(() => ({}), (z) => { z.x = 0; z.y = 0; z.r = 0; z.life = 0; z.maxLife = 0; z.tick = 0; z.dmg = 0; z.kind = ''; z.slow = 0; });
    this.pickups = U.Pool(() => ({}), (g) => { g.x = 0; g.y = 0; g.vx = 0; g.vy = 0; g.kind = 'xp'; g.value = 1; g.magnet = false; g.age = 0; g.r = 5; });

    this.hash = U.SpatialHash(64);

    this.addWeapon(this.stats.startWeapon, this.stats.startLevel);
    this.recalc();
    // opening wave: action (and the first level-up) within seconds of pressing Start
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3;
      this.spawnEnemy('glitchling', { x: Math.cos(a) * 340, y: Math.sin(a) * 340 });
    }
  }

  const P = World.prototype;

  // ---------------------------------------------------------------- derived
  P.recalc = function () {
    this.pe = C.passiveEffects(this.passives);
    const s = this.stats, pe = this.pe;
    const hpRatio = this.hero.maxHp > 0 ? this.hero.hp / this.hero.maxHp : 1;
    this.hero.maxHp = Math.round(s.hp * pe.hpMult);
    this.hero.hp = Math.min(this.hero.maxHp, Math.max(1, hpRatio * this.hero.maxHp));
    this.mod = {
      atk: s.atk,
      dmg: s.dmgMult * pe.dmgMult,
      cd: s.cdMult * pe.cdMult,
      area: pe.areaMult,
      dur: pe.durationMult,
      proj: pe.extraProj,
      taken: s.takenMult * pe.takenMult,
      speed: C.HERO.speed * s.speedMult * pe.speedMult,
      pickup: C.HERO.pickup * s.pickupMult * pe.pickupMult,
      regen: s.regen + pe.regen,
      crit: s.crit,
      critMult: s.critMult,
      xp: s.xpMult,
      heal: s.healMult,
    };
  };

  P.addWeapon = function (id, level) {
    const w = { id, wi: C.WEAPON_IDS.indexOf(id), level: level || 1, evolved: false, timer: 0.4, active: 0, angle: 0, burst: 0, burstT: 0, burstAim: 0, drones: [], phase: 0 };
    if (id === 'drone') w.drones = [];
    this.weapons.push(w);
    return w;
  };
  P.weapon = function (id) { return this.weapons.find((w) => w.id === id) || null; };

  P.wstats = function (w) {
    const def = C.WEAPONS[w.id];
    return w.evolved ? def.evoStats : def.levels[Math.min(w.level, 5) - 1];
  };

  P.extraProj = function (w) {
    return this.mod.proj + (w.id === this.stats.startWeapon ? this.stats.startProj : 0);
  };

  // ------------------------------------------------------------------ main
  P.update = function (dt) {
    if (this.state === 'won') { this.wonTimer += dt; this.updatePickups(dt); return; }
    if (this.state !== 'play') return;
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);

    this.updateHero(dt);
    this.rebuildHash();
    this.updateSpawner(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }
    this.enemies.sweep(); this.projectiles.sweep(); this.bullets.sweep(); this.zones.sweep(); this.pickups.sweep();

    if (this.state === 'play') this.nextPrompt();
  };

  /** Opens the next queued crate or level-up (crates first). Returns true if the run is now waiting on the player. */
  P.nextPrompt = function () {
    if (this.pendingCrates > 0) {
      this.pendingCrates--;
      this.state = 'crate';
      this.ev.emit('crateReady');
      return true;
    }
    if (this.pendingLevels > 0) {
      this.state = 'levelup';
      this.ev.emit('levelupReady', this.level);
      return true;
    }
    return false;
  };

  P.rebuildHash = function () {
    this.hash.clear();
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) if (list[i]._alive) this.hash.insert(list[i]);
  };

  P.updateHero = function (dt) {
    const h = this.hero, m = this.mod;
    let ix = this.input.x, iy = this.input.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const tvx = ix * m.speed, tvy = iy * m.speed;
    h.vx = U.damp(h.vx, tvx, 18, dt);
    h.vy = U.damp(h.vy, tvy, 18, dt);
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.moving = len > 0.1;
    if (h.moving) h.facing = Math.atan2(iy, ix);
    if (this.arena) {
      const a = this.arena;
      const d = U.dist(h.x, h.y, a.x, a.y), lim = a.r - h.r - 6;
      if (d > lim) { const k = lim / d; h.x = a.x + (h.x - a.x) * k; h.y = a.y + (h.y - a.y) * k; }
    }
    if (h.invuln > 0) h.invuln -= dt;
    if (m.regen > 0 && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + m.regen * dt);
  };

  // --------------------------------------------------------------- spawning
  P.spawnRadius = function () {
    return Math.hypot(this.view.w, this.view.h) * 0.5 + 50;
  };

  P.updateSpawner = function (dt) {
    const t = this.t;
    // boss warning & spawn
    if (!this.bossWarned && t >= C.RUN_LENGTH - 3) { this.bossWarned = true; this.ev.emit('bossWarning'); }
    if (!this.boss && t >= C.RUN_LENGTH) { this.spawnBoss(); return; }
    if (this.boss) return;

    // elites
    if (this.nextElite < C.ELITE_TIMES.length && t >= C.ELITE_TIMES[this.nextElite]) {
      this.nextElite++;
      const mix = C.WAVE_MIX[Math.min(C.WAVE_MIX.length - 1, Math.floor(t / 60))];
      const types = Object.keys(mix).filter((k) => k !== 'swarmer');
      const e = this.spawnEnemy(this.rng.pick(types), null, true);
      this.ev.emit('eliteSpawn', e);
    }
    // scripted events
    while (this.nextEvent < C.WAVE_EVENTS.length && t >= C.WAVE_EVENTS[this.nextEvent].t) {
      this.waveEvent(C.WAVE_EVENTS[this.nextEvent]);
      this.nextEvent++;
    }
    // continuous spawning
    let rate = C.spawnRate(t, this.chapterIdx);
    if (this.tutorial && t < 40) rate *= 0.8;
    this.spawnAcc += rate * dt;
    const cap = C.aliveCap(t);
    const mix = C.WAVE_MIX[Math.min(C.WAVE_MIX.length - 1, Math.floor(t / 60))];
    const entries = [];
    for (const k in mix) entries.push([k, mix[k] * (k === this.chapter.favor ? 1.8 : 1)]);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.count >= cap) { this.spawnAcc = 0; break; }
      this.spawnEnemy(this.rng.weighted(entries));
    }
  };

  P.waveEvent = function (ev) {
    const h = this.hero, R = this.spawnRadius();
    this.ev.emit('waveEvent', ev.type);
    if (ev.type === 'ring') {
      const r = R * 0.78;
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * TAU;
        this.spawnEnemy(ev.enemy, { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r });
      }
    } else if (ev.type === 'rush') {
      const base = this.rng.next() * TAU;
      for (let i = 0; i < ev.count; i++) {
        const a = base + (this.rng.next() - 0.5) * 0.5;
        const d = R + this.rng.range(0, 120);
        this.spawnEnemy(ev.enemy, { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d });
      }
    } else if (ev.type === 'rain') {
      for (let i = 0; i < ev.count; i++) {
        const a = this.rng.next() * TAU, d = this.rng.range(R * 0.7, R);
        this.spawnEnemy(ev.enemy, { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d });
      }
    }
  };

  P.spawnEnemy = function (type, pos, elite) {
    const def = C.ENEMIES[type];
    const e = this.enemies.get();
    const h = this.hero;
    if (pos) { e.x = pos.x; e.y = pos.y; } else {
      // spawn in a ring, biased towards the direction the hero is moving
      let a = this.rng.next() * TAU;
      if (h.moving && this.rng.chance(0.45)) a = h.facing + (this.rng.next() - 0.5) * 1.6;
      const d = this.spawnRadius() + this.rng.range(0, 60);
      e.x = h.x + Math.cos(a) * d; e.y = h.y + Math.sin(a) * d;
    }
    const hpScale = this.chapter.hp * C.enemyHpScale(this.t);
    const dmgScale = this.chapter.dmg * C.enemyDmgScale(this.t);
    e.type = type; e.def = def; e.color = def.color;
    e.maxHp = e.hp = def.hp * hpScale * (elite ? C.ELITE.hpMult : 1);
    e.r = def.r * (elite ? C.ELITE.sizeMult : 1);
    e.speed = def.speed * (elite ? C.ELITE.speedMult : 1) * this.rng.range(0.92, 1.08);
    e.dmg = def.dmg * dmgScale * (elite ? C.ELITE.dmgMult : 1);
    e.mass = def.mass * (elite ? 4 : 1);
    e.elite = !!elite;
    e.cd = this.rng.range(0.5, 2.5);
    e.spin = this.rng.range(-2, 2);
    e.xpMult = 1 + this.t / 60 * 0.12;
    return e;
  };

  P.spawnBoss = function () {
    const id = this.chapter.boss;
    const def = C.BOSSES[id];
    const h = this.hero;
    // clear the field with a flash: normal enemies die (dropping xp)
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) if (list[i]._alive && !list[i].boss) this.killEnemy(list[i], true);
    this.bullets.clear();
    this.arena = { x: h.x, y: h.y, r: C.BOSS_ARENA_RADIUS, t: 0 };
    const e = this.enemies.get();
    const mk = this.chapter.mk || 1;
    e.type = 'boss'; e.boss = id; e.def = def; e.color = def.color;
    e.maxHp = e.hp = def.hp * this.chapter.hp;
    e.r = def.r; e.speed = def.speed * (mk > 1 ? 1.12 : 1); e.dmg = def.dmg * this.chapter.dmg; e.mass = 60;
    e.x = h.x; e.y = h.y - 220; e.cd = 2; e.mk = mk;
    this.boss = e;
    if (id === 'serpent') {
      e.trail = [];
      e.segs = [];
      for (let i = 0; i < def.segments; i++) {
        const s = this.enemies.get();
        s.type = 'seg'; s.parent = e; s.seg = i; s.def = def; s.color = def.color;
        s.maxHp = s.hp = 1; s.r = def.r * (1 - i * 0.03); s.dmg = e.dmg * 0.8; s.mass = 60;
        s.x = e.x; s.y = e.y - i * 10;
        e.segs.push(s);
      }
    }
    this.ev.emit('bossSpawn', e);
  };

  // ----------------------------------------------------------------- damage
  P.damageEnemy = function (e, amount, kx, ky, force, noCrit) {
    if (!e._alive) return 0;
    if (e.parent) { // serpent segment forwards damage to the head
      const hdmg = this.damageEnemy(e.parent, amount * 0.4, 0, 0, 0, noCrit);
      e.flash = 0.08;
      return hdmg;
    }
    let dmg = amount * this.mod.dmg;
    let crit = false;
    if (!noCrit && this.rng.next() < this.mod.crit) { dmg *= this.mod.critMult; crit = true; }
    e.hp -= dmg;
    e.flash = 0.1;
    if (force && !e.boss) {
      const f = force / e.mass;
      e.kx += kx * f; e.ky += ky * f;
    }
    this.ev.emit('hit', e, dmg, crit);
    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  };

  P.killEnemy = function (e, silentDrops) {
    if (!e._alive) return;
    e._alive = false;
    if (e.parent) return;
    if (e.boss) {
      this.bossKilled = true;
      if (e.segs) for (const s of e.segs) s._alive = false;
      this.ev.emit('bossDead', e);
      this.dropPickup('crate', e.x, e.y, 1);
      for (let i = 0; i < 20; i++) this.dropXp(e.x + this.rng.range(-60, 60), e.y + this.rng.range(-60, 60), 20);
      // everything left is collected automatically
      for (const g of this.pickups.active) g.magnet = true;
      this.bullets.clear();
      this.state = 'won';
      this.wonTimer = 0;
      this.ev.emit('victory');
      return;
    }
    this.kills++;
    this.ev.emit('kill', e);
    const def = e.def;
    if (e.elite) {
      this.elitesKilled++;
      this.dropPickup('crate', e.x, e.y, 1);
      this.dropXp(e.x, e.y, C.ELITE.xp * e.xpMult);
    } else {
      this.dropXp(e.x, e.y, def.xp * e.xpMult);
    }
    if (def.split && !silentDrops) {
      for (let i = 0; i < def.split.count; i++) {
        const a = (i / def.split.count) * TAU;
        const s = this.spawnEnemy(def.split.type, { x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14 });
        s.kx = Math.cos(a) * 120; s.ky = Math.sin(a) * 120;
      }
    }
    if (silentDrops) return;
    const D = C.DROPS, r = this.rng.next();
    if (r < D.bombChance) this.dropPickup('bomb', e.x, e.y, 1);
    else if (r < D.bombChance + D.magnetChance) this.dropPickup('magnet', e.x, e.y, 1);
    else if (r < D.bombChance + D.magnetChance + D.heartChance) this.dropPickup('heart', e.x, e.y, 1);
    else if (r < D.bombChance + D.magnetChance + D.heartChance + D.coinChance) this.dropPickup('coin', e.x, e.y, Math.ceil(1 + this.chapterIdx * 0.5));
  };

  P.damageHero = function (amount, sx, sy) {
    const h = this.hero;
    if (h.invuln > 0 || this.state !== 'play') return;
    const dmg = amount * this.mod.taken;
    h.hp -= dmg;
    h.invuln = C.HERO.hitInvuln;
    this.ev.emit('heroHit', dmg, sx, sy);
    if (h.hp <= 0) {
      h.hp = 0;
      this.state = 'dead';
      this.ev.emit('death');
    }
  };

  P.healHero = function (frac) {
    const h = this.hero;
    const amt = h.maxHp * frac * this.mod.heal;
    h.hp = Math.min(h.maxHp, h.hp + amt);
    this.ev.emit('heal', amt);
  };

  /** Revive after death (ad / gems / free). */
  P.revive = function (kind) {
    if (this.state !== 'dead') return false;
    if (kind === 'ad') this.adRevives++;
    else if (kind === 'gems') this.gemRevives++;
    else if (kind === 'free') { if (this.freeRevives <= 0) return false; this.freeRevives--; }
    const h = this.hero;
    h.hp = h.maxHp;
    h.invuln = C.REVIVE_INVULN;
    this.state = 'play';
    // shockwave: push & damage everything nearby
    for (const e of this.enemies.active) {
      if (!e._alive) continue;
      const d = U.dist(e.x, e.y, h.x, h.y);
      if (d < 260) {
        const a = Math.atan2(e.y - h.y, e.x - h.x);
        if (!e.boss && !e.parent) this.damageEnemy(e, 6, Math.cos(a), Math.sin(a), 900, true);
      }
    }
    this.bullets.clear();
    this.ev.emit('revive');
    return true;
  };

  // ---------------------------------------------------------------- pickups
  P.dropXp = function (x, y, value) {
    const list = this.pickups.active;
    let gems = 0;
    for (let i = 0; i < list.length; i++) if (list[i].kind === 'xp') gems++;
    if (gems >= C.MAX_GEMS) {
      // merge into the nearest existing gem to keep the pickup count bounded
      let best = null, bd = Infinity;
      for (let i = 0; i < list.length; i++) {
        const g = list[i];
        if (g.kind !== 'xp' || !g._alive) continue;
        const d = U.dist2(g.x, g.y, x, y);
        if (d < bd) { bd = d; best = g; }
      }
      if (best) { best.value += value; this.gemRadius(best); return; }
    }
    this.dropPickup('xp', x, y, value);
  };

  P.gemRadius = function (g) {
    let r = C.GEM_TIERS[0].r;
    for (const tier of C.GEM_TIERS) if (g.value >= tier.min) r = tier.r;
    g.r = r;
  };

  P.dropPickup = function (kind, x, y, value) {
    const g = this.pickups.get();
    g.kind = kind; g.x = x; g.y = y; g.value = value;
    const a = this.rng.next() * TAU, s = this.rng.range(30, 90);
    g.vx = Math.cos(a) * s; g.vy = Math.sin(a) * s;
    if (kind === 'xp') this.gemRadius(g); else g.r = kind === 'crate' ? 16 : 9;
    return g;
  };

  P.updatePickups = function (dt) {
    const h = this.hero;
    const pr = this.mod.pickup;
    const pr2 = pr * pr;
    const list = this.pickups.active;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (!g._alive) continue;
      g.age += dt;
      const dx = h.x - g.x, dy = h.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.magnet && g.kind !== 'crate' && d2 < pr2) g.magnet = true;
      if (g.kind === 'crate' && d2 < (h.r + g.r + 10) * (h.r + g.r + 10)) g.magnet = true;
      if (g.magnet) {
        const d = Math.sqrt(d2) || 1;
        const sp = 260 + g.age * 60 + (this.state === 'won' ? 500 : 0);
        g.vx = U.damp(g.vx, dx / d * sp, 9, dt);
        g.vy = U.damp(g.vy, dy / d * sp, 9, dt);
        if (d < h.r + g.r) { this.collect(g); continue; }
      } else if (g.kind === 'xp' && d2 < pr2 * 12.25 && g.age > 0.4) {
        // gentle drift inside 3.5x pickup range keeps collecting satisfying without auto-looting
        const d = Math.sqrt(d2) || 1;
        g.vx = U.damp(g.vx, dx / d * 95, 3, dt); g.vy = U.damp(g.vy, dy / d * 95, 3, dt);
      } else {
        g.vx = U.damp(g.vx, 0, 5, dt); g.vy = U.damp(g.vy, 0, 5, dt);
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
    }
  };

  P.collect = function (g) {
    g._alive = false;
    switch (g.kind) {
      case 'xp': this.addXp(g.value); break;
      case 'coin': this.coins += g.value; break;
      case 'heart': this.healHero(0.3); break;
      case 'magnet': for (const o of this.pickups.active) if (o.kind === 'xp') o.magnet = true; break;
      case 'bomb':
        for (const e of this.enemies.active) {
          if (!e._alive) continue;
          if (U.dist(e.x, e.y, this.hero.x, this.hero.y) > this.spawnRadius()) continue;
          if (e.boss) this.damageEnemy(e, e.maxHp * 0.05 / this.mod.dmg, 0, 0, 0, true);
          else if (!e.parent) this.killEnemy(e);
        }
        this.shake = Math.max(this.shake, 1);
        break;
      case 'crate':
        // queued, so crates grabbed in the same frame (or just before dying) are all opened;
        // the boss crate after victory is only a visual, the rewards come on the results screen
        if (this.state !== 'won') this.pendingCrates++;
        break;
      default: break;
    }
    this.ev.emit('pickup', g.kind, g.value, g.x, g.y);
  };

  P.addXp = function (v) {
    this.xp += v * this.mod.xp;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = C.xpToNext(this.level);
      this.pendingLevels++;
      this.ev.emit('levelup', this.level);
    }
  };

  // ---------------------------------------------------------- level choices
  P.upgradeCandidates = function () {
    const out = [];
    for (const w of this.weapons) if (!w.evolved && w.level < C.MAX_SKILL_LEVEL) out.push({ kind: 'weapon', id: w.id, level: w.level + 1, weight: 1.35 });
    for (const id in this.passives) if (this.passives[id] < C.MAX_SKILL_LEVEL) out.push({ kind: 'passive', id, level: this.passives[id] + 1, weight: 1.2 });
    if (this.weapons.length < C.MAX_WEAPONS) {
      for (const id of C.WEAPON_IDS) if (!this.weapon(id)) out.push({ kind: 'weapon', id, level: 1, weight: 1.0 });
    }
    if (Object.keys(this.passives).length < C.MAX_PASSIVES) {
      for (const id of C.PASSIVE_IDS) if (!this.passives[id]) {
        // passives that pair with an owned weapon are more likely
        const pairs = this.weapons.some((w) => C.WEAPONS[w.id].pair === id);
        out.push({ kind: 'passive', id, level: 1, weight: pairs ? 1.6 : 0.9 });
      }
    }
    return out;
  };

  P.rollChoices = function (n) {
    n = n || 3;
    const cands = this.upgradeCandidates();
    const picks = [];
    while (picks.length < n && cands.length) {
      const entries = cands.map((c, i) => [i, c.weight]);
      const idx = this.rng.weighted(entries);
      picks.push(cands[idx]);
      cands.splice(idx, 1);
    }
    const fillers = [{ kind: 'heal', id: 'heal' }, { kind: 'coins', id: 'coins' }];
    let f = 0;
    while (picks.length < n) picks.push(fillers[f++ % 2]);
    return picks;
  };

  /** True if every choice can still be applied without breaking the weapon/passive slot limits. */
  P.fitsAll = function (choices) {
    let weapons = this.weapons.length, passives = Object.keys(this.passives).length;
    for (const c of choices) {
      if (c.kind === 'weapon' && !this.weapon(c.id)) weapons++;
      else if (c.kind === 'passive' && !this.passives[c.id]) passives++;
    }
    return weapons <= C.MAX_WEAPONS && passives <= C.MAX_PASSIVES;
  };

  P.applyChoice = function (c) {
    if (c.kind === 'weapon') {
      const w = this.weapon(c.id);
      if (w) w.level = Math.min(C.MAX_SKILL_LEVEL, w.level + 1);
      else if (this.weapons.length < C.MAX_WEAPONS) this.addWeapon(c.id, 1);
      else return;
    } else if (c.kind === 'passive') {
      if (!this.passives[c.id] && Object.keys(this.passives).length >= C.MAX_PASSIVES) return;
      this.passives[c.id] = Math.min(C.MAX_SKILL_LEVEL, (this.passives[c.id] || 0) + 1);
    } else if (c.kind === 'heal') {
      this.healHero(0.4);
    } else if (c.kind === 'coins') {
      this.coins += 40 + this.chapterIdx * 25;
    }
    this.recalc();
    this.ev.emit('upgrade', c);
  };

  /** Called by UI after the player picked a card (or all cards). */
  P.finishLevelUp = function () {
    if (this.state !== 'levelup') return; // ignore a second tap on an already closed card
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) { this.ev.emit('levelupReady', this.level); return; }
    this.state = 'play';
    this.nextPrompt();
  };

  // ------------------------------------------------------------------ crate
  P.evolvable = function () {
    return this.weapons.filter((w) => !w.evolved && w.level >= C.MAX_SKILL_LEVEL && (this.passives[C.WEAPONS[w.id].pair] || 0) >= 1);
  };

  /** Opens an elite/boss crate. Returns { evo: id|null, upgrades: [choices] } and applies it. */
  P.openCrate = function () {
    const ev = this.evolvable();
    if (ev.length) {
      const w = this.rng.pick(ev);
      w.evolved = true;
      w.timer = 0.2;
      const evoId = C.WEAPONS[w.id].evo;
      this.evolutions.push(evoId);
      this.recalc();
      this.ev.emit('evolve', evoId);
      return { evo: evoId, upgrades: [] };
    }
    const count = this.rng.weighted([[1, 60], [2, 30], [3, 10]]);
    const ups = [];
    for (let i = 0; i < count; i++) {
      const c = this.rollChoices(1)[0];
      this.applyChoice(c);
      ups.push(c);
    }
    return { evo: null, upgrades: ups };
  };

  P.finishCrate = function () {
    if (this.state !== 'crate') return;
    this.state = 'play';
    this.nextPrompt();
  };

  // --------------------------------------------------------------- queries
  P.nearestEnemy = function (x, y, maxR, exclude) {
    let best = null, bd = maxR * maxR;
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e._alive || e === exclude) continue;
      const d = U.dist2(e.x, e.y, x, y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  P.randomEnemyNear = function (x, y, maxR) {
    const list = this.enemies.active;
    const r2 = maxR * maxR;
    let pick = null, n = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e._alive || U.dist2(e.x, e.y, x, y) > r2) continue;
      n++;
      if (this.rng.next() * n < 1) pick = e;
    }
    return pick;
  };

  P.toughestEnemyNear = function (x, y, maxR) {
    const list = this.enemies.active;
    const r2 = maxR * maxR;
    let best = null, hp = -1;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e._alive || e.parent || U.dist2(e.x, e.y, x, y) > r2) continue;
      if (e.hp > hp) { hp = e.hp; best = e; }
    }
    return best;
  };

  /** Summary for results screen / meta rewards. */
  P.result = function () {
    return {
      chapter: this.chapterIdx + 1,
      cleared: this.bossKilled,
      time: Math.min(this.t, C.RUN_LENGTH + 600),
      kills: this.kills,
      elites: this.elitesKilled,
      bossKilled: this.bossKilled,
      level: this.level,
      evolutions: this.evolutions.slice(),
      coins: this.coins,
    };
  };

  NH.World = World;
  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
