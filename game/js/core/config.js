/* Neon Horde — all game data & balance constants. Tweak numbers here; tools/simulate.js validates them. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};

  const C = {};

  C.VERSION = '1.0.0';
  // Fill in before publishing (shown in the in-game privacy policy and used by release checks).
  C.DEVELOPER = { name: '', email: '', website: '' };
  C.SAVE_KEY = 'neonhorde.save.v1';

  // ---------- World / run ----------
  C.VIEW_WIDTH = 430;          // world units visible across the short screen side
  C.FIXED_DT = 1 / 60;
  C.RUN_LENGTH = 480;          // seconds until the boss spawns
  C.ELITE_TIMES = [120, 240, 360];
  C.MAX_ENEMIES = 320;
  C.MAX_GEMS = 260;            // beyond this, new XP merges into existing gems
  C.MAX_WEAPONS = 6;
  C.MAX_PASSIVES = 6;
  C.MAX_SKILL_LEVEL = 5;
  C.BOSS_ARENA_RADIUS = 330;
  C.REVIVE_INVULN = 3;

  C.HERO = {
    radius: 14, baseHp: 200, baseAtk: 20, speed: 132, pickup: 80,
    crit: 0.05, critMult: 2.0, contactCd: 0.5, hitInvuln: 0.12,
  };

  C.xpToNext = (level) => Math.round(4 + 3.5 * level + 0.35 * level * level);

  // ---------- Weapons ----------
  // dmg values are multipliers of hero ATK.
  C.WEAPONS = {
    blaster: {
      color: '#2ef2ff', pair: 'overclock', evo: 'photon',
      levels: [
        { cd: 0.85, dmg: 1.0, count: 1, pierce: 1, speed: 560, size: 1 },
        { cd: 0.85, dmg: 1.0, count: 2, pierce: 1, speed: 560, size: 1 },
        { cd: 0.8, dmg: 1.3, count: 2, pierce: 1, speed: 580, size: 1.1 },
        { cd: 0.8, dmg: 1.3, count: 3, pierce: 2, speed: 580, size: 1.1 },
        { cd: 0.65, dmg: 1.5, count: 4, pierce: 2, speed: 620, size: 1.2 },
      ],
      evoStats: { cd: 0.42, dmg: 1.9, count: 6, pierce: 5, speed: 740, size: 1.55 },
    },
    orbit: {
      color: '#b77bff', pair: 'nanoarmor', evo: 'singularity',
      levels: [
        { cd: 3.5, duration: 4, dmg: 0.7, count: 2, radius: 72, rot: 3.4 },
        { cd: 3.5, duration: 4, dmg: 0.7, count: 3, radius: 72, rot: 3.4 },
        { cd: 3.2, duration: 4, dmg: 0.95, count: 3, radius: 82, rot: 3.6 },
        { cd: 3.0, duration: 5, dmg: 0.95, count: 4, radius: 82, rot: 3.6 },
        { cd: 0, duration: 0, dmg: 1.1, count: 5, radius: 86, rot: 3.8 },
      ],
      evoStats: { cd: 0, duration: 0, dmg: 1.8, count: 6, radius: 104, rot: 4.3 },
    },
    lightning: {
      color: '#8fd4ff', pair: 'energycell', evo: 'thunder',
      levels: [
        { cd: 1.5, dmg: 1.1, strikes: 1, chains: 2, jump: 130, stun: 0 },
        { cd: 1.5, dmg: 1.1, strikes: 1, chains: 3, jump: 130, stun: 0 },
        { cd: 1.4, dmg: 1.45, strikes: 1, chains: 3, jump: 140, stun: 0 },
        { cd: 1.4, dmg: 1.45, strikes: 2, chains: 3, jump: 140, stun: 0 },
        { cd: 1.15, dmg: 1.6, strikes: 2, chains: 5, jump: 150, stun: 0 },
      ],
      evoStats: { cd: 0.9, dmg: 2.2, strikes: 4, chains: 8, jump: 175, stun: 0.35 },
    },
    firebomb: {
      color: '#ff8a3d', pair: 'fueltank', evo: 'inferno',
      levels: [
        { cd: 2.6, count: 1, radius: 52, duration: 3, dmg: 0.32 },
        { cd: 2.6, count: 2, radius: 52, duration: 3, dmg: 0.32 },
        { cd: 2.5, count: 2, radius: 64, duration: 3, dmg: 0.36 },
        { cd: 2.5, count: 3, radius: 64, duration: 3.5, dmg: 0.36 },
        { cd: 2.3, count: 3, radius: 68, duration: 4, dmg: 0.48 },
      ],
      evoStats: { cd: 2.1, count: 5, radius: 88, duration: 5, dmg: 0.62 },
    },
    drone: {
      color: '#7dff5a', pair: 'aicore', evo: 'swarm',
      levels: [
        { count: 1, cd: 1.3, dmg: 0.9, radius: 34 },
        { count: 2, cd: 1.3, dmg: 0.9, radius: 34 },
        { count: 2, cd: 1.2, dmg: 1.1, radius: 44 },
        { count: 3, cd: 1.2, dmg: 1.1, radius: 44 },
        { count: 3, cd: 0.9, dmg: 1.2, radius: 48 },
      ],
      evoStats: { count: 5, cd: 0.6, dmg: 1.45, radius: 54 },
    },
    disc: {
      color: '#ffe63d', pair: 'exoboots', evo: 'chakram',
      levels: [
        { cd: 1.7, count: 1, dmg: 1.05, range: 250, size: 1, speed: 420 },
        { cd: 1.7, count: 2, dmg: 1.05, range: 250, size: 1, speed: 420 },
        { cd: 1.6, count: 2, dmg: 1.3, range: 260, size: 1.3, speed: 440 },
        { cd: 1.6, count: 3, dmg: 1.3, range: 270, size: 1.3, speed: 440 },
        { cd: 1.45, count: 3, dmg: 1.6, range: 280, size: 1.35, speed: 500 },
      ],
      evoStats: { cd: 1.15, count: 6, dmg: 2.0, range: 330, size: 1.6, speed: 520 },
    },
    frost: {
      color: '#9ef0ff', pair: 'bioregen', evo: 'absolute',
      levels: [
        { cd: 2.6, radius: 105, dmg: 0.7, slow: 0.4, slowDur: 1.5, freeze: 0 },
        { cd: 2.6, radius: 125, dmg: 0.7, slow: 0.4, slowDur: 1.5, freeze: 0 },
        { cd: 2.5, radius: 125, dmg: 1.0, slow: 0.45, slowDur: 1.6, freeze: 0 },
        { cd: 2.0, radius: 130, dmg: 1.0, slow: 0.45, slowDur: 1.6, freeze: 0 },
        { cd: 2.0, radius: 142, dmg: 1.15, slow: 0.5, slowDur: 1.8, freeze: 0.5 },
      ],
      evoStats: { cd: 1.7, radius: 210, dmg: 1.6, slow: 0.6, slowDur: 2.0, freeze: 1.1 },
    },
    rocket: {
      color: '#ff4d6d', pair: 'magnet', evo: 'nuke',
      levels: [
        { cd: 2.3, count: 1, dmg: 2.1, radius: 64, speed: 300 },
        { cd: 2.3, count: 1, dmg: 2.7, radius: 64, speed: 310 },
        { cd: 2.2, count: 2, dmg: 2.7, radius: 70, speed: 320 },
        { cd: 2.2, count: 2, dmg: 2.9, radius: 84, speed: 320 },
        { cd: 1.9, count: 3, dmg: 3.0, radius: 88, speed: 330 },
      ],
      evoStats: { cd: 1.6, count: 5, dmg: 3.4, radius: 122, speed: 350 },
    },
  };
  C.WEAPON_IDS = Object.keys(C.WEAPONS);

  // ---------- Passives ----------
  C.PASSIVES = {
    overclock: { color: '#2ef2ff' },   // cooldown -8% / lvl
    energycell: { color: '#ffe63d' },  // damage +10% / lvl
    magnet: { color: '#ff4d6d' },      // pickup radius +30% / lvl
    nanoarmor: { color: '#b77bff' },   // damage taken -6% / lvl
    exoboots: { color: '#ffe63d' },    // move speed +8% / lvl
    fueltank: { color: '#ff8a3d' },    // area +10%, duration +10% / lvl
    aicore: { color: '#7dff5a' },      // +1 projectile at lvl 3 and 5, +4% dmg / lvl
    bioregen: { color: '#7dff5a' },    // +0.4 HP/s and +6% max HP / lvl
  };
  C.PASSIVE_IDS = Object.keys(C.PASSIVES);

  C.passiveEffects = (p) => {
    const L = (id) => p[id] || 0;
    return {
      cdMult: 1 - 0.08 * L('overclock'),
      dmgMult: 1 + 0.10 * L('energycell') + 0.04 * L('aicore'),
      pickupMult: 1 + 0.30 * L('magnet'),
      takenMult: 1 - 0.06 * L('nanoarmor'),
      speedMult: 1 + 0.08 * L('exoboots'),
      areaMult: 1 + 0.10 * L('fueltank'),
      durationMult: 1 + 0.10 * L('fueltank'),
      extraProj: L('aicore') >= 5 ? 2 : L('aicore') >= 3 ? 1 : 0,
      regen: 0.4 * L('bioregen'),
      hpMult: 1 + 0.06 * L('bioregen'),
    };
  };

  C.EVOLUTIONS = {
    photon: { from: 'blaster', pair: 'overclock', color: '#6ff8ff' },
    singularity: { from: 'orbit', pair: 'nanoarmor', color: '#d19bff' },
    thunder: { from: 'lightning', pair: 'energycell', color: '#c8ecff' },
    inferno: { from: 'firebomb', pair: 'fueltank', color: '#ffb35c' },
    swarm: { from: 'drone', pair: 'aicore', color: '#b6ff8f' },
    chakram: { from: 'disc', pair: 'exoboots', color: '#fff27a' },
    absolute: { from: 'frost', pair: 'bioregen', color: '#dffbff' },
    nuke: { from: 'rocket', pair: 'magnet', color: '#ff8aa0' },
  };

  // ---------- Enemies ----------
  C.ENEMIES = {
    glitchling: { hp: 14, speed: 58, dmg: 10, r: 12, xp: 1, shape: 'tri', color: '#ff3d7f', mass: 1 },
    swarmer: { hp: 7, speed: 92, dmg: 6, r: 8, xp: 1, shape: 'dot', color: '#ffb13d', mass: 0.6 },
    brute: { hp: 80, speed: 40, dmg: 18, r: 22, xp: 4, shape: 'square', color: '#b04dff', mass: 3 },
    spitter: { hp: 28, speed: 46, dmg: 10, r: 14, xp: 3, shape: 'hex', color: '#3dffb4', mass: 1, ranged: { range: 230, cd: 2.6, speed: 190, dmg: 10 } },
    dasher: { hp: 34, speed: 52, dmg: 14, r: 13, xp: 3, shape: 'diamond', color: '#ffe63d', mass: 1.2, dash: { range: 280, speed: 360, time: 0.55, cd: 3.2 } },
    splitter: { hp: 45, speed: 48, dmg: 12, r: 18, xp: 2, shape: 'pent', color: '#3db7ff', mass: 2, split: { type: 'swarmer', count: 3 } },
    bomber: { hp: 22, speed: 72, dmg: 26, r: 13, xp: 2, shape: 'bomb', color: '#ff6b2b', mass: 1, explode: { radius: 58, trigger: 34 } },
  };
  C.ELITE = { hpMult: 9, sizeMult: 1.45, dmgMult: 1.4, speedMult: 1.1, xp: 25 };

  C.BOSSES = {
    titan: { hp: 2600, r: 48, speed: 42, dmg: 24, color: '#ff3d7f' },
    hive: { hp: 3800, r: 52, speed: 40, dmg: 24, color: '#ffb13d' },
    serpent: { hp: 4600, r: 24, speed: 118, dmg: 22, color: '#b04dff', segments: 14 },
    prism: { hp: 5400, r: 44, speed: 38, dmg: 28, color: '#3dffb4' },
    king: { hp: 7200, r: 56, speed: 50, dmg: 30, color: '#ffe63d' },
  };

  // Minute-based spawn mix (weights). Chapters add a "favored" enemy.
  C.WAVE_MIX = [
    { glitchling: 10 },
    { glitchling: 7, swarmer: 3 },
    { glitchling: 6, swarmer: 3, brute: 1.2 },
    { glitchling: 5, swarmer: 3, brute: 1.5, spitter: 1.5 },
    { glitchling: 4, swarmer: 3, brute: 2, spitter: 2, dasher: 1.5 },
    { glitchling: 3, swarmer: 3, brute: 2, spitter: 2, dasher: 2, splitter: 1.5 },
    { glitchling: 3, swarmer: 3, brute: 2.5, spitter: 2, dasher: 2, splitter: 2, bomber: 1.5 },
    { glitchling: 2, swarmer: 4, brute: 3, spitter: 2.5, dasher: 2.5, splitter: 2, bomber: 2 },
  ];
  C.spawnRate = (t, chapter) => 1.0 + (t / 60) * 1.3 + chapter * 0.08; // enemies per second
  C.aliveCap = (t) => Math.min(C.MAX_ENEMIES, 60 + (t / 60) * 32);
  C.enemyHpScale = (t) => { const m = t / 60; return 1 + m * 0.28 + m * m * 0.025; };
  C.enemyDmgScale = (t) => 1 + (t / 60) * 0.07;

  // Scripted wave events (seconds).
  C.WAVE_EVENTS = [
    { t: 90, type: 'ring', enemy: 'swarmer', count: 26 },
    { t: 165, type: 'rush', enemy: 'glitchling', count: 22 },
    { t: 210, type: 'ring', enemy: 'glitchling', count: 30 },
    { t: 285, type: 'rush', enemy: 'dasher', count: 12 },
    { t: 330, type: 'ring', enemy: 'swarmer', count: 40 },
    { t: 390, type: 'rain', enemy: 'bomber', count: 14 },
    { t: 430, type: 'ring', enemy: 'brute', count: 16 },
  ];

  C.CHAPTERS = [
    { boss: 'titan', hp: 1.0, dmg: 1.0, favor: 'glitchling', palette: { bg: '#0d0b24', bg2: '#1a0f3d', grid: '#2a2466', accent: '#ff3d7f' } },
    { boss: 'hive', hp: 2.1, dmg: 1.3, favor: 'swarmer', palette: { bg: '#0b1426', bg2: '#10284a', grid: '#1e3f73', accent: '#ffb13d' } },
    { boss: 'serpent', hp: 4.2, dmg: 1.7, favor: 'splitter', palette: { bg: '#130b26', bg2: '#2b0f45', grid: '#48226e', accent: '#b04dff' } },
    { boss: 'prism', hp: 7.5, dmg: 2.2, favor: 'spitter', palette: { bg: '#081c1e', bg2: '#0c3336', grid: '#155c5a', accent: '#3dffb4' } },
    { boss: 'king', hp: 13, dmg: 2.8, favor: 'dasher', palette: { bg: '#1c1608', bg2: '#3a2c0c', grid: '#6b5215', accent: '#ffe63d' } },
    { boss: 'titan', hp: 22, dmg: 3.5, favor: 'brute', mk: 2, palette: { bg: '#200a14', bg2: '#3d0f24', grid: '#6e1d3f', accent: '#ff5d8f' } },
    { boss: 'hive', hp: 36, dmg: 4.3, favor: 'bomber', mk: 2, palette: { bg: '#0a1020', bg2: '#16213f', grid: '#2c3f7a', accent: '#7aa2ff' } },
    { boss: 'serpent', hp: 58, dmg: 5.2, favor: 'swarmer', mk: 2, palette: { bg: '#0f0a1f', bg2: '#251344', grid: '#3f2a7a', accent: '#d19bff' } },
    { boss: 'prism', hp: 90, dmg: 6.2, favor: 'spitter', mk: 2, palette: { bg: '#07181a', bg2: '#0f2e2a', grid: '#1b5c4d', accent: '#7dffcf' } },
    { boss: 'king', hp: 140, dmg: 7.4, favor: 'dasher', mk: 2, palette: { bg: '#1a0a06', bg2: '#3d140a', grid: '#7a2c15', accent: '#ff8a3d' } },
  ];

  // ---------- Drops ----------
  C.DROPS = { coinChance: 0.09, heartChance: 0.008, magnetChance: 0.0035, bombChance: 0.0025 };
  C.GEM_TIERS = [ // value thresholds -> color
    { min: 1, color: '#3fa9ff', r: 5 },
    { min: 5, color: '#4be37a', r: 6 },
    { min: 20, color: '#b562ff', r: 7 },
    { min: 80, color: '#ffc83d', r: 8.5 },
  ];

  // ---------- Meta progression ----------
  C.RARITIES = [
    { id: 'common', color: '#9aa4b8', mult: 1.0, maxLevel: 10 },
    { id: 'great', color: '#4be37a', mult: 1.5, maxLevel: 20 },
    { id: 'rare', color: '#3fa9ff', mult: 2.2, maxLevel: 30 },
    { id: 'epic', color: '#b562ff', mult: 3.2, maxLevel: 40 },
    { id: 'legendary', color: '#ffb830', mult: 4.6, maxLevel: 50 },
    { id: 'mythic', color: '#ff4d6d', mult: 6.6, maxLevel: 60 },
  ];

  C.SLOTS = ['weapon', 'armor', 'gloves', 'boots', 'belt', 'necklace'];
  C.SLOT_STAT = { weapon: 'atk', armor: 'hp', gloves: 'atk', boots: 'hp', belt: 'hp', necklace: 'atk' };
  C.SLOT_BASE = { weapon: 8, armor: 40, gloves: 4, boots: 24, belt: 30, necklace: 4 };

  C.ITEMS = {
    // weapons: grant a starting skill
    pistol: { slot: 'weapon', weapon: 'blaster', bias: 1.0 },
    gauntlet: { slot: 'weapon', weapon: 'orbit', bias: 1.05 },
    teslarod: { slot: 'weapon', weapon: 'lightning', bias: 1.0 },
    flamer: { slot: 'weapon', weapon: 'firebomb', bias: 1.05 },
    dronepad: { slot: 'weapon', weapon: 'drone', bias: 0.95 },
    discthrower: { slot: 'weapon', weapon: 'disc', bias: 1.0 },
    frostwand: { slot: 'weapon', weapon: 'frost', bias: 1.0 },
    rocketpod: { slot: 'weapon', weapon: 'rocket', bias: 1.0 },
    vest: { slot: 'armor', bias: 1.0 },
    plate: { slot: 'armor', bias: 1.1 },
    grips: { slot: 'gloves', bias: 1.0 },
    fists: { slot: 'gloves', bias: 1.1 },
    runners: { slot: 'boots', bias: 1.0 },
    hovers: { slot: 'boots', bias: 1.1 },
    utility: { slot: 'belt', bias: 1.0 },
    shieldbelt: { slot: 'belt', bias: 1.1 },
    chip: { slot: 'necklace', bias: 1.0 },
    pendant: { slot: 'necklace', bias: 1.1 },
  };
  C.ITEM_IDS = Object.keys(C.ITEMS);

  // Rarity perks unlocked from Rare (index 2) upwards. Each perk: [minRarityIndex, stat, value]
  C.SLOT_PERKS = {
    weapon: [[2, 'dmgPct', 0.10], [3, 'startLevel', 1], [4, 'startProj', 1], [5, 'dmgPct', 0.20]],
    armor: [[2, 'hpPct', 0.08], [3, 'takenPct', 0.08], [4, 'regen', 1.0], [5, 'takenPct', 0.12]],
    gloves: [[2, 'crit', 0.05], [3, 'critDmg', 0.30], [4, 'atkPct', 0.08], [5, 'crit', 0.10]],
    boots: [[2, 'speedPct', 0.06], [3, 'pickupPct', 0.20], [4, 'speedPct', 0.08], [5, 'pickupPct', 0.15]],
    belt: [[2, 'hpPct', 0.08], [3, 'healPct', 0.25], [4, 'hpPct', 0.15], [5, 'freeRevive', 1]],
    necklace: [[2, 'xpPct', 0.10], [3, 'coinPct', 0.15], [4, 'cdPct', 0.08], [5, 'xpPct', 0.15]],
  };

  C.itemStat = (item) => {
    const def = C.ITEMS[item.id];
    const r = C.RARITIES[item.rarity];
    return Math.round(C.SLOT_BASE[def.slot] * def.bias * r.mult * (1 + 0.12 * (item.level - 1)));
  };
  C.upgradeCost = (item) => ({
    coins: Math.round(60 * Math.pow(1.14, item.level - 1) * (1 + item.rarity * 0.35)),
    scrap: 1 + Math.floor(item.level / 4),
  });

  C.TALENTS = {
    atk: { per: 0.03, icon: 'atk' },
    hp: { per: 0.04, icon: 'hp' },
    def: { per: 0.01, icon: 'def', max: 30 },
    regen: { per: 0.15, icon: 'regen' },
    pickup: { per: 0.04, icon: 'pickup' },
    coins: { per: 0.03, icon: 'coins' },
  };
  C.TALENT_IDS = Object.keys(C.TALENTS);
  C.talentCost = (lvl) => Math.round(150 * Math.pow(1.2, lvl));
  C.talentCap = (accountLevel) => accountLevel * 3;

  C.accountXpToNext = (level) => 80 + level * 60 + level * level * 6;

  C.ENERGY = { max: 30, regenSec: 360, runCost: 5, adAmount: 15, gemCost: 50, gemAmount: 15 };

  C.PATROL = {
    capHours: 12,
    coinsPerHour: (best) => Math.round(360 * (1 + 0.55 * best)),
    xpPerHour: (best) => Math.round(30 * (1 + 0.3 * best)),
    scrapPerHour: (best) => 2 + best * 0.5,
    gearPerHour: 0.15,
    quickHours: 2,
    quickFreePerDay: 1,
    quickAdPerDay: 3,
    quickGemCost: 60,
    minClaimSec: 60,
    offlinePopupSec: 300,
  };

  C.CHESTS = {
    silver: { cost: 80, odds: [[0, 70], [1, 27], [2, 3]] },
    gold: { cost: 300, odds: [[1, 45], [2, 43], [3, 11], [4, 1]] },
    super: { cost: 0, odds: [[3, 70], [4, 28], [5, 2]] },
  };
  C.FREE_GOLD_COOLDOWN = 8 * 3600;
  C.FREE_GOLD_AD_CUT = 0.8; // "skrócenie czasu oczekiwania o 80%"
  C.AD_SILVER_PER_DAY = 2;
  C.FREE_GEMS_AD = { perDay: 3, amount: 25 };

  C.AD_TRACKER = [
    { ads: 3, reward: { gems: 40 } },
    { ads: 6, reward: { chest: 'gold' } },
    { ads: 10, reward: { gems: 120, energy: 15 } },
    { ads: 15, reward: { chest: 'super' } },
  ];

  C.LOGIN_REWARDS = [
    { coins: 2000 }, { gems: 60 }, { energy: 20 }, { chest: 'silver' }, { gems: 120 }, { scrap: 20 }, { chest: 'gold' },
  ];

  C.QUESTS = [
    { id: 'kills', target: 300, pts: 20 },
    { id: 'runs', target: 2, pts: 20 },
    { id: 'patrol', target: 1, pts: 20 },
    { id: 'upgrade', target: 1, pts: 20 },
    { id: 'ads', target: 2, pts: 20 },
    { id: 'chest', target: 1, pts: 20 },
    { id: 'elites', target: 2, pts: 20 },
  ];
  C.ACTIVITY_MILESTONES = [
    { pts: 20, reward: { coins: 1500 } },
    { pts: 40, reward: { gems: 30 } },
    { pts: 60, reward: { energy: 10 } },
    { pts: 80, reward: { chest: 'silver' } },
    { pts: 100, reward: { gems: 80 } },
  ];

  C.ACHIEVEMENTS = [
    { id: 'kill1', stat: 'kills', target: 1000, gems: 50 },
    { id: 'kill2', stat: 'kills', target: 10000, gems: 150 },
    { id: 'kill3', stat: 'kills', target: 100000, gems: 400 },
    { id: 'ch1', stat: 'bestChapter', target: 1, gems: 50 },
    { id: 'ch3', stat: 'bestChapter', target: 3, gems: 120 },
    { id: 'ch5', stat: 'bestChapter', target: 5, gems: 250 },
    { id: 'ch10', stat: 'bestChapter', target: 10, gems: 800 },
    { id: 'evo1', stat: 'evolutions', target: 1, gems: 60 },
    { id: 'evo8', stat: 'codex', target: 8, gems: 400 },
    { id: 'lvl30', stat: 'bestRunLevel', target: 30, gems: 100 },
    { id: 'merge1', stat: 'merges', target: 1, gems: 40 },
    { id: 'merge10', stat: 'merges', target: 10, gems: 150 },
    { id: 'acc10', stat: 'accountLevel', target: 10, gems: 150 },
    { id: 'acc25', stat: 'accountLevel', target: 25, gems: 400 },
    { id: 'boss5', stat: 'bosses', target: 5, gems: 120 },
  ];

  C.RUN_REWARDS = {
    coinPerKill: 1.2,
    coinPerMinute: 40,
    clearBonus: (ch) => 600 + ch * 450,
    scrapOnClear: (ch) => 3 + ch * 2,
    chapterCoinMult: (ch) => 1 + ch * 0.35,
    accountXp: (kills, seconds, cleared, ch) => Math.round(kills / 5 + (seconds / 60) * 10 + (cleared ? 60 + ch * 25 : 0)),
    gearOnClear: (ch) => [[0, Math.max(0, 60 - ch * 8)], [1, 30], [2, 8 + ch * 3], [3, Math.max(0, ch * 2 - 2)], [4, ch >= 5 ? ch - 4 : 0]],
  };

  C.REVIVE = { gemCost: 40, maxAdRevives: 1, maxGemRevives: 1, timeout: 8 };

  C.ADS = {
    interstitialMinGap: 240,
    interstitialAfterRewardGap: 120,
    interstitialFreeRuns: 3,
    energyPerDay: 2,
    rerollPerRun: 2,
    takeAllPerRun: 1,
  };

  C.NOTIFY = { goldChest: 1001, patrolFull: 1002, energyFull: 1003, daily: 1004 };

  NH.C = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
