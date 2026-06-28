import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { getAdminSecret } from '@/lib/auth';
import {
  getVideos, setVideos, getActiveVideoId, setActiveVideoId, getAudios, setAudios,
} from '@/lib/store';
import { isValidSlot } from '@/lib/slots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Blob CLIENT upload token route. Handles both video and audio uploads.
// clientPayload is a JSON string: { secret, kind: 'video'|'audio', slot? }.
export async function POST(req) {
  const body = await req.json();
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || '{}'); } catch (e) {}
        if (!payload.secret || payload.secret !== getAdminSecret()) throw new Error('unauthorized');
        const isAudio = payload.kind === 'audio';
        return {
          allowedContentTypes: isAudio
            ? ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
            : ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          tokenPayload: JSON.stringify({ kind: payload.kind || 'video', slot: payload.slot || null }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let meta = {};
        try { meta = JSON.parse(tokenPayload || '{}'); } catch (e) {}
        if (meta.kind === 'audio' && isValidSlot(meta.slot)) {
          const audios = await getAudios();
          audios[meta.slot] = { url: blob.url, name: blob.pathname, size: blob.size || null, pathname: blob.pathname, uploadedAt: new Date().toISOString() };
          await setAudios(audios);
          return;
        }
        const videos = await getVideos();
        if (videos.find((v) => v.url === blob.url)) return;
        const id = 'v_' + Math.random().toString(36).slice(2, 10);
        await setVideos([{ id, name: blob.pathname, url: blob.url, pathname: blob.pathname, size: blob.size || null, contentType: blob.contentType || 'video/mp4', uploadedAt: new Date().toISOString() }, ...videos]);
        if (!(await getActiveVideoId())) await setActiveVideoId(id);
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'upload-error' }, { status: 400 });
  }
}
