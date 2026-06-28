import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { getCodes, setCodes } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin-only: read/update the 3 activation codes.
export async function GET(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const codes = await getCodes();
  return NextResponse.json({ codes }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch (e) {}
  const incoming = body.codes || {};
  const current = await getCodes();
  const next = { ...current };
  ['minister', 'pm', 'president'].forEach((r) => {
    if (typeof incoming[r] === 'string' && incoming[r].trim()) next[r] = incoming[r].trim();
  });
  await setCodes(next);
  return NextResponse.json({ ok: true, codes: next });
}
