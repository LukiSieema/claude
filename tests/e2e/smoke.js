/*
 * End-to-end smoke test on an emulated phone (Pixel 7 profile).
 * Plays the tutorial run, picks level-up cards, jumps to the boss, walks the lobby and saves screenshots.
 *
 *   python3 .claude/skills/webapp-testing/scripts/with_server.py --server "python3 -m http.server 8765 -d game" --port 8765 -- node tests/e2e/smoke.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }

const URL = process.env.GAME_URL || 'http://localhost:8765/';
const OUT = process.env.SHOTS || path.join(__dirname, '..', '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await playwright.chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    locale: process.env.LOCALE || 'pl-PL',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => { if (!errors.some((x) => x.startsWith('pageerror: ' + e.message))) errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 9).join('\n')); });
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('shot', name); };

  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  await sleep(1200);
  await shot('01-loading');

  // start tutorial run
  await page.locator('#screen-loading').tap();
  await sleep(600);
  // move around in circles with the keyboard while handling modals
  const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  let k = 0;
  const handleModals = async () => {
    if (await page.locator('.lu-card').first().isVisible().catch(() => false)) {
      await sleep(350);
      await page.locator('.lu-card').first().tap();
      await sleep(250);
      return 'levelup';
    }
    if (await page.locator('[data-x="done"]').isVisible().catch(() => false)) { await page.locator('[data-x="done"]').tap(); await sleep(200); return 'crate'; }
    if (await page.locator('[data-r="no"]').isVisible().catch(() => false)) return 'revive';
    return null;
  };
  let tookLevelShot = false, tookPlayShot = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down(keys[k % 4]);
    await sleep(1000);
    await page.keyboard.up(keys[k % 4]);
    k++;
    if (i === 8 && !tookPlayShot) { await shot('02-gameplay-early'); tookPlayShot = true; }
    if (!tookLevelShot && await page.locator('.lu-card').first().isVisible().catch(() => false)) {
      await sleep(500);
      await shot('03-levelup');
      tookLevelShot = true;
    }
    const m = await handleModals();
    if (m === 'revive') break;
  }
  // give the hero a strong build + invulnerability so we can see the late game and the boss
  await page.evaluate(() => {
    const w = NH.G.world;
    for (const id of ['orbit', 'lightning', 'drone', 'rocket']) if (!w.weapon(id) && w.weapons.length < 6) w.addWeapon(id, 5);
    for (const wp of w.weapons) wp.level = 5;
    w.passives.overclock = 3; w.passives.energycell = 5; w.passives.nanoarmor = 5;
    w.weapons[0].evolved = true;
    w.recalc();
    w.hero.maxHp = 1e6; w.hero.hp = 1e6;
    w.t = 300;
  });
  for (let i = 0; i < 16; i++) { await page.keyboard.down(keys[k % 4]); await sleep(400); await page.keyboard.up(keys[k % 4]); k++; await handleModals(); }
  await shot('04-gameplay-horde');
  await page.evaluate(() => { NH.G.world.t = 476; });
  await sleep(3800);
  await handleModals();
  await shot('05-boss');
  // finish the boss quickly
  await page.evaluate(() => { const b = NH.G.world.boss; if (b) b.hp = 1; });
  for (let i = 0; i < 20; i++) { await sleep(300); await handleModals(); if (await page.locator('.result-title').isVisible().catch(() => false)) break; }
  await sleep(2800);
  await handleModals();
  await page.waitForSelector('.result-title', { timeout: 15000 });
  await sleep(600);
  await shot('06-results');
  // double rewards via simulated rewarded ad
  await page.locator('[data-x="double"]').tap();
  await page.waitForSelector('.web-ad', { timeout: 5000 });
  await shot('07-web-ad');
  await sleep(3300);
  await page.locator('.web-ad-close').tap();
  await sleep(2500);
  // interstitial is suppressed for the first runs; close any modal that appears
  for (let i = 0; i < 3; i++) { const c = page.locator('.modal [data-close]').first(); if (await c.isVisible().catch(() => false)) { await c.tap(); await sleep(300); } }
  await shot('08-lobby-battle');
  for (const tab of ['shop', 'gear', 'talents', 'events']) {
    await page.locator('[data-tab="' + tab + '"]').tap();
    await sleep(700);
    await shot('09-lobby-' + tab);
  }
  // open an item + settings
  await page.locator('[data-tab="gear"]').tap();
  await sleep(400);
  const slot = page.locator('[data-act="slot"][data-slot="weapon"]');
  await slot.tap();
  await sleep(600);
  await shot('10-item');
  await page.locator('.modal-close').first().tap();
  await sleep(300);
  await page.locator('.icon-btn[data-act="settings"]').tap();
  await sleep(600);
  await shot('11-settings');

  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); };
    requestAnimationFrame(f);
  }));
  console.log('lobby fps ~', fps);
  const state = await page.evaluate(() => ({ coins: NH.G.state.coins, runs: NH.G.state.stats.runs, ads: NH.G.state.daily.ads, cleared: NH.G.state.chapter.cleared, items: NH.G.state.inventory.length }));
  console.log('state', JSON.stringify(state));
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('OK — no console errors');
})().catch((e) => { console.error(e); console.log(errors.join('\n')); process.exit(1); });
