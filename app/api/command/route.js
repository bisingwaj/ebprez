import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { getActiveVideo, getSession, setSession, setFlow } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin manual control. 'reset' returns everything to the start (validation flow
// back to the minister, projection back to standby). 'run' force-starts the
// cinematic (bypasses the 3-code flow — useful for rehearsals).
export async function POST(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const command = body.command === 'reset' ? 'reset' : 'run';
  const now = Date.now();

  if (command === 'reset') {
    await setFlow({ step: 'minister', epoch: now, lastActor: null });
    await setSession({ command: 'reset', epoch: now, videoId: null, videoUrl: null });
    return NextResponse.json({ ok: true, command: 'reset' });
  }

  const active = await getActiveVideo();
  if (!active) return NextResponse.json({ error: 'no-active-video' }, { status: 400 });
  await setFlow({ step: 'launched', epoch: now, lastActor: 'admin' });
  const session = { command: 'run', epoch: now, videoId: active.id, videoUrl: active.url, startedAt: new Date().toISOString() };
  await setSession(session);
  return NextResponse.json(session);
}
