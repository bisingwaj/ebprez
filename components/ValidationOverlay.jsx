'use client';

import React from 'react';
import { FLOW_ORDER, ROLE_LABEL } from '@/lib/slots';

const mono = { fontFamily: "'IBM Plex Mono',monospace" };

// Shows the 3-step authorisation cascade on the projection while validators act.
export default function ValidationOverlay({ flow }) {
  // Only shown during the three code validations (before initialisation runs).
  if (!flow || FLOW_ORDER.indexOf(flow.step) >= FLOW_ORDER.indexOf('initializing')) return null;
  const order = ['minister', 'pm', 'president'];
  const cur = FLOW_ORDER.indexOf(flow.step);

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 110, display: 'flex', justifyContent: 'center', zIndex: 96, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '22px 34px', borderRadius: 14,
        background: 'rgba(4,12,22,.55)', border: '1px solid rgba(56,225,255,.18)', backdropFilter: 'blur(4px)' }}>
        <div style={{ ...mono, fontSize: 13, letterSpacing: '.4em', color: '#38e1ff' }}>AUTORISATIONS PRÉSIDENTIELLES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {order.map((role, i) => {
            const idx = FLOW_ORDER.indexOf(role);
            const done = cur > idx;
            const active = cur === idx;
            const color = done ? '#19e08a' : active ? '#38e1ff' : 'rgba(150,190,225,.4)';
            return (
              <React.Fragment key={role}>
                {i > 0 && <div style={{ width: 46, height: 1, background: cur > FLOW_ORDER.indexOf(order[i - 1]) ? '#19e08a' : 'rgba(56,225,255,.2)' }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 150 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid ' + color, color, fontSize: 24, boxShadow: active ? '0 0 22px rgba(56,225,255,.5)' : (done ? '0 0 18px rgba(25,224,138,.4)' : 'none'),
                    animation: active ? 'ebBreathe 1.4s ease-in-out infinite' : undefined }}>
                    {done ? '✓' : active ? '●' : '○'}
                  </div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: '.08em', color, textAlign: 'center' }}>
                    {ROLE_LABEL[role]}
                  </div>
                  <div style={{ ...mono, fontSize: 10.5, letterSpacing: '.16em', color }}>
                    {done ? 'VALIDÉ' : active ? 'EN COURS…' : 'EN ATTENTE'}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
