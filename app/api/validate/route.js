import { NextResponse } from 'next/server';
import {
  getCodes, getFlow, setFlow, getActiveVideo, setSession,
} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Validators submit in order: minister -> pm -> president (INITIALISE, code) ->
// [network initialises] -> president (ACTIVATE, button) -> launch.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const role = body.role;
  const code = String(body.code || '');

  if (!['minister', 'pm', 'president', 'president_activate'].includes(role)) {
    return NextResponse.json({ error: 'bad-role' }, { status: 400 });
  }

  const [codes, flow] = await Promise.all([getCodes(), getFlow()]);
  const now = Date.now();

  if (role === 'minister') {
    if (flow.step !== 'minister') return NextResponse.json({ error: 'not-your-turn', step: flow.step }, { status: 409 });
    if (code !== String(codes.minister || '')) return NextResponse.json({ error: 'bad-code' }, { status: 403 });
    await setFlow({ step: 'pm', epoch: now, lastActor: 'minister' });
    return NextResponse.json({ ok: true, step: 'pm' });
  }

  if (role === 'pm') {
    if (flow.step !== 'pm') return NextResponse.json({ error: 'not-your-turn', step: flow.step }, { status: 409 });
    if (code !== String(codes.pm || '')) return NextResponse.json({ error: 'bad-code' }, { status: 403 });
    await setFlow({ step: 'president', epoch: now, lastActor: 'pm' });
    return NextResponse.json({ ok: true, step: 'president' });
  }

  if (role === 'president') {
    // INITIALISATION (code)
    if (flow.step !== 'president') return NextResponse.json({ error: 'not-your-turn', step: flow.step }, { status: 409 });
    if (code !== String(codes.president || '')) return NextResponse.json({ error: 'bad-code' }, { status: 403 });
    const active = await getActiveVideo();
    if (!active) return NextResponse.json({ error: 'no-active-video' }, { status: 400 });
    await setFlow({ step: 'initializing', epoch: now, lastActor: 'president' });
    await setSession({ command: 'init', epoch: now, videoId: active.id, videoUrl: active.url, startedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, step: 'initializing' });
  }

  // president_activate — ACTIVATION confirmation (no code; just a press)
  if (flow.step !== 'president_activate') return NextResponse.json({ error: 'not-your-turn', step: flow.step }, { status: 409 });
  const active = await getActiveVideo();
  if (!active) return NextResponse.json({ error: 'no-active-video' }, { status: 400 });
  await setFlow({ step: 'launched', epoch: now, lastActor: 'president' });
  await setSession({ command: 'activate', epoch: now, videoId: active.id, videoUrl: active.url, startedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, step: 'launched' });
}
