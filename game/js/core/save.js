/* Neon Horde — persistent state: defaults, load/save, migrations. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;

  const SAVE_VERSION = 1;

  function defaults(now) {
    return {
      v: SAVE_VERSION,
      created: now,
      lastSeen: now,
      lang: null,
      settings: { sound: true, music: true, haptics: true, quality: 'high', batterySaver: false, damageNumbers: true },
      coins: 300,
      gems: 80,
      scrap: 5,
      energy: C.ENERGY.max,
      energyTs: now,
      account: { level: 1, xp: 0 },
      chapter: { unlocked: 1, selected: 1, cleared: 0, best: {} },
      inventory: [
        { uid: 1, id: 'pistol', rarity: 0, level: 1, spent: 0 },
        { uid: 2, id: 'vest', rarity: 0, level: 1, spent: 0 },
        { uid: 3, id: 'runners', rarity: 0, level: 1, spent: 0 },
      ],
      equipped: { weapon: 1, armor: 2, gloves: 0, boots: 3, belt: 0, necklace: 0 },
      nextUid: 4,
      talents: { atk: 0, hp: 0, def: 0, regen: 0, pickup: 0, coins: 0 },
      patrol: { lastClaim: now },
      daily: null,
      login: { lastDay: 0, index: 0 },
      freeGoldReadyAt: now,
      adSilverReadyAt: now,
      stats: { kills: 0, runs: 0, bosses: 0, elites: 0, evolutions: 0, merges: 0, bestRunLevel: 0, adsTotal: 0, playTime: 0, chests: 0 },
      codex: {},
      achievements: {},
      tutorial: { firstRunDone: false, hints: {} },
      ads: { lastInterstitial: 0, lastRewarded: 0 },
      notifAsked: false,
      rated: false,
    };
  }

  function migrate(s, now) {
    // Future versions: transform older saves step by step here.
    if (!s.v || s.v < 1) s.v = 1;
    U.fillDefaults(s, defaults(now));
    // integrity: equipped uids must exist
    for (const slot of C.SLOTS) {
      const uid = s.equipped[slot];
      if (uid && !s.inventory.some((it) => it.uid === uid)) s.equipped[slot] = 0;
    }
    s.inventory = s.inventory.filter((it) => C.ITEMS[it.id] && it.rarity >= 0 && it.rarity < C.RARITIES.length);
    for (const it of s.inventory) {
      it.level = U.clamp(it.level | 0, 1, C.RARITIES[it.rarity].maxLevel);
      if (typeof it.spent !== 'number') it.spent = 0;
    }
    s.coins = Math.max(0, Number(s.coins) || 0);
    s.gems = Math.max(0, Number(s.gems) || 0);
    s.scrap = Math.max(0, Number(s.scrap) || 0);
    return s;
  }

  const Save = {
    storage: null,

    init(storage) {
      this.storage = storage || null;
    },

    load(now) {
      let raw = null;
      try { raw = this.storage && this.storage.getItem(C.SAVE_KEY); } catch (e) { raw = null; }
      if (!raw) {
        try { raw = this.storage && this.storage.getItem(C.SAVE_KEY + '.bak'); } catch (e) { raw = null; }
      }
      if (raw) {
        try { return migrate(JSON.parse(raw), now); } catch (e) { /* corrupted: fall back to defaults */ }
      }
      return defaults(now);
    },

    save(state) {
      if (!this.storage) return false;
      try {
        const json = JSON.stringify(state);
        const prev = this.storage.getItem(C.SAVE_KEY);
        if (prev) this.storage.setItem(C.SAVE_KEY + '.bak', prev);
        this.storage.setItem(C.SAVE_KEY, json);
        return true;
      } catch (e) {
        return false;
      }
    },

    wipe() {
      if (!this.storage) return;
      try { this.storage.removeItem(C.SAVE_KEY); this.storage.removeItem(C.SAVE_KEY + '.bak'); } catch (e) { /* ignore */ }
    },

    defaults,
    migrate,
  };

  NH.Save = Save;
  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
