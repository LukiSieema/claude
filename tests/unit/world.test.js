'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NH = require('../../tools/load-game');
const { C, Save, Meta, World } = NH;

function world(chapter, seed) {
  const s = Save.defaults(0);
  return new World({ chapter: chapter || 1, stats: Meta.heroStats(s), seed: seed || 11, view: { w: 430, h: 930 } });
}

/** Steps the world, auto-picking level-ups and crates, circling around the origin. */
function play(w, seconds) {
  const dt = C.FIXED_DT;
  for (let i = 0; i < seconds / dt; i++) {
    if (w.state === 'levelup') { w.applyChoice(w.rollChoices(3)[0]); w.finishLevelUp(); continue; }
    if (w.state === 'crate') { w.openCrate(); w.finishCrate(); continue; }
    if (w.state !== 'play' && w.state !== 'won') break;
    w.input = { x: Math.cos(i / 90), y: Math.sin(i / 90) };
    w.update(dt);
  }
}

test('a fresh hero survives the first minute, kills enemies and levels up', () => {
  const w = world(1, 21);
  play(w, 60);
  assert.equal(w.state === 'dead', false);
  assert.ok(w.kills > 20, 'kills: ' + w.kills);
  assert.ok(w.level >= 2, 'level: ' + w.level);
});

test('simulation is deterministic for a seed', () => {
  const a = world(1, 99), b = world(1, 99);
  play(a, 30); play(b, 30);
  assert.equal(a.kills, b.kills);
  assert.equal(a.level, b.level);
});

test('level-up choices never offer more than the slot limits', () => {
  const w = world(1, 3);
  for (const id of C.WEAPON_IDS) if (!w.weapon(id) && w.weapons.length < C.MAX_WEAPONS) w.addWeapon(id, 1);
  assert.equal(w.weapons.length, C.MAX_WEAPONS);
  const choices = [];
  for (let i = 0; i < 50; i++) choices.push(...w.rollChoices(3));
  const newWeapons = choices.filter((c) => c.kind === 'weapon' && !w.weapon(c.id));
  assert.equal(newWeapons.length, 0, 'weapon slots are full');
});

test('a crate evolves a maxed weapon when its paired passive is owned', () => {
  const w = world(1, 5);
  const blaster = w.weapon('blaster');
  blaster.level = C.MAX_SKILL_LEVEL;
  w.passives.overclock = 1;
  w.recalc();
  const r = w.openCrate();
  assert.equal(r.evo, 'photon');
  assert.equal(blaster.evolved, true);
  assert.deepEqual(w.evolutions, ['photon']);
});

test('death stops the run and revive restores full HP once per method', () => {
  const w = world(1, 6);
  w.damageHero(1e9, 0, 0);
  assert.equal(w.state, 'dead');
  assert.equal(w.revive('ad'), true);
  assert.equal(w.state, 'play');
  assert.equal(w.hero.hp, w.hero.maxHp);
  assert.ok(w.hero.invuln > 0);
  assert.equal(w.revive('free'), false, 'free revive needs a mythic belt');
});

test('boss spawns at the end of the timeline and killing it wins the run', () => {
  const w = world(1, 7);
  w.hero.maxHp = w.hero.hp = 1e9;
  w.t = C.RUN_LENGTH - 0.05;
  play(w, 0.5);
  assert.ok(w.boss, 'boss spawned');
  assert.ok(w.arena, 'arena closes');
  const events = [];
  w.ev.on('victory', () => events.push('victory'));
  w.damageEnemy(w.boss, w.boss.maxHp * 10, 0, 0, 0, true);
  assert.equal(w.state, 'won');
  assert.equal(w.bossKilled, true);
  assert.deepEqual(events, ['victory']);
  assert.equal(w.result().cleared, true);
});

test('explosion events carry their colour to listeners', () => {
  const w = world(1, 8);
  let color = null;
  w.ev.on('explosion', (x, y, r, c) => { color = c; });
  w.explode(0, 0, 50, 10, '#ff4d6d', true);
  assert.equal(color, '#ff4d6d');
});

test('XP gems merge when the pickup cap is reached', () => {
  const w = world(1, 9);
  for (let i = 0; i < C.MAX_GEMS + 40; i++) w.dropXp(i * 3, 0, 1);
  const gems = w.pickups.active.filter((g) => g.kind === 'xp');
  assert.ok(gems.length <= C.MAX_GEMS);
  assert.equal(gems.reduce((a, g) => a + g.value, 0), C.MAX_GEMS + 40, 'no XP is lost');
});
