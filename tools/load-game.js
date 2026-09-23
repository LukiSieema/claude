/* Loads the game's logic modules (no rendering/DOM) into Node for tests and balance simulation. */
'use strict';
const path = require('path');

const GAME = path.join(__dirname, '..', 'game', 'js');
const FILES = [
  'core/util.js',
  'core/config.js',
  'core/save.js',
  'meta/meta.js',
  'game/world.js',
  'game/weapons.js',
  'game/enemies.js',
];

for (const f of FILES) require(path.join(GAME, f));

module.exports = globalThis.NH;
