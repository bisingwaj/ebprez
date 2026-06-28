import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getAdminSecret } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DEV-ONLY fallback used when Vercel Blob is not configured. Writes the file to
// public/uploads/ and returns a public path. Disabled when Blob is configured
// (production), where the normal client-upload path is used instead.
export async function POST(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'use-blob' }, { status: 400 });
  }
  const form = await req.formData();
  const secret = form.get('secret');
  if (!secret || secret !== getAdminSecret()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'no-file' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const safe = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const rand = Math.random().toString(36).slice(2, 8);
  const fname = Date.now() + '-' + rand + '-' + safe;
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), bytes);
  return NextResponse.json({ url: '/uploads/' + fname, pathname: fname, size: bytes.length });
}
