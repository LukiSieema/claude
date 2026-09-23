#!/usr/bin/env node
/*
 * Neon Horde — headless balance simulator.
 * Runs full chapters with a kiting bot at several gear/progression profiles and prints
 * survival time, level, kills and clear rate. Use it after changing numbers in config.js.
 *
 *   node tools/simulate.js                 # default matrix
 *   node tools/simulate.js --chapter 3 --runs 10 --profile mid
 */
'use strict';
const NH = require('./load-game');
const { C, U, Meta, Save, World } = NH;

const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };

// Progression profiles: approximate the save state of a player at a given point.
const PROFILES = {
  fresh: { rarity: 0, level: 1, talents: 0 },
  early: { rarity: 1, level: 8, talents: 3 },
  mid: { rarity: 2, level: 18, talents: 8 },
  late: { rarity: 3, level: 30, talents: 15 },
  end: { rarity: 4, level: 45, talents: 25 },
};

function makeState(profileName) {
  const p = PROFILES[profileName];
  const s = Save.defaults(Date.now());
  s.inventory = [];
  s.nextUid = 1;
  s.equipped = { weapon: 0, armor: 0, gloves: 0, boots: 0, belt: 0, necklace: 0 };
  const ids = { weapon: 'pistol', armor: 'plate', gloves: 'fists', boots: 'hovers', belt: 'shieldbelt', necklace: 'pendant' };
  for (const slot of C.SLOTS) {
    if (profileName === 'fresh' && !['weapon', 'armor', 'boots'].includes(slot)) continue;
    const it = Meta.addItem(s, ids[slot], p.rarity, Math.min(p.level, C.RARITIES[p.rarity].maxLevel));
    s.equipped[slot] = it.uid;
  }
  for (const t of C.TALENT_IDS) s.talents[t] = Math.min(p.talents, C.TALENTS[t].max || 999);
  return s;
}

/** Bot: flee weighted enemy pressure, drift towards gems, choose upgrades by priority. */
function botInput(w) {
  const h = w.hero;
  let fx = 0, fy = 0;
  for (const e of w.enemies.active) {
    if (!e._alive) continue;
    const dx = h.x - e.x, dy = h.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 220 * 220) continue;
    const wgt = (e.boss ? 6 : e.elite ? 3 : 1) / Math.max(400, d2);
    fx += dx * wgt; fy += dy * wgt;
  }
  for (const b of w.bullets.active) {
    const dx = h.x - b.x, dy = h.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 120 * 120) continue;
    fx += dx * 3 / Math.max(200, d2); fy += dy * 3 / Math.max(200, d2);
  }
  // gentle orbit so the bot does not get cornered
  const t = w.t * 0.35;
  fx += Math.cos(t) * 0.004; fy += Math.sin(t) * 0.004;
  // danger level decides how greedy the bot is for XP
  let danger = 0;
  for (const e of w.enemies.active) if (e._alive && U.dist2(e.x, e.y, h.x, h.y) < 90 * 90) danger++;
  let gx = 0, gy = 0, best = 1e9;
  for (const g of w.pickups.active) {
    const d2 = U.dist2(g.x, g.y, h.x, h.y);
    const score = d2 / (g.kind === 'xp' ? Math.min(4, 1 + g.value / 5) : 6);
    if (score < best) { best = score; gx = g.x - h.x; gy = g.y - h.y; }
  }
  if (best < 280 * 280) { const d = Math.hypot(gx, gy) || 1; const pull = danger > 3 ? 0.002 : 0.012; fx += gx / d * pull; fy += gy / d * pull; }
  if (w.arena) { const dx = w.arena.x - h.x, dy = w.arena.y - h.y; fx += dx * 0.00002; fy += dy * 0.00002; }
  const len = Math.hypot(fx, fy);
  return len > 0 ? { x: fx / len, y: fy / len } : { x: 0, y: 0 };
}

