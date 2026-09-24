'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const NH = require('../../tools/load-game');

require(path.join(__dirname, '..', '..', 'game', 'js', 'render', 'renderer.js'));

test('game canvas uses a regular (synchronized) 2D context', () => {
  // `desynchronized: true` presents the canvas outside the page compositor; in the Android WebView
  // this left the battlefield black under a working HUD on the first launch.
  let requested = null;
  const canvas = { style: {}, getContext: (type, attrs) => { requested = { type, attrs: attrs || {} }; return {}; } };
  new NH.Renderer(canvas);
  assert.equal(requested.type, '2d');
  assert.notEqual(requested.attrs.desynchronized, true);
});
