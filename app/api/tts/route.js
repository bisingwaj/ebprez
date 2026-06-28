import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { getAudios, setAudios } from '@/lib/store';
import { storeAudioBytes } from '@/lib/storage-server';
import { isValidSlot, FALLBACK_VOICES, DEFAULT_VOICE_ID } from '@/lib/slots';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EL_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

function key() { return process.env.ELEVENLABS_API_KEY || ''; }

// GET: list available voices (from the account, or fallback) + whether a key is set.
export async function GET(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const hasKey = !!key();
  // diagnostics: which integrations are wired in this deployment
  const diag = {
    hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasKV: !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)),
  };
  if (!hasKey) return NextResponse.json({ hasKey: false, ...diag, voices: FALLBACK_VOICES, defaultVoice: DEFAULT_VOICE_ID });
  try {
    const res = await fetch(EL_BASE + '/voices', { headers: { 'xi-api-key': key() }, cache: 'no-store' });
    if (!res.ok) throw new Error('voices-fetch-failed');
    const data = await res.json();
    const voices = (data.voices || []).map((v) => ({ voice_id: v.voice_id, name: v.name + (v.labels && v.labels.gender ? ' (' + v.labels.gender + ')' : '') }));
    return NextResponse.json({ hasKey: true, ...diag, voices: voices.length ? voices : FALLBACK_VOICES, defaultVoice: DEFAULT_VOICE_ID });
  } catch (e) {
    return NextResponse.json({ hasKey: true, ...diag, voices: FALLBACK_VOICES, defaultVoice: DEFAULT_VOICE_ID });
  }
}

// POST: generate a natural voice clip from text and assign it to a slot.
export async function POST(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!key()) return NextResponse.json({ error: 'no-elevenlabs-key' }, { status: 400 });

  let body = {};
  try { body = await req.json(); } catch (e) {}
  const text = (body.text || '').trim();
  const slot = body.slot;
  const voiceId = body.voiceId || DEFAULT_VOICE_ID;
  const model = body.model || DEFAULT_MODEL;
  // tuned for a natural, deep, dignified delivery
  const vs = {
    stability: body.stability != null ? body.stability : 0.55,
    similarity_boost: 0.9,
    style: body.style != null ? body.style : 0.1,
    use_speaker_boost: true,
    speed: body.speed != null ? body.speed : 0.96, // slightly slower => more gravitas
  };
  if (!isValidSlot(slot)) return NextResponse.json({ error: 'bad-slot' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'empty-text' }, { status: 400 });

  const payload = { text, model_id: model, voice_settings: vs };
  // force a language when asked (only supported by turbo/flash v2.5 models)
  if (body.languageCode) payload.language_code = body.languageCode;

  let res;
  try {
    res = await fetch(EL_BASE + '/text-to-speech/' + voiceId + '?output_format=mp3_44100_192', {
      method: 'POST',
      headers: { 'xi-api-key': key(), 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return NextResponse.json({ error: 'elevenlabs-unreachable' }, { status: 502 });
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail?.message || ''; } catch (e) {}
    return NextResponse.json({ error: 'elevenlabs-error', status: res.status, detail }, { status: 502 });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  let stored;
  try { stored = await storeAudioBytes(slot + '.mp3', buffer, 'audio/mpeg'); }
  catch (e) { return NextResponse.json({ error: 'storage-failed', detail: String((e && e.message) || e), hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN }, { status: 500 }); }

  const audios = await getAudios();
  const prev = audios[slot];
  if (prev && prev.url && prev.url !== stored.url && process.env.BLOB_READ_WRITE_TOKEN) {
    try { await del(prev.url); } catch (e) {}
  }
  audios[slot] = { url: stored.url, name: slot + '.mp3', size: stored.size, pathname: stored.pathname, text, voiceId, model, uploadedAt: new Date().toISOString() };
  await setAudios(audios);

  return NextResponse.json({ ok: true, slot, audio: audios[slot] });
}
