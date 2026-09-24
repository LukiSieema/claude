'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const NH = require('../../tools/load-game');
const { U, C, Save, Meta } = NH;

const T0 = new Date(2026, 8, 24, 12, 0, 0).getTime();
const HOUR = 3600e3;

function fresh() {
  const s = Save.defaults(T0);
  Meta.ensureDaily(s, T0, U.rng(1));
  return s;
}

test('hero stats grow with gear, rarity and talents', () => {
  const s = fresh();
  const base = Meta.heroStats(s);
  const it = Meta.getItem(s, s.equipped.weapon);
  it.level = 10;
  const leveled = Meta.heroStats(s);
  assert.ok(leveled.atk > base.atk);
  it.rarity = 3; // epic: +10% dmg perk and starting skill Lv 2
  const epic = Meta.heroStats(s);
  assert.ok(epic.atk > leveled.atk);
  assert.equal(epic.startLevel, 2);
  assert.ok(epic.dmgMult > 1);
  s.talents.atk = 10;
  assert.ok(Meta.heroStats(s).atk > epic.atk);
  assert.equal(epic.startWeapon, 'blaster');
});

test('upgrade costs coins + scrap, respects max level and counts for the quest', () => {
  const s = fresh();
  s.coins = 10_000; s.scrap = 100;
  s.daily.quests = [{ id: 'upgrade', target: 1, pts: 20, progress: 0, claimed: false }];
  const uid = s.equipped.armor;
  const before = { coins: s.coins, scrap: s.scrap };
  const r = Meta.upgradeItem(s, uid);
  assert.ok(r.ok);
  assert.equal(Meta.getItem(s, uid).level, 2);
  assert.equal(s.coins, before.coins - r.cost.coins);
  assert.equal(s.scrap, before.scrap - r.cost.scrap);
  assert.equal(s.daily.quests[0].progress, 1);
  Meta.getItem(s, uid).level = C.RARITIES[0].maxLevel;
  assert.equal(Meta.upgradeCheck(s, uid).reason, 'max');
  s.coins = 0;
  Meta.getItem(s, uid).level = 1;
  assert.equal(Meta.upgradeCheck(s, uid).reason, 'coins');
});

test('merge: 3 same-slot same-rarity items → next rarity, refunds fodder coins', () => {
  const s = fresh();
  const main = Meta.getItem(s, s.equipped.armor); // vest, common
  const a = Meta.addItem(s, 'plate', 0, 4); a.spent = 300;
  const b = Meta.addItem(s, 'vest', 0, 2); b.spent = 100;
  const coins = s.coins;
  assert.ok(Meta.canMerge(s, main.uid));
  const r = Meta.merge(s, main.uid);
  assert.equal(r.item.rarity, 1);
  assert.equal(r.item.level, 4, 'keeps the highest level');
  assert.equal(s.coins, coins + 400);
  assert.equal(s.inventory.filter((i) => C.ITEMS[i.id].slot === 'armor').length, 1);
});

test('merge: weapons need the same weapon type', () => {
  const s = fresh();
  const main = Meta.getItem(s, s.equipped.weapon); // pistol
  Meta.addItem(s, 'teslarod', 0, 1);
  Meta.addItem(s, 'flamer', 0, 1);
  assert.equal(Meta.canMerge(s, main.uid), false);
  Meta.addItem(s, 'pistol', 0, 1);
  Meta.addItem(s, 'pistol', 0, 1);
  assert.equal(Meta.canMerge(s, main.uid), true);
});

test('mergeAll merges everything possible, cascading rarities', () => {
  const s = fresh();
  s.inventory = []; s.equipped = { weapon: 0, armor: 0, gloves: 0, boots: 0, belt: 0, necklace: 0 };
  for (let i = 0; i < 9; i++) Meta.addItem(s, 'chip', 0, 1);
  const res = Meta.mergeAll(s);
  const chips = s.inventory.filter((i) => i.id === 'chip');
  assert.equal(chips.length, 1);
  assert.equal(chips[0].rarity, 2, '9 commons → 3 greats → 1 rare');
  assert.equal(res.length, 4);
});

