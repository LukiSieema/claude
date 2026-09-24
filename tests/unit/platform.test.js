'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'game', 'js', 'core', 'platform.js');

/** Loads platform.js against a fake Android bridge (it binds window.NeonHordeNative at load time). */
function withNative(nativeImpl) {
  globalThis.NeonHordeNative = nativeImpl;
  globalThis.location = { search: '' };
  delete require.cache[FILE];
  globalThis.NH = globalThis.NH || {};
  delete globalThis.NH.Platform;
  require(FILE);
  delete globalThis.NeonHordeNative;
  return globalThis.NH.Platform;
}

test('rewarded ad outcomes: earned, skipped and unavailable come back through the callback', async () => {
  const calls = [];
  const PF = withNative({ showRewarded: (id) => calls.push(id) });
  const earned = PF.showRewarded('a');
  globalThis.NHNative.onRewardResult(calls[0], true, true);
  assert.equal(await earned, 'earned');
  const skipped = PF.showRewarded('b');
  globalThis.NHNative.onRewardResult(calls[1], false, true);
  assert.equal(await skipped, 'skipped');
  const none = PF.showRewarded('c');
  globalThis.NHNative.onRewardResult(calls[2], false, false);
  assert.equal(await none, 'unavailable');
  assert.equal(PF.adBusy, false);
});

test('a broken bridge never leaves an ad pending', async () => {
  const PF = withNative({ showRewarded: () => { throw new Error('bridge gone'); } });
  assert.equal(await PF.showRewarded('x'), 'unavailable');
  assert.equal(PF.adBusy, false);
});

test('if the result never arrives, coming back to the game settles it without a reward', async () => {
  const PF = withNative({ showRewarded: () => {} });
  const p = PF.showRewarded('x');
  const t0 = Date.now();
  globalThis.NHNative.onResume();
  assert.equal(await p, 'skipped');
  assert.ok(Date.now() - t0 >= 3900, 'waits for the real callback first');
  assert.equal(PF.adBusy, false);
});
