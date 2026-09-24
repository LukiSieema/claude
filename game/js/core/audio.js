/* Neon Horde — procedural audio: WebAudio SFX + generative synthwave music. No audio files needed. */
(function (root) {
  'use strict';
  const NH = root.NH = root.NH || {};

  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noise: null,
    sfxOn: true, musicOn: true,
    lastPlay: {},
    combo: 0, comboT: 0,
    music: { mode: 'off', step: 0, nextTime: 0, timer: null, bar: 0 },

    init() {
      if (this.ctx) return;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const ctx = this.ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.sfxBus.connect(this.master); this.musicBus.connect(this.master);
      this.master.connect(comp); comp.connect(ctx.destination);
      // shared white noise buffer
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      // music delay (echo) for space
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 60 / 112 * 0.75;
      const fb = ctx.createGain(); fb.gain.value = 0.28;
      const wet = ctx.createGain(); wet.gain.value = 0.35;
      this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.musicBus);
    },

    unlock() {
      this.init();
      if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    },

    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
    resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); },

    setSfx(on) { this.sfxOn = on; if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05); },
    setMusic(on) {
      this.musicOn = on;
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
    },

    /** Throttle helper: max `perSec` plays of `key`. */
    gate(key, perSec) {
      if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return false;
      const now = this.ctx.currentTime;
      if (now - (this.lastPlay[key] || 0) < 1 / perSec) return false;
      this.lastPlay[key] = now;
      return true;
    },

    tone(type, f0, f1, dur, vol, when, bus, attack) {
      const ctx = this.ctx;
      const t = (when || ctx.currentTime);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
      return o;
    },

    noiseHit(dur, vol, filterType, f0, f1, when, bus) {
      const ctx = this.ctx;
      const t = when || ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 1;
      const f = ctx.createBiquadFilter();
      f.type = filterType || 'lowpass';
      f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },

    // --------------------------------------------------------------- SFX
    play(name, arg) {
      if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return;
      const r = 1 + (Math.random() - 0.5) * 0.12;
      switch (name) {
        case 'blaster': if (this.gate(name, 12)) this.tone('square', 1300 * r, 480, 0.07, 0.05); break;
        case 'lightning': if (this.gate(name, 6)) { this.noiseHit(0.18, 0.25, 'highpass', 2500, 900); this.tone('sawtooth', 1800, 200, 0.15, 0.05); } break;
        case 'firebomb': if (this.gate(name, 4)) this.noiseHit(0.3, 0.18, 'bandpass', 400, 1600); break;
        case 'drone': if (this.gate(name, 8)) this.tone('triangle', 900 * r, 1500, 0.06, 0.05); break;
        case 'disc': if (this.gate(name, 5)) this.noiseHit(0.22, 0.12, 'bandpass', 3000, 800); break;
        case 'frost': if (this.gate(name, 3)) { this.tone('sine', 1560, 1560, 0.4, 0.06); this.tone('sine', 2340, 2340, 0.35, 0.04, this.ctx.currentTime + 0.03); this.noiseHit(0.3, 0.08, 'highpass', 5000, 7000); } break;
        case 'rocket': if (this.gate(name, 4)) this.noiseHit(0.35, 0.14, 'lowpass', 600, 2400); break;
        case 'orbit': if (this.gate(name, 2)) this.tone('sine', 300, 900, 0.25, 0.06); break;
        case 'hit': if (this.gate(name, 22)) this.tone('square', 220 * r, 90, 0.035, 0.035); break;
        case 'crit': if (this.gate(name, 10)) this.tone('square', 900 * r, 300, 0.06, 0.05); break;
        case 'kill': if (this.gate(name, 16)) { this.tone('sine', 520 * r, 120, 0.12, 0.09); } break;
        case 'explosion':
          if (this.gate(name, 8)) {
            this.noiseHit(arg ? 0.7 : 0.35, arg ? 0.5 : 0.28, 'lowpass', arg ? 1800 : 2400, 90);
            this.tone('sine', arg ? 110 : 160, 38, arg ? 0.5 : 0.25, arg ? 0.45 : 0.25);
          }
          break;
        case 'gem': {
          if (!this.gate(name, 30)) break;
          const now = this.ctx.currentTime;
          if (now - this.comboT > 0.5) this.combo = 0;
          this.comboT = now;
          this.combo = Math.min(this.combo + 1, 24);
          const f = 700 * Math.pow(2, (this.combo % 12) / 12 + Math.floor(this.combo / 12) * 0.5);
          this.tone('sine', f, f * 1.02, 0.08, 0.06);
          break;
        }
        case 'coin': if (this.gate(name, 10)) { this.tone('square', 1318, 1318, 0.06, 0.05); this.tone('square', 1760, 1760, 0.12, 0.05, this.ctx.currentTime + 0.06); } break;
        case 'heal': this.tone('sine', 440, 880, 0.35, 0.12); this.tone('sine', 660, 1320, 0.35, 0.08, this.ctx.currentTime + 0.05); break;
        case 'pickup': this.tone('triangle', 600, 1200, 0.18, 0.12); break;
        case 'levelup': {
          const t = this.ctx.currentTime;
          [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.16, 0.07, t + i * 0.055));
          this.tone('sine', 2093, 2093, 0.6, 0.05, t + 0.28);
          break;
        }
        case 'heroHit': if (this.gate(name, 6)) { this.tone('sawtooth', 160, 60, 0.18, 0.18); this.noiseHit(0.12, 0.18, 'lowpass', 1200, 200); } break;
        case 'bossWarning': {
          const t = this.ctx.currentTime;
          for (let i = 0; i < 6; i++) this.tone('sawtooth', i % 2 ? 440 : 330, i % 2 ? 440 : 330, 0.24, 0.12, t + i * 0.25, this.sfxBus, 0.02);
          break;
        }
        case 'bossSpawn': this.tone('sawtooth', 70, 45, 1.4, 0.35, null, null, 0.1); this.noiseHit(1.2, 0.3, 'lowpass', 400, 60); break;
        case 'bossAttack': if (this.gate(name, 2)) this.tone('sawtooth', 220, 110, 0.3, 0.12); break;
        case 'eliteSpawn': this.tone('sawtooth', 180, 360, 0.4, 0.12); break;
        case 'dash': if (this.gate(name, 4)) this.noiseHit(0.2, 0.12, 'bandpass', 800, 2400); break;
        case 'crate': {
          const t = this.ctx.currentTime;
          this.noiseHit(0.5, 0.2, 'bandpass', 300, 4000);
          [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.08, t + 0.2 + i * 0.07));
          break;
        }
        case 'evolve': {
          const t = this.ctx.currentTime;
          [262, 330, 392, 523, 659, 784].forEach((f) => this.tone('sawtooth', f, f * 1.005, 1.4, 0.05, t, this.sfxBus, 0.08));
          this.noiseHit(1.2, 0.15, 'highpass', 3000, 9000, t);
          break;
        }
        case 'victory': {
          const t = this.ctx.currentTime;
          [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.22, 0.08, t + i * 0.11));
          break;
        }
        case 'death': this.tone('sawtooth', 440, 55, 1.1, 0.2, null, null, 0.01); break;
        case 'revive': this.tone('sine', 220, 1760, 0.6, 0.2); this.noiseHit(0.6, 0.2, 'highpass', 800, 6000); break;
        case 'click': this.tone('triangle', 900, 700, 0.05, 0.08); break;
        case 'confirm': this.tone('triangle', 660, 660, 0.07, 0.08); this.tone('triangle', 990, 990, 0.1, 0.08, this.ctx.currentTime + 0.07); break;
        case 'deny': this.tone('square', 180, 140, 0.16, 0.08); break;
        case 'buy': this.tone('square', 1047, 1047, 0.08, 0.06); this.tone('square', 1568, 1568, 0.16, 0.06, this.ctx.currentTime + 0.08); break;
        case 'reward': {
          const t = this.ctx.currentTime;
          [659, 784, 988, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.08, t + i * 0.06));
          break;
        }
        case 'card': this.tone('sine', 700 + (arg || 0) * 120, 900 + (arg || 0) * 120, 0.08, 0.07); break;
        default: break;
      }
    },

    // ------------------------------------------------------------- music
    setMusicMode(mode) {
      if (!this.ctx) return;
      if (this.music.mode === mode) return;
      this.music.mode = mode;
      if (mode === 'off') { clearInterval(this.music.timer); this.music.timer = null; return; }
      if (!this.music.timer) {
        this.music.nextTime = this.ctx.currentTime + 0.1;
        this.music.step = 0;
        this.music.timer = setInterval(() => this.schedule(), 30);
      }
    },

    schedule() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const m = this.music;
      // music muted: keep the clock moving but create no nodes (saves battery)
      if (!this.musicOn) { m.nextTime = this.ctx.currentTime + 0.05; return; }
      const bpm = m.mode === 'boss' ? 132 : m.mode === 'battle' ? 116 : 92;
      const stepDur = 60 / bpm / 4;
      while (m.nextTime < this.ctx.currentTime + 0.15) {
        this.playStep(m.step, m.nextTime, stepDur);
        m.nextTime += stepDur;
        m.step = (m.step + 1) % 256;
      }
    },

    playStep(step, t, sd) {
      const mode = this.music.mode;
      const bus = this.musicBus;
      // A minor: Am F C G  (boss: Am Dm E Am)
      const prog = mode === 'boss' ? [[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64]] : [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
      const bar = Math.floor(step / 16) % 4;
      const chord = prog[bar];
      const s = step % 16;
      const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
      // pad on bar start
      if (s === 0) {
        for (const n of chord) {
          const o = this.tone('sawtooth', hz(n), hz(n), sd * 16, mode === 'menu' ? 0.035 : 0.025, t, bus, 0.4);
          o.detune.value = (Math.random() - 0.5) * 14;
        }
      }
      // bass
      if (mode !== 'menu' ? s % 2 === 0 : s % 8 === 0) {
        const f = hz(chord[0] - 24 + (s % 8 === 6 && mode !== 'menu' ? 12 : 0));
        this.tone('sawtooth', f, f, sd * 1.8, mode === 'boss' ? 0.11 : 0.09, t, bus, 0.005);
      }
      // arpeggio
      if (mode === 'menu' ? s % 4 === 0 : true) {
        const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
        const n = chord[pattern[s % 8]] + 12 + (s >= 8 && mode === 'boss' ? 12 : 0);
        const o = this.tone(mode === 'menu' ? 'triangle' : 'square', hz(n), hz(n), sd * 0.9, mode === 'menu' ? 0.045 : 0.022, t, bus, 0.003);
        if (this.delay && s % 2 === 0) { const g = this.ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(this.delay); }
      }
      if (mode === 'menu') return;
      // drums
      if (s % 4 === 0) { this.tone('sine', 150, 42, 0.22, 0.3, t, bus, 0.002); }
      if (s % 8 === 4) this.noiseHit(0.16, 0.16, 'bandpass', 1800, 900, t, bus);
      if (s % 2 === 1 || mode === 'boss') this.noiseHit(0.04, 0.05, 'highpass', 7000, 9000, t, bus);
    },
  };

  NH.Audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