test('salvage gives scrap and refuses equipped items', () => {
  const s = fresh();
  assert.equal(Meta.salvage(s, s.equipped.weapon), null);
  const it = Meta.addItem(s, 'grips', 2, 6);
  s.equipped.gloves = 0;
  const scrap = s.scrap;
  const v = Meta.salvage(s, it.uid);
  assert.ok(v.scrap > 0);
  assert.equal(s.scrap, scrap + v.scrap);
});

test('talents are capped by account level', () => {
  const s = fresh();
  s.coins = 1e9;
  for (let i = 0; i < 10; i++) Meta.upgradeTalent(s, 'atk');
  assert.equal(s.talents.atk, C.talentCap(1));
  assert.equal(Meta.talentCheck(s, 'atk').reason, 'cap');
});

test('energy regenerates over time and is spent per run', () => {
  const s = fresh();
  assert.ok(Meta.spendEnergy(s, T0, C.ENERGY.runCost));
  assert.equal(s.energy, C.ENERGY.max - C.ENERGY.runCost);
  Meta.updateEnergy(s, T0 + C.ENERGY.regenSec * 1000 * 2 + 10);
  assert.equal(s.energy, C.ENERGY.max - C.ENERGY.runCost + 2);
  Meta.updateEnergy(s, T0 + 100 * HOUR);
  assert.equal(s.energy, C.ENERGY.max, 'regen stops at max');
  s.energy = 2;
  assert.equal(Meta.spendEnergy(s, T0 + 100 * HOUR, C.ENERGY.runCost), false);
});

test('patrol accrues up to the cap and ×3 multiplies the claim', () => {
  const s = fresh();
  s.patrol.lastClaim = T0;
  const p2 = Meta.patrolPending(s, T0 + 2 * HOUR);
  assert.equal(Math.round(p2.seconds), 7200);
  const capped = Meta.patrolPending(s, T0 + 48 * HOUR);
  assert.equal(capped.seconds, C.PATROL.capHours * 3600);
  assert.ok(capped.full);
  const coins = s.coins;
  const r = Meta.claimPatrol(s, T0 + 2 * HOUR, 3, U.rng(2));
  assert.equal(r.coins, p2.coins * 3);
  assert.equal(s.coins, coins + r.coins);
  assert.equal(Meta.patrolPending(s, T0 + 2 * HOUR).seconds, 0);
});

test('quick patrol: 1 free, 3 ads per day, then gems', () => {
  const s = fresh();
  const rng = U.rng(3);
  assert.ok(Meta.quickPatrol(s, 'free', rng));
  assert.equal(Meta.quickPatrol(s, 'free', rng), null);
  for (let i = 0; i < C.PATROL.quickAdPerDay; i++) assert.ok(Meta.quickPatrol(s, 'ad', rng));
  assert.equal(Meta.quickPatrol(s, 'ad', rng), null);
  s.gems = 0;
  assert.equal(Meta.quickPatrol(s, 'gems', rng), null);
  s.gems = C.PATROL.quickGemCost;
  assert.ok(Meta.quickPatrol(s, 'gems', rng));
  assert.equal(s.gems, 0);
});

test('free gold crate: cooldown, and the rewarded ad cuts 80% of the wait', () => {
  const s = fresh();
  const rng = U.rng(4);
  assert.equal(Meta.claimFreeGold(s, T0, rng).length, 1);
  assert.equal(Meta.claimFreeGold(s, T0, rng), null);
  const rem = Meta.freeGoldIn(s, T0 + HOUR);
  Meta.cutFreeGold(s, T0 + HOUR);
  assert.ok(Math.abs(Meta.freeGoldIn(s, T0 + HOUR) - rem * 0.2) < 1);
});

