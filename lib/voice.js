'use client';

// Named voice/audio player for the projection. Holds one HTMLAudioElement per
// slot, preloads them, and plays a slot returning a Promise that resolves when
// the clip ENDS (this is what drives the per-commune timing). Unlocked by a
// user gesture (the "ACTIVER" button) so later remote-triggered playback works.

const els = {};      // slot -> HTMLAudioElement
let unlocked = false;

export function setAudios(map) {
  map = map || {};
  Object.keys(map).forEach((slot) => {
    const url = map[slot];
    if (!url) { delete els[slot]; return; }
    if (!els[slot] || els[slot]._url !== url) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      a._url = url;
      try { a.load(); } catch (e) {}
      els[slot] = a;
    }
  });
  Object.keys(els).forEach((slot) => { if (!map[slot]) delete els[slot]; });
}

export function has(slot) { return !!els[slot]; }
export function isUnlocked() { return unlocked; }

// Must be called inside a user gesture. Primes every clip for later playback.
export function unlock() {
  unlocked = true;
  Object.values(els).forEach((a) => {
    if (!a) return;
    try {
      a.muted = true;
      const p = a.play();
      if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    } catch (e) {}
  });
}

// Play a slot; resolves true on 'ended', false if missing/errored.
export function play(slot, volume) {
  const a = els[slot];
  if (!a) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const fin = (ok) => {
      if (done) return; done = true;
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      resolve(ok);
    };
    const onEnd = () => fin(true);
    const onErr = () => fin(false);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    try {
      a.currentTime = 0; a.muted = false; a.loop = false;
      if (volume != null) a.volume = volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => fin(false));
    } catch (e) { fin(false); }
  });
}

// Play slots in sequence (each waits for the previous to end).
export async function playSequence(slots) {
  for (const s of slots) { if (has(s)) await play(s); }
}

// Loop a slot quietly underneath the cinematic (background music / ambience).
export function playLoop(slot, volume = 0.35) {
  const a = els[slot];
  if (!a) return false;
  try { a.loop = true; a.volume = volume; a.currentTime = 0; a.muted = false; const p = a.play(); if (p && p.catch) p.catch(() => {}); return true; }
  catch (e) { return false; }
}
export function stop(slot) {
  const a = els[slot];
  if (a) { try { a.pause(); a.loop = false; a.currentTime = 0; } catch (e) {} }
}

// Stops one-shot clips (voices) but leaves looping background music running.
export function stopAll() {
  Object.values(els).forEach((a) => { if (a && !a.loop) { try { a.pause(); a.currentTime = 0; } catch (e) {} } });
}
// Stops everything, including loops (used on reset).
export function stopEverything() {
  Object.values(els).forEach((a) => { if (a) { try { a.pause(); a.loop = false; a.currentTime = 0; } catch (e) {} } });
}

export function readyCount() {
  const slots = Object.values(els);
  if (!slots.length) return { ready: 0, total: 0 };
  let ready = 0;
  slots.forEach((a) => { if (a && a.readyState >= 3) ready++; });
  return { ready, total: slots.length };
}
