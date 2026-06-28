// WebAudio singleton ported from the original Component (lines 326-349).
// The AudioContext must be created/resumed inside a user gesture; unlock() does that.

let _actx = null;

export function getCtx() {
  try {
    if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    return _actx;
  } catch (e) {
    return null;
  }
}

// Call this from a click/keydown handler to unlock audio for later (remote-triggered) playback.
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
  return c;
}

export function tone(freq, dur, type = 'sine', gain = 0.16, t0 = 0) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + t0;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.03);
}

export function sBeep() { tone(720, 0.07, 'triangle', 0.13); }
export function sErr() { tone(200, 0.16, 'sawtooth', 0.16); tone(150, 0.22, 'sawtooth', 0.16, 0.1); }
export function sOk() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.14, i * 0.07)); }
export function sTick(low) { tone(low ? 130 : 1500, low ? 0.16 : 0.05, low ? 'sine' : 'square', low ? 0.22 : 0.08); }

export function sBoom() {
  const c = getCtx(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(40, t + 1.1);
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.start(t); o.stop(t + 1.5);
}

export function sSwell() {
  const c = getCtx(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(660, t + 1.4);
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
  o.start(t); o.stop(t + 1.8);
}

/* ---------- synth ambience / sound design ---------- */
let _amb = null;
export function startAmbience(level = 0.05) {
  const c = getCtx(); if (!c || _amb) return;
  const t = c.currentTime;
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.linearRampToValueAtTime(level, t + 2.2);
  master.connect(c.destination);
  // two low detuned oscillators (a drone + its fifth)
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  o1.type = 'sine'; o2.type = 'sine';
  o1.frequency.setValueAtTime(55, t); o2.frequency.setValueAtTime(82.4, t); o2.detune.setValueAtTime(-6, t);
  // slow shimmer via an LFO on a separate gain
  const lfo = c.createOscillator(), lfoGain = c.createGain();
  lfo.frequency.setValueAtTime(0.08, t); lfoGain.gain.setValueAtTime(level * 0.5, t);
  lfo.connect(lfoGain); lfoGain.connect(master.gain);
  o1.connect(master); o2.connect(master);
  o1.start(t); o2.start(t); lfo.start(t);
  _amb = { master, nodes: [o1, o2, lfo] };
}
export function stopAmbience() {
  const c = getCtx(); if (!c || !_amb) return;
  const t = c.currentTime;
  try {
    _amb.master.gain.cancelScheduledValues(t);
    _amb.master.gain.setValueAtTime(_amb.master.gain.value, t);
    _amb.master.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    _amb.nodes.forEach((n) => { try { n.stop(t + 1.4); } catch (e) {} });
  } catch (e) {}
  _amb = null;
}
// dramatic rising sweep (e.g. during the countdown into activation)
export function riser(dur = 3) {
  const c = getCtx(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth'; f.type = 'lowpass';
  o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(900, t + dur);
  f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  o.connect(f); f.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.3);
}
