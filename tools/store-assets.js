#!/usr/bin/env node
/*
 * Renders Google Play assets from the real game:
 *   docs/store/icon-512.png            512x512 app icon
 *   docs/store/feature-graphic.jpg     1024x500 feature graphic (no alpha)
 *   docs/store/screenshots/<lang>/NN-*.png   1080x1920 (9:16) captioned phone screenshots, EN + PL
 *
 * Serve the REPOSITORY ROOT over HTTP, then run:
 *   python3 .claude/skills/webapp-testing/scripts/with_server.py --server "python3 -m http.server 8790" --port 8790 \
 *     -- env NODE_PATH=$(npm root -g) node tools/store-assets.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const playwright = require('playwright');
const NH = require('./load-game');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8790/';
const OUT = path.join(__dirname, '..', 'docs', 'store');
const RAW = path.join(OUT, 'raw');
for (const d of [OUT, RAW]) fs.mkdirSync(d, { recursive: true });

const CAPTIONS = {
  en: {
    horde: 'Survive endless *neon hordes*',
    levelup: 'Pick *1 of 3 upgrades* every level',
    evolve: 'Evolve weapons into *ultimate forms*',
    boss: 'Defeat *giant bosses*',
    chapters: '*10 chapters* to conquer',
    gear: 'Collect and merge *rare gear*',
    offline: 'Your squad *earns while you rest*',
  },
  pl: {
    horde: 'Przetrwaj *neonowe hordy*',
    levelup: 'Co poziom *1 z 3 ulepszeń*',
    evolve: 'Ewoluuj broń do *potężnych form*',
    boss: 'Pokonuj *gigantycznych bossów*',
    chapters: '*10 rozdziałów* do zdobycia',
    gear: 'Zbieraj i łącz *rzadki ekwipunek*',
    offline: 'Oddział *zarabia, gdy odpoczywasz*',
  },
};

/** A mid-game save so lobby screens look like a real player's account. */
function demoSave(opts) {
  const { Save, Meta, C } = NH;
  const now = Date.now();
  const s = Save.defaults(now);
  s.tutorial.firstRunDone = true;
  s.lang = opts.lang;
  s.account = { level: 12, xp: 900 };
  s.coins = 48250; s.gems = 1340; s.scrap = 86; s.energy = 30;
  s.chapter = { unlocked: 4, selected: 4, cleared: 3, best: { 1: 431, 2: 452, 3: 470 } };
  s.inventory = []; s.nextUid = 1;
  s.equipped = { weapon: 0, armor: 0, gloves: 0, boots: 0, belt: 0, necklace: 0 };
  const eq = [['pistol', 3, 24], ['plate', 3, 22], ['fists', 2, 18], ['hovers', 3, 20], ['shieldbelt', 2, 15], ['pendant', 4, 12]];
  for (const [id, r, lv] of eq) { const it = Meta.addItem(s, id, r, lv); s.equipped[C.ITEMS[id].slot] = it.uid; }
  const bag = [['teslarod', 2, 1], ['teslarod', 2, 1], ['rocketpod', 3, 5], ['vest', 1, 4], ['grips', 1, 1], ['runners', 0, 1], ['chip', 2, 3], ['utility', 1, 1], ['discthrower', 1, 2], ['frostwand', 2, 1]];
  for (const [id, r, lv] of bag) Meta.addItem(s, id, r, lv);
  s.talents = { atk: 12, hp: 10, def: 6, regen: 5, pickup: 4, coins: 7 };
  s.codex = { photon: true, thunder: true, singularity: true };
  s.stats.runs = 23; s.stats.kills = 61230;
  Meta.ensureDaily(s, now, NH.U.rng(1));
  s.daily.ads = 7; s.daily.adTrackerClaimed = [0, 1];
  s.patrol.lastClaim = now - (opts.awayHours || 0.4) * 3600e3;
  s.lastSeen = now - (opts.awayHours || 0) * 3600e3;
  s.freeGoldReadyAt = now + 2.4 * 3600e3;
  return s;
}

async function newPage(browser, lang, save) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    locale: lang === 'pl' ? 'pl-PL' : 'en-US',
  });
  if (save) await ctx.addInitScript((json) => { localStorage.setItem('neonhorde.save.v1', json); }, JSON.stringify(save));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts a run and dresses it up with a strong, readable build. */
async function battle(page, chapter, t, setup) {
  await page.evaluate(({ chapter, t, setup }) => {
    NH.G.startRun(chapter, { free: true });
    const w = NH.G.world;
    for (const [id, lvl, evo] of setup.weapons) {
      const wp = w.weapon(id) || w.addWeapon(id, lvl);
      wp.level = lvl; wp.evolved = !!evo;
    }
    Object.assign(w.passives, setup.passives);
    w.recalc();
    w.hero.maxHp = 1e7; w.hero.hp = 0.82e7;
    w.t = t;
    // huge XP requirement keeps random level-ups from covering the scene; the bar still shows ~62%
    w.level = setup.level; w.xpNeed = 1e12; w.xp = w.xpNeed * 0.62;
    w.kills = setup.kills;
    NH.RunUI.skillsDirty = true;
  }, { chapter, t, setup });
}

async function crowd(page, n) {
  await page.evaluate((n) => {
    const w = NH.G.world, h = w.hero;
    const types = Object.keys(NH.C.ENEMIES);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
      w.spawnEnemy(types[i % types.length], { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d * 1.4 }, false);
    }
  }, n);
}

