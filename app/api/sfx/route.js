import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { getAudios, setAudios } from '@/lib/store';
import { storeAudioBytes } from '@/lib/storage-server';
import { isValidSlot } from '@/lib/slots';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EL_BASE = 'https://api.elevenlabs.io/v1';
function key() { return process.env.ELEVENLABS_API_KEY || ''; }

// Generate a Sound Effect or a Music bed from a prompt and assign it to a slot.
// body: { slot, mode: 'sfx' | 'music', prompt, duration?, durationMs? }
export async function POST(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!key()) return NextResponse.json({ error: 'no-elevenlabs-key' }, { status: 400 });

  let body = {};
  try { body = await req.json(); } catch (e) {}
  const slot = body.slot;
  const mode = body.mode === 'music' ? 'music' : 'sfx';
  const prompt = (body.prompt || '').trim();
  if (!isValidSlot(slot)) return NextResponse.json({ error: 'bad-slot' }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: 'empty-prompt' }, { status: 400 });

  let res;
  try {
    if (mode === 'music') {
      const ms = Math.min(120000, Math.max(5000, body.durationMs || 30000));
      res = await fetch(EL_BASE + '/music', {
        method: 'POST',
        headers: { 'xi-api-key': key(), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ prompt, music_length_ms: ms }),
      });
    } else {
      const dur = Math.min(22, Math.max(0.5, body.duration || 3));
      res = await fetch(EL_BASE + '/sound-generation', {
        method: 'POST',
        headers: { 'xi-api-key': key(), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: prompt, duration_seconds: dur, prompt_influence: 0.45 }),
      });
    }
  } catch (e) {
    return NextResponse.json({ error: 'elevenlabs-unreachable' }, { status: 502 });
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.detail?.message || JSON.stringify(j.detail || j).slice(0, 200); } catch (e) {}
    return NextResponse.json({ error: 'elevenlabs-error', status: res.status, detail }, { status: 502 });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const stored = await storeAudioBytes(slot + '.mp3', buffer, 'audio/mpeg');

  const audios = await getAudios();
  const prev = audios[slot];
  if (prev && prev.url && prev.url !== stored.url && process.env.BLOB_READ_WRITE_TOKEN) {
    try { await del(prev.url); } catch (e) {}
  }
  audios[slot] = { url: stored.url, name: slot + '.mp3', size: stored.size, pathname: stored.pathname, prompt, mode, uploadedAt: new Date().toISOString() };
  await setAudios(audios);

  return NextResponse.json({ ok: true, slot, audio: audios[slot] });
}
