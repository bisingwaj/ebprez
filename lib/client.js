'use client';

import { upload } from '@vercel/blob/client';

const SECRET_KEY = 'eb_admin_secret';

export function getSecret() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(SECRET_KEY) || '';
}
export function setSecret(s) {
  if (typeof window !== 'undefined') sessionStorage.setItem(SECRET_KEY, s || '');
}
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getSecret() };
}

/* ---------------- videos ---------------- */
export async function fetchVideos() {
  const res = await fetch('/api/videos', { cache: 'no-store' });
  return res.json();
}
export async function setActiveVideo(id) {
  const res = await fetch('/api/videos', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'set-active', id }) });
  if (!res.ok) throw new Error('set-active-failed');
  return res.json();
}
export async function deleteVideo(id) {
  const res = await fetch('/api/videos', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'delete', id }) });
  if (!res.ok) throw new Error('delete-failed');
  return res.json();
}

/* ---------------- audios ---------------- */
export async function fetchAudios() {
  const res = await fetch('/api/audios', { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('audios-failed');
  return res.json();
}
export async function deleteAudio(slot) {
  const res = await fetch('/api/audios', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'delete', slot }) });
  if (!res.ok) throw new Error('delete-audio-failed');
  return res.json();
}

/* ---------------- TTS (ElevenLabs) ---------------- */
export async function fetchVoices() {
  const res = await fetch('/api/tts', { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('voices-failed');
  return res.json();
}
export async function generateVoice(slot, text, voiceId) {
  const res = await fetch('/api/tts', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ slot, text, voiceId }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'tts-failed'); e.detail = data.detail; throw e; }
  return data;
}
export async function generateSound(slot, prompt, mode, opts) {
  const res = await fetch('/api/sfx', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ slot, prompt, mode, ...(opts || {}) }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'sfx-failed'); e.detail = data.detail; throw e; }
  return data;
}

/* ---------------- codes ---------------- */
export async function fetchCodes() {
  const res = await fetch('/api/config', { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('config-failed');
  return res.json();
}
export async function saveCodes(codes) {
  const res = await fetch('/api/config', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ codes }) });
  if (!res.ok) throw new Error('save-codes-failed');
  return res.json();
}

/* ---------------- validation flow ---------------- */
export async function submitValidation(role, code) {
  const res = await fetch('/api/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'validate-failed'); e.code = data.error; throw e; }
  return data;
}

// Projection signals the network initialisation is finished.
export async function signalInitDone() {
  try { await fetch('/api/flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'init-done' }) }); }
  catch (e) {}
}

/* ---------------- admin manual command ---------------- */
export async function sendCommand(command) {
  const res = await fetch('/api/command', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ command }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'command-failed');
  return res.json();
}

/* ---------------- uploads (Blob with local-dev fallback) ---------------- */
async function blobOrLocalUpload(file, payloadObj, onProgress) {
  try {
    const blob = await upload(file.name, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      clientPayload: JSON.stringify(payloadObj),
      contentType: file.type || undefined,
      onUploadProgress: (p) => { if (onProgress) onProgress(Math.round(p.percentage)); },
    });
    return { url: blob.url, pathname: blob.pathname, size: file.size };
  } catch (e) {
    // Dev fallback: no Vercel Blob token configured -> store on local disk.
    const fd = new FormData();
    fd.append('file', file);
    fd.append('secret', getSecret());
    const res = await fetch('/api/local-upload', { method: 'POST', body: fd });
    if (!res.ok) throw e; // in production (Blob configured) we never reach here
    const j = await res.json();
    if (onProgress) onProgress(100);
    return { url: j.url, pathname: j.pathname, size: j.size };
  }
}

export async function uploadVideo(file, onProgress) {
  const out = await blobOrLocalUpload(file, { secret: getSecret(), kind: 'video' }, onProgress);
  await fetch('/api/videos', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ action: 'register', blob: { url: out.url, pathname: out.pathname, name: file.name, size: file.size, contentType: file.type || 'video/mp4' } }),
  });
  return out;
}

export async function uploadAudio(slot, file, onProgress) {
  const out = await blobOrLocalUpload(file, { secret: getSecret(), kind: 'audio', slot }, onProgress);
  await fetch('/api/audios', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ action: 'register', slot, blob: { url: out.url, pathname: out.pathname, name: file.name, size: file.size } }),
  });
  return out;
}
