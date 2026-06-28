'use client';

import React, { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import AudioManager from '@/components/AudioManager';
import CodesManager from '@/components/CodesManager';
import { getSecret, setSecret, sendCommand } from '@/lib/client';
import { useSession } from '@/lib/sync';
import { ROLE_LABEL } from '@/lib/slots';

const mono = { fontFamily: "'IBM Plex Mono',monospace" };
const panel = {
  border: '1px solid rgba(56,225,255,.18)', borderRadius: 10, background: 'rgba(10,28,48,.4)',
  padding: 22, fontFamily: "'Rajdhani',sans-serif", color: '#dceaff',
};
const pageBg = {
  minHeight: '100vh', padding: '28px 24px 60px', color: '#dceaff', fontFamily: "'Rajdhani',sans-serif",
  background: 'radial-gradient(120% 120% at 50% 0%,#08182c 0%,#040b16 55%,#02060d 100%)',
};

const STEP_LABEL = {
  minister: 'En attente — Ministre de la Santé',
  pm: 'En attente — Première Ministre',
  president: 'En attente — Président (initialisation)',
  initializing: 'Initialisation du réseau…',
  president_activate: 'En attente — Président (activation)',
  launched: 'LANCÉ',
};

export default function AdminPage() {
  const [secret, setSecretState] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [msg, setMsg] = useState('');
  const session = useSession(900);

  useEffect(() => { const s = getSecret(); if (s) { setSecretState(s); setUnlocked(true); } }, []);

  function unlock(e) { e.preventDefault(); setSecret(secret.trim()); setUnlocked(true); }
  async function onReset() {
    setMsg('');
    try { await sendCommand('reset'); setMsg('Réinitialisé ✓'); }
    catch (e) { setMsg('Échec réinitialisation (clé ?)'); }
  }
  async function onForceRun() {
    setMsg('');
    try { await sendCommand('run'); setMsg('Lancement forcé ✓'); }
    catch (e) { setMsg(((e.message || '').includes('no-active-video')) ? 'Aucune vidéo active.' : 'Échec (clé ?)'); }
  }

  const flow = session && session.flow;
  const running = session && session.command === 'run';

  if (!unlocked) {
    return (
      <div style={{ ...pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={unlock} style={{ ...panel, width: 420, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '.14em', color: '#eaf6ff' }}>ESPACE ADMINISTRATEUR</div>
          <div style={{ ...mono, fontSize: 12, color: 'rgba(170,205,235,.7)', margin: '10px 0 20px' }}>
            Gestion des contenus (vidéos, voix) et des codes d'activation.
          </div>
          <input type="password" value={secret} autoFocus placeholder="Clé administrateur"
            onChange={(e) => setSecretState(e.target.value)}
            style={{ ...mono, width: '100%', padding: '12px 14px', borderRadius: 8, fontSize: 15,
              border: '1px solid rgba(56,225,255,.35)', background: 'rgba(2,8,16,.6)', color: '#eaf6ff', outline: 'none' }} />
          <button type="submit" style={{ ...mono, marginTop: 16, width: '100%', padding: 12, borderRadius: 8,
            border: '1px solid rgba(56,225,255,.5)', background: 'rgba(31,143,255,.22)', color: '#38e1ff', cursor: 'pointer', fontSize: 14, letterSpacing: '.1em' }}>
            ACCÉDER
          </button>
          <div style={{ ...mono, fontSize: 10.5, color: 'rgba(150,190,225,.45)', marginTop: 16, lineHeight: 1.6 }}>
            Par défaut en local : <b>etoile-bleue-admin</b>. Définissez ADMIN_SECRET sur Vercel.
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 22, height: 22, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(56,225,255,.55)', transform: 'rotate(45deg)' }} />
              <div style={{ width: 7, height: 7, background: '#38e1ff', transform: 'rotate(45deg)', boxShadow: '0 0 10px #38e1ff' }} />
            </div>
            <div style={{ fontWeight: 700, letterSpacing: '.3em', fontSize: 18, color: '#eaf6ff' }}>ÉTOILE BLEUE</div>
            <div style={{ ...mono, fontSize: 12, color: 'rgba(150,185,220,.55)' }}>· ESPACE ADMINISTRATEUR</div>
          </div>
          <div style={{ ...mono, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: running ? '#19e08a' : '#ff9a3c', boxShadow: '0 0 8px ' + (running ? '#19e08a' : '#ff9a3c') }} />
            <span style={{ color: running ? '#19e08a' : '#ff9a3c' }}>
              {running ? 'PROJECTION EN COURS' : (flow ? STEP_LABEL[flow.step] : '—')}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,1fr) minmax(340px,1fr)', gap: 22, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <CodesManager />
            <Dashboard />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <AudioManager />
            <div style={{ ...panel }}>
              <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '.12em', color: '#eaf6ff', marginBottom: 10 }}>CONTRÔLE PROJECTION</div>
              <div style={{ ...mono, fontSize: 11.5, color: 'rgba(170,205,235,.65)', marginBottom: 14, lineHeight: 1.6 }}>
                Pour les répétitions. « Lancer » démarre la séquence sans les 3 codes. « Réinitialiser »
                ramène tout au début (validateurs + projection).
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={onForceRun} style={{ ...mono, fontSize: 12, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(25,224,138,.5)', background: 'rgba(25,224,138,.12)', color: '#19e08a', cursor: 'pointer' }}>▶ LANCER (répétition)</button>
                <button onClick={onReset} style={{ ...mono, fontSize: 12, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,154,60,.45)', background: 'transparent', color: '#ff9a3c', cursor: 'pointer' }}>⟲ RÉINITIALISER</button>
                {msg && <span style={{ ...mono, fontSize: 12, color: '#9fc4e6' }}>{msg}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...mono, fontSize: 11.5, color: 'rgba(150,190,225,.5)', marginTop: 26, lineHeight: 1.8, textAlign: 'center' }}>
          Validateurs : <b style={{ color: '#38e1ff' }}>/validate/minister</b> · <b style={{ color: '#38e1ff' }}>/validate/pm</b> · <b style={{ color: '#38e1ff' }}>/validate/president</b> —
          Projection : <b style={{ color: '#38e1ff' }}>/projection</b>
        </div>
      </div>
    </div>
  );
}
