// State store. Uses Vercel KV (Upstash Redis) in production; falls back to an
// in-memory store for local dev so the app runs with zero setup.
// NOTE: the in-memory fallback only syncs within a single process — fine for
// `next dev` (one process), NOT for Vercel production (configure KV there).

import { DEFAULT_CODES } from '@/lib/slots';
import fs from 'fs';
import path from 'path';

// Accept either the Vercel KV names or the Upstash Redis names (depending on
// which storage integration is added in the Vercel dashboard).
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
let kv = null;
const hasKV = !!(REDIS_URL && REDIS_TOKEN);

// Local dev: persist the in-memory store to disk so generated audio / uploads
// survive dev-server restarts. (Production uses Vercel KV instead.)
const DEV_FILE = path.join(process.cwd(), '.eb-store.json');
function devLoad() { try { return JSON.parse(fs.readFileSync(DEV_FILE, 'utf8')); } catch (e) { return null; } }
function devPersist() { try { fs.writeFileSync(DEV_FILE, JSON.stringify(globalThis.__EB_MEM)); } catch (e) {} }

if (hasKV) {
  kv = require('@vercel/kv').createClient({ url: REDIS_URL, token: REDIS_TOKEN });
} else if (typeof globalThis.__EB_MEM === 'undefined') {
  const loaded = devLoad();
  if (loaded) {
    globalThis.__EB_MEM = loaded;
  } else {
    // Seed a local sample video so the full flow is testable without Blob.
    const sample = {
      id: 'v_sample', name: 'Vidéo officielle (exemple local)', url: '/sample-video.mp4',
      pathname: 'sample-video.mp4', size: 9435136, contentType: 'video/mp4', uploadedAt: new Date().toISOString(),
    };
    globalThis.__EB_MEM = {
      videos: [sample], activeVideoId: sample.id, audios: {},
      codes: { ...DEFAULT_CODES }, flow: { step: 'minister', epoch: 0, lastActor: null },
      session: { command: 'idle', epoch: 0, videoId: null, videoUrl: null },
    };
    devPersist();
  }
}

const KEYS = {
  videos: 'eb:videos', active: 'eb:activeVideoId', audios: 'eb:audios',
  codes: 'eb:codes', flow: 'eb:flow', session: 'eb:session',
};

async function get(key, fallback) {
  if (hasKV) { const v = await kv.get(key); return v == null ? fallback : v; }
  const m = globalThis.__EB_MEM;
  const map = { [KEYS.videos]: 'videos', [KEYS.active]: 'activeVideoId', [KEYS.audios]: 'audios', [KEYS.codes]: 'codes', [KEYS.flow]: 'flow', [KEYS.session]: 'session' };
  const f = map[key];
  return f ? m[f] : fallback;
}
async function set(key, val) {
  if (hasKV) { await kv.set(key, val); return; }
  const m = globalThis.__EB_MEM;
  const map = { [KEYS.videos]: 'videos', [KEYS.active]: 'activeVideoId', [KEYS.audios]: 'audios', [KEYS.codes]: 'codes', [KEYS.flow]: 'flow', [KEYS.session]: 'session' };
  if (map[key]) { m[map[key]] = val; devPersist(); }
}

export function isPersistent() { return hasKV; }

// videos
export async function getVideos() { return (await get(KEYS.videos, [])) || []; }
export async function setVideos(v) { await set(KEYS.videos, v); }
export async function getActiveVideoId() { return await get(KEYS.active, null); }
export async function setActiveVideoId(id) { await set(KEYS.active, id); }
export async function getActiveVideo() {
  const videos = await getVideos();
  if (!videos.length) return null;
  const id = await getActiveVideoId();
  return videos.find((v) => v.id === id) || videos[0];
}

// audios: map slot -> { url, name, size, pathname }
export async function getAudios() { return (await get(KEYS.audios, {})) || {}; }
export async function setAudios(map) { await set(KEYS.audios, map); }
// public projection map slot -> url
export async function getAudioUrls() {
  const a = await getAudios();
  const out = {};
  for (const k of Object.keys(a)) if (a[k] && a[k].url) out[k] = a[k].url;
  return out;
}

// codes
export async function getCodes() { return (await get(KEYS.codes, { ...DEFAULT_CODES })) || { ...DEFAULT_CODES }; }
export async function setCodes(c) { await set(KEYS.codes, c); }

// validation flow
export async function getFlow() { return (await get(KEYS.flow, { step: 'minister', epoch: 0, lastActor: null })) || { step: 'minister', epoch: 0, lastActor: null }; }
export async function setFlow(f) { await set(KEYS.flow, f); }

// cinematic session (run/reset trigger)
export async function getSession() { return (await get(KEYS.session, { command: 'idle', epoch: 0, videoId: null, videoUrl: null })); }
export async function setSession(s) { await set(KEYS.session, s); }