async function walk(page, ms) {
  const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  const end = Date.now() + ms;
  let k = 0;
  while (Date.now() < end) { await page.keyboard.down(keys[k % 4]); await sleep(420); await page.keyboard.up(keys[k % 4]); k++; }
}

const BUILD = {
  weapons: [['blaster', 5, true], ['orbit', 5, false], ['lightning', 5, true], ['drone', 4, false], ['rocket', 3, false]],
  passives: { overclock: 4, energycell: 3, nanoarmor: 2, aicore: 3, magnet: 2 },
  level: 27, kills: 1843,
};

async function captureRaw(browser, lang) {
  const shots = {};
  const url = BASE + 'game/index.html?noads=1';
  // --- battle scenes
  {
    const page = await newPage(browser, lang, demoSave({ lang }));
    await page.goto(url); await page.waitForLoadState('networkidle'); await sleep(1500);
    await battle(page, 3, 330, BUILD);
    await crowd(page, 150);
    await walk(page, 2600);
    await page.evaluate(() => { const w = NH.G.world; NH.UI.closeAll(); w.pendingCrate = false; w.pendingLevels = 0; w.state = 'play'; });
    await crowd(page, 140);
    await sleep(330);
    shots.horde = path.join(RAW, lang + '-horde.png');
    await page.screenshot({ path: shots.horde });
    // level-up
    await page.evaluate(() => { const w = NH.G.world; w.pendingLevels = 1; w.state = 'levelup'; w.ev.emit('levelupReady', w.level); });
    await sleep(900);
    shots.levelup = path.join(RAW, lang + '-levelup.png');
    await page.screenshot({ path: shots.levelup });
    for (let i = 0; i < 6 && await page.locator('.lu-card').last().isVisible().catch(() => false); i++) {
      await page.locator('.modal.levelup').last().locator('.lu-card').first().tap();
      await sleep(450);
    }
    // evolution crate
    await page.evaluate(() => {
      const w = NH.G.world;
      const d = w.weapon('disc') || w.addWeapon('disc', 5); d.level = 5; d.evolved = false;
      w.passives.exoboots = 1; w.recalc();
      for (const x of w.weapons) if (x.id !== 'disc' && !x.evolved) x.level = Math.min(x.level, 4);
      w.state = 'crate'; w.ev.emit('crateReady');
    });
    await sleep(1600);
    shots.evolve = path.join(RAW, lang + '-evolve.png');
    await page.screenshot({ path: shots.evolve });
    await page.context().close();
  }
  {
    const page = await newPage(browser, lang, demoSave({ lang }));
    await page.goto(url); await page.waitForLoadState('networkidle'); await sleep(1500);
    await battle(page, 5, 478, BUILD);
    await sleep(3200);
    await walk(page, 1800);
    shots.boss = path.join(RAW, lang + '-boss.png');
    await page.screenshot({ path: shots.boss });
    await page.context().close();
  }
  // --- lobby scenes
  {
    const page = await newPage(browser, lang, demoSave({ lang }));
    await page.goto(url); await page.waitForLoadState('networkidle'); await sleep(1800);
    shots.chapters = path.join(RAW, lang + '-chapters.png');
    await page.screenshot({ path: shots.chapters });
    await page.locator('[data-tab="gear"]').tap(); await sleep(800);
    shots.gear = path.join(RAW, lang + '-gear.png');
    await page.screenshot({ path: shots.gear });
    await page.context().close();
  }
  {
    const page = await newPage(browser, lang, demoSave({ lang, awayHours: 7.5 }));
    await page.goto(url); await page.waitForLoadState('networkidle'); await sleep(2000);
    shots.offline = path.join(RAW, lang + '-offline.png');
    await page.screenshot({ path: shots.offline });
    await page.context().close();
  }
  return shots;
}

async function frame(browser, lang, key, raw, idx) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const rel = path.relative(path.join(__dirname, '..'), raw).split(path.sep).join('/');
  await page.goto(BASE + 'tools/store/frame.html?img=' + encodeURIComponent('/' + rel) + '&caption=' + encodeURIComponent(CAPTIONS[lang][key]));
  await page.waitForSelector('body[data-ready="1"]');
  const dir = path.join(OUT, 'screenshots', lang);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, String(idx).padStart(2, '0') + '-' + key + '.png');
  await page.screenshot({ path: file });
  await page.close();
  return file;
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  // icon + feature graphic
  for (const [mode, w, h, file, type] of [['icon', 512, 512, 'icon-512.png', 'png'], ['feature', 1024, 500, 'feature-graphic.jpg', 'jpeg']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(BASE + 'tools/store/art.html?mode=' + mode);
    await page.waitForSelector('body[data-ready="1"]');
    await page.screenshot({ path: path.join(OUT, file), type, quality: type === 'jpeg' ? 95 : undefined });
    await page.close();
    console.log('rendered', file);
  }
  const order = ['horde', 'evolve', 'boss', 'levelup', 'gear', 'chapters', 'offline'];
  for (const lang of ['en', 'pl']) {
    const raw = await captureRaw(browser, lang);
    let i = 1;
    for (const key of order) console.log('framed', path.relative(OUT, await frame(browser, lang, key, raw[key], i++)));
  }
  await browser.close();
  fs.rmSync(RAW, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