const PRIORITY = ['blaster', 'lightning', 'orbit', 'drone', 'rocket', 'overclock', 'energycell', 'nanoarmor', 'aicore', 'magnet', 'bioregen', 'disc', 'firebomb', 'frost', 'exoboots', 'fueltank'];
function botPick(choices, w) {
  let best = choices[0], bs = -1e9;
  for (const c of choices) {
    let s = 0;
    if (c.kind === 'weapon' || c.kind === 'passive') {
      s = 30 - PRIORITY.indexOf(c.id);
      if (c.kind === 'weapon' && w.weapon(c.id)) s += 12;
      if (c.kind === 'passive' && w.weapons.some((x) => C.WEAPONS[x.id].pair === c.id)) s += 10;
    } else if (c.kind === 'heal') s = w.hero.hp / w.hero.maxHp < 0.5 ? 50 : -10;
    if (s > bs) { bs = s; best = c; }
  }
  return best;
}

function runOnce(chapter, profile, seed, opts) {
  const s = makeState(profile);
  const stats = Meta.heroStats(s);
  const w = new World({ chapter, stats, seed, view: { w: 430, h: 930 } });
  const dt = C.FIXED_DT;
  let revives = opts.revive ? 1 : 0;
  let steps = 0;
  const maxT = C.RUN_LENGTH + 240;
  let minHpFrac = 1;
  while (steps < maxT / dt) {
    steps++;
    if (w.state === 'levelup') { w.applyChoice(botPick(w.rollChoices(3), w)); w.finishLevelUp(); continue; }
    if (w.state === 'crate') { w.openCrate(); w.finishCrate(); continue; }
    if (w.state === 'dead') { if (revives-- > 0) { w.revive('ad'); continue; } break; }
    if (w.state === 'won') break;
    w.input = botInput(w);
    w.update(dt);
    minHpFrac = Math.min(minHpFrac, w.hero.hp / w.hero.maxHp);
  }
  const res = w.result();
  res.power = stats.power;
  res.minHp = minHpFrac;
  res.weapons = w.weapons.map((x) => x.id + (x.evolved ? '*' : x.level)).join(',');
  res.rewards = Meta.runRewards(s, res, U.rng(seed));
  return res;
}

function summarize(chapter, profile, runs, opts) {
  const out = [];
  for (let i = 0; i < runs; i++) out.push(runOnce(chapter, profile, 1000 + i * 7919 + chapter * 31, opts));
  const avg = (f) => out.reduce((a, r) => a + f(r), 0) / out.length;
  return {
    chapter, profile, runs,
    clear: out.filter((r) => r.cleared).length / runs,
    time: avg((r) => r.time),
    level: avg((r) => r.level),
    kills: avg((r) => r.kills),
    evos: avg((r) => r.evolutions.length),
    coins: avg((r) => r.rewards.coins),
    power: out[0].power,
    sample: out[0].weapons,
  };
}

function fmtRow(r) {
  return [
    ('ch' + r.chapter).padEnd(5), r.profile.padEnd(6), String(r.power).padStart(6),
    (Math.round(r.clear * 100) + '%').padStart(5), U.fmtTime(r.time).padStart(6),
    r.level.toFixed(1).padStart(5), String(Math.round(r.kills)).padStart(6), r.evos.toFixed(1).padStart(5),
    U.fmt(r.coins).padStart(7), '  ' + r.sample,
  ].join(' ');
}

const t0 = Date.now();
const runs = Number(arg('runs', 4));
const revive = args.includes('--revive');
console.log('chap  prof    power clear   time   lvl  kills  evos   coins  build(sample)');
if (arg('chapter')) {
  console.log(fmtRow(summarize(Number(arg('chapter')), arg('profile', 'fresh'), runs, { revive })));
} else {
  const matrix = [[1, 'fresh'], [1, 'early'], [2, 'early'], [2, 'mid'], [3, 'mid'], [4, 'mid'], [4, 'late'], [5, 'late'], [6, 'late'], [7, 'end'], [8, 'end'], [10, 'end']];
  for (const [ch, pr] of matrix) console.log(fmtRow(summarize(ch, pr, runs, { revive })));
}
console.log('done in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
