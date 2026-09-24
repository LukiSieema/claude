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

test('the first run waits for the ad-consent flow, with a timeout', async () => {
  let resolved = false;
  const PF = withNative({ isConsentResolved: () => resolved });
  let done = false;
  const p = PF.whenConsentResolved(5000).then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(done, false, 'still waiting while the consent form is open');
  resolved = true;
  globalThis.NHNative.onConsent(true);
  await p;
  assert.equal(done, true);
  const t0 = Date.now();
  await withNative({ isConsentResolved: () => false }).whenConsentResolved(200);
  assert.ok(Date.now() - t0 >= 190, 'gives up after the timeout (e.g. no network)');
  await withNative({ isConsentResolved: () => true }).whenConsentResolved(5000); // already resolved: no wait
});

test('JS ↔ Android bridge names match (platform.js ↔ GameBridge.kt / MainActivity.kt)', () => {
  const fs = require('fs');
  const root = path.join(__dirname, '..', '..');
  const js = fs.readFileSync(FILE, 'utf8');
  const kt = (f) => fs.readFileSync(path.join(root, 'android/app/src/main/java/com/neonhorde/survivor', f), 'utf8');
  const bridge = kt('GameBridge.kt');
  const exported = new Set([...bridge.matchAll(/@JavascriptInterface\s+fun (\w+)\(/g)].map((m) => m[1]));
  const called = new Set([...js.matchAll(/this\.(?:call|bridge)\('(\w+)'/g)].map((m) => m[1]));
  for (const name of called) assert.ok(exported.has(name), 'GameBridge.kt lacks @JavascriptInterface fun ' + name);
  const kotlin = kt('MainActivity.kt') + bridge;
  const callbacks = new Set([...kotlin.matchAll(/NHNative\.(\w+)\(/g)].map((m) => m[1]));
  const NHNative = withNative({});
  assert.ok(NHNative); // loaded
  for (const name of callbacks) assert.equal(typeof globalThis.NHNative[name], 'function', 'NHNative.' + name + ' is missing in platform.js');
});
