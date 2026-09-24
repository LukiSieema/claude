'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NH = require('../../tools/load-game');
const { U, C, Save } = NH;

test('fmt: compact numbers with suffixes', () => {
  assert.equal(U.fmt(0), '0');
  assert.equal(U.fmt(999), '999');
  assert.equal(U.fmt(1500), '1.50K');
  assert.equal(U.fmt(2_970_000), '2.97M');
  assert.equal(U.fmt(12_300_000_000_000), '12.3T');
  assert.equal(U.fmt(1e15), '1.00aa');
  assert.equal(U.fmt(-2500), '-2.50K');
});

test('fmtTime / fmtDuration', () => {
  assert.equal(U.fmtTime(0), '00:00');
  assert.equal(U.fmtTime(65), '01:05');
  assert.equal(U.fmtTime(3725), '1:02:05');
  assert.equal(U.fmtDuration(59), '59s');
  assert.equal(U.fmtDuration(125), '2m 05s');
  assert.equal(U.fmtDuration(7200 + 300), '2h 05m');
});

test('rng is deterministic per seed', () => {
  const a = U.rng(42), b = U.rng(42), c = U.rng(43);
  const sa = [a.next(), a.next(), a.next()];
  assert.deepEqual(sa, [b.next(), b.next(), b.next()]);
  assert.notDeepEqual(sa, [c.next(), c.next(), c.next()]);
  const r = U.rng(7);
  for (let i = 0; i < 200; i++) { const v = r.int(3, 5); assert.ok(v >= 3 && v <= 5); }
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) counts[r.weighted([['a', 3], ['b', 1]])]++;
  assert.ok(counts.a > counts.b * 2);
});

test('Emitter forwards all event arguments (regression: explosion colour was dropped)', () => {
  const ev = U.Emitter();
  let got = null;
  ev.on('explosion', (x, y, r, color, big) => { got = [x, y, r, color, big]; });
  ev.emit('explosion', 1, 2, 3, '#ff0000', true);
  assert.deepEqual(got, [1, 2, 3, '#ff0000', true]);
});

test('SpatialHash finds nearby objects only', () => {
  const h = U.SpatialHash(64);
  const near = { x: 10, y: 10 }, far = { x: 1000, y: 1000 };
  h.insert(near); h.insert(far);
  const found = [];
  h.query(0, 0, 50, (o) => { found.push(o); });
  assert.deepEqual(found, [near]);
});

test('Pool reuses swept objects', () => {
  let made = 0;
  const pool = U.Pool(() => ({ id: ++made }), (o) => { o.v = 0; });
  const a = pool.get(); pool.get();
  a._alive = false;
  pool.sweep();
  assert.equal(pool.count, 1);
  const c = pool.get();
  assert.equal(c, a);
  assert.equal(made, 2);
});

function memStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m };
}

test('Save: roundtrip and backup fallback on corruption', () => {
  const store = memStorage();
  Save.init(store);
  const s = Save.defaults(1000);
  s.coins = 777;
  assert.ok(Save.save(s));
  s.coins = 888;
  Save.save(s);
  assert.equal(Save.load(2000).coins, 888);
  store.m[C.SAVE_KEY] = '{broken json';
  assert.equal(Save.load(2000).coins, 777, 'falls back to the previous save');
});

test('Save: migrate fills new keys and repairs bad data', () => {
  const old = { v: 1, coins: -5, gems: 'x', inventory: [{ uid: 1, id: 'pistol', rarity: 0, level: 99 }, { uid: 2, id: 'nope', rarity: 0, level: 1 }], equipped: { weapon: 1, armor: 42 } };
  const s = Save.migrate(old, 5000);
  assert.equal(s.coins, 0);
  assert.equal(s.gems, 0);
  assert.equal(s.inventory.length, 1);
  assert.equal(s.inventory[0].level, C.RARITIES[0].maxLevel, 'level clamped to rarity cap');
  assert.equal(s.equipped.armor, 0, 'dangling equipped uid removed');
  assert.ok(s.settings && s.talents && s.stats, 'missing sections restored');
});
