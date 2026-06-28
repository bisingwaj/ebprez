'use client';

import React, { useEffect, useState } from 'react';
import { fetchCodes, saveCodes } from '@/lib/client';
import { ROLE_LABEL } from '@/lib/slots';

const card = {
  border: '1px solid rgba(56,225,255,.18)', borderRadius: 10, background: 'rgba(10,28,48,.4)',
  padding: 18, fontFamily: "'Rajdhani',sans-serif", color: '#dceaff',
};
const mono = { fontFamily: "'IBM Plex Mono',monospace" };

export default function CodesManager() {
  const [codes, setCodes] = useState({ minister: '', pm: '', president: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { const d = await fetchCodes(); setCodes(d.codes || {}); }
      catch (e) { setError('Impossible de charger les codes (clé administrateur ?)'); }
    })();
  }, []);

  function upd(role, v) { setCodes((c) => ({ ...c, [role]: v.replace(/[^0-9]/g, '').slice(0, 6) })); setMsg(''); }
  async function save() {
    setError(''); setMsg('');
    for (const r of ['minister', 'pm', 'president']) {
      if (!codes[r] || codes[r].length !== 6) { setError('Chaque code doit faire 6 chiffres.'); return; }
    }
    try { await saveCodes(codes); setMsg('Codes enregistrés ✓'); }
    catch (e) { setError('Échec de l’enregistrement (clé administrateur ?)'); }
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.12em', color: '#eaf6ff', marginBottom: 6 }}>CODES D'ACTIVATION</div>
      <div style={{ ...mono, fontSize: 11.5, color: 'rgba(170,205,235,.65)', marginBottom: 14, lineHeight: 1.6 }}>
        Ordre de saisie : Ministre → Première Ministre → Président (déclenche le lancement).
        6 chiffres chacun.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['minister', 'pm', 'president'].map((role) => (
          <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 15, color: '#dceaff' }}>{ROLE_LABEL[role]}</div>
            <input value={codes[role] || ''} onChange={(e) => upd(role, e.target.value)} inputMode="numeric"
              placeholder="------" maxLength={6}
              style={{ ...mono, width: 130, letterSpacing: '.3em', textAlign: 'center', padding: '10px 12px', fontSize: 16,
                borderRadius: 8, border: '1px solid rgba(56,225,255,.35)', background: 'rgba(2,8,16,.6)', color: '#eaf6ff', outline: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <button onClick={save} style={{ ...mono, fontSize: 13, letterSpacing: '.08em', padding: '10px 18px', borderRadius: 8,
          border: '1px solid rgba(56,225,255,.5)', background: 'rgba(31,143,255,.22)', color: '#38e1ff', cursor: 'pointer' }}>
          ENREGISTRER LES CODES
        </button>
        {msg && <span style={{ ...mono, fontSize: 12, color: '#19e08a' }}>{msg}</span>}
        {error && <span style={{ ...mono, fontSize: 12, color: '#ff4d4d' }}>{error}</span>}
      </div>
    </div>
  );
}
