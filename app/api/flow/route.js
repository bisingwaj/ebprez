import { NextResponse } from 'next/server';
import { getFlow, setFlow } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the projection when the network initialisation finishes, so the
// President's device can present the ACTIVATION confirmation. Idempotent: only
// advances from 'initializing' -> 'president_activate'.
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (e) {}
  if (body.action !== 'init-done') return NextResponse.json({ error: 'unknown-action' }, { status: 400 });

  const flow = await getFlow();
  if (flow.step !== 'initializing') {
    return NextResponse.json({ ok: true, step: flow.step }); // already advanced / not applicable
  }
  await setFlow({ step: 'president_activate', epoch: Date.now(), lastActor: 'system' });
  return NextResponse.json({ ok: true, step: 'president_activate' });
}
