import { NextResponse } from 'next/server';
import { getSession, getFlow, getAudioUrls, getActiveVideo } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public state polled by the projection and the validator devices.
// NOTE: never expose the activation codes here.
export async function GET() {
  const [session, flow, audios, active] = await Promise.all([
    getSession(), getFlow(), getAudioUrls(), getActiveVideo(),
  ]);
  return NextResponse.json(
    {
      command: session.command,
      epoch: session.epoch,
      videoUrl: session.videoUrl || (active ? active.url : null),
      activeVideoUrl: active ? active.url : null,
      flow,
      audios,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
