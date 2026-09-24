/* Neon Horde — meta progression rules (pure functions over the save state). */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};
  const U = NH.U, C = NH.C;

  const DAY = 86400;

  const Meta = {
    // ------------------------------------------------------------------ items
    getItem(s, uid) { return s.inventory.find((it) => it.uid === uid) || null; },
    equippedItem(s, slot) { return s.equipped[slot] ? this.getItem(s, s.equipped[slot]) : null; },
    isEquipped(s, uid) { return C.SLOTS.some((slot) => s.equipped[slot] === uid); },

    addItem(s, id, rarity, level) {
      const it = { uid: s.nextUid++, id, rarity, level: level || 1, spent: 0 };
      s.inventory.push(it);
      // auto-equip into empty slot
      const slot = C.ITEMS[id].slot;
      if (!s.equipped[slot]) s.equipped[slot] = it.uid;
      return it;
    },

    equip(s, uid) {
      const it = this.getItem(s, uid);
      if (!it) return false;
      s.equipped[C.ITEMS[it.id].slot] = uid;
      return true;
    },

    unequip(s, uid) {
      const it = this.getItem(s, uid);
      if (!it) return false;
      const slot = C.ITEMS[it.id].slot;
      if (slot === 'weapon') return false; // a weapon is always required
      if (s.equipped[slot] === uid) s.equipped[slot] = 0;
      return true;
    },

    upgradeCheck(s, uid) {
      const it = this.getItem(s, uid);
      if (!it) return { ok: false, reason: 'missing' };
      if (it.level >= C.RARITIES[it.rarity].maxLevel) return { ok: false, reason: 'max' };
      const cost = C.upgradeCost(it);
      if (s.coins < cost.coins) return { ok: false, reason: 'coins', cost };
      if (s.scrap < cost.scrap) return { ok: false, reason: 'scrap', cost };
      return { ok: true, cost };
    },

    upgradeItem(s, uid) {
      const chk = this.upgradeCheck(s, uid);
      if (!chk.ok) return chk;
      const it = this.getItem(s, uid);
      s.coins -= chk.cost.coins;
      s.scrap -= chk.cost.scrap;
      it.spent += chk.cost.coins;
      it.level++;
      this.questProgress(s, 'upgrade', 1);
      return chk;
    },

    /** Unequipped items of the same slot & rarity as `uid` (weapons: same weapon type) usable in a merge. */
    mergeFodder(s, uid) {
      const it = this.getItem(s, uid);
      if (!it || it.rarity >= C.RARITIES.length - 1) return [];
      const slot = C.ITEMS[it.id].slot;
      return s.inventory
        .filter((o) => o.uid !== uid && C.ITEMS[o.id].slot === slot && (slot !== 'weapon' || o.id === it.id) && o.rarity === it.rarity && !this.isEquipped(s, o.uid))
        .sort((a, b) => (a.id === it.id ? 0 : 1) - (b.id === it.id ? 0 : 1) || a.level - b.level);
    },

    canMerge(s, uid) { return this.mergeFodder(s, uid).length >= 2; },

    /**
     * Merge `uid` with two same-slot, same-rarity items → rarity + 1. The result keeps the highest level of the
     * three (with the coins paid for it); coins spent on the other two are refunded, so levels are never free.
     */
    merge(s, uid) {
      const it = this.getItem(s, uid);
      const fodder = this.mergeFodder(s, uid).slice(0, 2);
      if (!it || fodder.length < 2) return null;
      let best = it;
      for (const f of fodder) if (f.level > best.level) best = f;
      let refund = 0;
      for (const o of [it].concat(fodder)) if (o !== best) refund += o.spent;
      it.level = best.level;
      it.spent = best.spent;
      for (const f of fodder) s.inventory.splice(s.inventory.indexOf(f), 1);
      it.rarity++;
      s.coins += refund;
      s.stats.merges++;
      return { item: it, refund };
    },

    /** Merge everything possible (greedy, lowest rarity first). Returns merged items. */
    mergeAll(s) {
      const results = [];
      let changed = true;
      while (changed) {
        changed = false;
        const sorted = s.inventory.slice().sort((a, b) => a.rarity - b.rarity || (this.isEquipped(s, b.uid) ? 1 : 0) - (this.isEquipped(s, a.uid) ? 1 : 0) || b.level - a.level);
        for (const it of sorted) {
          if (!s.inventory.includes(it)) continue;
          if (this.canMerge(s, it.uid)) {
            const r = this.merge(s, it.uid);
            if (r) { results.push(r.item); changed = true; break; }
          }
        }
      }
      return results;
    },

    salvageValue(it) {
      return { scrap: [1, 3, 8, 20, 50, 120][it.rarity] + Math.floor(it.level / 3), coins: Math.round(it.spent * 0.8) };
    },

    salvage(s, uid) {
      const it = this.getItem(s, uid);
      if (!it || this.isEquipped(s, uid)) return null;
      const v = this.salvageValue(it);
      s.scrap += v.scrap;
      s.coins += v.coins;
      s.inventory.splice(s.inventory.indexOf(it), 1);
      return v;
    },

    // ------------------------------------------------------------ hero stats
    heroStats(s) {
      const t = s.talents;
      const st = {
        atk: C.HERO.baseAtk, hp: C.HERO.baseHp,
        atkPct: 0, hpPct: 0, takenMult: 1, regen: 0, speedMult: 1, pickupMult: 1,
        crit: C.HERO.crit, critMult: C.HERO.critMult, xpMult: 1, coinMult: 1, cdMult: 1, dmgMult: 1,
        startWeapon: 'blaster', startLevel: 1, startProj: 0, healMult: 1, freeRevives: 0,
      };
      for (const slot of C.SLOTS) {
        const it = this.equippedItem(s, slot);
        if (!it) continue;
        const def = C.ITEMS[it.id];
        const val = C.itemStat(it);
        if (C.SLOT_STAT[slot] === 'atk') st.atk += val; else st.hp += val;
        if (slot === 'weapon') st.startWeapon = def.weapon;
        for (const [minR, stat, v] of C.SLOT_PERKS[slot]) {
          if (it.rarity < minR) continue;
          switch (stat) {
            case 'dmgPct': st.dmgMult += v; break;
            case 'startLevel': st.startLevel += v; break;
            case 'startProj': st.startProj += v; break;
            case 'hpPct': st.hpPct += v; break;
            case 'takenPct': st.takenMult *= (1 - v); break;
            case 'regen': st.regen += v; break;
            case 'crit': st.crit += v; break;
            case 'critDmg': st.critMult += v; break;
            case 'atkPct': st.atkPct += v; break;
            case 'speedPct': st.speedMult += v; break;
            case 'pickupPct': st.pickupMult += v; break;
            case 'healPct': st.healMult += v; break;
            case 'freeRevive': st.freeRevives += v; break;
            case 'xpPct': st.xpMult += v; break;
            case 'coinPct': st.coinMult += v; break;
            case 'cdPct': st.cdMult *= (1 - v); break;
            default: break;
          }
        }
      }
      st.atkPct += t.atk * C.TALENTS.atk.per;
      st.hpPct += t.hp * C.TALENTS.hp.per;
      st.takenMult *= (1 - Math.min(C.TALENTS.def.max, t.def) * C.TALENTS.def.per);
      st.regen += t.regen * C.TALENTS.regen.per;
      st.pickupMult += t.pickup * C.TALENTS.pickup.per;
      st.coinMult += t.coins * C.TALENTS.coins.per;
      st.atk = Math.round(st.atk * (1 + st.atkPct));
      st.hp = Math.round(st.hp * (1 + st.hpPct));
      st.power = Math.round(st.atk * 10 + st.hp * 1.2);
      return st;
    },

    // --------------------------------------------------------------- talents
    talentCheck(s, id) {
      const lvl = s.talents[id];
      const def = C.TALENTS[id];
      if (def.max && lvl >= def.max) return { ok: false, reason: 'max' };
      if (lvl >= C.talentCap(s.account.level)) return { ok: false, reason: 'cap' };
      const cost = C.talentCost(lvl);
      if (s.coins < cost) return { ok: false, reason: 'coins', cost };
      return { ok: true, cost };
    },

    upgradeTalent(s, id) {
      const chk = this.talentCheck(s, id);
      if (!chk.ok) return chk;
      s.coins -= chk.cost;
      s.talents[id]++;
      return chk;
    },

    // ---------------------------------------------------------------- energy
    updateEnergy(s, now) {
      const E = C.ENERGY;
      if (s.energy >= E.max) { s.energyTs = now; return; }
      const elapsed = Math.max(0, (now - s.energyTs) / 1000);
      const gained = Math.floor(elapsed / E.regenSec);
      if (gained > 0) {
        s.energy = Math.min(E.max, s.energy + gained);
        s.energyTs = s.energy >= E.max ? now : s.energyTs + gained * E.regenSec * 1000;
      }
    },
    energyNextIn(s, now) {
      if (s.energy >= C.ENERGY.max) return 0;
      return Math.max(0, C.ENERGY.regenSec - (now - s.energyTs) / 1000);
    },
    energyFullIn(s, now) {
      if (s.energy >= C.ENERGY.max) return 0;
      return this.energyNextIn(s, now) + (C.ENERGY.max - s.energy - 1) * C.ENERGY.regenSec;
    },
    spendEnergy(s, now, amount) {
      this.updateEnergy(s, now);
      if (s.energy < amount) return false;
      if (s.energy >= C.ENERGY.max) s.energyTs = now;
      s.energy -= amount;
      return true;
    },

    // ---------------------------------------------------------------- patrol
    patrolRates(s) {
      const best = s.chapter.cleared;
      return { coins: C.PATROL.coinsPerHour(best), xp: C.PATROL.xpPerHour(best), scrap: C.PATROL.scrapPerHour(best) };
    },
    patrolPending(s, now) {
      const cap = C.PATROL.capHours * 3600;
      const sec = U.clamp((now - s.patrol.lastClaim) / 1000, 0, cap);
      return this.patrolFor(s, sec);
    },
    patrolFor(s, sec) {
      const r = this.patrolRates(s);
      const h = sec / 3600;
      const coinMult = this.heroStats(s).coinMult;
      return {
        seconds: sec,
        coins: Math.floor(r.coins * h * coinMult),
        xp: Math.floor(r.xp * h),
        scrap: Math.floor(r.scrap * h),
        gearRolls: Math.floor(h * C.PATROL.gearPerHour + 0.0001),
        full: sec >= C.PATROL.capHours * 3600 - 1,
      };
    },
    patrolFullIn(s, now) {
      return Math.max(0, C.PATROL.capHours * 3600 - (now - s.patrol.lastClaim) / 1000);
    },
    /** Apply patrol rewards (mult = 1 or 3 with ad). Returns granted summary. */
    claimPatrol(s, now, mult, rng) {
      const p = this.patrolPending(s, now);
      s.patrol.lastClaim = now;
      const summary = this.applyPatrol(s, p, mult, rng);
      this.questProgress(s, 'patrol', 1);
      return summary;
    },
    applyPatrol(s, p, mult, rng) {
      const summary = { coins: p.coins * mult, xp: p.xp * mult, scrap: p.scrap * mult, items: [], seconds: p.seconds };
      s.coins += summary.coins;
      s.scrap += summary.scrap;
      summary.levels = this.addAccountXp(s, summary.xp);
      for (let i = 0; i < p.gearRolls * mult; i++) {
        const id = rng.pick(C.ITEM_IDS);
        summary.items.push(this.addItem(s, id, rng.chance(0.25) ? 1 : 0));
      }
      return summary;
    },
    quickPatrolOptions(s) {
      const d = s.daily;
      return {
        free: d.quickFree < C.PATROL.quickFreePerDay,
        ad: d.quickAds < C.PATROL.quickAdPerDay,
        adsLeft: C.PATROL.quickAdPerDay - d.quickAds,
        gemCost: C.PATROL.quickGemCost,
      };
    },
    quickPatrol(s, mode, rng) {
      const d = s.daily;
      if (mode === 'free') { if (d.quickFree >= C.PATROL.quickFreePerDay) return null; d.quickFree++; }
      else if (mode === 'ad') { if (d.quickAds >= C.PATROL.quickAdPerDay) return null; d.quickAds++; }
      else if (mode === 'gems') { if (s.gems < C.PATROL.quickGemCost) return null; s.gems -= C.PATROL.quickGemCost; }
      const p = this.patrolFor(s, C.PATROL.quickHours * 3600);
      p.gearRolls = rng.chance(0.3) ? 1 : 0;
      return this.applyPatrol(s, p, 1, rng);
    },

    // --------------------------------------------------------------- account
    addAccountXp(s, xp) {
      const gained = [];
      s.account.xp += xp;
      while (s.account.xp >= C.accountXpToNext(s.account.level)) {
        s.account.xp -= C.accountXpToNext(s.account.level);
        s.account.level++;
        const reward = { gems: 20 + s.account.level * 5, energy: 10 };
        s.gems += reward.gems;
        s.energy += reward.energy;
        gained.push({ level: s.account.level, reward });
      }
      return gained;
    },

    // ---------------------------------------------------------------- chests
    rollChest(s, type, rng) {
      const odds = C.CHESTS[type].odds;
      const rarity = rng.weighted(odds);
      const id = rng.pick(C.ITEM_IDS);
      s.stats.chests++;
      this.questProgress(s, 'chest', 1);
      return this.addItem(s, id, rarity);
    },
    buyChest(s, type, count, rng) {
      const cost = C.CHESTS[type].cost * count * (count >= 10 ? 0.9 : 1);
      if (s.gems < cost) return null;
      s.gems -= Math.round(cost);
      const items = [];
      for (let i = 0; i < count; i++) items.push(this.rollChest(s, type, rng));
      return items;
    },
    freeGoldIn(s, now) { return Math.max(0, (s.freeGoldReadyAt - now) / 1000); },
    claimFreeGold(s, now, rng) {
      if (this.freeGoldIn(s, now) > 0) return null;
      s.freeGoldReadyAt = now + C.FREE_GOLD_COOLDOWN * 1000;
      return [this.rollChest(s, 'gold', rng)];
    },
    /** Rewarded ad: cut the remaining waiting time by 80%. */
    cutFreeGold(s, now) {
      const rem = this.freeGoldIn(s, now);
      if (rem <= 0) return 0;
      const cut = rem * C.FREE_GOLD_AD_CUT;
      s.freeGoldReadyAt -= cut * 1000;
      return cut;
    },
    claimAdSilver(s, rng) {
      if (s.daily.silverAds >= C.AD_SILVER_PER_DAY) return null;
      s.daily.silverAds++;
      return [this.rollChest(s, 'silver', rng)];
    },

    /** Shop: coins worth C.COIN_CACHE.hours of patrol for gems. */
    coinCacheAmount(s) { return Math.round(this.patrolRates(s).coins * C.COIN_CACHE.hours * this.heroStats(s).coinMult); },
    buyCoinCache(s) {
      if (s.gems < C.COIN_CACHE.gemCost) return 0;
      s.gems -= C.COIN_CACHE.gemCost;
      const coins = this.coinCacheAmount(s);
      s.coins += coins;
      return coins;
    },

    /** Grant a reward object {coins, gems, energy, scrap, chest}. */
    grant(s, reward, rng, mult) {
      mult = mult || 1;
      const out = { coins: 0, gems: 0, energy: 0, scrap: 0, items: [] };
      if (reward.coins) { out.coins = reward.coins * mult; s.coins += out.coins; }
      if (reward.gems) { out.gems = reward.gems * mult; s.gems += out.gems; }
      if (reward.energy) { out.energy = reward.energy * mult; s.energy += out.energy; }
      if (reward.scrap) { out.scrap = reward.scrap * mult; s.scrap += out.scrap; }
      if (reward.chest) for (let i = 0; i < mult; i++) out.items.push(this.rollChest(s, reward.chest, rng));
      return out;
    },

    // ----------------------------------------------------------------- daily
    ensureDaily(s, now, rng) {
      const day = U.dayKey(now);
      if (s.daily && s.daily.day === day) return false;
      const qrng = U.rng(day * 7919 + 17);
      const pool = C.QUESTS.slice();
      qrng.shuffle(pool);
      const picked = pool.slice(0, 5).map((q) => ({ id: q.id, target: q.target, pts: q.pts, progress: 0, claimed: false }));
      s.daily = {
        day, quests: picked, activity: 0, activityClaimed: [],
        ads: 0, adTrackerClaimed: [], quickFree: 0, quickAds: 0, energyAds: 0, gemAds: 0, silverAds: 0,
      };
      return true;
    },
    questProgress(s, id, n) {
      if (!s.daily) return;
      for (const q of s.daily.quests) if (q.id === id && !q.claimed) q.progress = Math.min(q.target, q.progress + n);
    },
    claimQuest(s, idx) {
      const q = s.daily.quests[idx];
      if (!q || q.claimed || q.progress < q.target) return false;
      q.claimed = true;
      s.daily.activity += q.pts;
      return true;
    },
    claimActivity(s, idx, rng) {
      const m = C.ACTIVITY_MILESTONES[idx];
      if (!m || s.daily.activity < m.pts || s.daily.activityClaimed.includes(idx)) return null;
      s.daily.activityClaimed.push(idx);
      return this.grant(s, m.reward, rng);
    },
    recordAd(s, now) {
      s.daily.ads++;
      s.stats.adsTotal++;
      s.ads.lastRewarded = now;
      this.questProgress(s, 'ads', 1);
    },
    claimAdTracker(s, idx, rng) {
      const m = C.AD_TRACKER[idx];
      if (!m || s.daily.ads < m.ads || s.daily.adTrackerClaimed.includes(idx)) return null;
      s.daily.adTrackerClaimed.push(idx);
      return this.grant(s, m.reward, rng);
    },
    adTrackerClaimable(s) {
      return C.AD_TRACKER.some((m, i) => s.daily.ads >= m.ads && !s.daily.adTrackerClaimed.includes(i));
    },

    // ----------------------------------------------------------------- login
    loginAvailable(s, now) { return s.login.lastDay !== U.dayKey(now); },
    claimLogin(s, now, mult, rng) {
      if (!this.loginAvailable(s, now)) return null;
      const idx = s.login.index % C.LOGIN_REWARDS.length;
      s.login.lastDay = U.dayKey(now);
      s.login.index = idx + 1;
      return { day: idx, granted: this.grant(s, C.LOGIN_REWARDS[idx], rng, mult) };
    },

    // ---------------------------------------------------------- achievements
    statValue(s, stat) {
      switch (stat) {
        case 'bestChapter': return s.chapter.cleared;
        case 'codex': return Object.keys(s.codex).length;
        case 'accountLevel': return s.account.level;
        default: return s.stats[stat] || 0;
      }
    },
    achievementClaimable(s, a) { return !s.achievements[a.id] && this.statValue(s, a.stat) >= a.target; },
    claimAchievement(s, id) {
      const a = C.ACHIEVEMENTS.find((x) => x.id === id);
      if (!a || !this.achievementClaimable(s, a)) return 0;
      s.achievements[id] = true;
      s.gems += a.gems;
      return a.gems;
    },

    // ------------------------------------------------------------------ runs
    /**
     * result: {chapter, cleared, time, kills, elites, bossKilled, level, evolutions:[ids], coins (picked up)}
     * Returns the computed rewards WITHOUT applying them (apply via applyRunRewards with a multiplier).
     */
    runRewards(s, result, rng) {
      const R = C.RUN_REWARDS;
      const ch = result.chapter - 1;
      const stats = this.heroStats(s);
      const minutes = result.time / 60;
      let coins = (result.kills * R.coinPerKill + minutes * R.coinPerMinute + result.coins) * R.chapterCoinMult(ch);
      if (result.cleared) coins += R.clearBonus(ch);
      coins = Math.round(coins * stats.coinMult);
      const scrap = result.cleared ? R.scrapOnClear(ch) : Math.floor(minutes / 3);
      const xp = R.accountXp(result.kills, result.time, result.cleared, ch);
      const items = [];
      if (result.cleared) items.push({ id: rng.pick(C.ITEM_IDS), rarity: rng.weighted(R.gearOnClear(ch)) });
      if (result.elites > 0 && rng.chance(0.25 * result.elites)) items.push({ id: rng.pick(C.ITEM_IDS), rarity: rng.weighted([[0, 60], [1, 35], [2, 5]]) });
      return { coins, scrap, xp, items };
    },

    applyRunRewards(s, result, rewards, mult) {
      const out = { coins: rewards.coins * mult, scrap: rewards.scrap * mult, xp: rewards.xp, items: [] };
      s.coins += out.coins;
      s.scrap += out.scrap;
      out.levels = this.addAccountXp(s, out.xp);
      for (let m = 0; m < mult; m++) for (const it of rewards.items) out.items.push(this.addItem(s, it.id, it.rarity));
      s.stats.kills += result.kills;
      s.stats.runs++;
      s.stats.elites += result.elites;
      if (result.bossKilled) s.stats.bosses++;
      s.stats.bestRunLevel = Math.max(s.stats.bestRunLevel, result.level);
      for (const e of result.evolutions) { s.codex[e] = true; s.stats.evolutions++; }
      const key = String(result.chapter);
      if (result.cleared) {
        s.chapter.cleared = Math.max(s.chapter.cleared, result.chapter);
        s.chapter.unlocked = Math.min(C.CHAPTERS.length, Math.max(s.chapter.unlocked, result.chapter + 1));
        s.chapter.best[key] = Math.min(s.chapter.best[key] || Infinity, result.time);
      } else if (!s.chapter.best[key]) {
        s.chapter.best['survived' + key] = Math.max(s.chapter.best['survived' + key] || 0, result.time);
      }
      this.questProgress(s, 'kills', result.kills);
      this.questProgress(s, 'runs', 1);
      this.questProgress(s, 'elites', result.elites);
      return out;
    },

    // --------------------------------------------------------- notifications
    /** Delay (s) for a reminder due in `delaySec`; one that would fire during quiet hours waits until morning. */
    notifyDelay(now, delaySec) {
      const Q = C.NOTIFY_QUIET;
      const at = new Date(now + delaySec * 1000);
      const h = at.getHours();
      if (h < Q.from && h >= Q.to) return delaySec;
      const morning = new Date(at.getFullYear(), at.getMonth(), at.getDate() + (h >= Q.from ? 1 : 0), Q.to, 0, 0, 0);
      return (morning.getTime() - now) / 1000;
    },

    // --------------------------------------------------------- interstitials
    interstitialAllowed(s, now) {
      const A = C.ADS;
      if (s.stats.runs < A.interstitialFreeRuns) return false;
      if ((now - s.ads.lastInterstitial) / 1000 < A.interstitialMinGap) return false;
      if ((now - s.ads.lastRewarded) / 1000 < A.interstitialAfterRewardGap) return false;
      return true;
    },

    // ----------------------------------------------------------- red badges
    badges(s, now) {
      const b = { shop: false, gear: false, talents: false, events: false, battle: false };
      b.shop = this.freeGoldIn(s, now) <= 0 || this.adTrackerClaimable(s);
      b.gear = s.inventory.some((it) => this.canMerge(s, it.uid)) || C.SLOTS.some((slot) => {
        const cur = this.equippedItem(s, slot);
        return s.inventory.some((it) => C.ITEMS[it.id].slot === slot && (!cur || this.itemScore(it) > this.itemScore(cur)));
      });
      b.talents = C.TALENT_IDS.some((id) => this.talentCheck(s, id).ok);
      b.events = this.loginAvailable(s, now)
        || s.daily.quests.some((q) => !q.claimed && q.progress >= q.target)
        || C.ACTIVITY_MILESTONES.some((m, i) => s.daily.activity >= m.pts && !s.daily.activityClaimed.includes(i))
        || C.ACHIEVEMENTS.some((a) => this.achievementClaimable(s, a));
      b.battle = this.patrolPending(s, now).seconds >= 3600;
      return b;
    },
    itemScore(it) { return C.itemStat(it) * (C.SLOT_STAT[C.ITEMS[it.id].slot] === 'atk' ? 10 : 1.2) + it.rarity * 1000; },
  };

  NH.Meta = Meta;
  if (typeof module !== 'undefined' && module.exports) module.exports = NH;
})(typeof window !== 'undefined' ? window : globalThis);
