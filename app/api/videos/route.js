import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { checkAdmin } from '@/lib/auth';
import {
  getVideos, setVideos, getActiveVideoId, setActiveVideoId, isPersistent,
} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [videos, activeVideoId] = await Promise.all([getVideos(), getActiveVideoId()]);
  return NextResponse.json(
    { videos, activeVideoId, persistent: isPersistent() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const action = body.action;
  const videos = await getVideos();

  if (action === 'set-active') {
    if (!videos.find((v) => v.id === body.id)) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    await setActiveVideoId(body.id);
    return NextResponse.json({ ok: true, activeVideoId: body.id });
  }

  if (action === 'register') {
    // Local-dev path: the Blob onUploadCompleted callback doesn't fire on localhost,
    // so the client registers the uploaded blob here after upload() resolves.
    const b = body.blob || {};
    if (!b.url) return NextResponse.json({ error: 'missing-url' }, { status: 400 });
    const existing = videos.find((v) => v.url === b.url);
    if (existing) return NextResponse.json({ ok: true, video: existing }); // dedupe (callback may have registered it)
    const id = 'v_' + Math.random().toString(36).slice(2, 10);
    const entry = {
      id,
      name: b.name || b.pathname || 'video.mp4',
      url: b.url,
      pathname: b.pathname || null,
      size: b.size || null,
      contentType: b.contentType || 'video/mp4',
      uploadedAt: new Date().toISOString(),
    };
    const next = [entry, ...videos];
    await setVideos(next);
    if (!(await getActiveVideoId())) await setActiveVideoId(id); // first upload becomes active
    return NextResponse.json({ ok: true, video: entry });
  }

  if (action === 'delete') {
    const target = videos.find((v) => v.id === body.id);
    if (!target) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    try { if (target.url) await del(target.url); } catch (e) { /* blob may already be gone */ }
    const next = videos.filter((v) => v.id !== body.id);
    await setVideos(next);
    if ((await getActiveVideoId()) === body.id) {
      await setActiveVideoId(next.length ? next[0].id : null);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
