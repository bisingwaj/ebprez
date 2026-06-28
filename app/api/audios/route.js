import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { checkAdmin } from '@/lib/auth';
import { getAudios, setAudios } from '@/lib/store';
import { isValidSlot } from '@/lib/slots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin view of the full audios map (slot -> { url, name, ... }).
export async function GET(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const audios = await getAudios();
  return NextResponse.json({ audios }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const action = body.action;
  const slot = body.slot;
  if (!isValidSlot(slot)) return NextResponse.json({ error: 'bad-slot' }, { status: 400 });

  const audios = await getAudios();

  if (action === 'register') {
    const b = body.blob || {};
    if (!b.url) return NextResponse.json({ error: 'missing-url' }, { status: 400 });
    // replace previous clip for this slot (delete old blob if different)
    const prev = audios[slot];
    if (prev && prev.url && prev.url !== b.url) { try { await del(prev.url); } catch (e) {} }
    audios[slot] = { url: b.url, name: b.name || b.pathname || 'audio', size: b.size || null, pathname: b.pathname || null, uploadedAt: new Date().toISOString() };
    await setAudios(audios);
    return NextResponse.json({ ok: true, slot, audio: audios[slot] });
  }

  if (action === 'delete') {
    const prev = audios[slot];
    if (prev && prev.url) { try { await del(prev.url); } catch (e) {} }
    delete audios[slot];
    await setAudios(audios);
    return NextResponse.json({ ok: true, slot });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