test('ad tracker milestones unlock with watched ads', () => {
  const s = fresh();
  const rng = U.rng(5);
  assert.equal(Meta.claimAdTracker(s, 0, rng), null);
  for (let i = 0; i < 3; i++) Meta.recordAd(s, T0);
  assert.ok(Meta.adTrackerClaimable(s));
  const g = Meta.claimAdTracker(s, 0, rng);
  assert.equal(g.gems, C.AD_TRACKER[0].reward.gems);
  assert.equal(Meta.claimAdTracker(s, 0, rng), null, 'claimed only once');
  assert.equal(s.stats.adsTotal, 3);
});

test('daily reset rolls 5 quests and resets counters on a new day', () => {
  const s = fresh();
  s.daily.ads = 9;
  assert.equal(Meta.ensureDaily(s, T0 + HOUR, U.rng(6)), false);
  assert.equal(Meta.ensureDaily(s, T0 + 25 * HOUR, U.rng(6)), true);
  assert.equal(s.daily.ads, 0);
  assert.equal(s.daily.quests.length, 5);
});

test('7-day login cycles and ×2 doubles', () => {
  const s = fresh();
  const rng = U.rng(7);
  const d1 = Meta.claimLogin(s, T0, 2, rng);
  assert.equal(d1.day, 0);
  assert.equal(d1.granted.coins, C.LOGIN_REWARDS[0].coins * 2);
  assert.equal(Meta.claimLogin(s, T0 + HOUR, 1, rng), null, 'once per day');
  for (let d = 1; d < 7; d++) assert.equal(Meta.claimLogin(s, T0 + d * 24 * HOUR, 1, rng).day, d);
  assert.equal(Meta.claimLogin(s, T0 + 7 * 24 * HOUR, 1, rng).day, 0, 'restarts after day 7');
});

test('run rewards unlock the next chapter and grant account xp', () => {
  const s = fresh();
  const rng = U.rng(8);
  const result = { chapter: 1, cleared: true, time: 500, kills: 3000, elites: 3, bossKilled: true, level: 31, evolutions: ['photon'], coins: 40 };
  const rewards = Meta.runRewards(s, result, rng);
  assert.ok(rewards.coins > 0 && rewards.xp > 0);
  assert.ok(rewards.items.length >= 1, 'boss clear drops gear');
  const out = Meta.applyRunRewards(s, result, rewards, 2);
  assert.equal(out.coins, rewards.coins * 2);
  assert.equal(s.chapter.cleared, 1);
  assert.equal(s.chapter.unlocked, 2);
  assert.equal(s.codex.photon, true);
  assert.equal(s.stats.kills, 3000);
  assert.ok(s.account.level >= 2);
});

test('interstitial pacing: no ads in the first runs, min gap, not right after a rewarded ad', () => {
  const s = fresh();
  s.stats.runs = 1;
  assert.equal(Meta.interstitialAllowed(s, T0), false);
  s.stats.runs = 5;
  s.ads.lastInterstitial = 0; s.ads.lastRewarded = 0;
  assert.equal(Meta.interstitialAllowed(s, T0), true);
  s.ads.lastInterstitial = T0 - 60e3;
  assert.equal(Meta.interstitialAllowed(s, T0), false);
  s.ads.lastInterstitial = 0; s.ads.lastRewarded = T0 - 30e3;
  assert.equal(Meta.interstitialAllowed(s, T0), false);
});

test('achievements pay gems once', () => {
  const s = fresh();
  s.stats.kills = 1000;
  const gems = s.gems;
  assert.equal(Meta.claimAchievement(s, 'kill1'), 50);
  assert.equal(s.gems, gems + 50);
  assert.equal(Meta.claimAchievement(s, 'kill1'), 0);
  assert.equal(Meta.claimAchievement(s, 'kill2'), 0);
});
