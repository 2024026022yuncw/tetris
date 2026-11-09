// Web Audio API-based BGM + SFX synthesis.
// No external audio files required. Call resume() on first user gesture.
//
// BGM = simple looping "Korobeiniki"-style melody (public-domain folk tune)
//       rendered with a square-wave lead + triangle bass, through a soft gain.

const NOTE = {
  // base MIDI numbers for one octave starting from A4 (440 Hz)
  rest: null,
  C4: 60, "C#4": 61, D4: 62, "D#4": 63, E4: 64, F4: 65, "F#4": 66,
  G4: 67, "G#4": 68, A4: 69, "A#4": 70, B4: 71,
  C5: 72, "C#5": 73, D5: 74, "D#5": 75, E5: 76, F5: 77, "F#5": 78,
  G5: 79, "G#5": 80, A5: 81, "A#5": 82, B5: 83,
  C6: 84,
  E3: 52, A3: 57, B3: 59, D3: 50, F3: 53, G3: 55,
  A2: 45, E2: 40, B2: 47, C3: 48,
};

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// Melody (Korobeiniki in Em), 16th-note grid-ish. [noteName, beats] with quarter = 1.
// Public-domain Russian folk tune.
const MELODY = [
  ["E5",1],["B4",0.5],["C5",0.5],["D5",1],["C5",0.5],["B4",0.5],
  ["A4",1],["A4",0.5],["C5",0.5],["E5",1],["D5",0.5],["C5",0.5],
  ["B4",1.5],["C5",0.5],["D5",1],["E5",1],
  ["C5",1],["A4",1],["A4",2],

  ["D5",1],["F5",0.5],["A5",1],["G5",0.5],["F5",0.5],
  ["E5",1.5],["C5",0.5],["E5",1],["D5",0.5],["C5",0.5],
  ["B4",1],["B4",0.5],["C5",0.5],["D5",1],["E5",1],
  ["C5",1],["A4",1],["A4",2],
];
const BASS = [
  ["E3",2],["A3",2],["E3",2],["A3",2],
  ["E3",2],["A3",2],["E3",2],["A3",2],
  ["D3",2],["A3",2],["E3",2],["A3",2],
  ["E3",2],["A3",2],["E3",2],["A3",2],
];

const BPM = 150;
const BEAT = 60 / BPM;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this._bgmTimer = null;
    this._bgmPlaying = false;
    this._nextBgmAt = 0;
  }

  async resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.35;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch {}
    }
  }

  setMuted(m) {
    this.muted = m;
    if (!this.master) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // ----- SFX -----
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case "move":    return this._blip(220, 0.04, "square", 0.25);
      case "rotate":  return this._blip(440, 0.05, "square", 0.28);
      case "lock":    return this._blip(140, 0.07, "triangle", 0.45);
      case "clear":   return this._arp([523, 659, 784], 0.07);
      case "tetris":  return this._arp([523, 659, 784, 1046, 1318], 0.07);
      case "gameover":return this._gameOver();
    }
  }

  _blip(freq, dur, type = "square", amp = 0.3) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(amp, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _arp(freqs, step) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.09, "square", 0.3), i * step * 1000);
    });
  }

  _gameOver() {
    const t0 = this.ctx.currentTime;
    const notes = [[523, 0.15],[440, 0.15],[349, 0.15],[262, 0.3]];
    let t = t0;
    for (const [f, d] of notes) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + d + 0.02);
      t += d;
    }
  }

  // ----- BGM -----
  startBGM() {
    if (!this.ctx || this._bgmPlaying) return;
    this._bgmPlaying = true;
    this._nextBgmAt = this.ctx.currentTime + 0.05;
    this._scheduleBgmLoop();
  }

  stopBGM() {
    this._bgmPlaying = false;
    if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
  }

  _scheduleBgmLoop() {
    if (!this._bgmPlaying) return;
    const loopDuration = this._renderMelody(this._nextBgmAt);
    this._nextBgmAt += loopDuration;
    // schedule next loop just before this one ends
    const msUntilNext = Math.max(50, (loopDuration - 0.5) * 1000);
    this._bgmTimer = setTimeout(() => this._scheduleBgmLoop(), msUntilNext);
  }

  _renderMelody(startAt) {
    const g = this.musicGain;
    const ctx = this.ctx;
    let t = startAt;
    // melody voice
    for (const [n, b] of MELODY) {
      const dur = b * BEAT;
      if (n !== "rest" && NOTE[n] !== undefined) {
        const f = mtof(NOTE[n]);
        const osc = ctx.createOscillator();
        const vg  = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = f;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(0.35, t + 0.008);
        vg.gain.setValueAtTime(0.35, t + dur * 0.8);
        vg.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(vg).connect(g);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      t += dur;
    }
    const melodyEnd = t;

    // bass voice
    t = startAt;
    for (const [n, b] of BASS) {
      const dur = b * BEAT;
      if (NOTE[n] !== undefined) {
        const f = mtof(NOTE[n]);
        const osc = ctx.createOscillator();
        const vg  = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = f;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(0.5, t + 0.01);
        vg.gain.setValueAtTime(0.5, t + dur * 0.9);
        vg.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(vg).connect(g);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      t += dur;
    }
    return melodyEnd - startAt;
  }
}
