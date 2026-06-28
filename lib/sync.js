'use client';

import { useEffect, useRef, useState } from 'react';

// Poll GET /api/state on an interval. This is the swap point for a realtime
// transport (Pusher/Ably) later — the rest of the app only consumes `session`.
export function useSession(intervalMs = 500) {
  const [session, setSession] = useState(null);
  const stop = useRef(false);

  useEffect(() => {
    stop.current = false;
    let timer = null;
    const tick = async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (res.ok) setSession(await res.json());
      } catch (e) { /* keep last known */ }
      if (!stop.current) timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => { stop.current = true; if (timer) clearTimeout(timer); };
  }, [intervalMs]);

  return session;
}
