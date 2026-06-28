'use client';

import React, { useState } from 'react';
import * as A from '@/lib/audio';

// Compact 6-digit keypad styled like the original auth screen.
// Calls onValid() when the entered code matches `code`.
export default function Keypad({ code = '332003', onValid, disabled }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);

  function press(d) {
    if (disabled || val.length >= 6) return;
    A.unlockAudio(); A.sBeep();
    const next = val + d;
    setVal(next); setErr(false);
    if (next.length === 6) setTimeout(() => validate(next), 380);
  }
  function back() { A.sBeep(); setVal((v) => v.slice(0, -1)); setErr(false); }
  function validate(candidate) {
    const c = candidate != null ? candidate : val;
    if (c.length < 6) return;
    if (c === code) { A.sOk(); setVal(''); setErr(false); if (onValid) onValid(); }
    else { A.sErr(); setErr(true); setTimeout(() => { setVal(''); setErr(false); }, 700); }
  }

  const cells = Array.from({ length: 6 }).map((_, i) => {
    const filled = i < val.length;
    return {
      ch: filled ? '●' : '',
      border: err ? '#ff4d4d' : (filled ? '#38e1ff' : 'rgba(56,225,255,.25)'),
      glow: err ? '0 0 16px rgba(255,77,77,.5)' : (filled ? '0 0 16px rgba(56,225,255,.45)' : 'none'),
    };
  });
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 12, animation: err ? 'ebShake .5s' : undefined }}>
        {cells.map((c, i) => (
          <div key={i} style={{
            width: 46, height: 58, borderRadius: 6, background: 'rgba(10,28,48,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#eaf6ff',
            border: '1.5px solid ' + c.border, boxShadow: c.glow, transition: 'all .2s',
          }}>{c.ch}</div>
        ))}
      </div>
      <div style={{ height: 18, marginTop: 10, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, letterSpacing: '.24em', color: '#ff4d4d' }}>
        {err ? 'CODE INVALIDE — NOUVELLE TENTATIVE' : ''}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3,72px)', gap: 10 }}>
        {labels.map((l, i) => {
          const isAct = l === 'OK', isClr = l === 'C';
          return (
            <button key={i} className={'eb-key' + (isAct ? ' eb-key-ok' : '')} disabled={disabled}
              onClick={() => { if (isAct) validate(); else if (isClr) back(); else press(l); }}
              style={{
                height: 62, borderRadius: 8, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 23,
                cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: disabled ? 0.4 : 1,
                border: '1px solid ' + (isAct ? 'rgba(56,225,255,.6)' : (isClr ? 'rgba(255,154,60,.5)' : 'rgba(56,225,255,.22)')),
                background: isAct ? 'rgba(31,143,255,.22)' : (isClr ? 'rgba(255,154,60,.12)' : 'rgba(10,28,48,.55)'),
                color: isAct ? '#38e1ff' : (isClr ? '#ff9a3c' : '#dceaff'),
              }}>{isAct ? '⏎' : l}</button>
          );
        })}
      </div>
    </div>
  );
}
